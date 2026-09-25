-- =============================================================================
-- House of Collabs · 0034 · a role comes from approval, never from self-service
-- =============================================================================
-- With sign-up gone and applications in its place, who gets into a dashboard is
-- the admin's decision. `set_initial_role` predates that: it let any signed-in
-- account with a null role pick "brand" or "creator" for itself. Since Google
-- sign-in is now the front door, anyone at all could sign in, pick a role, walk
-- through creator onboarding — which sets `onboarding_completed` — and be in a
-- dashboard without ever being approved. That made the approval gate cosmetic.
--
-- The role now has to be backed by an approved application for the caller's own
-- email. In practice `private.claim_approved_application` has already set it by
-- the time they land, so this mostly just refuses everyone else.
--
-- Still only brand or creator, never admin — unchanged, and the check below is
-- an extra condition on top, not a replacement for it.
--
-- NOTE: 0035 supersedes this definition — matching on the profile's email alone
-- is not enough when the address was typed at signup rather than vouched for.
-- =============================================================================
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

comment on function public.set_initial_role(public.user_role) is
  'Applies a role the caller was approved for. Approval is the only source of a role.';

revoke execute on function public.set_initial_role(public.user_role) from public, anon;
grant execute on function public.set_initial_role(public.user_role) to authenticated;
