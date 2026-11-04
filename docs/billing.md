# Billing, GST, TDS and TCS

How House of Collabs charges brands, pays creators, issues invoices and
keeps its tax books. Built in migration `20261104000038_billing_and_taxes.sql`
("billing v2"). This page is also the brief for HOC's chartered accountant:
**§8 lists what a CA must confirm before the switch is turned on.**

---

## 1. The model

HOC is a marketplace intermediary (an e-commerce operator), not the supplier
of creator services. For every order:

| Who | What |
| --- | --- |
| Brand pays HOC | creator fee + creator GST (only if the creator is GST-registered) + HOC brand commission (15%) + GST on that commission (18%) |
| HOC pays the creator | creator fee + creator GST − income-tax TDS (s.194-O) − GST TCS (s.52, registered creators only) |
| Creator pays HOC, separately | HOC creator commission (15%) + GST (18%), on its own invoice. **Never deducted from the payout.** |
| HOC keeps | brand commission + creator commission (excluding GST) |
| HOC passes to the government | GST on both commissions, TDS, TCS |

### Worked example: ₹1,000 order

| | GST-registered creator | Unregistered creator |
| --- | ---: | ---: |
| Creator fee | 1,000 | 1,000 |
| Creator GST 18% | 180 | 0 |
| HOC brand commission 15% | 150 | 150 |
| GST on brand commission 18% | 27 | 27 |
| **Brand pays** | **1,357** | **1,177** |
| TDS 0.1% (if applicable, see §3) | −1 | −1 |
| GST TCS 0.5% | −5 | 0 |
| **Creator is paid** | **1,174** | **999** |
| Separate creator commission invoice (150 + 27 GST) | 177 | 177 |

These exact numbers were reproduced against the live schema in a rolled-back
dry run before the migration was handed over.

Rounding: each amount is rounded to the paisa on its own (`round(x, 2)`).
CGST/SGST split: CGST = round(GST / 2), SGST = GST − CGST.

---

## 2. The switch

