alter function public.ensure_tasklink_profile(text,text,text) set schema private;
alter function public.respond_to_task_application(integer,text) set schema private;
alter function public.set_task_status(integer,text) set schema private;
alter function public.tasklink_my_conversations() set schema private;
alter function public.tasklink_mark_messages_read(integer) set schema private;
revoke all on function private.ensure_tasklink_profile(text,text,text) from public,anon;
revoke all on function private.respond_to_task_application(integer,text) from public,anon;
revoke all on function private.set_task_status(integer,text) from public,anon;
revoke all on function private.tasklink_my_conversations() from public,anon;
revoke all on function private.tasklink_mark_messages_read(integer) from public,anon;
grant execute on function private.ensure_tasklink_profile(text,text,text) to authenticated;
grant execute on function private.respond_to_task_application(integer,text) to authenticated;
grant execute on function private.set_task_status(integer,text) to authenticated;
grant execute on function private.tasklink_my_conversations() to authenticated;
grant execute on function private.tasklink_mark_messages_read(integer) to authenticated;
create function public.ensure_tasklink_profile(p_full_name text,p_role text default 'both',p_phone text default null)
returns integer language sql security invoker set search_path='' as $$
select private.ensure_tasklink_profile(p_full_name,p_role,p_phone)
$$;
create function public.respond_to_task_application(p_application_id integer,p_action text)
returns text language sql security invoker set search_path='' as $$
select private.respond_to_task_application(p_application_id,p_action)
$$;
create function public.set_task_status(p_job_id integer,p_status text)
returns text language sql security invoker set search_path='' as $$
select private.set_task_status(p_job_id,p_status)
$$;
create function public.tasklink_my_conversations()
returns table(application_id integer,job_id integer,job_title text,other_user_id integer,other_name text,application_status text,last_message text,last_message_at timestamptz)
language sql stable security invoker set search_path='' as $$
select * from private.tasklink_my_conversations()
$$;
create function public.tasklink_mark_messages_read(p_application_id integer)
returns integer language sql security invoker set search_path='' as $$
select private.tasklink_mark_messages_read(p_application_id)
$$;
revoke all on function public.ensure_tasklink_profile(text,text,text) from public,anon;
revoke all on function public.respond_to_task_application(integer,text) from public,anon;
revoke all on function public.set_task_status(integer,text) from public,anon;
revoke all on function public.tasklink_my_conversations() from public,anon;
revoke all on function public.tasklink_mark_messages_read(integer) from public,anon;
grant execute on function public.ensure_tasklink_profile(text,text,text) to authenticated;
grant execute on function public.respond_to_task_application(integer,text) to authenticated;
grant execute on function public.set_task_status(integer,text) to authenticated;
grant execute on function public.tasklink_my_conversations() to authenticated;
grant execute on function public.tasklink_mark_messages_read(integer) to authenticated;
