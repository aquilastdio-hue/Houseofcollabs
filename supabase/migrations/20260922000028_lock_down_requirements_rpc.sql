-- =============================================================================
-- House of Collabs · 0028 · close two holes in get_creator_requirements
-- =============================================================================
-- Caught by the live check on 0027: an anonymous caller passing a real
-- `p_creator_id` got a 200 and the creator's setup back — service counts,
-- follower counts, verification status and whether a payout account exists.
-- Nothing identifying, but none of it is public either.
--
-- Two independent mistakes, both mine:
--
--   1. `revoke execute … from anon` does not remove the grant `anon` inherits
--      from PUBLIC, which Postgres gives every new function. Same trap as
--      migration 0023. It has to be revoked from PUBLIC.
--
--   2. The ownership guard read:
--
--        if v_c.profile_id <> auth.uid() and not private.is_admin()
--
--      With no session `auth.uid()` is NULL, so `profile_id <> NULL` is NULL —
--      not TRUE — and `NULL and false` is false. The guard never fired. Fixed
--      with `is distinct from`, plus an explicit sign-in check so the function
--      refuses anonymous callers outright.
-- =============================================================================

create or replace function public.get_creator_requirements(p_creator_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_creator_id, private.my_creator_id());
  v_c public.creators;
  v_v public.creator_verifications;
  v_pm public.payout_methods;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;

  select * into v_c from public.creators where id = v_id;
  if not found then
    return jsonb_build_object('creator_id', null);
  end if;
  -- `is distinct from` so a NULL on either side still counts as "not yours".
  if v_c.profile_id is distinct from auth.uid() and not private.is_admin() then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;

  select * into v_v from public.creator_verifications
  where creator_id = v_id order by submitted_at desc limit 1;

  select * into v_pm from public.payout_methods where creator_id = v_id limit 1;

  return jsonb_build_object(
    'creator_id', v_c.id,
    'status', v_c.status,
    'verified', v_c.verified,
    'available', v_c.available,
    'completion', public.get_creator_completion(v_id),
    'services', jsonb_build_object(
      'total',  (select count(*) from public.creator_services s where s.creator_id = v_id and s.archived_at is null),
      'active', (select count(*) from public.creator_services s where s.creator_id = v_id and s.active and s.archived_at is null)),
    'addons', jsonb_build_object(
      'active', (select count(*) from public.service_addons a join public.creator_services s on s.id = a.service_id
                 where s.creator_id = v_id and a.active)),
    'portfolio', jsonb_build_object(
      'visible', (select count(*) from public.portfolio_items p where p.creator_id = v_id and not p.is_hidden)),
    'payout', jsonb_build_object(
      'configured', v_pm.id is not null,
      'method_type', v_pm.method_type),
    'verification', case when v_v.id is null then jsonb_build_object('status', null)
      else jsonb_build_object(
        'id', v_v.id, 'status', v_v.status, 'submitted_at', v_v.submitted_at,
        'reviewed_at', v_v.reviewed_at, 'review_note', v_v.review_note) end,
    'analytics', jsonb_build_object(
      'accounts', (select count(*) from public.creator_social_accounts s where s.creator_id = v_id),
      'followers', v_c.followers_count,
      'engagement_rate', v_c.engagement_rate)
  );
end;
$$;

-- PUBLIC first — that is the grant `anon` was inheriting.
revoke execute on function public.get_creator_requirements(uuid) from public, anon;
grant execute on function public.get_creator_requirements(uuid) to authenticated;

revoke execute on function public.request_creator_verification(text, text, text, text, date, text, text, text, text, text) from public, anon;
grant execute on function public.request_creator_verification(text, text, text, text, date, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_review_creator_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_review_creator_verification(uuid, text, text) to authenticated;
