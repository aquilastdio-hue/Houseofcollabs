-- =============================================================================
-- Spotlit · 0006 · order workflow
-- State machine, enforcement triggers, pricing, and all workflow RPCs.
-- Clients have no UPDATE privilege on orders; every change goes through here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- State machine definition
-- -----------------------------------------------------------------------------
insert into public.order_status_transitions (from_status, to_status, actor, description) values
  ('draft', 'payment_pending', 'brand', 'Checkout started'),
  ('draft', 'payment_pending', 'system', 'Checkout started'),
  ('draft', 'cancelled', 'brand', 'Draft discarded'),
  ('draft', 'cancelled', 'system', 'Draft expired'),
  ('payment_pending', 'order_placed', 'system', 'Payment verified'),
  ('payment_pending', 'cancelled', 'brand', 'Checkout abandoned'),
  ('payment_pending', 'cancelled', 'system', 'Payment window expired'),
  ('payment_pending', 'cancelled', 'admin', 'Cancelled by admin'),
  ('order_placed', 'creator_pending', 'system', 'Sent to creator'),
  ('order_placed', 'cancelled', 'admin', 'Cancelled by admin'),
  ('creator_pending', 'accepted', 'creator', 'Creator accepted'),
  ('creator_pending', 'cancelled', 'creator', 'Creator declined'),
  ('creator_pending', 'cancelled', 'brand', 'Brand cancelled before acceptance'),
  ('creator_pending', 'cancelled', 'system', 'Creator did not respond in time'),
  ('creator_pending', 'cancelled', 'admin', 'Cancelled by admin'),
  ('accepted', 'awaiting_shipment', 'system', 'Waiting for product'),
  ('accepted', 'awaiting_shipment', 'creator', 'Waiting for product'),
  ('accepted', 'in_progress', 'creator', 'Work started'),
  ('awaiting_shipment', 'shipped', 'brand', 'Product shipped'),
  ('shipped', 'received', 'creator', 'Product received'),
  ('received', 'in_progress', 'creator', 'Work started'),
  ('in_progress', 'delivered', 'creator', 'Content delivered'),
  ('delivered', 'revision_requested', 'brand', 'Revision requested'),
  ('delivered', 'approved', 'brand', 'Brand approved'),
  ('delivered', 'approved', 'admin', 'Approved by admin'),
  ('delivered', 'approved', 'system', 'Auto-approved after review window'),
  ('revision_requested', 'revision_submitted', 'creator', 'Revision submitted'),
  ('revision_submitted', 'delivered', 'system', 'Revision back in review'),
  ('revision_submitted', 'delivered', 'admin', 'Revision back in review'),
  ('revision_submitted', 'approved', 'brand', 'Brand approved'),
  ('revision_submitted', 'approved', 'admin', 'Approved by admin'),
  ('revision_submitted', 'approved', 'system', 'Auto-approved after review window'),
  ('revision_submitted', 'revision_requested', 'brand', 'Another revision requested'),
  ('approved', 'completed', 'system', 'Order completed'),
  ('approved', 'completed', 'admin', 'Order completed'),
  ('disputed', 'completed', 'admin', 'Dispute resolved for creator'),
  ('disputed', 'cancelled', 'admin', 'Dispute resolved with cancellation'),
  ('disputed', 'refunded', 'admin', 'Dispute resolved with refund'),
  ('disputed', 'refunded', 'system', 'Refund processed'),
  ('cancelled', 'refunded', 'admin', 'Refund processed'),
  ('cancelled', 'refunded', 'system', 'Refund processed'),
  ('completed', 'refunded', 'admin', 'Refund processed after completion'),
  ('completed', 'refunded', 'system', 'Refund processed after completion');

-- Active work states: can be disputed by either party, cancelled/resumed by admin.
insert into public.order_status_transitions (from_status, to_status, actor, description)
select s.status, 'disputed'::public.order_status, a.actor, 'Dispute opened'
from unnest(array['accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress',
                  'delivered', 'revision_requested', 'revision_submitted']::public.order_status[]) as s(status)
cross join unnest(array['brand', 'creator']::public.actor_role[]) as a(actor)
union all
select s.status, 'cancelled'::public.order_status, 'admin'::public.actor_role, 'Cancelled by admin'
from unnest(array['accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress',
                  'delivered', 'revision_requested', 'revision_submitted']::public.order_status[]) as s(status)
