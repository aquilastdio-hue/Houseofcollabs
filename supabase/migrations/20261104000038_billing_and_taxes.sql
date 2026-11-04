-- 0038 - Billing: GST, TDS (194-O), GST TCS (Section 52), invoices, ledger
--
-- The money model changes from "commission comes out of the creator's price"
-- to the one House of Collabs runs as a marketplace intermediary:
--
--   Brand pays:     creator fee + creator GST (if the creator is registered)
--                   + HOC brand commission + GST on that commission
--   Creator gets:   creator fee + creator GST − TDS (194-O) − GST TCS (s.52)
--   Creator owes:   HOC creator commission + GST, on a separate invoice they
--                   pay themselves. It is never deducted from their payout.
--
-- For a ₹1,000 order at 15% / 15% / 18% GST, registered creator:
--   brand pays 1,000 + 180 + 150 + 27 = 1,357
--   creator gets 1,000 + 180 − 1 (TDS 0.1%) − 5 (TCS 0.5%) = 1,174
--   creator commission invoice 150 + 27 = 177
-- Unregistered creator: brand pays 1,177, creator gets 999, invoice 177.
--
-- Four documents are issued automatically, each numbered gaplessly per
-- financial year:
--   creator_service     Creator → Brand  (on payment; issued on the creator's behalf)
--   brand_commission    HOC → Brand      (on payment)
--   creator_commission  HOC → Creator    (on completion; unpaid until the creator pays)
--   settlement          HOC → Creator    (when a payout is marked paid)
-- plus credit notes when a paid order is refunded.
--
-- A double-entry ledger (`ledger_entries`) keeps creator money, HOC revenue,
-- GST, TDS and TCS in separate accounts. Taxes collected or withheld are
-- liabilities, never revenue.
--
-- SWITCH. Everything here applies to an order only when it is priced as
-- billing version 2: when `billing_v2_enabled` is on, or the brand or the
-- creator is a test account. Existing orders, and new ones while the switch
-- is off, keep the old maths (billing version 1) untouched.
--
-- TAX RULES ARE SETTINGS. Rates, the 194-O exemption limit and their
-- effective dates live in `tax_rates`; HOC's GSTIN, PAN, TAN, state and SAC
-- codes in `billing_entity`. A qualified CA should review both, and the
-- notes in docs/billing.md, before the switch is turned on.

begin;

-- =============================================================== settings ===
insert into public.platform_settings (key, value, description, is_public) values
  ('billing_v2_enabled', 'false',
   'Charge GST and issue GST invoices, TDS and TCS on new orders. Test accounts always use it.', false)
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
               'creator_response_hours', 'auto_approve_days', 'payment_expiry_hours') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'This setting must be a number.' using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if (p_key in ('platform_fee_percentage', 'brand_fee_percentage') and v_num not between 0 and 50)
      or (p_key = 'minimum_payout_amount' and v_num not between 0 and 1000000)
      or (p_key = 'max_revisions' and (v_num not between 0 and 10 or v_num <> trunc(v_num)))
      or (p_key = 'earning_hold_days' and (v_num not between 0 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'creator_response_hours' and (v_num not between 1 and 720 or v_num <> trunc(v_num)))
      or (p_key = 'auto_approve_days' and (v_num not between 1 and 60 or v_num <> trunc(v_num)))
      or (p_key = 'payment_expiry_hours' and (v_num not between 1 and 168 or v_num <> trunc(v_num))) then
      raise exception 'Value out of range for %.', p_key using errcode = 'P0001', hint = 'INVALID_SETTING';
    end if;
  elsif p_key in ('require_creator_approval', 'billing_v2_enabled') then
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

-- ============================================================== helpers ===
-- India time and the April–March financial year.
create or replace function private.ist_date(p_ts timestamptz default now())
returns date
language sql
stable
set search_path to ''
as $$
  select (p_ts at time zone 'Asia/Kolkata')::date;
$$;

-- 2026-11-04 → '2026-27'; 2027-02-10 → '2026-27'; 2027-04-01 → '2027-28'.
create or replace function private.financial_year(p_ts timestamptz default now())
returns text
language sql
stable
set search_path to ''
as $$
  select y || '-' || lpad(((y + 1) % 100)::text, 2, '0')
  from (
    select extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end as y
    from (select private.ist_date(p_ts) as d) x
  ) z;
$$;

-- GST state codes, with the spellings people actually type. A free-text
-- location ("Mumbai, Maharashtra") resolves when it names a state.
create or replace function private.gst_state_code(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  with states(code, names) as (
    values
      ('01', array['jammu and kashmir', 'jammu & kashmir', 'j&k']),
      ('02', array['himachal pradesh']),
      ('03', array['punjab']),
      ('04', array['chandigarh']),
      ('05', array['uttarakhand', 'uttaranchal']),
      ('06', array['haryana', 'gurugram', 'gurgaon', 'faridabad']),
      ('07', array['delhi', 'new delhi', 'nct of delhi']),
      ('08', array['rajasthan']),
      ('09', array['uttar pradesh', 'noida', 'ghaziabad', 'lucknow']),
      ('10', array['bihar']),
      ('11', array['sikkim']),
      ('12', array['arunachal pradesh']),
      ('13', array['nagaland']),
      ('14', array['manipur']),
      ('15', array['mizoram']),
      ('16', array['tripura']),
      ('17', array['meghalaya']),
      ('18', array['assam']),
      ('19', array['west bengal', 'kolkata']),
      ('20', array['jharkhand']),
      ('21', array['odisha', 'orissa']),
      ('22', array['chhattisgarh', 'chattisgarh']),
      ('23', array['madhya pradesh']),
      ('24', array['gujarat']),
      ('26', array['dadra and nagar haveli and daman and diu', 'daman and diu', 'dadra and nagar haveli']),
      ('27', array['maharashtra', 'mumbai', 'pune']),
      ('29', array['karnataka', 'bengaluru', 'bangalore']),
      ('30', array['goa']),
      ('31', array['lakshadweep']),
      ('32', array['kerala']),
      ('33', array['tamil nadu', 'chennai']),
      ('34', array['puducherry', 'pondicherry']),
      ('35', array['andaman and nicobar islands', 'andaman & nicobar']),
      ('36', array['telangana', 'hyderabad']),
      ('37', array['andhra pradesh']),
      ('38', array['ladakh'])
  )
  select s.code
  from states s, unnest(s.names) n
  where nullif(btrim(p_text), '') is not null
    and (lower(btrim(p_text)) = n or lower(p_text) like '%' || n || '%')
  order by (lower(btrim(p_text)) = n) desc, length(n) desc
  limit 1;
$$;

-- Same-state supply → half CGST, half SGST. Otherwise IGST.
create or replace function private.split_gst(p_gst numeric, p_supplier_state text, p_place_of_supply text)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select case
    when coalesce(p_gst, 0) = 0 then jsonb_build_object('cgst', 0, 'sgst', 0, 'igst', 0)
    when p_supplier_state is not distinct from p_place_of_supply
      then jsonb_build_object('cgst', round(p_gst / 2, 2), 'sgst', p_gst - round(p_gst / 2, 2), 'igst', 0)
    else jsonb_build_object('cgst', 0, 'sgst', 0, 'igst', p_gst)
  end;
$$;

revoke execute on function private.ist_date(timestamptz), private.financial_year(timestamptz),
  private.gst_state_code(text), private.split_gst(numeric, text, text) from public;

-- ======================================================== HOC's details ===
create table if not exists public.billing_entity (
  id boolean primary key default true check (id),
  legal_name text not null default 'House of Collabs' check (char_length(btrim(legal_name)) between 2 and 200),
  trade_name text check (char_length(trade_name) <= 200),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  tan text check (tan is null or tan ~ '^[A-Z]{4}[0-9]{5}[A-Z]$'),
  state_code text not null default '07' check (state_code ~ '^[0-9]{2}$'),
  address text check (char_length(address) <= 500),
  city text check (char_length(city) <= 100),
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  commission_sac text not null default '998599' check (commission_sac ~ '^[0-9]{4,8}$'),
  creator_service_sac text not null default '998361' check (creator_service_sac ~ '^[0-9]{4,8}$'),
  invoice_note text check (char_length(invoice_note) <= 1000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint billing_entity_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code),
  constraint billing_entity_gstin_pan check (gstin is null or pan is null or substr(gstin, 3, 10) = pan)
);
comment on table public.billing_entity is 'House of Collabs'' own legal and tax details, printed on every document it issues. One row.';

insert into public.billing_entity (id, address, city, email)
values (true, 'Aquila Studios, KG Marg, Connaught Place', 'New Delhi', 'houseofcollabsofficial@gmail.com')
on conflict (id) do nothing;

alter table public.billing_entity enable row level security;
drop policy if exists "Admins read billing entity" on public.billing_entity;
create policy "Admins read billing entity" on public.billing_entity
  for select to authenticated using ((select private.is_admin()));

-- ============================================================ tax rates ===
-- Effective-dated: the rate for a date is the row with the latest
-- effective_from on or before it. Changing a rate means adding a row, so
-- history is never rewritten.
create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in ('gst_hoc_services', 'gst_creator_services', 'tds_194o', 'tds_194o_no_pan',
                                     'tds_194o_exemption_limit', 'tcs_gst_52')),
  rate numeric(7, 4) not null default 0 check (rate between 0 and 100),
  threshold numeric(14, 2) check (threshold is null or threshold >= 0),
  effective_from date not null,
  note text check (char_length(note) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (code, effective_from)
);
comment on table public.tax_rates is 'Tax rates and thresholds with effective dates. Reviewed by HOC''s CA; edited in Admin → Billing → Settings.';

insert into public.tax_rates (code, rate, threshold, effective_from, note) values
  ('gst_hoc_services', 18, null, '2017-07-01', 'GST on HOC''s brand and creator commissions.'),
  ('gst_creator_services', 18, null, '2017-07-01', 'GST on a GST-registered creator''s fee, collected from the brand and passed to the creator.'),
  ('tds_194o', 0.1, null, '2024-10-01', 'Income-tax TDS on e-commerce participants, s.194-O (rate from 1 Oct 2024).'),
  ('tds_194o_no_pan', 5, null, '2020-10-01', 'TDS when the creator has not given a PAN (s.206AA).'),
  ('tds_194o_exemption_limit', 0, 500000, '2020-10-01', 'Individuals / HUF with a PAN: no TDS while their gross through HOC in the financial year stays within this amount (s.194-O(4)).'),
  ('tcs_gst_52', 0.5, null, '2024-07-10', 'GST TCS by an e-commerce operator, s.52 CGST Act (0.25% CGST + 0.25% SGST, or 0.5% IGST).')
on conflict (code, effective_from) do nothing;

alter table public.tax_rates enable row level security;
drop policy if exists "Signed-in users read tax rates" on public.tax_rates;
create policy "Signed-in users read tax rates" on public.tax_rates for select to authenticated using (true);

create or replace function private.tax_rate(p_code text, p_on date default null)
returns public.tax_rates
language sql
stable
security definer
set search_path to ''
as $$
  select r.*
  from public.tax_rates r
  where r.code = p_code and r.effective_from <= coalesce(p_on, private.ist_date(now()))
  order by r.effective_from desc
  limit 1;
$$;
revoke execute on function private.tax_rate(text, date) from public;

-- ========================================================= tax profiles ===
create table if not exists public.creator_tax_profiles (
  creator_id uuid primary key references public.creators (id) on delete cascade,
  entity_type text not null default 'individual'
    check (entity_type in ('individual', 'huf', 'sole_proprietor', 'partnership', 'llp', 'company', 'other')),
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  gst_registered boolean not null default false,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  address text check (char_length(address) <= 500),
  city text check (char_length(city) <= 100),
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  invoice_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_tax_gstin_needed check (not gst_registered or gstin is not null),
  constraint creator_tax_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code),
  constraint creator_tax_gstin_pan check (gstin is null or pan is null or substr(gstin, 3, 10) = pan)
);
comment on column public.creator_tax_profiles.invoice_consent_at is 'When the creator authorised HOC to issue invoices to brands on their behalf.';

create table if not exists public.brand_billing_profiles (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  address text check (char_length(address) <= 500),
  city text check (char_length(city) <= 100),
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_billing_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code)
);

