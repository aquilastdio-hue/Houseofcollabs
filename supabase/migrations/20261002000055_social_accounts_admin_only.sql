-- =============================================================================
-- House of Collabs | 0055 | a creator's social account is theirs and admin's
-- =============================================================================
-- `creator_social_accounts` was readable by anyone. The policy allowed four
-- ways in:
--
--   is_creator_public(creator_id)            -- any visitor, signed in or not
--   owns_creator(creator_id)                 -- the creator themselves
--   is_admin()                               -- staff
--   brand_has_creator_relationship(…)        -- a brand that had ordered
--
-- The first of those meant one unauthenticated request returned every
-- published creator's Instagram handle and profile URL in a single response --
-- 24 rows covering all 22 creators. The handle had already been taken off the
-- storefront, out of the page payload and out of the JSON-LD, and none of that
-- mattered while the table itself answered to the public key.
--
-- A handle is a way to take the collaboration off the platform, so it is now
-- visible to exactly two parties: the creator who submitted it, and staff.
--
--   anonymous        -> denied (no policy applies to the anon role at all)
--   another creator  -> denied
--   a brand          -> denied, including one that has ordered from them
--   the creator      -> their own row, nothing else
--   admin            -> everything
--
-- Enforced here rather than in the client: the previous fix removed the columns
-- from the storefront query, which stops the app asking but not anyone else.
--
-- Deliberately unchanged:
--
--   * INSERT/UPDATE/DELETE still belong to the owning creator. They submit the
--     account during sign-up and can correct it afterwards; a creator who could
--     write a row they cannot read back would hit an error on every save,
--     because the client reads the row it just wrote.
--   * `creators.followers_count` -- the "Total followers" figure on the public
--     profile is its own column on `creators` and is untouched.
--   * `brand_has_creator_relationship` itself, which other tables still use.
-- =============================================================================

drop policy if exists "Creator socials are readable" on public.creator_social_accounts;

-- `to authenticated` leaves the anon role with no SELECT policy whatsoever,
-- which is the difference between "returns nothing today" and "cannot be
-- reached". Both predicates need auth.uid(), so an anonymous caller could never
-- satisfy them anyway -- this just states it where someone reading the policy
-- list can see it.
create policy "Creator socials are private to the creator and admins"
on public.creator_social_accounts
for select
to authenticated
using (
  private.owns_creator(creator_id)
  or (select private.is_admin())
);