union all
select 'disputed'::public.order_status, s.status, 'admin'::public.actor_role, 'Order resumed after dispute'
from unnest(array['accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress',
                  'delivered', 'revision_requested', 'revision_submitted']::public.order_status[]) as s(status);

-- -----------------------------------------------------------------------------
-- Transition validation (spec: validate_order_status_transition)
-- -----------------------------------------------------------------------------
create or replace function private.validate_order_status_transition(
  p_from public.order_status,
  p_to public.order_status,
  p_actor public.actor_role
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.order_status_transitions t
    where t.from_status = p_from and t.to_status = p_to and t.actor = p_actor
  );
$$;

create or replace function private.enforce_order_transition()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.actor_role := coalesce(nullif(current_setting('app.order_actor_role', true), ''), 'system')::public.actor_role;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not private.validate_order_status_transition(old.status, new.status, v_actor) then
    raise exception 'This order cannot move from "%" to "%".',
      replace(old.status::text, '_', ' '), replace(new.status::text, '_', ' ')
      using errcode = 'P0001', hint = 'INVALID_ORDER_TRANSITION';
  end if;

  case new.status
    when 'order_placed' then
      new.paid_at := coalesce(new.paid_at, now());
    when 'accepted' then
      new.accepted_at := now();
      if not new.requires_shipping then
        new.due_at := now() + make_interval(days => new.delivery_days);
      end if;
    when 'received' then
      new.due_at := now() + make_interval(days => new.delivery_days);
    when 'in_progress' then
      new.started_at := coalesce(new.started_at, now());
      new.due_at := coalesce(new.due_at, now() + make_interval(days => new.delivery_days));
    when 'delivered' then
      new.delivered_at := now();
    when 'revision_submitted' then
      new.delivered_at := now();
    when 'approved' then
      new.approved_at := now();
    when 'completed' then
      new.completed_at := now();
      new.approved_at := coalesce(new.approved_at, now());
    when 'cancelled' then
      new.cancelled_at := now();
    else
      null;
  end case;
  return new;
end;
$$;

create trigger orders_enforce_transition
  before update of status on public.orders
  for each row execute function private.enforce_order_transition();

-- -----------------------------------------------------------------------------
-- Pricing (spec: calculate_platform_fee, calculate_creator_earnings,
-- calculate_order_total). Fee percentage comes from platform_settings.
-- -----------------------------------------------------------------------------
create or replace function public.calculate_platform_fee(p_amount numeric)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(greatest(coalesce(p_amount, 0), 0)
    * private.setting_numeric('platform_fee_percentage', 10) / 100, 2);
$$;

create or replace function public.calculate_creator_earnings(p_amount numeric)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'gross', round(coalesce(p_amount, 0), 2),
    'platform_fee_percent', private.setting_numeric('platform_fee_percentage', 10),
    'platform_fee', public.calculate_platform_fee(p_amount),
    'net', round(coalesce(p_amount, 0), 2) - public.calculate_platform_fee(p_amount)
  );
$$;

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

  v_total := v_service.price + v_addon_total;
  v_fee := public.calculate_platform_fee(v_total);

  return jsonb_build_object(
    'service_id', v_service.id,
    'subtotal', v_service.price,
    'addons_total', v_addon_total,
    'total', v_total,
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

-- -----------------------------------------------------------------------------
-- Earnings (created when an order completes)
-- -----------------------------------------------------------------------------
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
    v_order.creator_id, v_order.id, v_order.total_amount, v_order.platform_fee_amount, v_order.creator_earning_amount,
    case when v_hold = 0 then 'available'::public.earning_status else 'pending'::public.earning_status end,
    now() + make_interval(days => v_hold)
  )
  on conflict (order_id) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Side effects of a status change: history, notifications, earnings, audit.
-- Actor context is passed through transaction-local settings by
-- private.transition_order().
-- -----------------------------------------------------------------------------
create or replace function private.after_order_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
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
    when 'disputed' then
      if v_actor = 'brand' then
        perform private.notify(v_creator_profile, 'dispute_opened', 'A dispute was opened',
          format('%s opened a dispute on order %s. Our team will review it.', v_brand_name, new.order_number), 'order', new.id, v_c_url);
      else
        perform private.notify(v_brand_profile, 'dispute_opened', 'A dispute was opened',
          format('%s opened a dispute on order %s. Our team will review it.', v_creator_name, new.order_number), 'order', new.id, v_b_url);
      end if;
      perform private.notify_admins('dispute_opened', 'New dispute',
        format('Dispute opened on order %s.', new.order_number), 'order', new.id, '/admin/orders/' || new.id);
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
$$;

