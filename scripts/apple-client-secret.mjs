#!/usr/bin/env node
// Makes the "Secret Key (for OAuth)" that Supabase → Authentication → Sign In /
// Providers → Apple needs. Apple doesn't issue one: it's a token signed with
// the Sign in with Apple key (.p8), and Apple refuses any that lasts longer
// than 6 months, so this has to be re-run and pasted again before it expires
// (both Supabase projects). Runs locally, so the .p8 never leaves this Mac.
//
//   node scripts/apple-client-secret.mjs --team 7PJVZUNCCU --key-id ABC123DEFG \
//     --client com.houseofcollabs.web --p8 ~/Downloads/AuthKey_ABC123DEFG.p8
//
// Prints the token and the date it stops working. See docs/architecture.md.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((pair) => {
      const [key, ...rest] = pair.trim().split(/\s+/)
      return [key, rest.join(' ')]
    }),
)
const { team, 'key-id': keyId, client, p8 } = args
if (!team || !keyId || !client || !p8) {
  console.error('Usage: node scripts/apple-client-secret.mjs --team <Team ID> --key-id <Key ID> --client <Services ID> --p8 <path to AuthKey_….p8>')
  process.exit(1)
}

const key = crypto.createPrivateKey(fs.readFileSync(p8.replace(/^~(?=\/)/, os.homedir()), 'utf8'))
// A day short of Apple's 6-month limit, so clock drift can't make Apple reject it.
const now = Math.floor(Date.now() / 1000)
const exp = now + 179 * 24 * 3600

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
const unsigned = `${b64url({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${b64url({ iss: team, iat: now, exp, aud: 'https://appleid.apple.com', sub: client })}`
// JWTs need the raw r‖s signature, not the DER form Node produces by default.
const signature = crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')

console.log(`\n${unsigned}.${signature}\n`)
console.log(`Paste the line above into Supabase → Authentication → Sign In / Providers → Apple → Secret Key (for OAuth).`)
console.log(`It stops working on ${new Date(exp * 1000).toDateString()}: run this again before then, for staging and production.\n`)
