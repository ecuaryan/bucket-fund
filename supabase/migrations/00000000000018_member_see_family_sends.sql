-- =====================================================================
-- Members share the family pool with admin; they should see all sends in
-- History (e.g. admin funding a child), not only sends they participated in.
-- =====================================================================

drop policy if exists "transactions_select_role_scoped" on public.transactions;

create policy "transactions_select_role_scoped"
  on public.transactions
  for select
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
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
