import type { Auth } from 'firebase/auth'

/**
 * Firebase, loaded only when something actually needs it.
 *
 * Used for phone OTP. Supabase remains the identity system for the platform —
 * Firebase's job is to prove someone controls a mobile number, nothing more.
 *
 * Three deliberate differences from the snippet the Firebase console hands you:
 *
 *   1. The config comes from env vars rather than being pasted inline. These
 *      values are public — a Firebase web config ships in every client bundle
 *      and is not a secret; what protects the project is the Authorized domains
 *      list, the security rules and App Check. Keeping them in env still means
 *      dev and production can point at different projects, and swapping one
 *      doesn't need a code change.
 *
 *   2. No Analytics. The console's snippet calls `getAnalytics`, which pulls a
 *      second SDK in for something this project doesn't use and would put a
 *      consent obligation on a page that currently has none.
 *
 *   3. Everything is behind a dynamic import. `firebase/auth` is about a
 *      megabyte; loading it eagerly would put it in the bundle for every
 *      visitor, including the overwhelming majority who never see an OTP box.
 *      This way it is fetched the first time a code is actually sent.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/**
 * Whether OTP can run at all. Mirrors `razorpayConfigured()` on the server:
 * a missing key is a configuration state to show honestly, not a crash.
 */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

let authPromise: Promise<Auth> | null = null

/** Loads the Firebase SDK and returns its Auth instance, once per session. */
export function loadFirebaseAuth(): Promise<Auth> {
  if (!firebaseConfigured) {
    return Promise.reject(new Error('Phone verification is not configured yet.'))
  }
  authPromise ??= (async () => {
    const [{ initializeApp, getApp, getApps }, { getAuth }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ])
    // `getApps()` first: React strict mode mounts twice in development, and a
    // second `initializeApp` with the same name throws.
    const app = getApps().length ? getApp() : initializeApp(config as Required<typeof config>)
    return getAuth(app)
  })()
  return authPromise
}
