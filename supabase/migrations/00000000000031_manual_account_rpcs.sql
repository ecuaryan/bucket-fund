-- =====================================================================
-- Manual money source RPCs (admin-only, family-scoped).
-- =====================================================================

create or replace function public.add_manual_account(
  p_amount numeric,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.auth_family_id();
  v_role text := public.auth_role();
  v_label text := nullif(btrim(p_label), '');
  v_id uuid;
begin
  if v_family_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_role <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or positive' using errcode = '22023';
  end if;
  if v_label is null or length(v_label) > 60 then
    raise exception 'label required (<= 60 chars)' using errcode = '22023';
  end if;

  insert into public.accounts (
    family_id,
    owner_member_id,
    source,
    account_type,
    institution_name,
    account_name,
    current_balance,
    teller_account_id,
    teller_enrollment_id,
    last_synced_at
  ) values (
    v_family_id,
    null,
    'manual',
    'manual',
    v_label,
    v_label,
    p_amount,
    null,
    null,
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_manual_account(
  p_account_id uuid,
  p_amount numeric,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.auth_family_id();
  v_role text := public.auth_role();
  v_label text := nullif(btrim(p_label), '');
begin
  if v_family_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_role <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or positive' using errcode = '22023';
  end if;
  if v_label is null or length(v_label) > 60 then
    raise exception 'label required (<= 60 chars)' using errcode = '22023';
  end if;

  update public.accounts
     set current_balance = p_amount,
         institution_name = v_label,
         account_name = v_label,
         last_synced_at = now()
   where id = p_account_id
     and family_id = v_family_id
     and source = 'manual';

  if not found then
    raise exception 'manual source not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_manual_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.auth_family_id();
  v_role text := public.auth_role();
begin
  if v_family_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_role <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  delete from public.accounts
   where id = p_account_id
     and family_id = v_family_id
     and source = 'manual';

  if not found then
    raise exception 'manual source not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.add_manual_account(numeric, text) from public;
grant execute on function public.add_manual_account(numeric, text) to authenticated;
grant execute on function public.add_manual_account(numeric, text) to service_role;

revoke all on function public.update_manual_account(uuid, numeric, text) from public;
grant execute on function public.update_manual_account(uuid, numeric, text) to authenticated;
grant execute on function public.update_manual_account(uuid, numeric, text) to service_role;

revoke all on function public.delete_manual_account(uuid) from public;
grant execute on function public.delete_manual_account(uuid) to authenticated;
grant execute on function public.delete_manual_account(uuid) to service_role;
