-- =============================================================================
-- House of Collabs · 0031 · make the applications column grants actually bind
-- =============================================================================
-- Migration 0030 granted INSERT on the applicant-facing columns only, but a
-- probe showed an anonymous insert carrying `status`, `review_note` and
-- `reviewed_by` still returned 201 rather than 42501.
--
-- The data was never at risk — the BEFORE INSERT trigger overwrites all three,
-- and the probe row came back `status = 'new'` with the other two null. But the
-- privilege layer wasn't doing its share: Supabase's bootstrap grants the anon
-- and authenticated roles broad table privileges in `public`, and a
-- column-level `grant insert (…)` adds to that rather than narrowing it.
--
-- Revoking first makes the column list the real boundary, so tampering is
-- refused outright instead of being silently cleaned up afterwards. Same class
-- of mistake as the PUBLIC grant in migration 0023.
-- =============================================================================

revoke all on public.applications from anon, authenticated;

-- Applicants may write exactly these columns and nothing else. status,
-- review_note, reviewed_by, reviewed_at and created_at stay server-owned.
grant insert (
  role, full_name, email, phone, city, message,
  social_platform, social_handle, followers_count, categories, bio, portfolio_url, video_path,
  brand_name, website, budget_range, looking_for
) on public.applications to anon, authenticated;

-- Reading is still gated by the "Admins read applications" policy on top.
grant select on public.applications to authenticated;

-- No UPDATE or DELETE for anyone through the API: reviewing goes through
-- public.admin_review_application, which checks private.require_admin().
