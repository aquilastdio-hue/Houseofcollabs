// POST { id_token } → records that the holder proved control of a phone number.
//
// Firebase Phone Auth runs in the browser, which means "I verified my number"
// arriving from a client is worth nothing on its own. This checks the signed
// token Firebase issued — signature, issuer, audience, expiry — and only then
// records the result, with the service role, into a table the browser cannot
// reach.
//
// Deliberately unauthenticated: the applicant has no account yet. The token is
// the credential.
//
// The number recorded is the one *inside the token*, never one the caller sends
// alongside it. Firebase verified that number; anything else is a claim. If
// someone verifies one number and then types another into the form, the
// application's insert guard finds no matching verification and stops them,
// which is the behaviour we want.
import { handler, HttpError, json, must, readJson, requireString } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { firebaseConfigured, verifyFirebaseIdToken } from '../_shared/firebase.ts'

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  if (!firebaseConfigured()) {
    throw new HttpError(503, 'Phone verification is not set up yet. Please contact support.', 'FIREBASE_NOT_CONFIGURED')
  }

  const body = await readJson<Record<string, unknown>>(req)
  // Firebase ID tokens run to roughly 1 KB; the cap keeps a huge body from
  // reaching the parser at all.
  const idToken = requireString(body.id_token, 'id_token', 4096)

  const claims = await verifyFirebaseIdToken(idToken)

  // A valid token for an *anonymous* or email sign-in proves nothing about a
  // phone, so the sign-in provider is checked as well as the claim.
  if (claims.firebase?.sign_in_provider !== 'phone' || !claims.phone_number) {
    throw new HttpError(400, 'That verification was not a phone verification.', 'NOT_A_PHONE_VERIFICATION')
  }

  const result = must(
    await adminClient().rpc('record_phone_verification', {
      p_phone: claims.phone_number,
      p_provider_uid: claims.sub,
      p_provider: 'firebase',
    }),
  )

  return json(result)
})
