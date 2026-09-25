import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import {
  addToWishlist,
  createWishlist,
  deleteWishlist,
  getSavedCreatorMap,
  listWishlists,
  removeFromWishlist,
  renameWishlist,
} from '@/services/wishlists.service'

export function useWishlists() {
  const { role } = useAuth()
  return useQuery({ queryKey: qk.wishlists.all, queryFn: listWishlists, enabled: role === 'brand' })
}

export function useSavedCreators() {
  const { role } = useAuth()
  return useQuery({ queryKey: qk.wishlists.savedIds, queryFn: getSavedCreatorMap, enabled: role === 'brand', staleTime: 60_000 })
}

export function useWishlistMutations() {
  const qc = useQueryClient()
  const { brand } = useAuth()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.wishlists.all })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  /** Optimistic add/remove against the saved-ids map. */
  const toggle = useMutation({
    mutationFn: async ({ creatorId, wishlistId, save }: { creatorId: string; wishlistId: string; save: boolean }) => {
      if (save) await addToWishlist(wishlistId, creatorId)
      else await removeFromWishlist(wishlistId, creatorId)
      return save
    },
    onMutate: async ({ creatorId, wishlistId, save }) => {
      await qc.cancelQueries({ queryKey: qk.wishlists.savedIds })
      const prev = qc.getQueryData<Record<string, string[]>>(qk.wishlists.savedIds)
      qc.setQueryData<Record<string, string[]>>(qk.wishlists.savedIds, (old = {}) => {
        const cur = new Set(old[creatorId] ?? [])
        if (save) cur.add(wishlistId)
        else cur.delete(wishlistId)
        return { ...old, [creatorId]: [...cur] }
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.wishlists.savedIds, ctx.prev)
    },
    onSuccess: (saved) => toast.success(saved ? 'Saved to wishlist' : 'Removed from wishlist'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.wishlists.savedIds })
      refresh()
    },
  })

  const create = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) => createWishlist(brand!.id, name, description),
    onSuccess: () => toast.success('List created'),
    onSettled: refresh,
  })

  const rename = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string | null }) => renameWishlist(id, name, description),
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteWishlist(id),
    onSuccess: () => toast.success('List deleted'),
    onSettled: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: qk.wishlists.savedIds })
    },
  })

  return { toggle, create, rename, remove }
}
