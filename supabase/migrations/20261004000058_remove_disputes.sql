-- 0058 · Remove the dispute system
--
-- Disputes are coming out entirely and will be rebuilt as their own phase.
-- Nothing is lost: both tables are empty, and no order has ever reached the
-- `disputed` state (there are no orders at all yet).
--
-- The `disputed` label stays in the `order_status` enum on purpose. Postgres
-- cannot drop an enum label, and recreating the type would mean recreating
-- `private.transition_order`, `private.validate_order_status_transition` and
-- `public.admin_transition_order` -- the three functions that guard every order
-- state change -- to delete a label nothing can reach. Instead the label is
-- retired: every transition into and out of it is deleted, so the state machine
-- can no longer reach it, and a CHECK constraint makes that a hard guarantee
-- rather than a convention. Drop the constraint when disputes come back.
--
-- Escalation after a creator accepts is now support-mediated: admins keep
-- `admin_transition_order`, `record_refund` and the cancel/force-complete
-- actions, so every outcome a dispute could produce is still reachable by a
-- person. The legal copy was rewritten to say so.

begin;

-- ------------------------------------------------------------------ tables --
drop table if exists public.dispute_messages cascade;
drop table if exists public.disputes cascade;

-- ---------------------------------------------------------------- functions --
drop function if exists public.open_dispute(uuid, text, text);
drop function if exists public.add_dispute_message(uuid, text, jsonb);
drop function if exists public.admin_update_dispute(uuid, public.dispute_status, text);
drop function if exists public.resolve_dispute(uuid, text, text, numeric);
drop function if exists public.is_dispute_participant(uuid);
drop function if exists private.is_dispute_participant(uuid);

-- ------------------------------------------------------------- state machine --
delete from public.order_status_transitions
where from_status = 'disputed' or to_status = 'disputed';

alter table public.orders
  drop constraint if exists orders_status_not_disputed;
alter table public.orders
  add constraint orders_status_not_disputed check (status <> 'disputed') not valid;
alter table public.orders validate constraint orders_status_not_disputed;

-- -------------------------------------------------------------------- enums --
drop type if exists public.dispute_status;

-- ---------------------------------------------------------------- settings --
update public.platform_settings
set value = to_jsonb('Brands can cancel for a full refund until the creator accepts. After acceptance, cancellations go through support.'::text),
    updated_at = now()
where key = 'cancellation_rules';

update public.platform_settings
set value = to_jsonb('Full refunds for declined or unaccepted orders. If something goes wrong after acceptance, contact support: we review both sides within 3 business days and partial refunds may apply when work was partly delivered.'::text),
    updated_at = now()
where key = 'refund_rules';

-- ------------------------------------------- functions that mentioned disputes --

