-- TaskLink authenticated writes and row-level security.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.users add column if not exists bio text;
alter table public.job add column if not exists deadline date;
alter table public.job add column if not exists contact_preference text;
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role = any (array['seeker'::text, 'provider'::text, 'both'::text, 'admin'::text]));

create table if not exists public.message (
  message_id bigint generated always as identity primary key,
  application_id integer not null references public.application(application_id) on delete cascade,
  sender_user_id integer not null references public.users(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.category enable row level security;
alter table public.location enable row level security;
alter table public.users enable row level security;
alter table public.job enable row level security;
alter table public.application enable row level security;
alter table public.payment enable row level security;
alter table public.review enable row level security;
alter table public.message enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant select on public.category, public.location, public.job, public.review to anon, authenticated;
grant select on public.users, public.job, public.application, public.review, public.message to authenticated;
grant insert (job_id, provider_id, proposed_price_pula, message) on public.application to authenticated;
grant insert (title, description, seeker_id, category_id, location_id, price_pula, job_type, deadline, contact_preference)
  on public.job to authenticated;
grant update (title, description, category_id, location_id, price_pula, job_type, deadline, contact_preference)
  on public.job to authenticated;
grant update (full_name, phone, skills, qualifications, bio, location_id) on public.users to authenticated;
grant insert (application_id, reviewer_id, reviewee_id, rating, comment) on public.review to authenticated;
grant insert (application_id, sender_user_id, body) on public.message to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Anyone can read categories" on public.category;
create policy category_public_read on public.category for select to anon, authenticated using (true);
drop policy if exists "Anyone can read locations" on public.location;
create policy location_public_read on public.location for select to anon, authenticated using (true);

create or replace function private.current_user_id()
returns integer language sql stable security definer set search_path = ''
as $$
  select u.user_id from public.users as u
  where u.auth_id = (select auth.uid()) limit 1
$$;

create or replace function private.is_job_participant(p_job_id integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.job j
    where j.job_id = p_job_id and j.seeker_id = private.current_user_id()
  ) or exists (
    select 1 from public.application a
    where a.job_id = p_job_id and a.provider_id = private.current_user_id() and a.status = 'accepted'
  )
$$;

create or replace function private.is_application_participant(p_application_id integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.application a join public.job j on j.job_id = a.job_id
    where a.application_id = p_application_id
      and (a.provider_id = private.current_user_id() or j.seeker_id = private.current_user_id())
  )
$$;

create or replace function private.can_review_application(
  p_application_id integer, p_reviewer_id integer, p_reviewee_id integer
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.application a join public.job j on j.job_id = a.job_id
    where a.application_id = p_application_id and a.status = 'accepted' and j.status = 'completed'
      and p_reviewer_id = private.current_user_id()
      and ((p_reviewer_id = j.seeker_id and p_reviewee_id = a.provider_id)
        or (p_reviewer_id = a.provider_id and p_reviewee_id = j.seeker_id))
  )
$$;

revoke all on function private.current_user_id() from public, anon;
revoke all on function private.is_job_participant(integer) from public, anon;
revoke all on function private.is_application_participant(integer) from public, anon;
revoke all on function private.can_review_application(integer, integer, integer) from public, anon;
grant execute on function private.current_user_id() to authenticated;
grant execute on function private.is_job_participant(integer) to authenticated;
grant execute on function private.is_application_participant(integer) to authenticated;
grant execute on function private.can_review_application(integer, integer, integer) to authenticated;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select to authenticated
  using (auth_id = (select auth.uid()));
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (auth_id = (select auth.uid())) with check (auth_id = (select auth.uid()));

create or replace function public.ensure_tasklink_profile(
  p_full_name text, p_role text default 'both', p_phone text default null
)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_auth_id uuid := (select auth.uid());
  v_email text;
  v_confirmed_at timestamptz;
  v_user_id integer;
  v_existing_auth_id uuid;
begin
  if v_auth_id is null then raise exception 'Sign in before creating a profile'; end if;
  if coalesce(length(trim(p_full_name)), 0) not between 1 and 120 then
    raise exception 'Enter a name between 1 and 120 characters';
  end if;
  if p_role not in ('seeker', 'provider', 'both') then raise exception 'Invalid account type'; end if;

  select au.email, au.email_confirmed_at into v_email, v_confirmed_at
  from auth.users au where au.id = v_auth_id;
  if v_email is null or v_confirmed_at is null then
    raise exception 'Confirm your email before finishing profile setup';
  end if;

  select u.user_id into v_user_id from public.users u where u.auth_id = v_auth_id;
  if v_user_id is not null then
    update public.users set full_name = trim(p_full_name), phone = nullif(trim(p_phone), '')
    where user_id = v_user_id;
    return v_user_id;
  end if;

  select u.user_id, u.auth_id into v_user_id, v_existing_auth_id
  from public.users u where lower(u.email) = lower(v_email) for update;
  if v_user_id is not null then
    if v_existing_auth_id is not null and v_existing_auth_id <> v_auth_id then
      raise exception 'This profile is already linked to another sign-in';
    end if;
    update public.users set auth_id = v_auth_id, full_name = trim(p_full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone)
    where user_id = v_user_id;
    return v_user_id;
  end if;

  insert into public.users (auth_id, full_name, email, phone, role)
  values (v_auth_id, trim(p_full_name), v_email, nullif(trim(p_phone), ''), p_role)
  returning user_id into v_user_id;
  return v_user_id;
end;
$$;
revoke all on function public.ensure_tasklink_profile(text, text, text) from public, anon;
grant execute on function public.ensure_tasklink_profile(text, text, text) to authenticated;

drop policy if exists "Anyone can read open jobs" on public.job;
create policy job_read_open_or_participant on public.job for select to anon, authenticated
  using (status = 'open' or (auth.uid() is not null and private.is_job_participant(job_id)));
drop policy if exists job_insert_owner on public.job;
create policy job_insert_owner on public.job for insert to authenticated
  with check (seeker_id = private.current_user_id());
drop policy if exists job_update_owner on public.job;
create policy job_update_owner on public.job for update to authenticated
  using (seeker_id = private.current_user_id()) with check (seeker_id = private.current_user_id());

drop policy if exists application_read_participants on public.application;
create policy application_read_participants on public.application for select to authenticated
  using (private.is_application_participant(application_id));
drop policy if exists application_insert_provider on public.application;
create policy application_insert_provider on public.application for insert to authenticated
  with check (
    provider_id = private.current_user_id()
    and exists (select 1 from public.job j where j.job_id = application.job_id
      and j.status = 'open' and j.seeker_id <> private.current_user_id())
  );

create or replace function public.respond_to_task_application(p_application_id integer, p_action text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id integer := private.current_user_id();
  v_job_id integer;
  v_owner_id integer;
  v_provider_id integer;
  v_app_status text;
  v_job_status text;
begin
  if v_user_id is null then raise exception 'Sign in first'; end if;
  select a.job_id, j.seeker_id, a.provider_id, a.status, j.status
    into v_job_id, v_owner_id, v_provider_id, v_app_status, v_job_status
  from public.application a join public.job j on j.job_id = a.job_id
  where a.application_id = p_application_id for update of a, j;
  if v_job_id is null then raise exception 'Application not found'; end if;
  if v_app_status <> 'pending' then raise exception 'This application has already been handled'; end if;

  if p_action = 'withdraw' and v_user_id = v_provider_id then
    update public.application set status = 'withdrawn' where application_id = p_application_id;
  elsif p_action in ('accept', 'reject') and v_user_id = v_owner_id then
    if p_action = 'accept' then
      if v_job_status <> 'open' then raise exception 'This task is no longer open'; end if;
      update public.application set status = 'rejected'
        where job_id = v_job_id and application_id <> p_application_id and status = 'pending';
      update public.application set status = 'accepted' where application_id = p_application_id;
      update public.job set status = 'in_progress' where job_id = v_job_id;
    else
      update public.application set status = 'rejected' where application_id = p_application_id;
    end if;
  else
    raise exception 'You cannot perform that action on this application';
  end if;
  return p_action;
end;
$$;
revoke all on function public.respond_to_task_application(integer, text) from public, anon;
grant execute on function public.respond_to_task_application(integer, text) to authenticated;

create or replace function public.set_task_status(p_job_id integer, p_status text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id integer := private.current_user_id();
  v_current text;
begin
  select status into v_current from public.job
  where job_id = p_job_id and seeker_id = v_user_id for update;
  if v_current is null then raise exception 'Task not found or not yours'; end if;
  if (p_status = 'cancelled' and v_current = 'open')
     or (p_status = 'completed' and v_current = 'in_progress'
         and exists (select 1 from public.application where job_id = p_job_id and status = 'accepted')) then
    update public.job set status = p_status where job_id = p_job_id;
    return p_status;
  end if;
  raise exception 'That task status change is not allowed';
end;
$$;
revoke all on function public.set_task_status(integer, text) from public, anon;
grant execute on function public.set_task_status(integer, text) to authenticated;

drop policy if exists review_public_read on public.review;
create policy review_public_read on public.review for select to anon, authenticated using (true);
drop policy if exists review_insert_completed_participant on public.review;
create policy review_insert_completed_participant on public.review for insert to authenticated
  with check (private.can_review_application(application_id, reviewer_id, reviewee_id));

drop policy if exists message_read_participants on public.message;
create policy message_read_participants on public.message for select to authenticated
  using (private.is_application_participant(application_id));
drop policy if exists message_insert_participant on public.message;
create policy message_insert_participant on public.message for insert to authenticated
  with check (sender_user_id = private.current_user_id()
    and private.is_application_participant(application_id));
drop policy if exists message_update_recipient_read_at on public.message;
create policy message_update_recipient_read_at on public.message for update to authenticated
  using (sender_user_id <> private.current_user_id() and private.is_application_participant(application_id))
  with check (sender_user_id <> private.current_user_id() and private.is_application_participant(application_id));
grant update (read_at) on public.message to authenticated;

create or replace function public.tasklink_my_conversations()
returns table (
  application_id integer, job_id integer, job_title text, other_user_id integer,
  other_name text, application_status text, last_message text, last_message_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select a.application_id, j.job_id, j.title,
    case when a.provider_id = private.current_user_id() then j.seeker_id else a.provider_id end,
    peer.full_name, a.status, latest.body, latest.sent_at
  from public.application a
  join public.job j on j.job_id = a.job_id
  join public.users peer on peer.user_id = case
    when a.provider_id = private.current_user_id() then j.seeker_id else a.provider_id end
  left join lateral (
    select m.body, m.sent_at from public.message m
    where m.application_id = a.application_id order by m.sent_at desc limit 1
  ) latest on true
  where private.is_application_participant(a.application_id)
  order by coalesce(latest.sent_at, a.applied_at) desc
$$;
revoke all on function public.tasklink_my_conversations() from public, anon;
grant execute on function public.tasklink_my_conversations() to authenticated;

create or replace function public.tasklink_mark_messages_read(p_application_id integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if not private.is_application_participant(p_application_id) then
    raise exception 'Conversation not found';
  end if;
  update public.message set read_at = now()
  where application_id = p_application_id
    and sender_user_id <> private.current_user_id() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.tasklink_mark_messages_read(integer) from public, anon;
grant execute on function public.tasklink_mark_messages_read(integer) to authenticated;

-- Browser roles intentionally get no access to payment records. A payment
-- provider webhook/Edge Function must be integrated before payments are enabled.