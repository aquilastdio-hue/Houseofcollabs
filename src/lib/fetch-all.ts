/**
 * Every row of a paged list, in one result.
 *
 * The admin lists show everything on a single page, however many rows there
 * are. The server still caps each request (the admin RPCs at 100 rows,
 * PostgREST at 1000), so this asks for the first page, reads the total from
 * it, and fetches the rest in parallel. 100 a page stays under every cap.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 100,
): Promise<{ items: T[]; total: number }> {
  const first = await fetchPage(1, pageSize)
  const pages = Math.ceil(first.total / pageSize)
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchPage(i + 2, pageSize)))
  const items = [first, ...rest].flatMap((result) => result.items)
  return { items, total: items.length }
}
