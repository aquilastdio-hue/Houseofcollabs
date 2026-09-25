import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { TablesInsert, TablesUpdate } from '@/types'

const SERVICE_SELECT = '*, service_addons ( * )' as const

export async function listMyServices(creatorId: string) {
  const data = unwrap(
    await supabase
      .from('creator_services')
      .select(SERVICE_SELECT)
      .eq('creator_id', creatorId)
      .is('archived_at', null)
      .order('sort_order')
      .order('created_at'),
  )
  return data.map((s) => ({ ...s, service_addons: [...s.service_addons].sort((a, b) => a.sort_order - b.sort_order) }))
}
export type MyService = Awaited<ReturnType<typeof listMyServices>>[number]

export type ServiceInput = Pick<
  TablesInsert<'creator_services'>,
  'title' | 'description' | 'price' | 'delivery_days' | 'revisions_included' | 'includes' | 'content_type' | 'platform' | 'requires_shipping' | 'active' | 'sort_order'
>

export async function createService(creatorId: string, input: ServiceInput) {
  return unwrap(await supabase.from('creator_services').insert({ ...input, creator_id: creatorId }).select(SERVICE_SELECT).single())
}

export async function updateService(id: string, patch: Partial<ServiceInput>) {
  return unwrap(await supabase.from('creator_services').update(patch).eq('id', id).select(SERVICE_SELECT).single())
}

/** Services referenced by orders are archived (hidden) rather than deleted. */
export async function archiveService(id: string) {
  const patch: TablesUpdate<'creator_services'> = { archived_at: new Date().toISOString(), active: false }
  unwrap(await supabase.from('creator_services').update(patch).eq('id', id))
}

export type AddonInput = Pick<
  TablesInsert<'service_addons'>,
  'name' | 'description' | 'price' | 'addon_type' | 'extra_revisions' | 'delivery_days_override' | 'active' | 'sort_order'
>

export async function createAddon(serviceId: string, input: AddonInput) {
  return unwrap(await supabase.from('service_addons').insert({ ...input, service_id: serviceId }).select('*').single())
}

export async function updateAddon(id: string, patch: Partial<AddonInput>) {
  return unwrap(await supabase.from('service_addons').update(patch).eq('id', id).select('*').single())
}

export async function deleteAddon(id: string) {
  unwrap(await supabase.from('service_addons').delete().eq('id', id))
}
