// POST { brandData } — self-serve brand signup: creates account and brand record instantly
//
// Unlike the admin approval flow, this function:
// 1. Creates the auth user with an invite email (or password-reset if they already exist)
// 2. Creates the profile with role='brand' and onboarding_completed=true
// 3. Creates the brand record with all submitted details
// 4. Returns immediately — no admin approval needed
import { handler, HttpError, json, must, readJson } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const SET_PASSWORD_URL = `${SITE_URL}/set-password`

/** Same words as the sign-up form and the database rule (migration 0024). */
const ONE_KIND_PER_EMAIL =
  'This email is already registered on House of Collabs. One email can be a creator or a brand, not both, so please use a different email, or sign in if it’s yours.'

type BrandData = {
  full_name: string
  email: string
  phone?: string | null
  city?: string | null
  brand_name: string
  website?: string | null
  industry?: string | null
  location?: string | null
  description?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  instagram_url?: string | null
  logo_url?: string | null
  looking_for?: string | null
  categories?: string[] | null
  creator_categories?: string[] | null
  collaboration_types?: string[] | null
  creator_location?: string | null
  specific_cities?: string[] | null
  budget_range?: string | null
  contact_person?: string | null
  designation?: string | null
  registration_doc_type?: string | null
  registration_doc_path?: string | null
  representative_id_path?: string | null
  linkedin_url?: string | null
  authorized?: boolean | null
}

// The brands table only takes full links (and a phone in a fixed shape), while
// the form accepts "yourbrand.com" or "@yourbrand". Same rules as the admin
// approval flow, so both paths save the same thing.
export function websiteUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v || /\s/.test(v)) return null
  if (/^https?:\/\//i.test(v)) return v
  // A handle, or a bare word, isn't a website.
  return v.startsWith('@') || !v.includes('.') ? null : `https://${v}`
}

export function instagramUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v || /\s/.test(v)) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^(www\.)?instagram\.com\//i.test(v)) return `https://${v}`
  const handle = v.replace(/^@/, '').replace(/\/+$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null
}

export function phoneOrNull(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  return /^\+?[0-9 ()-]{7,20}$/.test(v) ? v : null
}

/** The logo is uploaded to the private applications bucket; brands need a public copy. */
async function publishLogo(db: ReturnType<typeof adminClient>, path: string | null | undefined, userId: string) {
  const v = (path ?? '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  try {
    const { data: file, error } = await db.storage.from('applications').download(v)
    if (error || !file) {
      console.error('create-brand: could not read logo', v, error?.message)
      return null
    }
    const ext = (v.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const dest = `${userId}/logo.${ext}`
    const { error: upErr } = await db.storage.from('brand-assets').upload(dest, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })
    if (upErr) {
      console.error('create-brand: could not publish logo', dest, upErr.message)
      return null
    }
    return db.storage.from('brand-assets').getPublicUrl(dest).data.publicUrl
  } catch (e) {
    console.error('create-brand: logo copy threw', e instanceof Error ? e.message : String(e))
    return null
  }
}

const looksAlreadyRegistered = (msg: string) =>
  /already (been )?registered|already exists|email_exists|user already/i.test(msg)

async function sendPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(SET_PASSWORD_URL)}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('create-brand: reset email failed', res.status, body.slice(0, 300))
    throw new HttpError(
      res.status === 429 ? 429 : 502,
      res.status === 429
        ? 'Too many emails sent to this address just now. Try again shortly.'
        : 'Could not send the password setup email. Please try again.',
      res.status === 429 ? 'RATE_LIMITED' : 'EMAIL_FAILED',
    )
  }
}

