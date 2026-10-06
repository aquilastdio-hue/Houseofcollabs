// Verifies a Firebase ID token without the Admin SDK.
//
// Phone verification happens entirely in the browser, so the only thing worth
// trusting is the signed token Firebase hands back. These helpers check that
// signature against Google's published keys and every claim that matters, so a
// forged or borrowed token cannot pass.
import { HttpError } from './http.ts'

const PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? ''
/** JWK form, so Web Crypto can import the keys directly — the x509 endpoint
 *  would need certificate parsing that Deno has no built-in for. */
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export const firebaseConfigured = () => Boolean(PROJECT_ID)
export const firebaseProjectId = PROJECT_ID

type Jwk = JsonWebKey & { kid: string }

let cache: { keys: Jwk[]; until: number } | null = null

async function keys(force = false): Promise<Jwk[]> {
  if (!force && cache && cache.until > Date.now()) return cache.keys
  const res = await fetch(JWKS_URL)
  if (!res.ok) throw new HttpError(503, 'Could not reach the verification service.', 'JWKS_UNAVAILABLE')
  const body = (await res.json()) as { keys: Jwk[] }
  // Google rotates these; honour the cache header rather than guessing.
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  cache = { keys: body.keys, until: Date.now() + Math.max(60, maxAge) * 1000 }
  return cache.keys
}

function b64url(part: string): Uint8Array {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4))
  const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const json = <T,>(part: string): T => JSON.parse(new TextDecoder().decode(b64url(part))) as T

export type FirebaseClaims = {
  sub: string
  aud: string
  iss: string
  exp: number
  iat: number
  auth_time?: number
  phone_number?: string
  firebase?: { sign_in_provider?: string }
}

/**
 * Returns the token's claims, or throws. Checks, in order: shape, algorithm,
 * a known signing key, the signature itself, then issuer, audience and expiry.
 *
 * Audience matters more than it looks — a token from *any* Firebase project is
 * signed by the same Google key, so without pinning `aud` to this project
 * anyone could verify a number against a project of their own and present the
 * result here.
 */
export async function verifyFirebaseIdToken(token: string): Promise<FirebaseClaims> {
  if (!PROJECT_ID) throw new HttpError(503, 'Phone verification is not configured.', 'FIREBASE_NOT_CONFIGURED')

  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(400, 'That verification could not be read.', 'MALFORMED_TOKEN')
  const [rawHeader, rawPayload, rawSignature] = parts

  let header: { alg?: string; kid?: string }
  try {
    header = json<{ alg?: string; kid?: string }>(rawHeader)
  } catch {
    throw new HttpError(400, 'That verification could not be read.', 'MALFORMED_TOKEN')
  }
  // Firebase signs ID tokens with RS256. Anything else — `none` above all — is
  // an attempt to skip the signature.
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'That verification is not valid.', 'BAD_ALGORITHM')

  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
  const signature = b64url(rawSignature)

  // A key we have never seen may just mean Google rotated; refetch once.
  let jwk = (await keys()).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await keys(true)).find((k) => k.kid === header.kid)
  if (!jwk) throw new HttpError(401, 'That verification is not valid.', 'UNKNOWN_KEY')

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed))) {
    throw new HttpError(401, 'That verification is not valid.', 'BAD_SIGNATURE')
  }

  const claims = json<FirebaseClaims>(rawPayload)
  const now = Math.floor(Date.now() / 1000)
  const skew = 60 // clock drift between Google and this isolate

  if (claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new HttpError(401, 'That verification is not valid.', 'BAD_ISSUER')
  }
  if (claims.aud !== PROJECT_ID) throw new HttpError(401, 'That verification is not valid.', 'BAD_AUDIENCE')
  if (!claims.sub) throw new HttpError(401, 'That verification is not valid.', 'NO_SUBJECT')
  if (claims.exp + skew < now) throw new HttpError(401, 'That code has expired. Please request a new one.', 'TOKEN_EXPIRED')
  if (claims.iat - skew > now) throw new HttpError(401, 'That verification is not valid.', 'TOKEN_FROM_THE_FUTURE')

  return claims
}
