-- member_bucket_order was subscribed on the client but never added to the
-- Realtime publication, which can prevent the whole channel from subscribing.

alter publication supabase_realtime add table public.member_bucket_order;

alter table public.member_bucket_order replica identity full;
