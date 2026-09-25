-- =============================================================================
-- Spotlit · 0010 · admin + scheduled maintenance
-- Every admin_* function verifies private.is_admin() and writes audit logs.
-- =============================================================================

create or replace function private.require_admin()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501', hint = 'ADMIN_REQUIRED';
  end if;
  return auth.uid();
end;
$$;

-- Promote an existing account to admin. NOT exposed through the API; run it from
-- the SQL editor / psql as the database owner:
--   select private.grant_admin('you@example.com');
create or replace function private.grant_admin(p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.profiles where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'No account found for %', p_email;
  end if;
  update public.profiles set role = 'admin', onboarding_completed = true where id = v_id;
  insert into public.admin_users (profile_id) values (v_id)
  on conflict (profile_id) do update set active = true;
  perform private.audit('admin_granted', 'profile', v_id::text, '{}'::jsonb, null, 'system');
  return v_id;
end;
$$;

create or replace function private.revoke_admin(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.profiles where lower(email) = lower(btrim(p_email));
  update public.admin_users set active = false where profile_id = v_id;
  perform private.audit('admin_revoked', 'profile', v_id::text, '{}'::jsonb, null, 'system');
end;
$$;

-- -----------------------------------------------------------------------------
-- Analytics
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'gmv', (select coalesce(sum(p.amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'net_gmv', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p where p.status in ('captured', 'partially_refunded', 'refunded')),
    'gmv_30d', (select coalesce(sum(p.amount), 0) from public.payments p
                where p.status in ('captured', 'partially_refunded', 'refunded') and p.captured_at > now() - interval '30 days'),
    'platform_revenue', (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o where o.status = 'completed'),
    'orders_total', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending')),
    'orders_30d', (select count(*) from public.orders o where o.status not in ('draft', 'payment_pending') and o.created_at > now() - interval '30 days'),
    'avg_order_value', (select coalesce(round(avg(o.total_amount)), 0) from public.orders o where o.paid_at is not null),
    'creators_total', (select count(*) from public.creators c where c.deleted_at is null),
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
    'disputes_open', (select count(*) from public.disputes d where d.status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')),
    'reports_open', (select count(*) from public.reports r where r.status in ('open', 'under_review')),
    'orders_by_status', (select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
                         from (select o.status, count(*) as cnt from public.orders o group by o.status) s)
  );
end;
$$;

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
  completed as (select o.completed_at::date as d, count(*)::int as n, sum(o.platform_fee_amount) as fee from public.orders o
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

-- -----------------------------------------------------------------------------
-- Creator management
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_creators(
  p_search text default null,
  p_status text default null,
  p_verified boolean default null,
  p_featured boolean default null,
  p_include_deleted boolean default false,
  p_sort text default 'newest',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  slug text,
  email text,
  profile_image_url text,
  city text,
  state text,
  status public.creator_status,
  account_status public.account_status,
  verified boolean,
  featured boolean,
  available boolean,
  followers_count int,
  rating numeric,
  review_count int,
  categories text[],
  orders_count bigint,
  revenue numeric,
  joined_at timestamptz,
  deleted_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
begin
  perform private.require_admin();
  return query
  with base as (
    select c.*, pr.email as p_email, pr.status as p_status
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id
    where (coalesce(p_include_deleted, false) or c.deleted_at is null)
      and (nullif(btrim(p_search), '') is null or c.display_name ilike v_like or pr.email ilike v_like
           or c.city ilike v_like or c.slug ilike v_like)
      and (nullif(p_status, '') is null or c.status::text = p_status)
      and (p_verified is null or c.verified = p_verified)
      and (p_featured is null or c.featured = p_featured)
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.creator_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(o.total_amount), 0) from public.orders o where o.creator_id = b.id and o.status = 'completed') as revenue
    from base b
  )
  select b.id, b.profile_id, b.display_name, b.slug, b.p_email, b.profile_image_url, b.city, b.state, b.status, b.p_status,
         b.verified, b.featured, b.available, b.followers_count, b.rating, b.review_count,
         coalesce(array(select cat.name from public.creator_categories cc join public.categories cat on cat.id = cc.category_id
                        where cc.creator_id = b.id order by cc.is_primary desc), '{}'::text[]),
         a.orders_count, a.revenue, b.created_at, b.deleted_at,
         count(*) over ()
  from base b join agg a on a.id = b.id
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
$$;

create or replace function public.admin_set_creator_status(
  p_creator_id uuid,
  p_status public.creator_status,
  p_reason text default null
)
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c public.creators;
  v_old public.creator_status;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select * into v_c from public.creators where id = p_creator_id for update;
  if not found then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  v_old := v_c.status;
  if p_status in ('rejected', 'suspended') and v_reason is null then
    raise exception 'Add a reason so the creator knows what to fix.' using errcode = 'P0001', hint = 'REASON_REQUIRED';
  end if;
  if p_status = 'draft' then
    raise exception 'Creators cannot be moved back to draft.' using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;

  update public.creators
  set status = p_status,
      rejection_reason = case when p_status in ('rejected', 'suspended') then v_reason else null end,
      published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
      approved_at = case when p_status = 'published' then coalesce(approved_at, now()) else approved_at end
  where id = v_c.id returning * into v_c;

  if p_status = 'published' then
    perform private.notify(v_c.profile_id, 'profile_approved', 'Your profile is live',
      'Your creator profile was approved. Brands can now discover and hire you.', 'creator', v_c.id, '/creator');
  elsif p_status = 'rejected' then
    perform private.notify(v_c.profile_id, 'profile_rejected', 'Your profile needs changes', v_reason, 'creator', v_c.id, '/creator/profile');
  elsif p_status = 'suspended' then
    perform private.notify(v_c.profile_id, 'profile_suspended', 'Your profile was suspended', v_reason, 'creator', v_c.id, '/creator');
  end if;

  perform private.audit(
    case p_status
      when 'published' then case when v_old = 'suspended' then 'creator_reinstated' else 'creator_approved' end
      when 'rejected' then 'creator_rejected'
      when 'suspended' then 'creator_suspended'
      else 'creator_status_changed'
    end,
    'creator', v_c.id::text,
    jsonb_build_object('from', v_old, 'to', p_status, 'reason', v_reason), v_admin, 'admin');
  return v_c;
end;
$$;

create or replace function public.admin_set_creator_flags(
  p_creator_id uuid,
  p_verified boolean default null,
  p_featured boolean default null
)
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_old public.creators;
  v_c public.creators;
begin
  select * into v_old from public.creators where id = p_creator_id for update;
  if not found then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  update public.creators
  set verified = coalesce(p_verified, verified),
      featured = coalesce(p_featured, featured)
  where id = p_creator_id returning * into v_c;

  if v_c.verified and not v_old.verified then
    perform private.notify(v_c.profile_id, 'creator_verified', 'You are now verified',
      'Your profile now shows the verified badge.', 'creator', v_c.id, '/creator');
  end if;
  if v_c.verified is distinct from v_old.verified then
    perform private.audit(case when v_c.verified then 'creator_verified' else 'creator_unverified' end,
      'creator', v_c.id::text, '{}'::jsonb, v_admin, 'admin');
  end if;
  if v_c.featured is distinct from v_old.featured then
    perform private.audit(case when v_c.featured then 'creator_featured' else 'creator_unfeatured' end,
      'creator', v_c.id::text, '{}'::jsonb, v_admin, 'admin');
  end if;
  return v_c;
end;
$$;

create or replace function public.admin_update_creator(p_creator_id uuid, p_patch jsonb)
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c public.creators;
  v_keys text[] := array(select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)));
  v_allowed text[] := array['display_name', 'headline', 'bio', 'city', 'state', 'creator_type', 'available', 'response_time'];
begin
  if exists (select 1 from unnest(v_keys) k where not (k = any (v_allowed))) then
    raise exception 'Only these fields can be edited: %', array_to_string(v_allowed, ', ') using errcode = 'P0001', hint = 'INVALID_FIELDS';
  end if;
  update public.creators c
  set display_name = case when p_patch ? 'display_name' then p_patch ->> 'display_name' else c.display_name end,
      headline = case when p_patch ? 'headline' then nullif(p_patch ->> 'headline', '') else c.headline end,
      bio = case when p_patch ? 'bio' then nullif(p_patch ->> 'bio', '') else c.bio end,
      city = case when p_patch ? 'city' then nullif(p_patch ->> 'city', '') else c.city end,
      state = case when p_patch ? 'state' then nullif(p_patch ->> 'state', '') else c.state end,
      creator_type = case when p_patch ? 'creator_type' then nullif(p_patch ->> 'creator_type', '') else c.creator_type end,
      available = case when p_patch ? 'available' then (p_patch ->> 'available')::boolean else c.available end,
      response_time = case when p_patch ? 'response_time' then nullif(p_patch ->> 'response_time', '') else c.response_time end
  where c.id = p_creator_id
  returning * into v_c;
  if not found then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  perform private.audit('admin_creator_edited', 'creator', v_c.id::text, jsonb_build_object('fields', to_jsonb(v_keys)), v_admin, 'admin');
  return v_c;
end;
$$;

create or replace function public.admin_soft_delete_creator(p_creator_id uuid, p_reason text default null)
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c public.creators;
begin
  update public.creators
  set deleted_at = now(), status = 'suspended', available = false,
      rejection_reason = coalesce(nullif(btrim(p_reason), ''), 'Removed by admin')
  where id = p_creator_id and deleted_at is null
  returning * into v_c;
  if not found then
    raise exception 'Creator not found or already removed.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  perform private.audit('creator_soft_deleted', 'creator', v_c.id::text, jsonb_build_object('reason', p_reason), v_admin, 'admin');
  return v_c;
end;
$$;

create or replace function public.admin_restore_creator(p_creator_id uuid)
returns public.creators
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c public.creators;
begin
  update public.creators set deleted_at = null, status = 'pending_review'
  where id = p_creator_id and deleted_at is not null
  returning * into v_c;
  if not found then
    raise exception 'Creator not found.' using errcode = 'P0002', hint = 'CREATOR_NOT_FOUND';
  end if;
  perform private.audit('creator_restored', 'creator', v_c.id::text, '{}'::jsonb, v_admin, 'admin');
  return v_c;
end;
$$;

-- -----------------------------------------------------------------------------
-- Brand + account management
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_brands(
  p_search text default null,
  p_status text default null,
  p_sort text default 'newest',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  profile_id uuid,
  brand_name text,
  brand_slug text,
  brand_logo_url text,
  email text,
  contact_email text,
  contact_phone text,
  industry text,
  location text,
  account_status public.account_status,
  orders_count bigint,
  spend numeric,
  last_activity_at timestamptz,
  joined_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_like text := '%' || private.like_escape(btrim(coalesce(p_search, ''))) || '%';
begin
  perform private.require_admin();
  return query
  with base as (
    select b.*, pr.email as p_email, pr.status as p_status, pr.last_seen_at as p_last_seen
    from public.brands b
    join public.profiles pr on pr.id = b.profile_id
    where (nullif(btrim(p_search), '') is null or b.brand_name ilike v_like or pr.email ilike v_like
           or b.contact_email ilike v_like or b.industry ilike v_like)
      and (nullif(p_status, '') is null or pr.status::text = p_status)
  ),
  agg as (
    select b.id,
      (select count(*) from public.orders o where o.brand_id = b.id and o.status not in ('draft', 'payment_pending')) as orders_count,
      (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p join public.orders o on o.id = p.order_id
        where o.brand_id = b.id and p.status in ('captured', 'partially_refunded', 'refunded')) as spend,
      greatest(
        b.p_last_seen,
        (select max(o.created_at) from public.orders o where o.brand_id = b.id),
        (select max(m.created_at) from public.messages m where m.sender_id = b.profile_id)
      ) as last_activity
    from base b
  )
  select b.id, b.profile_id, b.brand_name, b.brand_slug, b.brand_logo_url, b.p_email, b.contact_email, b.contact_phone,
         b.industry, b.location, b.p_status, a.orders_count, a.spend, a.last_activity, b.created_at,
         count(*) over ()
  from base b join agg a on a.id = b.id
  order by
    case when p_sort = 'spend' then a.spend end desc nulls last,
    case when p_sort = 'orders' then a.orders_count end desc nulls last,
    case when p_sort = 'activity' then a.last_activity end desc nulls last,
    case when p_sort = 'name' then b.brand_name end asc,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_update_brand(p_brand_id uuid, p_patch jsonb)
returns public.brands
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_b public.brands;
  v_keys text[] := array(select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)));
  v_allowed text[] := array['brand_name', 'description', 'industry', 'location', 'website_url', 'instagram_url', 'contact_email', 'contact_phone'];
begin
  if exists (select 1 from unnest(v_keys) k where not (k = any (v_allowed))) then
    raise exception 'Only these fields can be edited: %', array_to_string(v_allowed, ', ') using errcode = 'P0001', hint = 'INVALID_FIELDS';
  end if;
  update public.brands b
  set brand_name = case when p_patch ? 'brand_name' then p_patch ->> 'brand_name' else b.brand_name end,
      description = case when p_patch ? 'description' then nullif(p_patch ->> 'description', '') else b.description end,
      industry = case when p_patch ? 'industry' then nullif(p_patch ->> 'industry', '') else b.industry end,
      location = case when p_patch ? 'location' then nullif(p_patch ->> 'location', '') else b.location end,
      website_url = case when p_patch ? 'website_url' then nullif(p_patch ->> 'website_url', '') else b.website_url end,
      instagram_url = case when p_patch ? 'instagram_url' then nullif(p_patch ->> 'instagram_url', '') else b.instagram_url end,
      contact_email = case when p_patch ? 'contact_email' then nullif(p_patch ->> 'contact_email', '') else b.contact_email end,
      contact_phone = case when p_patch ? 'contact_phone' then nullif(p_patch ->> 'contact_phone', '') else b.contact_phone end
  where b.id = p_brand_id
  returning * into v_b;
  if not found then
    raise exception 'Brand not found.' using errcode = 'P0002', hint = 'BRAND_NOT_FOUND';
  end if;
  perform private.audit('admin_brand_edited', 'brand', v_b.id::text, jsonb_build_object('fields', to_jsonb(v_keys)), v_admin, 'admin');
  return v_b;
end;
$$;

create or replace function public.admin_set_user_status(p_profile_id uuid, p_status public.account_status, p_reason text default null)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_p public.profiles;
  v_old public.account_status;
begin
  if p_profile_id = v_admin then
    raise exception 'You cannot change your own account status.' using errcode = 'P0001', hint = 'SELF_ACTION';
  end if;
  select status into v_old from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002', hint = 'USER_NOT_FOUND';
  end if;
  update public.profiles set status = p_status where id = p_profile_id returning * into v_p;
  if p_status = 'suspended' then
    perform private.notify(p_profile_id, 'account_suspended', 'Your account was suspended',
      coalesce(nullif(btrim(p_reason), ''), 'Contact support for details.'), 'profile', p_profile_id, null);
  elsif p_status = 'active' and v_old <> 'active' then
    perform private.notify(p_profile_id, 'account_reactivated', 'Your account is active again', null, 'profile', p_profile_id, null);
  end if;
  perform private.audit(
    case p_status when 'suspended' then 'user_suspended' when 'active' then 'user_reactivated' else 'user_deleted' end,
    'profile', p_profile_id::text, jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason), v_admin, 'admin');
  return v_p;
