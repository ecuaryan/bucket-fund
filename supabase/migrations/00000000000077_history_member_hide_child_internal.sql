-- Fix: a shared member could see a kid's bucket moves once the kid's bucket was
-- deleted.
--
-- transactions.from_bucket_id / to_bucket_id are ON DELETE SET NULL (so History
-- keeps the snapshotted bucket NAME after a bucket is gone). The admin History
-- branch hides kid-internal moves via bucket_move_is_child_internal(), which keys
-- on from_member_id (still the kid) — so it stays correct after a delete. The
-- MEMBER branch classified "kid move" only by bucket ownership; once both bucket
-- FKs were nulled by the delete, that signal vanished and the move leaked to the
-- shared member (auto-organize runs, set-asides, the delete's own reclaim move).
--
-- Give the member branch the SAME from_member_id-based exclusion the admin branch
-- uses, so admin and member see the same history and kid-internal moves stay
-- internal to the kid even after their bucket is deleted. Admin and child
-- branches are unchanged; the existing member adult-visible checks are kept so
-- pre-existing behavior (e.g. an adult-initiated move into a kid bucket stays
-- admin-only) is preserved.

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
             t.type = 'give'
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
             t.type = 'give'
             or (
               t.type = 'bucket_move'
               and not public.bucket_move_is_child_internal(
                 t.from_member_id,
                 t.from_bucket_id,
                 t.to_bucket_id
               )
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
