# Scaling and quality review

An honest assessment of the platform as of **3 Nov 2026**: what's well built,
what breaks first as it grows, and what to do about it, in priority order.
Numbers come from the live database (`pg_stat_statements`, storage tables,
row counts) and from reading the code.

**Today**: 276 accounts, 271 published creators, 2 brands, 5 orders (all
tests), a 42 MB database and 15.8 GB of files. The database itself is nowhere
near any limit. What will hurt first is **storage and bandwidth, email
quotas, realtime, admin pages that load everything, and manual operations**.

---

## 1. Overall verdict

The core is **well engineered for a product this young**. Security and money
handling are better than most early marketplaces: RLS on all 50 tables, every
price computed in SQL, payments verified twice (signature + provider fetch +
idempotent webhook), an order state machine enforced by triggers, and an
append-only audit log. The code is cleanly layered (page → hook → service →
Supabase) and unusually well commented.

The weak spots are **process and operations**, not the core code: no
staging, no CI, migrations applied by hand and not tracked, no error
monitoring, and several jobs (payouts, refunds after auto-cancel, WhatsApp,
approvals) that depend on a person.

| Area | Grade | Why |
| --- | --- | --- |
| Security model | A− | RLS everywhere, definer functions hardened, money server-side. Gaps: anonymous uploads, unauthenticated brand sign-up, no CSP |
| Payments | A− | HMAC + fetch + idempotent webhook; test mode per account. Refunds and payouts are manual |
| Code structure | A | Clear layers, typed, central errors and query keys, route code-splitting |
| Database design | B+ | Normalised, indexed, denormalised search columns kept by triggers. Search does per-row fuzzy work |
| Deploy process | C | No staging, no CI, hand-run migrations with history drift |
| Observability | D | No error tracking or product analytics; logs only in the Supabase dashboard |
| Tests | C+ | 212 unit tests on pure logic; SQL tests are stale; no end-to-end tests |
| Operations at scale | C | Many manual steps (see §5) |

---

## 2. What breaks first, and when

