import * as React from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { qk } from '@/lib/query-keys'
import { uuid } from '@/lib/utils'
import {
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from '@/services/messages.service'
import type { Attachment, Message } from '@/types'

export type ChatMessage = Message & { pending?: boolean; failed?: boolean }
type Page = { items: ChatMessage[]; hasMore: boolean }

export function useConversations(archived: boolean, search: string) {
  return useQuery({
    queryKey: qk.conversations.list(archived, search),
    queryFn: () => listConversations(archived, search),
    staleTime: 15_000,
  })
}

export function useConversation(id?: string) {
  return useQuery({ queryKey: qk.conversations.detail(id ?? ''), queryFn: () => getConversation(id!), enabled: !!id })
}

function upsertMessage(data: InfiniteData<Page, string | undefined> | undefined, msg: ChatMessage) {
  if (!data) return data
  let found = false
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((m) => {
      if (m.id === msg.id) {
        found = true
        return { ...m, ...msg, pending: false, failed: msg.failed }
      }
      return m
    }),
  }))
  if (!found && pages[0]) pages[0] = { ...pages[0], items: [...pages[0].items, msg] }
  return { ...data, pages }
}

/** Paged history (older on demand) + realtime inserts/updates + optimistic send. */
export function useMessages(conversationId?: string, currentUserId?: string) {
  const qc = useQueryClient()
  const key = qk.messages(conversationId ?? '')

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }): Promise<Page> => listMessages(conversationId!, { before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.created_at : undefined),
    enabled: !!conversationId,
    staleTime: Infinity,
  })

  React.useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const msg = payload.new as Message
        qc.setQueryData<InfiniteData<Page, string | undefined>>(key, (old) => upsertMessage(old, msg))
        if (msg.sender_id !== currentUserId) void markConversationRead(conversationId).then(() => qc.invalidateQueries({ queryKey: qk.unreadCounts }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        qc.setQueryData<InfiniteData<Page, string | undefined>>(key, (old) => upsertMessage(old, payload.new as Message))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId, qc])

  const messages = React.useMemo(() => (query.data ? [...query.data.pages].reverse().flatMap((p) => p.items) : []), [query.data])

  const send = useMutation({
    meta: { silent: true },
    mutationFn: (input: { body?: string; attachments?: Attachment[]; id: string }) =>
      sendMessage({ id: input.id, conversationId: conversationId!, senderId: currentUserId!, body: input.body, attachments: input.attachments }),
    onMutate: (input) => {
      const optimistic: ChatMessage = {
        id: input.id,
        conversation_id: conversationId!,
        sender_id: currentUserId!,
        body: input.body?.trim() || null,
        attachments: (input.attachments ?? []) as unknown as Message['attachments'],
        message_type: 'text',
        metadata: {},
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        pending: true,
      }
      qc.setQueryData<InfiniteData<Page, string | undefined>>(key, (old) => upsertMessage(old, optimistic))
    },
    onSuccess: (msg) => {
      qc.setQueryData<InfiniteData<Page, string | undefined>>(key, (old) => upsertMessage(old, msg))
      void qc.invalidateQueries({ queryKey: qk.conversations.all })
    },
    onError: (_e, input) => {
      qc.setQueryData<InfiniteData<Page, string | undefined>>(key, (old) => {
        if (!old) return old
        return { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === input.id ? { ...m, pending: false, failed: true } : m)) })) }
      })
    },
  })

  const sendText = React.useCallback(
    (body: string, attachments?: Attachment[]) => send.mutate({ id: uuid(), body, attachments }),
    [send],
  )

  const retry = React.useCallback(
    (m: ChatMessage) => send.mutate({ id: m.id, body: m.body ?? undefined, attachments: (m.attachments as unknown as Attachment[]) ?? [] }),
    [send],
  )

  return { ...query, messages, sendText, retry, sending: send.isPending }
}

type PresenceState = { user_id: string; online_at: string }

/** Online state + typing indicator over a private Realtime channel. */
export function useConversationPresence(conversationId?: string, userId?: string) {
  const [onlineIds, setOnlineIds] = React.useState<string[]>([])
  const [typingIds, setTypingIds] = React.useState<string[]>([])
  const channelRef = React.useRef<RealtimeChannel | null>(null)
  const timers = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    if (!conversationId || !userId) return
    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: { private: true, presence: { key: userId }, broadcast: { self: false } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        setOnlineIds(Object.keys(state))
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const id = (payload as { user_id?: string }).user_id
        if (!id || id === userId) return
        setTypingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        window.clearTimeout(timers.current[id])
        timers.current[id] = window.setTimeout(() => setTypingIds((prev) => prev.filter((x) => x !== id)), 3000)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ user_id: userId, online_at: new Date().toISOString() })
      })
    channelRef.current = channel
    const pending = timers.current
    return () => {
      Object.values(pending).forEach((t) => window.clearTimeout(t))
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [conversationId, userId])

  const lastTyping = React.useRef(0)
  const notifyTyping = React.useCallback(() => {
    const now = Date.now()
    if (!channelRef.current || now - lastTyping.current < 1500) return
    lastTyping.current = now
    void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId } })
  }, [userId])

  return { onlineIds, typingIds, notifyTyping }
}
