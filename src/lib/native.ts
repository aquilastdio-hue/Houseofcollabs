import { Capacitor } from '@capacitor/core'
import { site } from '@/config/site'

/**
 * True inside the iOS and Android apps (Capacitor), false on the website.
 *
 * The apps are the signed-in product only: they open on the login page with
 * the two ways to create an account, never the marketing site.
 */
export const isNativeApp = Capacitor.isNativePlatform()

/**
 * Where links in emails and redirects should point. Inside the apps the page
 * origin is `capacitor://localhost` (iOS) or `https://localhost` (Android),
 * which an email can't open, so they use the real site instead.
 */
export function publicOrigin() {
  return isNativeApp && site.url ? site.url : window.location.origin
}