create trigger orders_after_status_change
  after update of status on public.orders
  for each row execute function private.after_order_status_change();

-- -----------------------------------------------------------------------------
-- Transition executor (the only code path that updates orders.status)
-- -----------------------------------------------------------------------------
create or replace function private.transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_id uuid,
  p_actor public.actor_role,
  p_reason text default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform set_config('app.order_actor_id', coalesce(p_actor_id::text, ''), true);
  perform set_config('app.order_actor_role', p_actor::text, true);
  perform set_config('app.order_reason', coalesce(p_reason, ''), true);

  update public.orders set status = p_to where id = p_order_id returning * into v_order;

  perform set_config('app.order_actor_id', '', true);
  perform set_config('app.order_actor_role', '', true);
  perform set_config('app.order_reason', '', true);

  if v_order.id is null then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  return v_order;
end;
$$;

-- Loads + locks an order and verifies the caller is its brand or creator.
create or replace function private.lock_order(p_order_id uuid, p_as public.actor_role)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_ok boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if found then
    if p_as = 'brand' then
      v_ok := exists (select 1 from public.brands b where b.id = v_order.brand_id and b.profile_id = auth.uid());
    elsif p_as = 'creator' then
      v_ok := v_order.status not in ('draft', 'payment_pending')
        and exists (select 1 from public.creators c where c.id = v_order.creator_id and c.profile_id = auth.uid());
    end if;
  end if;

  if not v_ok then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  return v_order;
end;
$$;

-- Returns 'brand' / 'creator' for the caller on this order, or raises.
create or replace function private.order_party(p_order public.orders)
returns public.actor_role
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.brands b where b.id = p_order.brand_id and b.profile_id = auth.uid()) then
    return 'brand';
  elsif p_order.status not in ('draft', 'payment_pending')
    and exists (select 1 from public.creators c where c.id = p_order.creator_id and c.profile_id = auth.uid()) then
    return 'creator';
  end if;
  raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
end;
$$;

-- -----------------------------------------------------------------------------
-- create_order — brand checkout. All money is computed from DB rows.
-- -----------------------------------------------------------------------------
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
    brief_snapshot, requirements
  ) values (
    v_brand.id, v_creator.id, v_service.id, p_brief_id, 'payment_pending',
    v_service.title, v_service.description, v_service.content_type, (v_quote ->> 'delivery_days')::int,
    (v_quote ->> 'revisions')::int, v_service.requires_shipping,
    (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'addons_total')::numeric, (v_quote ->> 'total')::numeric, 'INR',
    (v_quote ->> 'platform_fee_percent')::numeric, (v_quote ->> 'platform_fee')::numeric, (v_quote ->> 'creator_earning')::numeric,
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

-- -----------------------------------------------------------------------------
-- Brand cancels: unpaid orders any time; paid orders only before acceptance.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'brand');
  v_paid boolean;