async function findAuthUserIdByEmail(
  db: ReturnType<typeof adminClient>,
  email: string,
): Promise<string | null> {
  // Paginate — listUsers alone is capped and can miss older accounts.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error('create-brand: listUsers failed', error.message)
      return null
    }
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (found) return found.id
    if (data.users.length < 200) break
  }
  return null
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')

  const data = await readJson<BrandData>(req)
  if (!data.email || typeof data.email !== 'string') {
    throw new HttpError(422, 'Email is required', 'INVALID_EMAIL')
  }
  if (!data.brand_name || typeof data.brand_name !== 'string') {
    throw new HttpError(422, 'Brand name is required', 'INVALID_BRAND_NAME')
  }

  const email = data.email.trim().toLowerCase()
  const fullName = (data.full_name || data.brand_name).trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpError(422, 'Invalid email address', 'INVALID_EMAIL')
  }

  const db = adminClient()

  // Already a brand account for this email?
  const { data: existingProfile } = await db
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile?.role === 'brand') {
    const { data: brand } = await db.from('brands').select('id').eq('profile_id', existingProfile.id).maybeSingle()
    if (brand) {
      throw new HttpError(409, 'An account with this email already exists', 'EMAIL_EXISTS')
    }
  } else if (existingProfile?.role) {
    // A creator's or admin's email: signing up as a brand must not turn their
    // account into a brand account. One email is a creator or a brand (0024).
    throw new HttpError(409, ONE_KIND_PER_EMAIL, 'EMAIL_HAS_ACCOUNT')
  }

  // Applied as a creator and still waiting? Same rule, before an account exists.
  const { data: creatorApplication } = await db
    .from('applications')
    .select('id')
    .eq('role', 'creator')
    .neq('status', 'rejected')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle()
  if (creatorApplication) throw new HttpError(409, ONE_KIND_PER_EMAIL, 'EMAIL_HAS_ACCOUNT')

  let userId = existingProfile?.id ?? null
  let invited = false

  if (!userId) {
    const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: SET_PASSWORD_URL,
      data: { full_name: fullName, role: 'brand' },
    })

    if (inviteError) {
      if (looksAlreadyRegistered(inviteError.message)) {
        userId = await findAuthUserIdByEmail(db, email)
        if (!userId) {
          throw new HttpError(422, 'That email already has an account we cannot read.', 'ACCOUNT_CONFLICT')
        }
        await sendPasswordReset(email)
      } else {
        console.error('create-brand: invite failed', inviteError.message)
        throw new HttpError(502, 'Could not create account', 'INVITE_FAILED')
      }
    } else {
      userId = inviteData.user?.id ?? null
      invited = true
      if (!userId) throw new HttpError(500, 'Could not create account', 'CREATE_FAILED')
    }
  } else {
    // Profile exists (e.g. null-role leftover) — send them a password link.
    await sendPasswordReset(email)
  }

  const logoUrl = await publishLogo(db, data.logo_url, userId)

  // Upsert profile as brand
  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: userId,
      role: 'brand',
      full_name: fullName,
      email,
      phone: phoneOrNull(data.phone),
      avatar_url: logoUrl,
      status: 'active',
      onboarding_completed: true,
    },
    { onConflict: 'id' },
  )
  if (profileError) {
    console.error('create-brand: profile upsert failed', profileError.message)
    throw new HttpError(500, 'Could not create profile', 'PROFILE_FAILED')
  }

  // Create brand if missing
  const { data: existingBrand } = await db.from('brands').select('id').eq('profile_id', userId).maybeSingle()
  if (!existingBrand) {
    must(
      await db.from('brands').insert({
        profile_id: userId,
        brand_name: data.brand_name.trim().slice(0, 80),
        website_url: websiteUrl(data.website),
        industry: data.industry ?? null,
        location: data.location ?? data.city ?? null,
        description: data.description ?? null,
        contact_email: data.contact_email || email,
        contact_phone: phoneOrNull(data.contact_phone || data.phone),
        instagram_url: instagramUrl(data.instagram_url),
        brand_logo_url: logoUrl,
        preferences: {
          contact_person: data.contact_person ?? null,
          designation: data.designation ?? null,
          creator_categories: data.creator_categories ?? null,
          collaboration_types: data.collaboration_types ?? null,
          creator_location: data.creator_location ?? null,
          specific_cities: data.specific_cities ?? null,
          budget_range: data.budget_range ?? null,
          registration_doc_type: data.registration_doc_type ?? null,
          registration_doc_path: data.registration_doc_path ?? null,
          representative_id_path: data.representative_id_path ?? null,
          linkedin_url: data.linkedin_url ?? null,
          authorized: data.authorized ?? null,
        },
      }),
    )
  }

  return json({
    ok: true,
    userId,
    email,
    invited,
    redirectTo: SET_PASSWORD_URL,
  })
})

Deno.serve(handle)
