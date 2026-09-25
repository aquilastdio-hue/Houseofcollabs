import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import type { Notification, UnreadCounts } from '@/types'

export async function listNotifications(opts: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 20
  const page = Math.max(1, opts.page ?? 1)
  let q = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (opts.unreadOnly) q = q.eq('read', false)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: (data ?? []) as Notification[], total: count ?? 0, page, pageSize }
}

export async function markNotificationRead(id: string) {
  unwrap(await supabase.rpc('mark_notification_read', { p_notification_id: id }))
}

export async function markAllNotificationsRead() {
  return unwrap(await supabase.rpc('mark_all_notifications_read'))
}

export async function deleteNotification(id: string) {
  unwrap(await supabase.from('notifications').delete().eq('id', id))
}

export async function getUnreadCounts(): Promise<UnreadCounts> {
  const data = unwrap(await supabase.rpc('get_unread_counts')) as unknown as UnreadCounts | null
  return { notifications: Number(data?.notifications ?? 0), messages: Number(data?.messages ?? 0) }
}
