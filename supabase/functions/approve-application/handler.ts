// POST { applicationId } — admin approves an application and the applicant gets
// a real account they can log in to.
//
// Creating an auth user needs the service role, which is why this lives in a
// function rather than the browser. Everything that touches application data is
// done by `provision_application_account`, which re-checks the caller is an
// admin, so the service role is only ever used for the auth step.
//
// Idempotent: approving twice reuses the existing account instead of failing.
import { handler, HttpError, json, must, readJson } from '../_shared/http.ts'
import { adminClient, requireAdmin, userClient } from '../_shared/supabase.ts'
import { getEmailProvider, renderNotificationEmail } from '../_shared/email.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

type Application = {
  id: string
  role: 'brand' | 'creator'
  status: string
  full_name: string
  email: string
  phone: string | null
  profile_id: string | null
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  await requireAdmin(req)

  const { applicationId } = await readJson<{ applicationId?: string }>(req)
  if (!applicationId) throw new HttpError(400, 'Which application?', 'BAD_REQUEST')

  const db = adminClient()
  // The RPCs below run `private.require_admin()`, which reads `auth.uid()` —
  // null under the service role. They're called with the admin's own JWT so the
  // guard passes and `reviewed_by` records who actually decided. The service
  // role is used only for the auth-user work that genuinely needs a key.
  const asAdmin = userClient(req)
  const { data: app } = await db
    .from('applications')
    .select('id, role, status, full_name, email, phone, profile_id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) throw new HttpError(404, 'Application not found.', 'NOT_FOUND')

  const application = app as Application
  const email = application.email.trim().toLowerCase()

  // Reuse an account if this email already has one — someone may have applied
  // twice, or been set up by hand before.
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  let profileId = existing?.id ?? null
  let created = false

  if (!profileId) {
    // `email_confirm` so they aren't stuck behind a verification step; they set
    // a password through the recovery link below. The role is whitelisted by
    // `private.handle_new_user`, which builds the profile from this metadata.
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: application.full_name, role: application.role },
    })
    if (error || !data.user) throw new HttpError(422, error?.message ?? 'Could not create the account.', 'CREATE_FAILED')
    profileId = data.user.id
    created = true
  }

  // Role, onboarding flag, workspace row and the details they already gave us.
  must(await asAdmin.rpc('provision_application_account', { p_application_id: application.id, p_profile_id: profileId }))

  // A recovery link doubles as "set your password" for a brand-new account.
  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${SITE_URL}/reset-password` },
  })
  if (linkError) throw new HttpError(500, linkError.message, 'LINK_FAILED')
  const inviteLink = link?.properties?.action_link ?? null

  // Try to email it. A failure here must not undo the account — the admin can
  // still copy the link from the response.
  let emailed = false
  let emailError: string | null = null
  const provider = getEmailProvider()
  if (inviteLink && provider.name !== 'console') {
    try {
      const message = renderNotificationEmail({
        name: application.full_name,
        title: 'You’re in — set your password',
        message: `Your ${application.role} account on House of Collabs is ready. Set a password and you can sign in straight away.`,
        actionUrl: inviteLink,
        siteUrl: SITE_URL,
        cta: 'Set my password',
        preheader: 'Your application was approved.',
        subject: 'Your House of Collabs account is ready',
        prefsPath: application.role === 'brand' ? '/brand/settings/security' : '/creator/settings/security',
      })
      await provider.send({ to: email, ...message })
      emailed = true
      await asAdmin.rpc('mark_application_invited', { p_application_id: application.id })
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e)
    }
  } else if (inviteLink) {
    // Console mode: nothing left the server, so say so rather than imply it did.
    emailError = 'No email provider configured — send the link yourself.'
  }

  return json({
    ok: true,
    profileId,
    created,
    role: application.role,
    emailed,
    emailError,
    inviteLink,
  })
})
