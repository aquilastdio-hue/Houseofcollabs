import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { ReportTarget } from '@/types'

export async function createReport(targetType: ReportTarget, targetId: string, reason: string, description?: string) {
  return unwrap(
    await supabase.rpc('create_report', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_description: description,
    }),
  )
}

export async function submitContactMessage(input: { name: string; email: string; company?: string; topic?: string; message: string }) {
  unwrap(
    await supabase.from('contact_messages').insert({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      company: input.company?.trim() || null,
      topic: input.topic || null,
      message: input.message.trim(),
    }),
  )
}
