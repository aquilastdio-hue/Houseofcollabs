import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { qk } from '@/lib/query-keys'
import { compact } from '@/lib/utils'
import {
  getCompletion,
  getCreatorById,
  getCreatorBySlug,
  getCreatorReviews,
  getCreatorsByIds,
  searchCreators,
  type CreatorSearchParams,
} from '@/services/creators.service'
import { recordSearchEvent } from '@/services/analytics.service'
import { useAuth } from '@/contexts/auth-context'

export function useCreatorSearch(params: CreatorSearchParams, opts: { track?: boolean } = {}) {
  const { role } = useAuth()
  const query = useQuery({
    queryKey: qk.creators.search(params),
    queryFn: () => searchCreators(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  // Record brand searches (debounced by the URL state that drives params).
  const trackedKey = React.useRef<string>('')
  React.useEffect(() => {
    if (!opts.track || role !== 'brand' || !query.data || query.isPlaceholderData) return
    const { page: _p, pageSize: _s, ...filters } = params
    const key = JSON.stringify(filters)
    if (key === trackedKey.current) return
    trackedKey.current = key
    void recordSearchEvent(params.q, compact(filters), query.data.total)
  }, [opts.track, role, params, query.data, query.isPlaceholderData])
  return query
}

export function useCreatorBySlug(slug?: string) {
  return useQuery({ queryKey: qk.creators.bySlug(slug ?? ''), queryFn: () => getCreatorBySlug(slug!), enabled: !!slug })
}

export function useCreatorById(id?: string) {
  return useQuery({ queryKey: qk.creators.byId(id ?? ''), queryFn: () => getCreatorById(id!), enabled: !!id })
}

export function useCreatorsByIds(ids: string[]) {
  return useQuery({ queryKey: qk.creators.compare(ids), queryFn: () => getCreatorsByIds(ids), enabled: ids.length > 0 })
}

export function useCreatorReviews(creatorId?: string, page = 1) {
  return useQuery({
    queryKey: qk.creators.reviews(creatorId ?? '', page),
    queryFn: () => getCreatorReviews(creatorId!, page),
    enabled: !!creatorId,
    placeholderData: keepPreviousData,
  })
}

export function useCompletion(enabled = true) {
  return useQuery({ queryKey: qk.creators.completion, queryFn: getCompletion, enabled })
}

// ---------------------------------------------------------------------------
// URL-driven marketplace filters (source of truth = query string)
// ---------------------------------------------------------------------------
const NUMBER_KEYS = ['minPrice', 'maxPrice', 'minFollowers', 'maxFollowers', 'maxDelivery', 'minAge', 'maxAge', 'minRating', 'page'] as const
const STRING_KEYS = ['q', 'category', 'city', 'state', 'gender', 'creatorType', 'contentType', 'platform', 'sort'] as const
const BOOL_KEYS = ['verified', 'available'] as const

export function paramsFromSearch(sp: URLSearchParams): CreatorSearchParams {
  const out: CreatorSearchParams = {}
  for (const k of STRING_KEYS) {
    const v = sp.get(k)
    if (v) (out as Record<string, unknown>)[k] = v
  }
  for (const k of NUMBER_KEYS) {
    const v = sp.get(k)
    if (v !== null && v !== '' && Number.isFinite(Number(v))) (out as Record<string, unknown>)[k] = Number(v)
  }
  for (const k of BOOL_KEYS) if (sp.get(k) === '1' || sp.get(k) === 'true') (out as Record<string, unknown>)[k] = true
  const langs = sp.get('languages')
  if (langs) out.languages = langs.split(',').filter(Boolean)
  return out
}

export function searchFromParams(p: CreatorSearchParams): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(compact(p as Record<string, unknown>))) {
    if (k === 'pageSize') continue
    if (k === 'page' && Number(v) <= 1) continue
    if (k === 'sort' && v === 'relevance') continue
    if (Array.isArray(v)) sp.set(k, v.join(','))
    else if (typeof v === 'boolean') sp.set(k, v ? '1' : '0')
    else sp.set(k, String(v))
  }
  return sp
}

export function useMarketplaceFilters(fixed: Partial<CreatorSearchParams> = {}) {
  const [sp, setSp] = useSearchParams()
  const params = React.useMemo(() => ({ ...paramsFromSearch(sp), ...fixed }), [sp, fixed])

  const setParams = React.useCallback(
    (patch: Partial<CreatorSearchParams>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const next = { ...paramsFromSearch(sp), ...patch }
      if (opts.resetPage !== false && !('page' in patch)) next.page = 1
      for (const k of Object.keys(fixed)) delete (next as Record<string, unknown>)[k]
      setSp(searchFromParams(next), { replace: false })
    },
    [sp, setSp, fixed],
  )

  const reset = React.useCallback(() => {
    const keep = new URLSearchParams()
    const q = sp.get('q')
    if (q) keep.set('q', q)
    setSp(keep)
  }, [sp, setSp])

  const activeCount = React.useMemo(() => {
    const { q: _q, sort: _s, page: _p, pageSize: _ps, ...rest } = paramsFromSearch(sp)
    return Object.keys(compact(rest as Record<string, unknown>)).length
  }, [sp])

  return { params, setParams, reset, activeCount }
}