| Setting | Where | Effect |
| --- | --- | --- |
| `billing_v2_enabled` (default **off**) | Admin → Billing & tax → Settings | On: every **new** order is priced as billing v2. Off: new orders use the old maths (commission taken out of the creator's price; no GST, no invoices). |
| Test accounts | `profiles.is_test` on the brand **or** creator | Always billing v2 (and Razorpay test mode), whatever the switch says. Use them to try the whole flow. |

Each order records `billing_version` (1 or 2) at creation, so flipping the
switch never changes an order already placed.

---

## 3. Tax rules (all configurable)

Rates live in `tax_rates`, effective-dated. The rate for a date is the row
with the latest `effective_from` on or before it. Changing a rate means
adding a row from today or later (Admin → Billing & tax → Settings → Tax
rates), so earlier documents stay true. A scheduled (future) rate can be
removed; one in force cannot.

| Code | Seeded value | From | Used for |
| --- | --- | --- | --- |
| `gst_hoc_services` | 18% | 2017-07-01 | GST on the brand commission and the creator commission |
| `gst_creator_services` | 18% | 2017-07-01 | GST on a registered creator's fee, charged to the brand and passed to the creator |
| `tds_194o` | 0.1% | 2024-10-01 | TDS on the creator's fee (base excludes GST) |
| `tds_194o_no_pan` | 5% | 2020-10-01 | TDS when the creator has no PAN on file |
| `tds_194o_exemption_limit` | ₹5,00,000 (threshold) | 2020-10-01 | Individuals / HUF **with a PAN**: no TDS while their fees through HOC in the financial year, including this order, stay within the limit |
| `tcs_gst_52` | 0.5% | 2024-07-10 | GST TCS on a registered creator's fee (taxable value) |

How each is applied (`private.apply_withholdings`, once per order, when it
completes):

- **TDS**: no PAN → no-PAN rate. Individual/HUF with PAN and FY total ≤ limit →
  0, recorded with `exemption = 'individual_huf_within_limit'`. Otherwise
  the 194-O rate. PAN is read at completion (a PAN added after ordering
  counts).
- **TCS**: only if the creator was GST-registered **when the order was
  priced** (that is when GST went on the brand's bill).
- `unique (order_id, tax_type)` on `tax_withholdings` makes a second
  deduction on the same order impossible.

**Place of supply and CGST/SGST vs IGST** (`private.split_gst`):

| Document | Supplier state | Place of supply |
| --- | --- | --- |
| Creator → brand invoice | creator's state | brand's billing state, else HOC's state |
| HOC → brand commission | HOC's state (`billing_entity.state_code`, default 07 Delhi) | brand's billing state, else HOC's state |
| HOC → creator commission | HOC's state | creator's state, else HOC's state |

Same state → CGST + SGST; different → IGST. A brand's or creator's state
comes from their billing/tax profile, falling back to a state name found in
their free-text location.

---

## 4. Documents

All are rows in `invoices`, frozen when issued: parties (`supplier`,
`recipient`), `lines` and amounts are snapshots and are never recomputed.
PDFs are drawn from that snapshot in the browser (`src/lib/invoice-pdf.ts`).

| Kind | Issuer → recipient | Issued when | Number | Status |
| --- | --- | --- | --- | --- |
| `creator_service` (Tax Invoice if GST, else Invoice) | Creator → Brand, issued **on the creator's behalf** | Payment confirmed (`order_placed`) | Creator's own series: `C` + 5 characters of their id, e.g. `C4B645/2627/0001` | paid |
| `brand_commission` (Tax Invoice) | HOC → Brand | Payment confirmed | `BC/2627/000001` | paid |
| `creator_commission` (Tax Invoice) | HOC → Creator | Order completed | `CC/2627/000001` | **unpaid** until the creator pays |
| `settlement` (Settlement Statement) | HOC → Creator | Payout marked paid | `ST/2627/000001` | paid |
| `credit_note` | Same issuer as the original | Refund processed, or commission cancelled | HOC: `CN/2627/000001`; creator: `R` + their code | issued |

- Numbers are **gapless per series and financial year** (`invoice_counters`,
  row-locked until the issuing transaction commits). `2627` = FY 2026-27
  (April–March, India time). All numbers are ≤ 16 characters.
- Documents from **test accounts** get a `T` prefix (`TBC/…`, `TC…`, `TST/…`)
  so they never use up real numbers. They're hidden from admin lists unless
  "Show test accounts" is on.
- Unique indexes stop the same document being issued twice for one event.
- A creator must tick "I allow House of Collabs to issue invoices to brands on
  my behalf" to save tax details. The consent time is stored on the profile
  and in each creator invoice's `meta`.

---

## 5. Money flow and the ledger

`ledger_entries` is a double-entry ledger (positive = debit, negative =
credit; every posting sums to zero, enforced in `private.post_ledger`, which
is also idempotent per `posting_key`). Only billing v2 money is in it.

| Account | Meaning |
| --- | --- |
| `gateway_clearing` | Money in HOC's bank / Razorpay |
| `creator_payable` | Creators' money HOC holds (fee + their GST) |
| `brand_commission_revenue`, `creator_commission_revenue` | HOC income |
| `gst_output_payable` | GST charged on HOC's commissions |
| `tds_payable`, `tcs_payable` | Withheld for the government |
| `creator_commission_receivable` | Commission invoices not yet paid |

| Event | Posting (₹1,000 registered example) |
| --- | --- |
| Brand payment (`brand_payment:<order>`) | gateway +1,357 · creator_payable −1,180 · brand_commission_revenue −150 · gst_output −27 |
| Completion: TDS/TCS (`withholding:<order>`) | creator_payable +6 · tds_payable −1 · tcs_payable −5 |
| Completion: commission invoice (`creator_commission:<order>`) | receivable +177 · creator_commission_revenue −150 · gst_output −27 |
| Payout paid (`payout:<request>`) | creator_payable +1,174 · gateway −1,174 |
| Creator pays commission (`invoice_payment:<payment>`) | gateway +177 · receivable −177 |
| Tax deposited (`tax_deposit:<id>`) | tds/tcs/gst payable +x · gateway −x |
| Refund (`refund:<refund>`) | reverses the brand payment in proportion |
| Full refund after completion | also reverses TDS/TCS and the commission invoice |

**Revenue never includes GST, TDS or TCS**: they sit in liability accounts.
Creator money is a liability too, so HOC's revenue is exactly the two
revenue accounts.

---

## 6. Lifecycle, step by step

| # | Step | What the system does |
| --- | --- | --- |
| 1 | Brand opens checkout | `calculate_order_total` → `private.order_pricing` returns price, creator GST, brand fee and its GST, total |
| 2 | Brand confirms | `create_order` stores the amounts, `billing_version`, and `tax_snapshot` (parties, place of supply, rates) |
| 3 | Brand pays | Razorpay → `verify-payment` / webhook → `confirm_order_payment` (unchanged) |
| 4 | Payment recorded | trigger `billing_after_order_status` (`order_placed`) → `issue_order_invoices`: creator invoice + brand commission invoice + ledger |
| 5 | Creator delivers; brand approves | unchanged order workflow |
| 6 | Order completes | `create_creator_earning` (v2): `apply_withholdings` (TDS/TCS), earning = fee + GST − TDS − TCS, ledger |
| 7 | Commission invoiced (same moment) | `issue_creator_commission_invoice` (unpaid) + creator notification |
| 8 | Payout released | **Automatic** (see §6a): after `earning_hold_hours` (24) the `auto-payouts` job pays it through RazorpayX. Otherwise the creator requests and an admin pays. Either way `complete_payout` → trigger `billing_after_payout_paid` → settlement statement + ledger |
| 9 | Creator pays commission | Billing & tax → Pay → `invoice-payment` Edge Function → Razorpay → `confirm_invoice_payment` (webhook too). Or admin records a bank/UPI payment |
| 10 | Statuses update | invoices `paid` / `partially_paid`; ledger receivable cleared |

### 6b. Bank transfers by the accountant (migration `…0042`): how creators are paid today

While RazorpayX isn't available:

| Step | Where | What happens |
| --- | --- | --- |
| 1. Prepare payouts | Admin → Payouts → Bank transfers | `admin_prepare_payouts`: one payout request per creator with earnings past the hold (no minimum, no Withdraw needed). Creators without UPI/bank details are listed, not included |
| 2. Payout sheet | same, **PDF** or **Excel** | `admin_payout_sheet`: reference (`HOC-PO-…`), creator, legal name, PAN, UPI or account + IFSC + bank, amount (after TDS/TCS), orders, blank **UTR** column, hidden-in-plain-sight **Payout ID**. Full account numbers: admin-only, every download audited |
| 3. Upload the paid sheet | same | The Excel (or CSV) with UTRs filled in → `admin_mark_payouts_paid` marks each paid with its UTR, one row at a time; the creator is notified and gets a settlement statement |

Files: `src/components/admin/bank-transfers.tsx`, `src/lib/payout-sheet.ts` (PDF, Excel, reading the sheet back), `src/lib/xlsx.ts` (Excel writer + reader).

### 6c. The accountant's pack

Admin → Billing & tax → Overview → **For the accountant**, for any date range:
- **Excel workbook** (`src/lib/accounts-workbook.ts`): Summary, Invoices, Orders, Brand payments, Refunds, Creator earnings, Payouts, TDS & TCS, Ledger (`admin_accounts_export` + the 0038 registers).
- **All PDFs (zip)**: every invoice, credit note and settlement statement in the period, one PDF each, in folders by type.

### 6a. Automatic payouts (migration `…0041`)

| Piece | What it does |
| --- | --- |
| `earning_hold_hours` (24) | Hours from completion until an earning can be paid. Replaces `earning_hold_days`. Admin → Settings → Payouts |
| `auto_payouts_enabled` (off) | Master switch. Admin → Settings → Payouts |
| cron `house-of-collabs-auto-payouts`, every 15 min | `private.request_auto_payouts()` wakes the Edge Function only when something has matured or a payout is in flight |
| Edge Function `auto-payouts` | 1) asks RazorpayX about payouts already sent and marks them paid / failed (so a missed webhook never strands one); 2) `claim_auto_payouts` makes one payout request per creator for everything matured (no minimum), and each is sent as a RazorpayX payout to the creator's UPI or bank account. Admin → Payouts → **Run now** triggers it by hand |
| Failures | A refused or bounced payout returns the money to "available" and **pauses** automatic payouts for that creator (`payout_methods.auto_payout_paused_at`) until they save new details. Creator and admins are notified |
| Test money | Real creators are never paid for test-account orders. Test creators are paid only in RazorpayX test mode, with `RAZORPAYX_TEST_ACCOUNT_NUMBER` |
| Secrets | `RAZORPAYX_ACCOUNT_NUMBER` (live), `RAZORPAYX_TEST_ACCOUNT_NUMBER` (optional). Same API keys as payments |
| Webhook (optional) | RazorpayX events `payout.processed`, `payout.failed`, `payout.reversed`, `payout.rejected` to `razorpay-webhook`. Faster, but the job's status check works without it |

