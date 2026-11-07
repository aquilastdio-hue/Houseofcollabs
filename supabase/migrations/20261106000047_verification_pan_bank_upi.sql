-- 0047 - Verification asks for PAN, bank account and UPI
--
-- To get the verified badge a creator now sends: their full legal name, their
-- Instagram profile link, their PAN number with a PDF or photo of the PAN
-- card, their bank account number, IFSC and branch address, and their UPI ID.
-- Everything is required. Payouts are unchanged: these are records for the
-- team, shown on the creator's admin page (Identity verification card).
--
-- The full PAN, account number and UPI ID live in a private table nothing can
-- read over the API. creator_verifications keeps only what's safe to show the
-- creator and the review screen: the last four characters, IFSC, branch, the
-- Instagram link and a masked UPI ID. An admin sees the full values with
-- admin_reveal_verification, and every view is recorded in the audit log.
--
-- request_creator_verification (the old, shorter form) stays until the new
-- website is live; migration 0048 then clears its requests and old badges.

begin;

alter table public.creator_verifications
  add column if not exists instagram_url text,
  add column if not exists bank_account_last4 text,
  add column if not exists ifsc_code text,
  add column if not exists branch_address text,
  add column if not exists upi_hint text;

comment on column public.creator_verifications.upi_hint is
  'The UPI ID with most of the name hidden (ab••••@okicici); the full one is in private.creator_verification_secrets.';

