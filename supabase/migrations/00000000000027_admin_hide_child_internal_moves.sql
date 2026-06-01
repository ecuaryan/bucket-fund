-- =====================================================================
-- Admins should not see a child's internal bucket moves (unallocated ↔
-- their buckets). Sends and adult-initiated moves stay visible.
-- =====================================================================

create or replace function public.bucket_move_is_child_internal(
  p_from_member_id uuid,
  p_from_bucket_id uuid,
  p_to_bucket_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_from_member_id is not null
    and exists (
      select 1
        from public.family_members fm
       where fm.id = p_from_member_id
         and fm.family_id = public.auth_family_id()
         and fm.role = 'child'
    )
    and (
      p_from_bucket_id is null
      or exists (
        select 1
          from public.buckets b
         where b.id = p_from_bucket_id
           and b.owner_member_id = p_from_member_id
      )
    )
    and (
      p_to_bucket_id is null
      or exists (
        select 1
          from public.buckets b
         where b.id = p_to_bucket_id
           and b.owner_member_id = p_from_member_id
      )
    );
$$;

revoke all on function public.bucket_move_is_child_internal(uuid, uuid, uuid) from public;
grant execute on function public.bucket_move_is_child_internal(uuid, uuid, uuid) to authenticated;

drop policy if exists "transactions_select_role_scoped" on public.transactions;

create policy "transactions_select_role_scoped"
  on public.transactions
  for select
  using (
    family_id = public.auth_family_id()
    and (
      (
        public.auth_role() = 'admin'
        and (
          type = 'send'
          or (
            type = 'bucket_move'
            and not public.bucket_move_is_child_internal(
              from_member_id,
              from_bucket_id,
              to_bucket_id
            )
          )
        )
      )
      or (
        public.auth_role() = 'member'
        and (
          type = 'send'
          or (
            type = 'bucket_move'
            and (
              from_bucket_id is null
              or public.bucket_visible_to_adults(from_bucket_id)
            )
            and (
              to_bucket_id is null
              or public.bucket_visible_to_adults(to_bucket_id)
            )
          )
        )
      )
      or (
        public.auth_role() = 'child'
        and (
          from_member_id = public.auth_member_id()
          or to_member_id = public.auth_member_id()
          or from_bucket_id in (
            select id
              from public.buckets
             where owner_member_id = public.auth_member_id()
          )
          or to_bucket_id in (
            select id
              from public.buckets
             where owner_member_id = public.auth_member_id()
          )
        )
      )
    )
  );
