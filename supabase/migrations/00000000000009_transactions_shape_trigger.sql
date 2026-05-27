-- =====================================================================
-- BucketFund: replace transactions_shape CHECK with BEFORE INSERT trigger
-- =====================================================================
--
-- The original CHECK constraint required a bucket_move row to have
-- at least one non-null bucket id, and a send to have both member
-- ids. That's correct at insert time, but CHECK constraints also
-- fire on UPDATE — including the implicit UPDATEs that ON DELETE
-- SET NULL performs when a bucket is deleted. A "deposit" row
-- (from_bucket_id = NULL, to_bucket_id = X) violates the constraint
-- the moment bucket X is deleted, blocking the deletion with a
-- confusing error.
--
-- Fix: move the well-formedness check into a BEFORE INSERT trigger.
-- That keeps the protection where it matters (no malformed rows can
-- be inserted) while letting historical rows survive their buckets.
-- Both endpoints going NULL just means "both buckets in this old
-- move have since been deleted" — the amount, timestamp, and member
-- attribution are still there for audit.
-- =====================================================================

alter table public.transactions
  drop constraint if exists transactions_shape;

create or replace function public.transactions_validate_shape()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'bucket_move' then
    if new.from_bucket_id is null and new.to_bucket_id is null then
      raise exception 'bucket_move requires at least one of from_bucket_id or to_bucket_id'
        using errcode = '22023';
    end if;
  elsif new.type = 'send' then
    if new.from_member_id is null or new.to_member_id is null then
      raise exception 'send requires both from_member_id and to_member_id'
        using errcode = '22023';
    end if;
  else
    raise exception 'unknown transaction type: %', new.type
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_validate_shape_trg on public.transactions;
create trigger transactions_validate_shape_trg
before insert on public.transactions
for each row execute function public.transactions_validate_shape();
