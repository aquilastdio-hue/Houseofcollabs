import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { Json } from '@/types/database.types'

/**
 * Email campaigns (migration 0021): an admin writes an email once, picks who
 * gets it and when — now, once at a set time, or every day — and the database
 * queues one email per person for send-notification to deliver.
 */

export type EmailAudience = 'creators' | 'brands' | 'everyone' | 'specific'
export type EmailSchedule = 'now' | 'once' | 'daily'
export type EmailCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'sent'

export type EmailCampaignPerson = { id: string; name: string; email: string; role: string; avatar: string | null }

export type EmailCampaign = {
  id: string
  subject: string
  body: string
  audience: EmailAudience
  recipient_ids: string[]
  schedule: EmailSchedule
  send_at: string | null
  /** 'HH:MM:SS', India time. */
  daily_time: string | null
  /** 'creator_daily' is the daily creator email: same as any campaign plus an "Update my profile" button. */
  email_type: 'email_campaign' | 'creator_daily'
  status: EmailCampaignStatus
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
  /** Emails queued over the campaign's life (tests excluded), and how they went. */
  total: number
  delivered: number
  failed: number
  waiting: number
  /** Logged but not sent: no email provider connected (migration 0022). */
  skipped: number
  /** Emails queued by the most recent run. */
  last_run_count: number
  /** People the audience reaches right now. */
  recipients_now: number
  /** The picked people, for 'specific'. */
  people: EmailCampaignPerson[]
}

export type EmailCampaignInput = {
  subject: string
  body: string
  audience: EmailAudience
  recipient_ids: string[]
  schedule: EmailSchedule
  /** ISO timestamp, for 'once'. */
  send_at: string | null
  /** 'HH:MM', India time, for 'daily'. */
  daily_time: string | null
}

export type EmailCampaignAction = 'launch' | 'pause' | 'resume' | 'delete'

export async function listEmailCampaigns(): Promise<EmailCampaign[]> {
  return (unwrap(await supabase.rpc('admin_email_campaigns')) ?? []) as unknown as EmailCampaign[]
}

/** How many people an audience reaches right now. */
export async function emailCampaignReach(audience: EmailAudience, ids: string[] = []): Promise<number> {
  return unwrap(await supabase.rpc('admin_email_campaign_reach', { p_audience: audience, p_ids: ids }))
}

/** Creates a campaign (no id) or saves changes; returns its id. */
export async function saveEmailCampaign(id: string | null, input: EmailCampaignInput): Promise<string> {
  return unwrap(await supabase.rpc('admin_save_email_campaign', { p_campaign_id: id, p_data: input as unknown as Json }))
}

export async function emailCampaignAction(id: string, action: EmailCampaignAction): Promise<{ action: EmailCampaignAction; queued: number }> {
  return unwrap(await supabase.rpc('admin_email_campaign_action', { p_campaign_id: id, p_action: action })) as unknown as {
    action: EmailCampaignAction
    queued: number
  }
}

/** Sends one copy of the saved campaign to the signed-in admin; returns the address. */
export async function testEmailCampaign(id: string): Promise<string> {
  return unwrap(await supabase.rpc('admin_test_email_campaign', { p_campaign_id: id }))
}
