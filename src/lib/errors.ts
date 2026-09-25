import { AuthError, FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js'

/**
 * Normalised, user-safe error. `message` is always safe to show in the UI;
 * internal details never leak to the user.
 */
export class AppError extends Error {
  readonly code: string
  readonly status?: number
  readonly kind: 'auth' | 'permission' | 'validation' | 'not_found' | 'network' | 'payment' | 'storage' | 'server'

  constructor(message: string, opts: { code?: string; status?: number; kind?: AppError['kind']; cause?: unknown } = {}) {
    super(message, { cause: opts.cause })
    this.name = 'AppError'
    this.code = opts.code ?? 'UNKNOWN'
    this.status = opts.status
    this.kind = opts.kind ?? 'server'
  }
}

type PostgrestLike = { code?: string; message?: string; details?: string | null; hint?: string | null }

const GENERIC = 'Something went wrong. Please try again.'

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match. Try again or reset your password.',
  email_not_confirmed: 'Please confirm your email first — check your inbox for the verification link.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'Choose a stronger password (at least 8 characters with letters and numbers).',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  same_password: 'Your new password must be different from the old one.',
  session_expired: 'Your session expired. Please sign in again.',
  otp_expired: 'This link has expired. Request a new one.',
  signup_disabled: 'Sign-ups are currently disabled.',
}

function isPostgrestError(err: unknown): err is PostgrestLike {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err && !(err instanceof Error && err.name === 'AuthApiError')
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new AppError('You appear to be offline. Check your connection and try again.', { kind: 'network', code: 'OFFLINE', cause: err })
  }

  if (err instanceof AuthError) {
    const code = err.code ?? ''
    return new AppError(AUTH_MESSAGES[code] ?? err.message ?? GENERIC, { kind: 'auth', code: code || 'AUTH', status: err.status, cause: err })
  }

  if (err instanceof FunctionsHttpError || err instanceof FunctionsRelayError || err instanceof FunctionsFetchError) {
    return new AppError('We could not reach the server. Please try again.', { kind: 'network', code: 'FUNCTION_ERROR', cause: err })
  }

  if (isPostgrestError(err)) {
    const code = err.code ?? ''
    // Our database functions raise user-facing messages with P0001/P0002 + a hint code.
    if (code === 'P0001') return new AppError(err.message ?? GENERIC, { kind: 'validation', code: err.hint ?? code, cause: err })
    if (code === 'P0002') return new AppError(err.message ?? 'Not found.', { kind: 'not_found', code: err.hint ?? code, cause: err })
    if (code === '42501') {
      const own = err.hint && /^[A-Z_]+$/.test(err.hint)
      return new AppError(own ? err.message! : 'You don’t have permission to do that.', { kind: 'permission', code: err.hint ?? code, cause: err })
    }
    if (code === '23505') return new AppError('That already exists.', { kind: 'validation', code, cause: err })
    if (code === '23514' || code === '22P02' || code === '22023' || code === '23502') {
      return new AppError('Some of the details are invalid. Please check the form and try again.', { kind: 'validation', code, cause: err })
    }
    if (code === 'PGRST116') return new AppError('We couldn’t find what you were looking for.', { kind: 'not_found', code, cause: err })
    if (code === 'PGRST301' || code === 'PGRST302') return new AppError('Your session expired. Please sign in again.', { kind: 'auth', code, cause: err })
    return new AppError(GENERIC, { kind: 'server', code: code || 'DB', cause: err })
  }

  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return new AppError('Network error — check your connection and try again.', { kind: 'network', code: 'NETWORK', cause: err })
  }

  if (err instanceof Error && err.name === 'StorageApiError') {
    const msg = /exceeded the maximum allowed size/i.test(err.message)
      ? 'That file is too large.'
      : /mime type/i.test(err.message)
        ? 'That file type isn’t allowed.'
        : /row-level security|unauthorized/i.test(err.message)
          ? 'You don’t have permission to upload here.'
          : 'Upload failed. Please try again.'
    return new AppError(msg, { kind: 'storage', code: 'STORAGE', cause: err })
  }

  if (err instanceof Error && err.message) {
    return new AppError(GENERIC, { kind: 'server', code: 'UNKNOWN', cause: err })
  }
  return new AppError(GENERIC, { cause: err })
}

export function errorMessage(err: unknown) {
  return toAppError(err).message
}

/**
 * Throws a normalised error when a Supabase result carries one; otherwise
 * returns `data` narrowed to the success type.
 */
export function unwrap<R extends { data: unknown; error: unknown }>(result: R): Extract<R, { error: null }>['data'] {
  if (result.error) throw toAppError(result.error)
  return result.data as Extract<R, { error: null }>['data']
}
