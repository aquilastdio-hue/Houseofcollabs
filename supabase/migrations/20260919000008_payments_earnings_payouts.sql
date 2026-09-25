-- =============================================================================
-- Spotlit · 0008 · payments, refunds, earnings, payouts
-- Functions marked SERVICE ONLY are executable by service_role exclusively and
-- are invoked by Edge Functions after they verify the caller / signature.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: register a Razorpay order for an order awaiting payment
-- -----------------------------------------------------------------------------
create or replace function public.register_payment_attempt(
  p_order_id uuid,
  p_payer_id uuid,
  p_provider_order_id text,
  p_amount numeric,
  p_currency text default 'INR',
  p_raw jsonb default null
)
returns public.payments
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002', hint = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'payment_pending' then
    raise exception 'This order is not awaiting payment.' using errcode = 'P0001', hint = 'INVALID_ORDER_STATE';
  end if;
  if p_amount <> v_order.total_amount then
    raise exception 'Payment amount does not match the order total.' using errcode = 'P0001', hint = 'AMOUNT_MISMATCH';
  end if;

  insert into public.payments (order_id, payer_id, amount, currency, provider, provider_order_id, status, raw_response)
  values (v_order.id, p_payer_id, p_amount, coalesce(p_currency, 'INR'), 'razorpay', p_provider_order_id, 'created', p_raw)
  returning * into v_payment;

  perform private.audit('payment_created', 'payment', v_payment.id::text,
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'amount', p_amount,
                       'provider_order_id', p_provider_order_id),
    p_payer_id, 'brand');
  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: confirm a verified capture. Idempotent; activates the order.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_order_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_signature text default null,
  p_method text default null,
  p_amount_paise bigint default null,
  p_raw jsonb default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_brand_profile uuid;
  v_creator_name text;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    raise exception 'Payment record not found.' using errcode = 'P0002', hint = 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if p_amount_paise is not null and p_amount_paise <> round(v_payment.amount * 100)::bigint then
    raise exception 'Captured amount does not match the order total.' using errcode = 'P0001', hint = 'AMOUNT_MISMATCH';
  end if;

  if v_payment.status in ('captured', 'refunded', 'partially_refunded') then
    return v_order; -- already processed (verify-payment and webhook both call this)
  end if;

  update public.payments
  set status = 'captured',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      signature = coalesce(p_signature, signature),
      method = coalesce(p_method, method),
      captured_at = now(),
      error_code = null,
      error_description = null,
      raw_response = coalesce(p_raw, raw_response)
  where id = v_payment.id;

  perform private.audit('payment_completed', 'payment', v_payment.id::text,
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'amount', v_payment.amount,
                       'provider_payment_id', p_provider_payment_id, 'method', p_method),
    null, 'system');

  select b.profile_id into v_brand_profile from public.brands b where b.id = v_order.brand_id;
  select c.display_name into v_creator_name from public.creators c where c.id = v_order.creator_id;

  if v_order.status = 'payment_pending' then
    v_order := private.transition_order(v_order.id, 'order_placed', null, 'system', 'Payment verified');
    v_order := private.transition_order(v_order.id, 'creator_pending', null, 'system', 'Waiting for the creator to accept');
    perform private.ensure_conversation(v_order.brand_id, v_order.creator_id, v_order.id,
      format('Order %s placed for "%s".', v_order.order_number, v_order.service_title));
    perform private.notify(v_brand_profile, 'payment_received', 'Payment received',
      format('We received %s for order %s. %s has been notified.', private.format_inr(v_payment.amount), v_order.order_number, v_creator_name),
      'order', v_order.id, '/brand/orders/' || v_order.id);
  else
    -- Paid after the order was cancelled/expired: flag for refund.
    update public.orders set refund_required = true where id = v_order.id returning * into v_order;
    perform private.notify_admins('refund_required', 'Payment on inactive order',
      format('Order %s received a payment while %s. Refund required.', v_order.order_number, replace(v_order.status::text, '_', ' ')),
      'order', v_order.id, '/admin/orders/' || v_order.id);
  end if;
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: mark a failed attempt (never overrides a capture)
-- -----------------------------------------------------------------------------
create or replace function public.mark_payment_failed(
  p_provider_order_id text,
  p_provider_payment_id text default null,
  p_error_code text default null,
  p_error_description text default null,
  p_raw jsonb default null
)
returns public.payments
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments;
  v_brand_profile uuid;
  v_order public.orders;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    raise exception 'Payment record not found.' using errcode = 'P0002', hint = 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status in ('captured', 'refunded', 'partially_refunded') then
    return v_payment;
  end if;

  update public.payments
  set status = 'failed',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      error_code = left(p_error_code, 120),
      error_description = left(p_error_description, 500),
      raw_response = coalesce(p_raw, raw_response)
  where id = v_payment.id
  returning * into v_payment;

  select * into v_order from public.orders where id = v_payment.order_id;
  select b.profile_id into v_brand_profile from public.brands b where b.id = v_order.brand_id;
  perform private.notify(v_brand_profile, 'payment_failed', 'Payment failed',
    format('Your payment for order %s did not go through. You can retry from the order page.', v_order.order_number),
    'order', v_order.id, '/brand/orders/' || v_order.id);
  perform private.audit('payment_failed', 'payment', v_payment.id::text,
    jsonb_build_object('order_id', v_order.id, 'error_code', p_error_code), null, 'system');
  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: record a refund (admin-initiated or webhook). Idempotent per