end;
$$;

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns public.platform_settings
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.platform_settings;
  v_num numeric;
begin
  if p_key in ('platform_fee_percentage', 'minimum_payout_amount', 'max_revisions', 'earning_hold_days',
               'creator_response_hours', 'auto_approve_days', 'payment_expiry_hours') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'This setting must be a number.' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if (p_key = 'platform_fee_percentage' and v_num not between 0 and 50)
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

-- -----------------------------------------------------------------------------
-- Moderation: reports, reviews, portfolio, disputes, contact messages
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns public.reports
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_r public.reports;
begin
  update public.reports
  set status = p_status,
      admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
      resolved_by = case when p_status in ('resolved', 'dismissed') then v_admin else resolved_by end,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else resolved_at end
  where id = p_report_id returning * into v_r;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002', hint = 'REPORT_NOT_FOUND';
  end if;
  perform private.audit('report_' || p_status::text, 'report', v_r.id::text, jsonb_build_object('note', p_note), v_admin, 'admin');
  return v_r;
end;
$$;

create or replace function public.admin_moderate_review(p_review_id uuid, p_status text)
returns public.reviews
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_r public.reviews;
begin
  if p_status not in ('published', 'hidden') then
    raise exception 'Invalid review status.' using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;
  update public.reviews set status = p_status where id = p_review_id returning * into v_r;
  if not found then
    raise exception 'Review not found.' using errcode = 'P0002', hint = 'REVIEW_NOT_FOUND';
  end if;
  perform private.audit('review_' || p_status, 'review', v_r.id::text, '{}'::jsonb, v_admin, 'admin');
  return v_r;
