import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { qk } from '@/lib/query-keys'
import { getOrder, listOrders, quoteOrder, type OrderListParams } from '@/services/orders.service'

export function useOrders(params: OrderListParams, enabled = true) {
  return useQuery({
    queryKey: qk.orders.list(params),
    queryFn: () => listOrders(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Order detail + realtime refresh on status / history / deliverable changes. */
export function useOrder(id?: string) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: qk.orders.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id })

  React.useEffect(() => {
    if (!id) return
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: qk.orders.detail(id) })
    }
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${id}` }, refresh)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, qc])

  return query
}

export function useOrderQuote(serviceId?: string, addonIds: string[] = []) {
  const sorted = React.useMemo(() => [...addonIds].sort(), [addonIds])
  return useQuery({
    queryKey: qk.orders.quote(serviceId ?? '', sorted),
    queryFn: () => quoteOrder(serviceId!, sorted),
    enabled: !!serviceId,
    placeholderData: keepPreviousData,
  })
}

/**
 * Wraps an order workflow call; on success refreshes the order, lists,
 * dashboards and counters so every screen reflects the new state.
 */
export function useOrderAction<TVars, TResult>(orderId: string | undefined, fn: (vars: TVars) => Promise<TResult>, successMessage?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    meta: successMessage ? { successMessage } : undefined,
    onSettled: () => {
      if (orderId) void qc.invalidateQueries({ queryKey: qk.orders.detail(orderId) })
      void qc.invalidateQueries({ queryKey: ['orders', 'list'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: qk.earnings.all })
      void qc.invalidateQueries({ queryKey: qk.unreadCounts })
    },
  })
}
