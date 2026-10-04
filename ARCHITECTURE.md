# House of Collabs — Architecture

House of Collabs is a two-sided marketplace where **brands** discover, compare and hire **creators** for
content (UGC videos, reels, reviews, photography…), and creators run a storefront with fixed-price
services. A platform **admin** operates verification, payments, payouts and settings.

> Brand identity is original: name **House of Collabs**, "limelight" accent (`#D4F34A`) on warm ink/paper
> neutrals, Bricolage Grotesque + Geist + Instrument Serif typography, and procedurally generated
> demo artwork. Nothing is taken from any existing marketplace's brand, copy or assets.

---

## 1. System architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Browser — React 19 + TypeScript + Vite SPA (Vercel static host)             │
│                                                                              │
│  pages ─► hooks (TanStack Query) ─► services ─► supabase-js client           │
│                     ▲                               │  anon key + user JWT   │
│                     └── realtime subscriptions ◄────┤                        │
│  Razorpay Checkout (checkout.js, public key only)   │                        │
└─────────────────────────────────────────────────────┼────────────────────────┘
                                                      │ HTTPS
┌─────────────────────────────────────────────────────▼────────────────────────┐
│  Supabase                                                                    │
│                                                                              │
│  Auth (GoTrue) ── email/password, Google OAuth, verification, recovery       │
│  Data API (PostgREST) ── tables + RPC, every request runs as anon/authenticated│
│  Realtime ── postgres_changes (RLS-filtered) + private broadcast/presence    │
│  Storage ── 6 buckets, policies on storage.objects, signed URLs              │
│  Edge Functions (Deno) ── payments, webhook, payouts, admin actions,         │
│                           smart search, email dispatch, sitemap              │
│  PostgreSQL 15+/17                                                           │
│    • public schema: tables, views, RPC functions (RLS on every table)        │
│    • private schema: security-definer helpers, trigger functions (not exposed)│
│    • triggers: timestamps, counters, notifications, earnings, audit          │
│    • pg_cron (optional): expiry / auto-approve / earnings release jobs       │
│    • pg_net + Vault: notification → send-notification webhook, + retry cron  │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │ server-to-server (secret keys)
                                      ┌────────▼────────┐
                                      │ Razorpay API    │  orders, payments,
                                      │ + webhooks      │  refunds, (RazorpayX)
                                      └─────────────────┘
