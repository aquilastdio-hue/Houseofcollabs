-- 0019 - Campaigns: brands post open calls, admins approve, creators apply
--
-- A brand writes a campaign (brief, deliverables, payment, how many creators,
-- who it's for) and submits it. Nothing is visible to creators until an admin
-- approves it. Once live, every live creator sees it on Creator -> Campaigns
-- with how well they match the requirements, and can apply with a short pitch.
-- Creators the brand invited get a notification and an "Invited" tag. The
-- brand accepts or rejects applicants; both sides are notified. Payment for
-- accepted creators happens outside the platform for now.
--
--   draft -> pending_review -> live -> closed
--                           \-> rejected -> (edit) draft -> pending_review ...
--
-- Every write goes through the functions below, which check who is asking;
-- the tables only grant SELECT, filtered by RLS.

begin;

do $$
begin
  create type public.campaign_status as enum ('draft', 'pending_review', 'live', 'rejected', 'closed');
exception when duplicate_object then null;
end;
$$;

-- ------------------------------------------------------------------ tables --

create table if not exists public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 3 and 140),
  brief            text not null check (char_length(btrim(brief)) between 20 and 5000),
  deliverables     text not null check (char_length(btrim(deliverables)) between 3 and 2000),
  platforms        text[] not null default '{}' check (cardinality(platforms) <= 5),
  reference_links  text[] not null default '{}' check (cardinality(reference_links) <= 10),
  -- 'paid' (fee per creator), 'barter' (product), or 'both'.
  compensation     text not null check (compensation in ('paid', 'barter', 'both')),
  fee_per_creator  numeric(12, 2) check (fee_per_creator is null or fee_per_creator >= 0),
  barter_details   text check (char_length(barter_details) <= 1000),
  creators_needed  int not null default 1 check (creators_needed between 1 and 500),
  -- Requirements. Empty means "anyone".
  category_ids     uuid[] not null default '{}' check (cardinality(category_ids) <= 20),
  min_followers    int check (min_followers is null or min_followers >= 0),
  max_followers    int check (max_followers is null or max_followers >= 0),
  cities           text[] not null default '{}' check (cardinality(cities) <= 20),
  apply_by         date,
  status           public.campaign_status not null default 'draft',
  -- Admin's reason when a campaign is sent back; cleared on resubmit/approve.
  review_note      text check (char_length(review_note) <= 1000),
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint campaigns_paid_needs_fee check (compensation = 'barter' or fee_per_creator is not null),
  constraint campaigns_barter_needs_details check (compensation = 'paid' or nullif(btrim(coalesce(barter_details, '')), '') is not null),
  constraint campaigns_follower_range check (min_followers is null or max_followers is null or max_followers >= min_followers)
);

create index if not exists campaigns_status_idx on public.campaigns (status, created_at desc);
create index if not exists campaigns_brand_idx on public.campaigns (brand_id, created_at desc);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

