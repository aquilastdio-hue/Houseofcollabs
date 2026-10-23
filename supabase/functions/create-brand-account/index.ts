// POST { brandData } — self-serve brand signup: creates account and brand record instantly
//
// Unlike the admin approval flow, this function:
// 1. Creates the auth user with an invite email
// 2. Creates the profile with role='brand' and onboarding_completed=true
// 3. Creates the brand record with all submitted details
// 4. Returns immediately — no admin approval needed
//
// @ts-ignore - Deno types are available in Supabase edge functions
import { handler, HttpError, json, must, readJson } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'

// @ts-ignore - Deno is available in Supabase edge functions
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
// @ts-ignore - Deno is available in Supabase edge functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
// @ts-ignore - Deno is available in Supabase edge functions
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const SET_PASSWORD_URL = `${SITE_URL}/set-password`

type BrandData = {
  full_name: string
  email: string
  phone: string | null
  city: string | null
  brand_name: string
  website: string | null
  industry: string | null
  location: string | null
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  instagram_url: string | null
  logo_url: string | null
  looking_for: string | null
  categories: string[] | null
  creator_categories: string[] | null
  collaboration_types: string[] | null
  creator_location: string | null
  specific_cities: string[] | null
  budget_range: string | null
  verification?: {
    company_website?: string | null
    registration_doc_type?: string | null
    registration_doc_path?: string | null
    representative_id_path?: string | null
    linkedin_url?: string | null
    instagram_url?: string | null
    authorized?: boolean
  }
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')

  const data = await readJson<BrandData>(req)
  const email = data.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpError(422, 'Invalid email address', 'INVALID_EMAIL')
  }

  const db = adminClient()

  // Check if account already exists
  const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists', 'EMAIL_EXISTS')
  }

  // Create auth user with invite
  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: SET_PASSWORD_URL,
    data: { full_name: data.full_name, role: 'brand' },
  })

  if (inviteError) {
    console.error('create-brand: invite failed', inviteError.message)
    throw new HttpError(502, 'Could not create account', 'INVITE_FAILED')
  }

  const userId = inviteData.user?.id
  if (!userId) throw new HttpError(500, 'Could not create account', 'CREATE_FAILED')

  // Create profile
  await db.from('profiles').insert({
    id: userId,
    role: 'brand',
    full_name: data.full_name,
    email: email,
    phone: data.phone,
    avatar_url: data.logo_url,
    status: 'active',
    onboarding_completed: true,
  })

  // Create brand record
  await db.from('brands').insert({
    profile_id: userId,
    brand_name: data.brand_name,
    website_url: data.website,
    industry: data.industry,
    location: data.location,
    description: data.description,
    contact_email: data.contact_email || email,
    contact_phone: data.contact_phone || data.phone,
    instagram_url: data.instagram_url,
    brand_logo_url: data.logo_url,
  })

  return json({
    ok: true,
    userId,
    email,
    redirectTo: SET_PASSWORD_URL,
  })
})
