import { qk } from '@/lib/query-keys'

/**
 * Admin query keys that `qk.admin` doesn't define. Everything stays nested
 * under the `admin` prefix, so `invalidateQueries({ queryKey: qk.admin.all })`
 * still reaches them.
 */
export const adminKeys = {
  refunds: (orderId: string) => [...qk.admin.all, 'refunds', orderId] as const,
  categories: [...qk.admin.all, 'categories'] as const,
  creatorTypes: [...qk.admin.all, 'creator-types'] as const,
  announcementsAll: [...qk.admin.all, 'announcements'] as const,
  announcements: (page: number) => [...qk.admin.all, 'announcements', page] as const,
  emailsAll: [...qk.admin.all, 'emails'] as const,
  emails: (params: unknown) => [...qk.admin.all, 'emails', params] as const,
  emailStats: [...qk.admin.all, 'email-stats'] as const,
  emailPreview: (id: string) => [...qk.admin.all, 'email-preview', id] as const,
}

/** Prefixes of the paginated admin lists, used to invalidate every page/filter at once. */
export const adminLists = {
  creators: [...qk.admin.all, 'creators'] as const,
  brands: [...qk.admin.all, 'brands'] as const,
  orders: [...qk.admin.all, 'orders'] as const,
  payments: [...qk.admin.all, 'payments'] as const,
  payouts: [...qk.admin.all, 'payouts'] as const,
  reports: [...qk.admin.all, 'reports'] as const,
  contact: [...qk.admin.all, 'contact'] as const,
  content: [...qk.admin.all, 'content'] as const,
  auditLogs: [...qk.admin.all, 'audit-logs'] as const,
}
