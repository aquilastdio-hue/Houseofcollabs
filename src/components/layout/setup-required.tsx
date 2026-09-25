import { Logo } from '@/components/shared/logo'

/** Shown when the public Supabase env vars are missing (instead of crashing). */
export function SetupRequired() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-xl rounded-panel border border-line bg-surface p-8 shadow-card">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-semibold">Connect Supabase to get started</h1>
        <p className="mt-2 text-muted">
          Create a <code className="rounded bg-subtle px-1.5 py-0.5 text-sm">.env.local</code> file in the project root with your Supabase
          project’s public values, then restart the dev server.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-card bg-night p-4 text-sm text-white">
          {`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
VITE_RAZORPAY_KEY_ID=rzp_test_...`}
        </pre>
        <p className="mt-4 text-sm text-muted">See README.md → “Local development” for migrations, seed data and Edge Function secrets.</p>
      </div>
    </main>
  )
}