create table if not exists private.creator_verification_secrets (
  verification_id      uuid primary key references public.creator_verifications (id) on delete cascade,
  pan_number           text not null check (pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  bank_account_number  text not null check (bank_account_number ~ '^[0-9]{9,18}$'),
  upi_id               text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table private.creator_verification_secrets is
  'Full PAN, bank account number and UPI ID from a verification request. Read only through public.admin_reveal_verification (audited).';

alter table private.creator_verification_secrets enable row level security;
revoke all on private.creator_verification_secrets from public, anon, authenticated;

-- ------------------------------------------------------------ the request --

create or replace function public.submit_creator_verification(
  p_legal_name text,
  p_instagram_url text,
  p_pan text,
  p_pan_document_path text,
  p_bank_account_number text,
  p_ifsc text,
  p_branch_address text,
  p_upi_id text
)
returns public.creator_verifications
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator public.creators;
  v_row public.creator_verifications;
  v_name text := btrim(coalesce(p_legal_name, ''));
  v_url text := btrim(coalesce(p_instagram_url, ''));
  v_handle text;
  v_pan text := upper(regexp_replace(coalesce(p_pan, ''), '\s', '', 'g'));
  v_path text := btrim(coalesce(p_pan_document_path, ''));
  v_account text := regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g');
  v_ifsc text := upper(regexp_replace(coalesce(p_ifsc, ''), '\s', '', 'g'));
  v_branch text := btrim(coalesce(p_branch_address, ''));
  v_upi text := lower(btrim(coalesce(p_upi_id, '')));
begin
  select * into v_creator from public.creators where profile_id = auth.uid();
  if not found then
    raise exception 'Create your creator profile first.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if v_creator.verified then
    raise exception 'Your profile is already verified.' using errcode = 'P0001', hint = 'ALREADY_VERIFIED';
  end if;
  if exists (select 1 from public.creator_verifications where creator_id = v_creator.id and status = 'pending') then
    raise exception 'Your verification is already being reviewed.' using errcode = 'P0001', hint = 'VERIFICATION_PENDING';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Enter your full name as it appears on your PAN card.' using errcode = 'P0001', hint = 'LEGAL_NAME_REQUIRED';
  end if;
  -- normalize_instagram doesn't check the site, so the link itself must be an Instagram profile.
  if v_url !~* '^(https?://)?(www\.|m\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?([?#].*)?$' then
    raise exception 'Paste your Instagram profile link, like https://www.instagram.com/yourname/' using errcode = 'P0001', hint = 'INSTAGRAM_LINK_INVALID';
  end if;
  v_handle := private.normalize_instagram(v_url);
  if v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'That PAN doesn''t look right. It is 10 characters, like ABCDE1234F.' using errcode = 'P0001', hint = 'INVALID_PAN';
  end if;
  -- The file must be one this creator uploaded to the private bucket.
  if v_path = '' or split_part(v_path, '/', 1) <> v_creator.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'verification-documents' and o.name = v_path) then
    raise exception 'Upload a PDF or photo of your PAN card.' using errcode = 'P0001', hint = 'PAN_DOCUMENT_REQUIRED';
  end if;
  if v_account !~ '^[0-9]{9,18}$' then
    raise exception 'Enter your bank account number: 9 to 18 digits.' using errcode = 'P0001', hint = 'INVALID_ACCOUNT_NUMBER';
  end if;
  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'That IFSC doesn''t look right. It is 11 characters, like SBIN0001234.' using errcode = 'P0001', hint = 'INVALID_IFSC';
  end if;
  if char_length(v_branch) < 5 or char_length(v_branch) > 300 then
    raise exception 'Enter your bank branch address.' using errcode = 'P0001', hint = 'BRANCH_ADDRESS_REQUIRED';
  end if;
  if v_upi !~ '^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,63}$' then
    raise exception 'That UPI ID doesn''t look right. It looks like yourname@okicici.' using errcode = 'P0001', hint = 'INVALID_UPI';
  end if;

  -- A "more info" request is answered by updating it, not by stacking a new one.
  update public.creator_verifications
  set status = 'pending',
      legal_name = v_name,
      instagram_url = 'https://www.instagram.com/' || v_handle || '/',
      document_type = 'pan',
      document_number_last4 = right(v_pan, 4),
      document_path = v_path,
      bank_account_last4 = right(v_account, 4),
      ifsc_code = v_ifsc,
      branch_address = v_branch,
      upi_hint = left(split_part(v_upi, '@', 1), 2) || '••••@' || split_part(v_upi, '@', 2),
      -- The old form's optional fields aren't asked for any more.
      date_of_birth = null, address_line = null, city = null, state = null, postal_code = null, note = null,
      review_note = null,
      submitted_at = now()
  where creator_id = v_creator.id and status = 'more_info'
  returning * into v_row;

  if not found then
    insert into public.creator_verifications (
      creator_id, legal_name, instagram_url, document_type, document_number_last4, document_path,
      bank_account_last4, ifsc_code, branch_address, upi_hint
    ) values (
      v_creator.id, v_name, 'https://www.instagram.com/' || v_handle || '/', 'pan', right(v_pan, 4), v_path,
      right(v_account, 4), v_ifsc, v_branch, left(split_part(v_upi, '@', 1), 2) || '••••@' || split_part(v_upi, '@', 2)
    )
    returning * into v_row;
  end if;

  insert into private.creator_verification_secrets (verification_id, pan_number, bank_account_number, upi_id)
  values (v_row.id, v_pan, v_account, v_upi)
  on conflict (verification_id) do update
    set pan_number = excluded.pan_number, bank_account_number = excluded.bank_account_number,
        upi_id = excluded.upi_id, updated_at = now();

  perform private.notify_admins('creator_verification', 'Verification requested',
    format('%s asked to be verified.', v_creator.display_name), 'creator', v_creator.id,
    '/admin/creators/' || v_creator.id);
  perform private.notify(auth.uid(), 'verification_submitted', 'Verification submitted',
    'We are checking your details and will let you know shortly.', 'creator', v_creator.id, '/creator/profile');
  -- Metadata deliberately carries no identity or bank details.
  perform private.audit('creator_verification_requested', 'creator', v_creator.id::text,
    jsonb_build_object('verification_id', v_row.id), auth.uid(), 'creator');
  return v_row;
end;
$$;

comment on function public.submit_creator_verification is
  'Creator asks for the verified badge with PAN (+ card), bank account and UPI. Re-submitting answers a "more info" request.';

revoke execute on function public.submit_creator_verification(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_creator_verification(text, text, text, text, text, text, text, text) to authenticated;

-- --------------------------------------------------------------- reveal --

-- The full PAN, account number and UPI ID of one request, for an admin. Each
-- call is recorded, so there's a record of who looked and when.
create or replace function public.admin_reveal_verification(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_details jsonb;
begin
  select jsonb_build_object('pan_number', s.pan_number, 'bank_account_number', s.bank_account_number, 'upi_id', s.upi_id)
    into v_details
  from private.creator_verification_secrets s
  where s.verification_id = p_id;
  if v_details is null then
    raise exception 'These details aren''t on file for this request.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  perform private.audit('verification_details_revealed', 'creator_verification', p_id::text, '{}'::jsonb, v_admin, 'admin');
  return v_details;
end;
$$;

revoke execute on function public.admin_reveal_verification(uuid) from public, anon;
grant execute on function public.admin_reveal_verification(uuid) to authenticated;

commit;
