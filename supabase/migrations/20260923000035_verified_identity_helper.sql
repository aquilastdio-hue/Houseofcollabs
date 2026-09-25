-- =============================================================================
-- House of Collabs · 0035 · one rule for "this address is really theirs"
-- =============================================================================
-- 0034 gated `set_initial_role` on an approved application matching the
-- caller's email — but the caller's email is whatever they typed at
-- /auth/v1/signup, and this project has autoconfirm on, so `email_confirmed_at`
-- proves nothing. Anyone could sign up with an approved applicant's address and
-- then hand themselves that applicant's role.
--
-- `private.claim_approved_application` already had the right rule: trust the
-- address only when an identity provider vouched for it. Both places share it
-- now, so they can't drift apart again.
-- =============================================================================

create or replace function private.has_verified_identity(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- 'email' means the address was self-asserted at signup. Any other provider
  -- (google today) authenticated the address with its owner before telling us.
  select coalesce(u.raw_app_meta_data ->> 'provider', 'email') not in ('email', '')
  from auth.users u
  where u.id = p_user_id;
$$;

comment on function private.has_verified_identity(uuid) is
  'True when the account''s email was vouched for by an identity provider rather than typed at signup.';

-- -----------------------------------------------------------------------------
create or replace function private.claim_approved_application()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_app_id uuid;
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
    perform private.apply_application(v_app_id, new.id, 'system');
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
create or replace function public.set_initial_role(p_role public.user_role)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if p_role not in ('brand', 'creator') then
    raise exception 'Choose either a brand or a creator account.' using errcode = 'P0001', hint = 'INVALID_ROLE';
  end if;
  if not coalesce(private.has_verified_identity(auth.uid()), false) then
    raise exception 'We don''t have an approved application for this account yet.'
      using errcode = '42501', hint = 'NOT_APPROVED';
  end if;

  select email into v_email from public.profiles where id = auth.uid();
  if not exists (
    select 1 from public.applications a
    where a.status = 'approved'
      and lower(btrim(a.email)) = lower(btrim(coalesce(v_email, '')))
      and a.role = p_role::text
  ) then
    raise exception 'We don''t have an approved application for this account yet.'
      using errcode = '42501', hint = 'NOT_APPROVED';
  end if;

  update public.profiles set role = p_role
  where id = auth.uid() and role is null
  returning * into v_profile;
  if not found then
    raise exception 'Your account type is already set.' using errcode = 'P0001', hint = 'ROLE_ALREADY_SET';
  end if;

  perform private.audit('role_selected', 'profile', auth.uid()::text, jsonb_build_object('role', p_role), auth.uid(), p_role::text::public.actor_role);
  return v_profile;
end;
$$;

revoke execute on function public.set_initial_role(public.user_role) from public, anon;
grant execute on function public.set_initial_role(public.user_role) to authenticated;
