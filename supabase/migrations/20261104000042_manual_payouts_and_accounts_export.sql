-- 0042 - Paying creators by bank transfer, and the accountant's exports
--
-- RazorpayX can't be switched on yet, so creators are paid by HOC's
-- accountant from the bank, in batches:
--
--   1. Admin → Payouts → "Prepare payouts": one payout request per creator
--      with earnings ready to pay (admin_prepare_payouts). Creators no longer
--      have to press Withdraw first, and there is no minimum.
--   2. "Download payout sheet" (PDF / Excel): name, PAN, UPI or bank account
--      + IFSC, amount, the orders it covers, and a blank UTR column
--      (admin_payout_sheet). Full account numbers: every download is audited.
--   3. The accountant pays and fills in the UTRs; admin uploads the sheet and
--      every payout is marked paid with its reference (admin_mark_payouts_paid),
--      which issues each creator's settlement statement as before.
--
-- And for the books: admin_accounts_export returns orders, brand payments,
-- refunds, creator earnings, payouts and the ledger for a period. Invoices
-- and TDS/TCS come from the registers added in 0038.
--
-- Test money never goes on a sheet unless asked for: a real creator's
-- earnings from a test account's order are never prepared for payment.
--
-- Works with or without 0040 / 0041.

begin;

-- ===================================================== prepare payouts ===
create or replace function public.admin_prepare_payouts(p_include_test boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_c record;
  v_amount numeric(12, 2);
  v_req public.payout_requests;
  v_created int := 0;
  v_total numeric(12, 2) := 0;
  v_no_details jsonb := '[]'::jsonb;
  v_open int := 0;
begin
  perform public.release_matured_earnings();

  for v_c in
    select c.id as creator_id, c.profile_id, c.display_name, pr.is_test,
           m.id as method_id, m.method_type, m.account_holder_name, m.upi_id, m.bank_account_last4, m.ifsc_code, m.bank_name,
           exists (select 1 from public.payout_requests r where r.creator_id = c.id and r.status in ('pending', 'processing')) as has_open
    from public.creators c
    join public.profiles pr on pr.id = c.profile_id and pr.status = 'active'
    left join public.payout_methods m on m.creator_id = c.id
    where c.deleted_at is null
      and (p_include_test or not pr.is_test)
      and exists (select 1 from public.creator_earnings e
                  where e.creator_id = c.id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
                    and (pr.is_test or not private.is_test_order(e.order_id)))
    order by c.display_name
    for update of c
  loop
    if v_c.method_id is null then
      v_no_details := v_no_details || jsonb_build_array(jsonb_build_object('creator_id', v_c.creator_id, 'name', v_c.display_name));
      continue;
    end if;
    if v_c.has_open then
      v_open := v_open + 1; -- their earnings go in the next batch
      continue;
    end if;

    perform 1 from public.creator_earnings e
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null
    for update;
    select coalesce(sum(e.net_amount), 0) into v_amount
    from public.creator_earnings e
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
      and (v_c.is_test or not private.is_test_order(e.order_id));
    if v_amount <= 0 then
      continue;
    end if;

    insert into public.payout_requests (creator_id, amount, status, payout_method_snapshot, notes, processed_by)
    values (v_c.creator_id, v_amount, 'pending',
            jsonb_build_object('method_type', v_c.method_type, 'account_holder_name', v_c.account_holder_name, 'upi_id', v_c.upi_id,
                               'bank_account_last4', v_c.bank_account_last4, 'ifsc_code', v_c.ifsc_code, 'bank_name', v_c.bank_name),
            'Prepared for bank transfer', v_admin)
    returning * into v_req;

    update public.creator_earnings e
    set payout_request_id = v_req.id
    where e.creator_id = v_c.creator_id and e.status = 'available' and e.payout_request_id is null and e.available_at <= now()
      and (v_c.is_test or not private.is_test_order(e.order_id));

    perform private.notify(v_c.profile_id, 'payout_requested', 'Your payout is being prepared',
      format('We’re sending %s to your %s. You’ll get the transfer reference once it’s paid.',
             private.format_inr(v_amount), case when v_c.method_type = 'upi' then 'UPI ID' else 'bank account' end),
      'payout_request', v_req.id, '/creator/payouts');

    v_created := v_created + 1;
    v_total := v_total + v_amount;
  end loop;

  perform private.audit('payouts_prepared', 'payout_request', null,
    jsonb_build_object('created', v_created, 'total', v_total, 'without_details', jsonb_array_length(v_no_details), 'already_open', v_open),
    v_admin, 'admin');

  return jsonb_build_object('created', v_created, 'total', v_total, 'without_details', v_no_details, 'already_open', v_open);
end;
$$;

-- ========================================================= payout sheet ===
-- Everything the accountant needs to make the transfers. Full account
-- numbers, so admin-only and audited on every call.
create or replace function public.admin_payout_sheet(p_status text default 'pending', p_include_test boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_rows jsonb;
begin
  if p_status not in ('pending', 'processing', 'open') then
    raise exception 'Choose pending, processing or open payouts.' using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;

  select coalesce(jsonb_agg(row order by row ->> 'creator'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'payout_request_id', r.id,
      'reference', 'HOC-PO-' || upper(substr(replace(r.id::text, '-', ''), 1, 8)),
      'requested_at', r.created_at,
      'status', r.status,
      'creator', c.display_name,
      'legal_name', t.legal_name,
      'pan', t.pan,
      'gstin', case when t.gst_registered then t.gstin end,
      'email', p.email,
      'phone', p.phone,
      'method', m.method_type,
      'account_holder', m.account_holder_name,
      'upi_id', m.upi_id,
      'account_number', m.bank_account_number,
      'ifsc', m.ifsc_code,
      'bank', m.bank_name,
      'amount', r.amount,
      'gross', coalesce(e.gross, 0),
      'commission_deducted', coalesce(e.fee, 0),
      'tds', coalesce(e.tds, 0),
      'tcs', coalesce(e.tcs, 0),
      'orders', coalesce(e.orders, ''),
      'test', p.is_test) as row
    from public.payout_requests r
    join public.creators c on c.id = r.creator_id
    join public.profiles p on p.id = c.profile_id
    left join public.payout_methods m on m.creator_id = c.id
    left join public.creator_tax_profiles t on t.creator_id = c.id
    left join lateral (
      select sum(ce.gross_amount) as gross, sum(ce.platform_fee) as fee, sum(ce.tds_amount) as tds, sum(ce.tcs_amount) as tcs,
             string_agg(o.order_number, ', ' order by o.order_number) as orders
      from public.creator_earnings ce join public.orders o on o.id = ce.order_id
      where ce.payout_request_id = r.id
    ) e on true
    where (case when p_status = 'open' then r.status in ('pending', 'processing') else r.status::text = p_status end)
      and (p_include_test or not p.is_test)
  ) x;

  perform private.audit('payout_sheet_exported', 'payout_request', null,
    jsonb_build_object('status', p_status, 'rows', jsonb_array_length(v_rows),
                       'total', (select coalesce(sum((x ->> 'amount')::numeric), 0) from jsonb_array_elements(v_rows) x)),
    v_admin, 'admin');
  return v_rows;
end;
$$;

-- ============================================== mark paid from the UTRs ===
-- p_rows: [{ "payout_request_id": uuid, "reference": "UTR…" }, …]
-- Each row is applied on its own: one bad row doesn't stop the rest.
create or replace function public.admin_mark_payouts_paid(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row jsonb;
  v_id uuid;
  v_ref text;
  v_out jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Nothing to mark as paid.' using errcode = 'P0001', hint = 'NO_ROWS';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Upload at most 500 payouts at a time.' using errcode = 'P0001', hint = 'TOO_MANY_ROWS';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_id := private.try_uuid(v_row ->> 'payout_request_id');
    v_ref := nullif(btrim(coalesce(v_row ->> 'reference', '')), '');
    if v_id is null or v_ref is null then
      v_out := v_out || jsonb_build_array(jsonb_build_object('payout_request_id', v_row ->> 'payout_request_id', 'ok', false,
        'error', case when v_id is null then 'Unknown payout ID' else 'No UTR / reference' end));
      continue;
    end if;
    begin
      perform public.complete_payout(v_id, v_admin, 'paid', 'manual', left(v_ref, 120), 'Paid by bank transfer (uploaded sheet)', '{}'::jsonb);
      v_out := v_out || jsonb_build_array(jsonb_build_object('payout_request_id', v_id, 'ok', true, 'reference', v_ref));
    exception when others then
      v_out := v_out || jsonb_build_array(jsonb_build_object('payout_request_id', v_id, 'ok', false, 'error', sqlerrm));
    end;
  end loop;
  return v_out;
end;
$$;

-- ======================================================= accounts export ===
create or replace function public.admin_accounts_export(p_from date, p_to date, p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a date range.' using errcode = 'P0001', hint = 'INVALID_RANGE';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Kolkata';
  v_to := (p_to + 1)::timestamp at time zone 'Asia/Kolkata';

  return jsonb_build_object(
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', private.ist_date(o.created_at), 'order', o.order_number, 'status', o.status, 'billing', o.billing_version,
        'brand', b.brand_name, 'creator', c.display_name, 'service', o.service_title,
        'price', o.subtotal + o.addons_total, 'creator_gst', o.creator_gst_amount,
        'brand_fee', o.brand_fee_amount, 'brand_fee_gst', o.brand_fee_gst_amount, 'total', o.total_amount,
        'commission', o.platform_fee_amount, 'creator_earning', o.creator_earning_amount,
        'paid_at', o.paid_at, 'completed_at', o.completed_at, 'test', private.is_test_order(o.id)) order by o.created_at), '[]'::jsonb)
      from public.orders o
      join public.brands b on b.id = o.brand_id
      join public.creators c on c.id = o.creator_id
      where o.created_at >= v_from and o.created_at < v_to and o.status <> 'draft'
        and (p_include_test or not private.is_test_order(o.id))),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', private.ist_date(coalesce(pm.captured_at, pm.created_at)), 'order', o.order_number, 'brand', b.brand_name,
        'amount', pm.amount, 'refunded', pm.refunded_amount, 'status', pm.status, 'method', pm.method,
        'razorpay_order', pm.provider_order_id, 'razorpay_payment', pm.provider_payment_id,
        'test', private.is_test_order(o.id)) order by coalesce(pm.captured_at, pm.created_at)), '[]'::jsonb)
      from public.payments pm
      join public.orders o on o.id = pm.order_id
      join public.brands b on b.id = o.brand_id
      where coalesce(pm.captured_at, pm.created_at) >= v_from and coalesce(pm.captured_at, pm.created_at) < v_to
        and pm.status in ('captured', 'partially_refunded', 'refunded', 'failed')
        and (p_include_test or not private.is_test_order(o.id))),
    'refunds', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', private.ist_date(rf.created_at), 'order', o.order_number, 'brand', b.brand_name, 'amount', rf.amount,
        'status', rf.status, 'razorpay_refund', rf.provider_refund_id, 'reason', rf.reason,
        'test', private.is_test_order(o.id)) order by rf.created_at), '[]'::jsonb)
      from public.payment_refunds rf
      join public.orders o on o.id = rf.order_id
      join public.brands b on b.id = o.brand_id
      where rf.created_at >= v_from and rf.created_at < v_to and (p_include_test or not private.is_test_order(o.id))),
    'earnings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', private.ist_date(e.created_at), 'order', o.order_number, 'creator', c.display_name,
        'gross', e.gross_amount, 'commission_deducted', e.platform_fee, 'tds', e.tds_amount, 'tcs', e.tcs_amount, 'net', e.net_amount,
        'status', e.status, 'available_from', e.available_at, 'paid_at', e.paid_at,
        'payout', case when e.payout_request_id is not null then 'HOC-PO-' || upper(substr(replace(e.payout_request_id::text, '-', ''), 1, 8)) end,
        'test', private.is_test_order(o.id)) order by e.created_at), '[]'::jsonb)
      from public.creator_earnings e
      join public.orders o on o.id = e.order_id
      join public.creators c on c.id = e.creator_id
      where e.created_at >= v_from and e.created_at < v_to and (p_include_test or not private.is_test_order(o.id))),
    'payouts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'requested', private.ist_date(r.created_at), 'reference', 'HOC-PO-' || upper(substr(replace(r.id::text, '-', ''), 1, 8)),
        'creator', c.display_name, 'amount', r.amount, 'status', r.status,
        'method', r.payout_method_snapshot ->> 'method_type',
        'to', coalesce(r.payout_method_snapshot ->> 'upi_id', '•••• ' || (r.payout_method_snapshot ->> 'bank_account_last4')),
        'utr', (select t.provider_reference from public.payout_transactions t where t.payout_request_id = r.id and t.status = 'success'
                order by t.created_at desc limit 1),
        'processed', private.ist_date(r.processed_at), 'notes', r.notes,
        'test', p.is_test) order by r.created_at), '[]'::jsonb)
      from public.payout_requests r
      join public.creators c on c.id = r.creator_id
      join public.profiles p on p.id = c.profile_id
      where ((r.created_at >= v_from and r.created_at < v_to) or (r.processed_at >= v_from and r.processed_at < v_to))
        and (p_include_test or not p.is_test)),
    'ledger', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', private.ist_date(l.occurred_at), 'event', l.event, 'account', l.account,
        'debit', case when l.amount > 0 then l.amount end, 'credit', case when l.amount < 0 then -l.amount end,
        'order', o.order_number, 'memo', l.memo, 'posting', l.posting_key, 'test', l.is_test) order by l.id), '[]'::jsonb)
      from public.ledger_entries l
      left join public.orders o on o.id = l.order_id
      where l.occurred_at >= v_from and l.occurred_at < v_to and (p_include_test or not l.is_test))
  );
end;
$$;

revoke execute on function public.admin_prepare_payouts(boolean), public.admin_payout_sheet(text, boolean),
  public.admin_mark_payouts_paid(jsonb), public.admin_accounts_export(date, date, boolean) from public, anon;
grant execute on function public.admin_prepare_payouts(boolean), public.admin_payout_sheet(text, boolean),
  public.admin_mark_payouts_paid(jsonb), public.admin_accounts_export(date, date, boolean) to authenticated;

commit;
