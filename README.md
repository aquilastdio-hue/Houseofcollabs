# House of Collabs

A two-sided creator marketplace: brands discover creators, buy fixed-price
content packages, and pay through Razorpay; creators run a storefront, deliver
work, and withdraw earnings.

**The entire backend is Supabase.** There is no Node/Express server, no separate
API, no second database. Postgres (with row level security) is the source of
truth, Edge Functions hold the only code that touches a secret, and the React
app talks to Supabase directly through `@supabase/supabase-js`.

```
React 19 + Vite  ──►  Supabase
                      ├── Postgres 17   tables, RLS, RPCs, triggers, cron
                      ├── Auth          email/password + Google OAuth
                      ├── Storage       6 buckets, RLS-backed, signed URLs
                      ├── Realtime      messages, notifications, presence
                      └── Edge Functions  Razorpay, payouts, email, search
```

---

## Contents

1. [Requirements](#requirements)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Database](#database)
5. [Storage buckets](#storage-buckets)
6. [Edge Functions](#edge-functions)
7. [Auth setup](#auth-setup)
8. [Razorpay setup](#razorpay-setup)
9. [Email notifications](#email-notifications)
10. [Demo data](#demo-data)
11. [Testing](#testing)
12. [Deploying](#deploying)
13. [Project layout](#project-layout)
14. [Security model](#security-model)
15. [Known limitations](#known-limitations)

---

## Requirements

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 20+ (22 recommended) | frontend, scripts |
| Supabase CLI | 2.x | migrations, local stack, deploys |
| Docker Desktop | current | `supabase start` only |
| Deno | 2.x | type-checking Edge Functions locally (optional) |

A Supabase **cloud** project works without Docker — point the CLI at it with
`supabase link` and push migrations. Docker is only required for the fully
local stack.

---

## Quick start

```bash
npm install
```

```bash
supabase start
```

`supabase start` applies every migration in `supabase/migrations/` and then runs
`supabase/seed.sql`, so you get a fully populated marketplace on first boot.
Copy the printed keys into `.env.local`:

```bash
cp .env.example .env.local   # then paste the anon key
```

```bash
npm run dev
```

Open http://localhost:5173. The seed creates demo accounts with **random,
unknowable passwords** — a committed password is a published password, and this
repo learned that the hard way. Give yourself a local login:

```sql
update auth.users
set encrypted_password = extensions.crypt('<pick your own>', extensions.gen_salt('bf'))
where email = 'admin@spotlit.demo';   -- or kumkum@spotlit.demo (brand), aanya@spotlit.demo (creator)
```

Run it against your **local** database only. Production admins are created by
hand in the Supabase dashboard and exist nowhere in this repo.

### npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest unit tests |
| `npm run db:test` | SQL integration tests against a live database |
| `npm run gen:types` | Regenerate `src/types/database.types.ts` |
| `npm run gen:seed` | Rebuild `supabase/seed.sql` |
| `npm run gen:assets` | Rebuild the demo SVG artwork in `public/demo/` |
| `npm run gen:sitemap` | Rebuild `public/sitemap.xml` and `robots.txt` |

---

## Environment variables

### Frontend — `.env.local` (shipped to the browser)

Only these three. Everything here is public by design; the anon key is safe
to expose **because** every table has row level security.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SITE_URL=http://localhost:5173
```

> The Razorpay key is deliberately **not** here. `create-payment` returns it
> with the order, so rotating keys never needs a frontend redeploy.

### Backend — Supabase Edge Function secrets (never in the repo)

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxx \
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxx \
  RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx \
  RAZORPAYX_ACCOUNT_NUMBER=2323230000000000 \
  RESEND_API_KEY=re_xxxxxxxx \
  EMAIL_FROM="House of Collabs <hello@yourdomain.com>" \
  EMAIL_PROVIDER=resend \
  SITE_URL=https://yourdomain.com \
  ALLOWED_ORIGINS=https://yourdomain.com \
  NOTIFICATION_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected into Edge Functions automatically — don't set them yourself.

| Secret | Used by | Notes |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | create-payment, verify-payment, webhook | Also returned to the browser for Checkout |
| `RAZORPAY_KEY_SECRET` | create-payment, verify-payment, process-payout | **Never** leaves the server |
| `RAZORPAY_WEBHOOK_SECRET` | razorpay-webhook | HMAC verification of every webhook |
| `RAZORPAYX_ACCOUNT_NUMBER` | process-payout | Source account for payouts |
| `RESEND_API_KEY` / `EMAIL_FROM` | send-notification | Omit and set `EMAIL_PROVIDER=console` to log instead |
| `NOTIFICATION_WEBHOOK_SECRET` | send-notification | Shared secret for the DB→function webhook |
| `ALLOWED_ORIGINS` | all | CORS allow-list; `*` only for local work |

**Never commit real secrets.** `.env.local` is git-ignored; Edge Function
secrets live only in Supabase.

---

## Database

24 ordered migrations in `supabase/migrations/`. 01–15 build the schema; 16–24
are follow-ups applied after the first deploy:

| # | File | Contents |
| --- | --- | --- |
| 01 | `extensions_schemas_enums` | extensions, the `private` schema, every enum |
| 02 | `core_tables` | profiles, admin_users, platform_settings, taxonomies |
| 03 | `workflow_tables` | creators, brands, services, orders, payments, audit_logs |
| 04 | `private_helpers` | `SECURITY DEFINER` helpers used by RLS and RPCs |
| 05 | `catalog_triggers` | slugs, search vectors, denormalised rollups, profile audit |
| 06 | `order_workflow` | the order state machine and its RPCs |
| 07 | `messaging_notifications` | conversations, messages, notifications |
| 08 | `payments_earnings_payouts` | payments, refunds, earnings, payout requests |
| 09 | `onboarding_search_analytics` | completion checklist, search, analytics |
| 10 | `admin` | every `admin_*` RPC, all behind `private.require_admin()` |
| 11 | `rls_policies` | RLS enabled + policies on every user-facing table |
| 12 | `grants` | table and **column-level** grants |
| 13 | `storage` | buckets and `storage.objects` policies |
| 14 | `realtime_cron_webhooks` | publication, scheduled jobs, DB webhooks |
| 15 | `reference_data` | categories, creator types, platform settings |
| 16 | `rebrand_house_of_collab` | support contact, cron job names, `HOC-` order prefix |
| 17 | `brand_slug_default` | makes `brands.brand_slug` trigger-owned, not client-required |
| 18 | `house_of_collabs_spelling` | corrects the product name to its plural form |
| 19 | `admin_people_and_revenue` | `admin_people_stats`, `admin_list_people`, `admin_revenue_summary` |
| 20 | `email_delivery_and_preferences` | per-category email opt-outs, `email_deliveries`, retry queue, welcome/onboarding triggers |
| 21 | `grant_email_preferences` | column-level UPDATE grant for the new preference columns |
| 22 | `admin_email_stats` | counters behind the admin email log |
| 23 | `lock_down_email_worker_rpcs` | revokes the inherited PUBLIC grant on the queue RPCs and guards them |
| 24 | `enable_pg_net_for_email` | installs pg_net so the trigger can call the function |

```bash
supabase db reset                       # local: re-run everything + seed
supabase link --project-ref YOUR_REF    # cloud
supabase db push                        # cloud: apply migrations
```

### The order state machine

Orders move through 17 statuses. Clients have **no `UPDATE` privilege on
`public.orders`** — every change goes through an RPC
(`accept_order`, `submit_deliverables`, `approve_order`, …) which calls
`private.transition_order()`. A `BEFORE UPDATE` trigger checks the move against
the `order_status_transitions` table and rejects anything not allowed for that
actor. Illegal transitions are impossible, whatever the client sends.

```
draft → payment_pending → order_placed → creator_pending → accepted
      → in_progress → delivered → approved → completed

delivered → revision_requested → revision_submitted → delivered   (loop)
any stage → cancelled → refunded
```

Physical-product orders branch after `accepted` through `awaiting_shipment` →
`shipped` → `received` before work starts.

---

## Storage buckets

| Bucket | Public | Limit | Holds |
| --- | --- | --- | --- |
| `avatars` | yes | 5 MB | profile photos |
| `creator-portfolio` | yes | 50 MB | portfolio images and video |
| `brand-assets` | yes | 10 MB | brand logos, brief voice notes |
| `brief-attachments` | **no** | 25 MB | brief documents |
| `order-deliverables` | **no** | 50 MB | delivered work |
| `message-attachments` | **no** | 25 MB | chat attachments |

Private buckets are readable only through short-lived **signed URLs**, and only
by the order's two parties plus admins — enforced by policies on
`storage.objects`, not by the app. Size and MIME type are enforced by the
bucket; ownership is enforced by the policy; the first path segment must match
the owning record's id.

---

## Edge Functions

`supabase/functions/` — each has `handler.ts` (testable) and `index.ts`
(`Deno.serve`). Shared code lives in `_shared/`.

| Function | Auth | Purpose |
| --- | --- | --- |
| `create-payment` | user JWT | Creates the Razorpay order; returns `key_id` + order id |
| `verify-payment` | user JWT | Verifies the checkout signature, then marks the order paid |
| `razorpay-webhook` | HMAC | Idempotent source of truth for captures, failures, refunds |
| `request-payout` | user JWT | Validates balance and opens a payout request |
| `process-payout` | admin JWT | Sends a RazorpayX payout with an idempotency key |
| `admin-order-action` | admin JWT | Admin-side order transitions, refunds, cancellations |
| `send-notification` | shared secret · admin JWT | DB webhook → email; also the retry worker and the admin test send |
| `smart-search` | anon | Parses natural-language search into filters |
| `sitemap` | anon | Streams `sitemap-creators.xml` from published creators |

```bash
supabase functions deploy                      # all
supabase functions deploy verify-payment       # one
deno check supabase/functions/**/*.ts          # type-check locally
```

---

## Auth setup

Email/password works out of the box. For Google:

1. Google Cloud Console → **APIs & Services → Credentials → OAuth client ID
   (Web application)**.
2. Authorised redirect URI:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google**: paste the
   client ID and secret.
4. **Authentication → URL Configuration**: set Site URL to your domain and add
   `/auth/callback` and `/reset-password` as redirect URLs.

Auth settings live in `supabase/config.toml` and are applied with
`supabase config push`, so the dashboard isn't the source of truth — a later
push will overwrite dashboard edits.

> **Email confirmation is currently off** (`[auth.email] enable_confirmations`),
> because Supabase's shared SMTP allows only ~2 messages/hour and that makes
> testing signups painful. Before real users: set it back to `true`, configure a
> custom SMTP sender under `[auth.email.smtp]`, and `supabase config push`.

Roles are never trusted from the client. `profiles.role` is set once at signup
(or by `set_initial_role()`), and admin rights come **only** from a row in
`public.admin_users` — there is no way to self-promote through the API.

To grant admin:

```sql
select private.grant_admin('someone@yourdomain.com');
```

---

## Razorpay setup

1. Create an account and grab **Key ID / Key Secret** from *Settings → API Keys*
   (test mode first).
2. Set the secrets (see [Environment variables](#environment-variables)).
3. Add a webhook at *Settings → Webhooks*:
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`
   - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `refund.processed`,
     `payout.processed`, `payout.failed`, `payout.reversed`
4. For payouts, enable **RazorpayX** and set `RAZORPAYX_ACCOUNT_NUMBER`.

**An order is never marked paid from the browser.** The client's verify call
re-computes the HMAC server-side, and the webhook independently confirms the
capture — whichever arrives first wins, and `webhook_events` makes replays
harmless.

---

## Email notifications

Every transactional email starts as a row in `notifications`. Nothing in the
React app sends mail, and no provider key exists in the browser bundle.

```
business event (order, payment, payout, profile review, signup, …)
  └─ private.notify(...)            →  notifications INSERT
       └─ trigger dispatch_notification_email()
            ├─ private.wants_email(user, type)   ← preference check, in SQL
            ├─ INSERT email_deliveries           ← durable log, written first
            └─ net.http_post → send-notification ← best effort
                 └─ provider.send() → record_email_result(sent | failed)
                                             │
  pg_cron every 5 min → drain_email_queue() ─┘  retries failures with backoff
```

The `email_deliveries` insert happens **before** the HTTP call, and
`notification_id` is unique — so a replayed webhook can't double-send, and a
provider outage can't lose an email or roll back the order that caused it.

### Categories and what users can turn off

`private.email_category()` maps each notification type to one category, and
`private.wants_email()` is the only thing that decides whether an email is
queued. Users control the five optional categories in **Settings → Security**.

| Category | Column | Default | Examples |
| --- | --- | --- | --- |
| `critical` | *(none — cannot be disabled)* | always on | `payment_failed`, `payout_failed`, `refund_processed`, `account_suspended`, `order_cancelled`, `order_expired` |
| `orders` | `email_orders` | on | `order_new`, `content_delivered`, `revision_requested`, `order_approved`, `shipment_update`, `review_received` |
| `payments` | `email_payments` | on | `payment_received`, `earnings_available`, `payout_requested`, `payout_processed` |
| `campaigns` | `email_campaigns` | on | `brief_received` |
| `account` | `email_account` | on | `welcome`, `onboarding_completed`, `profile_approved`, `creator_verified` |
| `marketing` | `email_marketing` | **off** | `announcement` |

`email_notifications` is the master switch for the five optional categories.
Critical mail ignores it — losing a failed-payout notice because of a
preference toggle would cost someone money.

In-app-only notification types are logged as `skipped`
and never emailed, because a chat thread would mean an email per reply.

### Required setup

Two independent things have to be true before mail actually goes out. The
**Email log** page in the admin panel says which one is missing.

**1. The database must be able to call the function** — `pg_net` (installed by
migration 24) plus two Vault secrets. Add them in *Dashboard → Project
Settings → Vault*, or:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('<same value as NOTIFICATION_WEBHOOK_SECRET>', 'notification_webhook_secret');
```

Without these the trigger still logs every delivery; nothing sends until an
admin presses **Retry queued**.

**2. The function must have a real provider:**

```bash
supabase secrets set EMAIL_PROVIDER=resend RESEND_API_KEY=re_xxx \
  EMAIL_FROM="House of Collabs <hello@yourdomain.com>" \
  SITE_URL=https://yourdomain.com
```

With `EMAIL_PROVIDER` unset the function runs in console mode: it logs each
message and records it as **Skipped — logged only, no provider**, never as
`sent`. Adding a provider later does not retro-send those rows.

Adding another provider means one class in
`supabase/functions/_shared/email.ts`; nothing else changes.

### Templates

`supabase/functions/_shared/email-templates.ts` holds the subject, inbox
preheader and button label for ~35 notification types. The database owns the
copy (title, message, link); this file owns the framing. A type that isn't
listed still emails, using the notification's own title — so adding an event
needs no change here.

### Testing it

| What | How |
| --- | --- |
| Provider connectivity | Admin → **Email log** → *Send test to me* |
| The whole pipeline | Sign up a new account — `welcome` then `onboarding_completed` should appear in the log within seconds |
| Preferences are honoured | Turn off *Order updates*, place an order, confirm no `order_new` row is queued |
| Critical mail ignores opt-outs | Turn **everything** off, then trigger `payment_failed` — it is still queued |
| Retry and backoff | Set `RESEND_API_KEY` to a bad value, send, watch `attempts` climb with a growing `next_attempt_at` |
| Idempotency | Replay the same webhook payload — `email_deliveries` still has exactly one row |

---

## Demo data

`supabase/seed.sql` is generated, not hand-written: `scripts/generate-seed.mjs`
drives the **real RPCs** as each user, then backdates the timelines. So the
seeded orders, earnings and payouts are internally consistent — they could only
have been produced by legal state transitions.

Contents: 35 creators (32 published), 10 brands, 91 services, 214 add-ons,
135 portfolio items, 38 orders across 11 statuses, 35 conversations,
289 messages, 31 reviews, 23 earnings, 3 payouts, 16 briefs, 868 audit entries.

Every demo account is seeded with a random password nobody knows, including
whoever ran the seed. That is deliberate: this file is committed, and a
committed password is a published one. Set your own after a reset with the SQL
in [Getting started](#getting-started), against your local database.

Never run this seed against a hosted project. It is local fixture data, and the
accounts it creates are not meant to exist anywhere real.

The 150 SVGs in `public/demo/` are generated by `npm run gen:assets` — original
artwork, no third-party images.

```bash
npm run gen:seed     # rewrite seed.sql
npm run gen:assets   # rewrite public/demo/
supabase db reset    # apply
```

---

## Testing

```bash
npm test                                  # Vitest unit tests
npm run typecheck                         # tsc -b
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:test
```

`supabase/tests/*.test.sql` are the important ones. They impersonate real users
exactly the way PostgREST does (`request.jwt.claims` + `SET LOCAL ROLE
authenticated`) and assert that:

- a brand cannot read another brand's orders, briefs or wishlists;
- a creator cannot see a draft brief or its attachments;
- prices, fees and payouts are computed by the database, not the caller;
- illegal order transitions raise, and legal ones update the timeline;
- a late `payment.failed` cannot override a capture;
- refunds, cancellations and the cron jobs behave.

Each file runs in a transaction and rolls back, and they pass against both an
empty and a seeded database.

### Manual end-to-end check

Brand signup → onboarding → search → creator profile → checkout →
Razorpay test card `4111 1111 1111 1111` → creator accepts → submits work
for review → brand approves → earning appears → payout requested → admin
processes it.

---

## Deploying

### Backend

```bash
supabase link --project-ref YOUR_REF
supabase db push
supabase functions deploy
supabase secrets set ...   # see above
```

Then, in the dashboard: configure Google OAuth, set the Site URL, and add the
Razorpay webhook.

### Frontend — Vercel

Always build with `npm run build:site`, never a bare `vite build`. The wrapper
(`scripts/build-site.mjs`) regenerates the sitemap — it goes stale as creators
are published — and strips any `localhost` value of `VITE_SITE_URL`. Vite reads
`.env.local` in every mode, so a plain production build otherwise bakes
`http://localhost:5173` into the canonical and OpenGraph URLs.

**Connected to Git** — nothing to do; `vercel.json` sets the build command, the
SPA rewrites, the cache headers and the `/sitemap-creators.xml` proxy to the
`sitemap` Edge Function. The wrapper picks up Vercel's own
`VERCEL_PROJECT_PRODUCTION_URL` (or `VERCEL_URL` on previews), which arrive as
bare hostnames and are given a scheme. Set two environment variables in
Vercel → Settings → Environment Variables:

```
VITE_SUPABASE_URL        https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY   sb_publishable_…   (or the legacy anon JWT)
```

**Building locally** — pass the site URL so the sitemap is absolute:

```bash
SITE_URL=https://your-site.com npm run build:site
```

Without `SITE_URL` the app still works — canonical links fall back to
`window.location.origin` — but `sitemap.xml` and `robots.txt` keep the default
domain.

### After the first deploy — point Supabase at the domain

Auth redirect URLs are built from the browser's origin, and Supabase rejects any
origin that isn't allow-listed, so **password reset and email confirmation stay
broken until this is done**:

1. Add the domain to `supabase/config.toml` (`site_url` and
   `additional_redirect_urls`, including `/auth/callback` and `/reset-password`),
   then `supabase config push`.
2. Lock down Edge Function CORS, which currently falls back to `*`:

```bash
supabase secrets set SITE_URL=https://your-site.com ALLOWED_ORIGINS=https://your-site.com,https://www.your-site.com
```

---

## Project layout

```
src/
  components/    ui/ primitives · shared/ · admin/ brand/ creator-studio/ …
  contexts/      auth-context
  hooks/         TanStack Query hooks
  lib/           supabase client, query keys, errors, formatting, utils
  pages/         public/ auth/ brand/ creator/ admin/ shared/
  routes/        router + guards
  schemas/       Zod schemas
  services/      the ONLY modules that call Supabase
  styles/        design tokens + utilities
  types/         generated database types + app types
supabase/
  migrations/    15 ordered SQL migrations
  functions/     9 Edge Functions + _shared
  tests/         SQL integration tests
  seed.sql       generated demo data
scripts/         seed / assets / sitemap generators, SQL test runner
docs/            frontend conventions
```

Rules that keep this honest: **only `src/services/*` may call Supabase**, pages
use services through TanStack Query, and no screen computes money or status
itself. See [`docs/frontend-conventions.md`](docs/frontend-conventions.md) and
[`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Security model

- **RLS on every user-facing table.** The anon key grants nothing on its own.
- **Roles are server-side.** `profiles.role` is set once; admin comes only from
  `admin_users`. Nothing the client sends about its own role is believed.
- **Column-level grants.** `payments.signature` and
  `payout_methods.bank_account_number` are not selectable by `authenticated` at
  all — not hidden in the UI, ungranted in Postgres.
- **Helpers are hardened.** Every `SECURITY DEFINER` function sets
  `search_path = ''` and lives in the `private` schema.
- **Money is server-only.** Prices, fees and balances are computed in SQL;
  payment state comes from a verified signature and a signed webhook.
- **Route guards are a convenience.** Removing one in devtools reveals nothing,
  because the database refuses the query.
- **Everything is audited.** `audit_logs` is append-only and admin-readable.

---

## Known limitations

- **Razorpay runs in test mode.** Live keys need a KYC-approved account;
  RazorpayX payouts additionally need a funded account, so payouts have been
  exercised against the sandbox only.
- **Email needs a sending domain.** The pipeline is wired end to end, but
  until `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` are set the function runs
  in console mode: deliveries are logged and marked *Skipped — logged only*,
  never *Sent*. Resend requires a verified sending domain.
- **Smart Search is a deterministic parser**, not an LLM. It maps phrases to
  filters (city, budget, delivery, niche) with no API key. The function is
  structured so a provider can be added behind `SMART_SEARCH_PROVIDER`.
- **No automated browser tests.** Coverage is SQL integration tests plus unit
  tests; the UI flows were verified by hand.
- **Refunds are single-step.** Partial refunds are supported by the schema and
  admin UI, but there is no instalment/partial-capture flow.
- **Search is Postgres full-text** (`tsvector` + trigram). Excellent to a few
  hundred thousand creators; beyond that, move to a dedicated search service.
- **`supabase start` needs Docker.** Without it, develop against a cloud
  project instead.
