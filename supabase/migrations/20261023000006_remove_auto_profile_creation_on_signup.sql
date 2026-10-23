-- Remove automatic profile creation on signup
--
-- Previously, when a user signed up/verified their account, a profile row was
-- automatically created with role=NULL (unassigned). This led to users getting
-- stuck in the platform without completing onboarding.
--
-- Now, no profile is created automatically. The profile is only created when
-- an admin approves their application (via the apply_application function).

begin;

drop function if exists private.handle_new_user cascade;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  -- Do NOT create a profile automatically
  -- Profile will only be created when admin approves an application
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

commit;
