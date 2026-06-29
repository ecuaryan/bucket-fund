-- Rename the user-facing feature "Auto-organize" → "Auto-bucket".
-- Only the History note label changes; schema, RPCs, and columns keep
-- `auto_organize*`. The "organize" kind now reads "Auto-bucket · <rule>".
-- Legacy notes already stored as "Auto-organize · <rule>" are left as-is and
-- are still recognized by the frontend (historyTransactionNote.ts).

create or replace function public.auto_organize_history_note(
  p_kind text,
  p_name text,
  p_auto_organize_type text,
  p_start_date date,
  p_interval_count int,
  p_interval_unit text,
  p_days_of_month int[]
)
returns text
language sql
immutable
as $$
  select
    case coalesce(p_kind, 'organize')
      when 'top_up' then 'Auto top-up'
      when 'save_off' then 'Auto save-off'
      else 'Auto-bucket'
    end
    || ' · '
    || public.auto_organize_display_name(
      p_name,
      p_auto_organize_type,
      p_start_date,
      p_interval_count,
      p_interval_unit,
      p_days_of_month
    );
$$;

alter function public.auto_organize_history_note(text, text, text, date, int, text, int[])
  set search_path = public;

revoke all on function public.auto_organize_history_note(text, text, text, date, int, text, int[])
  from public;
