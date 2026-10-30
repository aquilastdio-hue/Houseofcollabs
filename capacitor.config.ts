import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The iOS and Android apps: the same React build as the website, served from
 * the app itself (`npm run build:app`), talking to the same Supabase project.
 */
const config: CapacitorConfig = {
  appId: 'com.houseofcollabs.app',
  appName: 'House of Collabs',
  webDir: 'dist',
  // The page colour, so nothing flashes white behind the status bar or on launch.
  backgroundColor: '#f8f7fa',
  // No pinch-zoom in the apps. (Tapping a small text field can't zoom either:
  // main.tsx caps the viewport scale inside the apps.)
  zoomEnabled: false,
  ios: {
    // Keep the page below the status bar and above the home indicator, so the
    // sticky headers never slide under the notch.
    contentInset: 'always',
  },
  plugins: {
    // Android 15+ draws apps edge to edge; this keeps the web view between the
    // status bar and the navigation bar, as iOS's content inset does.
    SystemBars: { insetsHandling: 'native' },
  },
}

export default config