-- provider refund id. A full refund moves the order to `refunded`.
-- -----------------------------------------------------------------------------
create or replace function public.record_refund(
  p_payment_id uuid,
  p_provider_refund_id text,
  p_amount numeric,
  p_status public.refund_status,
  p_reason text default null,
  p_actor_id uuid default null,
  p_raw jsonb default null
)
returns public.payment_refunds
language plpgsql security definer set search_path = ''
as $$
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
      if v_order.status in ('cancelled', 'disputed', 'completed') then
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
$$;

-- -----------------------------------------------------------------------------
-- Earnings
-- -----------------------------------------------------------------------------
create or replace function public.release_matured_earnings(p_creator_id uuid default null)
returns int
language plpgsql security definer set search_path = ''
as $$
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
          select 1 from public.orders o where o.id = e.order_id and o.status in ('disputed', 'refunded')
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
$$;

create or replace function public.get_earnings_summary()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_creator uuid := private.my_creator_id();
begin
  if v_creator is null then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  return (
    select jsonb_build_object(
      'total_earned', coalesce(sum(e.net_amount) filter (where e.status <> 'refunded'), 0),
      'gross_total', coalesce(sum(e.gross_amount) filter (where e.status <> 'refunded'), 0),
      'fees_total', coalesce(sum(e.platform_fee) filter (where e.status <> 'refunded'), 0),
      'pending', coalesce(sum(e.net_amount) filter (where e.status = 'pending' or (e.status = 'available' and e.available_at > now())), 0),
      'held', coalesce(sum(e.net_amount) filter (where e.status = 'held'), 0),
      'available', coalesce(sum(e.net_amount) filter (where e.status = 'available' and e.payout_request_id is null and e.available_at <= now()), 0),
      'in_payout', coalesce(sum(e.net_amount) filter (where e.status = 'available' and e.payout_request_id is not null), 0),
      'paid', coalesce(sum(e.net_amount) filter (where e.status = 'paid'), 0),
      'refunded', coalesce(sum(e.net_amount) filter (where e.status = 'refunded'), 0),
      'earning_count', count(*) filter (where e.status <> 'refunded'),
      'next_available_at', min(e.available_at) filter (where e.status = 'pending'),
      'minimum_payout', private.setting_numeric('minimum_payout_amount', 500),
      'platform_fee_percent', private.setting_numeric('platform_fee_percentage', 10),
      'has_payout_method', exists (select 1 from public.payout_methods pm where pm.creator_id = v_creator),
      'open_payout_request', (
        select to_jsonb(pr) - 'payout_method_snapshot'
        from public.payout_requests pr
        where pr.creator_id = v_creator and pr.status in ('pending', 'processing')
        limit 1
      )
    )
    from public.creator_earnings e
    where e.creator_id = v_creator
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Payout methods — full bank account number is write-only for clients.
-- -----------------------------------------------------------------------------
create or replace function public.save_payout_method(
  p_method_type public.payout_method_type,
  p_account_holder_name text,
  p_upi_id text default null,
  p_bank_account_number text default null,
  p_ifsc_code text default null,
  p_bank_name text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_creator uuid := private.my_creator_id();
  v_row public.payout_methods;
  v_account text := nullif(regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g'), '');
begin
  if v_creator is null then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  if not private.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501', hint = 'ACCOUNT_INACTIVE';
  end if;
  if exists (select 1 from public.payout_requests pr where pr.creator_id = v_creator and pr.status in ('pending', 'processing')) then
    raise exception 'You cannot change payout details while a payout is in progress.' using errcode = 'P0001', hint = 'PAYOUT_IN_PROGRESS';
  end if;

  insert into public.payout_methods (creator_id, method_type, account_holder_name, upi_id, bank_account_number,
                                     bank_account_last4, ifsc_code, bank_name, verified)
  values (
    v_creator, p_method_type, btrim(p_account_holder_name),
    case when p_method_type = 'upi' then lower(nullif(btrim(p_upi_id), '')) end,
    case when p_method_type = 'bank_transfer' then v_account end,
    case when p_method_type = 'bank_transfer' then right(v_account, 4) end,
    case when p_method_type = 'bank_transfer' then upper(nullif(btrim(p_ifsc_code), '')) end,
    case when p_method_type = 'bank_transfer' then nullif(btrim(p_bank_name), '') end,
    false
  )
  on conflict (creator_id) do update
  set method_type = excluded.method_type,
      account_holder_name = excluded.account_holder_name,
      upi_id = excluded.upi_id,
      bank_account_number = excluded.bank_account_number,
      bank_account_last4 = excluded.bank_account_last4,
      ifsc_code = excluded.ifsc_code,
      bank_name = excluded.bank_name,
      verified = false
  returning * into v_row;

  perform private.audit('payout_method_updated', 'payout_method', v_row.id::text,
    jsonb_build_object('method_type', v_row.method_type), auth.uid(), 'creator');

  return jsonb_build_object(
    'id', v_row.id,
    'method_type', v_row.method_type,
    'account_holder_name', v_row.account_holder_name,
    'upi_id', v_row.upi_id,
    'bank_account_last4', v_row.bank_account_last4,
    'ifsc_code', v_row.ifsc_code,
    'bank_name', v_row.bank_name,
    'verified', v_row.verified
  );
exception
  when check_violation then
    raise exception 'Please check your payout details (UPI ID, 9–18 digit account number, IFSC like HDFC0001234).'
      using errcode = 'P0001', hint = 'INVALID_PAYOUT_METHOD';
end;
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: create a payout request for the full available balance
-- -----------------------------------------------------------------------------
create or replace function public.create_payout_request(p_profile_id uuid, p_notes text default null)
returns public.payout_requests
language plpgsql security definer set search_path = ''
as $$
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
    and not exists (select 1 from public.orders o where o.id = e.order_id and o.status in ('disputed', 'refunded'));

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
$$;

-- -----------------------------------------------------------------------------
-- SERVICE ONLY: admin processes a payout.
--   p_action: 'processing' | 'paid' | 'failed' | 'rejected'
-- -----------------------------------------------------------------------------
create or replace function public.complete_payout(
  p_payout_request_id uuid,
  p_actor_id uuid,
  p_action text,
  p_provider text default 'manual',
  p_reference text default null,
  p_note text default null,
  p_metadata jsonb default '{}'
)
returns public.payout_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.payout_requests;
  v_creator_profile uuid;
begin
  if not exists (select 1 from public.admin_users a where a.profile_id = p_actor_id and a.active) then
    raise exception 'Admin access required.' using errcode = '42501', hint = 'ADMIN_REQUIRED';
  end if;
  select * into v_request from public.payout_requests where id = p_payout_request_id for update;
  if not found then
    raise exception 'Payout request not found.' using errcode = 'P0002', hint = 'PAYOUT_NOT_FOUND';
  end if;
  select c.profile_id into v_creator_profile from public.creators c where c.id = v_request.creator_id;

  if p_action = 'processing' then
    if v_request.status <> 'pending' then
      raise exception 'Only pending payouts can be moved to processing.' using errcode = 'P0001', hint = 'INVALID_PAYOUT_STATE';
    end if;
    insert into public.payout_transactions (payout_request_id, amount, provider, provider_reference, status, processed_by, metadata)
    values (v_request.id, v_request.amount, p_provider, p_reference, 'processing', p_actor_id, coalesce(p_metadata, '{}'::jsonb));
    update public.payout_requests set status = 'processing', admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
      processed_by = p_actor_id
    where id = v_request.id returning * into v_request;

  elsif p_action = 'paid' then
    if v_request.status not in ('pending', 'processing') then
      raise exception 'This payout is already closed.' using errcode = 'P0001', hint = 'INVALID_PAYOUT_STATE';
    end if;
    if nullif(btrim(p_reference), '') is null then
      raise exception 'Add the transfer reference (UTR / payout id).' using errcode = 'P0001', hint = 'REFERENCE_REQUIRED';
    end if;
    insert into public.payout_transactions (payout_request_id, amount, provider, provider_reference, status, processed_by, metadata)
    values (v_request.id, v_request.amount, p_provider, btrim(p_reference), 'success', p_actor_id, coalesce(p_metadata, '{}'::jsonb));
    update public.payout_requests
    set status = 'paid', processed_at = now(), processed_by = p_actor_id,
        admin_note = coalesce(nullif(btrim(p_note), ''), admin_note)
    where id = v_request.id returning * into v_request;
    update public.creator_earnings set status = 'paid', paid_at = now()
    where payout_request_id = v_request.id;
    perform private.notify(v_creator_profile, 'payout_processed', 'Your payout has been processed',
      format('%s was sent to your account. Reference: %s', private.format_inr(v_request.amount), btrim(p_reference)),
      'payout_request', v_request.id, '/creator/payouts');

  elsif p_action in ('failed', 'rejected') then
    if v_request.status not in ('pending', 'processing') then
      raise exception 'This payout is already closed.' using errcode = 'P0001', hint = 'INVALID_PAYOUT_STATE';
    end if;
    insert into public.payout_transactions (payout_request_id, amount, provider, provider_reference, status, failure_reason, processed_by, metadata)
    values (v_request.id, v_request.amount, p_provider, p_reference, 'failed', nullif(btrim(p_note), ''), p_actor_id, coalesce(p_metadata, '{}'::jsonb));
    update public.payout_requests
    set status = p_action::public.payout_status, processed_at = now(), processed_by = p_actor_id,
        admin_note = coalesce(nullif(btrim(p_note), ''), admin_note)
    where id = v_request.id returning * into v_request;
    update public.creator_earnings set payout_request_id = null where payout_request_id = v_request.id;
    perform private.notify(v_creator_profile, 'payout_failed',
      case when p_action = 'rejected' then 'Payout request rejected' else 'Payout failed' end,
      coalesce(nullif(btrim(p_note), ''), 'Please check your payout details and try again.'),
      'payout_request', v_request.id, '/creator/payouts');
  else
    raise exception 'Unknown payout action.' using errcode = 'P0001', hint = 'INVALID_ACTION';
  end if;

  perform private.audit('payout_processed', 'payout_request', v_request.id::text,
    jsonb_build_object('action', p_action, 'amount', v_request.amount, 'provider', p_provider, 'reference', p_reference),
    p_actor_id, 'admin');
  return v_request;
end;
$$;