create table if not exists public.campaign_invites (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id  uuid not null references public.creators (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);

create index if not exists campaign_invites_creator_idx on public.campaign_invites (creator_id);

create table if not exists public.campaign_applications (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  creator_id    uuid not null references public.creators (id) on delete cascade,
  pitch         text not null check (char_length(btrim(pitch)) between 20 and 2000),
  proposed_fee  numeric(12, 2) check (proposed_fee is null or proposed_fee >= 0),
  sample_url    text check (sample_url is null or sample_url ~* '^https?://[^\s]+$'),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  brand_note    text check (char_length(brand_note) <= 1000),
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index if not exists campaign_applications_creator_idx on public.campaign_applications (creator_id, created_at desc);

drop trigger if exists campaign_applications_set_updated_at on public.campaign_applications;
create trigger campaign_applications_set_updated_at before update on public.campaign_applications
  for each row execute function private.set_updated_at();

-- --------------------------------------------------------------------- RLS --
-- The cross-table checks run through security-definer helpers: a policy on
-- campaigns reading campaign_applications (whose policy reads campaigns)
-- would otherwise recurse.

create or replace function private.owns_campaign(p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.campaigns c where c.id = p_campaign_id and c.brand_id = private.my_brand_id());
$$;

create or replace function private.applied_to_campaign(p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.campaign_applications a
                 where a.campaign_id = p_campaign_id and a.creator_id = private.my_creator_id());
$$;

grant execute on function private.owns_campaign(uuid), private.applied_to_campaign(uuid) to authenticated;
revoke execute on function private.owns_campaign(uuid), private.applied_to_campaign(uuid) from public, anon;

alter table public.campaigns enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.campaign_applications enable row level security;

drop policy if exists "Campaigns: owner, admins, creators when live or applied" on public.campaigns;
create policy "Campaigns: owner, admins, creators when live or applied" on public.campaigns
  for select to authenticated
  using (
    brand_id = (select private.my_brand_id())
    or (select private.is_admin())
    or (status = 'live' and (select private.my_creator_id()) is not null)
    or private.applied_to_campaign(id)
  );

drop policy if exists "Campaign invites: brand, invited creator, admins" on public.campaign_invites;
create policy "Campaign invites: brand, invited creator, admins" on public.campaign_invites
  for select to authenticated
  using (
    creator_id = (select private.my_creator_id())
    or (select private.is_admin())
    or private.owns_campaign(campaign_id)
  );

drop policy if exists "Campaign applications: applicant, brand, admins" on public.campaign_applications;
create policy "Campaign applications: applicant, brand, admins" on public.campaign_applications
  for select to authenticated
  using (
    creator_id = (select private.my_creator_id())
    or (select private.is_admin())
    or private.owns_campaign(campaign_id)
  );

revoke all on public.campaigns, public.campaign_invites, public.campaign_applications from anon, authenticated;
grant select on public.campaigns, public.campaign_invites, public.campaign_applications to authenticated;
grant all on public.campaigns, public.campaign_invites, public.campaign_applications to service_role;

-- ----------------------------------------------------------------- helpers --

-- How a creator measures up against a campaign's requirements.
create or replace function private.campaign_match(p_campaign public.campaigns, p_creator_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object('category', m.category, 'followers', m.followers, 'city', m.city,
                            'matches', m.category and m.followers and m.city)
  from (
    select
      cardinality(p_campaign.category_ids) = 0
        or exists (select 1 from public.creator_categories cc
                   where cc.creator_id = cr.id and cc.category_id = any(p_campaign.category_ids)) as category,
      (p_campaign.min_followers is null or coalesce(cr.followers_count, 0) >= p_campaign.min_followers)
        and (p_campaign.max_followers is null or coalesce(cr.followers_count, 0) <= p_campaign.max_followers) as followers,
      cardinality(p_campaign.cities) = 0
        or exists (select 1 from unnest(p_campaign.cities) x
                   where lower(btrim(x)) = lower(btrim(coalesce(cr.city, '')))) as city
    from public.creators cr
    where cr.id = p_creator_id
  ) m;
$$;

-- A campaign as the app shows it: the row, its brand, category names, counts.
create or replace function private.campaign_json(p public.campaigns)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select (to_jsonb(p) - 'reviewed_by') || jsonb_build_object(
    'brand', (select jsonb_build_object('id', b.id, 'name', b.brand_name, 'logo', b.brand_logo_url, 'website', b.website_url)
              from public.brands b where b.id = p.brand_id),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name)
                            from public.categories c where c.id = any(p.category_ids)), '[]'::jsonb),
    'applications', (select jsonb_build_object(
                       'total',    count(*) filter (where a.status <> 'withdrawn'),
                       'pending',  count(*) filter (where a.status = 'pending'),
                       'accepted', count(*) filter (where a.status = 'accepted'))
                     from public.campaign_applications a where a.campaign_id = p.id)
  );
$$;

