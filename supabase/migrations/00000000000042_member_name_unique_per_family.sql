-- Household member display names must be unique within one family (PIN picker,
-- Send, admin roster). Case-insensitive; leading/trailing spaces ignored.

create unique index family_members_family_name_key
  on public.family_members (family_id, lower(btrim(name)));
