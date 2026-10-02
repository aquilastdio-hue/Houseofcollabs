-- =============================================================================
-- House of Collabs | 0056 | storefront URLs stop spelling out the handle
-- =============================================================================
-- 0055 made `creator_social_accounts` readable only by the creator who owns the
-- row and by staff. That closed the API, but not the address bar: the slug is
-- generated from the "Creator / Instagram name" field on page 1 of the sign-up,
-- and most people fill that with their handle. So /creators/aromasurimakeovers
-- told any brand exactly what the table would no longer hand over -- and the
-- same string sat in the sitemap, the canonical tag and every shared link.
--
-- Twelve of the twenty-two were affected. The other ten already read as the
-- creator's own name, which merely happens to match their handle too, and are
-- left alone.
--
-- Each new slug is the creator's display name, which 0050 had already corrected
-- from the handle to the real name. Checked beforehand: no candidate collides
-- with an existing slug and none collide with each other.
--
-- Old paths are not dropped. `vercel.json` carries a permanent redirect for
-- each one, so an indexed URL keeps its ranking and a shared link still opens
-- the right storefront.
--
-- Each update is matched on the exact old slug and guarded against a collision,
-- so re-running does nothing and a slug already changed by hand is untouched.
-- =============================================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('aromasurimakeovers',        'aroma-suri'),
      ('stylistchaitanya',          'chaitanya-sharma'),
      ('creator-gungun-dheer',      'gungun-dheer'),
      ('dawn-traveler',             'isha-verma'),
      ('stylewith-mann',            'manna-arora'),
      ('meghnabhatiaa',             'meghna-bhatia'),
      ('neha-shrivastava-official', 'neha-shrivastava'),
      ('pj-makeovers',              'prerna-jagwani'),
      ('shilpsarora',               'shilpa-arora'),
      ('shine-the-lioness',         'shine-sawhney'),
      ('sonalarorra',               'sonal-arora'),
      ('tanishasadhofficial',       'tanisha-sadh')
    ) as t(old_slug, new_slug)
  loop
    update public.creators c
    set slug = r.new_slug, updated_at = now()
    where c.slug = r.old_slug
      and not exists (select 1 from public.creators x where x.slug = r.new_slug);
  end loop;
end;
$$;
