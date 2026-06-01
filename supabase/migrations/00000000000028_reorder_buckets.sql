-- =====================================================================
-- Bulk bucket reorder: set full display order in one transaction.
-- Drag-and-drop needs arbitrary moves; neighbor swap (reorder_bucket)
-- stays for kebab menu up/down.
-- =====================================================================

create or replace function public.reorder_buckets(
  p_ordered_bucket_ids uuid[]
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
  v_expected      uuid[];
  v_sorted_input  uuid[];
  v_sorted_expect uuid[];
  v_i             int;
begin
  if v_caller_family is null or v_member is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_ordered_bucket_ids is null or array_length(p_ordered_bucket_ids, 1) is null then
    raise exception 'ordered bucket ids required' using errcode = '22023';
  end if;

  perform public.ensure_member_bucket_orders();

  select coalesce(array_agg(mbo.bucket_id order by mbo.display_order), '{}'::uuid[])
    into v_expected
    from public.member_bucket_order mbo
    join public.buckets b on b.id = mbo.bucket_id
   where mbo.member_id = v_member
     and b.family_id = v_caller_family;

  if array_length(p_ordered_bucket_ids, 1) <> coalesce(array_length(v_expected, 1), 0) then
    raise exception 'bucket order must include every visible bucket exactly once'
      using errcode = '22023';
  end if;

  if v_caller_role = 'child' then
    if exists (
      select 1
        from unnest(p_ordered_bucket_ids) as input_id(id)
        join public.buckets b on b.id = input_id.id
       where b.owner_member_id is distinct from v_member
    ) then
      raise exception 'children cannot reorder buckets' using errcode = '42501';
    end if;
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_sorted_input
    from unnest(p_ordered_bucket_ids) as t(id);

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_sorted_expect
    from unnest(v_expected) as t(id);

  if v_sorted_input <> v_sorted_expect then
    raise exception 'bucket order must include every visible bucket exactly once'
      using errcode = '22023';
  end if;

  for v_i in 1..array_length(p_ordered_bucket_ids, 1) loop
    update public.member_bucket_order
       set display_order = v_i
     where member_id = v_member
       and bucket_id = p_ordered_bucket_ids[v_i];
  end loop;
end;
$$;

revoke all on function public.reorder_buckets(uuid[]) from public;
grant execute on function public.reorder_buckets(uuid[]) to authenticated;
grant execute on function public.reorder_buckets(uuid[]) to service_role;
