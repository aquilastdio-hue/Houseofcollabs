-- =============================================================================
-- House of Collabs · 0027 · progressive information collection
-- =============================================================================
-- Signup stays exactly as it is. Everything a creator needs *later* is asked
-- for at the moment they reach for the feature that needs it.
--
-- This migration adds the two things the application could not already answer:
--
--   1. public.creator_verifications  — there was no creator-initiated identity
--      check at all; `creators.verified` was an admin-only flag with nothing
--      behind it.
--   2. public.get_creator_requirements() — one authoritative read of what a
--      creator has, so feature gates never re-implement their own checks.
--
-- Everything else a gate needs already exists and is reused untouched:
--   services/pricing  → creator_services + service_addons
--   portfolio         → portfolio_items
--   payout            → payout_methods (full account number stays write-only)
--   go live           → publish_creator_profile() + get_creator_completion()
--   campaigns         → briefs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identity verification
-- -----------------------------------------------------------------------------
-- Deliberately minimal. We keep the last four digits of a document number and
-- a file in a private bucket — never a full ID number in a readable column.
create table if not exists public.creator_verifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'more_info')),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 120),
  date_of_birth date,
  document_type text check (document_type in ('aadhaar', 'pan', 'passport', 'driving_licence', 'voter_id')),
  -- Only ever the last four characters. The full number is not stored.
  document_number_last4 text check (document_number_last4 ~ '^[A-Za-z0-9]{4}$'),
  document_path text check (char_length(document_path) <= 500),
  address_line text check (char_length(address_line) <= 200),
  city text check (char_length(city) <= 80),
  state text check (char_length(state) <= 80),
  postal_code text check (postal_code ~ '^[0-9]{6}$'),
  note text check (char_length(note) <= 1000),
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open request per creator; history is kept for decided ones.
create unique index if not exists creator_verifications_open_idx
  on public.creator_verifications (creator_id)
  where status in ('pending', 'more_info');

create index if not exists creator_verifications_status_idx
  on public.creator_verifications (status, submitted_at desc);
create index if not exists creator_verifications_creator_idx
  on public.creator_verifications (creator_id, submitted_at desc);

comment on table public.creator_verifications is
  'Creator identity checks. Requested by the creator, decided by an admin. Holds no full document numbers.';
comment on column public.creator_verifications.document_number_last4 is
  'Last four characters only — the full document number is never stored.';

drop trigger if exists creator_verifications_touch on public.creator_verifications;
create trigger creator_verifications_touch
  before update on public.creator_verifications
  for each row execute function private.set_updated_at();

alter table public.creator_verifications enable row level security;

-- Creators read their own history; admins read everything. Nobody writes
-- through the API — both writes go through the SECURITY DEFINER RPCs below.
drop policy if exists "Creators read own verifications" on public.creator_verifications;
create policy "Creators read own verifications" on public.creator_verifications
  for select to authenticated
  using ((select private.owns_creator(creator_id)) or (select private.is_admin()));

grant select on public.creator_verifications to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Private bucket for identity documents
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-documents', 'verification-documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Files live under <creator_id>/…, so ownership is the first path segment.
drop policy if exists "Creators upload own verification documents" on storage.objects;
create policy "Creators upload own verification documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = (select private.my_creator_id())::text
  );

drop policy if exists "Verification documents are read by owner or admin" on storage.objects;
create policy "Verification documents are read by owner or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and ((storage.foldername(name))[1] = (select private.my_creator_id())::text or (select private.is_admin()))
  );

drop policy if exists "Creators delete own verification documents" on storage.objects;
create policy "Creators delete own verification documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = (select private.my_creator_id())::text
  );

-- -----------------------------------------------------------------------------
-- 3. Creator submits a verification request
-- -----------------------------------------------------------------------------
create or replace function public.request_creator_verification(
  p_legal_name text,
  p_document_type text default null,
  p_document_number_last4 text default null,
  p_document_path text default null,
  p_date_of_birth date default null,
  p_address_line text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null,
  p_note text default null
)
returns public.creator_verifications
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator public.creators;
  v_row public.creator_verifications;
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
  if exists (select 1 from public.creator_verifications
             where creator_id = v_creator.id and status = 'pending') then
    raise exception 'Your verification is already being reviewed.' using errcode = 'P0001', hint = 'VERIFICATION_PENDING';
  end if;

  -- A "more info" request is answered by updating it, not by stacking a new one.
  update public.creator_verifications
  set status = 'pending',
      legal_name = btrim(p_legal_name),
      date_of_birth = p_date_of_birth,
      document_type = p_document_type,
      document_number_last4 = upper(nullif(btrim(coalesce(p_document_number_last4, '')), '')),
      document_path = nullif(btrim(coalesce(p_document_path, '')), ''),
      address_line = nullif(btrim(coalesce(p_address_line, '')), ''),
      city = nullif(btrim(coalesce(p_city, '')), ''),
      state = nullif(btrim(coalesce(p_state, '')), ''),
      postal_code = nullif(btrim(coalesce(p_postal_code, '')), ''),
      note = nullif(btrim(coalesce(p_note, '')), ''),
      review_note = null,
      submitted_at = now()
  where creator_id = v_creator.id and status = 'more_info'
  returning * into v_row;

  if not found then
    insert into public.creator_verifications (
      creator_id, legal_name, date_of_birth, document_type, document_number_last4,
      document_path, address_line, city, state, postal_code, note
    ) values (
      v_creator.id, btrim(p_legal_name), p_date_of_birth, p_document_type,
      upper(nullif(btrim(coalesce(p_document_number_last4, '')), '')),
      nullif(btrim(coalesce(p_document_path, '')), ''),
      nullif(btrim(coalesce(p_address_line, '')), ''),
      nullif(btrim(coalesce(p_city, '')), ''),
      nullif(btrim(coalesce(p_state, '')), ''),
      nullif(btrim(coalesce(p_postal_code, '')), ''),
      nullif(btrim(coalesce(p_note, '')), '')
    )
    returning * into v_row;
  end if;

  perform private.notify_admins('creator_verification', 'Verification requested',
    format('%s asked to be verified.', v_creator.display_name), 'creator', v_creator.id,
    '/admin/creators/' || v_creator.id);
  perform private.notify(auth.uid(), 'verification_submitted', 'Verification submitted',
    'We are checking your details and will let you know shortly.', 'creator', v_creator.id, '/creator/profile');
  -- Metadata deliberately carries no identity details.
  perform private.audit('creator_verification_requested', 'creator', v_creator.id::text,
    jsonb_build_object('verification_id', v_row.id), auth.uid(), 'creator');
  return v_row;
