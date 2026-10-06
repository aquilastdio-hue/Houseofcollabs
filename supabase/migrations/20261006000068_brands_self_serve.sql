-- 0068 - Brands sign themselves up
--
-- A brand application used to wait for an admin before the account existed.
-- Brands now get one straight away: the application is written as `approved`,
-- and the account itself is created by the machinery that already existed --
-- `on_profile_claim_application` fires when their profile row appears on first
-- Google sign-in, finds the approved application for that email, and runs
-- `apply_application` exactly as it would have after a manual approval.
--
-- So this migration adds no new provisioning path. It only decides that a brand
-- does not need to be let in by hand.
--
-- Two consequences worth knowing:
--
--   * The account is created on first sign-in, not on submit, and only for a
--     Google identity whose email matches the application. Someone who applies
--     with one address and signs in with another gets no account, which is why
--     the success screen says which address to use.
--
--   * The ID document and authorisation letter the form collects are no longer
--     seen by anyone before access is granted. They are still stored and still
--     on the application for an admin to check afterwards, but they no longer
--     gate anything. Creators are unaffected and still reviewed by hand.

begin;

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
  if (select count(*) from public.applications a
      where lower(a.email) = lower(new.email) and a.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already applied. We will be in touch shortly.'
      using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;

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
  --
  -- Brands are self-serve: they get an account the moment they finish the form.
  -- Nothing else provisions them here — marking the application approved is
  -- what lets `on_profile_claim_application` pick it up on their first Google
  -- sign-in, which is the same path an admin-approved application has always
  -- taken. Creators are still reviewed by hand.
  --
  -- `reviewed_by` and `reviewed_at` stay null on purpose: nobody reviewed it,
  -- and recording otherwise would put a fiction in the audit trail.
  new.status := case when new.role = 'brand' then 'approved' else 'new' end;
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$function$;

commit;
