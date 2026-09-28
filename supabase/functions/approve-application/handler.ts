// POST { applicationId } — admin approves an application and the applicant gets
// a real account, already filled in with everything they sent us, plus an email
// inviting them to choose a password.
//
// Creating an auth user needs the service role, which is why this lives in a
// function rather than the browser. Everything that touches application data is
// done by `provision_application_account`, which re-checks the caller is an
// admin, so the service role is only ever used for the three jobs that
// genuinely need a key: making the account, sending the invite, and moving
// their uploads.
//
// ORDER MATTERS. The account is created and the invite sent *before* the RPC
// marks the application approved. If the account can't be made, this throws and
// the application stays exactly as it was — an application must never read as
// approved when the person behind it has no way in.
//
// IDEMPOTENT. Approving twice must not make a second account or a second
// invite. `inviteUserByEmail` only works for an address with no account, so an
// applicant who already has one (they signed in with Google first, or an admin
// already approved them) gets a password-reset email instead.
import { handler, HttpError, json, must, readJson } from '../_shared/http.ts'
import { adminClient, requireAdmin, userClient } from '../_shared/supabase.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

/** Where both emails land. The invite and the reset share one destination. */
const SET_PASSWORD_URL = `${SITE_URL}/set-password`

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

/** GoTrue says this a few different ways depending on version. */
const looksAlreadyRegistered = (msg: string) =>
  /already (been )?registered|already exists|email_exists|user already/i.test(msg)

/**
 * Copies one object out of the private `applications` bucket into a public one
 * and returns a URL a browser can load. Returns null rather than throwing: a
 * missing upload must not cost someone their account.
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

/**
 * Password-reset email for someone who already has an account. There is no
 * admin method that *sends* one, so this posts to the public recover endpoint —
 * which goes out through the same Supabase SMTP as the invite.
 */
async function sendPasswordReset(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(SET_PASSWORD_URL)}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) return null
    const body = await res.text()
    // Never let a mail failure reach the client verbatim.
    console.error('approve: reset email failed', res.status, body.slice(0, 300))
    return res.status === 429
      ? 'Too many emails sent to this address just now. Try again shortly.'
      : 'We could not send the email. Send them the link below instead.'
  } catch (e) {
    console.error('approve: reset email threw', e instanceof Error ? e.message : String(e))
    return 'We could not send the email. Send them the link below instead.'
  }
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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpError(422, 'That application has no usable email address.', 'INVALID_EMAIL')
  }

  // ----------------------------------------------------------------- account
  // An account for this address already? Then this is a re-approval, or they
  // signed in with Google before we got to them.
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  let profileId: string | null = existing?.id ?? null
  let created = false
  let invited = false
  let emailError: string | null = null

  if (!profileId) {
    // Creates the account AND sends Supabase's "Invite user" email, which
    // lands on /set-password. The role is whitelisted by
    // `private.handle_new_user`, which builds the profile from this metadata.
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: SET_PASSWORD_URL,
      data: { full_name: application.full_name, role: application.role },
    })

    if (error) {
      // Two very different failures wear the same shape here.
      if (looksAlreadyRegistered(error.message)) {
        // A race, or an account with no profile row. Find the user and carry on.
        const { data: list } = await db.auth.admin.listUsers()
        const found = list?.users?.find((u) => (u.email ?? '').toLowerCase() === email)
        if (!found) throw new HttpError(422, 'That email already has an account we cannot read.', 'ACCOUNT_CONFLICT')
        profileId = found.id
      } else {
        // Most likely SMTP. The invite is atomic enough that no account is left
        // behind, and crucially the application is NOT marked approved.
        console.error('approve: invite failed', error.message)
        throw new HttpError(
          502,
          'The account could not be invited — check the SMTP settings in Supabase. The application has been left as it was.',
          'INVITE_FAILED',
        )
      }
    } else {
      profileId = data.user?.id ?? null
      if (!profileId) throw new HttpError(422, 'Could not create the account.', 'CREATE_FAILED')
      created = true
      invited = true
    }
  }

  if (!profileId) throw new HttpError(500, 'Could not resolve the account.', 'NO_PROFILE')

  // Already had an account, so no invite was sent — offer a reset instead, so
  // they still get a way to set a password.
  if (!invited) emailError = await sendPasswordReset(email)

  // --------------------------------------------------------------- uploads
  // Everything they uploaded, moved somewhere a browser can load it. Keyed by
  // profile id so re-approving lands on the same paths instead of piling up.
  const p = (application.profile ?? {}) as Record<string, unknown>
  const media: Record<string, unknown> = {}

  if (application.role === 'creator') {
    // Copied in parallel. Each file is an independent download-then-upload, and
    // doing them one after another made approving a creator with a full
    // portfolio take seconds longer than it needed to, on top of the wait for
    // the invite email. Order is preserved because the results come back
    // indexed, and `publish` returns null rather than throwing, so one bad
    // upload cannot reject the batch.
    const [photoUrls, videoUrls] = await Promise.all([
      Promise.all(
        asList(p.photos).map((path, i) => publish(db, path, 'creator-portfolio', `${profileId}/photo-${i + 1}.${extOf(path)}`)),
      ).then((urls) => urls.filter((u): u is string => !!u)),
      Promise.all(
        asList(p.videos).map((path, i) => publish(db, path, 'creator-portfolio', `${profileId}/video-${i + 1}.${extOf(path)}`)),
      ).then((urls) => urls.filter((u): u is string => !!u)),
    ])
    media.photos = photoUrls
    media.videos = videoUrls
    if (photoUrls[0]) media.avatar_url = photoUrls[0]
    if (videoUrls[0]) media.intro_video_url = videoUrls[0]
  } else if (application.image_path) {
    const url = await publish(db, application.image_path, 'brand-assets', `${profileId}/logo.${extOf(application.image_path)}`)
    if (url) {
      media.logo_url = url
      media.avatar_url = url
    }
  }

  // Role, onboarding flag, workspace row, and the whole form. Only now — with
  // an account that exists — does the application become approved.
  must(await asAdmin.rpc('provision_application_account', {
    p_application_id: application.id,
    p_profile_id: profileId,
    p_media: media,
  }))

  // A link the admin can pass on by hand, generated only when the email didn't
  // go out. No point handing out a one-time link nobody needs.
  let inviteLink: string | null = null
  if (emailError) {
    const { data: link } = await db.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: SET_PASSWORD_URL },
    })
    inviteLink = link?.properties?.action_link ?? null
  }

  if (!emailError) {
    // `rpc()` returns a thenable, not a real Promise — it has no `.catch`.
    // Bookkeeping only, so a failure here must not fail the approval.
    try {
      await asAdmin.rpc('mark_application_invited', { p_application_id: application.id })
    } catch (e) {
      console.error('approve: mark_application_invited failed', e instanceof Error ? e.message : String(e))
    }
  }

  return json({
    ok: true,
    profileId,
    created,
    invited,
    alreadyHadAccount: !created,
    role: application.role,
    // Where the emailed link lands. Derived from the SITE_URL secret, so it is
    // the one place an environment mix-up shows up — surfaced rather than
    // guessed at. A public URL; nothing secret about it.
    redirectTo: SET_PASSWORD_URL,
    emailed: !emailError,
    emailError,
    inviteLink,
    copied: {
      photos: asList(media.photos).length,
      videos: asList(media.videos).length,
      logo: media.logo_url ? 1 : 0,
    },
  })
})
