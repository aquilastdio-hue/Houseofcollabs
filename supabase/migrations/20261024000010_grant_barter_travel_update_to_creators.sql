-- Grant creators permission to update barter_stance and travel_scope
--
-- These columns were added in migration 0082 but not included in the
-- update grant for authenticated users (0012). This migration adds them
-- so creators can edit their barter and travel preferences from their dashboard.

begin;

-- Add barter_stance and travel_scope to the update grant for creators
grant update (barter_stance, travel_scope) on public.creators to authenticated;

comment on column public.creators.barter_stance is
  'Barter preference: yes, selectively or no. Creators can edit this from their dashboard.';
comment on column public.creators.travel_scope is
  'How far the creator will travel for a shoot: within_city, within_country or out_of_country. Creators can edit this from their dashboard.';

commit;
