import { supabase } from '@/lib/supabase/client'
import { AppError, unwrap } from '@/lib/errors'
import { ownerPath, uploadFile } from '@/lib/supabase/storage'
import { validateFile, baseMime } from '@/lib/validation/files'
import { optimizeImage } from '@/utils/media'
import type { Brand, TablesInsert, TablesUpdate } from '@/types'

export async function getMyBrand(userId: string): Promise<Brand | null> {
  return unwrap(await supabase.from('brands').select('*').eq('profile_id', userId).maybeSingle())
}

export async function getBrandById(id: string): Promise<Brand | null> {
  return unwrap(await supabase.from('brands').select('*').eq('id', id).maybeSingle())
}

export type BrandInput = Omit<TablesInsert<'brands'>, 'id' | 'profile_id' | 'brand_slug' | 'created_at' | 'updated_at'>

export async function createMyBrand(userId: string, input: BrandInput): Promise<Brand> {
  // `brand_slug` is intentionally not sent: it isn't granted to `authenticated`
  // (so slugs can't be squatted) and a BEFORE INSERT trigger derives it from
  // brand_name. Including it — even as '' — fails the column privilege check.
  return unwrap(await supabase.from('brands').insert({ ...input, profile_id: userId }).select('*').single())
}

export async function updateMyBrand(brandId: string, patch: Omit<TablesUpdate<'brands'>, 'id' | 'profile_id' | 'brand_slug'>): Promise<Brand> {
  return unwrap(await supabase.from('brands').update(patch).eq('id', brandId).select('*').single())
}

export async function uploadBrandLogo(userId: string, file: File) {
  const problem = validateFile('brand-assets', file, { kinds: ['image'] })
  if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  const img = await optimizeImage(file, 800, 0.9)
  const name = img.type === 'image/webp' ? 'logo.webp' : file.name
  const up = await uploadFile('brand-assets', ownerPath(userId, name), img.blob, { fileName: name, contentType: img.type, skipValidation: true })
  return up.publicUrl!
}

/** Uploads a recorded/selected pronunciation clip (≤ 10 MB). */
export async function uploadPronunciation(userId: string, audio: Blob, fileName?: string) {
  const type = baseMime(audio.type || 'audio/webm')
  const ext = type === 'audio/mpeg' ? 'mp3' : type === 'audio/mp4' || type === 'audio/x-m4a' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
  const name = fileName ?? `pronunciation.${ext}`
  if (audio instanceof File) {
    const problem = validateFile('brand-assets', audio, { kinds: ['audio'] })
    if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  } else if (audio.size > 10 * 1024 * 1024) {
    throw new AppError('Recording is too long.', { kind: 'validation', code: 'INVALID_FILE' })
  }
  const up = await uploadFile('brand-assets', ownerPath(userId, `audio.${ext}`), audio, { fileName: name, contentType: type, skipValidation: true })
  return up.publicUrl!
}
