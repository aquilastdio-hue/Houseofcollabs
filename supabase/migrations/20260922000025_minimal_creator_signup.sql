-- =============================================================================
-- House of Collabs · 0025 · shorten what a creator must do before review
-- =============================================================================
-- Signing up meant a seven-step wizard ending in a full priced service before
-- anything could be submitted. That is a commercial decision, not an identity
-- one, and creators were abandoning the flow partway (every account currently
-- stuck in draft/pending_review on this project stalled before finishing).
--
-- The required set is now only what a reviewer needs to decide whether this is
-- a real creator worth approving:
--
--   photo · bio · city · languages · categories · creator type · a social account
--
-- Two moves, no new columns and no new tables:
--
--   services  required → recommended   priced packages are a campaign concern;
--                                      creators add one from the dashboard once
--                                      they are approved. They can still take
--                                      briefs in the meantime.
--   social    recommended → required   a handle is how a reviewer verifies a
--                                      creator is real, and `creator_type`
--                                      (nano/micro/influencer) is defined by
--                                      follower count, which comes from it.
--
-- Safe for existing accounts: nothing here changes a row. All 32 published
-- creators already have a social account, and `publish_creator_profile` returns
-- early for anyone already published or pending, so no one is un-published.
-- =============================================================================

create or replace function public.get_creator_completion(p_creator_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_creator_id, private.my_creator_id());
  v_c public.creators;
  v_items jsonb;
  v_done int;
  v_total int;
begin
  select * into v_c from public.creators where id = v_id;
  if not found then
    return jsonb_build_object('percent', 0, 'items', '[]'::jsonb, 'can_publish', false);
  end if;
  if v_c.profile_id <> auth.uid() and not private.is_admin() then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;

  v_items := jsonb_build_array(
    -- ---- required: enough to identify and review the creator ----------------
    jsonb_build_object('key', 'photo', 'label', 'Profile photo', 'required', true, 'done', v_c.profile_image_url is not null),
    jsonb_build_object('key', 'bio', 'label', 'Bio (40+ characters)', 'required', true, 'done', char_length(coalesce(v_c.bio, '')) >= 40),
    jsonb_build_object('key', 'location', 'label', 'City', 'required', true, 'done', v_c.city is not null),
    jsonb_build_object('key', 'languages', 'label', 'Languages you create in', 'required', true,
      'done', exists (select 1 from public.creator_languages l where l.creator_id = v_id)),
    jsonb_build_object('key', 'categories', 'label', 'At least one category', 'required', true,
      'done', exists (select 1 from public.creator_categories cc where cc.creator_id = v_id)),
    jsonb_build_object('key', 'creator_type', 'label', 'Creator type', 'required', true, 'done', v_c.creator_type is not null),
    jsonb_build_object('key', 'social', 'label', 'A social account', 'required', true,
      'done', exists (select 1 from public.creator_social_accounts s where s.creator_id = v_id)),

    -- ---- recommended: added from the dashboard after approval ---------------
    jsonb_build_object('key', 'services', 'label', 'Your first service', 'required', false,
      'done', exists (select 1 from public.creator_services s where s.creator_id = v_id and s.active and s.archived_at is null)),
    jsonb_build_object('key', 'portfolio', 'label', '3+ portfolio pieces', 'required', false,
      'done', (select count(*) from public.portfolio_items p where p.creator_id = v_id and not p.is_hidden) >= 3),
    jsonb_build_object('key', 'demographics', 'label', 'Gender and age', 'required', false, 'done', v_c.gender is not null and v_c.age is not null),
    jsonb_build_object('key', 'addons', 'label', 'An add-on', 'required', false,
      'done', exists (select 1 from public.service_addons a join public.creator_services s on s.id = a.service_id
                      where s.creator_id = v_id and a.active)),
    jsonb_build_object('key', 'cover', 'label', 'Cover image', 'required', false, 'done', v_c.cover_image_url is not null)
  );

  select count(*) filter (where (x ->> 'done')::boolean), count(*)
  into v_done, v_total
  from jsonb_array_elements(v_items) x;

  return jsonb_build_object(
    'percent', round(v_done * 100.0 / v_total)::int,
    'items', v_items,
    'can_publish', not exists (
      select 1 from jsonb_array_elements(v_items) x
      where (x ->> 'required')::boolean and not (x ->> 'done')::boolean
    ),
    'status', v_c.status
  );
end;
$$;

comment on function public.get_creator_completion(uuid) is
  'Profile checklist. Required items gate submission for review; recommended items are progressive and prompted from the creator dashboard.';
