-- 0040 - Notifications show paise, and the earning after TDS / TCS
--
-- Found in the first billing test order (HOC-010070):
--
--   * `private.format_inr` rounded to whole rupees, so a ₹17.70 commission
--     invoice was announced as ₹18. Amounts with paise now show them
--     (₹17.70); whole amounts stay as they were (₹1,000), like the website.
--   * "₹100 was added to your earnings" on completion, when ₹5 TDS had been
--     withheld. It now says what was credited: the earning's net amount.

begin;

create or replace function private.format_inr(p_amount numeric)
returns text
language sql
immutable
set search_path to ''
as $$
  select '₹' || to_char(coalesce(p_amount, 0),
                        case when coalesce(p_amount, 0) = trunc(coalesce(p_amount, 0))
                             then 'FM99,99,99,99,990' else 'FM99,99,99,99,990.00' end);
$$;

-- The live definition, with only the completion message changed.
create or replace function private.after_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
        -- What was actually credited: after TDS / TCS on billing v2 orders.
        format('Order %s is complete. %s was added to your earnings.', new.order_number,
               private.format_inr(coalesce((select e.net_amount from public.creator_earnings e where e.order_id = new.id),
                                           new.creator_earning_amount))),
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

commit;
