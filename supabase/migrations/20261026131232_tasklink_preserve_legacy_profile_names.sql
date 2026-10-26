create or replace function private.ensure_tasklink_profile(
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
  v_full_name text := nullif(trim(p_full_name), '');
begin
  if v_auth_id is null then raise exception 'Sign in before creating a profile'; end if;
  if v_full_name is not null and length(v_full_name) not between 1 and 120 then
    raise exception 'Enter a name between 1 and 120 characters';
  end if;
  if p_role not in ('seeker', 'provider', 'both') then raise exception 'Invalid account type'; end if;

  select au.email, au.email_confirmed_at into v_email, v_confirmed_at
  from auth.users au where au.id = v_auth_id;
  if v_email is null or v_confirmed_at is null then
    raise exception 'Confirm your email before finishing profile setup';
  end if;
  if v_full_name is null then v_full_name := split_part(v_email, '@', 1); end if;

  select u.user_id into v_user_id from public.users u where u.auth_id = v_auth_id;
  if v_user_id is not null then
    update public.users set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone)
    where user_id = v_user_id;
    return v_user_id;
  end if;

  select u.user_id, u.auth_id into v_user_id, v_existing_auth_id
  from public.users u where lower(u.email) = lower(v_email) for update;
  if v_user_id is not null then
    if v_existing_auth_id is not null and v_existing_auth_id <> v_auth_id then
      raise exception 'This profile is already linked to another sign-in';
    end if;
    update public.users set auth_id = v_auth_id,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone)
    where user_id = v_user_id;
    return v_user_id;
  end if;

  insert into public.users (auth_id, full_name, email, phone, role)
  values (v_auth_id, v_full_name, v_email, nullif(trim(p_phone), ''), p_role)
  returning user_id into v_user_id;
  return v_user_id;
end
$$;
