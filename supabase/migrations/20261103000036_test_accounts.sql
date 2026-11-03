-- 0036 - Test accounts: kept out of the numbers, deleted with their test orders
--
-- An account with orders can't be deleted: orders, payments, earnings and
-- payouts point at it with ON DELETE RESTRICT, so the financial history
-- outlives it. That's right for real customers and a nuisance for the handful
-- of accounts made to try the platform, which is all that ever traded here.
--
-- `profiles.is_test` marks one (Admin → a creator or brand → Account access).
-- A test account:
--   * is left out of the marketplace search and the public counts, and out of
--     the "published" count in Admin (its storefront still opens by link, so
--     a test brand can order from a test creator);
--   * can be deleted permanently together with every order it was part of,
--     their payments, refunds and earnings, and its payouts. That includes
--     test orders it placed with real creators; those creators keep their
--     account and lose only the test orders. The app clears the history with
--     admin_delete_test_history, then deletes the account as usual.
--
-- Also: suspended creators no longer count as published (Admin) or towards
-- the public creator and city counts, where they already weren't listed.

begin;

alter table public.profiles add column if not exists is_test boolean not null default false;

comment on column public.profiles.is_test is
  'A test account: kept out of the marketplace and the counts, and deletable together with its test orders.';

create or replace function public.admin_set_test_account(p_profile_id uuid, p_is_test boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  update public.profiles set is_test = p_is_test where id = p_profile_id;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002', hint = 'NOT_FOUND';
  end if;
  perform private.audit(case when p_is_test then 'account_marked_test' else 'account_unmarked_test' end,
    'profile', p_profile_id::text, '{}'::jsonb, v_admin, 'admin');
end;
$$;

-- Everything a test account traded, so the account itself can then be deleted.
-- Refuses anything not marked as a test account.
create or replace function public.admin_delete_test_history(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_creators uuid[];
  v_orders uuid[];
  v_payouts uuid[];
  v_counts jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id and is_test) then
    raise exception 'Only an account marked as a test account can be deleted with its orders.'
      using errcode = 'P0001', hint = 'NOT_A_TEST_ACCOUNT';
  end if;

  select coalesce(array_agg(id), '{}') into v_creators from public.creators where profile_id = p_profile_id;
  select coalesce(array_agg(o.id), '{}') into v_orders
  from public.orders o
  where o.creator_id = any (v_creators)
     or o.brand_id in (select b.id from public.brands b where b.profile_id = p_profile_id);
  select coalesce(array_agg(id), '{}') into v_payouts from public.payout_requests where creator_id = any (v_creators);

  v_counts := jsonb_build_object(
    'orders', cardinality(v_orders),
    'payments', (select count(*) from public.payments where order_id = any (v_orders)),
    'earnings', (select count(*) from public.creator_earnings where order_id = any (v_orders) or creator_id = any (v_creators)),
    'payouts', cardinality(v_payouts)
  );

  delete from public.payment_refunds
  where order_id = any (v_orders) or payment_id in (select id from public.payments where order_id = any (v_orders));
  delete from public.creator_earnings where order_id = any (v_orders) or creator_id = any (v_creators);
  delete from public.payout_transactions where payout_request_id = any (v_payouts);
  delete from public.payout_requests where id = any (v_payouts);
  delete from public.payments where order_id = any (v_orders);
  delete from public.orders where id = any (v_orders);

  perform private.audit('test_history_deleted', 'profile', p_profile_id::text, v_counts, v_admin, 'admin');
  return v_counts;
end;
$$;

revoke execute on function public.admin_set_test_account(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_test_history(uuid) from public, anon;
grant execute on function public.admin_set_test_account(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_test_history(uuid) to authenticated;

-- ---------------------------------------------- marketplace search (live) --
-- Unchanged but for `and not pr.is_test` on the profile join.

CREATE OR REPLACE FUNCTION public.search_creators(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_min_followers integer DEFAULT NULL::integer, p_max_followers integer DEFAULT NULL::integer, p_max_delivery_days integer DEFAULT NULL::integer, p_gender text DEFAULT NULL::text, p_min_age integer DEFAULT NULL::integer, p_max_age integer DEFAULT NULL::integer, p_languages text[] DEFAULT NULL::text[], p_creator_type text DEFAULT NULL::text, p_content_type text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_verified_only boolean DEFAULT false, p_available_only boolean DEFAULT false, p_min_rating numeric DEFAULT NULL::numeric, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_barter boolean DEFAULT NULL::boolean, p_travel text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, slug text, display_name text, headline text, profile_image_url text, cover_image_url text, intro_video_url text, city text, state text, country text, gender gender_type, age integer, creator_type text, followers_count integer, engagement_rate numeric, verified boolean, available boolean, featured boolean, rating numeric, review_count integer, completed_orders integer, starting_price numeric, fastest_delivery_days integer, response_time text, content_types text[], categories jsonb, languages text[], platforms text[], portfolio_preview jsonb, last_seen_at timestamp with time zone, published_at timestamp with time zone, barter_stance text, travel_scope text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active' and not pr.is_test
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

-- ----------------------------------------------------- public counts --
-- Live creators only: active account, not a test account.

CREATE OR REPLACE FUNCTION public.get_public_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'creators', (select count(*) from public.creators c join public.profiles pr on pr.id = c.profile_id and pr.status = 'active' and not pr.is_test where c.status = 'published' and c.deleted_at is null),
    'cities', (select count(distinct lower(c.city)) from public.creators c join public.profiles pr on pr.id = c.profile_id and pr.status = 'active' and not pr.is_test where c.status = 'published' and c.deleted_at is null),
    'categories', (select count(*) from public.categories where active),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'avg_rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.status = 'published' and r.reviewer_role = 'brand'),
    'avg_starting_price', (select round(avg(c.starting_price)) from public.creators c join public.profiles pr on pr.id = c.profile_id and pr.status = 'active' and not pr.is_test where c.status = 'published' and c.deleted_at is null)
  );
$function$;

-- ------------------------------------------------------ admin counts --

CREATE OR REPLACE FUNCTION public.admin_people_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email)),
    'users_active',       (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.status = 'active'),
    'users_suspended',    (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.status <> 'active'),
    'new_7d',             (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '7 days'),
    'new_30d',            (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '30 days'),
    'dau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '30 days'),
    'by_role',            (select coalesce(jsonb_object_agg(coalesce(r.role::text, 'unassigned'), r.n), '{}'::jsonb)
                           from (select p.role, count(*)::int as n from public.profiles p
                                 where private.is_directory_account(p.id, p.role, p.email) group by 1) r),
    -- Every creator account: live, suspended, or with the storefront removed.
    'creators_total',     (select count(*) from public.creators),
    'creators_removed',   (select count(*) from public.creators where deleted_at is not null),
    -- Live on the marketplace: not suspended, not a test account.
    'creators_published', (select count(*) from public.creators c join public.profiles p on p.id = c.profile_id
                           where c.status = 'published' and c.deleted_at is null and p.status = 'active' and not p.is_test),
    'creators_verified',  (select count(*) from public.creators where verified and deleted_at is null),
    'creators_pending',   (select count(*) from public.creators where status = 'pending_review' and deleted_at is null),
    'creators_active_today', (select count(*) from public.creators c
                              join public.profiles p on p.id = c.profile_id
                              where c.deleted_at is null and p.last_seen_at > now() - interval '1 day'),
    'creators_onboarded_today', (select count(*) from public.creators c
                                 where c.deleted_at is null
                                   and (c.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'brands_total',       (select count(*) from public.brands),
    'brands_active',      (select count(*) from public.brands b
                           join public.profiles p on p.id = b.profile_id where p.status = 'active'),
    'brands_active_today', (select count(*) from public.brands b
                            join public.profiles p on p.id = b.profile_id
                            where p.last_seen_at > now() - interval '1 day'),
    'brands_onboarded_today', (select count(*) from public.brands b
                               where (b.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'onboarding_done',    (select count(*) from public.profiles p where private.is_directory_account(p.id, p.role, p.email) and p.onboarding_completed),
    'contact_open',       (select count(*) from public.contact_messages where status = 'new'),
    'reports_open',       (select count(*) from public.reports where status in ('open', 'under_review')),
    'payouts_pending',    (select count(*) from public.payout_requests where status in ('pending', 'processing'))
  );
end;
$function$;

commit;
