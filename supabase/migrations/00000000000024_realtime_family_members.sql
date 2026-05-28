-- Household roster changes (add/remove child) must update Send tab visibility
-- and the send screen recipient list without a full reload.

alter publication supabase_realtime add table public.family_members;

alter table public.family_members replica identity full;
