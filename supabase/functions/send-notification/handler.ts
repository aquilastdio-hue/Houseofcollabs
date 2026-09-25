// Email dispatch for notifications.
//
//  1. Database webhook (pg_net trigger on notifications INSERT):
//     header `x-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET>`, body { type, table, record }
//  2. Retry worker (cron / manual): body { retry: true, limit? } with the same
//     secret — drains email_deliveries rows left pending or failed.
//  3. Admin test: Authorization: Bearer <admin JWT>, body { test: true }
//
// Every attempt is recorded in public.email_deliveries. A provider failure is
// never thrown back at the webhook: the row is marked failed with a backoff and
// the worker picks it up, so a temporary outage can't lose an email — and can't
// roll back the business transaction that produced it.
import { handler, HttpError, json, readJson } from '../_shared/http.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'
import { safeEqual } from '../_shared/razorpay.ts'
import { getEmailProvider, renderNotificationEmail } from '../_shared/email.ts'
import { templateFor } from '../_shared/email-templates.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? ''

type NotificationRecord = {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  action_url: string | null
  emailed_at: string | null
}

type Delivery = {
  id: string
  notification_id: string | null
  user_id: string | null
  recipient_email: string
  email_type: string
  subject: string | null
}

type Db = ReturnType<typeof adminClient>

/** Settings → Security lives under each role's own area. */
const prefsPathFor = (role?: string | null) => (role === 'brand' ? '/brand/settings/security' : role === 'admin' ? '/admin/settings' : '/creator/settings/security')

/**
 * Builds the message for one delivery row. Both the real send and the admin
 * preview go through here, so what an admin previews is byte-for-byte what the
 * recipient gets.
 */
async function render(db: Db, row: Delivery) {
  // The notification carries the human copy; the template carries the framing.
  const spec = templateFor(row.email_type)
  const { data: n } = row.notification_id
    ? await db.from('notifications').select('title, message, action_url').eq('id', row.notification_id).maybeSingle()
    : { data: null }
  const { data: profile } = row.user_id
    ? await db.from('profiles').select('full_name, role').eq('id', row.user_id).maybeSingle()
    : { data: null }

  const title = n?.title ?? row.subject ?? 'House of Collabs'
  return renderNotificationEmail({
    name: profile?.full_name ?? null,
    title,
    message: n?.message ?? null,
    actionUrl: n?.action_url ?? null,
    siteUrl: SITE_URL,
    cta: spec.cta ?? null,
    preheader: spec.preheader ?? null,
    subject: (spec.subject || '{title}').replace('{title}', title),
    prefsPath: prefsPathFor(profile?.role),
  })
}

/** Renders and sends one delivery row, recording the outcome either way. */
async function deliver(db: Db, row: Delivery) {
  const spec = templateFor(row.email_type)
  if (spec.inAppOnly) {
    await db.rpc('record_email_result', { p_id: row.id, p_status: 'skipped', p_provider: 'in-app' })
    return { skipped: 'in_app_only' }
  }

  const email = await render(db, row)
  const provider = getEmailProvider()
  try {
    const sent = await provider.send({ to: row.recipient_email, ...email })
    // The console provider only writes a log line. Recording that as `sent`
    // would claim a delivery that never happened, so it is recorded as
    // `skipped` instead — terminal, so it is not retried forever either.
    const delivered = provider.name !== 'console'
    await db.rpc('record_email_result', {
      p_id: row.id,
      p_status: delivered ? 'sent' : 'skipped',
      p_provider: provider.name,
      p_message_id: sent.id ?? null,
    })
    if (delivered && row.notification_id) {
      await db.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', row.notification_id)
    }
    return { sent: delivered, provider: provider.name, id: sent.id ?? null }
  } catch (e) {
    // Recorded, not thrown: the worker will try again with backoff.
    await db.rpc('record_email_result', {
      p_id: row.id,
      p_status: 'failed',
      p_provider: provider.name,
      p_error: e instanceof Error ? e.message : String(e),
    })
    return { sent: false, error: 'delivery_failed' }
  }
}

