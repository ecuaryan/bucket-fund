-- =====================================================================
-- Bucket structure: admins manage family/adult buckets; members are
-- operational-only (move money, reorder). Children may create and delete
-- only buckets they own — visible only to them via buckets_select RLS.
-- =====================================================================

drop policy if exists "buckets_insert_own_or_admin" on public.buckets;
drop policy if exists "buckets_insert_admin_only" on public.buckets;

create policy "buckets_insert_admin_or_child_own"
  on public.buckets
  for insert
  with check (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or (
        public.auth_role() = 'child'
        and owner_member_id = public.auth_member_id()
      )
    )
  );

drop policy if exists "buckets_delete_own_or_admin" on public.buckets;
drop policy if exists "buckets_delete_admin_only" on public.buckets;

create policy "buckets_delete_admin_or_child_own"
  on public.buckets
  for delete
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or (
        public.auth_role() = 'child'
        and owner_member_id = public.auth_member_id()
      )
    )
  );
