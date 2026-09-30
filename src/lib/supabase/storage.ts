import { supabase } from './client'
import { toAppError, AppError } from '@/lib/errors'
import { baseMime, validateFile, type Bucket } from '@/lib/validation/files'
import { fileExtension, sanitizeFileName, uuid } from '@/lib/utils'

export type UploadedFile = {
  bucket: Bucket
  path: string
  name: string
  size: number
  mime: string
  /** Public URL for public buckets; undefined for private ones (use signed URLs). */
  publicUrl?: string
}

/** `{uid}/{uuid}.{ext}` — used by avatars / portfolio / brand-assets (owner folder policies). */
export function ownerPath(userId: string, fileName: string) {
  const ext = fileExtension(fileName) || 'bin'
  return `${userId}/${uuid()}.${ext}`
}

/** `{scopeId}/[sub/]{uuid}-{safe-name}` — brief / order scoped buckets. */
export function scopedPath(scopeId: string, fileName: string, sub?: string) {
  return `${scopeId}/${sub ? `${sub}/` : ''}${uuid().slice(0, 8)}-${sanitizeFileName(fileName)}`
}

export function publicUrl(bucket: Bucket, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function uploadFile(
  bucket: Bucket,
  path: string,
  file: Blob,
  opts: { fileName?: string; contentType?: string; skipValidation?: boolean } = {},
): Promise<UploadedFile> {
  const name = opts.fileName ?? (file instanceof File ? file.name : path.split('/').pop()!)
  if (!opts.skipValidation && file instanceof File) {
    const problem = validateFile(bucket, file)
    if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  }
  const contentType = baseMime(opts.contentType ?? file.type ?? 'application/octet-stream') || 'application/octet-stream'
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  })
  if (error) throw toAppError(error)
  const isPublic = bucket === 'avatars' || bucket === 'creator-portfolio' || bucket === 'brand-assets'
  return {
    bucket,
    path: data.path,
    name,
    size: file.size,
    mime: contentType,
    publicUrl: isPublic ? publicUrl(bucket, data.path) : undefined,
  }
}

export async function signedUrl(bucket: Bucket, path: string, expiresIn = 3600, download?: string | boolean) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn, download ? { download } : undefined)
  if (error) throw toAppError(error)
  return data.signedUrl
}

export async function signedUrls(bucket: Bucket, paths: string[], expiresIn = 3600) {
  if (paths.length === 0) return {} as Record<string, string>
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn)
  if (error) throw toAppError(error)
  const map: Record<string, string> = {}
  for (const item of data) if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  return map
}

export async function removeFiles(bucket: Bucket, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) throw toAppError(error)
}

/** Extracts the storage path from a public URL of our own bucket (for deletes). */
export function pathFromPublicUrl(bucket: Bucket, url?: string | null) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const i = url.indexOf(marker)
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}
