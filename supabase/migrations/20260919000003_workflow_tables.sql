-- =============================================================================
-- Spotlit · 0003 · workflow tables
-- briefs, orders (+items, transitions, history, revisions, deliverables,
-- shipping), messaging, wishlists, payments, earnings, payouts, reviews,
-- notifications, reports, disputes, audit, analytics, contact
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Briefs
-- -----------------------------------------------------------------------------
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  creator_id uuid references public.creators (id) on delete set null,
  title text not null check (char_length(title) between 3 and 140),
  campaign_objective text check (char_length(campaign_objective) <= 2000),
  product_name text check (char_length(product_name) <= 140),
  product_description text check (char_length(product_description) <= 2000),
  product_url text check (product_url is null or product_url ~* '^https?://[^\s]+$'),
  category_id uuid references public.categories (id) on delete set null,
  content_type text check (char_length(content_type) <= 60),
  deliverables text check (char_length(deliverables) <= 2000),
  target_audience text check (char_length(target_audience) <= 1000),
  tone text check (char_length(tone) <= 300),
  reference_links text[] not null default '{}' check (cardinality(reference_links) <= 10),
  talking_points text[] not null default '{}' check (cardinality(talking_points) <= 20),
  do_not_say text[] not null default '{}' check (cardinality(do_not_say) <= 20),
  deadline date,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  usage_rights text check (char_length(usage_rights) <= 500),
  platform text check (char_length(platform) <= 60),
  status public.brief_status not null default 'draft',
  sent_at timestamptz,
  responded_at timestamptz,
  response_note text check (char_length(response_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index briefs_brand_status_idx on public.briefs (brand_id, status, created_at desc);
create index briefs_creator_status_idx on public.briefs (creator_id, status, created_at desc);
create trigger briefs_set_updated_at before update on public.briefs
  for each row execute function private.set_updated_at();

create table public.brief_attachments (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 255),
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index brief_attachments_brief_idx on public.brief_attachments (brief_id);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create sequence public.order_number_seq start with 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('SPT-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  brand_id uuid not null references public.brands (id) on delete restrict,
  creator_id uuid not null references public.creators (id) on delete restrict,
  service_id uuid references public.creator_services (id) on delete set null,
  brief_id uuid references public.briefs (id) on delete set null,
  status public.order_status not null default 'payment_pending',
  service_title text not null,
  service_description text,
  content_type text,
  delivery_days int not null check (delivery_days between 1 and 90),
  revisions_allowed int not null default 0 check (revisions_allowed >= 0),
  revisions_used int not null default 0 check (revisions_used >= 0),
  requires_shipping boolean not null default false,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  addons_total numeric(12, 2) not null default 0 check (addons_total >= 0),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  currency text not null default 'INR',
  platform_fee_percent numeric(5, 2) not null check (platform_fee_percent between 0 and 100),
  platform_fee_amount numeric(12, 2) not null check (platform_fee_amount >= 0),
  creator_earning_amount numeric(12, 2) not null check (creator_earning_amount >= 0),
  brief_snapshot jsonb,
  requirements text check (char_length(requirements) <= 4000),
  due_at timestamptz,
  paid_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text check (char_length(cancellation_reason) <= 1000),
  refund_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches check (total_amount = subtotal + addons_total),
  constraint orders_earning_matches check (creator_earning_amount = total_amount - platform_fee_amount),
  constraint orders_revisions_within_allowance check (revisions_used <= revisions_allowed)
);
create index orders_brand_status_created_idx on public.orders (brand_id, status, created_at desc);
create index orders_creator_status_created_idx on public.orders (creator_id, status, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_service_idx on public.orders (service_id);
create index orders_brief_idx on public.orders (brief_id);
create index orders_refund_required_idx on public.orders (refund_required) where refund_required;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_type text not null check (item_type in ('service', 'addon')),
  service_id uuid references public.creator_services (id) on delete set null,
  addon_id uuid references public.service_addons (id) on delete set null,
  name text not null,
  description text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity int not null default 1 check (quantity > 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

-- Data-driven order state machine: which actor may move an order from/to which status.
create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  actor public.actor_role not null,
  description text,
  primary key (from_status, to_status, actor)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  old_status public.order_status,
  new_status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  actor_role public.actor_role not null default 'system',
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  revision_number int not null check (revision_number > 0),
  requested_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  instructions text check (char_length(instructions) <= 4000),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  status public.revision_status not null default 'requested',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at timestamptz,
  unique (order_id, revision_number)
);
create index order_revisions_order_idx on public.order_revisions (order_id);

create table public.order_deliverables (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  revision_id uuid references public.order_revisions (id) on delete set null,
  round int not null default 1 check (round > 0),
  storage_path text unique,
  external_url text check (external_url is null or external_url ~* '^https?://[^\s]+$'),
  file_name text check (char_length(file_name) <= 255),
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint order_deliverables_has_content check (storage_path is not null or external_url is not null)
);
create index order_deliverables_order_idx on public.order_deliverables (order_id, round);

create table public.shipping_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  shipping_required boolean not null default true,
  recipient_name text check (char_length(recipient_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  address text check (char_length(address) <= 500),
  city text check (char_length(city) <= 80),
  state text check (char_length(state) <= 80),
  postal_code text check (postal_code is null or postal_code ~ '^[A-Za-z0-9 -]{3,12}$'),
  country text default 'India',
  courier text check (char_length(courier) <= 80),
  tracking_number text check (char_length(tracking_number) <= 80),
  tracking_url text check (tracking_url is null or tracking_url ~* '^https?://[^\s]+$'),
  address_submitted_at timestamptz,
  shipped_at timestamptz,
  received_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_details_set_updated_at before update on public.shipping_details
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Messaging — one conversation per brand/creator pair
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null default 'direct',
  brand_id uuid not null references public.brands (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  subject text check (char_length(subject) <= 140),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversations_pair_idx on public.conversations (brand_id, creator_id) where type = 'direct';
create index conversations_creator_idx on public.conversations (creator_id);
create index conversations_last_message_idx on public.conversations (last_message_at desc nulls last);
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  participant_role public.actor_role not null,
  last_read_at timestamptz,
  archived boolean not null default false,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (conversation_id, profile_id)
);
create index conversation_participants_profile_idx on public.conversation_participants (profile_id, archived);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text check (char_length(body) <= 5000),
  message_type public.message_type not null default 'text',
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  metadata jsonb not null default '{}',
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint messages_not_empty check (
    message_type = 'system'
    or char_length(btrim(coalesce(body, ''))) > 0
    or jsonb_array_length(attachments) > 0
  )
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

-- -----------------------------------------------------------------------------
-- Wishlists
-- -----------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);
create unique index wishlists_one_default_idx on public.wishlists (brand_id) where is_default;
create trigger wishlists_set_updated_at before update on public.wishlists
  for each row execute function private.set_updated_at();

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (wishlist_id, creator_id)
);
create index wishlist_items_creator_idx on public.wishlist_items (creator_id);

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payer_id uuid references public.profiles (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  status public.payment_status not null default 'created',
  signature text,
  method text,
  error_code text,
  error_description text,
  refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  captured_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_payer_idx on public.payments (payer_id);
create index payments_status_created_idx on public.payments (status, created_at desc);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  provider_refund_id text unique,
  status public.refund_status not null default 'pending',
  reason text,
  initiated_by uuid references public.profiles (id) on delete set null,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_refunds_payment_idx on public.payment_refunds (payment_id);
create index payment_refunds_order_idx on public.payment_refunds (order_id);
create trigger payment_refunds_set_updated_at before update on public.payment_refunds
  for each row execute function private.set_updated_at();

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- -----------------------------------------------------------------------------
-- Earnings & payouts
-- -----------------------------------------------------------------------------
create table public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators (id) on delete cascade,
  method_type public.payout_method_type not null,
  account_holder_name text not null check (char_length(account_holder_name) between 2 and 120),
  upi_id text check (upi_id is null or upi_id ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$'),
  bank_account_number text check (bank_account_number is null or bank_account_number ~ '^[0-9]{9,18}$'),
  bank_account_last4 text,
  ifsc_code text check (ifsc_code is null or ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name text check (char_length(bank_name) <= 120),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_methods_complete check (
    (method_type = 'upi' and upi_id is not null)
    or (method_type = 'bank_transfer' and bank_account_number is not null and ifsc_code is not null)
  )
);
create trigger payout_methods_set_updated_at before update on public.payout_methods
  for each row execute function private.set_updated_at();

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  status public.payout_status not null default 'pending',
  payout_method_snapshot jsonb not null default '{}',
  notes text check (char_length(notes) <= 500),
  admin_note text check (char_length(admin_note) <= 1000),
  processed_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payout_requests_creator_idx on public.payout_requests (creator_id, created_at desc);
create index payout_requests_status_idx on public.payout_requests (status, created_at);
create unique index payout_requests_one_open_idx on public.payout_requests (creator_id)
  where status in ('pending', 'processing');
create trigger payout_requests_set_updated_at before update on public.payout_requests
  for each row execute function private.set_updated_at();

create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete restrict,
  order_id uuid not null unique references public.orders (id) on delete restrict,
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  platform_fee numeric(12, 2) not null check (platform_fee >= 0),
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  status public.earning_status not null default 'pending',
  available_at timestamptz,
  payout_request_id uuid references public.payout_requests (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_earnings_net_matches check (net_amount = gross_amount - platform_fee)
);
create index creator_earnings_creator_status_idx on public.creator_earnings (creator_id, status);
create index creator_earnings_payout_idx on public.creator_earnings (payout_request_id);
create index creator_earnings_available_at_idx on public.creator_earnings (available_at) where status = 'pending';
create trigger creator_earnings_set_updated_at before update on public.creator_earnings
  for each row execute function private.set_updated_at();

create table public.payout_transactions (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null references public.payout_requests (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  provider text not null default 'manual' check (provider in ('manual', 'razorpayx')),
  provider_reference text check (char_length(provider_reference) <= 120),
  status public.payout_txn_status not null default 'initiated',
  failure_reason text,
  processed_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payout_transactions_request_idx on public.payout_transactions (payout_request_id);
create trigger payout_transactions_set_updated_at before update on public.payout_transactions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reviews
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_role public.actor_role not null check (reviewer_role in ('brand', 'creator')),
  creator_id uuid not null references public.creators (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  response text check (char_length(response) <= 1000),
  responded_at timestamptz,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, reviewer_id)
);
create index reviews_creator_idx on public.reviews (creator_id, status, created_at desc);
create index reviews_brand_idx on public.reviews (brand_id, status, created_at desc);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (char_length(type) <= 60),
  title text not null check (char_length(title) <= 200),
  message text check (char_length(message) <= 1000),
  reference_type text,
  reference_id uuid,
  action_url text,
  read boolean not null default false,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create index notifications_user_read_created_idx on public.notifications (user_id, read, created_at desc);
create index notifications_reference_idx on public.notifications (reference_type, reference_id);

-- -----------------------------------------------------------------------------
-- Trust & safety
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 120),
  description text check (char_length(description) <= 2000),
  status public.report_status not null default 'open',
  admin_note text check (char_length(admin_note) <= 2000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_reporter_idx on public.reports (reported_by);
create trigger reports_set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  raised_by uuid references public.profiles (id) on delete set null,
  raised_by_role public.actor_role not null,
  reason text not null check (char_length(reason) between 3 and 140),
  description text check (char_length(description) <= 4000),
  status public.dispute_status not null default 'created',
  previous_order_status public.order_status not null,
  resolution text check (char_length(resolution) <= 2000),
  resolution_type text check (resolution_type in (
    'release_to_creator', 'refund_brand', 'partial_refund', 'resume_order', 'rejected'
  )),
  refund_amount numeric(12, 2) check (refund_amount is null or refund_amount >= 0),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_order_idx on public.disputes (order_id);
create index disputes_status_idx on public.disputes (status, created_at desc);
create unique index disputes_one_open_per_order_idx on public.disputes (order_id)
  where status in ('created', 'under_review', 'waiting_for_brand', 'waiting_for_creator');
create trigger disputes_set_updated_at before update on public.disputes
  for each row execute function private.set_updated_at();

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_role public.actor_role not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz not null default now()
);
create index dispute_messages_dispute_idx on public.dispute_messages (dispute_id, created_at);

-- -----------------------------------------------------------------------------
-- Audit + analytics + contact
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.actor_role,
  action text not null check (char_length(action) <= 80),
  entity_type text check (char_length(entity_type) <= 60),
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

create table public.creator_profile_views (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.creators (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewer_role public.user_role,
  created_at timestamptz not null default now()
);
create index creator_profile_views_creator_idx on public.creator_profile_views (creator_id, created_at desc);
create index creator_profile_views_viewer_idx on public.creator_profile_views (viewer_id, created_at desc);

create table public.search_events (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  query text check (char_length(query) <= 300),
  filters jsonb not null default '{}',
  results_count int,
  created_at timestamptz not null default now()
);
create index search_events_profile_idx on public.search_events (profile_id, created_at desc);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  company text check (char_length(company) <= 120),
  topic text check (char_length(topic) <= 60),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
