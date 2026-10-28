-- 0017 - Fix: admin stats functions must not mention the removed disputes table
--
-- 0016 rebuilt admin_people_stats and admin_dashboard_stats from copies that
-- still counted open disputes, but public.disputes was dropped in 0058. On a
-- database without that table both functions errored, so Admin -> People (and
-- the admin dashboard) showed 0 everywhere. These are the same functions as in
-- 0016 — every creator account counted as a creator, removed storefronts
-- reported separately — built on the post-0058 versions, with no disputes.
-- No data is changed.

begin;

create or replace function public.admin_people_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
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
    'creators_published', (select count(*) from public.creators where status = 'published' and deleted_at is null),
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
    'platform_revenue', (select coalesce(sum(o.platform_fee_amount), 0) from public.orders o where o.status = 'completed'),
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

commit;
