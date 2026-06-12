-- Auto-organize: publish to Realtime so the Buckets tab stays in sync when
-- organizes, lines, or runs change (including bucket-delete cleanup).

alter publication supabase_realtime add table public.auto_organizes;
alter publication supabase_realtime add table public.auto_organize_lines;
alter publication supabase_realtime add table public.auto_organize_runs;

alter table public.auto_organizes replica identity full;
alter table public.auto_organize_lines replica identity full;
alter table public.auto_organize_runs replica identity full;
