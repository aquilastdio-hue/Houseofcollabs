-- =============================================================================
-- House of Collabs | 0057 | barter is a property of the creator, not a form answer
-- =============================================================================
-- Page 4 of the sign-up asks whether a creator takes barter, and the answer went
-- into `applications.profile` and stopped there. `applications` is admin-only,
-- so nothing public could list or filter on it: there was no way to answer "show
-- me creators open to barter", which is one of the three things the header is
-- meant to offer.
--
-- So the answer moves onto the creator row, where the storefront can read it:
--
--   * a `barter_available` column, defaulting to false
--   * backfilled from the applications already approved
--   * set by provisioning from here on, so new creators carry it automatically
--   * a `p_barter` filter on search_creators, appended with a default so every
--     existing named call keeps working untouched
--
-- Both functions are restated whole because a body cannot be edited in place.
-- Apart from the lines described above they are unchanged.
-- =============================================================================

alter table public.creators
  add column if not exists barter_available boolean not null default false;

comment on column public.creators.barter_available is
  'Whether the creator accepts barter collaborations. Set from page 4 of the sign-up at approval.';

create index if not exists creators_barter_idx on public.creators (barter_available) where barter_available;

-- -----------------------------------------------------------------------------
-- Creators approved before the column existed.
-- -----------------------------------------------------------------------------
update public.creators c
set barter_available = coalesce((a.profile ->> 'barter_available')::boolean, false)
from public.applications a
where a.profile_id = c.profile_id
  and a.role = 'creator'
  and a.status = 'approved'
  and c.barter_available is distinct from coalesce((a.profile ->> 'barter_available')::boolean, false);

-- -----------------------------------------------------------------------------
-- Provisioning, so the answer is carried forward from now on.
-- -----------------------------------------------------------------------------
drop function if exists public.provision_application_account(uuid, uuid);
drop function if exists private.apply_application(uuid, uuid, public.actor_role);

