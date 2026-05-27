-- =====================================================================
-- BucketFund: REPLICA IDENTITY FULL for Realtime under RLS
-- =====================================================================
--
-- Realtime under RLS on UPDATE events is unreliable when the table's
-- replica identity is `default` (the Postgres default — only the
-- primary key is sent in the OLD record). The Realtime server needs
-- enough of the OLD row to re-evaluate the SELECT policy on behalf
-- of the subscriber, otherwise events can be silently dropped.
--
-- Setting `replica identity full` ships every column in the OLD
-- record so RLS evaluation has what it needs. The cost is a slightly
-- larger WAL footprint, which is fine for low-volume tables like
-- ours.
-- =====================================================================

alter table public.buckets       replica identity full;
alter table public.accounts      replica identity full;
alter table public.transactions  replica identity full;