end;
$$;

comment on function public.request_creator_verification is
  'Creator-initiated identity check. Re-submitting answers a "more info" request instead of stacking rows.';

-- -----------------------------------------------------------------------------
-- 4. Admin decides
-- -----------------------------------------------------------------------------
create or replace function public.admin_review_creator_verification(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns public.creator_verifications
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.creator_verifications;
  v_creator public.creators;
begin
  perform private.require_admin();
  if p_status not in ('approved', 'rejected', 'more_info') then
    raise exception 'Unknown verification decision: %', p_status using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;
  if p_status <> 'approved' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Tell the creator what is missing or wrong.' using errcode = 'P0001', hint = 'NOTE_REQUIRED';
  end if;

  update public.creator_verifications
  set status = p_status,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Verification request not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  select * into v_creator from public.creators where id = v_row.creator_id;

  if p_status = 'approved' then
    update public.creators set verified = true where id = v_row.creator_id;
    perform private.notify(v_creator.profile_id, 'creator_verified', 'You are verified',
      'Your verified badge is now on your storefront.', 'creator', v_creator.id, '/creator/profile');
  elsif p_status = 'rejected' then
    perform private.notify(v_creator.profile_id, 'verification_rejected', 'Verification was not approved',
      v_row.review_note, 'creator', v_creator.id, '/creator/profile');
  else
    perform private.notify(v_creator.profile_id, 'verification_more_info', 'We need a bit more for verification',
      v_row.review_note, 'creator', v_creator.id, '/creator/profile');
  end if;

  perform private.audit('creator_verification_reviewed', 'creator', v_creator.id::text,
    jsonb_build_object('verification_id', v_row.id, 'status', p_status), auth.uid(), 'admin');
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. One readiness read for every feature gate
-- -----------------------------------------------------------------------------
-- Facts only — which feature needs what is decided once in the application
-- (src/lib/feature-requirements.ts), so a gate never invents its own query.
create or replace function public.get_creator_requirements(p_creator_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_creator_id, private.my_creator_id());
  v_c public.creators;
  v_v public.creator_verifications;
  v_pm public.payout_methods;
begin
  select * into v_c from public.creators where id = v_id;
  if not found then
    return jsonb_build_object('creator_id', null);
  end if;
  if v_c.profile_id <> auth.uid() and not private.is_admin() then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;

  select * into v_v from public.creator_verifications
  where creator_id = v_id order by submitted_at desc limit 1;

  select * into v_pm from public.payout_methods where creator_id = v_id limit 1;

  return jsonb_build_object(
    'creator_id', v_c.id,
    'status', v_c.status,
    'verified', v_c.verified,
    'available', v_c.available,
    'completion', public.get_creator_completion(v_id),
    'services', jsonb_build_object(
      'total',  (select count(*) from public.creator_services s where s.creator_id = v_id and s.archived_at is null),
      'active', (select count(*) from public.creator_services s where s.creator_id = v_id and s.active and s.archived_at is null)),
    'addons', jsonb_build_object(
      'active', (select count(*) from public.service_addons a join public.creator_services s on s.id = a.service_id
                 where s.creator_id = v_id and a.active)),
    'portfolio', jsonb_build_object(
      'visible', (select count(*) from public.portfolio_items p where p.creator_id = v_id and not p.is_hidden)),
    -- Nothing identifying: whether a method exists and which kind, never the number.
    'payout', jsonb_build_object(
      'configured', v_pm.id is not null,
      'method_type', v_pm.method_type),
    'verification', case when v_v.id is null then jsonb_build_object('status', null)
      else jsonb_build_object(
        'id', v_v.id, 'status', v_v.status, 'submitted_at', v_v.submitted_at,
        'reviewed_at', v_v.reviewed_at, 'review_note', v_v.review_note) end,
    'analytics', jsonb_build_object(
      'accounts', (select count(*) from public.creator_social_accounts s where s.creator_id = v_id),
      'followers', v_c.followers_count,
      'engagement_rate', v_c.engagement_rate)
  );
end;
$$;

comment on function public.get_creator_requirements(uuid) is
  'Single source of truth for feature gates: what this creator has already provided.';

revoke execute on function public.get_creator_requirements(uuid) from anon;
grant execute on function public.get_creator_requirements(uuid) to authenticated;
revoke execute on function public.request_creator_verification(text, text, text, text, date, text, text, text, text, text) from anon;
grant execute on function public.request_creator_verification(text, text, text, text, date, text, text, text, text, text) to authenticated;
revoke execute on function public.admin_review_creator_verification(uuid, text, text) from anon;
grant execute on function public.admin_review_creator_verification(uuid, text, text) to authenticated;
