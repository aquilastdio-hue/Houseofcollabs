-- Add a column to store additional brand preferences from onboarding
-- This stores creator preferences, collaboration types, budget, etc. from the 3-page wizard

begin;

alter table public.brands
  add column if not exists preferences jsonb default '{}'::jsonb;

comment on column public.brands.preferences is
  'Additional brand preferences from onboarding: creator categories, collaboration types, budget, contact person, designation, etc.';

commit;
