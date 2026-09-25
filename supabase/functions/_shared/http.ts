// HTTP helpers shared by every Edge Function: CORS, JSON responses, and a
// wrapper that converts thrown errors into safe JSON (never leaking internals).

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
  ) {
    super(message)
  }
}

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('SITE_URL') ?? '*')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = (req.headers.get('origin') ?? '').replace(/\/$/, '')
  const allow = allowedOrigins.includes('*') ? '*' : allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

type PgLikeError = { code?: string; message?: string; hint?: string | null; details?: string | null }

function isPgError(e: unknown): e is PgLikeError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e && !(e instanceof HttpError)
}

/** Maps our database function errors (P0001/P0002/42501 + hint codes) to HTTP. */
export function fromDbError(e: PgLikeError): HttpError {
  const code = e.hint && /^[A-Z_]+$/.test(e.hint) ? e.hint : e.code ?? 'DB_ERROR'
  if (e.code === 'P0001') return new HttpError(422, e.message ?? 'Request could not be completed.', code)
  if (e.code === 'P0002') return new HttpError(404, e.message ?? 'Not found.', code)
  if (e.code === '42501') return new HttpError(403, e.message ?? 'Not allowed.', code)
  return new HttpError(500, 'Something went wrong. Please try again.', 'DB_ERROR')
}

/** Throws when a supabase-js result carries an error; returns data otherwise. */
export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw isPgError(result.error) ? fromDbError(result.error) : result.error
  return result.data as NonNullable<T>
}

export function handler(fn: (req: Request) => Promise<Response>, opts: { cors?: boolean } = {}) {
  const useCors = opts.cors !== false
  return async (req: Request): Promise<Response> => {
    const cors = useCors ? corsHeaders(req) : {}
    if (useCors && req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      const res = await fn(req)
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
      return res
    } catch (e) {
      const err = e instanceof HttpError ? e : isPgError(e) ? fromDbError(e) : null
      if (err) {
        if (err.status >= 500) console.error(e)
        return json({ error: err.message, code: err.code }, err.status, cors)
      }
      console.error(e)
      return json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, 500, cors)
    }
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object') throw new Error('not an object')
    return body as T
  } catch {
    throw new HttpError(400, 'Invalid request body.', 'BAD_REQUEST')
  }
}

export function requireString(value: unknown, name: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, `Missing or invalid ${name}.`, 'BAD_REQUEST')
  }
  return value.trim()
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function requireUuid(value: unknown, name: string): string {
  const v = requireString(value, name, 64)
  if (!UUID_RE.test(v)) throw new HttpError(400, `Invalid ${name}.`, 'BAD_REQUEST')
  return v
}
