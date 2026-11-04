-- 0039 - Test brands can find test creators in search
--
-- 0036 hid test accounts from the marketplace. That left a test brand with no
-- way to find the test creator it is meant to order from, short of typing the
-- storefront address. Now a signed-in test account sees test creators in
-- every listing that uses search_creators (Find creators, Discover, category,
-- UGC and barter pages). Everyone else, signed in or not, still never sees
-- them, and public counts are unchanged.
--
-- The live definition, with only the profile join changed.

begin;

CREATE OR REPLACE FUNCTION public.search_creators(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_min_followers integer DEFAULT NULL::integer, p_max_followers integer DEFAULT NULL::integer, p_max_delivery_days integer DEFAULT NULL::integer, p_gender text DEFAULT NULL::text, p_min_age integer DEFAULT NULL::integer, p_max_age integer DEFAULT NULL::integer, p_languages text[] DEFAULT NULL::text[], p_creator_type text DEFAULT NULL::text, p_content_type text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_verified_only boolean DEFAULT false, p_available_only boolean DEFAULT false, p_min_rating numeric DEFAULT NULL::numeric, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_barter boolean DEFAULT NULL::boolean, p_travel text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, slug text, display_name text, headline text, profile_image_url text, cover_image_url text, intro_video_url text, city text, state text, country text, gender gender_type, age integer, creator_type text, followers_count integer, engagement_rate numeric, verified boolean, available boolean, featured boolean, rating numeric, review_count integer, completed_orders integer, starting_price numeric, fastest_delivery_days integer, response_time text, content_types text[], categories jsonb, languages text[], platforms text[], portfolio_preview jsonb, last_seen_at timestamp with time zone, published_at timestamp with time zone, barter_stance text, travel_scope text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_q text := nullif(btrim(p_query), '');
  v_test_viewer boolean := coalesce(private.is_test_profile(auth.uid()), false);
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
    -- Test creators stay hidden, except from a test account searching: that is
    -- how a test brand finds a test creator to place a test order with.
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
      and (not pr.is_test or v_test_viewer)
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
      and (p_travel is null or c.travel_scope = p_travel)
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
          case when v_sort = 'relevance' then f.sort_order end asc nulls last,
          case when v_sort = 'relevance' then f.pinned_at end desc nulls last,
          case when v_sort = 'relevance' and v_q is null then f.featured end desc,
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
    c.barter_stance,
    c.travel_scope,
    p.total
  from page p
  join public.creators c on c.id = p.id
  join public.profiles pr on pr.id = c.profile_id
  order by p.rn;
end;
$function$;

commit;
