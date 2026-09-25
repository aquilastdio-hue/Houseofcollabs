-- =============================================================================
-- House of Collabs · 0042 · admin rating, and the order creators appear in
-- =============================================================================
-- An admin rates a creator while reviewing their application. That rating
-- decides where the creator sits on the public creators page — highest first —
-- and an admin can also pin one profile above everything else.
--
-- The creator must never see their own rating, and neither must anyone else.
-- That is why this is a separate table rather than columns on `creators`:
-- `grant select on public.creators to anon, authenticated` is table-wide, so a
-- column added there is readable by the whole internet the moment it exists.
-- A table with no grants at all cannot be read through PostgREST by anybody,
-- whatever a future migration does to `creators`.
--
-- `search_creators` is SECURITY DEFINER, so it can order by these values without
-- returning them — the ordering is visible, the numbers are not.
-- =============================================================================

create table if not exists public.creator_rankings (
  creator_id uuid primary key references public.creators (id) on delete cascade,
  -- 1-5, matching the star scale used everywhere else in the product. Null
  -- means "not yet rated", which sorts below every rated creator.
  admin_rating smallint check (admin_rating between 1 and 5),
  -- Set by "Send on top". The most recently pinned profile leads, so pinning a
  -- second one doesn't silently fight with the first.
  pinned_at timestamptz,
  note text check (char_length(note) <= 500),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists creator_rankings_order_idx
  on public.creator_rankings (pinned_at desc nulls last, admin_rating desc nulls last);

comment on table public.creator_rankings is
  'Admin-only ranking for the public creators page. No grants: readable solely through admin RPCs.';
comment on column public.creator_rankings.admin_rating is
  'Admin''s own 1-5 rating. Never shown to the creator or to brands.';
comment on column public.creator_rankings.pinned_at is
  '"Send on top" — overrides rating order. Most recent pin leads.';

alter table public.creator_rankings enable row level security;

-- Belt and braces. Postgres grants EXECUTE/ALL to PUBLIC by default on some
-- object kinds, and `revoke ... from anon, authenticated` alone would leave that
-- in place — the same trap as migrations 0023 and 0031.
revoke all on public.creator_rankings from public, anon, authenticated;

drop trigger if exists creator_rankings_set_updated_at on public.creator_rankings;
create trigger creator_rankings_set_updated_at
  before update on public.creator_rankings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- The rating starts life on the application, where the review happens.
-- -----------------------------------------------------------------------------
alter table public.applications
  add column if not exists admin_rating smallint check (admin_rating between 1 and 5);

comment on column public.applications.admin_rating is
  'Admin''s 1-5 rating, given at review. Copied into creator_rankings on approval.';

-- Applicants may write their own columns only; this is not one of them, and the
-- grant in 0031 is an explicit allow-list, so nothing more is needed there.

create or replace function public.admin_rate_application(p_id uuid, p_rating smallint)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.applications;
begin
  perform private.require_admin();
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.' using errcode = 'P0001', hint = 'INVALID_RATING';
  end if;

  update public.applications set admin_rating = p_rating where id = p_id returning * into v_row;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  -- Already approved? Keep the creator's ranking in step.
  if v_row.profile_id is not null then
    update public.creator_rankings r
    set admin_rating = p_rating, updated_by = auth.uid()
    from public.creators c
    where c.profile_id = v_row.profile_id and r.creator_id = c.id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.admin_rate_application(uuid, smallint) from public, anon;
grant execute on function public.admin_rate_application(uuid, smallint) to authenticated;

-- -----------------------------------------------------------------------------
-- Rating and pinning from the ranking screen itself.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_creator_rating(p_creator_id uuid, p_rating smallint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5.' using errcode = 'P0001', hint = 'INVALID_RATING';
  end if;
  if not exists (select 1 from public.creators where id = p_creator_id) then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  insert into public.creator_rankings (creator_id, admin_rating, updated_by)
  values (p_creator_id, p_rating, auth.uid())
  on conflict (creator_id) do update set admin_rating = excluded.admin_rating, updated_by = excluded.updated_by;

  perform private.audit('creator_rated', 'creator', p_creator_id::text,
    jsonb_build_object('rating', p_rating), auth.uid(), 'admin');
end;
$$;

revoke execute on function public.admin_set_creator_rating(uuid, smallint) from public, anon;
grant execute on function public.admin_set_creator_rating(uuid, smallint) to authenticated;

/** "Send on top" / undo. Pinning is a timestamp so repeated pins stay ordered. */
create or replace function public.admin_pin_creator(p_creator_id uuid, p_pinned boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.creators where id = p_creator_id) then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;

  insert into public.creator_rankings (creator_id, pinned_at, updated_by)
  values (p_creator_id, case when p_pinned then now() end, auth.uid())
  on conflict (creator_id) do update
    set pinned_at = case when p_pinned then now() end, updated_by = excluded.updated_by;

  perform private.audit(case when p_pinned then 'creator_pinned' else 'creator_unpinned' end,
    'creator', p_creator_id::text, '{}'::jsonb, auth.uid(), 'admin');
end;
$$;

revoke execute on function public.admin_pin_creator(uuid, boolean) from public, anon;
grant execute on function public.admin_pin_creator(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- The ranking screen: the same order the public page uses, with the numbers
-- behind it. Admin-only, which is the only way these values are ever readable.
-- -----------------------------------------------------------------------------
create or replace function public.admin_creator_rankings(
  p_search text default null,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  display_name text,
  profile_image_url text,
  city text,
  status public.creator_status,
  verified boolean,
  featured boolean,
  followers_count int,
  rating numeric,
  review_count int,
  admin_rating smallint,
  pinned_at timestamptz,
  rank_position bigint,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(btrim(p_search), '');
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform private.require_admin();

  return query
  with ranked as (
    select
      c.id, c.slug, c.display_name, c.profile_image_url, c.city, c.status,
      c.verified, c.featured, c.followers_count, c.rating, c.review_count,
      r.admin_rating, r.pinned_at,
      -- Mirrors the public page's default order exactly, so what an admin sees
      -- here is the order a visitor gets.
      row_number() over (
        order by r.pinned_at desc nulls last,
                 r.admin_rating desc nulls last,
                 c.featured desc, c.verified desc, c.rating desc,
                 c.review_count desc, c.followers_count desc, c.id
      ) as rank_position,
      count(*) over () as total_count
    from public.creators c
    left join public.creator_rankings r on r.creator_id = c.id
    where c.deleted_at is null
      and (nullif(btrim(p_status), '') is null or c.status::text = p_status)
      and (v_q is null
           or c.display_name ilike '%' || private.like_escape(v_q) || '%'
           or c.city ilike '%' || private.like_escape(v_q) || '%')
  )
  select * from ranked order by ranked.rank_position limit v_limit offset v_offset;
end;
$$;

revoke execute on function public.admin_creator_rankings(text, text, int, int) from public, anon;
grant execute on function public.admin_creator_rankings(text, text, int, int) to authenticated;

-- -----------------------------------------------------------------------------
-- Approval carries the rating across to the creator that gets created.
-- -----------------------------------------------------------------------------
create or replace function private.apply_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_actor_role public.actor_role default 'system'
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.applications;
  v_creator_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002', hint = 'PROFILE_NOT_FOUND';
  end if;

  update public.profiles
  set role = v_app.role::public.user_role,
      onboarding_completed = true,
      full_name = coalesce(nullif(btrim(full_name), ''), v_app.full_name),
      phone = coalesce(phone, v_app.phone)
  where id = p_profile_id;

  if v_app.role = 'creator' then
    insert into public.creators (profile_id, display_name, bio, city, followers_count)
    values (p_profile_id, left(v_app.full_name, 80), v_app.bio, v_app.city, coalesce(v_app.followers_count, 0))
    on conflict (profile_id) do update
      set bio = coalesce(public.creators.bio, excluded.bio),
          city = coalesce(public.creators.city, excluded.city)
    returning id into v_creator_id;

    -- The rating the admin gave at review follows the creator in.
    if v_creator_id is not null then
      insert into public.creator_rankings (creator_id, admin_rating, updated_by)
      values (v_creator_id, v_app.admin_rating, auth.uid())
      on conflict (creator_id) do update
        set admin_rating = coalesce(excluded.admin_rating, public.creator_rankings.admin_rating);
    end if;

    if v_app.social_platform is not null and v_app.social_handle is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, followers_count)
      values (v_creator_id, v_app.social_platform::public.social_platform, v_app.social_handle, coalesce(v_app.followers_count, 0))
      on conflict do nothing;
    end if;

    foreach v_cat in array coalesce(v_app.categories, '{}'::text[]) loop
      select id into v_cat_id from public.categories where lower(name) = lower(btrim(v_cat)) limit 1;
      if v_cat_id is not null then
        insert into public.creator_categories (creator_id, category_id, is_primary)
        values (v_creator_id, v_cat_id, v_first)
        on conflict do nothing;
        v_first := false;
      end if;
    end loop;

  else
    insert into public.brands (profile_id, brand_name, website_url, location, description, contact_email, contact_phone)
    values (
      p_profile_id,
      left(coalesce(nullif(btrim(v_app.brand_name), ''), v_app.full_name), 80),
      v_app.website, v_app.city, v_app.looking_for, v_app.email, v_app.phone
    )
    on conflict (profile_id) do nothing;
  end if;

  update public.applications
  set status = 'approved',
      profile_id = p_profile_id,
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now())
  where id = p_application_id
  returning * into v_app;

  perform private.notify(
    p_profile_id,
    'application_approved',
    'You''re in',
    format('Welcome to House of Collabs. Your %s account is ready.', v_app.role),
    'profile', p_profile_id,
    case v_app.role when 'brand' then '/brand' else '/creator' end
  );

  perform private.audit('application_account_provisioned', 'application', v_app.id::text,
    jsonb_build_object('role', v_app.role, 'profile_id', p_profile_id, 'via', p_actor_role),
    coalesce(auth.uid(), p_profile_id), p_actor_role);

  return v_app;
end;
$$;