CREATE OR REPLACE FUNCTION private.after_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := nullif(current_setting('app.order_actor_id', true), '')::uuid;
  v_actor public.actor_role := coalesce(nullif(current_setting('app.order_actor_role', true), ''), 'system')::public.actor_role;
  v_reason text := nullif(current_setting('app.order_reason', true), '');
  v_brand_profile uuid;
  v_brand_name text;
  v_creator_profile uuid;
  v_creator_name text;
  v_b_url text := '/brand/orders/' || new.id;
  v_c_url text := '/creator/orders/' || new.id;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by, actor_role, reason)
  values (new.id, old.status, new.status, v_actor_id, v_actor, v_reason);

  select b.profile_id, b.brand_name into v_brand_profile, v_brand_name from public.brands b where b.id = new.brand_id;
  select c.profile_id, c.display_name into v_creator_profile, v_creator_name from public.creators c where c.id = new.creator_id;

  case new.status
    when 'creator_pending' then
      perform private.notify(v_creator_profile, 'order_new', 'New order received',
        format('%s ordered "%s" (%s). Accept it to get started.', v_brand_name, new.service_title, private.format_inr(new.creator_earning_amount) || ' for you'),
        'order', new.id, v_c_url);
    when 'accepted' then
      perform private.notify(v_brand_profile, 'order_accepted', 'Your order has been accepted',
        format('%s accepted order %s.', v_creator_name, new.order_number), 'order', new.id, v_b_url);
    when 'awaiting_shipment' then
      perform private.notify(v_brand_profile, 'shipment_required', 'Ship the product to get started',
        format('%s is waiting for your product for order %s. Their shipping address is on the order page.', v_creator_name, new.order_number),
        'order', new.id, v_b_url);
    when 'shipped' then
      perform private.notify(v_creator_profile, 'shipment_update', 'Product shipped',
        format('%s shipped the product for order %s.', v_brand_name, new.order_number), 'order', new.id, v_c_url);
    when 'received' then
      perform private.notify(v_brand_profile, 'shipment_update', 'Product received',
        format('%s received your product for order %s.', v_creator_name, new.order_number), 'order', new.id, v_b_url);
    when 'in_progress' then
      perform private.notify(v_brand_profile, 'order_in_progress', 'Work has started',
        format('%s started working on order %s.', v_creator_name, new.order_number), 'order', new.id, v_b_url);
    when 'delivered' then
      if old.status <> 'revision_submitted' then
        perform private.notify(v_brand_profile, 'content_delivered', 'Creator submitted your content',
          format('%s delivered order %s. Review and approve it, or request a revision.', v_creator_name, new.order_number),
          'order', new.id, v_b_url);
      end if;
    when 'revision_requested' then
      perform private.notify(v_creator_profile, 'revision_requested', 'Revision requested',
        format('%s requested a revision on order %s.', v_brand_name, new.order_number), 'order', new.id, v_c_url);
    when 'revision_submitted' then
      perform private.notify(v_brand_profile, 'revision_submitted', 'Revision submitted',
        format('%s submitted a revision for order %s.', v_creator_name, new.order_number), 'order', new.id, v_b_url);
    when 'approved' then
      perform private.notify(v_creator_profile, 'order_approved', 'Your content was approved',
        format('%s approved your delivery for order %s.', v_brand_name, new.order_number), 'order', new.id, v_c_url);
    when 'completed' then
      perform private.create_creator_earning(new.id);
      update public.creators set completed_orders = completed_orders + 1 where id = new.creator_id;
      if new.brief_id is not null then
        update public.briefs set status = 'completed' where id = new.brief_id and status <> 'completed';
      end if;
      update public.order_revisions set status = 'resolved', resolved_at = now()
      where order_id = new.id and status in ('requested', 'submitted');
      perform private.notify(v_creator_profile, 'order_completed', 'Your order is complete',
        format('Order %s is complete. %s was added to your earnings.', new.order_number, private.format_inr(new.creator_earning_amount)),
        'order', new.id, '/creator/earnings');
      perform private.notify(v_brand_profile, 'order_completed', 'Order completed',
        format('Order %s with %s is complete. Leave a review to help other brands.', new.order_number, v_creator_name),
        'order', new.id, v_b_url);
      perform private.audit('order_completed', 'order', new.id::text,
        jsonb_build_object('order_number', new.order_number, 'creator_earning', new.creator_earning_amount), v_actor_id, v_actor);
    when 'cancelled' then
      if old.status <> 'payment_pending' and old.status <> 'draft' then
        perform private.notify(v_brand_profile, 'order_cancelled',
          case when v_actor = 'creator' then 'Order declined' else 'Order cancelled' end,
          format('Order %s was cancelled.%s%s', new.order_number,
            coalesce(' Reason: ' || v_reason, ''),
            case when new.refund_required then ' Your refund is being processed.' else '' end),
          'order', new.id, v_b_url);
        if v_actor <> 'creator' then
          perform private.notify(v_creator_profile, 'order_cancelled', 'Order cancelled',
            format('Order %s was cancelled.%s', new.order_number, coalesce(' Reason: ' || v_reason, '')),
            'order', new.id, v_c_url);
        end if;
        if new.refund_required then
          perform private.notify_admins('refund_required', 'Refund required',
            format('Order %s was cancelled after payment and needs a refund.', new.order_number),
            'order', new.id, '/admin/orders/' || new.id);
        end if;
      elsif v_actor = 'system' then
        perform private.notify(v_brand_profile, 'order_expired', 'Checkout expired',
          format('Order %s expired because payment was not completed.', new.order_number), 'order', new.id, v_b_url);
      end if;
    when 'refunded' then
      perform private.notify(v_brand_profile, 'refund_processed', 'Refund processed',
        format('Your refund for order %s has been processed.', new.order_number), 'order', new.id, v_b_url);
    else
      null;
  end case;

  if new.status = 'accepted' and new.brief_id is not null then
    update public.briefs set status = 'accepted', responded_at = coalesce(responded_at, now())
    where id = new.brief_id and status in ('draft', 'sent');
  end if;

  perform private.audit('order_status_changed', 'order', new.id::text,
    jsonb_build_object('order_number', new.order_number, 'from', old.status, 'to', new.status, 'reason', v_reason),
    v_actor_id, v_actor);
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.can_upload_order_file(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_order_id is not null
    and private.can_view_order(p_order_id)
    and exists (
      select 1 from public.orders o
      where o.id = p_order_id
        and o.status in ('accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
                         'revision_requested', 'revision_submitted')
    );
$function$;

CREATE OR REPLACE FUNCTION private.email_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('payment_failed', 'payout_failed', 'refund_processed',
                    'account_suspended', 'account_reactivated', 'profile_suspended',
                    'order_cancelled', 'order_expired')
      then 'critical'
    when p_type in ('order_new', 'order_accepted', 'order_approved', 'order_completed',
                    'order_in_progress', 'content_delivered', 'revision_requested',
                    'revision_submitted', 'shipment_required', 'shipment_update',
                    'review_received')
      then 'orders'
    when p_type in ('payment_received', 'earnings_available', 'payout_requested',
                    'payout_processed')
      then 'payments'
    when p_type in ('brief_received')
      then 'campaigns'
    when p_type in ('welcome', 'onboarding_completed', 'profile_submitted',
                    'profile_approved', 'profile_rejected', 'creator_verified')
      then 'account'
    when p_type in ('announcement')
      then 'marketing'
    else 'account'
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
    'reports_open', (select count(*) from public.reports r where r.status in ('open', 'under_review')),
    'orders_by_status', (select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
                         from (select o.status, count(*) as cnt from public.orders o group by o.status) s)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_people_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'payouts_pending',    (select count(*) from public.payout_requests where status in ('pending', 'processing'))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders := private.lock_order(p_order_id, 'brand');
  v_paid boolean;
begin
  if v_order.status not in ('draft', 'payment_pending', 'creator_pending') then
    raise exception 'This order can no longer be cancelled here. Contact support if something went wrong.'
      using errcode = 'P0001', hint = 'CANNOT_CANCEL';
  end if;
  v_paid := exists (select 1 from public.payments p where p.order_id = v_order.id and p.status = 'captured');
  update public.orders
  set refund_required = v_paid,
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled by brand')
  where id = v_order.id;
  return private.transition_order(v_order.id, 'cancelled', auth.uid(), 'brand', coalesce(nullif(btrim(p_reason), ''), 'Cancelled by brand'));
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_payout_request(p_profile_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_creator public.creators;
  v_method public.payout_methods;
  v_available numeric(12, 2);
  v_min numeric := private.setting_numeric('minimum_payout_amount', 500);
  v_request public.payout_requests;
begin
  select * into v_creator from public.creators where profile_id = p_profile_id for update;
  if not found then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.status = 'active') then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  select * into v_method from public.payout_methods where creator_id = v_creator.id;
  if not found then
    raise exception 'Add a payout method before requesting a payout.' using errcode = 'P0001', hint = 'PAYOUT_METHOD_REQUIRED';
  end if;
  if exists (select 1 from public.payout_requests pr where pr.creator_id = v_creator.id and pr.status in ('pending', 'processing')) then
    raise exception 'You already have a payout in progress.' using errcode = 'P0001', hint = 'PAYOUT_IN_PROGRESS';
  end if;

  -- flip matured earnings first
  update public.creator_earnings e set status = 'available'
  where e.creator_id = v_creator.id and e.status = 'pending' and e.available_at <= now()
    and not exists (select 1 from public.orders o where o.id = e.order_id and o.status = 'refunded');

  perform 1 from public.creator_earnings e
  where e.creator_id = v_creator.id and e.status = 'available' and e.payout_request_id is null
  for update;

  select coalesce(sum(net_amount), 0) into v_available
  from public.creator_earnings
  where creator_id = v_creator.id and status = 'available' and payout_request_id is null and available_at <= now();

  if v_available <= 0 then
    raise exception 'You have no available balance to withdraw yet.' using errcode = 'P0001', hint = 'NO_AVAILABLE_BALANCE';
  end if;
  if v_available < v_min then
    raise exception 'The minimum payout is %. Your available balance is %.', private.format_inr(v_min), private.format_inr(v_available)
      using errcode = 'P0001', hint = 'BELOW_MINIMUM_PAYOUT';
  end if;

  insert into public.payout_requests (creator_id, amount, status, payout_method_snapshot, notes)
  values (
    v_creator.id, v_available, 'pending',
    jsonb_build_object(
      'method_type', v_method.method_type,
      'account_holder_name', v_method.account_holder_name,
      'upi_id', v_method.upi_id,
      'bank_account_last4', v_method.bank_account_last4,
      'ifsc_code', v_method.ifsc_code,
      'bank_name', v_method.bank_name
    ),
    nullif(btrim(p_notes), '')
  )
  returning * into v_request;

  update public.creator_earnings
  set payout_request_id = v_request.id
  where creator_id = v_creator.id and status = 'available' and payout_request_id is null and available_at <= now();

  perform private.audit('payout_requested', 'payout_request', v_request.id::text,
    jsonb_build_object('amount', v_available, 'creator_id', v_creator.id), p_profile_id, 'creator');
  perform private.notify_admins('payout_requested', 'New payout request',
    format('%s requested a payout of %s.', v_creator.display_name, private.format_inr(v_available)),
    'payout_request', v_request.id, '/admin/payouts');
  perform private.notify(p_profile_id, 'payout_requested', 'Payout requested',
    format('We received your payout request for %s.', private.format_inr(v_available)),
    'payout_request', v_request.id, '/creator/payouts');
  return v_request;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_brand_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_brand uuid := private.my_brand_id();
begin
  if v_brand is null then
    raise exception 'Brand profile not found.' using errcode = 'P0002', hint = 'BRAND_REQUIRED';
  end if;
  return jsonb_build_object(
    'creator_searches_30d', (select count(*) from public.search_events s where s.profile_id = auth.uid() and s.created_at > now() - interval '30 days'),
    'creator_profile_views_30d', (select count(*) from public.creator_profile_views v where v.viewer_id = auth.uid() and v.created_at > now() - interval '30 days'),
    'orders_total', (select count(*) from public.orders o where o.brand_id = v_brand and o.status <> 'draft'),
    'orders_active', (select count(*) from public.orders o where o.brand_id = v_brand and o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'completed_orders', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'completed'),
    'spend_total', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p
                    join public.orders o on o.id = p.order_id
                    where o.brand_id = v_brand and p.status in ('captured', 'partially_refunded', 'refunded')),
    'spend_30d', (select coalesce(sum(p.amount - p.refunded_amount), 0) from public.payments p
                  join public.orders o on o.id = p.order_id
                  where o.brand_id = v_brand and p.status in ('captured', 'partially_refunded', 'refunded')
                    and p.captured_at > now() - interval '30 days'),
    'active_campaigns', (select count(distinct coalesce(o.brief_id, o.id)) from public.orders o where o.brand_id = v_brand and o.status in
      ('creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
       'revision_requested', 'revision_submitted')),
    'pending_actions', jsonb_build_object(
      'payment_pending', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'payment_pending'),
      'awaiting_shipment', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'awaiting_shipment'),
      'awaiting_review', (select count(*) from public.orders o where o.brand_id = v_brand and o.status in ('delivered', 'revision_submitted')),
      'draft_briefs', (select count(*) from public.briefs b where b.brand_id = v_brand and b.status = 'draft'),
      'reviews_due', (select count(*) from public.orders o where o.brand_id = v_brand and o.status = 'completed'
                        and not exists (select 1 from public.reviews r where r.order_id = o.id and r.reviewer_id = auth.uid()))
    ),
    'wishlisted_creators', (select count(distinct wi.creator_id) from public.wishlist_items wi
                            join public.wishlists w on w.id = wi.wishlist_id where w.brand_id = v_brand)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_creator_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_c public.creators;
  v_orders_total int;
