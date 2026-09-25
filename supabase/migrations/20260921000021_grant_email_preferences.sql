-- =============================================================================
-- House of Collabs · 0021 · let users save their own email preferences
-- =============================================================================
-- Migration 0020 added the per-category opt-out columns, but `profiles` uses a
-- column-level UPDATE grant — anything not named there is rejected with 42501.
-- Without this, saving preferences in Settings → Security fails even though RLS
-- allows the row.
--
-- Deliberately still excluded: role, status, onboarding_completed, email. Those
-- are set by the server, never by the account holder.
-- =============================================================================

grant update (
  full_name,
  avatar_url,
  phone,
  email_notifications,
  email_orders,
  email_payments,
  email_campaigns,
  email_account,
  email_marketing
) on public.profiles to authenticated;
