-- 0037 - Test accounts out of every number in Admin
--
-- 0036 kept test accounts out of the marketplace and the public counts. This
-- keeps them, and every order they were part of, out of Admin's numbers too:
-- the dashboard, revenue, charts, the people / creator / brand totals,
-- creator ranking, employee referrals and Owed to creators.
--
-- Each of those functions is the live definition with only its table reads
-- changed: `from public.orders o` becomes `from (orders without test ones) o`,
-- and likewise for payments, creators, brands, profiles, earnings and payout
-- requests. An order is a test order when its brand or its creator is a test
-- account. The lists still show test accounts, so they can be found and deleted.

begin;

create or replace function private.is_test_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.profiles where id = p_profile_id and is_test);
$$;

create or replace function private.is_test_creator(p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.creators c join public.profiles p on p.id = c.profile_id
    where c.id = p_creator_id and p.is_test
  );
$$;

create or replace function private.is_test_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.orders o
    left join public.brands b on b.id = o.brand_id
    left join public.creators c on c.id = o.creator_id
    join public.profiles p on p.id in (b.profile_id, c.profile_id)
    where o.id = p_order_id and p.is_test
  );
$$;

revoke execute on function private.is_test_profile(uuid) from public;
revoke execute on function private.is_test_creator(uuid) from public;
revoke execute on function private.is_test_order(uuid) from public;

-- admin_people_stats: 26 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_people_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email)),
    'users_active',       (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.status = 'active'),
    'users_suspended',    (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.status <> 'active'),
    'new_7d',             (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '7 days'),
    'new_30d',            (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.created_at > now() - interval '30 days'),
    'dau',                (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.last_seen_at > now() - interval '30 days'),
    'by_role',            (select coalesce(jsonb_object_agg(coalesce(r.role::text, 'unassigned'), r.n), '{}'::jsonb)
                           from (select p.role, count(*)::int as n from (select * from public.profiles where not is_test) p
                                 where private.is_directory_account(p.id, p.role, p.email) group by 1) r),
    -- Every creator account: live, suspended, or with the storefront removed.
    'creators_total',     (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) creators),
    'creators_removed',   (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) creators where deleted_at is not null),
    -- Live on the marketplace: not suspended, not a test account.
    'creators_published', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c join (select * from public.profiles where not is_test) p on p.id = c.profile_id
                           where c.status = 'published' and c.deleted_at is null and p.status = 'active' and not p.is_test),
    'creators_verified',  (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) creators where verified and deleted_at is null),
    'creators_pending',   (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) creators where status = 'pending_review' and deleted_at is null),
    'creators_active_today', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c
                              join (select * from public.profiles where not is_test) p on p.id = c.profile_id
                              where c.deleted_at is null and p.last_seen_at > now() - interval '1 day'),
    'creators_onboarded_today', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c
                                 where c.deleted_at is null
                                   and (c.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'brands_total',       (select count(*) from (select * from public.brands where not private.is_test_profile(profile_id)) brands),
    'brands_active',      (select count(*) from (select * from public.brands where not private.is_test_profile(profile_id)) b
                           join (select * from public.profiles where not is_test) p on p.id = b.profile_id where p.status = 'active'),
    'brands_active_today', (select count(*) from (select * from public.brands where not private.is_test_profile(profile_id)) b
                            join (select * from public.profiles where not is_test) p on p.id = b.profile_id
                            where p.last_seen_at > now() - interval '1 day'),
    'brands_onboarded_today', (select count(*) from (select * from public.brands where not private.is_test_profile(profile_id)) b
                               where (b.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'onboarding_done',    (select count(*) from (select * from public.profiles where not is_test) p where private.is_directory_account(p.id, p.role, p.email) and p.onboarding_completed),
    'contact_open',       (select count(*) from public.contact_messages where status = 'new'),
    'reports_open',       (select count(*) from public.reports where status in ('open', 'under_review')),
    'payouts_pending',    (select count(*) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) payout_requests where status in ('pending', 'processing'))
  );
end;
$function$;

-- admin_dashboard_stats: 17 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gmv', (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'net_gmv', (select coalesce(sum(p.amount - p.refunded_amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'gmv_30d', (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p
                where p.status in ('captured', 'partially_refunded', 'refunded') and p.captured_at > now() - interval '30 days'),
    'platform_revenue', (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from (select * from public.orders where not private.is_test_order(id)) o where o.status = 'completed'),
    'orders_total', (select count(*) from (select * from public.orders where not private.is_test_order(id)) o where o.status not in ('draft', 'payment_pending')),
    'orders_30d', (select count(*) from (select * from public.orders where not private.is_test_order(id)) o where o.status not in ('draft', 'payment_pending') and o.created_at > now() - interval '30 days'),
    'avg_order_value', (select coalesce(round(avg(o.total_amount)), 0) from (select * from public.orders where not private.is_test_order(id)) o where o.paid_at is not null),
    -- Every creator account: live, suspended, or with the storefront removed.
    'creators_total', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c),
    'creators_published', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c where c.status = 'published' and c.deleted_at is null),
    'creators_pending_review', (select count(*) from (select * from public.creators where not private.is_test_profile(profile_id)) c where c.status = 'pending_review' and c.deleted_at is null),
    'brands_total', (select count(*) from (select * from public.brands where not private.is_test_profile(profile_id)) brands),
    'active_collaborations', (select count(*) from (select * from public.orders where not private.is_test_order(id)) o where o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'completed_orders', (select count(*) from (select * from public.orders where not private.is_test_order(id)) o where o.status = 'completed'),
    'pending_payouts_count', (select count(*) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) pr where pr.status in ('pending', 'processing')),
    'pending_payouts_amount', (select coalesce(sum(pr.amount), 0) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) pr where pr.status in ('pending', 'processing')),
    'refunds_count', (select count(*) from public.payment_refunds r where r.status = 'processed'),
    'refunds_amount', (select coalesce(sum(r.amount), 0) from public.payment_refunds r where r.status = 'processed'),
    'refunds_required', (select count(*) from (select * from public.orders where not private.is_test_order(id)) o where o.refund_required),
    'reports_open', (select count(*) from public.reports r where r.status in ('open', 'under_review')),
    'orders_by_status', (select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
                         from (select o.status, count(*) as cnt from (select * from public.orders where not private.is_test_order(id)) o group by o.status) s)
  );
