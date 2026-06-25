-- =====================================================================
-- BucketFund: order auto-organize History rows by execution time
-- =====================================================================
--
-- A scheduled cron tick (run_due_auto_organizes) writes every move it
-- makes inside a single database transaction. transactions.created_at
-- defaults to now(), which in Postgres is the transaction *start* time
-- and is therefore identical for every row in that tick. History sorts
-- "created_at DESC, id DESC", and id is a random gen_random_uuid(), so
-- rows from one tick come back in arbitrary order. That made the
-- two-pass save_off-before-top_up execution (migration 61) look
-- interleaved on the History page even though it ran correctly.
--
-- Fix: stamp auto-organize rows with clock_timestamp() instead. Unlike
-- now(), clock_timestamp() advances during a transaction, so each move
-- gets a distinct timestamp in the order it was applied. History then
-- orders these rows by real execution time: latest move first, with
-- all save_offs sorted below the top_ups that ran after them.
--
-- Scoped to auto_organize_run_id IS NOT NULL so manual single moves
-- (one row per transaction, where now() is already correct) keep the
-- transaction-start semantics other call sites rely on. Manual "Run
-- now" auto-organizes also set auto_organize_run_id and benefit too.
-- =====================================================================

create or replace function public.transactions_stamp_auto_organize_clock()
returns trigger
language plpgsql
as $$
begin
  if new.auto_organize_run_id is not null then
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_stamp_auto_organize_clock_trg on public.transactions;
create trigger transactions_stamp_auto_organize_clock_trg
before insert on public.transactions
for each row execute function public.transactions_stamp_auto_organize_clock();