create or replace function private.apply_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_actor_role public.actor_role default 'system',
  p_media jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.applications;
  v_p jsonb;
  v_media jsonb := coalesce(p_media, '{}'::jsonb);
  v_creator_id uuid;
  v_cat text;
  v_cat_id uuid;
  v_first boolean := true;
  v_rate record;
  v_price numeric;
  v_start numeric;
  v_types text[] := '{}';
  v_url text;
  v_name text;
  v_site text;
  v_insta text;
  v_phone text;
  v_followers int;
  v_subs int;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Application not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002', hint = 'PROFILE_NOT_FOUND';
  end if;

  v_p := coalesce(v_app.profile, '{}'::jsonb);

  -- `profiles.phone` and `brands.contact_phone` enforce the same format, so the
  -- number is checked once, before anything writes it. An unparseable one is
  -- dropped rather than allowed to abort the whole approval.
  v_phone := nullif(btrim(coalesce(v_app.phone, '')), '');
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then v_phone := null; end if;

  -- Role + onboarded, so `homeFor` sends them to their dashboard and
  -- `RequireRole` lets them in.
  update public.profiles
  set role = v_app.role::public.user_role,
      onboarding_completed = true,
      full_name = coalesce(nullif(btrim(full_name), ''), v_app.full_name),
      phone = coalesce(phone, v_phone),
      avatar_url = coalesce(avatar_url, nullif(v_media ->> 'avatar_url', ''))
  where id = p_profile_id;

  if v_app.role = 'creator' then
    -- The person's name, not the handle they typed.
    --
    -- Page 1 asks for both a full name and a "Creator / Instagram name", and
    -- almost everyone fills the second with their handle — or, in one case, a
    -- full instagram.com URL with a tracking parameter still attached. Taking
    -- that as the storefront name put "https://instagram.com/rohit.arora.5030
    -- ?igshid=..." on the public creators page where a name belongs.
    --
    -- So the contact name leads and the typed one is the fallback, for the
    -- rare application that has no full name.
    v_name := left(coalesce(nullif(btrim(v_app.full_name), ''), nullif(btrim(v_p ->> 'creator_name'), '')), 80);

    -- Followers: the Instagram figure they gave on page 2 is the better number,
    -- and it arrives as text. Clamp to the column's range.
    v_followers := least(greatest(coalesce(
      nullif(regexp_replace(coalesce(v_p -> 'instagram' ->> 'followers', ''), '[^0-9]', '', 'g'), '')::bigint,
      v_app.followers_count::bigint, 0), 0), 2000000000)::int;

    insert into public.creators (
      profile_id, display_name, bio, city, followers_count,
      profile_image_url, intro_video_url, available, featured
    )
    values (
      p_profile_id, v_name, v_app.bio, v_app.city, v_followers,
      nullif(v_media ->> 'avatar_url', ''), nullif(v_media ->> 'intro_video_url', ''), true,
      -- Marked for Discover while the application was being reviewed.
      coalesce(v_app.discover, false)
    )
    on conflict (profile_id) do update
      set bio = coalesce(public.creators.bio, excluded.bio),
          city = coalesce(public.creators.city, excluded.city),
          followers_count = greatest(public.creators.followers_count, excluded.followers_count),
          profile_image_url = coalesce(public.creators.profile_image_url, excluded.profile_image_url),
          intro_video_url = coalesce(public.creators.intro_video_url, excluded.intro_video_url),
          -- Re-approving can promote into Discover but never quietly demote.
          featured = public.creators.featured or excluded.featured,
          updated_at = now()
    returning id into v_creator_id;

    -- The rating the admin gave on the application follows them here. They rate
    -- while reviewing — before approving — so at that moment there is no creator
    -- for `admin_rate_application` to sync to, and its "keep the ranking in
    -- step" branch never fires. Without this the rating stays stranded on the
    -- application and the ranking screen shows an approved creator as unrated.
    --
    -- `coalesce` on conflict so re-approving never overwrites a rating that has
    -- since been changed on the ranking screen itself, which is the newer word.
    if v_app.admin_rating is not null then
      insert into public.creator_rankings (creator_id, admin_rating, updated_by)
      values (v_creator_id, v_app.admin_rating, coalesce(auth.uid(), p_profile_id))
      on conflict (creator_id) do update
        set admin_rating = coalesce(public.creator_rankings.admin_rating, excluded.admin_rating),
            updated_by = excluded.updated_by;
    end if;

    -- ---------------------------------------------------------------- socials
    v_url := nullif(btrim(coalesce(v_p -> 'instagram' ->> 'url', '')), '');
    if v_url is not null and v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
    if coalesce(nullif(btrim(v_p -> 'instagram' ->> 'handle'), ''), v_app.social_handle) is not null then
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (
        v_creator_id, 'instagram',
        left(regexp_replace(coalesce(nullif(btrim(v_p -> 'instagram' ->> 'handle'), ''), v_app.social_handle), '^@', ''), 100),
        v_url, v_followers
      )
      on conflict (creator_id, platform, username) do update
        set followers_count = greatest(public.creator_social_accounts.followers_count, excluded.followers_count),
            profile_url = coalesce(public.creator_social_accounts.profile_url, excluded.profile_url);
    end if;

    v_url := nullif(btrim(coalesce(v_p -> 'youtube' ->> 'url', '')), '');
    if v_url is not null then
      if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
      v_subs := least(greatest(coalesce(
        nullif(regexp_replace(coalesce(v_p -> 'youtube' ->> 'subscribers', ''), '[^0-9]', '', 'g'), '')::bigint, 0), 0), 2000000000)::int;
      insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count)
      values (v_creator_id, 'youtube', left(regexp_replace(v_url, '^https?://(www\.)?youtube\.com/', ''), 100), v_url, v_subs)
      on conflict (creator_id, platform, username) do update
        set followers_count = greatest(public.creator_social_accounts.followers_count, excluded.followers_count);
    end if;

    -- ------------------------------------------------------------- categories
    foreach v_cat in array coalesce(v_app.categories, '{}'::text[]) loop
      select id into v_cat_id from public.categories where lower(name) = lower(btrim(v_cat)) limit 1;
      if v_cat_id is not null then
        insert into public.creator_categories (creator_id, category_id, is_primary)
        values (v_creator_id, v_cat_id, v_first)
        on conflict do nothing;
        v_first := false;
      end if;
    end loop;

    -- Page 4 also asks whether they take barter. It lived only in the
    -- application until now, which meant nothing could list or filter on it.
    update public.creators
    set barter_available = coalesce((v_p ->> 'barter_available')::boolean, false)
    where id = v_creator_id;

    -- ---------------------------------------------------------------- pricing
    -- Page 4 is a rate card: a figure against a collaboration type means they
    -- offer it, a blank means they don't. Each figure becomes a service so the
    -- storefront has something to sell the day they sign in.
    for v_rate in
      select * from (values
        ('ugc_video',           'UGC',                      'ugc_video',     5, 'instagram', 1),
        ('story',               'Instagram story',          'story',         2, 'instagram', 2),
        ('collab_reel',         'Collaborative reel',       'reel',          5, 'instagram', 3),
        ('static_carousel',     'Static / carousel post',   'post',          4, 'instagram', 4),
        ('youtube_integration', 'YouTube integration',      'youtube_video', 7, 'youtube',   5)
      ) as t(key, title, content_type, days, platform, rank)
    loop
      v_price := nullif(regexp_replace(coalesce(v_p -> 'rates' ->> v_rate.key, ''), '[^0-9.]', '', 'g'), '')::numeric;
      -- The column refuses anything outside this band; a typo shouldn't abort
      -- the whole approval, so out-of-range figures are skipped instead.
      if v_price is not null and v_price >= 100 and v_price <= 10000000 then
        if not exists (
          select 1 from public.creator_services s
          where s.creator_id = v_creator_id and s.title = v_rate.title
        ) then
          insert into public.creator_services (creator_id, title, price, delivery_days, content_type, platform, active, sort_order)
          values (v_creator_id, v_rate.title, v_price, v_rate.days, v_rate.content_type, v_rate.platform::public.social_platform, true, v_rate.rank);
        end if;
        v_types := v_types || v_rate.content_type;
        v_start := least(coalesce(v_start, v_price), v_price);
      end if;
    end loop;

    -- -------------------------------------------------------------- portfolio
    for v_url in select jsonb_array_elements_text(coalesce(v_media -> 'photos', '[]'::jsonb)) loop
      if not exists (select 1 from public.portfolio_items i where i.creator_id = v_creator_id and i.media_url = v_url) then
        -- No title. Anything set here shows as a caption on the public
        -- storefront, and "From my application" is a note about where the file
        -- came from, not something a brand browsing the page wants to read.
        insert into public.portfolio_items (creator_id, type, media_url)
        values (v_creator_id, 'image', v_url);
      end if;
    end loop;
    for v_url in select jsonb_array_elements_text(coalesce(v_media -> 'videos', '[]'::jsonb)) loop
      if not exists (select 1 from public.portfolio_items i where i.creator_id = v_creator_id and i.media_url = v_url) then
        insert into public.portfolio_items (creator_id, type, media_url)
        values (v_creator_id, 'video', v_url);
      end if;
    end loop;

    -- Derived from the rate card above, so it has to wait for the loop.
    --
    -- Approval also puts the storefront live. `publish_creator_profile` makes a
    -- creator clear a completion checklist first, but that gate exists to stop
    -- people publishing an empty storefront with nobody having looked at it —
    -- which is exactly what an admin approving the application has just done by
    -- hand. Making them wait on a bio they were never asked for would leave an
    -- approved creator invisible on the very page approval is for.
    --
    -- Only a draft is promoted. Suspended, rejected and already-published are
    -- left exactly as they are, so re-approving can never quietly un-suspend
    -- someone. `status` on the right-hand side is the pre-update value, so all
    -- four branches agree on which case they are in.
    update public.creators
    set starting_price = coalesce(starting_price, v_start),
        content_types = case
          when cardinality(content_types) = 0 then array(select distinct t from unnest(v_types) as t)
          else content_types end,
        status = case when status = 'draft' then 'published'::public.creator_status else status end,
        published_at = case when status = 'draft' then coalesce(published_at, now()) else published_at end,
        approved_at = case when status = 'draft' then coalesce(approved_at, now()) else approved_at end,
        onboarding_step = greatest(onboarding_step, 7),
        updated_at = now()
    where id = v_creator_id;

  else
    -- ------------------------------------------------------------------ brand
    -- Page 1 accepts a site or a handle, so it is only a website if it looks
    -- like one — the column rejects anything that isn't a URL.
    v_site := coalesce(
      nullif(btrim(v_app.website), ''),
      nullif(btrim(v_p -> 'verification' ->> 'company_website'), ''),
      nullif(btrim(v_p ->> 'website_or_handle'), '')
    );
    if v_site is not null and v_site !~* '^https?://' then
      v_site := case when v_site like '@%' or v_site not like '%.%' then null else 'https://' || v_site end;
    end if;

    v_insta := nullif(btrim(coalesce(v_p -> 'verification' ->> 'instagram_url', '')), '');
    if v_insta is not null and v_insta !~* '^https?://' then
      v_insta := 'https://instagram.com/' || regexp_replace(v_insta, '^@', '');
    end if;

    insert into public.brands (
      profile_id, brand_name, website_url, instagram_url, description,
      industry, location, contact_email, contact_phone, brand_logo_url
    )
    values (
      p_profile_id,
      left(coalesce(nullif(btrim(v_app.brand_name), ''), v_app.full_name), 80),
      v_site, v_insta, left(coalesce(v_app.looking_for, ''), 2000),
      left(coalesce(nullif(btrim(v_p ->> 'industry'), ''), ''), 80),
      left(coalesce(v_app.city, ''), 120),
      v_app.email, v_phone,
      nullif(v_media ->> 'logo_url', '')
    )
    on conflict (profile_id) do update
      set website_url = coalesce(public.brands.website_url, excluded.website_url),
          instagram_url = coalesce(public.brands.instagram_url, excluded.instagram_url),
          description = coalesce(nullif(public.brands.description, ''), excluded.description),
          industry = coalesce(nullif(public.brands.industry, ''), excluded.industry),
          location = coalesce(nullif(public.brands.location, ''), excluded.location),
          contact_email = coalesce(public.brands.contact_email, excluded.contact_email),
          contact_phone = coalesce(public.brands.contact_phone, excluded.contact_phone),
          brand_logo_url = coalesce(public.brands.brand_logo_url, excluded.brand_logo_url),
          updated_at = now();
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
    jsonb_build_object('role', v_app.role, 'profile_id', p_profile_id, 'via', p_actor_role,
                       'media', jsonb_build_object(
                         'photos', jsonb_array_length(coalesce(v_media -> 'photos', '[]'::jsonb)),
                         'videos', jsonb_array_length(coalesce(v_media -> 'videos', '[]'::jsonb)))),
    coalesce(auth.uid(), p_profile_id), p_actor_role);

  return v_app;