-- What a creator sees: no admin notes, plus their match, invite and application.
create or replace function private.campaign_for_creator(p public.campaigns, p_creator_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select (private.campaign_json(p) - 'review_note') || jsonb_build_object(
    'invited', exists (select 1 from public.campaign_invites i where i.campaign_id = p.id and i.creator_id = p_creator_id),
    'match', private.campaign_match(p, p_creator_id),
    'my_application', (select jsonb_build_object('id', a.id, 'status', a.status, 'pitch', a.pitch,
                                                 'proposed_fee', a.proposed_fee, 'sample_url', a.sample_url,
                                                 'brand_note', a.brand_note, 'created_at', a.created_at)
                       from public.campaign_applications a
                       where a.campaign_id = p.id and a.creator_id = p_creator_id)
  );
$$;

revoke execute on function private.campaign_match(public.campaigns, uuid) from public, anon, authenticated;
revoke execute on function private.campaign_json(public.campaigns) from public, anon, authenticated;
revoke execute on function private.campaign_for_creator(public.campaigns, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------- reads --

-- Creator -> Campaigns: everything live and still open, plus anything they applied to.
create or replace function public.creator_campaigns()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_creator uuid := private.my_creator_id();
begin
  if v_creator is null then
    raise exception 'Only creators can view campaigns.' using errcode = '42501', hint = 'CREATOR_REQUIRED';
  end if;
  return coalesce((
    select jsonb_agg(x.item order by (x.item ->> 'invited')::boolean desc, x.created_at desc)
    from (
      select private.campaign_for_creator(c, v_creator) as item, c.created_at
      from public.campaigns c
      where (c.status = 'live' and (c.apply_by is null or c.apply_by >= current_date))
         or exists (select 1 from public.campaign_applications a where a.campaign_id = c.id and a.creator_id = v_creator)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- One campaign, shaped for whoever is asking.
create or replace function public.campaign_detail(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_c public.campaigns;
  v_creator uuid := private.my_creator_id();
  v_brand uuid := private.my_brand_id();
  v_admin boolean := private.is_admin();
begin
  select * into v_c from public.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  if v_c.brand_id = v_brand or v_admin then
    return private.campaign_json(v_c) || jsonb_build_object(
      'viewer', case when v_c.brand_id = v_brand then 'brand' else 'admin' end,
      'invites', coalesce((
        select jsonb_agg(jsonb_build_object('id', cr.id, 'name', cr.display_name, 'slug', cr.slug,
                                            'photo', cr.profile_image_url, 'city', cr.city, 'followers', cr.followers_count)
                         order by cr.display_name)
        from public.campaign_invites i join public.creators cr on cr.id = i.creator_id
        where i.campaign_id = v_c.id), '[]'::jsonb)
    );
  end if;

  if v_creator is not null and (
       v_c.status = 'live'
       or exists (select 1 from public.campaign_applications a where a.campaign_id = v_c.id and a.creator_id = v_creator)) then
    return private.campaign_for_creator(v_c, v_creator) || jsonb_build_object('viewer', 'creator');
  end if;

  raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
end;
$$;

-- Brand -> Campaigns.
create or replace function public.brand_campaigns()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_brand uuid := private.my_brand_id();
begin
  if v_brand is null then
    raise exception 'Only brands can view their campaigns.' using errcode = '42501', hint = 'BRAND_REQUIRED';
  end if;
  return coalesce((select jsonb_agg(private.campaign_json(c) order by c.created_at desc)
                   from public.campaigns c where c.brand_id = v_brand), '[]'::jsonb);
end;
$$;

-- Applicants for a campaign (its brand, or an admin), pending first.
create or replace function public.campaign_applicants(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_c public.campaigns;
begin
  select * into v_c from public.campaigns where id = p_campaign_id;
  if not found or not (v_c.brand_id = private.my_brand_id() or private.is_admin()) then
    raise exception 'Campaign not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'status', a.status, 'pitch', a.pitch, 'proposed_fee', a.proposed_fee,
             'sample_url', a.sample_url, 'brand_note', a.brand_note, 'created_at', a.created_at, 'decided_at', a.decided_at,
             'invited', exists (select 1 from public.campaign_invites i where i.campaign_id = v_c.id and i.creator_id = cr.id),
             'match', private.campaign_match(v_c, cr.id),
             'creator', jsonb_build_object(
               'id', cr.id, 'name', cr.display_name, 'slug', cr.slug, 'photo', cr.profile_image_url,
               'city', cr.city, 'followers', cr.followers_count,
               'categories', coalesce((select jsonb_agg(cat.name order by cc.is_primary desc, cat.name)
                                       from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                                       where cc.creator_id = cr.id), '[]'::jsonb)))
           order by (a.status = 'pending') desc, a.created_at desc)
    from public.campaign_applications a
    join public.creators cr on cr.id = a.creator_id
    where a.campaign_id = v_c.id and a.status <> 'withdrawn'
  ), '[]'::jsonb);
end;
$$;

-- Admin -> Campaigns: waiting for review first.
create or replace function public.admin_list_campaigns(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(private.campaign_json(c)
                     order by (c.status = 'pending_review') desc, coalesce(c.submitted_at, c.created_at) desc)
    from public.campaigns c
    where (nullif(p_status, '') is null or c.status::text = p_status)
      and c.status <> 'draft'
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------ brand writes --

-- Create (no id) or update a draft / sent-back campaign. Returns its id.
create or replace function public.save_campaign(p_campaign_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_brand uuid := private.my_brand_id();
  v_id uuid;
  v_categories uuid[] := coalesce((select array_agg(distinct x::uuid) from jsonb_array_elements_text(coalesce(p_data -> 'category_ids', '[]')) x), '{}');
  v_cities text[] := coalesce((select array_agg(distinct btrim(x)) from jsonb_array_elements_text(coalesce(p_data -> 'cities', '[]')) x where btrim(x) <> ''), '{}');
  v_platforms text[] := coalesce((select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(coalesce(p_data -> 'platforms', '[]')) x where btrim(x) <> ''), '{}');
  v_links text[] := coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(p_data -> 'reference_links', '[]')) x where btrim(x) <> ''), '{}');
  v_comp text := p_data ->> 'compensation';
begin
  if v_brand is null then
    raise exception 'Only brands can create campaigns.' using errcode = '42501', hint = 'BRAND_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if exists (select 1 from unnest(v_links) l where l !~* '^https?://[^\s]+$') then
    raise exception 'Reference links must start with https://' using errcode = 'P0001', hint = 'INVALID_LINK';
  end if;

  if p_campaign_id is null then
    insert into public.campaigns (brand_id, title, brief, deliverables, platforms, reference_links, compensation,
                                  fee_per_creator, barter_details, creators_needed, category_ids, min_followers,
                                  max_followers, cities, apply_by)
    values (v_brand, btrim(p_data ->> 'title'), btrim(p_data ->> 'brief'), btrim(p_data ->> 'deliverables'), v_platforms, v_links, v_comp,
            case when v_comp in ('paid', 'both') then (p_data ->> 'fee_per_creator')::numeric end,
            case when v_comp in ('barter', 'both') then nullif(btrim(p_data ->> 'barter_details'), '') end,
            coalesce((p_data ->> 'creators_needed')::int, 1), v_categories,
            (p_data ->> 'min_followers')::int, (p_data ->> 'max_followers')::int, v_cities,
            (p_data ->> 'apply_by')::date)
    returning id into v_id;
  else
    update public.campaigns c
    set title = btrim(p_data ->> 'title'), brief = btrim(p_data ->> 'brief'), deliverables = btrim(p_data ->> 'deliverables'),
        platforms = v_platforms, reference_links = v_links, compensation = v_comp,
        fee_per_creator = case when v_comp in ('paid', 'both') then (p_data ->> 'fee_per_creator')::numeric end,
        barter_details = case when v_comp in ('barter', 'both') then nullif(btrim(p_data ->> 'barter_details'), '') end,
        creators_needed = coalesce((p_data ->> 'creators_needed')::int, 1), category_ids = v_categories,
        min_followers = (p_data ->> 'min_followers')::int, max_followers = (p_data ->> 'max_followers')::int,
        cities = v_cities, apply_by = (p_data ->> 'apply_by')::date,
        -- Editing a sent-back campaign makes it a draft again; the note stays until resubmitted.
        status = 'draft'
    where c.id = p_campaign_id and c.brand_id = v_brand and c.status in ('draft', 'rejected')
    returning c.id into v_id;
    if v_id is null then
      raise exception 'Only drafts and campaigns sent back for changes can be edited.' using errcode = 'P0001', hint = 'NOT_EDITABLE';
    end if;
  end if;

  if p_data ? 'invite_creator_ids' then
    delete from public.campaign_invites where campaign_id = v_id;
    insert into public.campaign_invites (campaign_id, creator_id)
    select v_id, cr.id
    from public.creators cr
    where cr.id in (select x::uuid from jsonb_array_elements_text(p_data -> 'invite_creator_ids') x limit 50)
      and cr.status = 'published' and cr.deleted_at is null
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

create or replace function public.submit_campaign(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_c public.campaigns;
  v_brand_name text;
begin
  update public.campaigns c
  set status = 'pending_review', submitted_at = now(), review_note = null
  where c.id = p_campaign_id and c.brand_id = private.my_brand_id() and c.status in ('draft', 'rejected')
  returning * into v_c;
  if not found then
    raise exception 'Only drafts and campaigns sent back for changes can be submitted.' using errcode = 'P0001', hint = 'NOT_SUBMITTABLE';
  end if;
  if v_c.apply_by is not null and v_c.apply_by < current_date then
    raise exception 'The "apply by" date has passed. Choose a later date.' using errcode = 'P0001', hint = 'APPLY_BY_PASSED';
  end if;
  select b.brand_name into v_brand_name from public.brands b where b.id = v_c.brand_id;
  perform private.notify_admins('campaign_review', 'Campaign awaiting review',
    format('%s submitted "%s" for review.', v_brand_name, v_c.title), 'campaign', v_c.id, '/admin/campaigns/' || v_c.id);
  return v_c;
end;
$$;

create or replace function public.close_campaign(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_c public.campaigns;
begin
  update public.campaigns c
  set status = 'closed', closed_at = now()
  where c.id = p_campaign_id and c.status = 'live'
    and (c.brand_id = private.my_brand_id() or private.is_admin())
  returning * into v_c;
  if not found then
    raise exception 'Only live campaigns can be closed.' using errcode = 'P0001', hint = 'NOT_LIVE';
  end if;
  return v_c;
end;
$$;

create or replace function public.delete_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  delete from public.campaigns c
  where c.id = p_campaign_id and c.brand_id = private.my_brand_id() and c.status in ('draft', 'rejected');
  if not found then
    raise exception 'Only drafts and campaigns sent back for changes can be deleted.' using errcode = 'P0001', hint = 'NOT_DELETABLE';
  end if;
end;
$$;

-- Brand accepts or rejects one applicant.
create or replace function public.decide_campaign_application(p_application_id uuid, p_accept boolean, p_note text default null)
returns public.campaign_applications
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_a public.campaign_applications;
  v_c public.campaigns;
  v_brand_name text;
  v_creator_profile uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select a.* into v_a from public.campaign_applications a
  join public.campaigns c on c.id = a.campaign_id
  where a.id = p_application_id and c.brand_id = private.my_brand_id();
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if v_a.status <> 'pending' then
    raise exception 'This application has already been answered.' using errcode = 'P0001', hint = 'ALREADY_DECIDED';
  end if;

  update public.campaign_applications
  set status = case when p_accept then 'accepted' else 'rejected' end, brand_note = v_note, decided_at = now()
  where id = v_a.id
  returning * into v_a;

  select * into v_c from public.campaigns where id = v_a.campaign_id;
  select b.brand_name into v_brand_name from public.brands b where b.id = v_c.brand_id;
  select cr.profile_id into v_creator_profile from public.creators cr where cr.id = v_a.creator_id;

  if p_accept then
    perform private.notify(v_creator_profile, 'campaign_accepted', format('You’re in: %s', v_c.title),
      format('%s accepted your application.%s', v_brand_name, coalesce(' Note: ' || v_note, '')),
      'campaign', v_c.id, '/creator/campaigns/' || v_c.id);
  else
    perform private.notify(v_creator_profile, 'campaign_declined', format('Application update: %s', v_c.title),
      coalesce(v_note, format('%s went with other creators this time.', v_brand_name)),
      'campaign', v_c.id, '/creator/campaigns/' || v_c.id);
  end if;
  return v_a;
end;
$$;

-- ---------------------------------------------------------- creator writes --

create or replace function public.apply_to_campaign(p_campaign_id uuid, p_pitch text, p_proposed_fee numeric default null, p_sample_url text default null)
returns public.campaign_applications
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_creator public.creators;
  v_c public.campaigns;
  v_a public.campaign_applications;
  v_brand_profile uuid;
begin
  select * into v_creator from public.creators where id = private.my_creator_id();
  if not found then
    raise exception 'Only creators can apply to campaigns.' using errcode = '42501', hint = 'CREATOR_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if v_creator.status <> 'published' or v_creator.deleted_at is not null then
    raise exception 'Your profile needs to be live before you can apply.' using errcode = 'P0001', hint = 'PROFILE_NOT_LIVE';
  end if;

  select * into v_c from public.campaigns where id = p_campaign_id;
  if not found or v_c.status <> 'live' or (v_c.apply_by is not null and v_c.apply_by < current_date) then
    raise exception 'This campaign isn’t taking applications.' using errcode = 'P0001', hint = 'NOT_OPEN';
  end if;

  insert into public.campaign_applications as a (campaign_id, creator_id, pitch, proposed_fee, sample_url)
  values (v_c.id, v_creator.id, btrim(p_pitch), p_proposed_fee, nullif(btrim(coalesce(p_sample_url, '')), ''))
  on conflict (campaign_id, creator_id) do update
    set pitch = excluded.pitch, proposed_fee = excluded.proposed_fee, sample_url = excluded.sample_url,
        status = 'pending', brand_note = null, decided_at = null
    where a.status = 'withdrawn'
  returning * into v_a;
  if v_a.id is null then
    raise exception 'You’ve already applied to this campaign.' using errcode = 'P0001', hint = 'ALREADY_APPLIED';
  end if;

  select b.profile_id into v_brand_profile from public.brands b where b.id = v_c.brand_id;
  perform private.notify(v_brand_profile, 'campaign_application', format('New application: %s', v_c.title),
    format('%s applied to your campaign.', v_creator.display_name), 'campaign', v_c.id, '/brand/campaigns/' || v_c.id);
  return v_a;
end;
$$;

create or replace function public.withdraw_campaign_application(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.campaign_applications a
  set status = 'withdrawn'
  where a.campaign_id = p_campaign_id and a.creator_id = private.my_creator_id() and a.status = 'pending';
  if not found then
    raise exception 'Only a pending application can be withdrawn.' using errcode = 'P0001', hint = 'NOT_PENDING';
  end if;
end;
$$;

-- ------------------------------------------------------------ admin writes --

create or replace function public.admin_review_campaign(p_campaign_id uuid, p_approve boolean, p_note text default null)
returns public.campaigns
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c public.campaigns;
  v_brand public.brands;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not p_approve and v_note is null then
    raise exception 'Tell the brand what to change.' using errcode = 'P0001', hint = 'NOTE_REQUIRED';
  end if;

  update public.campaigns c
  set status = case when p_approve then 'live' else 'rejected' end::public.campaign_status,
      review_note = case when p_approve then null else v_note end,
      reviewed_at = now(), reviewed_by = v_admin
  where c.id = p_campaign_id and c.status = 'pending_review'
  returning * into v_c;
  if not found then
    raise exception 'Only campaigns waiting for review can be approved or sent back.' using errcode = 'P0001', hint = 'NOT_PENDING';
  end if;

  select * into v_brand from public.brands where id = v_c.brand_id;
  if p_approve then
    perform private.notify(v_brand.profile_id, 'campaign_approved', 'Your campaign is live',
      format('"%s" was approved. Creators can now see it and apply.', v_c.title), 'campaign', v_c.id, '/brand/campaigns/' || v_c.id);
    perform private.notify(cr.profile_id, 'campaign_invite', format('%s invited you to a campaign', v_brand.brand_name),
      v_c.title, 'campaign', v_c.id, '/creator/campaigns/' || v_c.id)
    from public.campaign_invites i join public.creators cr on cr.id = i.creator_id
    where i.campaign_id = v_c.id and cr.status = 'published' and cr.deleted_at is null;
  else
    perform private.notify(v_brand.profile_id, 'campaign_rejected', 'Your campaign needs changes', v_note,
      'campaign', v_c.id, '/brand/campaigns/' || v_c.id);
  end if;

  perform private.audit('campaign_reviewed', 'campaign', v_c.id::text,
    jsonb_build_object('approved', p_approve, 'note', v_note), v_admin, 'admin');
  return v_c;
end;
$$;

-- -------------------------------------------------------------- privileges --

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.creator_campaigns()', 'public.campaign_detail(uuid)', 'public.brand_campaigns()',
    'public.campaign_applicants(uuid)', 'public.admin_list_campaigns(text)', 'public.save_campaign(uuid, jsonb)',
    'public.submit_campaign(uuid)', 'public.close_campaign(uuid)', 'public.delete_campaign(uuid)',
    'public.decide_campaign_application(uuid, boolean, text)', 'public.apply_to_campaign(uuid, text, numeric, text)',
    'public.withdraw_campaign_application(uuid)', 'public.admin_review_campaign(uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Campaign emails go in the "campaigns" category, like briefs.
CREATE OR REPLACE FUNCTION private.email_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('payment_failed', 'payout_failed', 'refund_processed',
                    'account_suspended', 'account_reactivated', 'profile_suspended',
                    'order_cancelled', 'order_expired')
      then 'critical'
    when p_type in ('order_new', 'order_accepted', 'order_approved', 'order_completed',
                    'order_in_progress', 'content_delivered', 'revision_requested',
                    'revision_submitted', 'shipment_required', 'shipment_update',
                    'review_received')
      then 'orders'
    when p_type in ('payment_received', 'earnings_available', 'payout_requested',
                    'payout_processed')
      then 'payments'
    when p_type in ('brief_received', 'campaign_review', 'campaign_approved', 'campaign_rejected',
                    'campaign_invite', 'campaign_application', 'campaign_accepted', 'campaign_declined')
      then 'campaigns'
    when p_type in ('welcome', 'onboarding_completed', 'profile_submitted',
                    'profile_approved', 'profile_rejected', 'creator_verified')
      then 'account'
    when p_type in ('announcement')
      then 'marketing'
    else 'account'
  end;
$function$;

commit;
