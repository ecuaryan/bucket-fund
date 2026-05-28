-- =====================================================================
-- Home bootstrap: buckets (sorted), accounts, and balance breakdown in
-- one round trip. Replaces separate ensure + 3 selects + breakdown RPC.
-- =====================================================================

create or replace function public.get_home_page_data()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_buckets jsonb;
  v_accounts jsonb;
begin
  if v_member_id is not null then
    perform public.ensure_member_bucket_orders();
  end if;

  select coalesce(
    jsonb_agg(row_to_json(b.*) order by coalesce(mbo.display_order, b.display_order), b.created_at),
    '[]'::jsonb
  )
    into v_buckets
    from public.buckets b
    left join public.member_bucket_order mbo
      on mbo.bucket_id = b.id
     and mbo.member_id = v_member_id;

  select coalesce(
    jsonb_agg(row_to_json(a.*) order by a.created_at),
    '[]'::jsonb
  )
    into v_accounts
    from public.accounts a;

  return jsonb_build_object(
    'buckets', coalesce(v_buckets, '[]'::jsonb),
    'accounts', coalesce(v_accounts, '[]'::jsonb),
    'breakdown', public.get_home_balance_breakdown()
  );
end;
$$;

revoke all on function public.get_home_page_data() from public;
grant execute on function public.get_home_page_data() to authenticated;
grant execute on function public.get_home_page_data() to service_role;
