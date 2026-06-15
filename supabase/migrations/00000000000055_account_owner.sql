-- Account owner: signup admin is permanent; co-admins (role admin) are removable.

alter table public.family_members
  add column is_account_owner boolean not null default false;

create unique index family_members_one_account_owner_idx
  on public.family_members (family_id)
  where is_account_owner;

-- Existing households: earliest admin is the account owner.
update public.family_members fm
   set is_account_owner = true
  from (
    select distinct on (family_id) id
      from public.family_members
     where role = 'admin'
     order by family_id, created_at asc, id asc
  ) owner_row
 where fm.id = owner_row.id
   and not exists (
     select 1
       from public.family_members existing
      where existing.family_id = fm.family_id
        and existing.is_account_owner
   );

-- Bootstrap: email sign-up admin is the account owner.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
  resolved_family_name text;
  resolved_display_name text;
  email_local_part text;
begin
  if coalesce(new.raw_user_meta_data ->> 'bootstrap_family', 'false') <> 'true' then
    return new;
  end if;

  email_local_part := split_part(coalesce(new.email, ''), '@', 1);

  resolved_family_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'family_name', ''),
    nullif(email_local_part, '') || '''s Family',
    'New Family'
  );

  resolved_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(email_local_part, ''),
    'Admin'
  );

  insert into public.families (name, join_code)
  values (resolved_family_name, public.generate_join_code())
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, name, role, is_account_owner)
  values (new_family_id, new.id, resolved_display_name, 'admin', true);

  return new;
end;
$$;

-- Prevent demoting or reassigning account ownership after bootstrap.
create or replace function public.guard_account_owner_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_account_owner and exists (
      select 1
        from public.family_members fm
       where fm.family_id = new.family_id
         and fm.is_account_owner
    ) then
      raise exception 'Family already has an account owner' using errcode = '23505';
    end if;
    return new;
  end if;

  if old.is_account_owner then
    if new.role is distinct from old.role
       or new.is_account_owner is distinct from old.is_account_owner then
      raise exception 'Cannot change role or account ownership of the account owner'
        using errcode = '42501';
    end if;
  end if;

  if not old.is_account_owner and new.is_account_owner then
    raise exception 'Cannot assign account ownership' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_account_owner_member on public.family_members;
create trigger guard_account_owner_member
  before insert or update on public.family_members
  for each row execute function public.guard_account_owner_member();

drop policy if exists "family_members_delete_admin" on public.family_members;

create policy "family_members_delete_admin"
  on public.family_members
  for delete
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
    and is_account_owner = false
  );
