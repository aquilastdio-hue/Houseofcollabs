import { supabase } from '@/lib/supabase/client'
import { AppError, unwrap } from '@/lib/errors'
import { ownerPath, uploadFile } from '@/lib/supabase/storage'
import { validateFile } from '@/lib/validation/files'
import { optimizeImage } from '@/utils/media'
import type { Profile } from '@/types'

export async function getMyProfile(userId: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'avatar_url'
    | 'phone'
    | 'email_notifications'
    | 'email_orders'
    | 'email_payments'
    | 'email_campaigns'
    | 'email_account'
    | 'email_marketing'
  >
>

export async function updateMyProfile(userId: string, patch: ProfilePatch) {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single())
}

/** Validates, optimises, then uploads to `avatars/{uid}/…`; returns the public URL. */
export async function uploadAvatar(userId: string, file: File) {
  const problem = validateFile('avatars', file, { kinds: ['image'] })
  if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  const { blob, type } = await optimizeImage(file, 640, 0.86)
  const name = type === 'image/webp' ? 'avatar.webp' : file.name
  const uploaded = await uploadFile('avatars', ownerPath(userId, name), blob, { fileName: name, contentType: type, skipValidation: true })
  return uploaded.publicUrl!
}

export async function touchLastSeen() {
  await supabase.rpc('touch_last_seen')
}
