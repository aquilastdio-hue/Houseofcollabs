# Staging: the live testing site

A full copy of House of Collabs that runs for real (real sign-ups, real
Razorpay payments, real payouts by bank transfer) without touching
houseofcollabs.com, its database or the `main` branch.

| | Production | Staging |
| --- | --- | --- |
| URL | www.houseofcollabs.com | `staging.houseofcollabs.com` (or the free `…vercel.app` branch URL) |
| Git branch | `main` | `staging` |
| Supabase project | `sxndiarrdfqiepnnczmy` | its own project (ref: `<STAGING_REF>`) |
| Data | real | starts empty: sign up fresh creators and brands |
| Marker | none | "Testing site" badge on every page, `noindex` everywhere, `robots.txt` blocks all crawlers |

The code is identical; `VITE_ENVIRONMENT=staging` (a Vercel variable for the
`staging` branch only) switches on the badge and the crawler block
(`src/config/site.ts`, `src/components/layout/environment-badge.tsx`,
`scripts/build-site.mjs`).

---

## 1. Owner: one-time setup

1. **Supabase**: create a project (e.g. `hoc-staging`, region near
   `ap-northeast-2` like production). The org already has two projects, so
   this may need a paid plan. Send the project ref.
2. **Vercel** → the House of Collabs project → Settings:
   - **Domains**: add `staging.houseofcollabs.com`, assign it to the Git
     branch `staging`, and add the CNAME it shows at your DNS provider.
   - **Environment Variables** → *Preview*, branch `staging` only:
     `VITE_SUPABASE_URL` = `https://<STAGING_REF>.supabase.co`,
     `VITE_SUPABASE_ANON_KEY` = staging anon / publishable key,
     `VITE_ENVIRONMENT` = `staging`,
     `SITE_URL` = `https://staging.houseofcollabs.com`,
     and the `VITE_FIREBASE_*` values if phone OTP is used.
3. **Secrets for the staging project** (Supabase → Edge Functions → Secrets),
   values only you have: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (live keys,
   for real-money tests), `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`, `BREVO_API_KEY`, `APIFY_TOKEN` (optional),
   `FIREBASE_PROJECT_ID` (optional).
4. **Razorpay** (live mode, and test mode if testing with test accounts):
   add a second webhook: `https://<STAGING_REF>.supabase.co/functions/v1/razorpay-webhook`,
   same secret, events `payment.captured`, `payment.failed`, `order.paid`,
   `refund.processed`, `refund.failed`. Production's webhook stays as it is;
   each one ignores orders it doesn't know.
5. **Google sign-in** (if used on staging): add
   `https://<STAGING_REF>.supabase.co/auth/v1/callback` to the OAuth client's
   redirect URIs and paste the client id/secret into the staging project's
   Auth → Providers → Google. **Firebase**: add `staging.houseofcollabs.com`
   to Authorized domains.
6. Say **"push staging"**.

## 2. Agent: building the staging backend

The staging project is empty, so replaying every migration is safe there,
and only there. (On production `db push` is forbidden: see AGENTS.md rule 4.)

```bash
supabase link --project-ref <STAGING_REF>
supabase db push                                   # every migration, in order, on the empty project
supabase functions deploy --project-ref <STAGING_REF> --use-api   # all functions
supabase secrets set --project-ref <STAGING_REF> \
  SITE_URL=https://staging.houseofcollabs.com \
  ALLOWED_ORIGINS=https://staging.houseofcollabs.com \
  EMAIL_PROVIDER=brevo EMAIL_FROM="House of Collabs (staging) <…>" \
  NOTIFICATION_WEBHOOK_SECRET=<new random value>
supabase link --project-ref sxndiarrdfqiepnnczmy   # ← back to production right after
```

Then, in the staging project's SQL Editor (or `supabase db query` while linked):

```sql
select vault.create_secret('https://<STAGING_REF>.supabase.co', 'project_url');
select vault.create_secret('<same NOTIFICATION_WEBHOOK_SECRET>', 'notification_webhook_secret');
update public.platform_settings set value = 'true' where key = 'billing_v2_enabled';   -- test the new billing
-- after the owner signs in once:
select private.grant_admin('<owner email>');
```

And Auth → URL Configuration: Site URL `https://staging.houseofcollabs.com`,
redirect URLs `https://staging.houseofcollabs.com/**`.

Git: `staging` holds the website changes only (never the iOS/Android work,
AGENTS.md rule 2). Vercel builds it with `npm run build:site` like production.

## 3. The end-to-end test (real money, small amounts)

1. Sign up as a creator → approve the application in staging Admin → set a
   ₹10 service, tax details and UPI/bank details.
2. Sign up as a brand → order the ₹10 service → pay for real.
3. Creator delivers → brand approves → check invoices (brand and creator),
   TDS, the creator's commission invoice; pay it.
4. Admin → Payouts → Bank transfers: Prepare → download the sheet → transfer
   by bank → upload the sheet with the UTR → creator sees "Paid" and the
   settlement statement.
5. Admin → Billing & tax → For the accountant: Excel workbook + PDFs zip.
6. Refund a second small order and check the credit notes once Razorpay's
   `refund.processed` webhook arrives.

Keep the hold at 0 hours on staging (Admin → Settings → Payouts) to pay out
straight after approval.