| # | Risk | Evidence today | Starts to hurt at | Fix |
| --- | --- | --- | --- | --- |
| 1 | **Email quota** | 274 emails sent on 3 Nov (one campaign). Brevo's free plan allows 300 a day | the next campaign to more than ~300 people, or any daily campaign | Move to a paid Brevo plan; set Brevo as Supabase Auth's custom SMTP so invites and password resets aren't capped by Supabase's own mailer |
| 2 | **Storage cost and bandwidth** | 15.8 GB stored: `applications` 9.0 GB, `creator-portfolio` 6.5 GB. Videos are served straight from Supabase Storage | ~100 GB stored, or heavy storefront traffic (egress is billed per GB) | Delete or archive application files after approval (they're copied, so stored twice, about 7 GB); purge the 1.7 GB of orphaned uploads; put a CDN / video host (Cloudflare R2 + CDN, Bunny or Mux) in front of portfolio video; serve resized images |
| 3 | **Anonymous upload abuse** | Policy "Anyone can upload an application file" lets the anon key upload unlimited 20 MB files | the first bot that finds it | Upload through a signed upload URL issued by an Edge Function that rate-limits by IP / email; nightly job deleting unreferenced files older than 24 h |
| 4 | **Realtime load** | Realtime's change polling is the #1 DB consumer: 1.3M calls, ~2.1 hours of DB time, with almost no users | a few hundred users online at once (Supabase plans cap concurrent realtime connections) | Use Realtime *Broadcast* from triggers (`realtime.send`) instead of `postgres_changes`, or poll unread counts every 60 s |
| 5 | **Admin pages load every row** | `fetchAllPages` fetches all pages in parallel: audit logs (3,910 rows → 40 requests per open), email log (1,501), people, creators | a few thousand rows per list (slow page, browser memory) | Server-side pagination + filters (the RPCs already take `page` / `pageSize`); add a retention policy for `audit_logs`, `email_deliveries`, `creator_profile_views`, `notifications` |
| 6 | **User lookup bug in sign-up functions** | `approve-application` calls `auth.admin.listUsers()` with no paging, which returns only the first 50 users; there are 283. `create-brand-account` / `admin-import-accounts` stop after 4,000 | **now**, for an applicant whose email already has an auth user but no profile | Look the user up by email in `auth.users` through a service-role RPC (or `profiles.email`) instead of listing users |
| 7 | **Search cost** | `search_creators` runs `word_similarity` + `levenshtein` on every creator's name, plus `count(*) over ()`; creator-list RPCs average 30–70 ms at 271 creators | ~10–20k creators, or many concurrent searches | Run the fuzzy match only when the fast path (tsvector / trigram index) finds too few; drop the exact total for "24+ results"; cache `get_public_stats` (3,036 calls, 37 ms each) |
| 8 | **`touch_last_seen` writes** | Every open tab updates its profile row every 2 minutes (9,579 calls so far) | ~5k concurrent users ≈ 40 row updates per second plus WAL | Update only if older than 10 min (already cheap in SQL), or keep presence out of the DB |
| 9 | **Instagram data** | Apify scraping, weekly, priced per profile; 10 creators currently fail (private, restricted or not found) | cost grows linearly; Instagram can block scrapers at any time | Budget alert in Apify; long term, Instagram's official API with creator login |
| 10 | **Manual money operations** | Payouts by hand (RazorpayX not configured); auto-cancelled paid orders only *flag* `refund_required` | dozens of orders a week | Admin "needs refund" queue/alert; RazorpayX payouts once volume justifies it |

---

## 3. Process risks (fix before growth, not after)

1. **Migration history drift.** Live has 24 migrations that
   `supabase_migrations.schema_migrations` doesn't know about
   (`20261028000014` → `20261103000037`), and `…0028_push_notifications` is
   live but uncommitted. One `supabase db push` would replay them. **Fix
   (5 minutes):** `supabase migration repair --status applied <versions> --linked`,
   then always apply with the CLI, or keep repairing after each SQL Editor run.
2. **No staging.** Every push to `main` is production, and local dev uses the
   production database. Add a free Supabase branch or a second project for
   staging, and Vercel preview deployments pointed at it.
3. **No CI.** Vercel's build runs `tsc` (so type errors block a deploy), but
   tests never run automatically. Add a GitHub Action: `npm ci && npx tsc -b && npm test`.
4. **No error monitoring.** Browser and Edge Function errors are invisible
   unless someone reports them. Add Sentry (free tier) to the SPA and the
   Edge Functions' `handler()` wrapper.
5. **Config drift.** `verify-phone` and `admin-account-action` run live with
   `verify_jwt = true` but aren't listed in `supabase/config.toml`, unlike the
   others. List them explicitly so the next deploy doesn't change behaviour.
6. **Stale tests and docs.** `supabase/tests/02_*` still covers disputes
   (removed in `…0058`). Fix or delete it; keep `AGENTS.md` and `docs/` current.
7. **Backups.** Confirm the Supabase plan's daily backups and point-in-time
   recovery before real money flows. Storage files are *not* covered by
   database backups.

---

## 4. Security

| Issue | Severity | Fix |
| --- | --- | --- |
| Anonymous unlimited uploads to `applications` | High (cost/abuse) | §2 item 3 |
| `create-brand-account` is unauthenticated with no captcha or rate limit: anyone can create brand accounts for any email (sending invite emails), and turn an existing role-less profile into a brand | Medium | Add Cloudflare Turnstile / hCaptcha and a per-IP/email rate limit; refuse existing profiles instead of upserting them |
| No Content-Security-Policy header | Low | Add a CSP in `vercel.json` (allow Supabase, Razorpay, Firebase, fonts) |
| `auth.enable_signup = true` while sign-up is done by invite: anyone can call `auth.signUp` with the anon key and make a role-less user (7 such users exist) | Low | Disable public sign-ups if Google sign-in for approved emails still works without it (test first) |
| Brevo API key rotation still pending (owner's reminder) | Low | Rotate in Brevo, update the `BREVO_API_KEY` secret |

---

## 5. Product and operations

- **Two brand sign-up paths.** `/onboarding?role=brand` makes an account
  instantly (`create-brand-account`). Most site links go to
  `/get-started?role=brand`, which files an application for review. Pick one
  and remove the other.
- **Placeholder contact data is live.** `platform_settings.support_email` is
  `support@houseofcollabs.example`, `site.partnershipsEmail` is a `.example`
  address, the social links in `src/config/site.ts` point at bare
  instagram.com / facebook.com, and the address reads "Cannaught Place".
- **WhatsApp is manual** (one `wa.me` tab per person). Past a few hundred
  creators, use the WhatsApp Business API through a provider (Gupshup, Interakt
  or AiSensy) with the templates in `docs/whatsapp-templates.md`.
- **Admin review is manual for every creator.** That's intended, but plan
  for it: the admin rating, the discover flag and the applications queue are
  already there; add saved filters and bulk actions when volume grows.
- **Fees**: brand fee 15% + creator commission 15% (the platform keeps ~26% of
  what the brand pays). Make sure the checkout and the policy pages say so.

---

## 6. Roadmap

### Now (this week, small and high value)
1. Repair the migration history (§3.1).
2. Fix the `listUsers` lookups in `approve-application`, `create-brand-account`
   and `admin-import-accounts` (§2.6).
3. Upgrade Brevo; set it as Supabase Auth SMTP (§2.1).
4. Replace placeholder support email, social links and address (§5).
5. Add `verify-phone` and `admin-account-action` to `config.toml` (§3.5).

### Next (this month)
6. Lock down anonymous uploads and add a captcha to the brand sign-up (§4).
7. Storage clean-up: orphaned application files, post-approval duplicates (§2.2).
8. Sentry + a GitHub Action running tsc and tests (§3.3–3.4).
9. Staging project + Vercel previews (§3.2).
10. Admin "refund required" alert; one brand sign-up path (§2.10, §5).

### Later (as traffic grows)
11. CDN / video hosting for portfolio media; image resizing.
12. Server-side pagination for admin lists; retention for logs.
13. Realtime → Broadcast or polling.
14. Search fast path + cached public stats.
15. WhatsApp Business API; RazorpayX payouts; Instagram official API.
16. End-to-end tests (Playwright) for sign-up, checkout and payout.
