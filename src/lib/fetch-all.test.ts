import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './fetch-all'

/** A fake paged endpoint over `rows`, reporting the full total like the real ones. */
function pagedSource(rows: number[]) {
  return vi.fn(async (page: number, pageSize: number) => ({
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
  }))
}

describe('fetchAllPages', () => {
  it('returns every row, in order, across pages', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => i)
    const source = pagedSource(rows)
    const result = await fetchAllPages(source, 100)
    expect(result).toEqual({ items: rows, total: 250 })
    expect(source).toHaveBeenCalledTimes(3)
  })

  it('makes one request when everything fits on the first page', async () => {
    const source = pagedSource([1, 2, 3])
    expect(await fetchAllPages(source, 100)).toEqual({ items: [1, 2, 3], total: 3 })
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('does not ask for an empty extra page on an exact multiple', async () => {
    const source = pagedSource(Array.from({ length: 200 }, (_, i) => i))
    expect((await fetchAllPages(source, 100)).items).toHaveLength(200)
    expect(source).toHaveBeenCalledTimes(2)
  })

  it('handles an empty list', async () => {
    const source = pagedSource([])
    expect(await fetchAllPages(source)).toEqual({ items: [], total: 0 })
    expect(source).toHaveBeenCalledTimes(1)
  })
})
