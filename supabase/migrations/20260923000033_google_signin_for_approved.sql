-- =============================================================================
-- House of Collabs · 0033 · approved applicants sign in with Google
-- =============================================================================
-- Approval used to create an email/password auth user and mail out a
-- "set your password" link. What's actually wanted is no new password at all:
-- the applicant signs in with the Google account behind the email they put on
-- the form, and lands in their dashboard.
--
-- That means provisioning can no longer happen only when an admin clicks
-- approve — the account may not exist yet at that point. So the work is split:
--
--   private.apply_application()             the provisioning itself, no check
--   public.provision_application_account()  admin-initiated (account exists)
--   private.claim_approved_application()    trigger — a new account appears
--
-- The trigger is what makes "approve now, they sign in later" work, and it
-- removes any dependency on GoTrue linking a Google identity onto a pre-created
-- user.
--
-- SECURITY — the trigger hands out a role based on an email address, so it only
-- fires for accounts created by an OAuth provider, where the provider verified
-- the address. Email/password signups never auto-claim an approved application,
-- which matters because this project has autoconfirm on: without that guard
-- anyone who guessed an approved applicant's email could POST to
-- /auth/v1/signup and inherit their workspace. Only ever brand or creator — an
-- application cannot carry 'admin', and provisioning never sets it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The provisioning itself. Lives in `private` (not reachable over PostgREST),
-- so the callers below own the permission question.
-- -----------------------------------------------------------------------------
create or replace function private.apply_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_actor_role public.actor_role default 'system'
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.applications;
  v_creator_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002', hint = 'PROFILE_NOT_FOUND';
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
  'Seeds role, onboarding flag and workspace from an application. Callers own the permission check.';

-- -----------------------------------------------------------------------------
-- Admin-initiated: the account already exists — they signed in before being
-- approved, or an admin asked for a password link.
-- -----------------------------------------------------------------------------
create or replace function public.provision_application_account(
  p_application_id uuid,
  p_profile_id uuid
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return private.apply_application(p_application_id, p_profile_id, 'admin');
end;
$$;

revoke execute on function public.provision_application_account(uuid, uuid) from public, anon;
grant execute on function public.provision_application_account(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Sign-in-initiated: an approved applicant just made their account by clicking
-- "Continue with Google". Match on the email they applied with.
-- -----------------------------------------------------------------------------
create or replace function private.claim_approved_application()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_provider text;
  v_app_id uuid;
begin
  if new.email is null then return new; end if;

  -- Only an identity provider that verified the address may claim a role this
  -- way. 'email' (password / magic-link signup) deliberately cannot.
  select u.raw_app_meta_data ->> 'provider' into v_provider
  from auth.users u where u.id = new.id;
  if coalesce(v_provider, 'email') in ('email', '') then return new; end if;

  select a.id into v_app_id
  from public.applications a
  where a.status = 'approved'
    and a.profile_id is null
    and lower(btrim(a.email)) = lower(btrim(new.email))
  order by a.reviewed_at desc nulls last, a.created_at desc
  limit 1;

  if v_app_id is not null then
    perform private.apply_application(v_app_id, new.id, 'system');
  end if;
  return new;
end;
$$;

comment on function private.claim_approved_application() is
  'On a new OAuth account, grants the role from a matching approved application.';

drop trigger if exists on_profile_claim_application on public.profiles;
create trigger on_profile_claim_application
  after insert on public.profiles
  for each row execute function private.claim_approved_application();