begin
  if v_order.status not in ('draft', 'payment_pending', 'creator_pending') then
    raise exception 'This order can no longer be cancelled here. Open a dispute if something went wrong.'
      using errcode = 'P0001', hint = 'CANNOT_CANCEL';
  end if;
  v_paid := exists (select 1 from public.payments p where p.order_id = v_order.id and p.status = 'captured');
  update public.orders
  set refund_required = v_paid,
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled by brand')
  where id = v_order.id;
  return private.transition_order(v_order.id, 'cancelled', auth.uid(), 'brand', coalesce(nullif(btrim(p_reason), ''), 'Cancelled by brand'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Creator accepts (shipping address required for physical-product services)
-- -----------------------------------------------------------------------------
create or replace function private.apply_shipping_address(p_order_id uuid, p_shipping jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_shipping ->> 'recipient_name'), '');
  v_phone text := nullif(btrim(p_shipping ->> 'phone'), '');
  v_address text := nullif(btrim(p_shipping ->> 'address'), '');
  v_city text := nullif(btrim(p_shipping ->> 'city'), '');
  v_state text := nullif(btrim(p_shipping ->> 'state'), '');
  v_postal text := nullif(btrim(p_shipping ->> 'postal_code'), '');
begin
  if v_name is null or v_phone is null or v_address is null or v_city is null or v_postal is null then
    raise exception 'Please provide your name, phone, address, city and postal code for product delivery.'
      using errcode = 'P0001', hint = 'SHIPPING_ADDRESS_REQUIRED';
  end if;
  insert into public.shipping_details (order_id, shipping_required, recipient_name, phone, address, city, state, postal_code, address_submitted_at)
  values (p_order_id, true, v_name, v_phone, v_address, v_city, v_state, v_postal, now())
  on conflict (order_id) do update
  set recipient_name = excluded.recipient_name,
      phone = excluded.phone,
      address = excluded.address,
      city = excluded.city,
      state = excluded.state,
      postal_code = excluded.postal_code,
      address_submitted_at = now();
end;
$$;

create or replace function public.accept_order(p_order_id uuid, p_shipping jsonb default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
begin
  if v_order.status <> 'creator_pending' then
    raise exception 'This order is no longer waiting for acceptance.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if v_order.requires_shipping then
    perform private.apply_shipping_address(v_order.id, coalesce(p_shipping, '{}'::jsonb));
  end if;
  v_order := private.transition_order(v_order.id, 'accepted', auth.uid(), 'creator', 'Creator accepted the order');
  if v_order.requires_shipping then
    v_order := private.transition_order(v_order.id, 'awaiting_shipment', auth.uid(), 'system', 'Waiting for the brand to ship the product');
  end if;
  return v_order;
end;
$$;

create or replace function public.decline_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_order.status <> 'creator_pending' then
    raise exception 'This order is no longer waiting for acceptance.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if v_reason is null then
    raise exception 'Please tell the brand why you are declining.' using errcode = 'P0001', hint = 'REASON_REQUIRED';
  end if;
  update public.orders
  set refund_required = exists (select 1 from public.payments p where p.order_id = v_order.id and p.status = 'captured'),
      cancellation_reason = v_reason
  where id = v_order.id;
  if v_order.brief_id is not null then
    update public.briefs set status = 'rejected', responded_at = now(), response_note = v_reason
    where id = v_order.brief_id and status in ('draft', 'sent');
  end if;
  return private.transition_order(v_order.id, 'cancelled', auth.uid(), 'creator', v_reason);
end;
$$;

create or replace function public.submit_shipping_address(p_order_id uuid, p_shipping jsonb)
returns public.shipping_details
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
  v_row public.shipping_details;
begin
  if not v_order.requires_shipping or v_order.status not in ('accepted', 'awaiting_shipment') then
    raise exception 'The shipping address can only be changed before the product ships.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  perform private.apply_shipping_address(v_order.id, p_shipping);
  select * into v_row from public.shipping_details where order_id = v_order.id;
  return v_row;
end;
$$;

create or replace function public.mark_order_shipped(
  p_order_id uuid,
  p_courier text,
  p_tracking_number text,
  p_tracking_url text default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'brand');
begin
  if v_order.status <> 'awaiting_shipment' then
    raise exception 'This order is not waiting for a shipment.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if nullif(btrim(p_courier), '') is null or nullif(btrim(p_tracking_number), '') is null then
    raise exception 'Add the courier and tracking number.' using errcode = 'P0001', hint = 'TRACKING_REQUIRED';
  end if;
  update public.shipping_details
  set courier = btrim(p_courier),
      tracking_number = btrim(p_tracking_number),
      tracking_url = nullif(btrim(p_tracking_url), ''),
      shipped_at = now()
  where order_id = v_order.id;
  return private.transition_order(v_order.id, 'shipped', auth.uid(), 'brand',
    format('Shipped via %s (%s)', btrim(p_courier), btrim(p_tracking_number)));
end;
$$;

create or replace function public.mark_product_received(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
begin
  if v_order.status <> 'shipped' then
    raise exception 'This order has no product in transit.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  update public.shipping_details set received_at = now() where order_id = v_order.id;
  return private.transition_order(v_order.id, 'received', auth.uid(), 'creator', 'Product received');
end;
$$;

create or replace function public.start_order_work(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
begin
  if v_order.status = 'accepted' and v_order.requires_shipping then
    raise exception 'Wait for the product to arrive before starting.' using errcode = 'P0001', hint = 'AWAITING_PRODUCT';
  end if;
  if v_order.status not in ('accepted', 'received') then
    raise exception 'This order cannot be started right now.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  return private.transition_order(v_order.id, 'in_progress', auth.uid(), 'creator', 'Work started');
end;
$$;

-- -----------------------------------------------------------------------------
-- Deliverables. p_items: [{ "storage_path": "...", "file_name": "...",
-- "mime_type": "...", "size_bytes": 123 } | { "external_url": "https://..." }]
-- Storage paths must live in the order's folder and already exist.
-- -----------------------------------------------------------------------------
create or replace function public.submit_deliverables(p_order_id uuid, p_items jsonb, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'creator');
  v_item jsonb;
  v_path text;
  v_url text;
  v_round int;
  v_revision public.order_revisions;
  v_count int := 0;
begin
  if v_order.status not in ('accepted', 'received', 'in_progress', 'revision_requested') then
    raise exception 'Deliverables cannot be submitted for this order right now.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if v_order.status = 'accepted' and v_order.requires_shipping then
    raise exception 'Wait for the product to arrive before delivering.' using errcode = 'P0001', hint = 'AWAITING_PRODUCT';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one file or link to deliver.' using errcode = 'P0001', hint = 'DELIVERABLES_REQUIRED';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'You can deliver up to 20 items at a time.' using errcode = 'P0001', hint = 'TOO_MANY_DELIVERABLES';
  end if;

  select coalesce(max(round), 0) + 1 into v_round from public.order_deliverables where order_id = v_order.id;
  if v_order.status = 'revision_requested' then
    select * into v_revision from public.order_revisions
    where order_id = v_order.id and status = 'requested'
    order by revision_number desc limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_path := nullif(btrim(v_item ->> 'storage_path'), '');
    v_url := nullif(btrim(v_item ->> 'external_url'), '');
    if v_path is null and v_url is null then
      raise exception 'Each deliverable needs a file or a link.' using errcode = 'P0001', hint = 'INVALID_DELIVERABLE';
    end if;
    if v_path is not null then
      if split_part(v_path, '/', 1) <> v_order.id::text then
        raise exception 'Invalid file location.' using errcode = 'P0001', hint = 'INVALID_DELIVERABLE_PATH';
      end if;
      if not exists (select 1 from storage.objects o where o.bucket_id = 'order-deliverables' and o.name = v_path) then
        raise exception 'An uploaded file could not be found. Please upload it again.' using errcode = 'P0001', hint = 'DELIVERABLE_FILE_MISSING';
      end if;
    end if;
    if v_url is not null and v_url !~* '^https?://[^\s]+$' then
      raise exception 'Links must start with http:// or https://' using errcode = 'P0001', hint = 'INVALID_URL';
    end if;

    insert into public.order_deliverables (order_id, uploaded_by, revision_id, round, storage_path, external_url, file_name, mime_type, size_bytes, note)
    values (
      v_order.id, auth.uid(), v_revision.id, v_round, v_path, v_url,
      left(coalesce(nullif(v_item ->> 'file_name', ''), split_part(v_path, '/', -1), v_url), 255),
      nullif(v_item ->> 'mime_type', ''),
      nullif(v_item ->> 'size_bytes', '')::bigint,
      nullif(btrim(p_note), '')
    );
    v_count := v_count + 1;
  end loop;

  perform private.audit('deliverable_uploaded', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'round', v_round, 'items', v_count), auth.uid(), 'creator');

  if v_order.status = 'revision_requested' then
    update public.order_revisions set status = 'submitted', submitted_at = now() where id = v_revision.id;
    return private.transition_order(v_order.id, 'revision_submitted', auth.uid(), 'creator',
      format('Revision %s submitted', coalesce(v_revision.revision_number::text, '')));
  end if;

  if v_order.status in ('accepted', 'received') then
    v_order := private.transition_order(v_order.id, 'in_progress', auth.uid(), 'creator', 'Work started');
  end if;
  return private.transition_order(v_order.id, 'delivered', auth.uid(), 'creator', 'Content delivered');
end;
$$;

-- -----------------------------------------------------------------------------
-- Brand review: revision (bounded by revisions_allowed) or approval
-- -----------------------------------------------------------------------------
create or replace function public.request_revision(
  p_order_id uuid,
  p_reason text,
  p_instructions text default null,
  p_attachments jsonb default '[]'
)
returns public.order_revisions
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'brand');
  v_revision public.order_revisions;
  v_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_att jsonb;
begin
  if v_order.status not in ('delivered', 'revision_submitted') then
    raise exception 'You can request a revision after the creator delivers.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if v_order.revisions_used >= v_order.revisions_allowed then
    raise exception 'You have used all % included revision(s) for this order.', v_order.revisions_allowed
      using errcode = 'P0001', hint = 'REVISION_LIMIT_REACHED';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Tell the creator what needs to change.' using errcode = 'P0001', hint = 'REASON_REQUIRED';
  end if;
  if jsonb_typeof(v_attachments) <> 'array' then
    raise exception 'Invalid attachments.' using errcode = 'P0001', hint = 'INVALID_ATTACHMENTS';
  end if;
  for v_att in select * from jsonb_array_elements(v_attachments) loop
    if split_part(coalesce(v_att ->> 'path', ''), '/', 1) <> v_order.id::text then
      raise exception 'Invalid attachment location.' using errcode = 'P0001', hint = 'INVALID_ATTACHMENTS';
    end if;
  end loop;

  update public.order_revisions set status = 'resolved', resolved_at = now()
  where order_id = v_order.id and status = 'submitted';

  insert into public.order_revisions (order_id, revision_number, requested_by, reason, instructions, attachments, status)
  values (v_order.id, v_order.revisions_used + 1, auth.uid(), btrim(p_reason), nullif(btrim(p_instructions), ''), v_attachments, 'requested')
  returning * into v_revision;

  update public.orders set revisions_used = revisions_used + 1 where id = v_order.id;
  perform private.transition_order(v_order.id, 'revision_requested', auth.uid(), 'brand', btrim(p_reason));
  perform private.audit('revision_requested', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'revision_number', v_revision.revision_number), auth.uid(), 'brand');
  return v_revision;
end;
$$;

create or replace function public.approve_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders := private.lock_order(p_order_id, 'brand');
begin
  if v_order.status not in ('delivered', 'revision_submitted') then
    raise exception 'There is no delivery waiting for your approval.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  v_order := private.transition_order(v_order.id, 'approved', auth.uid(), 'brand', 'Delivery approved');
  return private.transition_order(v_order.id, 'completed', auth.uid(), 'system', 'Order completed');
end;
$$;

-- -----------------------------------------------------------------------------
-- Disputes
-- -----------------------------------------------------------------------------
create or replace function public.open_dispute(p_order_id uuid, p_reason text, p_description text)
returns public.disputes
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_party public.actor_role;
  v_dispute public.disputes;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  v_party := private.order_party(v_order);
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if not private.validate_order_status_transition(v_order.status, 'disputed', v_party) then
    raise exception 'A dispute cannot be opened for this order right now.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 or char_length(btrim(coalesce(p_description, ''))) < 20 then
    raise exception 'Please describe the problem in at least 20 characters.' using errcode = 'P0001', hint = 'DESCRIPTION_REQUIRED';
  end if;

  insert into public.disputes (order_id, raised_by, raised_by_role, reason, description, status, previous_order_status)
  values (v_order.id, auth.uid(), v_party, left(btrim(p_reason), 140), btrim(p_description), 'created', v_order.status)
  returning * into v_dispute;

  perform private.transition_order(v_order.id, 'disputed', auth.uid(), v_party, left(btrim(p_reason), 140));
  perform private.audit('dispute_opened', 'dispute', v_dispute.id::text,
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'reason', v_dispute.reason), auth.uid(), v_party);
  return v_dispute;
