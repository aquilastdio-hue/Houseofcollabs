import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'

const WISHLIST_SELECT = `
  *,
  wishlist_items (
    id, creator_id, note, created_at,
    creator:creators ( id, slug, display_name, headline, profile_image_url, cover_image_url, city, state, verified,
                       available, rating, review_count, starting_price, fastest_delivery_days, followers_count )
  )
`
const wishlistQuery = () =>
  supabase
    .from('wishlists')
    .select(WISHLIST_SELECT)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .order('created_at', { referencedTable: 'wishlist_items', ascending: false })

export type WishlistWithItems = QueryData<ReturnType<typeof wishlistQuery>>[number]

export async function listWishlists(): Promise<WishlistWithItems[]> {
  return unwrap(await wishlistQuery())
}

export async function createWishlist(brandId: string, name: string, description?: string) {
  return unwrap(await supabase.from('wishlists').insert({ brand_id: brandId, name: name.trim(), description: description?.trim() || null }).select('*').single())
}

export async function renameWishlist(id: string, name: string, description?: string | null) {
  return unwrap(await supabase.from('wishlists').update({ name: name.trim(), description: description?.trim() || null }).eq('id', id).select('*').single())
}

export async function deleteWishlist(id: string) {
  unwrap(await supabase.from('wishlists').delete().eq('id', id))
}

export async function addToWishlist(wishlistId: string, creatorId: string) {
  unwrap(await supabase.from('wishlist_items').upsert({ wishlist_id: wishlistId, creator_id: creatorId }, { onConflict: 'wishlist_id,creator_id', ignoreDuplicates: true }))
}

export async function removeFromWishlist(wishlistId: string, creatorId: string) {
  unwrap(await supabase.from('wishlist_items').delete().eq('wishlist_id', wishlistId).eq('creator_id', creatorId))
}

/** creatorId → wishlist ids containing it (for heart toggles on cards). */
export async function getSavedCreatorMap(): Promise<Record<string, string[]>> {
  const rows = unwrap(await supabase.from('wishlist_items').select('creator_id, wishlist_id'))
  const map: Record<string, string[]> = {}
  for (const r of rows) (map[r.creator_id] ??= []).push(r.wishlist_id)
  return map
}