end;
$$;

comment on function private.apply_application(uuid, uuid, public.actor_role, jsonb) is
  'Seeds role, onboarding flag and the whole workspace from an application. Callers own the permission check.';

-- -----------------------------------------------------------------------------
-- Admin-initiated. `p_media` carries public URLs for uploads the approval
-- function has already copied out of the private applications bucket.
-- -----------------------------------------------------------------------------
create or replace function public.provision_application_account(
  p_application_id uuid,
  p_profile_id uuid,
  p_media jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return private.apply_application(p_application_id, p_profile_id, 'admin', p_media);
end;
$$;

-- -----------------------------------------------------------------------------
-- Search, with one more optional filter.
--
-- The old signature is dropped first. `create or replace` only replaces a
-- function with the *same* argument list, so adding p_barter would otherwise
-- leave both versions in place -- and every existing call, which names the
-- twenty-two arguments they share, becomes ambiguous: "function
-- public.search_creators(...) is not unique". That would take the marketplace
-- down on the next search.
-- -----------------------------------------------------------------------------
drop function if exists public.search_creators(
  text, text, text, text, numeric, numeric, integer, integer, integer, text,
  integer, integer, text[], text, text, text, boolean, boolean, numeric, text,
  integer, integer
);

create or replace function public.search_creators(
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_state text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_followers int default null,
  p_max_followers int default null,
  p_max_delivery_days int default null,
  p_gender text default null,
  p_min_age int default null,
  p_max_age int default null,
  p_languages text[] default null,
  p_creator_type text default null,
  p_content_type text default null,
  p_platform text default null,
  p_verified_only boolean default false,
  p_available_only boolean default false,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_limit int default 24,
  p_offset int default 0,
  p_barter boolean default null
)
returns table (
  id uuid,
  slug text,
  display_name text,
  headline text,
  profile_image_url text,
  cover_image_url text,
  intro_video_url text,
  city text,
  state text,
  country text,
  gender public.gender_type,
  age int,
  creator_type text,
  followers_count int,
  engagement_rate numeric,
  verified boolean,
  available boolean,
  featured boolean,
  rating numeric,
  review_count int,
  completed_orders int,
  starting_price numeric,
  fastest_delivery_days int,
  response_time text,
  content_types text[],
  categories jsonb,
  languages text[],
  platforms text[],
  portfolio_preview jsonb,
  last_seen_at timestamptz,
  published_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(btrim(p_query), '');
  v_like text;
  v_tsq_text text;
  v_tsq tsquery;
  v_sort text := coalesce(nullif(p_sort, ''), 'relevance');
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_langs text[] := array(select lower(btrim(x)) from unnest(coalesce(p_languages, '{}'::text[])) x where btrim(x) <> '');
  v_city text := nullif(btrim(p_city), '');
  v_state text := nullif(btrim(p_state), '');
  v_needs_service boolean := p_min_price is not null or p_max_price is not null
                             or p_max_delivery_days is not null or nullif(p_content_type, '') is not null;
begin
  if v_q is not null then
    v_like := '%' || private.like_escape(v_q) || '%';
    select string_agg(t || ':*', ' & ') into v_tsq_text
    from regexp_split_to_table(lower(v_q), '[^a-z0-9]+') t
    where t <> '';
    if v_tsq_text is not null then
      v_tsq := to_tsquery('simple', v_tsq_text);
    end if;
  end if;

  return query
  with filtered as (
    select
      c.id,
      c.featured,
      c.verified,
      c.rating,
      c.review_count,
      c.followers_count,
      c.starting_price,
      c.fastest_delivery_days,
      c.published_at,
      case
        when v_q is null then 0::real
        else coalesce(ts_rank_cd(c.search_vector, v_tsq), 0)
             + case when c.display_name ilike v_like then 1 else 0 end
             + coalesce(extensions.word_similarity(v_q, c.display_name), 0)
      end as rank,
      rk.admin_rating,
      rk.pinned_at,
      rk.sort_order
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
    left join public.creator_rankings rk on rk.creator_id = c.id
    where c.status = 'published'
      and c.deleted_at is null
      and (v_q is null
           or (v_tsq is not null and c.search_vector @@ v_tsq)
           or c.display_name ilike v_like
           or c.city ilike v_like
           or extensions.word_similarity(v_q, c.display_name) >= 0.45
           or exists (
                select 1
                from regexp_split_to_table(lower(v_q), '[^a-z0-9]+') qw
                cross join regexp_split_to_table(lower(c.display_name), '[^a-z0-9]+') nw
                where length(qw) >= 3
                  and extensions.levenshtein_less_equal(qw, nw, case when length(qw) >= 5 then 2 else 1 end)
                      <= case when length(qw) >= 5 then 2 else 1 end))
      and (nullif(p_category, '') is null or exists (
            select 1 from public.creator_categories cc
            join public.categories cat on cat.id = cc.category_id
            where cc.creator_id = c.id and cat.slug = lower(p_category)))
      and (v_city is null or c.city ilike '%' || private.like_escape(v_city) || '%')
      and (v_state is null or c.state ilike '%' || private.like_escape(v_state) || '%')
      and (p_min_followers is null or c.followers_count >= p_min_followers)
      and (p_max_followers is null or c.followers_count <= p_max_followers)
      and (nullif(p_gender, '') is null or c.gender::text = p_gender)
      and (p_min_age is null or c.age >= p_min_age)
      and (p_max_age is null or c.age <= p_max_age)
      and (nullif(p_creator_type, '') is null or c.creator_type = p_creator_type)
      and (not coalesce(p_verified_only, false) or c.verified)
      and (not coalesce(p_available_only, false) or c.available)
      and (p_barter is null or c.barter_available = p_barter)
      and (p_min_rating is null or c.rating >= p_min_rating)
      and (cardinality(v_langs) = 0 or exists (
            select 1 from public.creator_languages l
            where l.creator_id = c.id and lower(l.language) = any (v_langs)))
      and (nullif(p_platform, '') is null or exists (
            select 1 from public.creator_social_accounts s
            where s.creator_id = c.id and s.platform::text = p_platform))
      and (not v_needs_service or exists (
            select 1 from public.creator_services s
            where s.creator_id = c.id and s.active and s.archived_at is null
              and (p_min_price is null or s.price >= p_min_price)
              and (p_max_price is null or s.price <= p_max_price)
              and (p_max_delivery_days is null or s.delivery_days <= p_max_delivery_days)
              and (nullif(p_content_type, '') is null or s.content_type = p_content_type)))
  ),
  ordered as (
    select
      f.id,
      count(*) over () as total,
      row_number() over (
        order by
          -- A pinned profile leads the default view outright: that is what
          -- "Send on top" means. An explicit sort (price, followers, newest)
          -- still means what it says, so the pin only applies to relevance.
          -- A hand-placed position beats every other signal: it is the admin
          -- saying "this one, here", and nothing should quietly outrank that.
          case when v_sort = 'relevance' then f.sort_order end asc nulls last,
          case when v_sort = 'relevance' then f.pinned_at end desc nulls last,
          -- Discover picks lead the rest, ordered by rating among themselves.
          case when v_sort = 'relevance' and v_q is null then f.featured end desc,
          -- Browsing with no search term, the admin's rating is the order.
          -- With a search term, matching the search comes first and the rating
          -- breaks ties below `f.rank` -- otherwise searching someone's name
          -- would hand you whoever is rated highest instead.
          case when v_sort = 'relevance' and v_q is null then f.admin_rating end desc nulls last,
          case when v_sort = 'price_asc' then f.starting_price end asc nulls last,
          case when v_sort = 'price_desc' then f.starting_price end desc nulls last,
          case when v_sort = 'followers' then f.followers_count end desc nulls last,
          case when v_sort = 'delivery' then f.fastest_delivery_days end asc nulls last,
          case when v_sort = 'rating' then f.rating end desc nulls last,
          case when v_sort = 'rating' then f.review_count end desc nulls last,
          case when v_sort = 'newest' then f.published_at end desc nulls last,
          f.rank desc,
          case when v_sort = 'relevance' then f.admin_rating end desc nulls last,
          f.featured desc,
          f.verified desc,
          f.rating desc,
          f.review_count desc,
          f.followers_count desc,
          f.id
      ) as rn
    from filtered f
  ),
  page as (
    select o.id, o.total, o.rn from ordered o order by o.rn limit v_limit offset v_offset
  )
  select
    c.id,
    c.slug,
    c.display_name,
    c.headline,
    c.profile_image_url,
    c.cover_image_url,
    c.intro_video_url,
    c.city,
    c.state,
    c.country,
    c.gender,
    c.age,
    c.creator_type,
    c.followers_count,
    c.engagement_rate,
    c.verified,
    c.available,
    c.featured,
    c.rating,
    c.review_count,
    c.completed_orders,
    c.starting_price,
    c.fastest_delivery_days,
    c.response_time,
    c.content_types,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', cat.id, 'name', cat.name, 'slug', cat.slug, 'is_primary', cc.is_primary)
                       order by cc.is_primary desc, cat.sort_order)
      from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
      where cc.creator_id = c.id
    ), '[]'::jsonb),
    coalesce(array(select l.language from public.creator_languages l where l.creator_id = c.id order by l.created_at), '{}'::text[]),
    coalesce(array(select distinct s.platform::text from public.creator_social_accounts s where s.creator_id = c.id), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'type', x.type, 'media_url', x.media_url,
                                          'thumbnail_url', x.thumbnail_url, 'title', x.title))
      from (
        select pi.id, pi.type, pi.media_url, pi.thumbnail_url, pi.title
        from public.portfolio_items pi
        where pi.creator_id = c.id and not pi.is_hidden
        order by pi.sort_order, pi.created_at
        limit 4
      ) x
    ), '[]'::jsonb),
    pr.last_seen_at,
    c.published_at,
    p.total
  from page p
  join public.creators c on c.id = p.id
  join public.profiles pr on pr.id = c.profile_id
  order by p.rn;
end;
$$;