end;
$$;

create or replace function public.add_dispute_message(p_dispute_id uuid, p_body text, p_attachments jsonb default '[]')
returns public.dispute_messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_dispute public.disputes;
  v_order public.orders;
  v_role public.actor_role;
  v_msg public.dispute_messages;
  v_b uuid;
  v_c uuid;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id;
  if not found then
    raise exception 'Dispute not found.' using errcode = 'P0002', hint = 'DISPUTE_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_dispute.order_id;
  if private.is_admin() then
    v_role := 'admin';
  else
    v_role := private.order_party(v_order);
  end if;
  if v_dispute.status in ('resolved', 'refunded', 'rejected') then
    raise exception 'This dispute is closed.' using errcode = 'P0001', hint = 'DISPUTE_CLOSED';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Write a message first.' using errcode = 'P0001', hint = 'BODY_REQUIRED';
  end if;

  insert into public.dispute_messages (dispute_id, sender_id, sender_role, body, attachments)
  values (v_dispute.id, auth.uid(), v_role, btrim(p_body), coalesce(p_attachments, '[]'::jsonb))
  returning * into v_msg;

  select b.profile_id into v_b from public.brands b where b.id = v_order.brand_id;
  select c.profile_id into v_c from public.creators c where c.id = v_order.creator_id;
  if v_role <> 'brand' then
    perform private.notify(v_b, 'dispute_message', 'New message on your dispute',
      left(btrim(p_body), 140), 'order', v_order.id, '/brand/orders/' || v_order.id);
  end if;
  if v_role <> 'creator' then
    perform private.notify(v_c, 'dispute_message', 'New message on your dispute',
      left(btrim(p_body), 140), 'order', v_order.id, '/creator/orders/' || v_order.id);
  end if;
  if v_role <> 'admin' then
    perform private.notify_admins('dispute_message', 'New dispute message',
      format('Order %s: %s', v_order.order_number, left(btrim(p_body), 100)), 'dispute', v_dispute.id, '/admin/disputes/' || v_dispute.id);
  end if;
  return v_msg;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reviews (one per order per reviewer; brand → creator, optional creator → brand)