end;
$$;

create or replace function public.admin_moderate_portfolio_item(p_item_id uuid, p_hidden boolean)
returns public.portfolio_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_i public.portfolio_items;
begin
  update public.portfolio_items set is_hidden = p_hidden where id = p_item_id returning * into v_i;
  if not found then
    raise exception 'Portfolio item not found.' using errcode = 'P0002', hint = 'ITEM_NOT_FOUND';
  end if;
  perform private.audit(case when p_hidden then 'portfolio_hidden' else 'portfolio_restored' end,
    'portfolio_item', v_i.id::text, jsonb_build_object('creator_id', v_i.creator_id), v_admin, 'admin');
  return v_i;
end;
$$;

create or replace function public.admin_update_dispute(p_dispute_id uuid, p_status public.dispute_status, p_note text default null)
returns public.disputes
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_d public.disputes;
begin
  if p_status not in ('under_review', 'waiting_for_brand', 'waiting_for_creator') then
    raise exception 'Use the resolution actions to close a dispute.' using errcode = 'P0001', hint = 'USE_RESOLUTION';
  end if;
  update public.disputes set status = p_status
  where id = p_dispute_id and status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator')
  returning * into v_d;
  if not found then
    raise exception 'Open dispute not found.' using errcode = 'P0002', hint = 'DISPUTE_NOT_FOUND';
  end if;
  if nullif(btrim(p_note), '') is not null then
    perform public.add_dispute_message(v_d.id, p_note, '[]'::jsonb);
  end if;
  perform private.audit('dispute_status_changed', 'dispute', v_d.id::text, jsonb_build_object('status', p_status), v_admin, 'admin');
  return v_d;
