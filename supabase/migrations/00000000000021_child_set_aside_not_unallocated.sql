-- =====================================================================
-- Adult pool: reserve full child stake (cash + sends), not only the
-- child's unallocated slice. Child bucket moves must not return money
-- to the admin/member Home unallocated number.
-- =====================================================================

create or replace function public.member_child_virtual_balance(p_child_member_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_cash numeric := 0;
  v_send_net numeric := 0;
begin
  select fm.family_id into v_family_id
    from public.family_members fm
   where fm.id = p_child_member_id
     and fm.role = 'child';

  if not found then
    return 0;
  end if;

  select coalesce(sum(a.current_balance), 0)
    into v_cash
    from public.accounts a
   where a.family_id = v_family_id
     and a.owner_member_id = p_child_member_id
     and public.is_cash_account_type(a.account_type);

  select coalesce(sum(
           case
             when t.to_member_id = p_child_member_id then t.amount
             when t.from_member_id = p_child_member_id then -t.amount
             else 0
           end
         ), 0)
    into v_send_net
    from public.transactions t
   where t.family_id = v_family_id
     and t.type = 'send';

  -- Total funded to this child (linked cash + net sends). Child bucket
  -- allocations are internal; adults must not "reclaim" unallocated when
  -- a child moves money into their own buckets.
  return v_cash + v_send_net;
end;
$$;
