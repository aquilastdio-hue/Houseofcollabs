/**
 * Centralised TanStack Query keys. Invalidate by prefix, e.g.
 * `queryClient.invalidateQueries({ queryKey: qk.orders.all })`.
 */
export const qk = {
  profile: (id?: string) => ['profile', id] as const,
  categories: ['categories'] as const,
  creatorTypes: ['creator-types'] as const,
  publicStats: ['public-stats'] as const,
  settings: ['platform-settings'] as const,

  creators: {
    all: ['creators'] as const,
    search: (params: unknown) => ['creators', 'search', params] as const,
    bySlug: (slug: string) => ['creators', 'slug', slug] as const,
    byId: (id: string) => ['creators', 'id', id] as const,
    compare: (ids: string[]) => ['creators', 'compare', ids] as const,
    reviews: (id: string, page: number) => ['creators', 'reviews', id, page] as const,
    mine: ['creators', 'mine'] as const,
    completion: ['creators', 'completion'] as const,
    requirements: ['creators', 'requirements'] as const,
    verifications: ['creators', 'verifications'] as const,
  },
  services: { mine: ['services', 'mine'] as const },
  portfolio: { mine: ['portfolio', 'mine'] as const },
  brand: { mine: ['brand', 'mine'] as const, byId: (id: string) => ['brand', 'id', id] as const },

  briefs: {
    all: ['briefs'] as const,
    list: (params: unknown) => ['briefs', 'list', params] as const,
    detail: (id: string) => ['briefs', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params: unknown) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    quote: (serviceId: string, addonIds: string[]) => ['orders', 'quote', serviceId, addonIds] as const,
    dispute: (orderId: string) => ['orders', 'dispute', orderId] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: (archived: boolean, search: string) => ['conversations', 'list', archived, search] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
  },
  messages: (conversationId: string) => ['messages', conversationId] as const,
  notifications: {
    all: ['notifications'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
  },
  unreadCounts: ['unread-counts'] as const,
  wishlists: {
    all: ['wishlists'] as const,
    savedIds: ['wishlists', 'saved-ids'] as const,
  },
  earnings: {
    all: ['earnings'] as const,
    summary: ['earnings', 'summary'] as const,
    list: (page: number) => ['earnings', 'list', page] as const,
  },
  payouts: {
    all: ['payouts'] as const,
    method: ['payouts', 'method'] as const,
    requests: ['payouts', 'requests'] as const,
  },
  payments: { mine: (page: number) => ['payments', 'mine', page] as const },
  dashboard: {
    creator: ['dashboard', 'creator'] as const,
    brand: ['dashboard', 'brand'] as const,
  },
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    timeseries: (days: number) => ['admin', 'timeseries', days] as const,
    creators: (params: unknown) => ['admin', 'creators', params] as const,
    creator: (id: string) => ['admin', 'creator', id] as const,
    brands: (params: unknown) => ['admin', 'brands', params] as const,
    brand: (id: string) => ['admin', 'brand', id] as const,
    orders: (params: unknown) => ['admin', 'orders', params] as const,
    payments: (params: unknown) => ['admin', 'payments', params] as const,
    payouts: (params: unknown) => ['admin', 'payouts', params] as const,
    disputes: (params: unknown) => ['admin', 'disputes', params] as const,
    dispute: (id: string) => ['admin', 'dispute', id] as const,
    reports: (params: unknown) => ['admin', 'reports', params] as const,
    auditLogs: (params: unknown) => ['admin', 'audit-logs', params] as const,
    settings: ['admin', 'settings'] as const,
    contact: (params: unknown) => ['admin', 'contact', params] as const,
    content: (params: unknown) => ['admin', 'content', params] as const,
    people: (params: unknown) => ['admin', 'people', params] as const,
    peopleStats: ['admin', 'people-stats'] as const,
    revenue: ['admin', 'revenue'] as const,
  },
} as const
