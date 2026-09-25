-- =============================================================================
-- House of Collabs · 0040 · page 4 is rates, not yes/no plus a rate
-- =============================================================================
-- Each collaboration on the commercials page is now just a starting rate: the
-- figure itself is how a creator says they offer it, so there is no separate
-- availability flag that could drift out of step with the price. Barter is the
-- exception — it has no rate, so it keeps an explicit answer.
--
-- No structural change; `profile` is jsonb. This keeps the column comment
-- honest, because a comment that lies about its own column is worse than none.
-- =============================================================================

comment on column public.applications.profile is
  'Pages 2-5 of the creator sign-up: socials, portfolio, rates and consent. Copied into the creator tables on approval.';

-- =============================================================================
-- Shape of `profile` (all keys optional; the form fills what it asks for)
-- =============================================================================
--  creator_name      text                                       page 1
--  instagram         { handle, url, followers }                 page 2
--  youtube           { url, subscribers }
--  videos            text[]  object paths, up to 5              page 3
--  photos            text[]  object paths, up to 10
--  rates             { ugc_video, extra_usage, collab_reel,     page 4
--                      static_carousel, story, youtube_integration }
--                    each a rupee figure as text; blank = not offered
--  barter_available  boolean
--  barter_stance     yes | selectively | no
--  open_to           text[]                                     page 5
--  confirmed         boolean  the authenticity declaration
-- =============================================================================
