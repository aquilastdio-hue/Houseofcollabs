import { supabase } from '@/lib/supabase/client'
import { AppError, unwrap } from '@/lib/errors'
import { ownerPath, removeFiles, uploadFile, pathFromPublicUrl } from '@/lib/supabase/storage'
import { validateFile } from '@/lib/validation/files'
import { captureVideoThumbnail, optimizeImage } from '@/utils/media'
import type { PortfolioItem, TablesInsert, TablesUpdate } from '@/types'

export async function listMyPortfolio(creatorId: string): Promise<PortfolioItem[]> {
  return unwrap(
    await supabase.from('portfolio_items').select('*').eq('creator_id', creatorId).order('sort_order').order('created_at'),
  )
}

export type UploadedMedia = {
  type: 'image' | 'video'
  media_url: string
  thumbnail_url: string | null
  storage_path: string
  width: number | null
  height: number | null
  duration_seconds: number | null
}

/**
 * Validates + optimises + uploads a portfolio file to `creator-portfolio/{uid}/…`.
 * Images are re-encoded to WebP (≤1800px); videos get a captured poster frame.
 */
export async function uploadPortfolioMedia(userId: string, file: File): Promise<UploadedMedia> {
  const problem = validateFile('creator-portfolio', file, { kinds: ['image', 'video'] })
  if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })

  if (file.type.startsWith('video/')) {
    const meta = await captureVideoThumbnail(file).catch(() => null)
    const video = await uploadFile('creator-portfolio', ownerPath(userId, file.name), file, { skipValidation: true })
    let thumbUrl: string | null = null
    if (meta) {
      const thumb = await uploadFile('creator-portfolio', ownerPath(userId, 'poster.webp'), meta.thumbnail, {
        fileName: 'poster.webp',
        contentType: 'image/webp',
        skipValidation: true,
      })
      thumbUrl = thumb.publicUrl ?? null
    }
    return {
      type: 'video',
      media_url: video.publicUrl!,
      thumbnail_url: thumbUrl,
      storage_path: video.path,
      width: meta?.width ?? null,
      height: meta?.height ?? null,
      duration_seconds: meta ? Math.round(meta.duration * 100) / 100 : null,
    }
  }

  const img = await optimizeImage(file, 1800, 0.85)
  const name = img.type === 'image/webp' ? 'image.webp' : file.name
  const uploaded = await uploadFile('creator-portfolio', ownerPath(userId, name), img.blob, {
    fileName: name,
    contentType: img.type,
    skipValidation: true,
  })
  return {
    type: 'image',
    media_url: uploaded.publicUrl!,
    thumbnail_url: null,
    storage_path: uploaded.path,
    width: img.width,
    height: img.height,
    duration_seconds: null,
  }
}

export type PortfolioInput = Omit<TablesInsert<'portfolio_items'>, 'creator_id' | 'id' | 'created_at' | 'updated_at' | 'is_hidden'>

export async function createPortfolioItem(creatorId: string, input: PortfolioInput) {
  return unwrap(await supabase.from('portfolio_items').insert({ ...input, creator_id: creatorId }).select('*').single())
}

export async function updatePortfolioItem(id: string, patch: Omit<TablesUpdate<'portfolio_items'>, 'creator_id' | 'is_hidden'>) {
  return unwrap(await supabase.from('portfolio_items').update(patch).eq('id', id).select('*').single())
}

export async function deletePortfolioItem(item: PortfolioItem) {
  unwrap(await supabase.from('portfolio_items').delete().eq('id', item.id))
  const paths = [item.storage_path, pathFromPublicUrl('creator-portfolio', item.thumbnail_url)].filter((p): p is string => !!p)
  await removeFiles('creator-portfolio', paths).catch(() => undefined)
}

export async function reorderPortfolio(order: { id: string; sort_order: number }[]) {
  await Promise.all(order.map(({ id, sort_order }) => supabase.from('portfolio_items').update({ sort_order }).eq('id', id).then(unwrap)))
}