Refunds, cancellations and failures:

- **Payment fails or the order expires before paying**: nothing is issued.
- **Refund before completion**: credit notes for both brand-facing invoices
  (in proportion for a partial refund) and the ledger is reversed.
- **Full refund after completion**: also reverses TDS/TCS (rows become
  `reversed`) and cancels the commission invoice with a credit note. If the
  creator had already paid it, admins are notified to refund them.
- **Payment that arrives after an order was cancelled** isn't in the books
  (no invoices), so its refund has nothing to reverse.
- **Test money stays out of real payouts**: a real creator's payout request
  skips earnings from test-account orders.

---

## 7. Screens

| Who | Where | What |
| --- | --- | --- |
| Creator | `/creator/billing` (`src/pages/creator/Billing.tsx`) | Earnings, pending, paid, TDS, TCS, commission due; pay commission invoices; all documents as PDFs; tax details form |
| Creator | `/creator/earnings` | "Deductions" column shows TDS/TCS on v2 earnings |
| Brand | `/brand/settings/billing` (`src/pages/brand/settings/BillingSettings.tsx`) | Fees vs GST vs commission breakdown, invoices (PDF), billing details (GSTIN for input credit), payment history |
| Brand | Checkout and order page | GST lines on the creator's price and on the platform fee |
| Admin | `/admin/billing` (`src/pages/admin/Billing.tsx`) | **Overview**: transaction value, HOC revenue (brand vs creator), GST/TDS/TCS collected and owed, payouts, outstanding commissions, creator money held, month-by-month taxes, reconciliation checks. **Invoices**: every document, filters, record a commission payment, invoice register CSV. **Taxes**: record deposits/filings, TDS/TCS register CSV. **Settings**: the switch, HOC's business details, tax rates |
| Admin | Order page money panel | v2 breakdown (GST lines, commission invoiced) |

