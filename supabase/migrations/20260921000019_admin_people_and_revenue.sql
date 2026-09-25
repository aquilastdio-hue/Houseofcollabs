-- =============================================================================
-- House of Collabs · 0019 · admin people directory + revenue aggregation
-- =============================================================================
-- Adds the read-only admin surfaces the panel was missing:
--
--   admin_people_stats()    account totals + DAU/WAU/MAU + pending queues
--   admin_list_people(…)    one searchable directory across every role
--   admin_revenue_summary() revenue bucketed by today/week/month/year
--
-- All three are SECURITY DEFINER and start with private.require_admin(), the
-- same pattern every other admin_* function uses. Nothing here is writable.
-- =============================================================================

-- Activity queries filter on last_seen_at; without this they seq-scan profiles.
create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc nulls last);

-- -----------------------------------------------------------------------------
-- People / activity KPIs
-- -----------------------------------------------------------------------------
create or replace function public.admin_people_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'users_active',       (select count(*) from public.profiles where status = 'active'),
    'users_suspended',    (select count(*) from public.profiles where status <> 'active'),
    'new_7d',             (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_30d',            (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    -- "Active" = seen in the window. last_seen_at is refreshed by touch_last_seen().
    'dau',                (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
    'by_role',            (select coalesce(jsonb_object_agg(coalesce(r.role::text, 'unassigned'), r.n), '{}'::jsonb)
                           from (select p.role, count(*)::int as n from public.profiles p group by 1) r),
    'creators_total',     (select count(*) from public.creators where deleted_at is null),
    'creators_published', (select count(*) from public.creators where status = 'published' and deleted_at is null),
    'creators_verified',  (select count(*) from public.creators where verified and deleted_at is null),
    'creators_pending',   (select count(*) from public.creators where status = 'pending_review' and deleted_at is null),
    'brands_total',       (select count(*) from public.brands),
    'brands_active',      (select count(*) from public.brands b
                           join public.profiles p on p.id = b.profile_id where p.status = 'active'),
    'onboarding_done',    (select count(*) from public.profiles where onboarding_completed),
    'contact_open',       (select count(*) from public.contact_messages where status = 'new'),
    'reports_open',       (select count(*) from public.reports where status in ('open', 'under_review')),
    'disputes_open',      (select count(*) from public.disputes
                           where status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')),
    'payouts_pending',    (select count(*) from public.payout_requests where status in ('pending', 'processing'))
  );
end;
$$;

comment on function public.admin_people_stats is
  'Admin-only account and activity KPIs (totals, DAU/WAU/MAU, pending queues).';

-- -----------------------------------------------------------------------------
-- Unified people directory — every profile, whatever its role
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_people(
  p_search    text default null,
  p_role      text default null,   -- 'brand' | 'creator' | 'admin' | 'unassigned'
  p_status    text default null,   -- public.account_status
  p_sort      text default 'recent',
  p_page      int  default 1,
  p_page_size int  default 25
)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  status text,
  is_admin boolean,
  verified boolean,
  display_name text,
  entity_id uuid,
  onboarding_completed boolean,
  last_seen_at timestamptz,
  created_at timestamptz,
  orders_count int,
  total_value numeric,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_size   int := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset int := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  -- Escape LIKE wildcards so a search for "%" can't scan everything.
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform private.require_admin();
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select
      p.id,
      p.full_name,
      p.email,
      p.avatar_url,
      coalesce(p.role::text, 'unassigned')          as role,
      p.status::text                                as status,
      exists (select 1 from public.admin_users a where a.profile_id = p.id) as is_admin,
      coalesce(c.verified, false)                   as verified,
      coalesce(c.display_name, b.brand_name)        as display_name,
      coalesce(c.id, b.id)                          as entity_id,
      p.onboarding_completed,
      p.last_seen_at,
      p.created_at,
      -- Orders they took part in, from whichever side they sit on. Branch on
      -- which identity exists rather than coalescing the aggregates: count(*)
      -- returns 0 (not null) for no rows, so a coalesce would always pick the
      -- creator branch and report 0 for every brand.
      case
        when c.id is not null then (select count(*) from public.orders o where o.creator_id = c.id)
        when b.id is not null then (select count(*) from public.orders o where o.brand_id = b.id)
        else 0
      end::int                                      as orders_count,
      case
        when c.id is not null then
          (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = c.id and o.paid_at is not null)
        when b.id is not null then
          (select coalesce(sum(o.total_amount), 0) from public.orders o where o.brand_id = b.id and o.paid_at is not null)
        else 0
      end                                           as total_value
    from public.profiles p
    left join public.creators c on c.profile_id = p.id and c.deleted_at is null
    left join public.brands   b on b.profile_id = p.id
    where (p_status is null or p_status = '' or p.status::text = p_status)
      and (
        p_role is null or p_role = ''
        or (p_role = 'unassigned' and p.role is null)
        or (p_role = 'admin' and exists (select 1 from public.admin_users a where a.profile_id = p.id))
        or (p_role in ('brand', 'creator') and p.role::text = p_role)
      )
      and (
        v_q is null
        or p.full_name ilike v_q
        or p.email ilike v_q
        or c.display_name ilike v_q
        or b.brand_name ilike v_q
      )
  ),
  counted as (select count(*) as n from base)
  select base.*, counted.n
  from base, counted
  order by
    case when p_sort = 'name'   then lower(coalesce(base.full_name, base.email)) end asc,
    case when p_sort = 'active' then base.last_seen_at end desc nulls last,
    case when p_sort = 'value'  then base.total_value end desc nulls last,
    case when p_sort = 'oldest' then base.created_at end asc,
    base.created_at desc
  limit v_size offset v_offset;
end;
$$;

comment on function public.admin_list_people is
  'Admin-only paginated directory of every profile with its creator/brand identity and order activity.';

-- -----------------------------------------------------------------------------
-- Revenue, bucketed by period
-- -----------------------------------------------------------------------------
create or replace function public.admin_revenue_summary()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_captured public.payment_status[] := array['captured', 'partially_refunded', 'refunded']::public.payment_status[];
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gross', jsonb_build_object(
      'today', (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('day', now())),
      'week',  (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('week', now())),
      'month', (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('month', now())),
      'year',  (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status = any(v_captured) and p.captured_at >= date_trunc('year', now())),
      'all',   (select coalesce(sum(p.amount), 0) from public.payments p where p.status = any(v_captured))
    ),
    'platform_fee', jsonb_build_object(
      'month', (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o
                where o.completed_at >= date_trunc('month', now())),
      'year',  (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o
                where o.completed_at >= date_trunc('year', now())),
      'all',   (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o where o.status = 'completed')
    ),
    'creator_earnings', jsonb_build_object(
      'available', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.status = 'available'),
      'pending',   (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.status = 'pending'),
      'paid',      (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.status = 'paid'),
      'gross',     (select coalesce(sum(e.gross_amount), 0) from public.creator_earnings e)
    ),
    'payouts', jsonb_build_object(
      'pending_count',  (select count(*) from public.payout_requests where status in ('pending', 'processing')),
      'pending_amount', (select coalesce(sum(amount), 0) from public.payout_requests where status in ('pending', 'processing')),
      'paid_amount',    (select coalesce(sum(amount), 0) from public.payout_requests where status = 'paid')
    ),
    'refunds', jsonb_build_object(
      'count',  (select count(*) from public.payment_refunds where status = 'processed'),
      'amount', (select coalesce(sum(amount), 0) from public.payment_refunds where status = 'processed')
    ),
    'payments_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select p.status::text as status, count(*)::int as n from public.payments p group by 1) s
    ),
    'failed_payments', (select count(*) from public.payments where status = 'failed')
  );
end;
$$;

comment on function public.admin_revenue_summary is
  'Admin-only revenue rollup: gross by period, platform fee, creator earnings, payouts and refunds.';

grant execute on function
  public.admin_people_stats,
  public.admin_list_people,
  public.admin_revenue_summary
to authenticated;
