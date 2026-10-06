-- 0063 - Proof that a phone number was actually verified
--
-- Firebase Phone Auth happens entirely in the browser, so "this number is
-- verified" arriving from the client is worth nothing on its own -- anyone can
-- post an application straight to PostgREST and say so. What makes it true is
-- the Edge Function `verify-phone`: it checks the Firebase ID token's signature
-- against Google's public keys, then records the result here with the service
-- role.
--
-- The table lives in `private` deliberately. That schema has no grants to
-- `anon` or `authenticated` and is not exposed through PostgREST, so the
-- browser can neither read these rows nor forge one -- which is the whole point
-- of keeping the proof somewhere the claimant cannot reach.
--
-- Enforcement is behind `require_phone_verification`, default false. Shipping
-- this migration changes nothing: sign-up keeps working exactly as it does
-- today. Flip the setting once the OTP box is live and Firebase Auth is
-- actually enabled on the project, and flip it back if SMS delivery ever breaks
-- rather than having a dead provider lock everyone out of signing up.

begin;

create table if not exists private.phone_verifications (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  provider      text not null default 'firebase',
  provider_uid  text not null,
  verified_at   timestamptz not null default now(),
  application_id uuid references public.applications (id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table private.phone_verifications is
  'Server-checked proof that someone controlled a phone number. Written only by the verify-phone Edge Function; unreachable from the browser.';
comment on column private.phone_verifications.phone is
  'Normalised by private.normalize_phone, so lookups match however the number was typed.';

create index if not exists phone_verifications_phone_idx
  on private.phone_verifications (phone, verified_at desc);

-- ------------------------------------------------------------------ helpers --

create or replace function private.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select case jsonb_typeof(s.value)
              when 'boolean' then (s.value)::text::boolean
              when 'string'  then lower(s.value #>> '{}') in ('true', 'yes', '1')
              else null
            end
     from public.platform_settings s where s.key = p_key),
    p_default);
$$;

-- A verification is good for half an hour: long enough to finish a five-page
-- form, short enough that a code proved last week cannot be reused.
create or replace function private.phone_recently_verified(
  p_phone text,
  p_within interval default interval '30 minutes'
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.normalize_phone(p_phone) is not null
     and exists (
       select 1 from private.phone_verifications v
       where v.phone = private.normalize_phone(p_phone)
         and v.verified_at > now() - p_within
     );
$$;

insert into public.platform_settings (key, value, description, is_public)
values ('require_phone_verification', 'false'::jsonb,
        'Require an SMS-verified mobile number before an application can be submitted.', true)
on conflict (key) do nothing;

-- ------------------------------------------------------------- insert guard --

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
  new.status := 'new';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$function$;

commit;