```

**Principles**

1. **Supabase is the entire backend.** No Node/Express server. The SPA talks to Supabase with the
   anon key; privileged work happens in Postgres (`SECURITY DEFINER` functions) or Edge Functions
   (service role + third-party secrets).
2. **The database is the security boundary.** Route guards are UX only. Every user-facing table has
   RLS; sensitive columns are protected with column-level privileges; workflow state changes
   (orders, payments, payouts, reviews, publishing, roles) are only possible through
   validated functions.
3. **Money math is server-side.** Prices, add-ons, fees and creator earnings are computed in SQL
   from database rows (never from client input). The fee percentage is read from
   `platform_settings` and snapshotted on each order.
4. **Only verified payments activate orders** — Razorpay signature verification + payment fetch in
   `verify-payment`, and an HMAC-verified, idempotent `razorpay-webhook`.
5. **Everything is reproducible from `supabase/migrations`.** Reference data (categories, creator
   types, settings) lives in migrations; demo data lives in `supabase/seed.sql`.

---

## 2. Technology stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript 5.9, Vite 7 |
| Styling | Tailwind CSS 4 (CSS-first `@theme` design tokens), Radix primitives (`radix-ui`) in shadcn-style components, `class-variance-authority`, Lucide icons |
| Routing | React Router 7 (data router, route-level code splitting via `lazy`) |
| Server state | TanStack Query 5 (central query keys, invalidation, optimistic updates) |
| Forms | React Hook Form 7 + Zod 4 (schemas shared by forms and services) |
| Charts | Recharts 3 |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions (Deno) |
| Payments | Razorpay Orders API + Checkout + Webhooks (optional RazorpayX payouts) |
| Tests | Vitest (pure logic), SQL test suite for RLS/workflows (`supabase/tests`) |

---

## 3. Project structure

### 3.1 Current structure (at start)

The repository was empty — no existing code to preserve.

### 3.2 Proposed / implemented structure

```
.
├── ARCHITECTURE.md                 ← this document
├── README.md                       ← setup, deployment, testing
├── .env.example                    ← frontend env + Edge Function secret names
├── index.html
├── vite.config.ts · tsconfig*.json · vitest config
├── vercel.json                     ← SPA rewrites, headers, sitemap rewrite
├── public/
│   ├── robots.txt · sitemap.xml · favicon.svg · og-image.svg
│   └── demo/                       ← generated, original demo artwork (avatars, portfolio, logos)
├── scripts/
│   ├── generate-demo-assets.mjs    ← procedural SVG artwork
│   ├── generate-seed.mjs           ← deterministic seed.sql generator
│   ├── generate-sitemap.mjs        ← static sitemap
│   └── run-db-tests.mjs            ← runs supabase/tests/*.sql against a DB URL
├── supabase/
│   ├── config.toml
│   ├── migrations/                 ← schema, functions, triggers, RLS, storage, realtime, cron
│   ├── seed.sql                    ← demo data (30+ creators, 10 brands, orders, chats…)
│   ├── tests/                      ← SQL assertions for RLS + order/payment/payout flows
│   └── functions/
│       ├── _shared/                ← cors, http, auth, supabase clients, razorpay, email, parser
│       ├── create-payment/  verify-payment/  razorpay-webhook/
│       ├── smart-search/  request-payout/  process-payout/
│       ├── send-notification/  admin-order-action/  sitemap/
└── src/
    ├── main.tsx · App.tsx
    ├── config/          site.ts (brand name, nav, contact)
    ├── styles/          index.css (Tailwind + tokens + base layer)
    ├── routes/          router.tsx, guards.tsx
    ├── contexts/        auth-context.tsx, compare-context.tsx
    ├── lib/
    │   ├── supabase/    client.ts, storage.ts, functions.ts
    │   ├── payments/    razorpay.ts (checkout loader)
    │   ├── validation/  files.ts (bucket rules: size / MIME / extension)
    │   ├── query-client.ts · query-keys.ts · errors.ts · format.ts · order-state.ts · utils.ts
    ├── schemas/         zod schemas (auth, creator, brand, service, portfolio, brief, order…)
    ├── services/        one module per domain; the only place that calls supabase
    ├── hooks/           TanStack Query hooks + realtime hooks + utilities
    ├── types/           database.types.ts (generated shape) + domain types
    ├── utils/           slug, image resize, video thumbnail, file helpers
    ├── assets/          logo
    ├── components/
    │   ├── ui/          Button, Input, Select, Combobox, MultiSelect, Dialog/Modal, Drawer, Tabs,
    │   │                Dropdown, Badge, Avatar, Card, Checkbox, Switch, Slider, Tooltip,
    │   │                Popover, Skeleton, Progress, Textarea, Label, Separator, Accordion…
    │   ├── shared/      EmptyState, ErrorState, ConfirmDialog, FileUploader, ImageUploader,
    │   │                VideoUploader, DatePicker, RangeSlider, Breadcrumb, StatsCard, Chart,
    │   │                ReviewCard, FAQ, Pagination, DataTable, StarRating, Seo, Stepper…
    │   ├── layout/      Navbar, Footer, Sidebar, MobileNav, AppShell, PageHeader
    │   ├── marketplace/ CreatorCard, CreatorGrid, FilterBar, FilterDrawer, SearchBar, SmartSearch
    │   ├── creator/     PortfolioGrid, VideoCard, ServiceCard, PriceCard, SocialStats
    │   ├── orders/      OrderCard, OrderTimeline, OrderStatusBadge, action panels
    │   ├── messaging/   ConversationList, MessageList, ChatWindow, Composer
    │   ├── notifications/ NotificationPanel, NotificationBell
    │   └── marketing/   landing-page sections
    ├── layouts/         PublicLayout, AuthLayout, BrandLayout, CreatorLayout, AdminLayout, LegalLayout
    └── pages/
        ├── public/  auth/  brand/  creator/  admin/  shared/
```

---

## 4. Route map

Guards: **P** public · **G** guest-only · **A** any signed-in user · **B** brand · **C** creator ·
**AD** admin. Signed-in users who have not finished onboarding are redirected to `/onboarding`.

### Public
| Route | Page |
| --- | --- |
| `/` | Home (hero, trusted-by, brand + creator benefits, marketplace preview, old vs new workflow, how it works, discovery, order workflow, testimonials, FAQ, CTA) |
| `/brands` | Brand landing (search preview, creator cards, Search → Compare → Order → Track → Receive) |
| `/creators` | Creator landing (storefront preview, creator journey) |
| `/discover` | Public marketplace (real search, filters, pagination) |
| `/creators/:slug` | Public creator storefront (SEO) |
| `/categories/:slug` | Category landing + filtered marketplace |
| `/about` `/contact` | Company pages (contact form writes to `contact_messages`) |
| `/privacy` `/terms` `/cookie-policy` `/creator-guidelines` `/brand-guidelines` `/refund-policy` `/payout-policy` | Legal |

### Auth
| Route | Guard | Page |
| --- | --- | --- |
| `/login` | G | Email/password + Google |
| `/signup` | G | "I am a Brand / Creator" + email/password + Google |
| `/forgot-password` | G | Sends recovery email |
| `/reset-password` | P | Sets new password in recovery session |
| `/auth/callback` | P | OAuth / email-link landing (PKCE code exchange) |
| `/onboarding` | A | Role selection (OAuth users) → brand onboarding or 7-step creator onboarding |

### Brand (`/brand/*`, guard B)
`/brand` dashboard · `/brand/creators` marketplace · `/brand/creators/:id` creator profile ·
`/brand/compare` · `/brand/checkout/:serviceId` · `/brand/orders` · `/brand/orders/:id` ·
`/brand/messages` · `/brand/messages/:conversationId` · `/brand/briefs` · `/brand/briefs/new` ·
`/brand/briefs/:id` · `/brand/briefs/:id/edit` · `/brand/wishlists` · `/brand/notifications` ·
`/brand/settings/profile` · `/brand/settings/contact` · `/brand/settings/security` ·
`/brand/settings/billing`

### Creator (`/creator/*`, guard C)
`/creator` dashboard · `/creator/profile` · `/creator/portfolio` · `/creator/services` ·
`/creator/orders` · `/creator/orders/:id` · `/creator/messages` · `/creator/messages/:conversationId` ·
`/creator/briefs` · `/creator/briefs/:id` · `/creator/earnings` · `/creator/payouts` ·
`/creator/notifications` · `/creator/settings/profile` · `/creator/settings/social` ·
`/creator/settings/security`

### Admin (`/admin/*`, guard AD)
`/admin` dashboard · `/admin/creators` · `/admin/creators/:id` · `/admin/brands` ·
`/admin/brands/:id` · `/admin/orders` · `/admin/orders/:id` · `/admin/payments` ·
`/admin/payouts` · `/admin/categories` ·
`/admin/reports` · `/admin/notifications` · `/admin/emails` · `/admin/content` · `/admin/settings` ·
`/admin/audit-logs`

`*` → 404 page. Marketplace filters live in the URL, e.g.
`/brand/creators?category=beauty&city=delhi&maxPrice=5000&maxDelivery=5&sort=price_asc&page=2`.

---

## 5. Component architecture

```
design tokens (src/styles/index.css @theme)
      │
      ▼
ui primitives (components/ui)           ← Radix + cva, no data access
      │
      ▼
shared building blocks (components/shared) ← EmptyState, FileUploader, DataTable, Chart…
      │
      ▼
domain components (marketplace, creator, orders, messaging, notifications, marketing)
      │         (receive data via props or domain hooks)
      ▼
layouts (Public / Auth / Brand / Creator / Admin / Legal)
      │
      ▼
pages (route components; compose hooks + domain components; own loading/empty/error states)
```

**Design tokens** (single source of truth, Tailwind v4 `@theme`): colour palette (ink, paper,
surface, line, lime accent, pastel category tints, semantic success/warning/danger/info), font
families (display / sans / serif), fluid type scale (`text-display-*`), radii (`rounded-card`,
`rounded-pill`…), shadows (`shadow-card`, `shadow-float`…), easing + durations, container widths,
section spacing. Components reference tokens only — no arbitrary hex values or magic numbers.

**Async-state contract:** every data view renders exactly one of `Skeleton` (loading),
`ErrorState` (with retry), `EmptyState` (with a next action) or content.

---

## 6. Client data layer

* `lib/supabase/client.ts` — single typed client (`createClient<Database>`), PKCE auth flow,
  persisted session, auto refresh.
* `contexts/auth-context.tsx` — subscribes to `onAuthStateChange`, loads `profiles` + the brand or
  creator record, exposes `role`, `isAdmin`, `refresh()`, `signOut()`.
* `services/*` — the only modules that call Supabase. They return typed domain objects and throw
  normalised `AppError`s (`lib/errors.ts` maps Postgrest/Auth/Storage/Functions/network errors to
  safe, friendly messages; database functions raise human-readable messages with an error `hint`
  code).
* `hooks/*` — TanStack Query hooks with keys from `lib/query-keys.ts`; mutations invalidate the
  exact keys they affect; wishlist toggles and chat sends are optimistic.
* Realtime hooks merge `postgres_changes` events into the query cache (messages, notifications,
  order status).

---

## 7. Database architecture

### 7.1 Schemas
* `public` — tables, views and RPC functions exposed through the Data API (RLS on every table).
* `private` — `SECURITY DEFINER` helpers used by RLS policies, trigger functions and internal
  logic. Not exposed through the Data API.
* Supabase-managed: `auth`, `storage`, `realtime`, `extensions`, `cron`, `net`, `vault`.

### 7.2 Enums
`user_role` (brand, creator, admin) · `account_status` (active, suspended, deleted) ·
`creator_status` (draft, pending_review, published, rejected, suspended) · `gender_type` ·
`social_platform` (instagram, youtube, x, threads, facebook, other) · `portfolio_item_type`
(image, video, link) · `addon_type` · `brief_status` (draft, sent, accepted, rejected, completed) ·
`order_status` (17 values below, one of which — `disputed` — is retired; see migration 0058) · `payment_status` (created, authorized, captured, failed,
refunded, partially_refunded) · `earning_status` (pending, available, paid, held, refunded) ·
`payout_status` · `payout_txn_status` · `revision_status` ·
`report_target` · `report_status`.

### 7.3 Tables (relationships)

```
auth.users 1─1 profiles 1─1 brands ──< wishlists ──< wishlist_items >── creators
                        │          └─< briefs ──< brief_attachments
                        │          └─< orders
                        ├─1 creators ──< creator_categories >── categories
                        │            ├─< creator_social_accounts
                        │            ├─< creator_languages
                        │            ├─< creator_services ──< service_addons
                        │            ├─< portfolio_items
                        │            ├─< creator_earnings >── payout_requests ──< payout_transactions
                        │            └─1 payout_methods
                        └─1 admin_users
orders ──< order_items · order_status_history · order_deliverables · order_revisions
       ──1 shipping_details ──< payments ──< payment_refunds ──1 creator_earnings
       ──< reviews
conversations ──< conversation_participants >── profiles
              ──< messages
notifications >── profiles     reports >── profiles     audit_logs >── profiles
platform_settings · creator_types · order_status_transitions · webhook_events
creator_profile_views · search_events · contact_messages
```

Core tables follow the requested column lists; additional columns/tables exist where production
correctness needs them:

| Table | Purpose / notable columns |
| --- | --- |
| `profiles` | `id = auth.users.id`, `auth_user_id` (generated, = id), `role` (nullable until chosen), `full_name`, `email`, `avatar_url`, `status`, `onboarding_completed` |
| `brands` | brand profile incl. `brand_pronunciation`, `pronunciation_audio_url`, contact info |
| `creators` | storefront incl. denormalised search columns `starting_price`, `fastest_delivery_days`, `followers_count`, `rating`, `review_count`, `wishlist_count`, `profile_views`, `content_types[]`, `search_vector`, `status`, `verified`, `featured`, soft-delete `deleted_at` |
| `creator_services` / `service_addons` | fixed-price packages (`price`, `delivery_days`, `revisions_included`, `includes[]`, `requires_shipping`) and add-ons (`addon_type`, `extra_revisions`, `delivery_days_override`) |
| `orders` | snapshot of service, `brief_snapshot`, totals (`subtotal`, `addons_total`, `total_amount`, `platform_fee_percent`, `platform_fee_amount`, `creator_earning_amount`), `revisions_allowed/used`, `due_at`, lifecycle timestamps |
| `order_status_transitions` | data-driven state machine `(from_status, to_status, actor)` |
| `payments` / `payment_refunds` / `webhook_events` | Razorpay order/payment/refund records, idempotent webhook log |
| `creator_earnings` | one row per completed order: gross, platform fee, net, status, `available_at`, `payout_request_id` |
| `payout_methods` | UPI / bank details; full account number is **not selectable** by clients (column privilege), only `bank_account_last4` |
| `platform_settings` | `platform_fee_percentage`, `minimum_payout_amount`, `require_creator_approval`, `max_revisions`, `earning_hold_days`, `creator_response_hours`, `auto_approve_days`, `payment_expiry_hours`, `cancellation_rules`, `refund_rules` … |

### 7.4 Order state machine

```
payment_pending ─(verified payment)─► order_placed ─► creator_pending ─(creator accepts)─► accepted
accepted ─► awaiting_shipment ─(brand ships)─► shipped ─(creator)─► received ─► in_progress
accepted ─(digital service)─► in_progress ─(deliverables)─► delivered
delivered ─► revision_requested ─► revision_submitted ─► (approved | revision_requested | delivered)
delivered ─► approved ─► completed ─► creator earning row
creator_pending ─► cancelled (decline / cancel / timeout) ─► refunded (admin refund)
active states ─(admin)─► completed | cancelled | refunded
```

Enforcement is layered:
1. RPCs (`accept_order`, `request_revision`, …) check who is calling and business preconditions
   (e.g. deliverables present, revisions remaining).
2. A `BEFORE UPDATE OF status` trigger on `orders` rejects any transition not present in
   `order_status_transitions` for the acting role — even for direct SQL.
3. An `AFTER UPDATE` trigger writes `order_status_history`, notifications, audit logs, brief status
   sync and creates the creator earning on `completed`.
4. Clients have **no** `UPDATE` privilege on `orders` at all.

### 7.5 Key database functions

| Function | Caller | Purpose |
| --- | --- | --- |
| `search_creators(...)` | anon, authenticated | Server-side filtered, sorted, paginated marketplace search with `total_count` |
| `calculate_platform_fee`, `calculate_order_total` | authenticated | Server-side pricing preview |
| `create_order` | brand | Validates service/add-ons/brief, computes totals, creates order + items + shipping |
| `accept_order`, `decline_order`, `submit_shipping_address`, `mark_order_shipped`, `mark_product_received`, `start_order_work`, `submit_deliverables`, `request_revision`, `approve_order`, `cancel_order` | participants | Validated workflow transitions |
| `submit_review`, `respond_to_review`, `create_report` | participants | Trust & safety |
| `start_conversation`, `get_my_conversations`, `mark_conversation_read`, `set_conversation_archived` | authenticated | Messaging |
| `mark_notification_read`, `mark_all_notifications_read`, `get_unread_counts` | authenticated | Notifications |
| `publish_creator_profile`, `get_creator_completion`, `set_initial_role`, `complete_onboarding` | authenticated | Onboarding |
| `get_creator_dashboard_stats`, `get_brand_dashboard_stats`, `get_earnings_summary`, `record_profile_view`, `record_search_event` | authenticated / anon | Analytics |
| `confirm_order_payment`, `mark_payment_failed`, `record_refund`, `create_payout_request`, `complete_payout`, `admin_transition_order` | **service_role only** | Called by Edge Functions after verifying the caller / webhook |
| `admin_*` | admin (checked inside) | Dashboard stats, time series, creator/brand management, settings, reports, broadcast |
| `update_creator_rating`, `calculate_creator_earnings`, `validate_order_status_transition`, `create_audit_log` | internal | Trigger helpers |

### 7.6 Triggers

| Trigger | Effect |
| --- | --- |
| `set_updated_at` on all mutable tables | maintain `updated_at` |
| `on_auth_user_created` (auth.users) | create `profiles` row; role only accepted if `brand`/`creator` (never `admin`) |
| `on_auth_user_email_updated` | keep `profiles.email` in sync |
| creators/brands `before insert/update` | unique slug, search vector, validation |
| creator_services / service_addons changes | refresh `starting_price`, `fastest_delivery_days`, `content_types` |
| creator_social_accounts changes | refresh `followers_count` |
| reviews changes | `update_creator_rating` |
| wishlist_items changes | `wishlist_count` |
| messages insert | conversation preview, unread notification (coalesced), audit `message_sent` |
| orders status | validation (before) + history/notifications/earnings/audit (after) |
| brands insert | default wishlist |
| notifications insert | optional email dispatch via `pg_net` → `send-notification` |
| profile/brand/creator updates, settings, categories | audit events |

### 7.7 Indexes (highlights)
`creators`: partial index on published & not deleted; `lower(city)`, `lower(state)`,
`starting_price`, `followers_count`, `fastest_delivery_days`, `rating`, `published_at`,
composite `(status, available, verified)`, GIN on `search_vector`, trigram GIN on `display_name`.
`creator_categories (category_id, creator_id)`, `creator_languages (lower(language))`,
`creator_services (creator_id, active, price)`, `(delivery_days)`. `orders (brand_id, status,
created_at desc)`, `(creator_id, status, created_at desc)`, `(status)`, `(created_at)`.
`messages (conversation_id, created_at desc)`, `notifications (user_id, read, created_at desc)`,
plus FK indexes everywhere.

---

## 8. Authentication architecture

* **Supabase Auth only** — email/password with email confirmation, Google OAuth, password recovery,
  persisted sessions (localStorage) with auto refresh, PKCE flow.
* **Signup** sends `options.data.role = 'brand' | 'creator'` and `full_name`. The
  `on_auth_user_created` trigger creates the profile and **whitelists** the role; anything else
  (including `admin`) is stored as `NULL`.
* **OAuth users** have no role yet → `/onboarding` asks "I am a brand / creator" and calls
  `set_initial_role()`, which only succeeds while the role is `NULL`.
* **Role is immutable for users**: clients have no `UPDATE` privilege on `profiles.role` /
  `status` / `email`. Admin rights exist only through `admin_users` (inserted with SQL / service
  role); `private.is_admin()` checks that table.
* **Onboarding**: brands create their `brands` row; creators complete a 7-step wizard whose
  progress is saved in `creators.onboarding_step`. `complete_onboarding()` validates and flips
  `profiles.onboarding_completed`.
* **Route guards** (`RequireAuth`, `RequireRole`, `RequireOnboarded`) give good UX; RLS is the real
  enforcement.
* Login/logout are recorded through `record_auth_event()` (actor always `auth.uid()`), in
  addition to Supabase's own auth audit trail.

---

## 9. RLS strategy

**Helpers** (`private` schema, `SECURITY DEFINER`, `STABLE`, `search_path = ''`):
`is_admin()`, `user_role()`, `my_brand_id()`, `my_creator_id()`, `is_active_user()`,
`is_creator_public(creator_id)`, `is_order_participant(order_id)`,
`is_conversation_participant(conversation_id)`, `can_view_brief(brief_id)`,
`can_view_brand(brand_id)`. Policies call them as `(select private.fn())` so they are evaluated
once per statement.

| Table | anon | brand | creator | admin |
| --- | --- | --- | --- | --- |
| profiles | – | own row (update safe columns) | own row | all (via RPC for writes) |
| brands | – | own row CRUD | brands they work with (orders/briefs/chats) | all |
| creators | published only | published | published + own (safe columns) | all (writes via RPC) |
| categories, creator_types | active | active | active | CRUD |
| creator_* children, services, add-ons, portfolio | of published creators | same | own CRUD | all |
| wishlists / wishlist_items | – | own | – | read |
| briefs / brief_attachments | – | own CRUD | assigned or ordered | all |
| orders & children | – | own orders (read) | assigned orders (read) | all |
| order writes | – | RPC only | RPC only | Edge Function / RPC |
| conversations / messages | – | participant | participant | read |
| payments | – | own (non-sensitive cols) | – | all |
| creator_earnings, payout_* | – | – | own | all |
| payout_methods | – | – | own (masked cols) | all (reveal via audited RPC) |
| reviews | published | published + own | published + own | all |
| notifications | – | own | own | own |
| reports | – | insert + own | insert + own | all |
| audit_logs, admin_users, webhook_events | – | – | – | read only |
| platform_settings | public keys | public keys | public keys | read; write via RPC |

Suspended accounts (`profiles.status <> 'active'`) fail `private.is_active_user()` and cannot
write. Realtime `postgres_changes` inherits these policies; private broadcast/presence channels
are authorised through policies on `realtime.messages`.

---

## 10. Storage strategy

| Bucket | Public | Limit | MIME | Path convention | Write | Read |
| --- | --- | --- | --- | --- | --- | --- |
| `avatars` | yes | 5 MB | jpeg, png, webp | `{auth.uid}/{uuid}.{ext}` | owner folder | public |
| `creator-portfolio` | yes | 50 MB | jpeg, png, webp, gif, mp4, webm, quicktime | `{auth.uid}/{uuid}.{ext}` | owner (creator) | public |
| `brand-assets` | yes | 10 MB | images + audio (webm, mpeg, mp4, wav, ogg) | `{auth.uid}/{uuid}.{ext}` | owner (brand) | public |
| `brief-attachments` | **no** | 25 MB | images, pdf, docs, video | `{brief_id}/{uuid}-{name}` | owning brand | brand + assigned/ordering creator + admin |
| `order-deliverables` | **no** | 50 MB | images, video, pdf, zip | `{order_id}/{uuid}-{name}` | order participants | order participants + admin |
| `message-attachments` | **no** | 25 MB | images, pdf, docs, video | `{conversation_id}/{uuid}-{name}` | participants | participants + admin |

* Policies on `storage.objects` check bucket, folder ownership (`storage.foldername(name)`),
  allowed extensions (`storage.extension(name)`) and relationship helpers.
* Private files are always served through **short-lived signed URLs** (`createSignedUrl`, 1 h).
* Validation happens three times: client (size/MIME/extension before upload), bucket config
  (`file_size_limit`, `allowed_mime_types`) and policy (extension + ownership).
* Images are downscaled/re-encoded client-side (WebP) before upload; video thumbnails are captured
  from the first frame client-side.

---

## 11. Edge Functions

All functions: CORS preflight, JSON errors without internal details, explicit auth inside the
function (`verify_jwt = false` at the gateway so publishable/legacy keys both work), service-role
client created only inside the function.

| Function | Auth | Purpose |
| --- | --- | --- |
| `create-payment` | brand JWT | Loads order (must be caller's, `payment_pending`), creates/reuses a Razorpay order for the DB-computed amount, inserts `payments` row, returns checkout params (public key id only) |
| `verify-payment` | brand JWT | Verifies `razorpay_signature` (HMAC-SHA256 of `order_id|payment_id` with key secret, constant-time), fetches the payment from Razorpay, captures if only authorized, then calls `confirm_order_payment` |
| `razorpay-webhook` | Razorpay HMAC | Verifies `X-Razorpay-Signature` over the raw body with the webhook secret, dedupes by event id (`webhook_events`), handles `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed` |
| `smart-search` | anon/any | Parses natural language into structured filters (rule-based parser shared with the client fallback; pluggable AI parser behind `AI_API_KEY`) |
| `request-payout` | creator JWT | Calls `create_payout_request` (balance, minimum, method checks) and notifies admins |
| `process-payout` | admin JWT | Marks payouts processing/paid/failed/rejected (manual bank/UPI transfer reference, or RazorpayX when configured) |
| `admin-order-action` | admin JWT | Refund (Razorpay Refunds API), cancel, force-complete, status override — all audited |
| `send-notification` | webhook secret / admin JWT | Email dispatch through a provider abstraction (console, Resend) for notification rows; admin broadcast |
| `sitemap` | public | XML sitemap of published creator storefronts and categories |

Secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`RAZORPAYX_ACCOUNT_NUMBER` (optional), `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`
(optional), `NOTIFICATION_WEBHOOK_SECRET`, `SITE_URL`, `AI_API_KEY` (future). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

---

## 12. Payment architecture

```
Brand            SPA                    create-payment        Razorpay           verify-payment / webhook      Postgres
  │ Pay ───────► create_order() RPC ───────────────────────────────────────────────────────────────────────► order: payment_pending
  │              invoke create-payment ─► auth + ownership ─► POST /v1/orders ──►
  │                                        insert payments(created) ◄─ order_id ─┘
  │ ◄─ Razorpay Checkout (key_id, order_id)
  │ pays ───────────────────────────────────────────────────► payment
  │              handler(resp) ─► invoke verify-payment ─► HMAC check + GET /v1/payments/:id (+capture)
  │                                                          └─► confirm_order_payment() ────────────► payments: captured
  │                                                                                                    order: order_placed → creator_pending
  │                                                                                                    notify creator + brand, audit
  │                                      Razorpay ─ webhook (payment.captured / order.paid) ─► HMAC + dedupe ─► same idempotent function
```

* The client **never** reports success: the order only advances inside
  `confirm_order_payment`, which is executable by `service_role` only and checks amount/currency.
* Both verification paths are idempotent (row lock on the payment, early return if captured).
* Refunds: `admin-order-action` → Razorpay Refunds API → `record_refund` (and webhook
  `refund.processed` for async completion) → payment `refunded/partially_refunded`, order
  `refunded`, earning `refunded`.
* Stale `payment_pending` orders expire after `payment_expiry_hours` (cron).
* **Platform fee**: `platform_settings.platform_fee_percentage` (default 10). Snapshotted per
  order: `platform_fee_amount = round(total × pct / 100, 2)`, creator earning = total − fee.

---

## 13. Earnings & payouts

1. `orders.status → completed` (trigger) inserts `creator_earnings` (gross, fee, net) with
   `status = available` when `earning_hold_days = 0`, otherwise `pending` + `available_at`.
2. `release_matured_earnings()` (cron and on-demand) flips matured `pending` → `available`.
3. Creator saves a payout method (UPI or bank). The full account number is write-only for clients.
4. `request-payout` → `create_payout_request()` locks the creator's available earnings, enforces
   `minimum_payout_amount` and one open request at a time, links earnings to the request.
5. Admin processes it in `/admin/payouts` → `process-payout` (manual transfer reference or
   RazorpayX) → `complete_payout()` writes `payout_transactions`, marks earnings `paid`, notifies
   the creator. Failures/rejections release the earnings back to `available`.

---

## 14. Realtime architecture

| Feature | Mechanism |
| --- | --- |
| Chat messages | `postgres_changes` INSERT on `messages` filtered by `conversation_id` (RLS-checked) |
| Conversation list / unread | `postgres_changes` on `conversation_participants` + `messages` for the user |
| Notifications | `postgres_changes` INSERT on `notifications` filtered by `user_id` → toast + badge |
| Order status | `postgres_changes` UPDATE on `orders` filtered by `id` → timeline refresh |
| Typing + online presence | private channel `conversation:{id}` (broadcast + presence), authorised by RLS on `realtime.messages` |

Tables added to the `supabase_realtime` publication: `messages`, `notifications`, `orders`,
`conversation_participants`, `order_status_history`.

---

## 15. Notifications & email

* Notification rows are created only by server code (`private.notify()`): order lifecycle,
  payments, reviews, briefs, verification,
  payouts, admin broadcasts.
* The UI subscribes in realtime; `NotificationPanel` supports mark-read / mark-all-read.
* Email: an `AFTER INSERT` trigger posts the row to `send-notification` via `pg_net` **when
  configured in Vault** (`project_url`, `notification_webhook_secret`); otherwise it is a no-op.
  The function resolves the recipient, respects `profiles.email_notifications`, and sends through
  an `EmailProvider` interface (`console` default, `resend` adapter) selected by `EMAIL_PROVIDER`.

---

## 16. Search architecture

* `search_creators()` performs all filtering, sorting and pagination in Postgres and returns card
  data + `total_count`. Service-level constraints (price range, delivery days, content type,
  platform) are evaluated **on the same service** via `EXISTS`.
* Text query: `websearch_to_tsquery` on a weighted `search_vector` (name, categories, city, bio)
  plus trigram-accelerated `ILIKE` on names.
* Sorts: relevance (text rank + featured + verified + rating), price ↑/↓, followers, delivery,
  rating, newest.
* Client: URL query params are the source of truth; inputs are debounced; TanStack Query caches
  per filter set with `placeholderData` for smooth paging.
* **Smart Search**: "female beauty creator in Delhi under 5000 within 5 days" →
  `{category: 'beauty', gender: 'female', city: 'Delhi', maxPrice: 5000, maxDelivery: 5}` via the
  `smart-search` Edge Function (rule-based). The parser lives in
  `supabase/functions/_shared/smart-search-parser.ts` and is also imported by the client as an
  offline fallback. An AI parser can be plugged in behind the same interface using an Edge Function
  secret — keys never reach the browser.

---

## 17. Security summary

| Threat | Mitigation |
| --- | --- |
| Role escalation | role whitelisted in trigger, immutable via column privileges, admin only via `admin_users` |
| Tampered prices | all totals computed in `create_order` from DB rows |
| Fake payment success | server-side HMAC verification + provider fetch; service-role-only confirmation |
| Webhook spoofing / replay | HMAC over raw body, `webhook_events` idempotency |
| Arbitrary order status | no client UPDATE privilege + trigger-enforced state machine |
| Data leakage | RLS on all tables, column privileges on sensitive columns, private buckets + signed URLs |
| Secret exposure | only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID` in the client |
| Search path hijacking | every `SECURITY DEFINER` function sets `search_path = ''` |
| Abuse of internal functions | `EXECUTE` revoked from `anon`/`authenticated` on service-only functions |
| Upload abuse | bucket size/MIME limits + extension/ownership policies + client validation |
| Suspended users | `is_active_user()` required for writes |
| Auditability | `audit_logs` (append-only; no client write/update/delete) |

---

## 18. SEO, performance, accessibility

* React 19 document metadata (`<title>`, `<meta>`, canonical, OpenGraph, Twitter) via a `Seo`
  component; creator storefronts get dynamic titles/descriptions/images.
* `robots.txt`, static `sitemap.xml` + `sitemap` Edge Function for storefronts.
* Route-level code splitting, lazy images, client-side image optimisation, server-side pagination,
  debounced search, TanStack Query caching, optimistic updates.
* Semantic landmarks, Radix-based accessible dialogs/menus, visible focus rings, labelled form
  controls, `aria-live` toasts, WCAG AA colour contrast for text tokens.

---

## 19. Implementation phases

| # | Phase | Deliverables |
| --- | --- | --- |
| 1 | Architecture | this document |
| 2 | Design system | tokens, UI primitives, shared components, logo |
| 3 | Database | migrations (schema, functions, triggers, RLS, storage, realtime, cron), seed, SQL tests |
| 4 | Authentication | Supabase Auth flows, auth context, guards, onboarding |
| 5 | Public website | home, brands, creators, discover, storefronts, categories, company + legal pages |
| 6 | Brand app | dashboard, settings, wishlists, compare |
| 7 | Creator app | dashboard, onboarding wizard, profile, portfolio, services, settings |
| 8 | Marketplace | search RPC, filters, smart search, URL state |
| 9 | Briefs | brief builder, attachments, send/respond |
| 10 | Orders | checkout, order detail, timeline, deliverables, revisions, shipping |
| 11 | Messaging | realtime chat, attachments, read state, archive, presence |
| 12 | Notifications | realtime panel, email abstraction |
| 13 | Payments | Razorpay Edge Functions + checkout |
| 14 | Earnings & payouts | earnings ledger, payout methods, requests, admin processing |
| 15 | Reviews & reports | reviews, ratings, reports |
| 16 | Admin | dashboard/analytics, management screens, settings, audit logs |
| 17 | Security audit | RLS/privilege review, SQL tests |
| 18 | Responsive | 375 → 1920 px pass |
| 19 | QA | build, typecheck, unit + SQL tests, route walkthrough |