end;
$function$;

-- admin_revenue_summary: 17 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_captured public.payment_status[] := array['captured', 'partially_refunded', 'refunded']::public.payment_status[];
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gross', jsonb_build_object(
      'today', (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('day', now())),
      'week',  (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('week', now())),
      'month', (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('month', now())),
      'year',  (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('year', now())),
      'all',   (select coalesce(sum(p.amount), 0) from (select * from public.payments where not private.is_test_order(order_id)) p where p.status = any(v_captured))
    ),
    'platform_fee', jsonb_build_object(
      'month', (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from (select * from public.orders where not private.is_test_order(id)) o
                where o.completed_at >= date_trunc('month', now())),
      'year',  (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from (select * from public.orders where not private.is_test_order(id)) o
                where o.completed_at >= date_trunc('year', now())),
      'all',   (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from (select * from public.orders where not private.is_test_order(id)) o where o.status = 'completed')
    ),
    'creator_earnings', jsonb_build_object(
      'available', (select coalesce(sum(e.net_amount), 0) from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e where e.status = 'available'),
      'pending',   (select coalesce(sum(e.net_amount), 0) from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e where e.status = 'pending'),
      'paid',      (select coalesce(sum(e.net_amount), 0) from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e where e.status = 'paid'),
      'gross',     (select coalesce(sum(e.gross_amount), 0) from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e)
    ),
    'payouts', jsonb_build_object(
      'pending_count',  (select count(*) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) payout_requests where status in ('pending', 'processing')),
      'pending_amount', (select coalesce(sum(amount), 0) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) payout_requests where status in ('pending', 'processing')),
      'paid_amount',    (select coalesce(sum(amount), 0) from (select * from public.payout_requests where not private.is_test_creator(creator_id)) payout_requests where status = 'paid')
    ),
    'refunds', jsonb_build_object(
      'count',  (select count(*) from public.payment_refunds where status = 'processed'),
      'amount', (select coalesce(sum(amount), 0) from public.payment_refunds where status = 'processed')
    ),
    'payments_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select p.status::text as status, count(*)::int as n from (select * from public.payments where not private.is_test_order(order_id)) p group by 1) s
    ),
    'failed_payments', (select count(*) from (select * from public.payments where not private.is_test_order(order_id)) payments where status = 'failed')
  );
end;
$function$;

