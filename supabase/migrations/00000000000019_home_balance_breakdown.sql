-- =====================================================================
-- Home balance breakdown for adults: expose terms that sum to unallocated.
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
  v_allocated numeric := 0;
  v_children numeric := 0;
  v_unallocated numeric := 0;
begin
  if v_member_id is null or v_family_id is null then
    return jsonb_build_object(
      'unallocated', 0,
      'total_cash', 0,
      'bucket_allocated', 0,
      'children_set_aside', 0
    );
  end if;

  v_unallocated := public.member_available_balance(v_member_id);

  if v_role in ('admin', 'member') then
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
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

    select coalesce(sum(public.member_child_virtual_balance(fm.id)), 0)
      into v_children
      from public.family_members fm
     where fm.family_id = v_family_id
       and fm.role = 'child';
  else
    select coalesce(sum(a.current_balance), 0)
      into v_cash
      from public.accounts a
     where a.family_id = v_family_id
       and a.owner_member_id = v_member_id
       and public.is_cash_account_type(a.account_type);

    select coalesce(sum(b.allocated_amount), 0)
      into v_allocated
      from public.buckets b
     where b.family_id = v_family_id
       and b.owner_member_id = v_member_id;
  end if;

  return jsonb_build_object(
    'unallocated', v_unallocated,
    'total_cash', v_cash,
    'bucket_allocated', v_allocated,
    'children_set_aside', v_children
  );
end;
$$;

revoke all on function public.get_home_balance_breakdown() from public;
grant execute on function public.get_home_balance_breakdown() to authenticated;
grant execute on function public.get_home_balance_breakdown() to service_role;
