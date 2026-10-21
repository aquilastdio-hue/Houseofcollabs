-- 0082 - The barter and travel answers from sign-up, on the creator
--
-- Page 4 of the creator sign-up asks two things brands want to see on a
-- storefront: "Barter collaboration" (yes / selectively / no) and "Open to
-- travel" (within city / within country / out of country). Both answers lived
-- only in `applications.profile`, which nobody but admins can read, so a
-- storefront couldn't show them. 0057 carried the yes/no of barter across as
-- `barter_available`; this carries the answers themselves.
--
-- They are copied, not referenced, for the same reason as 0057: the storefront
-- reads `creators` (public), never `applications` (admin-only). Existing
-- creators are backfilled from their application. New ones get them when
-- approval links the application to the account (`apply_application` sets
-- `status = 'approved'` and `profile_id` in one update, after the creator row
-- exists), through a trigger -- so the approval function itself is untouched.
-- An answer outside the known values is stored as null rather than ever
-- failing an approval.
--
-- Creators can't change these from the studio: `creators` updates are an
-- explicit column grant (0012) and these columns aren't in it. They are the
-- answers given at sign-up.

begin;

alter table public.creators
  add column if not exists barter_stance text check (barter_stance in ('yes', 'selectively', 'no')),
  add column if not exists travel_scope text check (travel_scope in ('within_city', 'within_country', 'out_of_country'));

comment on column public.creators.barter_stance is
  'Barter answer from the sign-up form: yes, selectively or no. Null when the application never said.';
comment on column public.creators.travel_scope is
  'How far the creator will travel for a shoot, from the sign-up form: within_city, within_country or out_of_country.';

-- ------------------------------------------------------------------ helpers --

-- The answer as stored on the form, or what the yes/no field implies for
-- applications from before the three-way question existed.
create or replace function private.application_barter_stance(p_profile jsonb)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_profile ->> 'barter_stance' in ('yes', 'selectively', 'no') then p_profile ->> 'barter_stance'
    when p_profile ->> 'barter_available' = 'true' then 'yes'
    when p_profile ->> 'barter_available' = 'false' then 'no'
  end;
$$;

create or replace function private.application_travel_scope(p_profile jsonb)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_profile ->> 'travel_scope' in ('within_city', 'within_country', 'out_of_country') then p_profile ->> 'travel_scope'
  end;
$$;

-- ---------------------------------------------------------------- backfill --
-- Each creator's own application: the one approval linked, else (approved
-- before applications carried profile_id) the one sent from their email.

update public.creators c
set barter_stance = coalesce(c.barter_stance, private.application_barter_stance(src.profile)),
    travel_scope  = coalesce(c.travel_scope,  private.application_travel_scope(src.profile))
from (
  select distinct on (cr.id) cr.id as creator_id, a.profile
  from public.creators cr
  join public.profiles pr on pr.id = cr.profile_id
  join public.applications a
    on a.role = 'creator'
   and (a.profile_id = cr.profile_id or (a.profile_id is null and lower(a.email) = lower(pr.email)))
  order by cr.id, (a.profile_id is not null) desc, (a.status = 'approved') desc, a.created_at desc
) src
where src.creator_id = c.id;

-- ------------------------------------------------------- carried at approval --

create or replace function private.copy_application_answers_to_creator()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.creators c
  set barter_stance = coalesce(private.application_barter_stance(new.profile), c.barter_stance),
      travel_scope  = coalesce(private.application_travel_scope(new.profile), c.travel_scope)
  where c.profile_id = new.profile_id;
  return null;
end;
$$;

drop trigger if exists applications_copy_answers_to_creator on public.applications;
create trigger applications_copy_answers_to_creator
  after insert or update of status, profile_id on public.applications
  for each row
  when (new.role = 'creator' and new.status = 'approved' and new.profile_id is not null)
  execute function private.copy_application_answers_to_creator();

commit;