-- admin_timeseries: 6 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_timeseries(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, orders_created integer, orders_paid integer, gmv numeric, platform_revenue numeric, orders_completed integer, new_creators integer, new_brands integer, conversion_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 7), 365);
begin
  perform private.require_admin();
  return query
  with days as (
    select generate_series(current_date - (v_days - 1), current_date, interval '1 day')::date as d
  ),
  created as (select o.created_at::date as d, count(*)::int as n from (select * from public.orders where not private.is_test_order(id)) o
              where o.created_at >= current_date - (v_days - 1) group by 1),
  paid as (select o.paid_at::date as d, count(*)::int as n from (select * from public.orders where not private.is_test_order(id)) o
           where o.paid_at >= current_date - (v_days - 1) group by 1),
  money as (select p.captured_at::date as d, sum(p.amount) as amt from (select * from public.payments where not private.is_test_order(order_id)) p
            where p.captured_at >= current_date - (v_days - 1) and p.status in ('captured', 'partially_refunded', 'refunded') group by 1),
  completed as (select o.completed_at::date as d, count(*)::int as n, sum(o.platform_fee_amount + o.brand_fee_amount) as fee from (select * from public.orders where not private.is_test_order(id)) o
                where o.completed_at >= current_date - (v_days - 1) and o.status in ('completed', 'refunded') group by 1),
  creators as (select c.created_at::date as d, count(*)::int as n from (select * from public.creators where not private.is_test_profile(profile_id)) c
               where c.created_at >= current_date - (v_days - 1) group by 1),
  brands as (select b.created_at::date as d, count(*)::int as n from (select * from public.brands where not private.is_test_profile(profile_id)) b
             where b.created_at >= current_date - (v_days - 1) group by 1)
  select
    days.d,
    coalesce(created.n, 0),
    coalesce(paid.n, 0),
    coalesce(money.amt, 0),
    coalesce(completed.fee, 0),
    coalesce(completed.n, 0),
    coalesce(creators.n, 0),
    coalesce(brands.n, 0),
    case when coalesce(created.n, 0) = 0 then 0 else round(coalesce(paid.n, 0) * 100.0 / created.n, 1) end
  from days
  left join created on created.d = days.d
  left join paid on paid.d = days.d
  left join money on money.d = days.d
  left join completed on completed.d = days.d
  left join creators on creators.d = days.d
  left join brands on brands.d = days.d
  order by days.d;
end;
$function$;

