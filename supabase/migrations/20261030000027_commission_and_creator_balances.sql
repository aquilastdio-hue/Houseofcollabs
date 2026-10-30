-- 0027 - Commission settings: a platform fee on brands, a commission on creators
--
-- Until now the platform earned one thing: `platform_fee_percentage`, taken out
-- of the creator's side of each order. Admin → Settings → Commission now sets
-- two percentages:
--
--   * Brand platform fee (`brand_fee_percentage`, new, starts at 0): added on top
--     of the creator's price at checkout. The brand pays price + fee.
--   * Creator commission (`platform_fee_percentage`, unchanged): taken out of
--     the price. The creator earns price − commission.
--
-- So for a ₹10,000 service at 5% and 10%: the brand pays ₹10,500, the creator
-- earns ₹9,000, the platform keeps ₹1,500.
--
-- Each order stores the percentages it was priced at, so changing a setting
-- only affects orders placed afterwards — never one already paid for. Existing
-- orders get a brand fee of 0, which is what they were charged.
--
-- Also adds `admin_creator_balances`, for Admin → Payouts → Owed to creators:
-- per creator, what's ready to pay, already requested, on hold, still in
-- progress, and paid so far.

begin;

insert into public.platform_settings (key, value, description, is_public) values
  ('brand_fee_percentage', '0', 'Percentage added on top of each order and paid by the brand at checkout.', true)
on conflict (key) do nothing;

update public.platform_settings
set description = 'Percentage of each order''s price taken out of the creator''s earnings.'
where key = 'platform_fee_percentage';

-- ---------------------------------------------------------------- orders ---
alter table public.orders
  add column if not exists brand_fee_percent numeric(5, 2) not null default 0 check (brand_fee_percent between 0 and 100),
  add column if not exists brand_fee_amount numeric(12, 2) not null default 0 check (brand_fee_amount >= 0);

comment on column public.orders.total_amount is 'What the brand pays: subtotal + addons_total + brand_fee_amount.';
comment on column public.orders.brand_fee_amount is 'Platform fee paid by the brand on top of the creator''s price.';
comment on column public.orders.platform_fee_amount is 'Commission taken out of the creator''s price.';

-- The price is subtotal + add-ons. The brand pays the price plus their fee;
-- the creator earns the price minus their commission.
alter table public.orders drop constraint if exists orders_total_matches;
alter table public.orders add constraint orders_total_matches check (total_amount = subtotal + addons_total + brand_fee_amount);
alter table public.orders drop constraint if exists orders_earning_matches;
alter table public.orders add constraint orders_earning_matches check (creator_earning_amount = subtotal + addons_total - platform_fee_amount);

create or replace function private.calculate_brand_fee(p_amount numeric)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(greatest(coalesce(p_amount, 0), 0)
    * private.setting_numeric('brand_fee_percentage', 0) / 100, 2);
$$;

