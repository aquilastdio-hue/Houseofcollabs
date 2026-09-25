import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

type Options<TData, TVars> = {
  /** Query keys (or prefixes) refreshed after the mutation settles. */
  invalidate?: readonly QueryKey[]
  /** Success toast; can depend on the result / variables. */
  success?: string | ((data: TData, vars: TVars) => string)
  onSuccess?: (data: TData, vars: TVars) => void
}

/**
 * `useMutation` preset for admin writes: success toast, cache invalidation,
 * and server errors surfaced by the global mutation handler (toast with the
 * database / Edge Function message).
 */
export function useAdminMutation<TVars = void, TData = unknown>(fn: (vars: TVars) => Promise<TData>, opts: Options<TData, TVars> = {}) {
  const qc = useQueryClient()
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      const message = typeof opts.success === 'function' ? opts.success(data, vars) : opts.success
      if (message) toast.success(message)
      opts.onSuccess?.(data, vars)
    },
    onSettled: async () => {
      await Promise.all((opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })))
    },
  })
}
