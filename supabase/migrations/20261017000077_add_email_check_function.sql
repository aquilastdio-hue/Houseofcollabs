-- Add function to check if email is already registered before form submission
-- This allows frontend to validate email in real-time

begin;

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
    ),
    'reason', case
      when exists (
        select 1 from public.applications a
        where lower(a.email) = lower(p_email)
      ) then 'You have already submitted an application. Please contact support if you need to update your details.'
      else null
    end
  );
$$;

comment on function public.check_email_before_application(text) is
  'Check if an email can submit an application. Returns false if the email already has any application.';

revoke all on function public.check_email_before_application(text) from public;
grant execute on function public.check_email_before_application(text) to anon, authenticated;

-- Also update check_application_duplicates to include email check
-- This makes the existing function more comprehensive
create or replace function public.check_application_duplicates(
  p_phone text default null,
  p_instagram text default null,
  p_email text default null
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'email_taken', exists (
      select 1 from public.applications a
      where lower(a.email) = lower(p_email)
    ),
    'phone_taken', private.phone_is_registered(p_phone, p_email),
    'instagram_taken', private.instagram_is_registered(p_instagram, p_email)
  );
$$;

comment on function public.check_application_duplicates(text, text, text) is
  'Has this email, mobile number or Instagram account already been registered? Returns booleans only — never which account it belongs to.';

revoke all on function public.check_application_duplicates(text, text, text) from public;
grant execute on function public.check_application_duplicates(text, text, text) to anon, authenticated;

commit;
