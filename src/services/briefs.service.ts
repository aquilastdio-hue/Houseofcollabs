import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { removeFiles, scopedPath, signedUrl, uploadFile } from '@/lib/supabase/storage'
import type { BriefAttachment, BriefStatus, TablesInsert, TablesUpdate } from '@/types'

const BRIEF_SELECT = `
  *,
  category:categories ( id, name, slug ),
  brand:brands ( id, brand_name, brand_slug, brand_logo_url, brand_pronunciation, pronunciation_audio_url, website_url, instagram_url ),
  creator:creators ( id, display_name, slug, profile_image_url, verified ),
  brief_attachments ( * )
`

const briefQuery = () => supabase.from('briefs').select(BRIEF_SELECT)
export type BriefDetail = QueryData<ReturnType<typeof briefQuery>>[number]

export type BriefListParams = {
  scope: 'brand' | 'creator'
  ownerId: string // brand id or creator id
  status?: BriefStatus | 'all'
  search?: string
  page?: number
  pageSize?: number
}

export async function listBriefs(p: BriefListParams) {
  const pageSize = p.pageSize ?? 20
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('briefs')
    .select(BRIEF_SELECT, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  q = p.scope === 'brand' ? q.eq('brand_id', p.ownerId) : q.eq('creator_id', p.ownerId).neq('status', 'draft')
  if (p.status && p.status !== 'all') q = q.eq('status', p.status)
  if (p.search?.trim()) q = q.ilike('title', `%${p.search.trim().replace(/[%_]/g, '')}%`)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function getBrief(id: string): Promise<BriefDetail | null> {
  return unwrap(await briefQuery().eq('id', id).maybeSingle())
}

export type BriefInput = Omit<TablesInsert<'briefs'>, 'id' | 'brand_id' | 'creator_id' | 'status' | 'sent_at' | 'responded_at' | 'response_note' | 'created_at' | 'updated_at'>

export async function createBrief(brandId: string, input: BriefInput) {
  return unwrap(await supabase.from('briefs').insert({ ...input, brand_id: brandId }).select('*').single())
}

export async function updateBrief(id: string, patch: Omit<TablesUpdate<'briefs'>, 'id' | 'brand_id' | 'creator_id' | 'status'>) {
  return unwrap(await supabase.from('briefs').update(patch).eq('id', id).select('*').single())
}

export async function deleteBrief(id: string) {
  unwrap(await supabase.from('briefs').delete().eq('id', id))
}

export async function sendBrief(id: string, creatorId: string) {
  return unwrap(await supabase.rpc('send_brief', { p_brief_id: id, p_creator_id: creatorId }))
}

export async function respondToBrief(id: string, accept: boolean, note?: string) {
  return unwrap(await supabase.rpc('respond_to_brief', { p_brief_id: id, p_accept: accept, p_note: note }))
}

export async function uploadBriefAttachment(briefId: string, userId: string, file: File): Promise<BriefAttachment> {
  const up = await uploadFile('brief-attachments', scopedPath(briefId, file.name), file)
  return unwrap(
    await supabase
      .from('brief_attachments')
      .insert({ brief_id: briefId, storage_path: up.path, file_name: file.name, mime_type: up.mime, size_bytes: file.size, uploaded_by: userId })
      .select('*')
      .single(),
  )
}

export async function deleteBriefAttachment(att: BriefAttachment) {
  unwrap(await supabase.from('brief_attachments').delete().eq('id', att.id))
  await removeFiles('brief-attachments', [att.storage_path]).catch(() => undefined)
}

export function briefAttachmentUrl(path: string, download?: string) {
  return signedUrl('brief-attachments', path, 3600, download)
}
