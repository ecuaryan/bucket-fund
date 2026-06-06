-- Bucket labels must be unique within one list: shared pool (owner null) or a kid's
-- own buckets. Case-insensitive; leading/trailing spaces ignored for comparison.

create unique index buckets_family_owner_name_key
  on public.buckets (family_id, owner_member_id, lower(btrim(name)))
  nulls not distinct;