-- ----------------------------------------------- functions that price, pay ---
-- The current definitions, with the brand fee added. A creator's earning,
-- revenue and gross leave the brand fee out (it isn't theirs); the platform's
-- revenue counts both fees.

-- public.calculate_order_total, from 20260919000006_order_workflow.sql
create or replace function public.calculate_order_total(p_service_id uuid, p_addon_ids uuid[] default '{}')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_service public.creator_services;
  v_ids uuid[] := coalesce(p_addon_ids, '{}');
  v_addon_total numeric(12, 2);
  v_extra_rev int;
  v_override int;
  v_valid_count int;
  v_total numeric(12, 2);
  v_fee numeric(12, 2);
  v_brand_fee numeric(12, 2);
begin
  select * into v_service from public.creator_services s
  where s.id = p_service_id and s.active and s.archived_at is null;
  if not found or not private.is_creator_public(v_service.creator_id) then
    raise exception 'This service is no longer available.' using errcode = 'P0001', hint = 'SERVICE_UNAVAILABLE';
  end if;

  select count(*), coalesce(sum(a.price), 0), coalesce(sum(a.extra_revisions), 0), min(a.delivery_days_override)
  into v_valid_count, v_addon_total, v_extra_rev, v_override
  from public.service_addons a
  where a.id = any (v_ids) and a.service_id = v_service.id and a.active;

  if v_valid_count <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'One or more add-ons are not available for this service.' using errcode = 'P0001', hint = 'INVALID_ADDONS';
  end if;

  -- v_total is the creator's price: their commission comes out of it, and
  -- the brand fee goes on top of it. `total` below is what the brand pays.
  v_total := v_service.price + v_addon_total;
  v_fee := public.calculate_platform_fee(v_total);
  v_brand_fee := private.calculate_brand_fee(v_total);

  return jsonb_build_object(
    'service_id', v_service.id,
    'subtotal', v_service.price,
    'addons_total', v_addon_total,
    'price', v_total,
    'brand_fee_percent', private.setting_numeric('brand_fee_percentage', 0),
    'brand_fee', v_brand_fee,
    'total', v_total + v_brand_fee,
    'currency', 'INR',
    'platform_fee_percent', private.setting_numeric('platform_fee_percentage', 10),
    'platform_fee', v_fee,
    'creator_earning', v_total - v_fee,
    'delivery_days', least(v_service.delivery_days, coalesce(v_override, v_service.delivery_days)),
    'revisions', least(v_service.revisions_included + v_extra_rev, private.setting_numeric('max_revisions', 5)::int),
    'requires_shipping', v_service.requires_shipping
  );
end;
$$;

-- public.create_order, from 20260919000006_order_workflow.sql
create or replace function public.create_order(
  p_service_id uuid,
  p_addon_ids uuid[] default '{}',
  p_brief_id uuid default null,
  p_requirements text default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_brand public.brands;
  v_service public.creator_services;
  v_creator public.creators;
  v_brief public.briefs;
  v_quote jsonb;
  v_order public.orders;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_addon_ids, '{}'::uuid[])) x);
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;

  select * into v_brand from public.brands where profile_id = auth.uid();
  if not found then
    raise exception 'Only brands can place orders. Complete your brand profile first.' using errcode = 'P0001', hint = 'BRAND_REQUIRED';
  end if;

  select * into v_service from public.creator_services where id = p_service_id and active and archived_at is null;
  if not found then
    raise exception 'This service is no longer available.' using errcode = 'P0001', hint = 'SERVICE_UNAVAILABLE';
  end if;

  select * into v_creator from public.creators where id = v_service.creator_id;
  if not private.is_creator_public(v_creator.id) or not v_creator.available then
    raise exception 'This creator is not accepting orders right now.' using errcode = 'P0001', hint = 'CREATOR_UNAVAILABLE';
  end if;

  if p_brief_id is not null then
    select * into v_brief from public.briefs where id = p_brief_id and brand_id = v_brand.id;
    if not found then
      raise exception 'Brief not found.' using errcode = 'P0002', hint = 'BRIEF_NOT_FOUND';
    end if;
  end if;

  v_quote := public.calculate_order_total(v_service.id, v_ids);

  insert into public.orders (
    brand_id, creator_id, service_id, brief_id, status,
    service_title, service_description, content_type, delivery_days,
    revisions_allowed, requires_shipping,
    subtotal, addons_total, total_amount, currency,
    platform_fee_percent, platform_fee_amount, creator_earning_amount,
    brand_fee_percent, brand_fee_amount,
    brief_snapshot, requirements
  ) values (
    v_brand.id, v_creator.id, v_service.id, p_brief_id, 'payment_pending',
    v_service.title, v_service.description, v_service.content_type, (v_quote ->> 'delivery_days')::int,
    (v_quote ->> 'revisions')::int, v_service.requires_shipping,
    (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'addons_total')::numeric, (v_quote ->> 'total')::numeric, 'INR',
    (v_quote ->> 'platform_fee_percent')::numeric, (v_quote ->> 'platform_fee')::numeric, (v_quote ->> 'creator_earning')::numeric,
    (v_quote ->> 'brand_fee_percent')::numeric, (v_quote ->> 'brand_fee')::numeric,
    case when p_brief_id is not null then to_jsonb(v_brief) - 'brand_id' end,
    nullif(btrim(p_requirements), '')
  )
  returning * into v_order;

  insert into public.order_items (order_id, item_type, service_id, name, description, unit_price, quantity, total_price, metadata)
  values (
    v_order.id, 'service', v_service.id, v_service.title, v_service.description, v_service.price, 1, v_service.price,
    jsonb_build_object('delivery_days', v_service.delivery_days, 'revisions_included', v_service.revisions_included,
                       'includes', to_jsonb(v_service.includes), 'content_type', v_service.content_type)
  );

  insert into public.order_items (order_id, item_type, service_id, addon_id, name, description, unit_price, quantity, total_price, metadata)
  select v_order.id, 'addon', v_service.id, a.id, a.name, a.description, a.price, 1, a.price,
         jsonb_build_object('addon_type', a.addon_type, 'extra_revisions', a.extra_revisions,
                            'delivery_days_override', a.delivery_days_override)
  from public.service_addons a
  where a.id = any (v_ids) and a.service_id = v_service.id and a.active;

  if v_service.requires_shipping then
    insert into public.shipping_details (order_id, shipping_required) values (v_order.id, true);
  end if;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by, actor_role, reason)
  values (v_order.id, null, 'payment_pending', auth.uid(), 'brand', 'Order created');

  perform private.audit('order_created', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total_amount,
                       'creator_id', v_creator.id, 'service_id', v_service.id, 'addons', to_jsonb(v_ids)),
    auth.uid(), 'brand');
  return v_order;