alter table public.creator_tax_profiles enable row level security;
alter table public.brand_billing_profiles enable row level security;
drop policy if exists "Creators read own tax profile" on public.creator_tax_profiles;
create policy "Creators read own tax profile" on public.creator_tax_profiles
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));
drop policy if exists "Brands read own billing profile" on public.brand_billing_profiles;
create policy "Brands read own billing profile" on public.brand_billing_profiles
  for select to authenticated using (brand_id = (select private.my_brand_id()) or (select private.is_admin()));

drop trigger if exists set_updated_at on public.creator_tax_profiles;
create trigger set_updated_at before update on public.creator_tax_profiles for each row execute function private.set_updated_at();
drop trigger if exists set_updated_at on public.brand_billing_profiles;
create trigger set_updated_at before update on public.brand_billing_profiles for each row execute function private.set_updated_at();

-- Snapshots of each party, as printed on documents.
create or replace function private.hoc_party()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'name', e.legal_name, 'trade_name', e.trade_name, 'gstin', e.gstin, 'pan', e.pan, 'tan', e.tan,
    'state_code', e.state_code, 'address', e.address, 'city', e.city, 'pincode', e.pincode,
    'email', e.email, 'phone', e.phone, 'commission_sac', e.commission_sac,
    'creator_service_sac', e.creator_service_sac, 'note', e.invoice_note)
  from public.billing_entity e where e.id;
$$;

-- PAN is left off documents a brand sees; GSTIN already carries it for
-- registered creators, and an individual's PAN is theirs to share.
create or replace function private.creator_party(p_creator_id uuid, p_include_pan boolean default false)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'creator_id', c.id,
    'name', coalesce(t.legal_name, c.display_name),
    'display_name', c.display_name,
    'gst_registered', coalesce(t.gst_registered, false),
    'gstin', case when t.gst_registered then t.gstin end,
    'pan', case when p_include_pan then t.pan end,
    'entity_type', coalesce(t.entity_type, 'individual'),
    'state_code', coalesce(t.state_code, private.gst_state_code(c.state), private.gst_state_code(c.city)),
    'address', t.address,
    'city', coalesce(t.city, c.city),
    'pincode', t.pincode,
    'email', p.email,
    'has_tax_profile', t.creator_id is not null,
    'invoice_consent_at', t.invoice_consent_at)
  from public.creators c
  join public.profiles p on p.id = c.profile_id
  left join public.creator_tax_profiles t on t.creator_id = c.id
  where c.id = p_creator_id;
$$;

create or replace function private.brand_party(p_brand_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'brand_id', b.id,
    'name', coalesce(t.legal_name, b.brand_name),
    'brand_name', b.brand_name,
    'gstin', t.gstin,
    'pan', t.pan,
    'state_code', coalesce(t.state_code, private.gst_state_code(b.location)),
    'address', t.address,
    'city', coalesce(t.city, b.location),
    'pincode', t.pincode,
    'email', coalesce(b.contact_email, p.email),
    'has_billing_profile', t.brand_id is not null)
  from public.brands b
  join public.profiles p on p.id = b.profile_id
  left join public.brand_billing_profiles t on t.brand_id = b.id
  where b.id = p_brand_id;
$$;

revoke execute on function private.hoc_party(), private.creator_party(uuid, boolean), private.brand_party(uuid) from public;

