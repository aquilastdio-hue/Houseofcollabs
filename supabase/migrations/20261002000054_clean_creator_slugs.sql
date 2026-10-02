-- =============================================================================
-- House of Collabs | 0054 | two storefront URLs were pasted Instagram links
-- =============================================================================
-- The slug is derived from the name a creator typed on page 1 of the sign-up,
-- and two of them pasted a full instagram.com URL into that field. The result
-- was a public storefront at:
--
--   /creators/https-instagram-com-rohit-arora-5030-igshid-ymmymta2m2y
--   /creators/https-www-instagram-com-simranmakeovers25-utm-source-qr
--
-- 0050 renamed the storefronts themselves but deliberately left slugs alone,
-- on the grounds that a URL in a shared link should not break. That reasoning
-- no longer holds: the handle has since been removed from the page, the payload
-- and the JSON-LD, and these two URLs put it straight back -- in the address
-- bar, the canonical tag and the sitemap. A URL nobody would choose to share
-- is a poor reason to keep publishing a contact detail.
--
-- The old paths are redirected rather than dropped: see the `redirects` block
-- in vercel.json, which 308s each one to its replacement so an indexed URL
-- keeps its value and nothing 404s.
--
-- Scoped by id to the two affected rows, matched on the exact slug, so this is
-- inert if either has already been renamed by hand.
-- =============================================================================

update public.creators
set slug = 'rohit-arora', updated_at = now()
where slug = 'https-instagram-com-rohit-arora-5030-igshid-ymmymta2m2y'
  and not exists (select 1 from public.creators c where c.slug = 'rohit-arora');

update public.creators
set slug = 'simran-kaur', updated_at = now()
where slug = 'https-www-instagram-com-simranmakeovers25-utm-source-qr'
  and not exists (select 1 from public.creators c where c.slug = 'simran-kaur');