-- admin_employee_referrals: 1 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_employee_referrals()
 RETURNS TABLE(employee_id uuid, full_name text, referral_code text, phone text, email text, active boolean, added_at timestamp with time zone, onboarded bigint, live bigint, onboarded_this_month bigint, onboarded_7d bigint, last_onboarded_at timestamp with time zone, pending_applications bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();

  return query
  with by_code as (
    -- Onboarded = a creator account exists (approval created it) and has not
    -- been removed. "This month" is the calendar month in India.
    select upper(btrim(c.referral_code)) as code,
           count(*) as total,
           count(*) filter (where c.status = 'published') as published,
           count(*) filter (where c.created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')) as this_month,
           count(*) filter (where c.created_at > now() - interval '7 days') as last_7d,
           max(c.created_at) as last_at
    from (select * from public.creators where not private.is_test_profile(profile_id)) c
    where c.deleted_at is null
      and nullif(btrim(c.referral_code), '') is not null
    group by 1
  ),
  pending_by_code as (
    select upper(btrim(a.profile ->> 'referral_code')) as code, count(*) as n
    from public.applications a
    where a.role = 'creator'
      and a.status in ('new', 'reviewing')
      and nullif(btrim(a.profile ->> 'referral_code'), '') is not null
    group by 1
  ),
  all_codes as (
    select e.referral_code as code from public.employees e
    union
    select b.code from by_code b
    union
    select p.code from pending_by_code p
  )
  select e.id, e.full_name, k.code, e.phone, e.email, e.active, e.created_at,
         coalesce(b.total, 0), coalesce(b.published, 0), coalesce(b.this_month, 0), coalesce(b.last_7d, 0),
         b.last_at, coalesce(p.n, 0)
  from all_codes k
  left join public.employees e on e.referral_code = k.code
  left join by_code b on b.code = k.code
  left join pending_by_code p on p.code = k.code
  order by (e.id is null), coalesce(b.total, 0) desc, coalesce(p.n, 0) desc, e.full_name, k.code;
end;
$function$;

-- admin_creator_rankings: 1 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_creator_rankings(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, slug text, display_name text, profile_image_url text, city text, status creator_status, verified boolean, featured boolean, followers_count integer, rating numeric, review_count integer, admin_rating smallint, pinned_at timestamp with time zone, sort_order integer, rank_position bigint, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      r.admin_rating, r.pinned_at, r.sort_order,
      -- Mirrors the public page's default order exactly, so what an admin sees
      -- here is the order a visitor gets.
      row_number() over (
        order by r.sort_order asc nulls last,
                 r.pinned_at desc nulls last,
                 c.featured desc,
                 r.admin_rating desc nulls last,
                 c.verified desc, c.rating desc,
                 c.review_count desc, c.followers_count desc, c.id
      ) as rank_position,
      count(*) over () as total_count
    from (select * from public.creators where not private.is_test_profile(profile_id)) c
    left join public.creator_rankings r on r.creator_id = c.id
    where c.deleted_at is null
      and (nullif(btrim(p_status), '') is null or c.status::text = p_status)
      and (v_q is null
           or c.display_name ilike '%' || private.like_escape(v_q) || '%'
           or c.city ilike '%' || private.like_escape(v_q) || '%')
  )
  select * from ranked order by ranked.rank_position limit v_limit offset v_offset;
end;
$function$;

-- admin_creator_balances: 7 table reads now skip test accounts and their orders.
CREATE OR REPLACE FUNCTION public.admin_creator_balances()
 RETURNS TABLE(creator_id uuid, profile_id uuid, display_name text, slug text, email text, profile_image_url text, in_progress numeric, on_hold numeric, ready numeric, requested numeric, paid numeric, last_paid_at timestamp with time zone, open_request_id uuid, open_request_status payout_status, method_type payout_method_type, method_holder text, method_upi text, method_bank_name text, method_bank_last4 text, method_ifsc text, method_verified boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  perform private.require_admin();
  return query
  with earned as (
    -- in_progress: paid orders not yet approved (no earning yet)
    -- on_hold:     earned, inside the hold period, or held back
    -- ready:       earned and payable, not asked for yet
    -- requested:   earned and payable, in an open payout request
    select e.creator_id,
      coalesce(sum(e.net_amount) filter (where e.status in ('pending', 'held')), 0) as on_hold,
      coalesce(sum(e.net_amount) filter (where e.status = 'available' and r.id is null), 0) as ready,
      coalesce(sum(e.net_amount) filter (where e.status = 'available' and r.id is not null), 0) as requested,
      coalesce(sum(e.net_amount) filter (where e.status = 'paid'), 0) as paid,
      max(e.paid_at) as last_paid_at
    from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e
    left join (select * from public.payout_requests where not private.is_test_creator(creator_id)) r on r.id = e.payout_request_id and r.status in ('pending', 'processing')
    group by e.creator_id
  ),
  working as (
    select o.creator_id, sum(o.creator_earning_amount) as in_progress
    from (select * from public.orders where not private.is_test_order(id)) o
    where o.paid_at is not null
      and o.status not in ('draft', 'payment_pending', 'completed', 'cancelled', 'refunded', 'disputed')
      and not exists (select 1 from (select * from public.creator_earnings where not private.is_test_creator(creator_id) and not private.is_test_order(order_id)) e where e.order_id = o.id)
    group by o.creator_id
  ),
  open_request as (
    select distinct on (r.creator_id) r.creator_id, r.id, r.status
    from (select * from public.payout_requests where not private.is_test_creator(creator_id)) r
    where r.status in ('pending', 'processing')
    order by r.creator_id, r.created_at desc
  )
  select c.id, c.profile_id, c.display_name, c.slug, p.email, c.profile_image_url,
         coalesce(w.in_progress, 0), coalesce(x.on_hold, 0), coalesce(x.ready, 0), coalesce(x.requested, 0), coalesce(x.paid, 0), x.last_paid_at,
         q.id, q.status,
         m.method_type, m.account_holder_name, m.upi_id, m.bank_name, coalesce(m.bank_account_last4, right(m.bank_account_number, 4)), m.ifsc_code, m.verified
  from (select * from public.creators where not private.is_test_profile(profile_id)) c
  join (select * from public.profiles where not is_test) p on p.id = c.profile_id
  left join earned x on x.creator_id = c.id
  left join working w on w.creator_id = c.id
  left join open_request q on q.creator_id = c.id
  left join public.payout_methods m on m.creator_id = c.id
  where coalesce(x.on_hold, 0) + coalesce(x.ready, 0) + coalesce(x.requested, 0) + coalesce(x.paid, 0) + coalesce(w.in_progress, 0) > 0
  order by coalesce(x.ready, 0) + coalesce(x.requested, 0) desc, coalesce(x.on_hold, 0) desc, c.display_name;
end;
$function$;

commit;
