// POST { applicationId } — admin approves an application and the applicant gets
// a real account, already filled in with everything they sent us.
//
// Creating an auth user needs the service role, which is why this lives in a
// function rather than the browser. Everything that touches application data is
// done by `provision_application_account`, which re-checks the caller is an
// admin, so the service role is only ever used for the two jobs that genuinely
// need a key: making the account, and moving their uploads.
//
// The uploads are the reason this function still exists rather than a plain
// RPC. They land in the private `applications` bucket, which is right while the
// application is being reviewed and wrong afterwards — a storefront needs URLs
// a browser can load. So the bytes are copied into the public buckets first and
// the resulting URLs are handed to the RPC, which writes them alongside the
// rest of the form in one transaction.
//
// Idempotent: approving twice reuses the account and re-uses the copied files.
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
  image_path: string | null
  video_path: string | null
  profile: Record<string, unknown> | null
}

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []

/**
 * Copies one object out of the private `applications` bucket into a public one
 * and returns a URL a browser can load. Returns null rather than throwing: a
 * missing or unreadable upload must not cost someone their account.
 */
async function publish(
  db: ReturnType<typeof adminClient>,
  sourcePath: string,
  bucket: string,
  destPath: string,
): Promise<string | null> {
  try {
    const { data: file, error } = await db.storage.from('applications').download(sourcePath)
    if (error || !file) {
      console.error('approve: could not read upload', sourcePath, error?.message)
      return null
    }
    // `upsert` so re-approving overwrites rather than erroring on a name clash.
    const { error: upErr } = await db.storage.from(bucket).upload(destPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })
    if (upErr) {
      console.error('approve: could not publish upload', destPath, upErr.message)
      return null
    }
    return db.storage.from(bucket).getPublicUrl(destPath).data.publicUrl
  } catch (e) {
    console.error('approve: upload copy threw', sourcePath, e instanceof Error ? e.message : String(e))
    return null
  }
}

const extOf = (p: string) => {
  const m = /\.([a-z0-9]+)$/i.exec(p)
  return m ? m[1].toLowerCase() : 'bin'
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  await requireAdmin(req)

  const { applicationId } = await readJson<{ applicationId?: string }>(req)
  if (!applicationId) throw new HttpError(400, 'Which application?', 'BAD_REQUEST')

  const db = adminClient()
  // The RPC below runs `private.require_admin()`, which reads `auth.uid()` —
  // null under the service role. It's called with the admin's own JWT so the
  // guard passes and `reviewed_by` records who actually decided.
  const asAdmin = userClient(req)

  const { data: app } = await db
    .from('applications')
    .select('id, role, status, full_name, email, phone, profile_id, image_path, video_path, profile')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) throw new HttpError(404, 'Application not found.', 'NOT_FOUND')

  const application = app as Application
  const email = application.email.trim().toLowerCase()

  // Reuse an account if this email already has one — they may have signed in
  // with Google before being approved, or applied twice.
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  let profileId = existing?.id ?? null
  let created = false

  if (!profileId) {
    // `email_confirm` so they aren't stuck behind a verification step, and so
    // that signing in with Google on the same address links to this account
    // rather than colliding with it. They set a password through the recovery
    // link below, or skip it entirely and use Google. The role is whitelisted
    // by `private.handle_new_user`, which builds the profile from this metadata.
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: application.full_name, role: application.role },
    })
    if (error || !data.user) throw new HttpError(422, error?.message ?? 'Could not create the account.', 'CREATE_FAILED')
    profileId = data.user.id
    created = true
  }

  // --------------------------------------------------------------- uploads
  // Everything they uploaded, moved somewhere a browser can load it. Keyed by
  // profile id so re-approving lands on the same paths instead of piling up.
  const p = (application.profile ?? {}) as Record<string, unknown>
  const photos = asList(p.photos)
  const videos = asList(p.videos)
  const media: Record<string, unknown> = {}

  if (application.role === 'creator') {
    const photoUrls: string[] = []
    for (const [i, path] of photos.entries()) {
      const url = await publish(db, path, 'creator-portfolio', `${profileId}/photo-${i + 1}.${extOf(path)}`)
      if (url) photoUrls.push(url)
    }
    const videoUrls: string[] = []
    for (const [i, path] of videos.entries()) {
      const url = await publish(db, path, 'creator-portfolio', `${profileId}/video-${i + 1}.${extOf(path)}`)
      if (url) videoUrls.push(url)
    }
    media.photos = photoUrls
    media.videos = videoUrls
    // The first photo doubles as their profile picture, the first video as the
    // storefront intro — both are what the form put first.
    if (photoUrls[0]) media.avatar_url = photoUrls[0]
    if (videoUrls[0]) media.intro_video_url = videoUrls[0]
  } else if (application.image_path) {
    const url = await publish(db, application.image_path, 'brand-assets', `${profileId}/logo.${extOf(application.image_path)}`)
    if (url) {
      media.logo_url = url
      media.avatar_url = url
    }
  }

  // Role, onboarding flag, workspace row, and the whole form.
  must(await asAdmin.rpc('provision_application_account', {
    p_application_id: application.id,
    p_profile_id: profileId,
    p_media: media,
  }))

  // A recovery link doubles as "set your password" for a brand-new account.
  // Signing in with Google works without it; this is for anyone who'd rather
  // use a password, and for addresses that aren't Google accounts.
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
        title: 'You’re in — your account is ready',
        message: `Your ${application.role} account on House of Collabs is set up, with everything you sent us already on your profile. Sign in with Google, or set a password using the button below.`,
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
    emailError = 'No email provider configured — send them the link yourself.'
  }

  return json({
    ok: true,
    profileId,
    created,
    role: application.role,
    emailed,
    emailError,
    inviteLink,
    copied: {
      photos: asList(media.photos).length,
      videos: asList(media.videos).length,
      logo: media.logo_url ? 1 : 0,
    },
  })
})
