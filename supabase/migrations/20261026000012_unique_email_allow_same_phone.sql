-- 0012 · Unique email constraint for accounts, allow same phone for both roles
--
-- Enforces that email addresses must be unique across all user accounts (brand,
-- creator, admin), while allowing the same phone number to be used for both brand
-- and creator accounts.
--
-- This is important because:
-- 1. Login is done via email (Google OAuth, email/password), not phone
-- 2. Each email should map to exactly one account to prevent confusion
-- 3. Phone numbers can be shared (a person can be both a brand and a creator)
--
-- Note: auth.users already enforces unique emails at the authentication layer.
-- This adds a unique constraint on profiles.email to ensure data integrity and
-- prevent any direct database manipulation from breaking this rule.

begin;

-- Create a unique index on lowercased email to enforce uniqueness
-- PostgreSQL doesn't support expressions in UNIQUE constraints, so we use a unique index
create unique index if not exists profiles_email_unique_idx
on public.profiles (lower(email))
where email is not null;

-- Update the comment to document this constraint
comment on column public.profiles.email is
  'Unique across all accounts. Login is via email, so each email maps to exactly one user account.';

commit;
