-- 0041 - Automatic creator payouts through RazorpayX
--
-- Until now a creator pressed Withdraw and an admin paid them by hand. Now,
-- with `auto_payouts_enabled` on, a scheduled job (every 15 minutes) pays
-- each creator their matured earnings through RazorpayX: once an order is
-- completed (approved by the brand) and the hold has passed, the money goes
-- to the creator's UPI or bank account on file, with no request and no admin.
--
--   order completed ─► earning (net of TDS/TCS) pending for `earning_hold_hours`
--   hold passes      ─► available ─► claim_auto_payouts: one payout request per creator
--   auto-payouts     ─► RazorpayX payout ─► processing
--   RazorpayX done   ─► paid (webhook, or the next run asking RazorpayX) ─► settlement statement
--
-- * The hold moves from days to hours: `earning_hold_hours`, 24 to start.
-- * No minimum: each creator is paid whatever has matured (the ₹500
--   minimum still applies to manual Withdraw requests).
-- * A failed payout pauses automatic payouts for that creator until they
--   update their payout details, so bad details aren't retried every run.
-- * Test money never moves for real: a real creator's earnings from a test
--   account's order are never paid; a test creator is paid in RazorpayX
--   test mode (only if `RAZORPAYX_TEST_ACCOUNT_NUMBER` is set).
-- * Earnings already pending keep the release time they were given.

begin;

-- =============================================================== settings ===
insert into public.platform_settings (key, value, description, is_public) values
  ('earning_hold_hours', '24', 'Hours after an order is completed before the creator''s earning can be paid out.', true),
  ('auto_payouts_enabled', 'false', 'Pay creators automatically through RazorpayX once the hold has passed.', true)
on conflict (key) do nothing;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns public.platform_settings
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.platform_settings;
  v_num numeric;
