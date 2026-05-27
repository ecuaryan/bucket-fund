-- =====================================================================
-- Member auth: family join codes, PIN lockout, per-member bucket order,
-- adult bucket visibility (hide children's buckets from admin/member).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Family join code (unguessable; used to bind a device to a family)
-- ---------------------------------------------------------------------
create or replace function public.generate_join_code()
returns text
language sql
volatile
as $$
  select upper(
    translate(
      substring(
        replace(replace(encode(extensions.gen_random_bytes(6), 'base64'), '/', ''), '+', '')
        from 1 for 8
      ),
      '0O1IL',
      '23456'
    )
  );
$$;

alter table public.families
  add column join_code text;

update public.families
   set join_code = public.generate_join_code()
 where join_code is null;

alter table public.families
  alter column join_code set not null;

create unique index families_join_code_idx on public.families (join_code);


-- ---------------------------------------------------------------------
-- PIN lockout columns on family_members
-- ---------------------------------------------------------------------
alter table public.family_members
  add column pin_failed_attempts integer not null default 0,
  add column pin_locked boolean not null default false,
  add column pin_set_at timestamptz;

-- Never expose bcrypt hashes to the browser client.
revoke select (pin_hash) on public.family_members from authenticated;
grant select (
  id,
  family_id,
  user_id,
  name,
  role,
  avatar_url,
  pin_failed_attempts,
  pin_locked,
  pin_set_at,
  created_at
) on public.family_members to authenticated;


-- ---------------------------------------------------------------------
-- Per-member bucket display order (adults share bucket set, own sort)
-- ---------------------------------------------------------------------
create table public.member_bucket_order (
  member_id uuid not null references public.family_members(id) on delete cascade,
  bucket_id uuid not null references public.buckets(id) on delete cascade,
  display_order integer not null,
  primary key (member_id, bucket_id)
);

create index member_bucket_order_member_order_idx
  on public.member_bucket_order (member_id, display_order);

alter table public.member_bucket_order enable row level security;

create policy "member_bucket_order_select_own"
  on public.member_bucket_order
  for select
  using (member_id = public.auth_member_id());

-- Writes only through SECURITY DEFINER helpers below.


-- ---------------------------------------------------------------------
-- Bootstrap: only admin email sign-up creates a family (not PIN users)
-- ---------------------------------------------------------------------
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

  insert into public.family_members (family_id, user_id, name, role)
  values (new_family_id, new.id, resolved_display_name, 'admin');

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Buckets: adults no longer see children's buckets
-- ---------------------------------------------------------------------
drop policy if exists "buckets_select_family_or_self" on public.buckets;

create policy "buckets_select_role_scoped"
  on public.buckets
  for select
  using (
    family_id = public.auth_family_id()
    and (
      (
        public.auth_role() in ('admin', 'member')
        and (
          owner_member_id is null
          or exists (
            select 1
              from public.family_members fm
             where fm.id = owner_member_id
               and fm.role in ('admin', 'member')
          )
        )
      )
      or (
        public.auth_role() = 'child'
        and owner_member_id = public.auth_member_id()
      )
    )
  );


-- ---------------------------------------------------------------------
-- Lazy-init per-member order rows from buckets.display_order
-- ---------------------------------------------------------------------
create or replace function public.ensure_member_bucket_orders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := public.auth_member_id();
  v_role text := public.auth_role();
  v_family uuid := public.auth_family_id();
begin
  if v_member is null or v_family is null then
    return;
  end if;

  if v_role in ('admin', 'member') then
    insert into public.member_bucket_order (member_id, bucket_id, display_order)
    select v_member, b.id, b.display_order
      from public.buckets b
     where b.family_id = v_family
       and (
         b.owner_member_id is null
         or exists (
           select 1
             from public.family_members fm
            where fm.id = b.owner_member_id
              and fm.role in ('admin', 'member')
         )
       )
    on conflict (member_id, bucket_id) do nothing;
  elsif v_role = 'child' then
    insert into public.member_bucket_order (member_id, bucket_id, display_order)
    select v_member, b.id, b.display_order
      from public.buckets b
     where b.owner_member_id = v_member
    on conflict (member_id, bucket_id) do nothing;
  end if;
end;
$$;

revoke all on function public.ensure_member_bucket_orders() from public;
grant execute on function public.ensure_member_bucket_orders() to authenticated;


-- ---------------------------------------------------------------------
-- reorder_bucket: swap within caller's member_bucket_order
-- ---------------------------------------------------------------------
create or replace function public.reorder_bucket(
  p_bucket_id uuid,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_family uuid := public.auth_family_id();
  v_caller_role   text := public.auth_role();
  v_member        uuid := public.auth_member_id();
  v_order         int;
  v_neighbor_id   uuid;
  v_neighbor_order int;
begin
  if v_caller_family is null or v_member is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_caller_role = 'child' and not exists (
    select 1 from public.buckets
     where id = p_bucket_id and owner_member_id = v_member
  ) then
    raise exception 'children cannot reorder buckets' using errcode = '42501';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be up or down' using errcode = '22023';
  end if;

  perform public.ensure_member_bucket_orders();

  select mbo.display_order
    into v_order
    from public.member_bucket_order mbo
    join public.buckets b on b.id = mbo.bucket_id
   where mbo.member_id = v_member
     and mbo.bucket_id = p_bucket_id
     and b.family_id = v_caller_family
     for update of mbo;

  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select mbo.bucket_id, mbo.display_order
      into v_neighbor_id, v_neighbor_order
      from public.member_bucket_order mbo
     where mbo.member_id = v_member
       and mbo.display_order < v_order
     order by mbo.display_order desc
     limit 1
       for update;
  else
    select mbo.bucket_id, mbo.display_order
      into v_neighbor_id, v_neighbor_order
      from public.member_bucket_order mbo
     where mbo.member_id = v_member
       and mbo.display_order > v_order
     order by mbo.display_order asc
     limit 1
       for update;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update public.member_bucket_order
     set display_order = v_neighbor_order
   where member_id = v_member and bucket_id = p_bucket_id;
  update public.member_bucket_order
     set display_order = v_order
   where member_id = v_member and bucket_id = v_neighbor_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Admin: rotate join code (existing device binds are unaffected)
-- ---------------------------------------------------------------------
create or replace function public.rotate_family_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'admins only' using errcode = '42501';
  end if;

  v_code := public.generate_join_code();

  update public.families
     set join_code = v_code
   where id = public.auth_family_id();

  return v_code;
end;
$$;

revoke all on function public.rotate_family_join_code() from public;
grant execute on function public.rotate_family_join_code() to authenticated;

grant select on public.member_bucket_order to authenticated;
