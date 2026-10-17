-- Update check_email_before_application to exclude rejected applications
-- This aligns with the trigger behavior changed in migration 00079

begin;

drop function if exists public.check_email_before_application(text);

create or replace function public.check_email_before_application(p_email text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'can_apply', not exists (
      select 1 from public.applications a
      where lower(a.email) = lower(p_email)
        and a.status <> 'rejected'
    ),
    'reason', case
      when exists (
        select 1 from public.applications a
        where lower(a.email) = lower(p_email)
          and a.status <> 'rejected'
      ) then 'You have already submitted an application. Please contact support if you need to update your details.'
      else null
    end
  );
$$;

comment on function public.check_email_before_application(text) is
  'Check if an email can submit an application. Returns false if the email has a non-rejected application. Allows re-application for rejected emails.';

revoke all on function public.check_email_before_application(text) from public;
grant execute on function public.check_email_before_application(text) to anon, authenticated;

commit;
