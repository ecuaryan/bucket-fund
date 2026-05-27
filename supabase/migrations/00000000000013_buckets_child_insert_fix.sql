-- Ensure insert/delete policies allow children to manage own buckets even if
-- migration 12 was applied with an earlier admin-only draft.

drop policy if exists "buckets_insert_own_or_admin" on public.buckets;
drop policy if exists "buckets_insert_admin_only" on public.buckets;
drop policy if exists "buckets_insert_admin_or_child_own" on public.buckets;

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
drop policy if exists "buckets_delete_admin_or_child_own" on public.buckets;

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
