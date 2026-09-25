import * as React from 'react'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { listMyServices } from '@/services/creator-services.service'
import { listMyPortfolio } from '@/services/portfolio.service'

/**
 * After any storefront write: reload the creator record (sidebar banner,
 * status, previews), the completion checklist and the dashboard, plus any
 * extra keys the caller touched.
 */
export function useStudioSync() {
  const qc = useQueryClient()
  const { refresh } = useAuth()
  return React.useCallback(
    async (...keys: QueryKey[]) => {
      await Promise.all([
        refresh(),
        qc.invalidateQueries({ queryKey: qk.creators.completion }),
        qc.invalidateQueries({ queryKey: qk.dashboard.creator }),
        ...keys.map((queryKey) => qc.invalidateQueries({ queryKey })),
      ])
    },
    [qc, refresh],
  )
}

/** The creator's own (non-archived) services with add-ons, including inactive ones. */
export function useMyServices(creatorId?: string) {
  return useQuery({
    queryKey: qk.services.mine,
    queryFn: () => listMyServices(creatorId!),
    enabled: !!creatorId,
  })
}

/** The creator's own portfolio, including items hidden by moderation. */
export function useMyPortfolio(creatorId?: string) {
  return useQuery({
    queryKey: qk.portfolio.mine,
    queryFn: () => listMyPortfolio(creatorId!),
    enabled: !!creatorId,
  })
}