begin
  select * into v_c from public.creators where profile_id = auth.uid();
  if not found then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  select count(*) into v_orders_total from public.orders o
  where o.creator_id = v_c.id and o.status not in ('draft', 'payment_pending');

  return jsonb_build_object(
    'status', v_c.status,
    'profile_views_total', v_c.profile_views,
    'profile_views_30d', (select count(*) from public.creator_profile_views v where v.creator_id = v_c.id and v.created_at > now() - interval '30 days'),
    'profile_views_prev_30d', (select count(*) from public.creator_profile_views v where v.creator_id = v_c.id
                                 and v.created_at between now() - interval '60 days' and now() - interval '30 days'),
    'wishlist_adds', v_c.wishlist_count,
    'orders_total', v_orders_total,
    'orders_pending_acceptance', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status = 'creator_pending'),
    'orders_active', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status in
      ('accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered', 'revision_requested', 'revision_submitted')),
    'pending_deliveries', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status in
      ('accepted', 'received', 'in_progress', 'revision_requested')),
    'completed_orders', (select count(*) from public.orders o where o.creator_id = v_c.id and o.status = 'completed'),
    'conversion_rate', case when v_c.profile_views > 0 then round(v_orders_total * 100.0 / v_c.profile_views, 1) else 0 end,
    'revenue_total', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.creator_id = v_c.id and e.status <> 'refunded'),
    'revenue_30d', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e where e.creator_id = v_c.id
                      and e.status <> 'refunded' and e.created_at > now() - interval '30 days'),
    'new_opportunities', (select count(*) from public.briefs b where b.creator_id = v_c.id and b.status = 'sent'),
    'rating', v_c.rating,
    'review_count', v_c.review_count,
    'views_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(v.cnt, 0)) order by d.day), '[]'::jsonb)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, count(*) as cnt from public.creator_profile_views
        where creator_id = v_c.id and created_at > now() - interval '14 days'
        group by 1
      ) v on v.day = d.day::date
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_refund(p_payment_id uuid, p_provider_refund_id text, p_amount numeric, p_status refund_status, p_reason text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_raw jsonb DEFAULT NULL::jsonb)
 RETURNS payment_refunds
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payment public.payments;
  v_order public.orders;
  v_refund public.payment_refunds;
  v_prev_status public.refund_status;
  v_total_refunded numeric(12, 2);
  v_actor public.actor_role := case when p_actor_id is null then 'system'::public.actor_role else 'admin'::public.actor_role end;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002', hint = 'PAYMENT_NOT_FOUND';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_payment.amount then
    raise exception 'Invalid refund amount.' using errcode = 'P0001', hint = 'INVALID_REFUND_AMOUNT';
  end if;

  select status into v_prev_status from public.payment_refunds where provider_refund_id = p_provider_refund_id;

  insert into public.payment_refunds (payment_id, order_id, amount, provider_refund_id, status, reason, initiated_by, raw_response)
  values (v_payment.id, v_payment.order_id, p_amount, p_provider_refund_id, p_status, p_reason, p_actor_id, p_raw)
  on conflict (provider_refund_id) do update
  set status = excluded.status,
      raw_response = coalesce(excluded.raw_response, public.payment_refunds.raw_response)
  returning * into v_refund;

  if v_prev_status is null then
    perform private.audit('refund_requested', 'payment', v_payment.id::text,
      jsonb_build_object('order_id', v_payment.order_id, 'amount', p_amount, 'provider_refund_id', p_provider_refund_id, 'reason', p_reason),
      p_actor_id, v_actor);
  end if;

  -- Apply money movement once, when the refund first reaches `processed`.
  if p_status = 'processed' and v_prev_status is distinct from 'processed' then
    select coalesce(sum(amount), 0) into v_total_refunded
    from public.payment_refunds where payment_id = v_payment.id and status = 'processed';

    update public.payments
    set refunded_amount = least(v_total_refunded, amount),
        status = case when v_total_refunded >= amount then 'refunded'::public.payment_status
                      else 'partially_refunded'::public.payment_status end
    where id = v_payment.id;

    select * into v_order from public.orders where id = v_payment.order_id for update;
    update public.orders set refund_required = false where id = v_order.id;

    if v_total_refunded >= v_payment.amount then
      if v_order.status in ('cancelled', 'completed') then
        perform private.transition_order(v_order.id, 'refunded', p_actor_id, v_actor, coalesce(p_reason, 'Refund processed'));
      end if;
      update public.creator_earnings set status = 'refunded'
      where order_id = v_order.id and status in ('pending', 'available', 'held') and payout_request_id is null;
    end if;

    perform private.audit('refund_processed', 'payment', v_payment.id::text,
      jsonb_build_object('order_id', v_payment.order_id, 'amount', p_amount, 'total_refunded', v_total_refunded),
      p_actor_id, v_actor);
  end if;
  return v_refund;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_matured_earnings(p_creator_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_count int := 0;
  v_row record;
begin
  -- Callable by the creator for themselves, or by service_role/cron for all.
  if auth.uid() is not null and not private.is_admin() then
    p_creator_id := private.my_creator_id();
    if p_creator_id is null then
      return 0;
    end if;
  end if;

  for v_row in
    with released as (
      update public.creator_earnings e
      set status = 'available'
      where e.status = 'pending'
        and e.available_at <= now()
        and (p_creator_id is null or e.creator_id = p_creator_id)
        and not exists (
          select 1 from public.orders o where o.id = e.order_id and o.status = 'refunded'
        )
      returning e.creator_id, e.net_amount
    )
    select c.profile_id, count(*)::int as n, sum(r.net_amount) as total
    from released r
    join public.creators c on c.id = r.creator_id
    group by c.profile_id
  loop
    v_count := v_count + v_row.n;
    perform private.notify(v_row.profile_id, 'earnings_available', 'Your payout is available',
      format('%s is now available to withdraw.', private.format_inr(v_row.total)), 'earnings', null, '/creator/payouts');
  end loop;
  return v_count;
end;
$function$;

commit;
