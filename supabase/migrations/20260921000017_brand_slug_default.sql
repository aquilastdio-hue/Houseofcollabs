-- =============================================================================
-- House of Collab · 0017 · brands.brand_slug is trigger-owned, not client-owned
-- =============================================================================
-- `brand_slug` is deliberately excluded from the INSERT grant so that clients
-- can't squat slugs — `private.brands_before_write()` derives it from brand_name on
-- every insert. But the column was `not null` with no default, so the generated
-- TypeScript types marked it *required*. That left the client with two bad
-- options: send it and fail the column privilege check with 42501, or omit it
-- and fail typechecking. The brand onboarding form hit exactly this.
--
-- Giving the column an empty-string default resolves the contradiction: clients
-- no longer need to mention it, and the BEFORE INSERT trigger already treats ''
-- as "derive from brand_name" (see `coalesce(nullif(new.brand_slug, ''), …)`).
-- =============================================================================

alter table public.brands
  alter column brand_slug set default '';

comment on column public.brands.brand_slug is
  'Set by private.brands_before_write() from brand_name. Not client-writable: excluded from the INSERT/UPDATE grants.';