-- Creators and brands save their own details here (the tables have no
-- client write grants), so every rule below runs whatever the client sends.
create or replace function public.save_my_tax_profile(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_creator uuid := private.my_creator_id();
  v_brand uuid := private.my_brand_id();
  v_name text := nullif(btrim(p_profile ->> 'legal_name'), '');
  v_pan text := nullif(upper(regexp_replace(coalesce(p_profile ->> 'pan', ''), '\s', '', 'g')), '');
  v_gstin text := nullif(upper(regexp_replace(coalesce(p_profile ->> 'gstin', ''), '\s', '', 'g')), '');
  v_state text := nullif(btrim(p_profile ->> 'state_code'), '');
  v_registered boolean := coalesce((p_profile ->> 'gst_registered')::boolean, false);
  v_entity text := coalesce(nullif(p_profile ->> 'entity_type', ''), 'individual');
begin
  if auth.uid() is null or not private.is_active_user() then
    raise exception 'Please sign in to continue.' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if v_name is null then
    raise exception 'Enter the legal name for your invoices.' using errcode = 'P0001', hint = 'LEGAL_NAME_REQUIRED';
  end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'That PAN doesn''t look right. It is 10 characters, like ABCDE1234F.' using errcode = 'P0001', hint = 'INVALID_PAN';
  end if;
  if v_gstin is not null and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'That GSTIN doesn''t look right. It is 15 characters, like 07ABCDE1234F1Z5.' using errcode = 'P0001', hint = 'INVALID_GSTIN';
  end if;
  if v_gstin is not null then
    v_state := coalesce(v_state, substr(v_gstin, 1, 2));
    if substr(v_gstin, 1, 2) <> v_state then
      raise exception 'Your GSTIN belongs to a different state from the one you chose.' using errcode = 'P0001', hint = 'GSTIN_STATE_MISMATCH';
    end if;
    if v_pan is not null and substr(v_gstin, 3, 10) <> v_pan then
      raise exception 'Your GSTIN doesn''t contain this PAN. Check both.' using errcode = 'P0001', hint = 'GSTIN_PAN_MISMATCH';
    end if;
    v_pan := coalesce(v_pan, substr(v_gstin, 3, 10));
  end if;
  if v_state is null or v_state !~ '^[0-9]{2}$' then
    raise exception 'Choose your state.' using errcode = 'P0001', hint = 'STATE_REQUIRED';
  end if;

  if v_creator is not null then
    if v_registered and v_gstin is null then
      raise exception 'Enter your GSTIN, or switch off "GST registered".' using errcode = 'P0001', hint = 'GSTIN_REQUIRED';
    end if;
    if not coalesce((p_profile ->> 'invoice_consent')::boolean, false) then
      raise exception 'Please allow House of Collabs to issue invoices on your behalf.' using errcode = 'P0001', hint = 'CONSENT_REQUIRED';
    end if;
    if v_entity not in ('individual', 'huf', 'sole_proprietor', 'partnership', 'llp', 'company', 'other') then
      raise exception 'Choose what kind of taxpayer you are.' using errcode = 'P0001', hint = 'INVALID_ENTITY_TYPE';
    end if;
    insert into public.creator_tax_profiles as t (creator_id, entity_type, legal_name, pan, gst_registered, gstin, state_code,
                                                 address, city, pincode, invoice_consent_at)
    values (v_creator, v_entity, left(v_name, 200), v_pan, v_registered, case when v_registered then v_gstin end, v_state,
            left(nullif(btrim(p_profile ->> 'address'), ''), 500), left(nullif(btrim(p_profile ->> 'city'), ''), 100),
            nullif(btrim(p_profile ->> 'pincode'), ''), now())
    on conflict (creator_id) do update
    set entity_type = excluded.entity_type, legal_name = excluded.legal_name, pan = excluded.pan,
        gst_registered = excluded.gst_registered, gstin = excluded.gstin, state_code = excluded.state_code,
        address = excluded.address, city = excluded.city, pincode = excluded.pincode,
        invoice_consent_at = coalesce(t.invoice_consent_at, excluded.invoice_consent_at);
    perform private.audit('tax_profile_saved', 'creator', v_creator::text,
      jsonb_build_object('gst_registered', v_registered, 'has_pan', v_pan is not null, 'state_code', v_state), auth.uid(), 'creator');
    return (select to_jsonb(t) from public.creator_tax_profiles t where t.creator_id = v_creator);
  elsif v_brand is not null then
    insert into public.brand_billing_profiles as t (brand_id, legal_name, gstin, pan, state_code, address, city, pincode)
    values (v_brand, left(v_name, 200), v_gstin, v_pan, v_state, left(nullif(btrim(p_profile ->> 'address'), ''), 500),
            left(nullif(btrim(p_profile ->> 'city'), ''), 100), nullif(btrim(p_profile ->> 'pincode'), ''))
    on conflict (brand_id) do update
    set legal_name = excluded.legal_name, gstin = excluded.gstin, pan = excluded.pan, state_code = excluded.state_code,
        address = excluded.address, city = excluded.city, pincode = excluded.pincode;
    perform private.audit('billing_profile_saved', 'brand', v_brand::text,
      jsonb_build_object('has_gstin', v_gstin is not null, 'state_code', v_state), auth.uid(), 'brand');
    return (select to_jsonb(t) from public.brand_billing_profiles t where t.brand_id = v_brand);
  end if;
  raise exception 'Only brands and creators have billing details.' using errcode = '42501', hint = 'ROLE_REQUIRED';
end;
$$;
revoke execute on function public.save_my_tax_profile(jsonb) from public, anon;
grant execute on function public.save_my_tax_profile(jsonb) to authenticated;

-- ============================================================== orders ===
alter table public.orders
  add column if not exists billing_version smallint not null default 1 check (billing_version in (1, 2)),
  add column if not exists creator_gst_percent numeric(5, 2) not null default 0 check (creator_gst_percent between 0 and 100),
  add column if not exists creator_gst_amount numeric(12, 2) not null default 0 check (creator_gst_amount >= 0),
  add column if not exists brand_fee_gst_percent numeric(5, 2) not null default 0 check (brand_fee_gst_percent between 0 and 100),
  add column if not exists brand_fee_gst_amount numeric(12, 2) not null default 0 check (brand_fee_gst_amount >= 0),
  add column if not exists tax_snapshot jsonb;

comment on column public.orders.billing_version is '1: commission taken out of the creator''s price. 2: GST, TDS/TCS and a separate creator commission invoice (migration 0038).';
comment on column public.orders.total_amount is 'What the brand pays: price + creator GST + brand commission + GST on it.';
comment on column public.orders.creator_earning_amount is 'v1: price − commission. v2: price + creator GST, before TDS and TCS (see creator_earnings).';
comment on column public.orders.platform_fee_amount is 'Creator commission. v1: deducted from the price. v2: invoiced to the creator separately.';
comment on column public.orders.tax_snapshot is 'v2: the parties, place of supply and rates the order was priced with.';

alter table public.orders drop constraint if exists orders_total_matches;
alter table public.orders add constraint orders_total_matches
  check (total_amount = subtotal + addons_total + brand_fee_amount + creator_gst_amount + brand_fee_gst_amount);
alter table public.orders drop constraint if exists orders_earning_matches;
alter table public.orders add constraint orders_earning_matches check (
  (billing_version = 1 and creator_earning_amount = subtotal + addons_total - platform_fee_amount)
  or (billing_version = 2 and creator_earning_amount = subtotal + addons_total + creator_gst_amount));

alter table public.creator_earnings
  add column if not exists tds_amount numeric(12, 2) not null default 0 check (tds_amount >= 0),
  add column if not exists tcs_amount numeric(12, 2) not null default 0 check (tcs_amount >= 0);
alter table public.creator_earnings drop constraint if exists creator_earnings_net_matches;
alter table public.creator_earnings add constraint creator_earnings_net_matches
  check (net_amount = gross_amount - platform_fee - tds_amount - tcs_amount);

-- Which maths a new order uses.
create or replace function private.billing_v2_for(p_brand_id uuid, p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.setting_bool('billing_v2_enabled', false)
      or exists (select 1 from public.brands b join public.profiles p on p.id = b.profile_id where b.id = p_brand_id and p.is_test)
      or coalesce(private.is_test_creator(p_creator_id), false);
$$;
revoke execute on function private.billing_v2_for(uuid, uuid) from public;

-- The single place an order's money is worked out.
create or replace function private.order_pricing(p_creator_id uuid, p_brand_id uuid, p_price numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_today date := private.ist_date(now());
  v_brand_pct numeric := private.setting_numeric('brand_fee_percentage', 0);
  v_comm_pct numeric := private.setting_numeric('platform_fee_percentage', 10);
  v_brand_fee numeric(12, 2) := private.calculate_brand_fee(p_price);
  v_comm numeric(12, 2) := public.calculate_platform_fee(p_price);
  v_creator jsonb;
  v_brand jsonb;
  v_hoc jsonb;
  v_registered boolean;
  v_gst_c numeric := 0;
  v_gst_h numeric;
  v_tds numeric;
  v_tcs numeric := 0;
  v_creator_gst numeric(12, 2);
  v_brand_fee_gst numeric(12, 2);
  v_comm_gst numeric(12, 2);
  v_pos text;
begin
  if not private.billing_v2_for(p_brand_id, p_creator_id) then
    return jsonb_build_object(
      'billing_version', 1, 'price', p_price,
      'brand_fee_percent', v_brand_pct, 'brand_fee', v_brand_fee,
      'brand_fee_gst_percent', 0, 'brand_fee_gst', 0,
      'creator_gst_registered', false, 'creator_gst_percent', 0, 'creator_gst', 0,
      'platform_fee_percent', v_comm_pct, 'platform_fee', v_comm,
      'creator_commission_gst', 0,
      'total', p_price + v_brand_fee,
      'creator_earning', p_price - v_comm);
  end if;

  v_creator := private.creator_party(p_creator_id, false);
  v_brand := case when p_brand_id is not null then private.brand_party(p_brand_id) end;
  v_hoc := private.hoc_party();
  v_registered := coalesce((v_creator ->> 'gst_registered')::boolean, false);
  v_gst_h := coalesce((private.tax_rate('gst_hoc_services', v_today)).rate, 0);
  v_tds := coalesce((private.tax_rate('tds_194o', v_today)).rate, 0);
  if v_registered then
    v_gst_c := coalesce((private.tax_rate('gst_creator_services', v_today)).rate, 0);
    v_tcs := coalesce((private.tax_rate('tcs_gst_52', v_today)).rate, 0);
  end if;

  v_creator_gst := round(p_price * v_gst_c / 100, 2);
  v_brand_fee_gst := round(v_brand_fee * v_gst_h / 100, 2);
  v_comm_gst := round(v_comm * v_gst_h / 100, 2);
  -- Services to a business: where the recipient is. No address on record:
  -- where the supplier is.
  v_pos := coalesce(v_brand ->> 'state_code', v_hoc ->> 'state_code');

  return jsonb_build_object(
    'billing_version', 2, 'price', p_price,
    'brand_fee_percent', v_brand_pct, 'brand_fee', v_brand_fee,
    'brand_fee_gst_percent', v_gst_h, 'brand_fee_gst', v_brand_fee_gst,
    'creator_gst_registered', v_registered, 'creator_gst_percent', v_gst_c, 'creator_gst', v_creator_gst,
    'platform_fee_percent', v_comm_pct, 'platform_fee', v_comm,
    'creator_commission_gst_percent', v_gst_h, 'creator_commission_gst', v_comm_gst,
    'total', p_price + v_creator_gst + v_brand_fee + v_brand_fee_gst,
    'creator_earning', p_price + v_creator_gst,
    'estimated_tds', round(p_price * v_tds / 100, 2),
    'estimated_tcs', round(p_price * v_tcs / 100, 2),
    'place_of_supply', v_pos,
    'tax_snapshot', jsonb_build_object(
      'creator', v_creator, 'brand', v_brand, 'hoc', v_hoc, 'place_of_supply', v_pos, 'priced_on', v_today,
      'rates', jsonb_build_object('gst_creator_services', v_gst_c, 'gst_hoc_services', v_gst_h,
                                  'tds_194o', v_tds, 'tcs_gst_52', v_tcs)));
end;
$$;
revoke execute on function private.order_pricing(uuid, uuid, numeric) from public;

create or replace function public.calculate_order_total(p_service_id uuid, p_addon_ids uuid[] default '{}'::uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_service public.creator_services;
  v_ids uuid[] := coalesce(p_addon_ids, '{}');
  v_addon_total numeric(12, 2);
  v_extra_rev int;
  v_override int;
  v_valid_count int;
  v_price numeric(12, 2);
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

  v_price := v_service.price + v_addon_total;

  -- The parties' details stay out of the quote; they go on the order.
  return jsonb_build_object(
    'service_id', v_service.id,
    'subtotal', v_service.price,
    'addons_total', v_addon_total,
    'currency', 'INR',
    'delivery_days', least(v_service.delivery_days, coalesce(v_override, v_service.delivery_days)),
    'revisions', least(v_service.revisions_included + v_extra_rev, private.setting_numeric('max_revisions', 5)::int),
    'requires_shipping', v_service.requires_shipping
  ) || (private.order_pricing(v_service.creator_id, private.my_brand_id(), v_price) - 'tax_snapshot');
end;
$$;

create or replace function public.create_order(p_service_id uuid, p_addon_ids uuid[] default '{}'::uuid[], p_brief_id uuid default null::uuid, p_requirements text default null::text)
returns public.orders
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_brand public.brands;
  v_service public.creator_services;
  v_creator public.creators;
  v_brief public.briefs;
  v_quote jsonb;
  v_pricing jsonb;
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
  v_pricing := private.order_pricing(v_creator.id, v_brand.id, (v_quote ->> 'price')::numeric);

  insert into public.orders (
    brand_id, creator_id, service_id, brief_id, status,
    service_title, service_description, content_type, delivery_days,
    revisions_allowed, requires_shipping,
    subtotal, addons_total, total_amount, currency,
    platform_fee_percent, platform_fee_amount, creator_earning_amount,
    brand_fee_percent, brand_fee_amount,
    billing_version, creator_gst_percent, creator_gst_amount, brand_fee_gst_percent, brand_fee_gst_amount, tax_snapshot,
    brief_snapshot, requirements
  ) values (
    v_brand.id, v_creator.id, v_service.id, p_brief_id, 'payment_pending',
    v_service.title, v_service.description, v_service.content_type, (v_quote ->> 'delivery_days')::int,
    (v_quote ->> 'revisions')::int, v_service.requires_shipping,
    (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'addons_total')::numeric, (v_pricing ->> 'total')::numeric, 'INR',
    (v_pricing ->> 'platform_fee_percent')::numeric, (v_pricing ->> 'platform_fee')::numeric, (v_pricing ->> 'creator_earning')::numeric,
    (v_pricing ->> 'brand_fee_percent')::numeric, (v_pricing ->> 'brand_fee')::numeric,
    (v_pricing ->> 'billing_version')::smallint, (v_pricing ->> 'creator_gst_percent')::numeric, (v_pricing ->> 'creator_gst')::numeric,
    (v_pricing ->> 'brand_fee_gst_percent')::numeric, (v_pricing ->> 'brand_fee_gst')::numeric, v_pricing -> 'tax_snapshot',
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
    jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total_amount, 'billing_version', v_order.billing_version,
                       'creator_id', v_creator.id, 'service_id', v_service.id, 'addons', to_jsonb(v_ids)),
    auth.uid(), 'brand');
  return v_order;
end;
$$;

-- ======================================================= tax deposits ===
create table if not exists public.tax_deposits (
  id uuid primary key default gen_random_uuid(),
  tax_type text not null check (tax_type in ('gst_output', 'tds_194o', 'tcs_gst_52')),
  period date not null check (extract(day from period) = 1),
  amount numeric(14, 2) not null check (amount > 0),
  reference text not null check (char_length(btrim(reference)) between 2 and 120),
  deposited_on date not null,
  return_type text check (char_length(return_type) <= 40),
  filing_reference text check (char_length(filing_reference) <= 120),
  filed_on date,
  note text check (char_length(note) <= 1000),
  is_test boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.tax_deposits is 'Money HOC paid to the government (challan / CIN) and the return it was filed in.';

-- ======================================================= withholdings ===
create table if not exists public.tax_withholdings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  creator_id uuid not null references public.creators (id) on delete restrict,
  tax_type text not null check (tax_type in ('tds_194o', 'tcs_gst_52')),
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  rate numeric(7, 4) not null check (rate between 0 and 100),
  amount numeric(12, 2) not null check (amount >= 0),
  rate_id uuid references public.tax_rates (id) on delete restrict,
  exemption text check (char_length(exemption) <= 60),
  pan text,
  gstin text,
  supplier_state text,
  place_of_supply text,
  financial_year text not null,
  period date not null,
  status text not null default 'deducted' check (status in ('deducted', 'reversed')),
  reversed_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  -- One deduction of each tax per order, however many times completion runs.
  unique (order_id, tax_type)
);
create index if not exists tax_withholdings_creator_fy on public.tax_withholdings (creator_id, tax_type, financial_year);
create index if not exists tax_withholdings_period on public.tax_withholdings (tax_type, period);

-- ============================================================ invoices ===
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('creator_service', 'brand_commission', 'creator_commission', 'settlement', 'credit_note')),
  document_title text not null check (char_length(document_title) <= 60),
  number text not null unique check (char_length(number) <= 20),
  series text not null,
  financial_year text not null,
  issued_at timestamptz not null default now(),
  issuer text not null check (issuer in ('hoc', 'creator')),
  order_id uuid references public.orders (id) on delete restrict,
  payout_request_id uuid references public.payout_requests (id) on delete restrict,
  original_invoice_id uuid references public.invoices (id) on delete restrict,
  refund_id uuid references public.payment_refunds (id) on delete restrict,
  brand_id uuid references public.brands (id) on delete restrict,
  creator_id uuid references public.creators (id) on delete restrict,
  supplier jsonb not null,
  recipient jsonb not null,
  lines jsonb not null default '[]'::jsonb,
  place_of_supply text,
  sac text,
  gst_rate numeric(5, 2) not null default 0,
  taxable_amount numeric(12, 2) not null default 0 check (taxable_amount >= 0),
  cgst_amount numeric(12, 2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(12, 2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(12, 2) not null default 0 check (igst_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  tds_amount numeric(12, 2) not null default 0 check (tds_amount >= 0),
  tcs_amount numeric(12, 2) not null default 0 check (tcs_amount >= 0),
  net_amount numeric(12, 2),
  status text not null check (status in ('paid', 'unpaid', 'partially_paid', 'cancelled', 'credited', 'issued')),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  credited_amount numeric(12, 2) not null default 0 check (credited_amount >= 0),
  paid_at timestamptz,
  visible_to_brand boolean not null default false,
  visible_to_creator boolean not null default false,
  is_test boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_gst_adds_up check (kind = 'settlement' or total_amount = taxable_amount + cgst_amount + sgst_amount + igst_amount),
  constraint invoices_paid_within_total check (amount_paid <= total_amount)
);
comment on table public.invoices is 'Every billing document, frozen when issued: parties, lines and amounts are snapshots, never recomputed.';

-- No document is issued twice for the same event.
create unique index if not exists invoices_one_per_order on public.invoices (order_id, kind)
  where kind in ('creator_service', 'brand_commission', 'creator_commission');
create unique index if not exists invoices_one_settlement_per_payout on public.invoices (payout_request_id) where kind = 'settlement';
create unique index if not exists invoices_one_credit_per_refund on public.invoices (original_invoice_id, refund_id)
  where kind = 'credit_note' and refund_id is not null;
create unique index if not exists invoices_one_cancellation on public.invoices (original_invoice_id)
  where kind = 'credit_note' and refund_id is null;
create index if not exists invoices_brand on public.invoices (brand_id, issued_at desc) where visible_to_brand;
create index if not exists invoices_creator on public.invoices (creator_id, issued_at desc) where visible_to_creator;
create index if not exists invoices_kind_issued on public.invoices (kind, issued_at desc);

drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices for each row execute function private.set_updated_at();

create table if not exists public.invoice_counters (
  series text not null,
  financial_year text not null,
  last_number int not null default 0,
  primary key (series, financial_year)
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  payer_id uuid references public.profiles (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  provider text not null default 'razorpay' check (provider in ('razorpay', 'manual')),
  provider_order_id text unique,
  provider_payment_id text unique,
  reference text check (char_length(reference) <= 120),
  status text not null default 'created' check (status in ('created', 'captured', 'failed')),
  method text,
  captured_at timestamptz,
  recorded_by uuid references public.profiles (id) on delete set null,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice on public.invoice_payments (invoice_id);
drop trigger if exists set_updated_at on public.invoice_payments;
create trigger set_updated_at before update on public.invoice_payments for each row execute function private.set_updated_at();

-- ============================================================== ledger ===
-- Double entry: every posting's amounts sum to zero. Positive = debit,
-- negative = credit.
--   gateway_clearing               money in HOC's bank / Razorpay
--   creator_payable                creators' money HOC holds (fee + their GST)
--   brand_commission_revenue       HOC income from brands
--   creator_commission_revenue     HOC income from creators
--   gst_output_payable             GST charged on HOC's own commissions
--   tds_payable / tcs_payable      withheld for the government
--   creator_commission_receivable  commission invoices not yet paid
create table if not exists public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  posting_key text not null,
  event text not null,
  account text not null check (account in ('gateway_clearing', 'creator_payable', 'brand_commission_revenue',
                                           'creator_commission_revenue', 'gst_output_payable', 'tds_payable',
                                           'tcs_payable', 'creator_commission_receivable')),
  amount numeric(14, 2) not null check (amount <> 0),
  occurred_at timestamptz not null default now(),
  order_id uuid,
  invoice_id uuid,
  payout_request_id uuid,
  deposit_id uuid,
  creator_id uuid,
  brand_id uuid,
  is_test boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  unique (posting_key, account)
);
create index if not exists ledger_entries_account on public.ledger_entries (account, occurred_at);
create index if not exists ledger_entries_order on public.ledger_entries (order_id);
create index if not exists ledger_entries_txn on public.ledger_entries (txn_id);
comment on table public.ledger_entries is 'Double-entry ledger for billing v2 money. Taxes are liabilities, never revenue.';

-- ================================================================= RLS ===
alter table public.tax_deposits enable row level security;
alter table public.tax_withholdings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists "Admins read tax deposits" on public.tax_deposits;
create policy "Admins read tax deposits" on public.tax_deposits for select to authenticated using ((select private.is_admin()));
drop policy if exists "Creators read own withholdings" on public.tax_withholdings;
create policy "Creators read own withholdings" on public.tax_withholdings
  for select to authenticated using (private.owns_creator(creator_id) or (select private.is_admin()));
drop policy if exists "Parties read their invoices" on public.invoices;
create policy "Parties read their invoices" on public.invoices for select to authenticated using (
  (select private.is_admin())
  or (visible_to_brand and brand_id = (select private.my_brand_id()))
  or (visible_to_creator and creator_id = (select private.my_creator_id())));
drop policy if exists "Payers read invoice payments" on public.invoice_payments;
create policy "Payers read invoice payments" on public.invoice_payments
  for select to authenticated using (payer_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "Admins read ledger" on public.ledger_entries;
create policy "Admins read ledger" on public.ledger_entries for select to authenticated using ((select private.is_admin()));

-- New tables arrive with full default privileges for anon and authenticated.
-- Every write goes through a function, so clients get SELECT (and RLS) only.
revoke all on public.billing_entity, public.tax_rates, public.creator_tax_profiles, public.brand_billing_profiles,
  public.tax_deposits, public.tax_withholdings, public.invoices, public.invoice_counters, public.invoice_payments,
  public.ledger_entries from anon, authenticated;
grant select on public.billing_entity, public.tax_rates, public.creator_tax_profiles, public.brand_billing_profiles,
  public.tax_deposits, public.tax_withholdings, public.invoices, public.ledger_entries to authenticated;
-- Not raw_response: it's Razorpay's full payload.
grant select (provider_payment_id, provider_order_id, id, invoice_id, payer_id, amount, currency, provider, reference, status,
              method, captured_at, created_at, updated_at) on public.invoice_payments to authenticated;
grant all on public.billing_entity, public.tax_rates, public.creator_tax_profiles, public.brand_billing_profiles,
  public.tax_deposits, public.tax_withholdings, public.invoices, public.invoice_counters, public.invoice_payments,
  public.ledger_entries to service_role;

-- ===================================================== posting helpers ===
create or replace function private.post_ledger(p_event text, p_key text, p_lines jsonb, p_refs jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_txn uuid := gen_random_uuid();
  v_sum numeric;
begin
  if exists (select 1 from public.ledger_entries where posting_key = p_key) then
    return null; -- already posted
  end if;
  select coalesce(sum((l ->> 'amount')::numeric), 0) into v_sum from jsonb_array_elements(p_lines) l;
  if v_sum <> 0 then
    raise exception 'Ledger posting % does not balance (off by %).', p_key, v_sum using errcode = 'P0001', hint = 'LEDGER_UNBALANCED';
  end if;
  insert into public.ledger_entries (txn_id, posting_key, event, account, amount, order_id, invoice_id, payout_request_id,
                                     deposit_id, creator_id, brand_id, is_test, memo)
  select v_txn, p_key, p_event, l ->> 'account', sum((l ->> 'amount')::numeric),
         (p_refs ->> 'order_id')::uuid, (p_refs ->> 'invoice_id')::uuid, (p_refs ->> 'payout_request_id')::uuid,
         (p_refs ->> 'deposit_id')::uuid, (p_refs ->> 'creator_id')::uuid, (p_refs ->> 'brand_id')::uuid,
         coalesce((p_refs ->> 'is_test')::boolean, false), p_refs ->> 'memo'
  from jsonb_array_elements(p_lines) l
  group by l ->> 'account'
  having sum((l ->> 'amount')::numeric) <> 0;
  return v_txn;
end;
$$;

-- Gapless within a series and financial year: the counter row is locked
-- until the transaction that issues the document commits.
create or replace function private.next_invoice_number(p_series text, p_fy text, p_width int default 6)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_n int;
begin
  insert into public.invoice_counters as c (series, financial_year, last_number) values (p_series, p_fy, 1)
  on conflict (series, financial_year) do update set last_number = c.last_number + 1
  returning c.last_number into v_n;
  return p_series || '/' || replace(substr(p_fy, 3), '-', '') || '/' || lpad(v_n::text, p_width, '0');
end;
$$;

-- Each creator invoices brands from their own series: C + 5 characters of
-- their id, e.g. C3F9A2/2627/0001. Credit notes they issue: R3F9A2/….
create or replace function private.creator_invoice_code(p_creator_id uuid)
returns text
language sql
immutable
set search_path to ''
as $$
  select upper(substr(replace(p_creator_id::text, '-', ''), 1, 5));
$$;

revoke execute on function private.post_ledger(text, text, jsonb, jsonb), private.next_invoice_number(text, text, int),
  private.creator_invoice_code(uuid) from public;

-- Lines for the creator's own invoice, straight from the order's items.
create or replace function private.order_invoice_lines(p_order_id uuid, p_sac text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'description', i.name, 'sac', p_sac, 'quantity', i.quantity, 'rate', i.unit_price, 'amount', i.total_price)
         order by (i.item_type = 'service') desc, i.created_at), '[]'::jsonb)
  from public.order_items i where i.order_id = p_order_id;
$$;
revoke execute on function private.order_invoice_lines(uuid, text) from public;

-- ======================================================== on payment ===
-- The creator's invoice to the brand and HOC's commission invoice, both
-- paid in full at checkout, and the money split into its accounts.
create or replace function private.issue_order_invoices(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_o public.orders;
  v_fy text := private.financial_year(now());
  v_test boolean := coalesce(private.is_test_order(p_order_id), false);
  v_t text;
  v_creator jsonb;
  v_brand jsonb;
  v_hoc jsonb;
  v_pos text;
  v_price numeric(12, 2);
  v_split jsonb;
  v_number text;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found or v_o.billing_version <> 2 then
    return;
  end if;
  if exists (select 1 from public.invoices where order_id = p_order_id and kind = 'creator_service') then
    return;
  end if;

  v_t := case when v_test then 'T' else '' end; -- test documents never use up real numbers
  v_creator := v_o.tax_snapshot -> 'creator';
  v_brand := coalesce(v_o.tax_snapshot -> 'brand', private.brand_party(v_o.brand_id));
  v_hoc := v_o.tax_snapshot -> 'hoc';
  v_pos := v_o.tax_snapshot ->> 'place_of_supply';
  v_price := v_o.subtotal + v_o.addons_total;

  -- 1. Creator → Brand
  v_split := private.split_gst(v_o.creator_gst_amount, v_creator ->> 'state_code', v_pos);
  v_number := private.next_invoice_number(v_t || 'C' || private.creator_invoice_code(v_o.creator_id), v_fy, 4);
  insert into public.invoices (kind, document_title, number, series, financial_year, issuer, order_id, brand_id, creator_id,
                               supplier, recipient, lines, place_of_supply, sac, gst_rate, taxable_amount,
                               cgst_amount, sgst_amount, igst_amount, total_amount, status, amount_paid, paid_at,
                               visible_to_brand, visible_to_creator, is_test, meta)
  values ('creator_service', case when v_o.creator_gst_amount > 0 then 'Tax Invoice' else 'Invoice' end,
          v_number, split_part(v_number, '/', 1), v_fy, 'creator', v_o.id, v_o.brand_id, v_o.creator_id,
          v_creator, v_brand, private.order_invoice_lines(v_o.id, v_hoc ->> 'creator_service_sac'), v_pos,
          v_hoc ->> 'creator_service_sac', v_o.creator_gst_percent, v_price,
          (v_split ->> 'cgst')::numeric, (v_split ->> 'sgst')::numeric, (v_split ->> 'igst')::numeric,
          v_price + v_o.creator_gst_amount, 'paid', v_price + v_o.creator_gst_amount, now(), true, true, v_test,
          jsonb_build_object('order_number', v_o.order_number, 'service_title', v_o.service_title,
                             'issued_on_behalf_by', v_hoc ->> 'name', 'reverse_charge', false,
                             'invoice_consent_at', v_creator ->> 'invoice_consent_at'));

  -- 2. HOC → Brand: the brand commission
  if v_o.brand_fee_amount > 0 then
    v_split := private.split_gst(v_o.brand_fee_gst_amount, v_hoc ->> 'state_code', v_pos);
    v_number := private.next_invoice_number(v_t || 'BC', v_fy);
    insert into public.invoices (kind, document_title, number, series, financial_year, issuer, order_id, brand_id, creator_id,
                                 supplier, recipient, lines, place_of_supply, sac, gst_rate, taxable_amount,
                                 cgst_amount, sgst_amount, igst_amount, total_amount, status, amount_paid, paid_at,
                                 visible_to_brand, visible_to_creator, is_test, meta)
    values ('brand_commission', 'Tax Invoice', v_number, v_t || 'BC', v_fy, 'hoc', v_o.id, v_o.brand_id, v_o.creator_id,
            v_hoc, v_brand,
            jsonb_build_array(jsonb_build_object(
              'description', format('Marketplace commission for order %s (%s%% of %s)', v_o.order_number,
                                    trim_scale(v_o.brand_fee_percent), private.format_inr(v_price)),
              'sac', v_hoc ->> 'commission_sac', 'quantity', 1, 'rate', v_o.brand_fee_amount, 'amount', v_o.brand_fee_amount)),
            v_pos, v_hoc ->> 'commission_sac', v_o.brand_fee_gst_percent, v_o.brand_fee_amount,
            (v_split ->> 'cgst')::numeric, (v_split ->> 'sgst')::numeric, (v_split ->> 'igst')::numeric,
            v_o.brand_fee_amount + v_o.brand_fee_gst_amount, 'paid', v_o.brand_fee_amount + v_o.brand_fee_gst_amount, now(),
            true, false, v_test,
            jsonb_build_object('order_number', v_o.order_number, 'service_title', v_o.service_title,
                               'creator_name', v_creator ->> 'display_name'));
  end if;

  -- 3. The brand's money, split into what is the creator's, HOC's and the government's.
  perform private.post_ledger('brand_payment', 'brand_payment:' || v_o.id, jsonb_build_array(
    jsonb_build_object('account', 'gateway_clearing', 'amount', v_o.total_amount),
    jsonb_build_object('account', 'creator_payable', 'amount', -(v_price + v_o.creator_gst_amount)),
    jsonb_build_object('account', 'brand_commission_revenue', 'amount', -v_o.brand_fee_amount),
    jsonb_build_object('account', 'gst_output_payable', 'amount', -v_o.brand_fee_gst_amount)),
    jsonb_build_object('order_id', v_o.id, 'brand_id', v_o.brand_id, 'creator_id', v_o.creator_id, 'is_test', v_test,
                       'memo', 'Brand payment for ' || v_o.order_number));

  perform private.audit('order_invoices_issued', 'order', v_o.id::text,
    jsonb_build_object('order_number', v_o.order_number, 'total', v_o.total_amount), null, 'system');
end;
$$;

-- ======================================================= on completion ===
-- TDS under 194-O and GST TCS under section 52, once per order.
create or replace function private.apply_withholdings(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_o public.orders;
  v_c jsonb;
  v_today date := private.ist_date(now());
  v_fy text := private.financial_year(now());
  v_period date := date_trunc('month', private.ist_date(now()))::date;
  v_test boolean := coalesce(private.is_test_order(p_order_id), false);
  v_price numeric(12, 2);
  v_rule public.tax_rates;
  v_limit public.tax_rates;
  v_rate numeric;
  v_exempt text;
  v_ytd numeric;
  v_pos text;
begin
  select * into v_o from public.orders where id = p_order_id;
  v_c := private.creator_party(v_o.creator_id, true); -- today's PAN, in case it was added after ordering
  v_price := v_o.subtotal + v_o.addons_total;
  v_pos := v_o.tax_snapshot ->> 'place_of_supply';

  if not exists (select 1 from public.tax_withholdings where order_id = p_order_id and tax_type = 'tds_194o') then
    select * into v_rule from private.tax_rate('tds_194o', v_today);
    v_rate := coalesce(v_rule.rate, 0);
    v_exempt := null;
    if nullif(v_c ->> 'pan', '') is null then
      select * into v_limit from private.tax_rate('tds_194o_no_pan', v_today);
      if v_limit.id is not null then
        v_rule := v_limit;
        v_rate := v_limit.rate;
      end if;
      v_exempt := null;
    elsif (v_c ->> 'entity_type') in ('individual', 'huf') then
      select * into v_limit from private.tax_rate('tds_194o_exemption_limit', v_today);
      select coalesce(sum(w.base_amount), 0) into v_ytd
      from public.tax_withholdings w
      where w.creator_id = v_o.creator_id and w.tax_type = 'tds_194o' and w.financial_year = v_fy and w.status = 'deducted';
      if v_limit.threshold is not null and v_ytd + v_price <= v_limit.threshold then
        v_rate := 0;
        v_exempt := 'individual_huf_within_limit';
      end if;
    end if;
    insert into public.tax_withholdings (order_id, creator_id, tax_type, base_amount, rate, amount, rate_id, exemption,
                                         pan, gstin, supplier_state, place_of_supply, financial_year, period, is_test)
    values (v_o.id, v_o.creator_id, 'tds_194o', v_price, v_rate, round(v_price * v_rate / 100, 2), v_rule.id, v_exempt,
            v_c ->> 'pan', v_c ->> 'gstin', v_c ->> 'state_code', v_pos, v_fy, v_period, v_test)
    on conflict (order_id, tax_type) do nothing;
  end if;

  -- Only a GST-registered creator's supplies carry TCS, judged as the order
  -- was priced (that is when GST went on the brand's bill).
  if coalesce((v_o.tax_snapshot -> 'creator' ->> 'gst_registered')::boolean, false)
     and not exists (select 1 from public.tax_withholdings where order_id = p_order_id and tax_type = 'tcs_gst_52') then
    select * into v_rule from private.tax_rate('tcs_gst_52', v_today);
    insert into public.tax_withholdings (order_id, creator_id, tax_type, base_amount, rate, amount, rate_id,
                                         pan, gstin, supplier_state, place_of_supply, financial_year, period, is_test)
    values (v_o.id, v_o.creator_id, 'tcs_gst_52', v_price, coalesce(v_rule.rate, 0),
            round(v_price * coalesce(v_rule.rate, 0) / 100, 2), v_rule.id,
            v_c ->> 'pan', v_o.tax_snapshot -> 'creator' ->> 'gstin', v_o.tax_snapshot -> 'creator' ->> 'state_code',
            v_pos, v_fy, v_period, v_test)
    on conflict (order_id, tax_type) do nothing;
  end if;

  return (
    select jsonb_build_object(
      'tds', coalesce(sum(w.amount) filter (where w.tax_type = 'tds_194o'), 0),
      'tcs', coalesce(sum(w.amount) filter (where w.tax_type = 'tcs_gst_52'), 0))
    from public.tax_withholdings w where w.order_id = p_order_id and w.status = 'deducted');
end;
$$;

-- HOC → Creator: the commission, on its own invoice, payable by the creator.
create or replace function private.issue_creator_commission_invoice(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_o public.orders;
  v_fy text := private.financial_year(now());
  v_test boolean := coalesce(private.is_test_order(p_order_id), false);
  v_t text;
  v_hoc jsonb := private.hoc_party();
  v_c jsonb;
  v_rate numeric := coalesce((private.tax_rate('gst_hoc_services', private.ist_date(now()))).rate, 0);
  v_gst numeric(12, 2);
  v_pos text;
  v_split jsonb;
  v_number text;
  v_id uuid;
  v_profile uuid;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found or v_o.billing_version <> 2 or v_o.platform_fee_amount <= 0 then
    return;
  end if;
  if exists (select 1 from public.invoices where order_id = p_order_id and kind = 'creator_commission') then
    return;
  end if;

  v_t := case when v_test then 'T' else '' end;
  v_c := private.creator_party(v_o.creator_id, true);
  v_gst := round(v_o.platform_fee_amount * v_rate / 100, 2);
  v_pos := coalesce(v_c ->> 'state_code', v_hoc ->> 'state_code');
  v_split := private.split_gst(v_gst, v_hoc ->> 'state_code', v_pos);
  v_number := private.next_invoice_number(v_t || 'CC', v_fy);

  insert into public.invoices (kind, document_title, number, series, financial_year, issuer, order_id, brand_id, creator_id,
                               supplier, recipient, lines, place_of_supply, sac, gst_rate, taxable_amount,
                               cgst_amount, sgst_amount, igst_amount, total_amount, status,
                               visible_to_brand, visible_to_creator, is_test, meta)
  values ('creator_commission', 'Tax Invoice', v_number, v_t || 'CC', v_fy, 'hoc', v_o.id, v_o.brand_id, v_o.creator_id,
          v_hoc, v_c,
          jsonb_build_array(jsonb_build_object(
            'description', format('Marketplace commission for order %s (%s%% of %s)', v_o.order_number,
                                  trim_scale(v_o.platform_fee_percent), private.format_inr(v_o.subtotal + v_o.addons_total)),
            'sac', v_hoc ->> 'commission_sac', 'quantity', 1, 'rate', v_o.platform_fee_amount, 'amount', v_o.platform_fee_amount)),
          v_pos, v_hoc ->> 'commission_sac', v_rate, v_o.platform_fee_amount,
          (v_split ->> 'cgst')::numeric, (v_split ->> 'sgst')::numeric, (v_split ->> 'igst')::numeric,
          v_o.platform_fee_amount + v_gst, 'unpaid', false, true, v_test,
          jsonb_build_object('order_number', v_o.order_number, 'service_title', v_o.service_title))
  returning id into v_id;

  perform private.post_ledger('creator_commission_invoiced', 'creator_commission:' || v_o.id, jsonb_build_array(
    jsonb_build_object('account', 'creator_commission_receivable', 'amount', v_o.platform_fee_amount + v_gst),
    jsonb_build_object('account', 'creator_commission_revenue', 'amount', -v_o.platform_fee_amount),
    jsonb_build_object('account', 'gst_output_payable', 'amount', -v_gst)),
    jsonb_build_object('order_id', v_o.id, 'invoice_id', v_id, 'creator_id', v_o.creator_id, 'brand_id', v_o.brand_id,
                       'is_test', v_test, 'memo', 'Creator commission ' || v_number));

  select c.profile_id into v_profile from public.creators c where c.id = v_o.creator_id;
  perform private.notify(v_profile, 'invoice_issued', 'Commission invoice ready',
    format('Invoice %s for %s (House of Collabs commission on order %s) is ready. Pay it from Billing.',
           v_number, private.format_inr(v_o.platform_fee_amount + v_gst), v_o.order_number),
    'invoice', v_id, '/creator/billing');
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
  v_hold int := greatest(private.setting_numeric('earning_hold_days', 0)::int, 0);
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
      now() + make_interval(days => v_hold)
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
    now() + make_interval(days => v_hold)
  )
  on conflict (order_id) do nothing;
end;
$$;

-- ========================================================== on payout ===
create or replace function private.issue_settlement_statement(p_payout_request_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_req public.payout_requests;
  v_fy text := private.financial_year(now());
  v_test boolean;
  v_lines jsonb;
  v_gross numeric(12, 2);
  v_fee numeric(12, 2);
  v_tds numeric(12, 2);
  v_tcs numeric(12, 2);
  v_v2_net numeric(12, 2);
  v_number text;
  v_id uuid;
  v_ref text;
begin
  select * into v_req from public.payout_requests where id = p_payout_request_id;
  if not found or v_req.status <> 'paid' then
    return;
  end if;
  if exists (select 1 from public.invoices where payout_request_id = p_payout_request_id and kind = 'settlement') then
    return;
  end if;
  -- Test money (a test account on either side) never uses up a real number.
  v_test := coalesce(private.is_test_creator(v_req.creator_id), false)
    or not exists (select 1 from public.creator_earnings e
                   where e.payout_request_id = p_payout_request_id and not private.is_test_order(e.order_id));

  select coalesce(jsonb_agg(jsonb_build_object(
           'order_number', o.order_number, 'description', o.service_title, 'completed_at', o.completed_at,
           'fee', o.subtotal + o.addons_total, 'creator_gst', o.creator_gst_amount,
           'commission_deducted', e.platform_fee, 'tds', e.tds_amount, 'tcs', e.tcs_amount, 'amount', e.net_amount,
           'billing_version', o.billing_version) order by o.completed_at), '[]'::jsonb),
         coalesce(sum(e.gross_amount), 0), coalesce(sum(e.platform_fee), 0), coalesce(sum(e.tds_amount), 0),
         coalesce(sum(e.tcs_amount), 0), coalesce(sum(e.net_amount) filter (where o.billing_version = 2), 0)
  into v_lines, v_gross, v_fee, v_tds, v_tcs, v_v2_net
  from public.creator_earnings e
  join public.orders o on o.id = e.order_id
  where e.payout_request_id = p_payout_request_id;

  select t.provider_reference into v_ref from public.payout_transactions t
  where t.payout_request_id = p_payout_request_id and t.status = 'success' order by t.created_at desc limit 1;

  v_number := private.next_invoice_number(case when v_test then 'TST' else 'ST' end, v_fy);
  insert into public.invoices (kind, document_title, number, series, financial_year, issuer, payout_request_id, creator_id,
                               supplier, recipient, lines, taxable_amount, total_amount, tds_amount, tcs_amount, net_amount,
                               status, amount_paid, paid_at, visible_to_creator, is_test, meta)
  values ('settlement', 'Settlement Statement', v_number, case when v_test then 'TST' else 'ST' end, v_fy, 'hoc',
          v_req.id, v_req.creator_id, private.hoc_party(), private.creator_party(v_req.creator_id, true), v_lines,
          v_gross, v_gross, v_tds, v_tcs, v_req.amount, 'paid', v_req.amount, coalesce(v_req.processed_at, now()), true, v_test,
          jsonb_build_object('payout_reference', v_ref, 'commission_deducted', v_fee,
                             'payout_method', v_req.payout_method_snapshot - 'account_holder_name'))
  returning id into v_id;

  -- Only billing v2 money sits in the ledger.
  perform private.post_ledger('payout', 'payout:' || v_req.id, jsonb_build_array(
    jsonb_build_object('account', 'creator_payable', 'amount', v_v2_net),
    jsonb_build_object('account', 'gateway_clearing', 'amount', -v_v2_net)),
    jsonb_build_object('payout_request_id', v_req.id, 'invoice_id', v_id, 'creator_id', v_req.creator_id, 'is_test', v_test,
                       'memo', 'Payout ' || coalesce(v_ref, '')));
end;
$$;

create or replace function private.billing_after_payout_paid()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform private.issue_settlement_statement(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists billing_after_payout_paid on public.payout_requests;
create trigger billing_after_payout_paid after update of status on public.payout_requests
  for each row execute function private.billing_after_payout_paid();


-- ============================================== payouts leave out test money ===
create or replace function public.create_payout_request(p_profile_id uuid, p_notes text default null::text)
returns public.payout_requests
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_creator public.creators;
  v_method public.payout_methods;
  v_available numeric(12, 2);
  v_min numeric := private.setting_numeric('minimum_payout_amount', 500);
  v_request public.payout_requests;
  v_test_creator boolean;
begin
  select * into v_creator from public.creators where profile_id = p_profile_id for update;
  if not found then
    raise exception 'Creator profile not found.' using errcode = 'P0002', hint = 'CREATOR_REQUIRED';
  end if;
  v_test_creator := coalesce(private.is_test_creator(v_creator.id), false);
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

  -- Earnings from a test account's order are test money: they stay out of a
  -- real creator's payout.
  select coalesce(sum(net_amount), 0) into v_available
  from public.creator_earnings
  where creator_id = v_creator.id and status = 'available' and payout_request_id is null and available_at <= now()
    and (v_test_creator or not private.is_test_order(order_id));

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
  where creator_id = v_creator.id and status = 'available' and payout_request_id is null and available_at <= now()
    and (v_test_creator or not private.is_test_order(order_id));

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

-- ===================================================== payment hook ===
create or replace function private.billing_after_order_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.billing_version = 2 and new.status = 'order_placed' and old.status is distinct from 'order_placed' then
    perform private.issue_order_invoices(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists billing_after_order_status on public.orders;
create trigger billing_after_order_status after update of status on public.orders
  for each row execute function private.billing_after_order_status();

-- =========================================================== credit notes ===
create or replace function private.issue_credit_note(p_invoice_id uuid, p_refund_id uuid, p_taxable numeric, p_gst numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inv public.invoices;
  v_split jsonb;
  v_series text;
  v_number text;
  v_id uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found or p_taxable + p_gst <= 0 then
    return null;
  end if;
  v_series := case
    when v_inv.issuer = 'creator' then (case when v_inv.is_test then 'T' else '' end) || 'R' || private.creator_invoice_code(v_inv.creator_id)
    else (case when v_inv.is_test then 'T' else '' end) || 'CN' end;
  v_number := private.next_invoice_number(v_series, private.financial_year(now()), case when v_inv.issuer = 'creator' then 4 else 6 end);
  v_split := private.split_gst(p_gst, v_inv.supplier ->> 'state_code', v_inv.place_of_supply);

  insert into public.invoices (kind, document_title, number, series, financial_year, issuer, order_id, brand_id, creator_id,
                               original_invoice_id, refund_id, supplier, recipient, lines, place_of_supply, sac, gst_rate,
                               taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, status,
                               visible_to_brand, visible_to_creator, is_test, meta)
  values ('credit_note', 'Credit Note', v_number, v_series, private.financial_year(now()), v_inv.issuer, v_inv.order_id,
          v_inv.brand_id, v_inv.creator_id, v_inv.id, p_refund_id, v_inv.supplier, v_inv.recipient,
          jsonb_build_array(jsonb_build_object('description', format('Credit against %s: %s', v_inv.number, p_reason),
                                               'sac', v_inv.sac, 'quantity', 1, 'rate', p_taxable, 'amount', p_taxable)),
          v_inv.place_of_supply, v_inv.sac, v_inv.gst_rate, p_taxable,
          (v_split ->> 'cgst')::numeric, (v_split ->> 'sgst')::numeric, (v_split ->> 'igst')::numeric, p_taxable + p_gst, 'issued',
          v_inv.visible_to_brand, v_inv.visible_to_creator, v_inv.is_test,
          jsonb_build_object('original_number', v_inv.number, 'reason', p_reason, 'order_number', v_inv.meta ->> 'order_number'))
  returning id into v_id;

  update public.invoices
  set credited_amount = least(credited_amount + p_taxable + p_gst, total_amount),
      status = case when credited_amount + p_taxable + p_gst >= total_amount then 'credited' else status end
  where id = v_inv.id;
  return v_id;
end;
$$;

-- A processed refund on a v2 order: credit notes for the brand's two
-- invoices in proportion, and the money taken back out of each account. A
-- full refund after completion also reverses TDS/TCS and the creator's
-- commission invoice.
create or replace function private.billing_apply_refund(p_refund_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_r public.payment_refunds;
  v_o public.orders;
  v_test boolean;
  v_ratio numeric;
  v_full boolean;
  v_creator_share numeric(12, 2);
  v_fee_share numeric(12, 2);
  v_fee_gst_share numeric(12, 2);
  v_inv public.invoices;
  v_taxable numeric(12, 2);
  v_tds numeric(12, 2);
  v_tcs numeric(12, 2);
  v_reason text;
begin
  select * into v_r from public.payment_refunds where id = p_refund_id;
  select * into v_o from public.orders where id = v_r.order_id;
  if not found or v_o.billing_version <> 2 then
    return;
  end if;
  if exists (select 1 from public.ledger_entries where posting_key = 'refund:' || v_r.id) then
    return;
  end if;
  -- A payment that arrived after the order was cancelled never reached the
  -- books (no invoices, no posting), so its refund has nothing to reverse.
  if not exists (select 1 from public.ledger_entries where posting_key = 'brand_payment:' || v_o.id) then
    return;
  end if;
  v_test := coalesce(private.is_test_order(v_o.id), false);
  v_ratio := least(v_r.amount / v_o.total_amount, 1);
  v_full := (select coalesce(sum(x.amount), 0) from public.payment_refunds x where x.order_id = v_o.id and x.status = 'processed') >= v_o.total_amount;
  v_reason := coalesce(nullif(btrim(v_r.reason), ''), 'Refund');

  v_creator_share := round((v_o.subtotal + v_o.addons_total + v_o.creator_gst_amount) * v_ratio, 2);
  v_fee_share := round(v_o.brand_fee_amount * v_ratio, 2);
  v_fee_gst_share := v_r.amount - v_creator_share - v_fee_share;
  if v_fee_gst_share < 0 then
    v_creator_share := v_creator_share + v_fee_gst_share;
    v_fee_gst_share := 0;
  end if;

  select * into v_inv from public.invoices where order_id = v_o.id and kind = 'creator_service';
  if found then
    v_taxable := round(v_inv.taxable_amount * v_ratio, 2);
    perform private.issue_credit_note(v_inv.id, v_r.id, v_taxable, greatest(v_creator_share - v_taxable, 0), v_reason);
  end if;
  select * into v_inv from public.invoices where order_id = v_o.id and kind = 'brand_commission';
  if found then
    perform private.issue_credit_note(v_inv.id, v_r.id, v_fee_share, v_fee_gst_share, v_reason);
  end if;

  perform private.post_ledger('refund', 'refund:' || v_r.id, jsonb_build_array(
    jsonb_build_object('account', 'gateway_clearing', 'amount', -v_r.amount),
    jsonb_build_object('account', 'creator_payable', 'amount', v_creator_share),
    jsonb_build_object('account', 'brand_commission_revenue', 'amount', v_fee_share),
    jsonb_build_object('account', 'gst_output_payable', 'amount', v_fee_gst_share)),
    jsonb_build_object('order_id', v_o.id, 'brand_id', v_o.brand_id, 'creator_id', v_o.creator_id, 'is_test', v_test,
                       'memo', 'Refund on ' || v_o.order_number));

  if v_full then
    select coalesce(sum(amount) filter (where tax_type = 'tds_194o'), 0), coalesce(sum(amount) filter (where tax_type = 'tcs_gst_52'), 0)
    into v_tds, v_tcs
    from public.tax_withholdings where order_id = v_o.id and status = 'deducted';
    update public.tax_withholdings set status = 'reversed', reversed_at = now() where order_id = v_o.id and status = 'deducted';
    perform private.post_ledger('withholding_reversal', 'withholding_reversal:' || v_o.id, jsonb_build_array(
      jsonb_build_object('account', 'creator_payable', 'amount', -(v_tds + v_tcs)),
      jsonb_build_object('account', 'tds_payable', 'amount', v_tds),
      jsonb_build_object('account', 'tcs_payable', 'amount', v_tcs)),
      jsonb_build_object('order_id', v_o.id, 'creator_id', v_o.creator_id, 'is_test', v_test, 'memo', 'Refund reverses TDS / TCS'));

    select * into v_inv from public.invoices where order_id = v_o.id and kind = 'creator_commission';
    if found and v_inv.status not in ('cancelled', 'credited') then
      perform private.issue_credit_note(v_inv.id, null, v_inv.taxable_amount, v_inv.total_amount - v_inv.taxable_amount,
                                        'order refunded, commission cancelled');
      -- Unpaid: nothing more is owed. Paid: HOC owes it back to the creator.
      perform private.post_ledger('commission_reversal', 'commission_reversal:' || v_o.id, jsonb_build_array(
        jsonb_build_object('account', 'creator_commission_revenue', 'amount', v_inv.taxable_amount),
        jsonb_build_object('account', 'gst_output_payable', 'amount', v_inv.total_amount - v_inv.taxable_amount),
        jsonb_build_object('account', 'creator_commission_receivable', 'amount', -(v_inv.total_amount - v_inv.amount_paid)),
        jsonb_build_object('account', 'creator_payable', 'amount', -v_inv.amount_paid)),
        jsonb_build_object('order_id', v_o.id, 'invoice_id', v_inv.id, 'creator_id', v_o.creator_id, 'is_test', v_test,
                           'memo', 'Commission cancelled by refund'));
      update public.invoices set status = case when amount_paid > 0 then 'credited' else 'cancelled' end where id = v_inv.id;
      if v_inv.amount_paid > 0 then
        perform private.notify_admins('commission_refund_due', 'Commission to refund',
          format('Order %s was refunded after the creator paid commission invoice %s. Refund them %s.',
                 v_o.order_number, v_inv.number, private.format_inr(v_inv.amount_paid)),
          'invoice', v_inv.id, '/admin/billing');
      end if;
    end if;
  end if;
end;
$$;

create or replace function private.billing_after_refund()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'processed' and (tg_op = 'INSERT' or old.status is distinct from 'processed') then
    perform private.billing_apply_refund(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists billing_after_refund on public.payment_refunds;
create trigger billing_after_refund after insert or update of status on public.payment_refunds
  for each row execute function private.billing_after_refund();

-- ================================================ commission payments ===
create or replace function private.apply_invoice_payment(p_invoice_id uuid, p_payment_id uuid, p_amount numeric)
returns public.invoices
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inv public.invoices;
  v_profile uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  update public.invoices
  set amount_paid = least(amount_paid + p_amount, total_amount),
      status = case when amount_paid + p_amount >= total_amount then 'paid' else 'partially_paid' end,
      paid_at = case when amount_paid + p_amount >= total_amount then now() else paid_at end
  where id = p_invoice_id
  returning * into v_inv;

  perform private.post_ledger('commission_payment', 'invoice_payment:' || p_payment_id, jsonb_build_array(
    jsonb_build_object('account', 'gateway_clearing', 'amount', p_amount),
    jsonb_build_object('account', 'creator_commission_receivable', 'amount', -p_amount)),
    jsonb_build_object('invoice_id', v_inv.id, 'order_id', v_inv.order_id, 'creator_id', v_inv.creator_id,
                       'is_test', v_inv.is_test, 'memo', 'Payment for ' || v_inv.number));

  select c.profile_id into v_profile from public.creators c where c.id = v_inv.creator_id;
  perform private.notify(v_profile, 'invoice_paid', 'Commission payment received',
    format('We received %s for invoice %s. Thank you!', private.format_inr(p_amount), v_inv.number),
    'invoice', v_inv.id, '/creator/billing');
  perform private.audit('invoice_payment_recorded', 'invoice', v_inv.id::text,
    jsonb_build_object('number', v_inv.number, 'amount', p_amount, 'payment_id', p_payment_id), null, 'system');
  return v_inv;
end;
$$;

-- Edge Function `invoice-payment`, after checking the caller owns the invoice.
create or replace function public.register_invoice_payment(p_invoice_id uuid, p_payer_id uuid, p_provider_order_id text, p_amount numeric, p_raw jsonb default null)
returns public.invoice_payments
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row public.invoice_payments;
begin
  perform private.require_service_role();
  insert into public.invoice_payments (invoice_id, payer_id, amount, provider, provider_order_id, status, raw_response)
  values (p_invoice_id, p_payer_id, p_amount, 'razorpay', p_provider_order_id, 'created', p_raw)
  on conflict (provider_order_id) do update set raw_response = coalesce(excluded.raw_response, public.invoice_payments.raw_response)
  returning * into v_row;
  return v_row;
end;
$$;

-- Called by `invoice-payment` (verify) and the Razorpay webhook. Idempotent.
create or replace function public.confirm_invoice_payment(p_provider_order_id text, p_provider_payment_id text, p_method text default null,
                                                          p_amount_paise bigint default null, p_raw jsonb default null)
returns public.invoices
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pay public.invoice_payments;
  v_inv public.invoices;
begin
  perform private.require_service_role();
  select * into v_pay from public.invoice_payments where provider_order_id = p_provider_order_id for update;
  if not found then
    raise exception 'Invoice payment not found.' using errcode = 'P0002', hint = 'INVOICE_PAYMENT_NOT_FOUND';
  end if;
  if p_amount_paise is not null and p_amount_paise <> round(v_pay.amount * 100)::bigint then
    raise exception 'Captured amount does not match the invoice.' using errcode = 'P0001', hint = 'AMOUNT_MISMATCH';
  end if;
  if v_pay.status = 'captured' then
    select * into v_inv from public.invoices where id = v_pay.invoice_id;
    return v_inv;
  end if;
  update public.invoice_payments
  set status = 'captured', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      method = coalesce(p_method, method), captured_at = now(), raw_response = coalesce(p_raw, raw_response)
  where id = v_pay.id;
  return private.apply_invoice_payment(v_pay.invoice_id, v_pay.id, v_pay.amount);
end;
$$;

-- Admin → Billing: a creator paid by bank transfer or UPI.
create or replace function public.admin_record_invoice_payment(p_invoice_id uuid, p_amount numeric, p_reference text)
returns public.invoices
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_inv public.invoices;
  v_pay uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found or v_inv.kind <> 'creator_commission' then
    raise exception 'Commission invoice not found.' using errcode = 'P0002', hint = 'INVOICE_NOT_FOUND';
  end if;
  if v_inv.status not in ('unpaid', 'partially_paid') then
    raise exception 'This invoice is not waiting for payment.' using errcode = 'P0001', hint = 'INVOICE_NOT_PAYABLE';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_inv.total_amount - v_inv.amount_paid then
    raise exception 'Enter an amount up to %.', private.format_inr(v_inv.total_amount - v_inv.amount_paid)
      using errcode = 'P0001', hint = 'INVALID_AMOUNT';
  end if;
  if nullif(btrim(p_reference), '') is null then
    raise exception 'Add the transfer reference (UTR / UPI id).' using errcode = 'P0001', hint = 'REFERENCE_REQUIRED';
  end if;
  insert into public.invoice_payments (invoice_id, amount, provider, reference, status, captured_at, recorded_by)
  values (v_inv.id, p_amount, 'manual', left(btrim(p_reference), 120), 'captured', now(), v_admin)
  returning id into v_pay;
  v_inv := private.apply_invoice_payment(v_inv.id, v_pay, p_amount);
  perform private.audit('invoice_payment_manual', 'invoice', v_inv.id::text,
    jsonb_build_object('number', v_inv.number, 'amount', p_amount, 'reference', p_reference), v_admin, 'admin');
  return v_inv;
end;
$$;

revoke execute on function private.issue_order_invoices(uuid), private.apply_withholdings(uuid),
  private.issue_creator_commission_invoice(uuid), private.issue_settlement_statement(uuid),
  private.issue_credit_note(uuid, uuid, numeric, numeric, text), private.billing_apply_refund(uuid),
  private.apply_invoice_payment(uuid, uuid, numeric), private.order_invoice_lines(uuid, text) from public;
revoke execute on function public.register_invoice_payment(uuid, uuid, text, numeric, jsonb),
  public.confirm_invoice_payment(text, text, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.register_invoice_payment(uuid, uuid, text, numeric, jsonb),
  public.confirm_invoice_payment(text, text, text, bigint, jsonb) to service_role;
revoke execute on function public.admin_record_invoice_payment(uuid, numeric, text) from public, anon;
grant execute on function public.admin_record_invoice_payment(uuid, numeric, text) to authenticated;

-- ================================================================ admin ===
create or replace function public.admin_save_billing_entity(p_entity jsonb)
returns public.billing_entity
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.billing_entity;
  v_gstin text := nullif(upper(btrim(p_entity ->> 'gstin')), '');
begin
  update public.billing_entity set
    legal_name = coalesce(nullif(btrim(p_entity ->> 'legal_name'), ''), legal_name),
    trade_name = nullif(btrim(p_entity ->> 'trade_name'), ''),
    gstin = v_gstin,
    pan = coalesce(nullif(upper(btrim(p_entity ->> 'pan')), ''), case when v_gstin is not null then substr(v_gstin, 3, 10) end),
    tan = nullif(upper(btrim(p_entity ->> 'tan')), ''),
    state_code = coalesce(nullif(btrim(p_entity ->> 'state_code'), ''), case when v_gstin is not null then substr(v_gstin, 1, 2) end, state_code),
    address = nullif(btrim(p_entity ->> 'address'), ''),
    city = nullif(btrim(p_entity ->> 'city'), ''),
    pincode = nullif(btrim(p_entity ->> 'pincode'), ''),
    email = nullif(btrim(p_entity ->> 'email'), ''),
    phone = nullif(btrim(p_entity ->> 'phone'), ''),
    commission_sac = coalesce(nullif(btrim(p_entity ->> 'commission_sac'), ''), commission_sac),
    creator_service_sac = coalesce(nullif(btrim(p_entity ->> 'creator_service_sac'), ''), creator_service_sac),
    invoice_note = nullif(btrim(p_entity ->> 'invoice_note'), ''),
    updated_by = v_admin,
    updated_at = now()
  where id
  returning * into v_row;
  perform private.audit('billing_entity_updated', 'billing_entity', 'hoc',
    jsonb_build_object('gstin', v_row.gstin, 'state_code', v_row.state_code), v_admin, 'admin');
  return v_row;
exception
  when check_violation then
    raise exception 'Some details are not in the right format. GSTIN 15 characters, PAN 10, TAN 10, PIN 6 digits, and the GSTIN must match the state and PAN.'
      using errcode = 'P0001', hint = 'INVALID_BILLING_ENTITY';
end;
$$;

create or replace function public.admin_save_tax_rate(p_code text, p_rate numeric, p_threshold numeric, p_effective_from date, p_note text default null)
returns public.tax_rates
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.tax_rates;
begin
  if p_effective_from is null or p_effective_from < private.ist_date(now()) then
    raise exception 'A rate starts today or later. Past rates stay as they were, so earlier documents stay true.'
      using errcode = 'P0001', hint = 'PAST_EFFECTIVE_DATE';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    raise exception 'Enter a rate between 0 and 100.' using errcode = 'P0001', hint = 'INVALID_RATE';
  end if;
  insert into public.tax_rates as r (code, rate, threshold, effective_from, note, created_by)
  values (p_code, p_rate, p_threshold, p_effective_from, nullif(btrim(p_note), ''), v_admin)
  on conflict (code, effective_from) do update
  set rate = excluded.rate, threshold = excluded.threshold, note = excluded.note, created_by = excluded.created_by
  returning * into v_row;
  perform private.audit('tax_rate_saved', 'tax_rate', v_row.id::text,
    jsonb_build_object('code', p_code, 'rate', p_rate, 'threshold', p_threshold, 'effective_from', p_effective_from), v_admin, 'admin');
  return v_row;
exception
  when check_violation then
    raise exception 'Unknown tax code, or a negative limit.' using errcode = 'P0001', hint = 'INVALID_TAX_RATE';
end;
$$;

-- Only a rate that hasn't started yet can be withdrawn.
create or replace function public.admin_delete_tax_rate(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.tax_rates;
begin
  select * into v_row from public.tax_rates where id = p_id;
  if not found then
    raise exception 'Rate not found.' using errcode = 'P0002', hint = 'RATE_NOT_FOUND';
  end if;
  if v_row.effective_from <= private.ist_date(now()) then
    raise exception 'This rate is already in effect. Add a new rate from a later date instead.' using errcode = 'P0001', hint = 'RATE_IN_EFFECT';
  end if;
  delete from public.tax_rates where id = p_id;
  perform private.audit('tax_rate_deleted', 'tax_rate', p_id::text, to_jsonb(v_row), v_admin, 'admin');
end;
$$;

create or replace function public.admin_record_tax_deposit(p_deposit jsonb)
returns public.tax_deposits
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_row public.tax_deposits;
  v_account text;
begin
  insert into public.tax_deposits (tax_type, period, amount, reference, deposited_on, return_type, filing_reference, filed_on, note, created_by)
  values (p_deposit ->> 'tax_type', date_trunc('month', (p_deposit ->> 'period')::date)::date, (p_deposit ->> 'amount')::numeric,
          btrim(p_deposit ->> 'reference'), (p_deposit ->> 'deposited_on')::date, nullif(btrim(p_deposit ->> 'return_type'), ''),
          nullif(btrim(p_deposit ->> 'filing_reference'), ''), nullif(p_deposit ->> 'filed_on', '')::date,
          nullif(btrim(p_deposit ->> 'note'), ''), v_admin)
  returning * into v_row;
  v_account := case v_row.tax_type when 'gst_output' then 'gst_output_payable' when 'tds_194o' then 'tds_payable' else 'tcs_payable' end;
  perform private.post_ledger('tax_deposit', 'tax_deposit:' || v_row.id, jsonb_build_array(
    jsonb_build_object('account', v_account, 'amount', v_row.amount),
    jsonb_build_object('account', 'gateway_clearing', 'amount', -v_row.amount)),
    jsonb_build_object('deposit_id', v_row.id, 'memo', format('%s deposit for %s, %s', v_row.tax_type, to_char(v_row.period, 'Mon YYYY'), v_row.reference)));
  perform private.audit('tax_deposit_recorded', 'tax_deposit', v_row.id::text, to_jsonb(v_row), v_admin, 'admin');
  return v_row;
exception
  when check_violation or not_null_violation or invalid_datetime_format or invalid_text_representation then
    raise exception 'Fill in the tax, month, amount, challan reference and deposit date.' using errcode = 'P0001', hint = 'INVALID_DEPOSIT';
end;
$$;

-- Admin → Billing → Overview. Real money only (test accounts excluded).
create or replace function public.admin_billing_summary(p_from date default null, p_to date default null)
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
  v_from := coalesce(p_from, date '2000-01-01')::timestamp at time zone 'Asia/Kolkata';
  v_to := (coalesce(p_to, private.ist_date(now())) + 1)::timestamp at time zone 'Asia/Kolkata';

  return (
    with l as (select * from public.ledger_entries where not is_test),
         p as (select * from l where occurred_at >= v_from and occurred_at < v_to),
         w as (select * from public.tax_withholdings where not is_test),
         d as (select * from public.tax_deposits where not is_test),
         inv as (select * from public.invoices where not is_test)
    select jsonb_build_object(
      'period', jsonb_build_object('from', p_from, 'to', coalesce(p_to, private.ist_date(now()))),
      'billing_v2_enabled', private.setting_bool('billing_v2_enabled', false),
      'transaction_value', (select coalesce(sum(amount), 0) from p where event = 'brand_payment' and account = 'gateway_clearing'),
      'refunds', (select coalesce(-sum(amount), 0) from p where event = 'refund' and account = 'gateway_clearing'),
      'brand_commission_revenue', (select coalesce(-sum(amount), 0) from p where account = 'brand_commission_revenue'),
      'creator_commission_revenue', (select coalesce(-sum(amount), 0) from p where account = 'creator_commission_revenue'),
      'hoc_revenue', (select coalesce(-sum(amount), 0) from p where account in ('brand_commission_revenue', 'creator_commission_revenue')),
      'gst_collected', (select coalesce(-sum(amount), 0) from p where account = 'gst_output_payable' and event <> 'tax_deposit'),
      'tds_withheld', (select coalesce(-sum(amount), 0) from p where account = 'tds_payable' and event <> 'tax_deposit'),
      'tcs_collected', (select coalesce(-sum(amount), 0) from p where account = 'tcs_payable' and event <> 'tax_deposit'),
      'creator_payouts', (select coalesce(-sum(amount), 0) from p where event = 'payout' and account = 'gateway_clearing'),
      'commission_payments', (select coalesce(sum(amount), 0) from p where event = 'commission_payment' and account = 'gateway_clearing'),
      'tax_deposited', (select coalesce(-sum(amount), 0) from p where event = 'tax_deposit' and account = 'gateway_clearing'),
      -- Balances today, whatever the period.
      'balances', (select coalesce(jsonb_object_agg(account, total), '{}'::jsonb)
                   from (select account, sum(amount) as total from l group by account) b),
      'gst_payable', (select coalesce(-sum(amount), 0) from l where account = 'gst_output_payable'),
      'tds_payable', (select coalesce(-sum(amount), 0) from l where account = 'tds_payable'),
      'tcs_payable', (select coalesce(-sum(amount), 0) from l where account = 'tcs_payable'),
      'outstanding_creator_commissions', (select coalesce(sum(amount), 0) from l where account = 'creator_commission_receivable'),
      'outstanding_commission_invoices', (select count(*) from inv where kind = 'creator_commission' and status in ('unpaid', 'partially_paid')),
      'pending_settlements', (select coalesce(-sum(amount), 0) from l where account = 'creator_payable'),
      'monthly_taxes', (
        select coalesce(jsonb_agg(m order by m.month desc), '[]'::jsonb)
        from (
          select to_char(months.month, 'YYYY-MM') as month,
                 (select coalesce(sum(amount), 0) from w where tax_type = 'tds_194o' and w.period = months.month) as tds_withheld,
                 (select coalesce(sum(amount), 0) from w where tax_type = 'tds_194o' and status = 'reversed'
                    and date_trunc('month', private.ist_date(w.reversed_at)) = months.month) as tds_reversed,
                 (select coalesce(sum(amount), 0) from w where tax_type = 'tcs_gst_52' and w.period = months.month) as tcs_collected,
                 (select coalesce(sum(amount), 0) from w where tax_type = 'tcs_gst_52' and status = 'reversed'
                    and date_trunc('month', private.ist_date(w.reversed_at)) = months.month) as tcs_reversed,
                 (select coalesce(-sum(amount), 0) from l where account = 'gst_output_payable' and event <> 'tax_deposit'
                    and date_trunc('month', private.ist_date(l.occurred_at)) = months.month) as gst_output,
                 (select coalesce(sum(amount), 0) from d where tax_type = 'tds_194o' and d.period = months.month) as tds_deposited,
                 (select coalesce(sum(amount), 0) from d where tax_type = 'tcs_gst_52' and d.period = months.month) as tcs_deposited,
                 (select coalesce(sum(amount), 0) from d where tax_type = 'gst_output' and d.period = months.month) as gst_deposited
          from (
            select distinct date_trunc('month', private.ist_date(occurred_at))::date as month from l
            union select period from d
          ) months
        ) m
      ),
      'reconciliation', jsonb_build_object(
        'unbalanced_postings', (select count(*) from (select txn_id from public.ledger_entries group by txn_id having sum(amount) <> 0) u),
        'paid_orders_without_invoices', (
          select count(*) from public.orders o
          where o.billing_version = 2 and not private.is_test_order(o.id)
            and exists (select 1 from public.payments pm where pm.order_id = o.id and pm.status in ('captured', 'partially_refunded', 'refunded'))
            and not exists (select 1 from public.invoices i where i.order_id = o.id and i.kind = 'creator_service')),
        'captured_v2_payments', (
          select coalesce(sum(pm.amount), 0) from public.payments pm join public.orders o on o.id = pm.order_id
          where o.billing_version = 2 and not private.is_test_order(o.id)
            and pm.status in ('captured', 'partially_refunded', 'refunded')),
        'ledger_brand_payments', (select coalesce(sum(amount), 0) from l where event = 'brand_payment' and account = 'gateway_clearing'),
        'withholdings_total', (select coalesce(sum(amount), 0) from w where status = 'deducted'),
        'ledger_withholdings', (select coalesce(-sum(amount), 0) from l where account in ('tds_payable', 'tcs_payable')
                                  and event in ('withholding', 'withholding_reversal')),
        'commission_invoices_outstanding', (select coalesce(sum(total_amount - amount_paid), 0) from inv
                                             where kind = 'creator_commission' and status in ('unpaid', 'partially_paid')),
        'ledger_commission_receivable', (select coalesce(sum(amount), 0) from l where account = 'creator_commission_receivable'),
        'unpaid_v2_earnings', (select coalesce(sum(e.net_amount), 0) from public.creator_earnings e join public.orders o on o.id = e.order_id
                               where o.billing_version = 2 and not private.is_test_order(o.id) and e.status in ('pending', 'available', 'held')),
        'paid_orders_in_progress', (
          select coalesce(sum(o.creator_earning_amount), 0) from public.orders o
          where o.billing_version = 2 and not private.is_test_order(o.id)
            and o.status not in ('draft', 'payment_pending', 'completed', 'cancelled', 'refunded')))
    )
  );
end;
$$;

-- CSV registers for the CA: every document, and every TDS / TCS line.
create or replace function public.admin_invoice_register(p_from date, p_to date, p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'number', i.number, 'date', private.ist_date(i.issued_at), 'kind', i.kind, 'document', i.document_title,
      'issuer', i.issuer, 'supplier', i.supplier ->> 'name', 'supplier_gstin', i.supplier ->> 'gstin',
      'recipient', i.recipient ->> 'name', 'recipient_gstin', i.recipient ->> 'gstin', 'place_of_supply', i.place_of_supply,
      'sac', i.sac, 'order_number', i.meta ->> 'order_number', 'original_invoice', i.meta ->> 'original_number',
      'gst_rate', i.gst_rate, 'taxable', i.taxable_amount, 'cgst', i.cgst_amount, 'sgst', i.sgst_amount, 'igst', i.igst_amount,
      'total', i.total_amount, 'tds', i.tds_amount, 'tcs', i.tcs_amount, 'net', i.net_amount,
      'status', i.status, 'amount_paid', i.amount_paid, 'test', i.is_test) order by i.issued_at, i.number), '[]'::jsonb)
    from public.invoices i
    where private.ist_date(i.issued_at) between p_from and p_to and (p_include_test or not i.is_test)
  );
end;
$$;

create or replace function public.admin_withholding_register(p_from date, p_to date, p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform private.require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', private.ist_date(w.created_at), 'tax', w.tax_type, 'order_number', o.order_number,
      'creator', coalesce(t.legal_name, c.display_name), 'entity_type', coalesce(t.entity_type, 'individual'),
      'pan', w.pan, 'gstin', w.gstin, 'supplier_state', w.supplier_state, 'place_of_supply', w.place_of_supply,
      'intra_state', w.supplier_state is not distinct from w.place_of_supply,
      'base', w.base_amount, 'rate', w.rate, 'amount', w.amount, 'exemption', w.exemption,
      'financial_year', w.financial_year, 'period', to_char(w.period, 'YYYY-MM'), 'status', w.status,
      'reversed_on', private.ist_date(w.reversed_at), 'test', w.is_test) order by w.created_at), '[]'::jsonb)
    from public.tax_withholdings w
    join public.orders o on o.id = w.order_id
    join public.creators c on c.id = w.creator_id
    left join public.creator_tax_profiles t on t.creator_id = w.creator_id
    where private.ist_date(w.created_at) between p_from and p_to and (p_include_test or not w.is_test)
  );
end;
$$;

-- ======================================================= party summaries ===
create or replace function public.get_my_billing_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_creator uuid := private.my_creator_id();
  v_brand uuid := private.my_brand_id();
begin
  if v_creator is not null then
    return jsonb_build_object(
      'role', 'creator',
      'earnings_total', (select coalesce(sum(gross_amount), 0) from public.creator_earnings where creator_id = v_creator and status <> 'refunded'),
      'pending', (select coalesce(sum(net_amount), 0) from public.creator_earnings where creator_id = v_creator and status in ('pending', 'available', 'held')),
      'paid', (select coalesce(sum(net_amount), 0) from public.creator_earnings where creator_id = v_creator and status = 'paid'),
      'in_progress', (select coalesce(sum(creator_earning_amount), 0) from public.orders where creator_id = v_creator
                      and status not in ('draft', 'payment_pending', 'completed', 'cancelled', 'refunded')),
      'tds', (select coalesce(sum(amount), 0) from public.tax_withholdings where creator_id = v_creator and tax_type = 'tds_194o' and status = 'deducted'),
      'tcs', (select coalesce(sum(amount), 0) from public.tax_withholdings where creator_id = v_creator and tax_type = 'tcs_gst_52' and status = 'deducted'),
      'commission_outstanding', (select coalesce(sum(total_amount - amount_paid), 0) from public.invoices
                                 where creator_id = v_creator and kind = 'creator_commission' and status in ('unpaid', 'partially_paid')),
      'commission_paid', (select coalesce(sum(amount_paid), 0) from public.invoices where creator_id = v_creator and kind = 'creator_commission'),
      'commission_percent', private.setting_numeric('platform_fee_percentage', 10),
      'tax_profile', (select to_jsonb(t) from public.creator_tax_profiles t where t.creator_id = v_creator),
      'rates', jsonb_build_object(
        'gst', (private.tax_rate('gst_hoc_services')).rate,
        'tds', (private.tax_rate('tds_194o')).rate,
        'tds_no_pan', (private.tax_rate('tds_194o_no_pan')).rate,
        'tds_limit', (private.tax_rate('tds_194o_exemption_limit')).threshold,
        'tcs', (private.tax_rate('tcs_gst_52')).rate));
  elsif v_brand is not null then
    return (
      with paid as (
        select o.* from public.orders o
        where o.brand_id = v_brand
          and exists (select 1 from public.payments pm where pm.order_id = o.id and pm.status in ('captured', 'partially_refunded', 'refunded'))
      )
      select jsonb_build_object(
        'role', 'brand',
        'campaign_payments', coalesce(sum(total_amount), 0),
        'creator_fees', coalesce(sum(subtotal + addons_total), 0),
        'creator_gst', coalesce(sum(creator_gst_amount), 0),
        'hoc_commission', coalesce(sum(brand_fee_amount), 0),
        'commission_gst', coalesce(sum(brand_fee_gst_amount), 0),
        'orders', count(*),
        'refunded', (select coalesce(sum(r.amount), 0) from public.payment_refunds r join public.orders o on o.id = r.order_id
                     where o.brand_id = v_brand and r.status = 'processed'),
        'outstanding', (select coalesce(sum(total_amount - amount_paid), 0) from public.invoices
                        where brand_id = v_brand and visible_to_brand and status in ('unpaid', 'partially_paid')),
        'commission_percent', private.setting_numeric('brand_fee_percentage', 0),
        'billing_profile', (select to_jsonb(t) from public.brand_billing_profiles t where t.brand_id = v_brand))
      from paid);
  end if;
  raise exception 'Only brands and creators have billing.' using errcode = '42501', hint = 'ROLE_REQUIRED';
end;
$$;

revoke execute on function public.admin_save_billing_entity(jsonb), public.admin_save_tax_rate(text, numeric, numeric, date, text),
  public.admin_delete_tax_rate(uuid), public.admin_record_tax_deposit(jsonb), public.admin_billing_summary(date, date),
  public.admin_invoice_register(date, date, boolean), public.admin_withholding_register(date, date, boolean),
  public.get_my_billing_summary() from public, anon;
grant execute on function public.admin_save_billing_entity(jsonb), public.admin_save_tax_rate(text, numeric, numeric, date, text),
  public.admin_delete_tax_rate(uuid), public.admin_record_tax_deposit(jsonb), public.admin_billing_summary(date, date),
  public.admin_invoice_register(date, date, boolean), public.admin_withholding_register(date, date, boolean),
  public.get_my_billing_summary() to authenticated;

-- Invoice emails count as payment mail (on by default, can be turned off).
create or replace function private.email_category(p_type text)
returns text
language sql
immutable
as $$
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
                    'payout_processed', 'invoice_issued', 'invoice_paid')
      then 'payments'
    when p_type in ('brief_received', 'campaign_review', 'campaign_approved', 'campaign_rejected',
                    'campaign_invite', 'campaign_application', 'campaign_accepted', 'campaign_declined')
      then 'campaigns'
    when p_type in ('welcome', 'onboarding_completed', 'profile_submitted',
                    'profile_approved', 'profile_rejected', 'creator_verified')
      then 'account'
    when p_type in ('announcement')
      then 'marketing'
    else 'account'
  end;
$$;

commit;
