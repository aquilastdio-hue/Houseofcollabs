import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { getBrandDashboardStats } from '@/services/analytics.service'

/** Brand KPIs + pending-action counters (shared by dashboard and billing). */
export function useBrandDashboardStats(enabled = true) {
  return useQuery({ queryKey: qk.dashboard.brand, queryFn: getBrandDashboardStats, enabled, staleTime: 30_000 })
}
