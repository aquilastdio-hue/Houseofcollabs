-- =============================================================================
-- House of Collabs · 0030 · anonymous brand / creator applications
-- =============================================================================
-- New front door: "Get started" asks whether you're a brand or a creator, then
-- opens the matching application form. No account, no OAuth — the submission
-- lands in the admin panel for review.
--
-- This sits alongside the existing authenticated signup/onboarding rather than
-- replacing it: approved applicants still get a real account, and existing
-- users still log in as before.
--
-- Modelled on public.contact_messages, which already takes anonymous input:
-- anon may INSERT and nothing else, admins are the only readers, and a BEFORE
-- INSERT trigger caps submissions per email and forces the server-owned
-- columns so a crafted request can't set its own status.
-- =============================================================================

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('brand', 'creator')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected')),

  -- ---- everyone ------------------------------------------------------------
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone text check (char_length(phone) <= 32),
  city text check (char_length(city) <= 80),
  message text check (char_length(message) <= 2000),

  -- ---- creators ------------------------------------------------------------
  social_platform text check (social_platform in ('instagram', 'youtube', 'x', 'threads', 'facebook', 'other')),
  social_handle text check (char_length(social_handle) <= 100),
  followers_count int check (followers_count between 0 and 2000000000),
  categories text[] check (coalesce(array_length(categories, 1), 0) <= 5),
  bio text check (char_length(bio) <= 2000),
  portfolio_url text check (char_length(portfolio_url) <= 500),
  -- Object path in the private `applications` bucket. Never a public URL.
  video_path text check (char_length(video_path) <= 500),

  -- ---- brands --------------------------------------------------------------
  brand_name text check (char_length(brand_name) <= 120),
  website text check (char_length(website) <= 500),
  budget_range text check (char_length(budget_range) <= 60),
  looking_for text check (char_length(looking_for) <= 2000),

  -- ---- review --------------------------------------------------------------
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications (status, created_at desc);
create index if not exists applications_role_idx on public.applications (role, created_at desc);
create index if not exists applications_email_idx on public.applications (lower(email));

comment on table public.applications is
  'Brand / creator applications submitted without an account. Anon may insert; only admins read.';
comment on column public.applications.video_path is
  'Object path in the private applications bucket — never a public URL.';

-- -----------------------------------------------------------------------------
-- Abuse guard + server-owned columns
-- -----------------------------------------------------------------------------
create or replace function private.applications_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.applications a
      where lower(a.email) = lower(new.email) and a.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already applied. We will be in touch shortly.'
      using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  -- Never client-settable, whatever the request body says.
  new.status := 'new';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists applications_before_insert on public.applications;
create trigger applications_before_insert
  before insert on public.applications
  for each row execute function private.applications_before_insert();

/** Tells the team a new application is waiting, without echoing its contents. */
create or replace function private.applications_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.notify_admins(
    'application_received',
    format('New %s application', new.role),
    format('%s applied to join as a %s.', new.full_name, new.role),
    'application', new.id, '/admin/applications');
  return null;
end;
$$;

drop trigger if exists applications_after_insert on public.applications;
create trigger applications_after_insert
  after insert on public.applications
  for each row execute function private.applications_after_insert();

-- -----------------------------------------------------------------------------
-- RLS: write-only for the public, read for admins
-- -----------------------------------------------------------------------------
alter table public.applications enable row level security;

drop policy if exists "Anyone can apply" on public.applications;
create policy "Anyone can apply" on public.applications
  for insert to anon, authenticated
  with check (true);

drop policy if exists "Admins read applications" on public.applications;
create policy "Admins read applications" on public.applications
  for select to authenticated
  using ((select private.is_admin()));

-- Only the columns an applicant fills in. status/review_* stay server-owned,
-- and the trigger overwrites them regardless.
grant insert (
  role, full_name, email, phone, city, message,
  social_platform, social_handle, followers_count, categories, bio, portfolio_url, video_path,
  brand_name, website, budget_range, looking_for
) on public.applications to anon, authenticated;
grant select on public.applications to authenticated;

-- -----------------------------------------------------------------------------
-- Private bucket for application videos
-- -----------------------------------------------------------------------------
-- Capped well below the portfolio bucket: this accepts uploads from anyone, so
-- the ceiling is deliberately low.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applications', 'applications', false, 20971520,
        array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "Anyone can upload an application file" on storage.objects;
create policy "Anyone can upload an application file" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'applications');

drop policy if exists "Only admins read application files" on storage.objects;
create policy "Only admins read application files" on storage.objects
  for select to authenticated
  using (bucket_id = 'applications' and (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Admin review
-- -----------------------------------------------------------------------------
create or replace function public.admin_review_application(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.applications;
begin
  perform private.require_admin();
  if p_status not in ('new', 'reviewing', 'approved', 'rejected') then
    raise exception 'Unknown application status: %', p_status using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;

  update public.applications
  set status = p_status,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  perform private.audit('application_reviewed', 'application', v_row.id::text,
    jsonb_build_object('status', p_status, 'role', v_row.role), auth.uid(), 'admin');
  return v_row;
end;
$$;

/** Counters for the admin applications queue. */
create or replace function public.admin_application_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'total',     (select count(*) from public.applications),
    'new',       (select count(*) from public.applications where status = 'new'),
    'reviewing', (select count(*) from public.applications where status = 'reviewing'),
    'approved',  (select count(*) from public.applications where status = 'approved'),
    'rejected',  (select count(*) from public.applications where status = 'rejected'),
    'creators',  (select count(*) from public.applications where role = 'creator'),
    'brands',    (select count(*) from public.applications where role = 'brand'),
    'new_7d',    (select count(*) from public.applications where created_at > now() - interval '7 days')
  );
end;
$$;

revoke execute on function public.admin_review_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_application(uuid, text, text) to authenticated;
revoke execute on function public.admin_application_stats() from public, anon;
grant execute on function public.admin_application_stats() to authenticated;
