drop policy if exists job_read_open_or_participant on public.job;
drop policy if exists job_read_open_anon on public.job;
drop policy if exists job_read_open_authenticated on public.job;
create policy job_read_open_anon on public.job for select to anon using (status = 'open');
create policy job_read_open_authenticated on public.job for select to authenticated
  using (status = 'open' or private.is_job_participant(job_id));
