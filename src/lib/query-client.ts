import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toAppError } from '@/lib/errors'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean; successMessage?: string }
    queryMeta: { silent?: boolean }
  }
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return
      toast.error(toAppError(error).message)
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const kind = toAppError(error).kind
        if (kind === 'permission' || kind === 'not_found' || kind === 'validation' || kind === 'auth') return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
