-- =====================================================================
-- Members could not see family-pool bucket moves in History because
-- transactions_select only matched buckets they personally own.
-- Adults (admin + member) should see all bucket_move rows where both
-- sides are family pool or adult-owned buckets (not children's).
-- =====================================================================

create or replace function public.bucket_visible_to_adults(p_bucket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.buckets b
     where b.id = p_bucket_id
       and b.family_id = public.auth_family_id()
       and (
         b.owner_member_id is null
         or exists (
           select 1
             from public.family_members fm
            where fm.id = b.owner_member_id
              and fm.role in ('admin', 'member')
         )
       )
  );
$$;

revoke all on function public.bucket_visible_to_adults(uuid) from public;
grant execute on function public.bucket_visible_to_adults(uuid) to authenticated;

drop policy if exists "transactions_select_participant_or_admin" on public.transactions;

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
          (
            type = 'send'
            and (
              from_member_id = public.auth_member_id()
              or to_member_id = public.auth_member_id()
            )
          )
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
