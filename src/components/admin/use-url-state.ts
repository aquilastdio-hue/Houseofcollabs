import * as React from 'react'
import { useSearchParams } from 'react-router'

type ParamValue = string | number | boolean | null | undefined | readonly string[]

function serialize(value: ParamValue) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.join(',')
}

/**
 * List/filter state kept in the URL so views are shareable and survive a
 * round trip to a detail page. Changing any filter resets `page`.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams()

  const get = React.useCallback((key: string) => params.get(key) ?? '', [params])

  const getList = React.useCallback(
    (key: string) =>
      (params.get(key) ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    [params],
  )

  const update = React.useCallback(
    (patch: Record<string, ParamValue>, opts: { keepPage?: boolean; push?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            const str = serialize(value)
            if (str) next.set(key, str)
            else next.delete(key)
          }
          if (!opts.keepPage && !('page' in patch)) next.delete('page')
          return next
        },
        // Same reason as the marketplace filters: a filter change is a
        // navigation, and the router resets scroll on those, which yanked the
        // admin back to the top mid-search. `setPage` still scrolls on purpose.
        { replace: !opts.push, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const setPage = React.useCallback(
    (next: number) => {
      update({ page: next > 1 ? next : null }, { push: true })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [update],
  )

  return { params, get, getList, update, page, setPage }
}