---

## 8. Before switching on: CA checklist

The system does what the spec asked, with every rule configurable. A
qualified CA should confirm or change:

1. **HOC's details**: GSTIN, PAN, TAN, state, address (Admin → Billing &
   tax → Settings). Commission invoices print them; the GSTIN is required
   to charge GST.
2. **SAC codes**: commission `998599` and creator work `998361` are
   placeholders.
3. **TDS 194-O**: the 0.1% rate, the 5% no-PAN rate, and how the ₹5 lakh
   individual/HUF exemption is applied (we test the year's running total
   **including** the current order, using completed orders). Also confirm
   the base excludes GST.
4. **GST TCS s.52**: 0.5% on taxable value for registered creators only;
   unregistered creators (below the threshold) get no TCS.
5. **Place of supply**: brand's state for brand-facing invoices, creator's
   state for the creator commission, and the fallback to HOC's state when a
   party has no address.
6. **Invoices issued on creators' behalf**: the consent wording, and the
   per-creator numbering series.
7. **Unregistered creators' invoice title** ("Invoice", no GST).
8. **Refund treatment**: proportional credit notes for partial refunds;
   TDS/TCS reversed only on full refunds after completion.
9. **E-invoicing (IRN/QR)**: not built. It's required once HOC's turnover
   crosses the e-invoicing threshold.
10. **Returns**: the CSV registers (invoice register, TDS/TCS register) are
    the basis for GSTR-1, GSTR-3B, GSTR-8 and Form 26Q. Filing itself is
    outside the app; record each challan and filing under Taxes.

---

## 9. Files

| Layer | File |
| --- | --- |
| Database | `supabase/migrations/20261104000038_billing_and_taxes.sql`: tables `billing_entity`, `tax_rates`, `creator_tax_profiles`, `brand_billing_profiles`, `tax_withholdings`, `tax_deposits`, `invoices`, `invoice_counters`, `invoice_payments`, `ledger_entries`; order and earning columns; all functions and triggers below |
| Key SQL | `private.order_pricing`, `public.calculate_order_total`, `public.create_order`, `private.issue_order_invoices`, `private.apply_withholdings`, `private.create_creator_earning`, `private.issue_creator_commission_invoice`, `private.issue_settlement_statement`, `private.billing_apply_refund`, `private.issue_credit_note`, `public.confirm_invoice_payment`, `public.admin_record_invoice_payment`, `public.create_payout_request` (test-money guard), `public.get_my_billing_summary`, `public.admin_billing_summary`, `public.admin_invoice_register`, `public.admin_withholding_register`, `public.save_my_tax_profile`, `public.admin_save_billing_entity`, `public.admin_save_tax_rate`, `public.admin_record_tax_deposit` |
| Edge Functions | `supabase/functions/invoice-payment/` (new); `razorpay-webhook` (now also confirms commission payments) |
| Frontend | `src/services/billing.service.ts`, `src/lib/gst.ts` (+ test), `src/lib/invoice-pdf.ts` (+ test, uses `pdf-lib`, lazy-loaded), `src/components/billing/*`, `src/components/admin/billing-*.tsx`, the pages in §7 |

## 10. Known limits

- PDFs use the standard PDF fonts: amounts print as "Rs." and non-Latin
  characters (e.g. Hindi names) print as `?`. Embedding a Unicode font
  fixes this if needed.
- Campaigns (open calls) don't take payment yet; billing applies to orders.
- No e-invoicing (IRN), no automatic GST/TDS filing, no RazorpayX payouts.
- A creator who never pays a commission invoice isn't blocked from payouts;
  admins see it under outstanding commissions.
