-- =============================================================================
-- House of Collabs · 0041 · the brand sign-up is three pages too
-- =============================================================================
-- The brand side of Get Started grew from one short form into three pages:
-- brand details, what they need from creators, and verification documents.
--
-- No structural change — `profile` is jsonb and absorbs the brand shape exactly
-- as it does the creator one. What changes is that the column now holds two
-- different shapes depending on `role`, so the comment has to say so; a comment
-- that describes only half its column is worse than none.
-- =============================================================================

comment on column public.applications.profile is
  'The rest of the sign-up, shaped by `role` — see the two layouts below. Copied into the creator/brand tables on approval.';

comment on column public.applications.image_path is
  'Creator: first portfolio photo. Brand: the brand logo. Both are object paths in the private applications bucket.';

-- =============================================================================
-- role = 'creator'  (pages 2-5)
-- -----------------------------------------------------------------------------
--  creator_name      text
--  instagram         { handle, url, followers }
--  youtube           { url, subscribers }
--  videos            text[]  object paths, up to 5
--  photos            text[]  object paths, up to 10
--  rates             { ugc_video, extra_usage, collab_reel, static_carousel,
--                      story, youtube_integration }  blank = not offered
--  barter_available  boolean
--  barter_stance     yes | selectively | no
--  open_to           text[]
--  confirmed         boolean  the authenticity declaration
--
-- role = 'brand'  (pages 1-3)
-- -----------------------------------------------------------------------------
--  website_or_handle    text     as given on page 1, site or handle
--  industry             text     one of the eight categories
--  contact_person       text     mirrored into full_name
--  designation          text
--  collaboration_types  text[]   UGC, Instagram Reel, Stories, …
--  creator_location     pan_india | specific
--  specific_cities      text[]
--  verification         { company_website, registration_doc_type,
--                         registration_doc_path, representative_id_path,
--                         linkedin_url, instagram_url, authorized }
--
-- Shared columns carry the rest: brand_name, website, budget_range, categories
-- (the creator categories a brand wants), looking_for (page 2, summarised for
-- the admin list), city, phone, email, full_name.
-- =============================================================================
