create or replace function private.current_user_role()
returns text language sql stable security definer set search_path=''
as $$
select u.role from public.users u where u.auth_id=(select auth.uid()) limit 1
$$;
revoke all on function private.current_user_role() from public,anon;
grant execute on function private.current_user_role() to authenticated;
drop policy if exists job_insert_owner on public.job;
create policy job_insert_owner on public.job for insert to authenticated
  with check (seeker_id=private.current_user_id() and private.current_user_role() in ('seeker','both'));
drop policy if exists application_insert_provider on public.application;
create policy application_insert_provider on public.application for insert to authenticated
  with check (
    provider_id=private.current_user_id()
    and private.current_user_role() in ('provider','both')
    and exists(select 1 from public.job j where j.job_id=application.job_id
      and j.status='open' and j.seeker_id<>private.current_user_id())
  );
drop policy if exists message_insert_participant on public.message;
create policy message_insert_participant on public.message for insert to authenticated
  with check (
    sender_user_id=private.current_user_id()
    and private.is_application_participant(application_id)
    and exists(select 1 from public.application a where a.application_id=message.application_id
      and a.status in ('pending','accepted'))
  );
