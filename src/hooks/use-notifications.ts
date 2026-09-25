import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { qk } from '@/lib/query-keys'
import {
  deleteNotification,
  getUnreadCounts,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications.service'
import { touchLastSeen } from '@/services/profile.service'
import { useDocumentVisible } from './use-utils'
import type { Notification } from '@/types'

export function useUnreadCounts(enabled = true) {
  return useQuery({ queryKey: qk.unreadCounts, queryFn: getUnreadCounts, enabled, refetchInterval: 120_000 })
}

export function useNotifications(params: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: qk.notifications.list(params),
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
  })
}

export function useNotificationActions() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.notifications.all })
    void qc.invalidateQueries({ queryKey: qk.unreadCounts })
  }
  const markRead = useMutation({ mutationFn: markNotificationRead, onSettled: refresh, meta: { silent: true } })
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: refresh })
  const remove = useMutation({ mutationFn: deleteNotification, onSettled: refresh })
  return { markRead, markAll, remove }
}

/**
 * Mounted once per app shell: streams the user's notifications and inbox
 * activity over Realtime, keeps counters fresh, shows toasts, and sends a
 * presence heartbeat (last_seen_at) while the tab is visible.
 */
export function useRealtimeStreams(userId?: string) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = React.useRef(pathname)
  pathRef.current = pathname
  const visible = useDocumentVisible()

  React.useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`user-stream-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as Notification
        void qc.invalidateQueries({ queryKey: qk.notifications.all })
        void qc.invalidateQueries({ queryKey: qk.unreadCounts })
        if (n.reference_type === 'order' && n.reference_id) void qc.invalidateQueries({ queryKey: qk.orders.detail(n.reference_id) })
        if (n.type === 'message' && n.action_url && pathRef.current.startsWith(n.action_url)) return
        toast(n.title, {
          description: n.message ?? undefined,
          action: n.action_url ? { label: 'View', onClick: () => navigate(n.action_url!) } : undefined,
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: qk.notifications.all })
        void qc.invalidateQueries({ queryKey: qk.unreadCounts })
      })
      // RLS limits these events to conversations the user participates in.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: qk.conversations.all })
        void qc.invalidateQueries({ queryKey: qk.unreadCounts })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, qc, navigate])

  React.useEffect(() => {
    if (!userId || !visible) return
    void touchLastSeen()
    const t = window.setInterval(() => void touchLastSeen(), 120_000)
    return () => window.clearInterval(t)
  }, [userId, visible])
}