begin
  if p_key in ('platform_fee_percentage', 'brand_fee_percentage', 'minimum_payout_amount', 'max_revisions', 'earning_hold_days',
               'earning_hold_hours', 'creator_response_hours', 'auto_approve_days', 'payment_expiry_hours') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'This setting must be a number.' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if (p_key in ('platform_fee_percentage', 'brand_fee_percentage') and v_num not between 0 and 50)
      or (p_key = 'minimum_payout_amount' and v_num not between 0 and 1000000)
      or (p_key = 'max_revisions' and (v_num not between 0 and 10 or v_num <> trunc(v_num)))
      or (p_key = 'earning_hold_days' and (v_num not between 0 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'earning_hold_hours' and (v_num not between 0 and 1440 or v_num <> trunc(v_num)))
      or (p_key = 'creator_response_hours' and (v_num not between 1 and 720 or v_num <> trunc(v_num)))
      or (p_key = 'auto_approve_days' and (v_num not between 1 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'payment_expiry_hours' and (v_num not between 1 and 168 or v_num <> trunc(v_num))) then
      raise exception 'Value out of range for %.', p_key using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
  elsif p_key in ('require_creator_approval', 'billing_v2_enabled', 'auto_payouts_enabled') then
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

create or replace function private.create_creator_earning(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order public.orders;
  -- Hours (0041). Before that the hold was set in days.
  v_hold int := greatest(coalesce(private.setting_numeric('earning_hold_hours', null),
                                  private.setting_numeric('earning_hold_days', 0) * 24)::int, 0);
  v_w jsonb;
  v_tds numeric(12, 2);
  v_tcs numeric(12, 2);
  v_test boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.billing_version = 2 then
    v_test := coalesce(private.is_test_order(p_order_id), false);
    v_w := private.apply_withholdings(p_order_id);
    v_tds := (v_w ->> 'tds')::numeric;
    v_tcs := (v_w ->> 'tcs')::numeric;
    insert into public.creator_earnings (creator_id, order_id, gross_amount, platform_fee, tds_amount, tcs_amount, net_amount, status, available_at)
    values (
      v_order.creator_id, v_order.id, v_order.creator_earning_amount, 0, v_tds, v_tcs, v_order.creator_earning_amount - v_tds - v_tcs,
      case when v_hold = 0 then 'available'::public.earning_status else 'pending'::public.earning_status end,
      now() + make_interval(hours => v_hold)
    )
    on conflict (order_id) do nothing;
    perform private.post_ledger('withholding', 'withholding:' || v_order.id, jsonb_build_array(
      jsonb_build_object('account', 'creator_payable', 'amount', v_tds + v_tcs),
      jsonb_build_object('account', 'tds_payable', 'amount', -v_tds),
      jsonb_build_object('account', 'tcs_payable', 'amount', -v_tcs)),
      jsonb_build_object('order_id', v_order.id, 'creator_id', v_order.creator_id, 'brand_id', v_order.brand_id,
                         'is_test', v_test, 'memo', 'TDS / TCS on ' || v_order.order_number));
    perform private.issue_creator_commission_invoice(p_order_id);
    return;
  end if;

  insert into public.creator_earnings (creator_id, order_id, gross_amount, platform_fee, net_amount, status, available_at)
  values (
    v_order.creator_id, v_order.id, v_order.total_amount - v_order.brand_fee_amount, v_order.platform_fee_amount, v_order.creator_earning_amount,
    case when v_hold = 0 then 'available'::public.earning_status else 'pending'::public.earning_status end,
    now() + make_interval(hours => v_hold)
  )
  on conflict (order_id) do nothing;
end;
$$;

-- ================================================================ columns ===
alter table public.payout_requests
  add column if not exists automatic boolean not null default false;
comment on column public.payout_requests.automatic is 'Created by the automatic payout job rather than requested by the creator.';

alter table public.payout_methods
  add column if not exists auto_payout_paused_at timestamptz,
  add column if not exists auto_payout_error text check (char_length(auto_payout_error) <= 500);
comment on column public.payout_methods.auto_payout_paused_at is 'An automatic payout to these details failed; cleared when the creator saves new ones.';
-- payout_methods is granted column by column (the account number stays hidden).
grant select (auto_payout_paused_at, auto_payout_error) on public.payout_methods to authenticated;

create or replace function public.save_payout_method(p_method_type public.payout_method_type, p_account_holder_name text, p_upi_id text default null::text, p_bank_account_number text default null::text, p_ifsc_code text default null::text, p_bank_name text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
      verified = false,
      -- New details: automatic payouts may try again.
      auto_payout_paused_at = null,
      auto_payout_error = null
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
$function$;

create or replace function public.complete_payout(p_payout_request_id uuid, p_actor_id uuid, p_action text, p_provider text default 'manual'::text, p_reference text default null::text, p_note text default null::text, p_metadata jsonb default '{}'::jsonb)
returns public.payout_requests
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.payout_requests;
  v_creator_profile uuid;
begin
  -- No actor: the automatic payout job or the RazorpayX webhook (service role only).
  if p_actor_id is null then
    perform private.require_service_role();
  elsif not exists (select 1 from public.admin_users a where a.profile_id = p_actor_id and a.active) then
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
    if v_request.automatic then
      -- Don't retry the same details every 15 minutes: pause until the
      -- creator updates them (save_payout_method clears this).
      update public.payout_methods
      set auto_payout_paused_at = now(), auto_payout_error = left(coalesce(nullif(btrim(p_note), ''), 'Payout failed'), 500)
      where creator_id = v_request.creator_id;
      perform private.notify(v_creator_profile, 'payout_failed', 'Payout failed',
        format('We couldn’t send %s to your account (%s). Check your payout details: we’ll pay you automatically once they’re updated.',
               private.format_inr(v_request.amount), coalesce(nullif(btrim(p_note), ''), 'the bank refused it')),
        'payout_request', v_request.id, '/creator/payouts');
      perform private.notify_admins('payout_failed', 'Automatic payout failed',
        format('%s to %s failed: %s. Automatic payouts are paused for them until they update their details.',
               private.format_inr(v_request.amount), (select c.display_name from public.creators c where c.id = v_request.creator_id),
               coalesce(nullif(btrim(p_note), ''), 'no reason given')),
        'payout_request', v_request.id, '/admin/payouts');
    else
      perform private.notify(v_creator_profile, 'payout_failed',
        case when p_action = 'rejected' then 'Payout request rejected' else 'Payout failed' end,
        coalesce(nullif(btrim(p_note), ''), 'Please check your payout details and try again.'),
        'payout_request', v_request.id, '/creator/payouts');
    end if;
  else
    raise exception 'Unknown payout action.' using errcode = 'P0001', hint = 'INVALID_ACTION';
  end if;

  perform private.audit('payout_processed', 'payout_request', v_request.id::text,
    jsonb_build_object('action', p_action, 'amount', v_request.amount, 'provider', p_provider, 'reference', p_reference,
                       'automatic', v_request.automatic),
    p_actor_id, case when p_actor_id is null then 'system' else 'admin' end::public.actor_role);
  return v_request;
end;
$function$;

-- ================================================================== claim ===
-- Called by the `auto-payouts` Edge Function with the modes it can pay in
-- ('live' and/or 'test'). Creates one pending payout request per creator
-- with matured earnings and returns what to send. Only the service role.
create or replace function public.claim_auto_payouts(p_modes text[], p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_c record;
  v_amount numeric(12, 2);
  v_req public.payout_requests;
  v_out jsonb := '[]'::jsonb;
begin
  perform private.require_service_role();
  if not private.setting_bool('auto_payouts_enabled', false) or coalesce(cardinality(p_modes), 0) = 0 then
    return v_out;
  end if;

  perform public.release_matured_earnings();

  for v_c in
    select c.id as creator_id, c.display_name, pr.is_test,
           m.method_type, m.account_holder_name, m.upi_id, m.bank_account_number, m.bank_account_last4, m.ifsc_code, m.bank_name
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
    join public.payout_methods m on m.creator_id = c.id and m.auto_payout_paused_at is null
    where c.deleted_at is null
      and (case when pr.is_test then 'test' else 'live' end) = any (p_modes)
      and not exists (select 1 from public.payout_requests r where r.creator_id = c.id and r.status in ('pending', 'processing'))
      and exists (select 1 from public.creator_earnings e
                  where e.creator_id = c.id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
                    and (pr.is_test or not private.is_test_order(e.order_id)))
    order by c.id
    limit greatest(least(coalesce(p_limit, 20), 100), 1)
    for update of c skip locked
  loop
    perform 1 from public.creator_earnings e
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
    for update;

    select coalesce(sum(e.net_amount), 0) into v_amount
    from public.creator_earnings e
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
      and (v_c.is_test or not private.is_test_order(e.order_id));
    if v_amount < 1 then
      continue; -- RazorpayX's smallest payout is ₹1
    end if;

    insert into public.payout_requests (creator_id, amount, status, payout_method_snapshot, notes, automatic)
    values (v_c.creator_id, v_amount, 'pending',
            jsonb_build_object('method_type', v_c.method_type, 'account_holder_name', v_c.account_holder_name, 'upi_id', v_c.upi_id,
                               'bank_account_last4', v_c.bank_account_last4, 'ifsc_code', v_c.ifsc_code, 'bank_name', v_c.bank_name),
            'Automatic payout', true)
    returning * into v_req;

    update public.creator_earnings e
    set payout_request_id = v_req.id
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
      and (v_c.is_test or not private.is_test_order(e.order_id));

    perform private.audit('payout_auto_created', 'payout_request', v_req.id::text,
      jsonb_build_object('amount', v_amount, 'creator_id', v_c.creator_id, 'test', v_c.is_test), null, 'system');

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'payout_request_id', v_req.id, 'creator_id', v_c.creator_id, 'display_name', v_c.display_name,
      'amount', v_amount, 'mode', case when v_c.is_test then 'test' else 'live' end,
      'method_type', v_c.method_type, 'name', v_c.account_holder_name, 'upi', v_c.upi_id,
      'account_number', v_c.bank_account_number, 'ifsc', v_c.ifsc_code));
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.claim_auto_payouts(text[], int) from public, anon, authenticated;
grant execute on function public.claim_auto_payouts(text[], int) to service_role;

-- ================================================================= schedule ===
-- Every 15 minutes, but only wakes the Edge Function when there is something
-- to pay or a RazorpayX payout to check on.
create or replace function private.request_auto_payouts()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not private.setting_bool('auto_payouts_enabled', false) then
    return;
  end if;
  if not exists (select 1 from public.creator_earnings e
                 where e.status in ('pending', 'available') and e.payout_request_id is null and e.available_at <= now())
     and not exists (select 1 from public.payout_requests r where r.status in ('pending', 'processing') and r.automatic) then
    return;
  end if;
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    raise warning 'auto payouts skipped: pg_net or vault missing';
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'project_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'notification_webhook_secret';
  if v_url is null or v_secret is null then
    raise warning 'auto payouts skipped: vault secrets project_url / notification_webhook_secret not set';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using rtrim(v_url, '/') || '/functions/v1/auto-payouts',
          jsonb_build_object('action', 'run'),
          jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
exception when others then
  raise warning 'auto payouts request failed: %', sqlerrm;
end;
$$;
revoke execute on function private.request_auto_payouts() from public;

select cron.schedule('house-of-collabs-auto-payouts', '*/15 * * * *', 'select private.request_auto_payouts()');

commit;