/** Webhook path: find the delivery the trigger queued for this notification. */
async function dispatch(record: NotificationRecord) {
  const db = adminClient()
  if (record.emailed_at) return { skipped: 'already_emailed' }

  const { data: row } = await db
    .from('email_deliveries')
    .select('id, notification_id, user_id, recipient_email, email_type, subject')
    .eq('notification_id', record.id)
    .maybeSingle()

  // No row means the trigger decided not to email (preferences, inactive account).
  if (!row) return { skipped: 'not_queued' }

  await db.from('email_deliveries').update({ status: 'processing', attempts: 1 }).eq('id', row.id).eq('status', 'pending')
  return await deliver(db, row as Delivery)
}

/** Worker path: drain whatever is pending or awaiting retry. */
async function drain(limit: number) {
  const db = adminClient()
  const { data: rows, error } = await db.rpc('claim_pending_emails', { p_limit: limit })
  if (error) throw new HttpError(500, error.message, 'CLAIM_FAILED')
  const results = []
  for (const row of (rows ?? []) as Delivery[]) results.push(await deliver(db, row))
  return { claimed: results.length, sent: results.filter((r) => 'sent' in r && r.sent).length, results }
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const secret = req.headers.get('x-webhook-secret')

  if (secret !== null) {
    if (!WEBHOOK_SECRET || !safeEqual(secret, WEBHOOK_SECRET)) throw new HttpError(401, 'Invalid webhook secret.', 'UNAUTHORIZED')
    const body = await readJson<{ table?: string; record?: NotificationRecord; retry?: boolean; limit?: number }>(req)
    if (body.retry) return json(await drain(Math.min(Math.max(body.limit ?? 20, 1), 100)))
    if (body.table !== 'notifications' || !body.record?.id) throw new HttpError(400, 'Unexpected payload.', 'BAD_REQUEST')
    return json(await dispatch(body.record))
  }

  const admin = await requireAdmin(req)
  const body = await readJson<{ test?: boolean; retry?: boolean; limit?: number; preview?: string }>(req)
  if (body.retry) return json(await drain(Math.min(Math.max(body.limit ?? 20, 1), 100)))

  // Preview renders an existing delivery and returns it. It sends nothing, and
  // it cannot address a recipient the database did not already choose.
  if (body.preview) {
    const db = adminClient()
    const { data: row } = await db
      .from('email_deliveries')
      .select('id, notification_id, user_id, recipient_email, email_type, subject')
      .eq('id', body.preview)
      .maybeSingle()
    if (!row) throw new HttpError(404, 'That email is not in the log.', 'NOT_FOUND')
    const spec = templateFor((row as Delivery).email_type)
    if (spec.inAppOnly) return json({ to: row.recipient_email, inAppOnly: true, subject: null, html: null, text: null })
    const email = await render(db, row as Delivery)
    return json({ to: row.recipient_email, inAppOnly: false, ...email })
  }

  if (!body.test) throw new HttpError(400, 'Unsupported request.', 'BAD_REQUEST')

  const { data: profile } = await adminClient().from('profiles').select('email, full_name, role').eq('id', admin.id).maybeSingle()
  if (!profile?.email) throw new HttpError(422, 'Your account has no email address.', 'NO_EMAIL')
  const provider = getEmailProvider()
  const email = renderNotificationEmail({
    name: profile.full_name,
    title: 'Test email from House of Collabs',
    message: `Your email provider (${provider.name}) is working. If this says "console", set EMAIL_PROVIDER=resend and RESEND_API_KEY to send real mail.`,
    siteUrl: SITE_URL,
    actionUrl: '/admin/notifications',
    cta: 'Open admin',
    preheader: 'Provider connectivity check.',
    prefsPath: prefsPathFor(profile.role),
  })
  await provider.send({ to: profile.email, ...email })
  return json({ ok: true, provider: provider.name })
})
