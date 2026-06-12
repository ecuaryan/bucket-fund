-- pg_cron: hourly tick for due auto-organizes.

create extension if not exists pg_cron with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
    from cron.job
   where jobname = 'run-due-auto-organizes'
   limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'run-due-auto-organizes',
  '0 * * * *',
  $$ select public.run_due_auto_organizes(now()); $$
);
