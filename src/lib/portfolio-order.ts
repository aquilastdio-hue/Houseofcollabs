type Orderable = { sort_order: number; created_at: string; is_hidden: boolean; media_url: string }

/**
 * Portfolio order everywhere it's shown: the cover (the first visible post,
 * which is the picture on the creator's marketplace card), then the photo
 * that's their profile picture, then the rest in the creator's order.
 */
export function portfolioOrder<T extends Orderable>(items: readonly T[], profileImageUrl?: string | null): T[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  const cover = sorted.find((i) => !i.is_hidden)
  const photo = profileImageUrl ? sorted.find((i) => !i.is_hidden && i !== cover && i.media_url === profileImageUrl) : undefined
  const top = [cover, photo].filter((i): i is T => !!i)
  return [...top, ...sorted.filter((i) => !top.includes(i))]
}
