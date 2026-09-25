-- =============================================================================
-- House of Collabs · 0039 · the creator sign-up is five pages, not nine
-- =============================================================================
-- The spec behind 0038 was replaced by a much shorter one. No structural change
-- is needed — `profile` is jsonb and absorbs the new shape — but the column
-- comment described screens that no longer exist, and a comment that lies about
-- its own column is worse than none.
-- =============================================================================

comment on column public.applications.profile is
  'Pages 2-5 of the creator sign-up: socials, portfolio, commercials and consent. Copied into the creator tables on approval.';

comment on column public.applications.image_path is
  'First photo from the portfolio, mirrored out of `profile.photos` for the admin list.';

comment on column public.applications.video_path is
  'First video from the portfolio, mirrored out of `profile.videos` for the admin list.';

-- =============================================================================
-- Shape of `profile` (all keys optional; the form fills what it asks for)
-- =============================================================================
--  creator_name     text                                        page 1
--  instagram        { handle, url, followers }                  page 2
--  youtube          { url, subscribers }
--  videos           text[]  object paths, up to 5               page 3
--  photos           text[]  object paths, up to 10
--  portfolio_links  text[]  up to 5
--  commercials      { ugc_video | extra_usage | collab_reel |   page 4
--                     static_carousel | story | youtube_integration |
--                     barter: { available, price } }
--  barter_stance    yes | selectively | no
--  open_to          text[]                                      page 5
--  confirmed        boolean  the authenticity declaration
-- =============================================================================

-- Clears the row left by verifying the form end to end.
delete from public.applications where email like 'fivepage.%@example.com';