-- -----------------------------------------------------------------------------
create or replace function public.submit_review(p_order_id uuid, p_rating int, p_comment text default null)
returns public.reviews
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_party public.actor_role;
  v_review public.reviews;
  v_target uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  v_party := private.order_party(v_order);
  if v_order.status <> 'completed' then
    raise exception 'You can leave a review once the order is complete.' using errcode = 'P0001', hint = 'ORDER_NOT_COMPLETED';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5.' using errcode = 'P0001', hint = 'INVALID_RATING';
  end if;
  if exists (select 1 from public.reviews r where r.order_id = v_order.id and r.reviewer_id = auth.uid()) then
    raise exception 'You have already reviewed this order.' using errcode = 'P0001', hint = 'DUPLICATE_REVIEW';
  end if;

  insert into public.reviews (order_id, reviewer_id, reviewer_role, creator_id, brand_id, rating, comment)
  values (v_order.id, auth.uid(), v_party, v_order.creator_id, v_order.brand_id, p_rating, nullif(btrim(p_comment), ''))
  returning * into v_review;

  if v_party = 'brand' then
    select c.profile_id into v_target from public.creators c where c.id = v_order.creator_id;
    perform private.notify(v_target, 'review_received', format('You received a %s-star review', p_rating),
      coalesce(left(nullif(btrim(p_comment), ''), 140), 'A brand rated your work.'), 'order', v_order.id, '/creator/orders/' || v_order.id);
  else
    select b.profile_id into v_target from public.brands b where b.id = v_order.brand_id;
    perform private.notify(v_target, 'review_received', format('A creator rated your brand %s stars', p_rating),
      coalesce(left(nullif(btrim(p_comment), ''), 140), 'A creator shared feedback.'), 'order', v_order.id, '/brand/orders/' || v_order.id);
  end if;
  perform private.audit('review_submitted', 'review', v_review.id::text,
    jsonb_build_object('order_id', v_order.id, 'rating', p_rating), auth.uid(), v_party);
  return v_review;
exception
  when unique_violation then
    raise exception 'You have already reviewed this order.' using errcode = 'P0001', hint = 'DUPLICATE_REVIEW';
end;
$$;

create or replace function public.respond_to_review(p_review_id uuid, p_response text)
returns public.reviews
language plpgsql security definer set search_path = ''
as $$
declare
  v_review public.reviews;
begin
  select * into v_review from public.reviews r
  where r.id = p_review_id and r.reviewer_role = 'brand' and private.owns_creator(r.creator_id);
  if not found then
    raise exception 'Review not found.' using errcode = 'P0002', hint = 'REVIEW_NOT_FOUND';
  end if;
  if char_length(btrim(coalesce(p_response, ''))) = 0 then
    raise exception 'Write a response first.' using errcode = 'P0001', hint = 'BODY_REQUIRED';
  end if;
  update public.reviews set response = left(btrim(p_response), 1000), responded_at = now()
  where id = v_review.id returning * into v_review;
  return v_review;
end;
$$;
