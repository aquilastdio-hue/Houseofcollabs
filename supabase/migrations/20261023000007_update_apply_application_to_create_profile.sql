-- Update apply_application to create profile if it doesn't exist
--
-- Since we removed automatic profile creation on signup, the provisioning
-- function needs to create the profile when approving an application for a
-- user who signed in but has no profile yet.

begin;

create or replace function private.apply_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_actor_role public.actor_role default 'system'
)
returns public.applications
language plpgsql security definer
set search_path to ''
as $$
declare
  v_app public.applications;
  v_creator_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
  v_name text;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  -- If profile doesn't exist, create it first
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    v_name := nullif(btrim(coalesce(
      v_app.profile ->> 'full_name',
      v_app.profile ->> 'contact_person',
      ''
    )), '');

    insert into public.profiles (id, role, full_name, email, avatar_url, status)
    values (
      p_profile_id,
      v_app.role::public.user_role,
      left(v_name, 120),
      v_app.email,
      nullif(coalesce(v_app.profile ->> 'logo_path', ''), ''),
      'active'
    );

    perform private.audit(
      'profile_created', 'profile', p_profile_id::text,
      jsonb_build_object('role', v_app.role, 'via', 'application_approval'),
      p_profile_id,
      p_actor_role
    );
  end if;

  -- Role + onboarded, so `homeFor` sends them to their dashboard and
  -- `RequireRole` lets them in.
  update public.profiles
  set role = v_app.role::public.user_role,
      onboarding_completed = true,
      full_name = coalesce(nullif(btrim(full_name), ''), v_app.full_name),
      phone = coalesce(phone, v_app.phone)
  where id = p_profile_id;

  if v_app.role = 'creator' then
    insert into public.creators (profile_id, display_name, bio, city, followers_count)
    values (p_profile_id, left(v_app.full_name, 80), v_app.bio, v_app.city, coalesce(v_app.followers_count, 0))
    on conflict (profile_id) do update
      set bio = coalesce(public.creators.bio, excluded.bio),
          city = coalesce(public.creators.city, excluded.city)
    returning id into v_creator_id;

    if v_app.social_platform is not null and v_app.social_handle is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, followers_count)
      values (v_creator_id, v_app.social_platform::public.social_platform, v_app.social_handle, coalesce(v_app.followers_count, 0))
      on conflict do nothing;
    end if;

    -- Categories arrive as names; match them to the catalogue and make the
    -- first one primary. Anything we do not recognise is skipped silently.
    foreach v_cat in array coalesce(v_app.categories, '{}'::text[]) loop
      select id into v_cat_id from public.categories where lower(name) = lower(btrim(v_cat)) limit 1;
      if v_cat_id is not null then
        insert into public.creator_categories (creator_id, category_id, is_primary)
        values (v_creator_id, v_cat_id, v_first)
        on conflict do nothing;
        v_first := false;
      end if;
    end loop;

  else
    insert into public.brands (profile_id, brand_name, website_url, location, description, contact_email, contact_phone)
    values (
      p_profile_id,
      left(coalesce(nullif(btrim(v_app.brand_name), ''), v_app.full_name), 80),
      v_app.website, v_app.city, v_app.looking_for, v_app.email, v_app.phone
    )
    on conflict (profile_id) do nothing;
  end if;

  update public.applications
  set status = 'approved',
      profile_id = p_profile_id,
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id
  returning * into v_app;

  perform private.notify(
    p_profile_id,
    'application_approved',
    'You''re in',
    format('Welcome to House of Collabs. Your %s account is ready.', v_app.role),
    'profile', p_profile_id,
    case v_app.role when 'brand' then '/brand' else '/creator' end
  );

  perform private.audit('application_account_provisioned', 'application', v_app.id::text,
    jsonb_build_object('role', v_app.role, 'profile_id', p_profile_id, 'via', p_actor_role),
    coalesce(auth.uid(), p_profile_id), p_actor_role);

  return v_app;
end;
$$;

comment on function private.apply_application(uuid, uuid, public.actor_role) is
  'Seeds role, onboarding flag and workspace from an application. Creates profile if it does not exist. Callers own the permission check.';

-- Also update claim_approved_application to ensure profile exists before calling apply_application
create or replace function private.claim_approved_application()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_app_id uuid;
  v_name text;
begin
  if new.email is null then return new; end if;
  if not coalesce(private.has_verified_identity(new.id), false) then return new; end if;

  select a.id into v_app_id
  from public.applications a
  where a.status = 'approved'
    and a.profile_id is null
    and lower(btrim(a.email)) = lower(btrim(new.email))
    order by a.reviewed_at desc nulls last, a.created_at desc
    limit 1;

  if v_app_id is not null then
    -- Create profile if it doesn't exist (for OAuth sign-ins where handle_new_user didn't create one)
    if not exists (select 1 from public.profiles where id = new.id) then
      select full_name into v_name from public.applications where id = v_app_id;
      insert into public.profiles (id, role, full_name, email, avatar_url, status)
      values (
        new.id,
        'brand', -- default, will be overwritten by apply_application
        left(coalesce(v_name, ''), 120),
        new.email,
        nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), ''),
        'active'
      );
    end if;
    perform private.apply_application(v_app_id, new.id, 'system');
  end if;
  return new;
end;
$$;

commit;
