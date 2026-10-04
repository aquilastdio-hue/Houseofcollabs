-- 0059 - Payment confirmation called a function that no longer exists
--
-- `confirm_order_payment` still called `private.ensure_conversation(...)` to
-- open the order's message thread. Direct messaging was removed in migration
-- 0051 and that function went with it, so the call referenced nothing.
--
-- Postgres resolves function calls inside a plpgsql body at execution time, not
-- when the function is created, so nothing complained -- and because no order
-- has ever been paid for, the line had never run. It would have thrown
-- `42883: function private.ensure_conversation(...) does not exist` on the
-- first real payment, after the brand's money had already been captured by
-- Razorpay: the payment row would be marked captured, then the whole function
-- would roll back, leaving the order stuck at `payment_pending` while the
-- webhook retried the same failure. Found by running the lifecycle end to end
-- against the real functions.
--
-- The call is simply dropped; there is no conversation to create any more.

begin;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_provider_order_id text, p_provider_payment_id text, p_signature text DEFAULT NULL::text, p_method text DEFAULT NULL::text, p_amount_paise bigint DEFAULT NULL::bigint, p_raw jsonb DEFAULT NULL::jsonb)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

commit;
