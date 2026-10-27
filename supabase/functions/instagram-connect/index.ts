import { createHandler } from './handler.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'

Deno.serve(
  createHandler({
    env: (key) => Deno.env.get(key),
    rpc: (fn, args) => adminClient().rpc(fn, args),
    fetch: (input, init) => fetch(input, init),
    requireAdmin,
  }),
)
