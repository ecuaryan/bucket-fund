-- Bucket names are short labels (not descriptions). Enforce at the DB so
-- direct inserts/updates cannot bypass the client limit.

alter table public.buckets
  add constraint buckets_name_length
  check (char_length(trim(name)) between 1 and 40);