end;
$$;

create or replace function public.admin_update_contact_message(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  if p_status not in ('new', 'read', 'archived') then
    raise exception 'Invalid status.' using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;
  update public.contact_messages set status = p_status where id = p_id;
  perform private.audit('contact_message_' || p_status, 'contact_message', p_id::text, '{}'::jsonb, v_admin, 'admin');
end;
$$;

create or replace function public.admin_broadcast_notification(
  p_audience text,
  p_title text,
  p_message text,
  p_action_url text default null
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_count int;
begin
  if p_audience not in ('all', 'brands', 'creators') then
    raise exception 'Choose an audience: all, brands or creators.' using errcode = 'P0001', hint = 'INVALID_AUDIENCE';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 then
    raise exception 'Add a title.' using errcode = 'P0001', hint = 'TITLE_REQUIRED';
  end if;
  insert into public.notifications (user_id, type, title, message, reference_type, action_url)
  select p.id, 'announcement', left(btrim(p_title), 200), left(nullif(btrim(p_message), ''), 1000), 'announcement', nullif(btrim(p_action_url), '')
  from public.profiles p
  where p.status = 'active'
    and (p_audience = 'all'
         or (p_audience = 'brands' and p.role = 'brand')
         or (p_audience = 'creators' and p.role = 'creator'));
  get diagnostics v_count = row_count;
  perform private.audit('notification_broadcast', 'notification', null,
    jsonb_build_object('audience', p_audience, 'title', p_title, 'recipients', v_count), v_admin, 'admin');
  return v_count;
end;
$$;

create or replace function public.admin_reveal_payout_method(p_payout_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_result jsonb;
begin
  select jsonb_build_object(
    'method_type', pm.method_type,
    'account_holder_name', pm.account_holder_name,
    'upi_id', pm.upi_id,
    'bank_account_number', pm.bank_account_number,
    'ifsc_code', pm.ifsc_code,
    'bank_name', pm.bank_name
  ) into v_result
  from public.payout_requests pr
  join public.payout_methods pm on pm.creator_id = pr.creator_id
  where pr.id = p_payout_request_id;
  if v_result is null then
    raise exception 'Payout method not found.' using errcode = 'P0002', hint = 'PAYOUT_METHOD_NOT_FOUND';
  end if;
  perform private.audit('payout_details_viewed', 'payout_request', p_payout_request_id::text, '{}'::jsonb, v_admin, 'admin');
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: admin order actions (called by admin-order-action Edge Function)
-- -----------------------------------------------------------------------------
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_id uuid,
  p_reason text
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not exists (select 1 from public.admin_users a where a.profile_id = p_actor_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501', hint = 'ADMIN_REQUIRED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required for admin actions.' using errcode = 'P0001', hint = 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  if p_to = 'cancelled' then
    update public.orders
    set refund_required = exists (select 1 from public.payments p where p.order_id = v_order.id and p.status in ('captured', 'partially_refunded')),
        cancellation_reason = btrim(p_reason)
    where id = v_order.id;
  end if;
  v_order := private.transition_order(v_order.id, p_to, p_actor_id, 'admin', btrim(p_reason));
  if p_to = 'approved' then
    v_order := private.transition_order(v_order.id, 'completed', p_actor_id, 'admin', 'Order completed');
  end if;
  perform private.audit('admin_order_status_changed', 'order', v_order.id::text,
    jsonb_build_object('to', p_to, 'reason', p_reason), p_actor_id, 'admin');
  return v_order;
end;
$$;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_actor_id uuid,
  p_outcome text,
  p_note text,
  p_refund_amount numeric default null
)
returns public.disputes
language plpgsql security definer set search_path = ''
as $$
declare
  v_d public.disputes;
  v_order public.orders;
  v_refunded numeric(12, 2);
  v_remaining numeric(12, 2);
  v_fee numeric(12, 2);
  v_hold int := greatest(private.setting_numeric('earning_hold_days', 0)::int, 0);
begin
  if not exists (select 1 from public.admin_users a where a.profile_id = p_actor_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501', hint = 'ADMIN_REQUIRED';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'Add a resolution note for both parties.' using errcode = 'P0001', hint = 'NOTE_REQUIRED';
  end if;
  select * into v_d from public.disputes where id = p_dispute_id for update;
  if not found or v_d.status not in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator') then
    raise exception 'Open dispute not found.' using errcode = 'P0002', hint = 'DISPUTE_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_d.order_id for update;

  if p_outcome = 'release_to_creator' then
    if v_order.status = 'disputed' then
      perform private.transition_order(v_order.id, 'completed', p_actor_id, 'admin', 'Dispute resolved in favour of the creator');
    end if;
    update public.disputes set status = 'resolved', resolution_type = 'release_to_creator' where id = v_d.id;

  elsif p_outcome in ('resume_order', 'rejected') then
    if v_order.status = 'disputed' then
      perform private.transition_order(v_order.id, v_d.previous_order_status, p_actor_id, 'admin',
        case when p_outcome = 'rejected' then 'Dispute rejected; order resumed' else 'Order resumed after dispute' end);
    end if;
    update public.disputes
    set status = case when p_outcome = 'rejected' then 'rejected'::public.dispute_status else 'resolved'::public.dispute_status end,
        resolution_type = p_outcome
    where id = v_d.id;

  elsif p_outcome = 'refund_brand' then
    -- Refund must already be recorded (edge function calls Razorpay + record_refund first).
    if v_order.status = 'disputed' then
      update public.orders set refund_required = true, cancellation_reason = btrim(p_note) where id = v_order.id;
      perform private.transition_order(v_order.id, 'cancelled', p_actor_id, 'admin', 'Dispute resolved with a refund');
    end if;
    update public.disputes set status = 'refunded', resolution_type = 'refund_brand',
      refund_amount = coalesce(p_refund_amount, v_order.total_amount)
    where id = v_d.id;

  elsif p_outcome = 'partial_refund' then
    select coalesce(sum(p.refunded_amount), 0) into v_refunded from public.payments p where p.order_id = v_order.id;
    if v_refunded <= 0 then
      raise exception 'Record the partial refund before resolving.' using errcode = 'P0001', hint = 'REFUND_NOT_RECORDED';
    end if;
    v_remaining := greatest(v_order.total_amount - v_refunded, 0);
    v_fee := round(v_remaining * v_order.platform_fee_percent / 100, 2);
    insert into public.creator_earnings (creator_id, order_id, gross_amount, platform_fee, net_amount, status, available_at)
    values (v_order.creator_id, v_order.id, v_remaining, v_fee, v_remaining - v_fee,
            case when v_hold = 0 then 'available'::public.earning_status else 'pending'::public.earning_status end,
            now() + make_interval(days => v_hold))
    on conflict (order_id) do nothing;
    if v_order.status = 'disputed' then
      perform private.transition_order(v_order.id, 'completed', p_actor_id, 'admin', 'Dispute resolved with a partial refund');
    end if;
    update public.disputes set status = 'resolved', resolution_type = 'partial_refund', refund_amount = v_refunded where id = v_d.id;
  else
    raise exception 'Unknown resolution.' using errcode = 'P0001', hint = 'INVALID_OUTCOME';
  end if;

  update public.disputes set resolution = btrim(p_note), resolved_by = p_actor_id, resolved_at = now()
  where id = v_d.id returning * into v_d;
  insert into public.dispute_messages (dispute_id, sender_id, sender_role, body)
  values (v_d.id, p_actor_id, 'admin', 'Resolution: ' || btrim(p_note));

  perform private.notify((select b.profile_id from public.brands b where b.id = v_order.brand_id),
    'dispute_resolved', 'Your dispute was resolved', btrim(p_note), 'order', v_order.id, '/brand/orders/' || v_order.id);
  perform private.notify((select c.profile_id from public.creators c where c.id = v_order.creator_id),
    'dispute_resolved', 'Your dispute was resolved', btrim(p_note), 'order', v_order.id, '/creator/orders/' || v_order.id);
  perform private.audit('dispute_resolved', 'dispute', v_d.id::text,
    jsonb_build_object('order_id', v_order.id, 'outcome', p_outcome, 'refund_amount', p_refund_amount), p_actor_id, 'admin');
  return v_d;
end;
$$;

-- -----------------------------------------------------------------------------
-- Scheduled maintenance (pg_cron in migration 0013; also callable manually)
-- -----------------------------------------------------------------------------
create or replace function public.expire_pending_payments()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_hours int := private.setting_numeric('payment_expiry_hours', 24)::int;
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'payment_pending' and o.created_at < now() - make_interval(hours => v_hours)
      and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('captured', 'authorized'))
    for update skip locked
  loop
    perform private.transition_order(v_id, 'cancelled', null, 'system', 'Payment window expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.auto_cancel_unaccepted_orders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_hours int := private.setting_numeric('creator_response_hours', 72)::int;
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'creator_pending' and coalesce(o.paid_at, o.created_at) < now() - make_interval(hours => v_hours)
    for update skip locked
  loop
    update public.orders set refund_required = true, cancellation_reason = 'Creator did not respond in time' where id = v_id;
    perform private.transition_order(v_id, 'cancelled', null, 'system', 'Creator did not respond in time');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.auto_approve_stale_deliveries()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_days int := private.setting_numeric('auto_approve_days', 7)::int;
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status in ('delivered', 'revision_submitted') and o.delivered_at < now() - make_interval(days => v_days)
    for update skip locked
  loop
    perform private.transition_order(v_id, 'approved', null, 'system', 'Auto-approved after the review window');
    perform private.transition_order(v_id, 'completed', null, 'system', 'Order completed');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
