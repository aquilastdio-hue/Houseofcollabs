import * as React from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { CheckCircle2, Instagram } from 'lucide-react'
import { formatCompact } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import {
  instagramTestMode,
  resolveInstagramConnectMode,
  startInstagramConnect,
  takeConnectResult,
  type InstagramConnection,
} from '@/lib/instagram-connect'
import { usePublicSettings } from '@/hooks/use-catalog'
import type { CreatorApplicationValues } from '@/schemas/creator-application'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'

type Form = UseFormReturn<CreatorApplicationValues>

/**
 * Whether "Connect Instagram" is hidden, optional or required right now (see
 * `resolveInstagramConnectMode`). Hidden until the setting has loaded, so real
 * creators never see the button flash in.
 */
export function useInstagramConnectMode() {
  const settings = usePublicSettings()
  const [testing] = React.useState(() => instagramTestMode(window.location.search))
  return resolveInstagramConnectMode(settings.data?.instagram_connect, testing)
}

export const INSTAGRAM_REQUIRED_MESSAGE = 'Connect your Instagram account to continue'

/** Fills the Instagram fields from what the server verified. */
function applyConnection(form: Form, c: InstagramConnection) {
  const opts = { shouldDirty: true, shouldValidate: true } as const
  form.setValue('instagram.handle', `@${c.username}`, opts)
  form.setValue('instagram.url', c.profile_url, opts)
  if (typeof c.followers_count === 'number') form.setValue('instagram.followers', String(c.followers_count), opts)
  form.setValue('instagram.connection_id', c.connection_id, opts)
  form.setValue('instagram.connected_username', c.username, opts)
}

/**
 * "Connect Instagram" on page 2 of the creator sign-up — the fourth field of
 * the Instagram grid, beside Followers. Shown only when the `instagram_connect`
 * setting allows; when it's `required`, the wizard won't leave page 2 until
 * Instagram itself has confirmed the account (`instagram.connection_id`). It
 * sends the creator through Instagram's own login, then fills in the account,
 * profile link and follower count from what Instagram returned.
 *
 * `returnTo` is where the callback brings them back; the wizard opens this page
 * again when it sees `?instagram=1`.
 */
export function InstagramConnect({
  form,
  required = false,
  returnTo = '/get-started?role=creator',
}: {
  form: Form
  required?: boolean
  returnTo?: string
}) {
  const [busy, setBusy] = React.useState(false)
  const [oauthError, setOauthError] = React.useState<string | null>(null)
  const connectionId = form.watch('instagram.connection_id')
  const connectedUsername = form.watch('instagram.connected_username')
  const followers = form.watch('instagram.followers')
  const requiredError = form.formState.errors.instagram?.connection_id?.message

  // Coming back from Instagram: apply the outcome the callback left behind.
  // A tick later, not straight away: this effect runs before the wizard's own
  // (children's effects run first), and the wizard's is what saves the draft —
  // applied any sooner, the filled-in values and the connection id would be on
  // screen but missing from the saved draft until the next keystroke.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = takeConnectResult()
      if (!result) return
      if (result.status === 'connected') {
        applyConnection(form, result.connection)
        setOauthError(null)
      } else {
        setOauthError(result.message)
      }
    })
    return () => window.clearTimeout(timer)
  }, [form])

  const connect = async () => {
    setBusy(true)
    setOauthError(null)
    try {
      await startInstagramConnect(returnTo)
      // The page is navigating to Instagram; leave the button busy.
    } catch (e) {
      setOauthError(toAppError(e).message)
      setBusy(false)
    }
  }

  const disconnect = () => {
    const opts = { shouldDirty: true } as const
    form.setValue('instagram.connection_id', '', opts)
    form.setValue('instagram.connected_username', '', opts)
  }

  const connected = Boolean(connectionId && connectedUsername)
  const count = Number(followers)

  return (
    <Field
      label="Verify Instagram"
      htmlFor="ig_connect"
      required={required}
      optional={!required}
      error={connected ? undefined : (oauthError ?? requiredError)}
      hint={
        connected
          ? `@${connectedUsername}${followers && Number.isFinite(count) ? ` · ${formatCompact(count)} followers` : ''} · verified by Instagram`
          : 'Creator or Business account. Fills in your details for you.'
      }
    >
      {connected ? (
        <div id="ig_connect" role="status" className="flex h-11 items-center justify-between gap-2 rounded-control border border-success/30 bg-success-soft/50 pr-1 pl-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            <span className="truncate">Instagram Connected</span>
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <Button id="ig_connect" type="button" variant="secondary" loading={busy} onClick={() => void connect()} className="w-full aria-invalid:border-danger">
          <Instagram /> Connect Instagram
        </Button>
      )}
    </Field>
  )
}
