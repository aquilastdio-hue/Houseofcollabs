import { invokeFunction } from '@/lib/supabase/functions'
import { toAppError } from '@/lib/errors'

/**
 * The browser half of "Connect Instagram" (Instagram API with Instagram Login).
 *
 * 1. `startInstagramConnect` asks the `instagram-connect` Edge Function for an
 *    authorize URL. The function issues a one-time state and only accepts
 *    redirect URIs on its allow-list; this tab remembers the state too.
 * 2. Instagram sends the creator back to /instagram/callback with a code.
 * 3. `finishInstagramConnect` checks the state matches what this tab started,
 *    then has the function exchange the code. The token stays on the server;
 *    the browser gets a connection id and the public profile details.
 *
 * Nothing here can mark an account connected without the server agreeing.
 */

export const INSTAGRAM_CALLBACK_PATH = '/instagram/callback'

/**
 * How the sign-up shows "Connect Instagram", from the public platform setting
 * `instagram_connect`:
 *   hidden    no button; page 2 works exactly as before (the default, until
 *             Meta approves App Review and real creators can connect)
 *   optional  button shown; creators may continue without it
 *   required  creators can't leave page 2 without connecting
 *
 * `?instagram_test=1` on the sign-up shows the button (as optional) to whoever
 * opens that link, even while it's hidden — so the team can test with Meta
 * tester accounts on the live site without real creators seeing anything.
 * `?instagram_test=required` previews the required version the same way, and
 * `?instagram_test=0` turns testing back off. Anything unrecognised, or a
 * setting that hasn't loaded, counts as hidden.
 */
export type InstagramConnectMode = 'hidden' | 'optional' | 'required'
type TestMode = Exclude<InstagramConnectMode, 'hidden'>
const TEST_FLAG_KEY = 'hoc:instagram-test'
const RANK: Record<InstagramConnectMode, number> = { hidden: 0, optional: 1, required: 2 }

/** The live setting, raised (never lowered) by a tester's link. */
export function resolveInstagramConnectMode(setting: unknown, testing: TestMode | null): InstagramConnectMode {
  const mode: InstagramConnectMode = setting === 'optional' || setting === 'required' ? setting : 'hidden'
  return testing && RANK[testing] > RANK[mode] ? testing : mode
}

/** Reads `?instagram_test=` and remembers it for this tab, so it survives the trip to Instagram and back. */
export function instagramTestMode(search: string): TestMode | null {
  const flag = new URLSearchParams(search).get('instagram_test')
  const parse = (v: string | null): TestMode | null => (v === 'required' ? 'required' : v === '1' || v === 'optional' ? 'optional' : null)
  try {
    if (flag === '0') sessionStorage.removeItem(TEST_FLAG_KEY)
    else if (parse(flag)) sessionStorage.setItem(TEST_FLAG_KEY, parse(flag)!)
    return parse(sessionStorage.getItem(TEST_FLAG_KEY))
  } catch {
    return parse(flag)
  }
}

const PENDING_KEY = 'hoc:instagram-oauth'
const RESULT_KEY = 'hoc:instagram-connect-result'

export type InstagramConnection = {
  connection_id: string
  username: string
  name: string | null
  account_type: string | null
  profile_url: string
  profile_picture_url: string | null
  followers_count: number | null
  media_count: number | null
  insights_granted: boolean
  media_read: boolean
  stats: { media_analysed: number; avg_views: number | null; views_sample: number; engagement_rate: number | null }
}

export type InstagramConnectResult =
  | { status: 'connected'; connection: InstagramConnection }
  | { status: 'error'; message: string; cancelled?: boolean }

type Pending = { state: string; returnTo: string; at: number }

export function instagramRedirectUri() {
  return `${window.location.origin}${INSTAGRAM_CALLBACK_PATH}`
}

function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Blocked storage: the callback then reports a state mismatch, which is the honest outcome.
  }
}

/** Sends this tab to Instagram. Resolves only if something goes wrong before the redirect. */
export async function startInstagramConnect(returnTo: string) {
  const { authorize_url, state } = await invokeFunction<{ authorize_url: string; state: string }>('instagram-connect', {
    action: 'start',
    redirect_uri: instagramRedirectUri(),
  })
  write(sessionStorage, PENDING_KEY, { state, returnTo, at: Date.now() } satisfies Pending)
  window.location.assign(authorize_url)
}

const CANCELLED = 'You cancelled connecting Instagram. You can try again, or fill in your details yourself.'

/** Runs on /instagram/callback. Always settles to a result; never throws. */
export async function finishInstagramConnect(params: URLSearchParams): Promise<{ result: InstagramConnectResult; returnTo: string }> {
  const pending = read<Pending>(sessionStorage, PENDING_KEY)
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
  const returnTo = pending?.returnTo && pending.returnTo.startsWith('/') ? pending.returnTo : '/get-started?role=creator'

  // Instagram's own cancel/deny: error=access_denied&error_reason=user_denied.
  const error = params.get('error')
  if (error) {
    const cancelled = error === 'access_denied'
    return { returnTo, result: { status: 'error', cancelled, message: cancelled ? CANCELLED : 'Instagram couldn’t complete the connection. Please try again.' } }
  }

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) {
    return { returnTo, result: { status: 'error', message: 'Instagram didn’t send the details needed to connect. Please try again.' } }
  }
  if (!pending || pending.state !== state) {
    return {
      returnTo,
      result: { status: 'error', message: 'This Instagram sign-in didn’t start in this browser tab. Please press Connect Instagram again.' },
    }
  }

  try {
    const connection = await invokeFunction<InstagramConnection>('instagram-connect', { action: 'exchange', code: code.replace(/#_$/, ''), state })
    return { returnTo, result: { status: 'connected', connection } }
  } catch (e) {
    return { returnTo, result: { status: 'error', message: toAppError(e).message } }
  }
}

export function saveConnectResult(result: InstagramConnectResult) {
  write(sessionStorage, RESULT_KEY, result)
}

/** Reads the result the callback left behind, once. */
export function takeConnectResult(): InstagramConnectResult | null {
  const result = read<InstagramConnectResult>(sessionStorage, RESULT_KEY)
  try {
    sessionStorage.removeItem(RESULT_KEY)
  } catch {
    // ignore
  }
  return result
}
