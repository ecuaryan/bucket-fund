-- =====================================================================
-- Home breakdown: split bank cash vs manual money sources.
-- =====================================================================

create or replace function public.get_home_balance_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_role text := public.auth_role();
  v_family_id uuid := public.auth_family_id();
  v_cash numeric := 0;
  v_bank_cash numeric := 0;
  v_manual_cash numeric := 0;
  v_allocated numeric := 0;
  v_children numeric := 0;
  v_children_json jsonb := '[]'::jsonb;
  v_unallocated numeric := 0;
  v_bank_synced timestamptz := null;
begin
  if v_member_id is null or v_family_id is null then
    return jsonb_build_object(
      'unallocated', 0,
      'total_cash', 0,
      'bank_cash', 0,
      'manual_cash', 0,
      'bucket_allocated', 0,
      'children_set_aside', 0,
      'children', '[]'::jsonb,
      'bank_last_synced_at', null
    );
  end if;

  v_unallocated := public.member_available_balance(v_member_id);

  select max(a.last_synced_at)
    into v_bank_synced
    from public.accounts a
   where a.family_id = v_family_id
     and public.is_cash_account_type(a.account_type);

  if v_role in ('admin', 'member') then
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_bank_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source = 'teller'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(a.current_balance), 0)
      into v_manual_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.source = 'manual'
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and (
         b.owner_member_id is null
         or exists (
           select 1
             from public.family_members fm
            where fm.id = b.owner_member_id
              and fm.role in ('admin', 'member')
         )
       );

    with child_lines as (
      select
        fm.id as member_id,
        fm.name,
        public.member_child_virtual_balance(fm.id) as amount
      from public.family_members fm
     where fm.family_id = v_family_id
       and fm.role = 'child'
    )
    select
      coalesce(sum(amount), 0),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'member_id', member_id,
            'name', name,
            'amount', amount
          )
          order by name
        ) filter (where amount <> 0),
        '[]'::jsonb
      )
      into v_children, v_children_json
      from child_lines;

  else
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.owner_member_id = v_member_id
       and public.is_cash_account_type(a.account_type);

    v_bank_cash := v_cash;
    v_manual_cash := 0;

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and b.owner_member_id = v_member_id;
  end if;

  return jsonb_build_object(
    'unallocated', v_unallocated,
    'total_cash', v_cash,
    'bank_cash', v_bank_cash,
    'manual_cash', v_manual_cash,
    'bucket_allocated', v_allocated,
    'children_set_aside', v_children,
    'children', coalesce(v_children_json, '[]'::jsonb),
    'bank_last_synced_at', v_bank_synced
  );
end;
$$;

revoke all on function public.get_home_balance_breakdown() from public;
grant execute on function public.get_home_balance_breakdown() to authenticated;
grant execute on function public.get_home_balance_breakdown() to service_role;
