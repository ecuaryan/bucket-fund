-- =====================================================================
-- Post-hoc note edits on history entries. Amount and parties stay
-- immutable; visibility matches transactions_select_role_scoped.
-- =====================================================================

create or replace function public.transaction_visible_to_caller(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.transactions t
     where t.id = p_transaction_id
       and t.family_id = public.auth_family_id()
       and (
         (
           public.auth_role() = 'admin'
           and (
             t.type = 'send'
             or (
               t.type = 'bucket_move'
               and not public.bucket_move_is_child_internal(
                 t.from_member_id,
                 t.from_bucket_id,
                 t.to_bucket_id
               )
             )
           )
         )
         or (
           public.auth_role() = 'member'
           and (
             t.type = 'send'
             or (
               t.type = 'bucket_move'
               and (
                 t.from_bucket_id is null
                 or public.bucket_visible_to_adults(t.from_bucket_id)
               )
               and (
                 t.to_bucket_id is null
                 or public.bucket_visible_to_adults(t.to_bucket_id)
               )
             )
           )
         )
         or (
           public.auth_role() = 'child'
           and (
             t.from_member_id = public.auth_member_id()
             or t.to_member_id = public.auth_member_id()
             or t.from_bucket_id in (
               select id
                 from public.buckets
                where owner_member_id = public.auth_member_id()
             )
             or t.to_bucket_id in (
               select id
                 from public.buckets
                where owner_member_id = public.auth_member_id()
             )
           )
         )
       )
  );
$$;

revoke all on function public.transaction_visible_to_caller(uuid) from public;
grant execute on function public.transaction_visible_to_caller(uuid) to authenticated;

create or replace function public.update_transaction_note(
  p_transaction_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_family_id() is null or public.auth_member_id() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_note is not null and length(p_note) > 280 then
    raise exception 'note too long' using errcode = '22001';
  end if;

  if not public.transaction_visible_to_caller(p_transaction_id) then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;

  update public.transactions
     set note = nullif(trim(p_note), '')
   where id = p_transaction_id
     and family_id = public.auth_family_id();
end;
$$;

revoke all on function public.update_transaction_note(uuid, text) from public;
grant execute on function public.update_transaction_note(uuid, text) to authenticated;
