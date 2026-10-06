-- 0064 · How the Edge Function records a verified number
--
-- `private` is not exposed through PostgREST, which is exactly why the proof
-- lives there — but it also means the Edge Function cannot insert into it with
-- the usual client call. So the write goes through a `security definer`
-- function instead, granted to `service_role` alone.
--
-- `anon` and `authenticated` are explicitly revoked. The browser must never be
-- able to tell the database "I verified this number"; only the Edge Function,
-- which has actually checked the Firebase token's signature, may say so.

begin;

create or replace function public.record_phone_verification(
  p_phone text,
  p_provider_uid text,
  p_provider text default 'firebase'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_phone text := private.normalize_phone(p_phone);
begin
  if v_phone is null then
    raise exception 'A phone number is required.' using errcode = 'P0001', hint = 'PHONE_REQUIRED';
  end if;
  if nullif(btrim(coalesce(p_provider_uid, '')), '') is null then
    raise exception 'A provider id is required.' using errcode = 'P0001', hint = 'PROVIDER_UID_REQUIRED';
  end if;

  insert into private.phone_verifications (phone, provider, provider_uid)
  values (v_phone, coalesce(nullif(btrim(p_provider), ''), 'firebase'), btrim(p_provider_uid));

  return jsonb_build_object('verified', true, 'phone', v_phone);
end;
$$;

comment on function public.record_phone_verification(text, text, text) is
  'Records a server-checked phone verification. service_role only — the browser must never be able to assert its own verification.';

revoke all on function public.record_phone_verification(text, text, text) from public, anon, authenticated;
grant execute on function public.record_phone_verification(text, text, text) to service_role;

commit;
