-- 0072 · Prevent role assignment without approved application
--
-- People were able to sign up directly (Google/email) and get a creator/brand
-- role without going through the application approval process. This bypassed
-- your review system and meant rejected applicants could still have active
-- accounts with roles.
--
-- The `handle_new_user` trigger now checks for an approved application before
-- assigning a role. Only accounts created through the application approval flow
-- (admin inviting them) will get a role. Direct sign-ups get role=NULL until
-- they're approved.

begin;

drop function if exists private.handle_new_user cascade;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
  v_requested text := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  v_role public.user_role;
  v_name text;
  v_has_approved boolean;
begin
  -- Whitelist the requested role from metadata
  if v_requested in ('brand', 'creator') then
    v_role := v_requested::public.user_role;
  end if;

  -- Only assign the role if there's an approved application for this email
  -- and the requested role matches. This prevents direct sign-ups from
  -- bypassing the application review process.
  select exists (
    select 1 from public.applications a
    where a.status = 'approved'
      and lower(a.email) = lower(new.email)
      and a.role::text = v_role::text
  ) into v_has_approved;

  if not v_has_approved then
    v_role := null;
  end if;

  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  insert into public.profiles (id, role, full_name, email, avatar_url)
  values (
    new.id,
    v_role,
    left(v_name, 120),
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), '')
  )
  on conflict (id) do nothing;

  perform private.audit(
    'profile_created', 'profile', new.id::text,
    jsonb_build_object('role', v_role, 'provider', new.raw_app_meta_data ->> 'provider', 'required_approval', v_has_approved),
    new.id,
    coalesce(v_role::text, 'system')::public.actor_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

commit;