end;
$$;

-- private.create_creator_earning, from 20260919000006_order_workflow.sql
create or replace function private.create_creator_earning(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_hold int := greatest(private.setting_numeric('earning_hold_days', 0)::int, 0);
begin
  select * into v_order from public.orders where id = p_order_id;
  insert into public.creator_earnings (creator_id, order_id, gross_amount, platform_fee, net_amount, status, available_at)
  values (
    v_order.creator_id, v_order.id, v_order.total_amount - v_order.brand_fee_amount, v_order.platform_fee_amount, v_order.creator_earning_amount,
    case when v_hold = 0 then 'available'::public.earning_status else 'pending'::public.earning_status end,
    now() + make_interval(days => v_hold)
  )
  on conflict (order_id) do nothing;
end;
$$;

-- public.admin_update_setting, from 20260919000010_admin.sql
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns public.platform_settings
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.platform_settings;
  v_num numeric;
begin
  if p_key in ('platform_fee_percentage', 'brand_fee_percentage', 'minimum_payout_amount', 'max_revisions', 'earning_hold_days',
               'creator_response_hours', 'auto_approve_days', 'payment_expiry_hours') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'This setting must be a number.' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if (p_key in ('platform_fee_percentage', 'brand_fee_percentage') and v_num not between 0 and 50)
      or (p_key = 'minimum_payout_amount' and v_num not between 0 and 1000000)
      or (p_key = 'max_revisions' and (v_num not between 0 and 10 or v_num <> trunc(v_num)))
      or (p_key = 'earning_hold_days' and (v_num not between 0 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'creator_response_hours' and (v_num not between 1 and 720 or v_num <> trunc(v_num)))
      or (p_key = 'auto_approve_days' and (v_num not between 1 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'payment_expiry_hours' and (v_num not between 1 and 168 or v_num <> trunc(v_num))) then
      raise exception 'Value out of range for %.', p_key using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
  elsif p_key = 'require_creator_approval' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'This setting must be true or false.' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
  elsif p_key in ('cancellation_rules', 'refund_rules', 'support_email') then
    if jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 4000 then
      raise exception 'This setting must be text (max 4000 characters).' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
  else
    raise exception 'Unknown setting: %', p_key using errcode = 'P0001', hint = 'UNKNOWN_SETTING';
  end if;

  update public.platform_settings set value = p_value, updated_by = v_admin where key = p_key returning * into v_row;
  if not found then
    raise exception 'Unknown setting: %', p_key using errcode = 'P0001', hint = 'UNKNOWN_SETTING';
  end if;
  return v_row;
end;
$$;

-- public.admin_dashboard_stats, from 20261028000017_fix_admin_stats_without_disputes.sql
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gmv', (select coalesce(sum(p.amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'net_gmv', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'gmv_30d', (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status in ('captured', 'partially_refunded', 'refunded') and p.captured_at > now() - interval '30 days'),
    'platform_revenue', (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from public.orders o where o.status = 'completed'),
    'orders_total', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending')),
    'orders_30d', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending') and o.created_at > now() - interval '30 days'),
    'avg_order_value', (select coalesce(round(avg(o.total_amount)), 0) from public.orders o where o.paid_at is not null),
    -- Every creator account: live, suspended, or with the storefront removed.
    'creators_total', (select count(*) from public.creators c),
    'creators_published', (select count(*) from public.creators c where c.status = 'published' and c.deleted_at is null),
    'creators_pending_review', (select count(*) from public.creators c where c.status = 'pending_review' and c.deleted_at is null),
    'brands_total', (select count(*) from public.brands),
    'active_collaborations', (select count(*) from public.orders o where o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'completed_orders', (select count(*) from public.orders o where o.status = 'completed'),
    'pending_payouts_count', (select count(*) from public.payout_requests pr where pr.status in ('pending', 'processing')),
    'pending_payouts_amount', (select coalesce(sum(pr.amount), 0) from public.payout_requests pr where pr.status in ('pending', 'processing')),
    'refunds_count', (select count(*) from public.payment_refunds r where r.status = 'processed'),
    'refunds_amount', (select coalesce(sum(r.amount), 0) from public.payment_refunds r where r.status = 'processed'),
    'refunds_required', (select count(*) from public.orders o where o.refund_required),
    'reports_open', (select count(*) from public.reports r where r.status in ('open', 'under_review')),
    'orders_by_status', (select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
                         from (select o.status, count(*) as cnt from public.orders o group by o.status) s)
  );
end;
$function$;

-- public.admin_revenue_summary, from 20260921000019_admin_people_and_revenue.sql
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
      'month', (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from public.orders o
                where o.completed_at >= date_trunc('month', now())),
      'year',  (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from public.orders o
                where o.completed_at >= date_trunc('year', now())),
      'all',   (select coalesce(sum(o.platform_fee_amount + o.brand_fee_amount), 0) from public.orders o where o.status = 'completed')
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

-- public.admin_timeseries, from 20260919000010_admin.sql
create or replace function public.admin_timeseries(p_days int default 30)
returns table (
  day date,
  orders_created int,
  orders_paid int,
  gmv numeric,
  platform_revenue numeric,
  orders_completed int,
  new_creators int,
  new_brands int,
  conversion_rate numeric
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 7), 365);
begin
  perform private.require_admin();
  return query
  with days as (
    select generate_series(current_date - (v_days - 1), current_date, interval '1 day')::date as d
  ),
  created as (select o.created_at::date as d, count(*)::int as n from public.orders o
              where o.created_at >= current_date - (v_days - 1) group by 1),
  paid as (select o.paid_at::date as d, count(*)::int as n from public.orders o
           where o.paid_at >= current_date - (v_days - 1) group by 1),
  money as (select p.captured_at::date as d, sum(p.amount) as amt from public.payments p
            where p.captured_at >= current_date - (v_days - 1) and p.status in ('captured', 'partially_refunded', 'refunded') group by 1),
  completed as (select o.completed_at::date as d, count(*)::int as n, sum(o.platform_fee_amount + o.brand_fee_amount) as fee from public.orders o
                where o.completed_at >= current_date - (v_days - 1) and o.status in ('completed', 'refunded') group by 1),
  creators as (select c.created_at::date as d, count(*)::int as n from public.creators c
               where c.created_at >= current_date - (v_days - 1) group by 1),
  brands as (select b.created_at::date as d, count(*)::int as n from public.brands b
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
$$;

-- public.admin_list_creators, from 20261014000071_creators_whatsapp.sql
CREATE OR REPLACE FUNCTION public.admin_list_creators(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_verified boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_include_deleted boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, profile_id uuid, display_name text, slug text, email text, whatsapp text, profile_image_url text, city text, state text, status creator_status, account_status account_status, verified boolean, featured boolean, available boolean, followers_count integer, rating numeric, review_count integer, categories text[], orders_count bigint, revenue numeric, joined_at timestamp with time zone, deleted_at timestamp with time zone, referral_code text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
  v_digits text;
  v_phone text;
begin
  perform private.require_admin();
  if btrim(coalesce(p_search, '')) ~ '^[0-9 +()-]+$' then
    v_digits := regexp_replace(p_search, '[^0-9]', '', 'g');
    v_phone := private.normalize_phone(p_search);
  end if;
  if length(coalesce(v_digits, '')) < 4 then
    v_digits := null;
  end if;

  return query
  with base as (
    select c.*, pr.email as p_email, private.creator_whatsapp(c.profile_id) as p_whatsapp, pr.status as p_status
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id
    where (coalesce(p_include_deleted, false) or c.deleted_at is null)
      and (nullif(p_status, '') is null or c.status::text = p_status)
      and (p_verified is null or c.verified = p_verified)
      and (p_featured is null or c.featured = p_featured)
  ),
  matched as (
    select b.* from base b
    where nullif(btrim(p_search), '') is null or b.display_name ilike v_like or b.p_email ilike v_like
          or b.city ilike v_like or b.slug ilike v_like
          or b.referral_code ilike v_like
          or (v_digits is not null and (regexp_replace(coalesce(b.p_whatsapp, ''), '[^0-9]', '', 'g') like '%' || v_digits || '%'
                                        or private.normalize_phone(b.p_whatsapp) like '%' || v_phone || '%'))
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.creator_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(o.total_amount - o.brand_fee_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
    from matched b
  )
  select b.id, b.profile_id, b.display_name, b.slug, b.p_email, b.p_whatsapp, b.profile_image_url, b.city, b.state, b.status, b.p_status,
         b.verified, b.featured, b.available, b.followers_count, b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at, b.referral_code,
         count(*) over ()
  from matched b join agg a on a.id = b.id
  order by
    case when p_sort = 'revenue' then a.revenue end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'followers' then b.followers_count end desc nulls last,
    case when p_sort = 'rating' then b.rating end desc nulls last,
    case when p_sort = 'name' then b.display_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

-- ------------------------------------------------------ owed to creators ---
create or replace function public.admin_creator_balances()
returns table (
  creator_id uuid,
  profile_id uuid,
  display_name text,
  slug text,
  email text,
  profile_image_url text,
  in_progress numeric,
  on_hold numeric,
  ready numeric,
  requested numeric,
  paid numeric,
  last_paid_at timestamptz,
  open_request_id uuid,
  open_request_status public.payout_status,
  method_type public.payout_method_type,
  method_holder text,
  method_upi text,
  method_bank_name text,
  method_bank_last4 text,
  method_ifsc text,
  method_verified boolean
)
language plpgsql stable security definer set search_path = ''
as $$
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
    from public.creator_earnings e
    left join public.payout_requests r on r.id = e.payout_request_id and r.status in ('pending', 'processing')
    group by e.creator_id
  ),
  working as (
    select o.creator_id, sum(o.creator_earning_amount) as in_progress
    from public.orders o
    where o.paid_at is not null
      and o.status not in ('draft', 'payment_pending', 'completed', 'cancelled', 'refunded', 'disputed')
      and not exists (select 1 from public.creator_earnings e where e.order_id = o.id)
    group by o.creator_id
  ),
  open_request as (
    select distinct on (r.creator_id) r.creator_id, r.id, r.status
    from public.payout_requests r
    where r.status in ('pending', 'processing')
    order by r.creator_id, r.created_at desc
  )
  select c.id, c.profile_id, c.display_name, c.slug, p.email, c.profile_image_url,
         coalesce(w.in_progress, 0), coalesce(x.on_hold, 0), coalesce(x.ready, 0), coalesce(x.requested, 0), coalesce(x.paid, 0), x.last_paid_at,
         q.id, q.status,
         m.method_type, m.account_holder_name, m.upi_id, m.bank_name, coalesce(m.bank_account_last4, right(m.bank_account_number, 4)), m.ifsc_code, m.verified
  from public.creators c
  join public.profiles p on p.id = c.profile_id
  left join earned x on x.creator_id = c.id
  left join working w on w.creator_id = c.id
  left join open_request q on q.creator_id = c.id
  left join public.payout_methods m on m.creator_id = c.id
  where coalesce(x.on_hold, 0) + coalesce(x.ready, 0) + coalesce(x.requested, 0) + coalesce(x.paid, 0) + coalesce(w.in_progress, 0) > 0
  order by coalesce(x.ready, 0) + coalesce(x.requested, 0) desc, coalesce(x.on_hold, 0) desc, c.display_name;
end;
$$;

revoke execute on function public.admin_creator_balances() from public, anon;
grant execute on function public.admin_creator_balances() to authenticated;
revoke execute on function private.calculate_brand_fee(numeric) from public;

commit;
