-- =============================================================================
-- House of Collabs · 0032 · turn an approved application into a usable account
-- =============================================================================
-- Until now approving an application only set a status column. The applicant
-- still had no account, so logging in with the email they gave failed — and
-- with /signup gone there was no way for them to make one.
--
-- Creating the auth user needs the service role, so that half lives in the
-- `approve-application` Edge Function. This is the other half: once the user
-- exists, set their role, mark them onboarded so the dashboard guard lets them
-- through, and carry across what they already told us so they don't retype it.
--
-- Split that way on purpose — everything that touches application data stays in
-- SQL under `require_admin`, and the function only does what needs a key.
-- =============================================================================

alter table public.applications
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists invited_at timestamptz;

create index if not exists applications_profile_idx on public.applications (profile_id);

comment on column public.applications.profile_id is
  'The account created for this applicant when they were approved.';

-- -----------------------------------------------------------------------------
-- Provision: role, workspace row, and the details they already gave us.
-- -----------------------------------------------------------------------------
create or replace function public.provision_application_account(
  p_application_id uuid,
  p_profile_id uuid
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.applications;
  v_creator_id uuid;
  v_brand_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
begin
  perform private.require_admin();

  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002', hint = 'PROFILE_NOT_FOUND';
  end if;

  -- Role + onboarded, so `homeFor` sends them to their dashboard and
  -- `RequireRole` lets them in. Only ever brand or creator — never admin.
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
    -- first one primary. Anything we don't recognise is skipped silently.
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
    on conflict (profile_id) do nothing
    returning id into v_brand_id;
  end if;

  update public.applications
  set status = 'approved',
      profile_id = p_profile_id,
      reviewed_by = auth.uid(),
      reviewed_at = now()
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
    jsonb_build_object('role', v_app.role, 'profile_id', p_profile_id), auth.uid(), 'admin');

  return v_app;
end;
$$;

comment on function public.provision_application_account(uuid, uuid) is
  'Admin-only: links an approved application to a freshly created account and seeds their workspace.';

revoke execute on function public.provision_application_account(uuid, uuid) from public, anon;
grant execute on function public.provision_application_account(uuid, uuid) to authenticated;

-- Records that the invite email went out, so the admin UI can say so.
create or replace function public.mark_application_invited(p_application_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.applications set invited_at = now() where id = p_application_id;
end;
$$;

revoke execute on function public.mark_application_invited(uuid) from public, anon;
grant execute on function public.mark_application_invited(uuid) to authenticated;
