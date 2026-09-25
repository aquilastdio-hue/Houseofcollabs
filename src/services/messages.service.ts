import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import { scopedPath, signedUrls, uploadFile } from '@/lib/supabase/storage'
import type { Attachment, ConversationSummary, Message } from '@/types'

export async function listConversations(archived = false, search = ''): Promise<ConversationSummary[]> {
  return unwrap(await supabase.rpc('get_my_conversations', { p_archived: archived, p_search: search || undefined })) ?? []
}

const CONVERSATION_SELECT = `
  *,
  brand:brands ( id, profile_id, brand_name, brand_logo_url, brand_slug ),
  creator:creators ( id, profile_id, display_name, slug, profile_image_url, verified ),
  conversation_participants ( profile_id, participant_role, last_read_at, archived )
`
const conversationQuery = () => supabase.from('conversations').select(CONVERSATION_SELECT)
export type ConversationDetail = QueryData<ReturnType<typeof conversationQuery>>[number]

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  return unwrap(await conversationQuery().eq('id', id).maybeSingle())
}

/** Newest-first page from the DB, returned oldest-first for rendering. */
export async function listMessages(conversationId: string, opts: { before?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 40
  let q = supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(limit)
  if (opts.before) q = q.lt('created_at', opts.before)
  const data = unwrap(await q)
  return { items: [...data].reverse(), hasMore: data.length === limit }
}

export async function sendMessage(input: { id: string; conversationId: string; senderId: string; body?: string; attachments?: Attachment[] }): Promise<Message> {
  const hasFiles = (input.attachments?.length ?? 0) > 0
  const allImages = hasFiles && input.attachments!.every((a) => a.mime?.startsWith('image/'))
  return unwrap(
    await supabase
      .from('messages')
      .insert({
        id: input.id,
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: input.body?.trim() || null,
        attachments: input.attachments ?? [],
        message_type: hasFiles ? (allImages ? 'image' : 'file') : 'text',
      })
      .select('*')
      .single(),
  )
}

export async function deleteMessage(id: string) {
  unwrap(await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id))
}

export async function startConversation(target: { creatorId?: string; brandId?: string }): Promise<string> {
  return unwrap(await supabase.rpc('start_conversation', { p_creator_id: target.creatorId, p_brand_id: target.brandId }))
}

export async function markConversationRead(id: string) {
  unwrap(await supabase.rpc('mark_conversation_read', { p_conversation_id: id }))
}

export async function setConversationArchived(id: string, archived: boolean) {
  unwrap(await supabase.rpc('set_conversation_archived', { p_conversation_id: id, p_archived: archived }))
}

export async function uploadMessageAttachment(conversationId: string, file: File): Promise<Attachment> {
  const up = await uploadFile('message-attachments', scopedPath(conversationId, file.name), file)
  return { path: up.path, name: file.name, mime: up.mime, size: file.size }
}

export function messageAttachmentUrls(paths: string[]) {
  return signedUrls('message-attachments', paths)
}

export function parseAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value.filter((a) => a && typeof a === 'object' && 'path' in a) as Attachment[]) : []
}
