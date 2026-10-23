-- Fix email duplicate check to exclude rejected applications
--
-- The phone and Instagram checks already exclude rejected applications
-- (status <> 'rejected'), but the email check did not. This migration
-- aligns the email check with the same logic, allowing re-application
-- after rejection.

begin;

-- Update check_email_before_application to exclude rejected applications
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
      when exists (
        select 1 from public.applications a
        where lower(a.email) = lower(p_email)
          and a.status = 'rejected'
      ) then 'Your previous application was rejected. You can re-apply with this email.'
      else null
    end
  );
$$;

-- Update check_application_duplicates to exclude rejected applications for email
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
        and a.status <> 'rejected'
    ),
    'phone_taken', private.phone_is_registered(p_phone, p_email),
    'instagram_taken', private.instagram_is_registered(p_instagram, p_email)
  );
$$;

comment on function public.check_application_duplicates(text, text, text) is
  'Has this email, mobile number or Instagram account already been registered? Returns booleans only — never which account it belongs to. Excludes rejected applications for email re-application.';

commit;
