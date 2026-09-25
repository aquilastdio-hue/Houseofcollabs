-- =============================================================================
-- House of Collabs -- 0036 -- search tolerates typos and near-miss names
-- =============================================================================
-- `search_creators` matched on full-text (with a prefix wildcard) and ILIKE, so
-- a query had to be spelled the way the creator spelled it. "Aanyaa" returned
-- nothing at all for "Aanya Kapoor", which reads as "we have no such creator"
-- rather than "check the spelling".
--
-- pg_trgm adds trigram matching on the display name. `word_similarity` scores
-- the query against the closest run of words in the name, so a first name still
-- finds someone whose full name carries a surname, and a dropped or doubled
-- letter still lands. 0.45 is deliberately strict: loose enough for a typo,
-- tight enough that unrelated names don't pad the results.
--
-- Nothing else about the search changes -- the same filters, the same ordering,
-- and still only creators whose storefront is published.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Also speeds up the existing `display_name ilike '%...%'`, which a b-tree
-- index can never serve because of the leading wildcard.
create index if not exists creators_display_name_trgm
  on public.creators using gin (display_name extensions.gin_trgm_ops);

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
  p_offset int default 0
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
      end as rank
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
    where c.status = 'published'
      and c.deleted_at is null
      and (v_q is null
           or (v_tsq is not null and c.search_vector @@ v_tsq)
           or c.display_name ilike v_like
           or c.city ilike v_like
           or extensions.word_similarity(v_q, c.display_name) >= 0.45)
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
          case when v_sort = 'price_asc' then f.starting_price end asc nulls last,
          case when v_sort = 'price_desc' then f.starting_price end desc nulls last,
          case when v_sort = 'followers' then f.followers_count end desc nulls last,
          case when v_sort = 'delivery' then f.fastest_delivery_days end asc nulls last,
          case when v_sort = 'rating' then f.rating end desc nulls last,
          case when v_sort = 'rating' then f.review_count end desc nulls last,
          case when v_sort = 'newest' then f.published_at end desc nulls last,
          f.rank desc,
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
