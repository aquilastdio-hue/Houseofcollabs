-- Cascade delete applications when profile is deleted
--
-- Previously, deleting a profile would set application.profile_id to NULL,
-- but the application row would remain. This migration changes the behavior
-- to delete the application entirely when the profile is deleted.

begin;

-- Drop the existing foreign key constraint
alter table public.applications
  drop constraint if exists applications_profile_id_fkey;

-- Recreate with ON DELETE CASCADE
alter table public.applications
  add constraint applications_profile_id_fkey
  foreign key (profile_id)
  references public.profiles (id)
  on delete cascade;

comment on column public.applications.profile_id is
  'The account created for this applicant when they were approved. Cascade deleted when profile is deleted.';

commit;
