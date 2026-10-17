-- Prevent duplicate applications by email and block OTP for duplicate phone numbers
--
-- 1. Block application submission if the email already exists in any application
--    (any status: new, reviewing, approved, rejected)
-- 2. Block OTP sending if the phone number is already registered in:
--    - Any previous application
--    - Any existing profile (approved user)

begin;

-- Modify the applications_before_insert trigger to block duplicate emails
CREATE OR REPLACE FUNCTION private.applications_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_phone_taken boolean;
  v_insta_taken boolean;
begin
  -- Block if email already has any application (any status, any role)
  if exists (
    select 1 from public.applications a
    where lower(a.email) = lower(new.email)
  ) then
    raise exception 'You have already submitted an application. Please contact support if you need to update your details.'
      using errcode = 'P0001', hint = 'DUPLICATE_APPLICATION';
  end if;

  -- Check for duplicate phone number (in applications or profiles)
  v_phone_taken := private.phone_is_registered(new.phone, new.email);
  v_insta_taken := private.instagram_is_registered(new.social_handle, new.email);

  if v_phone_taken and v_insta_taken then
    raise exception 'This mobile number and Instagram ID are already registered. Please use different details.'
      using errcode = 'P0001', hint = 'DUPLICATE_PHONE_AND_INSTAGRAM';
  elsif v_phone_taken then
    raise exception 'This mobile number is already registered. Please use a different mobile number.'
      using errcode = 'P0001', hint = 'DUPLICATE_PHONE';
  elsif v_insta_taken then
    raise exception 'This Instagram ID is already registered. Please use a different Instagram ID.'
      using errcode = 'P0001', hint = 'DUPLICATE_INSTAGRAM';
  end if;

  -- Phone verification, when it is switched on. The flag defaults to false so
  -- this migration changes nothing until the OTP box is live and proven; flip
  -- `require_phone_verification` to true to start enforcing it.
  if private.setting_bool('require_phone_verification', false)
     and not private.phone_recently_verified(new.phone) then
    raise exception 'Please verify your mobile number before continuing.'
      using errcode = 'P0001', hint = 'PHONE_NOT_VERIFIED';
  end if;

  -- Never client-settable, whatever the request body says.
  new.status := 'new';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$function$;

-- Add a function to check if phone is already registered before sending OTP
-- This will be called from the client to prevent sending OTP to duplicate numbers
create or replace function public.check_phone_before_otp(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'can_send', not private.phone_is_registered(p_phone, null),
    'reason', case
      when private.phone_is_registered(p_phone, null) then 'This mobile number is already registered. Please use a different mobile number.'
      else null
    end
  );
$$;

comment on function public.check_phone_before_otp(text) is
  'Check if a phone number can receive OTP. Returns false if the number is already in applications or profiles.';

revoke all on function public.check_phone_before_otp(text) from public;
grant execute on function public.check_phone_before_otp(text) to anon, authenticated;

commit;
