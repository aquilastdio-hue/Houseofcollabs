-- =============================================================================
-- House of Collabs · 0038 · the full creator profile application
-- =============================================================================
-- The creator side of Get Started grows from one short form into nine screens:
-- basics, socials, categories, portfolio, commercial services, preferences,
-- audience, profile media and a rate card.
--
-- Why a jsonb column rather than forty new ones. `applications` is an intake
-- queue: a human reads a row once, approves it, and provisioning copies it into
-- the real tables (creators, creator_services, portfolio_items, …) where the
-- typed columns and constraints already live. Forty nullable columns that are
-- read once and never queried would be dead weight on that queue, and every
-- tweak to the form would be another migration. The shape is documented below
-- and validated in the form.
--
-- What is NOT in jsonb: anything already modelled (name, email, phone, city,
-- categories, bio, the single portfolio video) keeps its own column, so the
-- admin list, the search and the rate limiter keep working unchanged.
--
-- SECURITY — anon inserts this column, so it is capped. Without a bound a
-- single request could push megabytes of JSON into the queue, and the insert
-- grant is what stands between the public and this table.
-- =============================================================================

alter table public.applications
  add column if not exists profile jsonb not null default '{}'::jsonb,
  add column if not exists image_path text check (char_length(image_path) <= 500);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_profile_size') then
    alter table public.applications
      add constraint applications_profile_size check (pg_column_size(profile) <= 32768);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_profile_object') then
    alter table public.applications
      add constraint applications_profile_object check (jsonb_typeof(profile) = 'object');
  end if;
end
$$;

comment on column public.applications.profile is
  'Screens 2 and 5-9 of the creator application. Copied into the creator tables on approval.';
comment on column public.applications.image_path is
  'Object path in the private applications bucket for the one portfolio photo.';

-- Screen 3 allows up to 10 categories, not 5.
alter table public.applications drop constraint if exists applications_categories_check;
alter table public.applications
  add constraint applications_categories_check
  check (coalesce(array_length(categories, 1), 0) <= 10);

-- -----------------------------------------------------------------------------
-- The two new columns need to be in the applicant's insert grant, which is an
-- explicit allow-list — a column missing from it is refused outright.
-- -----------------------------------------------------------------------------
grant insert (profile, image_path) on public.applications to anon, authenticated;

-- =============================================================================
-- Shape of `profile` (all keys optional; the form fills what it asks for)
-- =============================================================================
--  creator_name      text                      screen 1
--  date_of_birth     'YYYY-MM-DD'
--  gender            female|male|non_binary|prefer_not_to_say
--  state             text
--  languages         text[]
--  whatsapp          text
--  instagram         { handle, url, followers_bucket, avg_reel_views_bucket,
--                      engagement_rate }        screen 2
--  youtube           { url, subscribers, avg_views, format }
--  other_platforms   text[]  snapchat|facebook|linkedin|pinterest|x|other
--  portfolio         { video_content_type, video_title }   screen 4
--  brand_collabs     { worked_before, items: [{ brand, campaign_type, link }] }
--  services          { ugc_video|collab_reel|static_post|carousel|story|
--                      youtube_integration: { enabled, price, … } }  screen 5
--  barter            { stance, min_value, categories[] }
--  preferences       { delivery_speed, collaboration_types[],
--                      brands_yes[], brands_no[] }          screen 6
--  audience          { gender, age_brackets[], top_cities[], top_countries[] }
--                                                           screen 7
--  media             { cover_video_path, cover_choice }     screen 8
--  rate_card         { rates{}, usage_extension{}, whitelisting{}, exclusivity{} }
--                                                           screen 9
-- =============================================================================
