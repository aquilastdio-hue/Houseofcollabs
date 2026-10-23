-- Disable set_initial_role since profiles are no longer auto-created
--
-- With automatic profile creation removed, set_initial_role is no longer needed.
-- Users will only get roles through the application approval flow.

begin;

-- Drop the function if it exists
drop function if exists public.set_initial_role(public.user_role);

commit;
