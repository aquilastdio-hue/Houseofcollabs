import { fileExtension } from '@/lib/utils'
import { formatBytes } from '@/lib/format'

export type Bucket =
  | 'avatars'
  | 'creator-portfolio'
  | 'brand-assets'
  | 'brief-attachments'
  | 'order-deliverables'
  | 'message-attachments'
  | 'verification-documents'
  | 'applications'

export const PUBLIC_BUCKETS: readonly Bucket[] = ['avatars', 'creator-portfolio', 'brand-assets']

const IMAGES = { mime: ['image/jpeg', 'image/png', 'image/webp'], ext: ['jpg', 'jpeg', 'png', 'webp'] }
const GIF = { mime: ['image/gif'], ext: ['gif'] }
const VIDEOS = { mime: ['video/mp4', 'video/webm', 'video/quicktime'], ext: ['mp4', 'webm', 'mov'] }
const AUDIO = {
  mime: ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg'],
  ext: ['webm', 'mp3', 'm4a', 'mp4', 'wav', 'ogg'],
}
const DOCS = {
  mime: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  ext: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
}
const ZIP = { mime: ['application/zip', 'application/x-zip-compressed'], ext: ['zip'] }

function merge(...sets: { mime: string[]; ext: string[] }[]) {
  return { mime: sets.flatMap((s) => s.mime), ext: sets.flatMap((s) => s.ext) }
}

const MB = 1024 * 1024

/** Mirrors bucket limits + storage policies in migration 0013. */
export const BUCKET_RULES: Record<Bucket, { maxBytes: number; mime: string[]; ext: string[]; accept: string }> = {
  avatars: { maxBytes: 5 * MB, ...IMAGES, accept: IMAGES.mime.join(',') },
  'creator-portfolio': { maxBytes: 50 * MB, ...merge(IMAGES, GIF, VIDEOS), accept: [...IMAGES.mime, ...GIF.mime, ...VIDEOS.mime].join(',') },
  'brand-assets': { maxBytes: 10 * MB, ...merge(IMAGES, AUDIO), accept: [...IMAGES.mime, ...AUDIO.mime].join(',') },
  'brief-attachments': { maxBytes: 25 * MB, ...merge(IMAGES, GIF, DOCS, VIDEOS, ZIP), accept: '' },
  applications: {
    maxBytes: 20 * MB,
    ...merge(IMAGES, VIDEOS, { mime: ['application/pdf'], ext: ['pdf'] }),
    accept: [...VIDEOS.mime, ...IMAGES.mime, 'application/pdf'].join(','),
  },
  'verification-documents': {
    maxBytes: 10 * MB,
    ...merge(IMAGES, { mime: ['application/pdf'], ext: ['pdf'] }),
    accept: [...IMAGES.mime, 'application/pdf'].join(','),
  },
  'order-deliverables': {
    maxBytes: 50 * MB,
    ...merge(IMAGES, GIF, VIDEOS, { mime: ['application/pdf', 'text/plain'], ext: ['pdf', 'txt'] }, ZIP),
    accept: '',
  },
  'message-attachments': {
    maxBytes: 25 * MB,
    ...merge(IMAGES, GIF, VIDEOS, ZIP, {
      mime: [
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      ext: ['pdf', 'txt', 'docx', 'xlsx', 'pptx'],
    }),
    accept: '',
  },
}

/** Normalises a browser MIME type (strips codec parameters). */
export function baseMime(type: string) {
  return type.split(';')[0]!.trim().toLowerCase()
}

/** Returns a user-facing error, or null when the file is acceptable. */
export function validateFile(bucket: Bucket, file: File, opts: { maxBytes?: number; kinds?: ('image' | 'video' | 'audio' | 'doc')[] } = {}) {
  const rules = BUCKET_RULES[bucket]
  const max = Math.min(opts.maxBytes ?? rules.maxBytes, rules.maxBytes)
  const ext = fileExtension(file.name)
  const mime = baseMime(file.type || '')
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > max) return `${file.name} is larger than ${formatBytes(max)}.`
  if (!rules.ext.includes(ext)) return `.${ext || '?'} files aren’t supported here.`
  if (mime && !rules.mime.includes(mime)) return `${file.name} has an unsupported file type.`
  if (opts.kinds?.length) {
    const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'doc'
    if (!opts.kinds.includes(kind)) return `Please choose ${opts.kinds.join(' or ')} files.`
  }
  return null
}

export function acceptFor(bucket: Bucket, kinds?: ('image' | 'video' | 'audio' | 'doc')[]) {
  const rules = BUCKET_RULES[bucket]
  const mimes = kinds?.length
    ? rules.mime.filter((m) =>
        kinds.some((k) => (k === 'doc' ? !/^(image|video|audio)\//.test(m) : m.startsWith(`${k}/`))),
      )
    : rules.mime
  return [...mimes, ...rules.ext.map((e) => `.${e}`)].join(',')
}
