-- Atomic bucket delete: remove auto-organize lines, drop emptied rules, delete bucket.

create or replace function public.delete_bucket(p_bucket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_family uuid := public.auth_family_id();
  v_caller_role   text := public.auth_role();
  v_member        uuid := public.auth_member_id();
  v_bucket        public.buckets%rowtype;
  v_affected      uuid[];
begin
  if v_caller_family is null or v_member is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select *
    into v_bucket
    from public.buckets
   where id = p_bucket_id
     and family_id = v_caller_family;

  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;

  if v_caller_role = 'admin' then
    null;
  elsif v_caller_role = 'child' then
    if v_bucket.owner_member_id is distinct from v_member then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct l.auto_organize_id), '{}'::uuid[])
    into v_affected
    from public.auto_organize_lines l
    join public.auto_organizes ao on ao.id = l.auto_organize_id
   where l.bucket_id = p_bucket_id
     and ao.family_id = v_caller_family;

  delete from public.auto_organize_lines
   where bucket_id = p_bucket_id
     and auto_organize_id = any(v_affected);

  delete from public.auto_organizes ao
   where ao.id = any(v_affected)
     and ao.family_id = v_caller_family
     and not exists (
       select 1
         from public.auto_organize_lines l
        where l.auto_organize_id = ao.id
     );

  delete from public.buckets
   where id = p_bucket_id
     and family_id = v_caller_family;
end;
$$;

revoke all on function public.delete_bucket(uuid) from public;
grant execute on function public.delete_bucket(uuid) to authenticated;
grant execute on function public.delete_bucket(uuid) to service_role;
