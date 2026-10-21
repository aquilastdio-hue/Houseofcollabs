import { AppError } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { BUCKET_RULES, validateFile, type Bucket } from '@/lib/validation/files'

/**
 * Videos are compressed in the browser before they upload, so a 300 MB phone
 * clip goes up as ~30 MB instead of being refused for size.
 *
 * Encoding uses WebCodecs (through Mediabunny), which runs on the device's
 * hardware video encoder: fast, no multi-megabyte WASM download, and no
 * cross-origin-isolation headers that would break Google sign-in or Razorpay.
 * The library is only loaded the first time a video is picked.
 *
 * Whenever compression can't help — the browser has no encoder, the codec
 * can't be decoded, or the result isn't meaningfully smaller — the original
 * file is used, exactly as before this existed. Compression never blocks an
 * upload that would otherwise have worked.
 */

export type VideoPreset = 'fast' | 'balanced' | 'high'

/** Output box (never upscaled) and video bitrate per preset. 1080p fits 1920×1080 either way round. */
export const VIDEO_PRESETS: Record<VideoPreset, { longEdge: number; shortEdge: number; videoBitrate: number }> = {
  fast: { longEdge: 1280, shortEdge: 720, videoBitrate: 2_500_000 },
  balanced: { longEdge: 1920, shortEdge: 1080, videoBitrate: 4_000_000 },
  high: { longEdge: 1920, shortEdge: 1080, videoBitrate: 8_000_000 },
}

const AUDIO_BITRATE = 128_000

/** Re-encoding must save at least this much, or the original is kept. */
const MIN_SAVING = 0.1

/** Lowest video bitrate worth producing. A clip that needs less to fit its limit is too long for it. */
const MIN_VIDEO_BITRATE = 600_000
/** Below this, 720p looks better than 1080p at the same bitrate, so the picture drops to 720p. */
const HD_FLOOR = 1_500_000
/** Share of a size limit aimed for, leaving room for the MP4 container and encoder overshoot. */
const SIZE_SAFETY = 0.9

export type CompressResult = {
  /** What to upload: the compressed MP4, or the original when compressing didn't help. */
  file: File
  compressed: boolean
  originalSize: number
  /** Why the original was kept, when that is worth telling someone whose file is then too big. */
  skipped?: 'unsupported' | 'too-long'
}

export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(file.name)
}

/** True when the browser has the WebCodecs encoder this needs (every current browser except old Safari/Firefox). */
export function canCompressVideo() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'
}

/**
 * The output size for a preset: shrunk to fit its box, never enlarged, aspect
 * ratio kept, and rounded to even numbers as H.264 requires. Portrait and
 * landscape fit the same box turned on its side.
 */
export function targetDimensions(width: number, height: number, preset: VideoPreset) {
  const p = VIDEO_PRESETS[preset]
  const scale = Math.min(1, p.longEdge / Math.max(width, height), p.shortEdge / Math.min(width, height))
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return { width: even(width), height: even(height), downscaled: scale < 1 }
}

/**
 * Whether a video is already about as small as the preset would make it, so
 * re-encoding would cost the user time and quality for little or no saving.
 */
export function alreadyEfficient(fileSize: number, durationSeconds: number, downscaled: boolean, preset: VideoPreset) {
  if (downscaled || !(durationSeconds > 0)) return false
  const expected = ((VIDEO_PRESETS[preset].videoBitrate + AUDIO_BITRATE) * durationSeconds) / 8
  return fileSize <= expected * (1 + MIN_SAVING)
}

/**
 * How to encode a clip. Normally the preset's size and bitrate; when that would
 * overshoot `maxBytes` (a long clip against a 20 MB limit), the bitrate is cut
 * to what fits and held constant so the size is predictable, and the picture
 * drops to 720p once the bitrate is too low to carry 1080p well. `fits` is
 * false when even the lowest watchable bitrate would be over the limit.
 */
export function encodingPlan(width: number, height: number, durationSeconds: number, preset: VideoPreset, maxBytes?: number) {
  let box = preset
  let videoBitrate = VIDEO_PRESETS[preset].videoBitrate
  let constrained = false
  if (maxBytes !== undefined && durationSeconds > 0) {
    const budget = Math.floor((maxBytes * SIZE_SAFETY * 8) / durationSeconds) - AUDIO_BITRATE
    if (budget < videoBitrate) {
      constrained = true
      videoBitrate = budget
      if (budget < HD_FLOOR && VIDEO_PRESETS[box].shortEdge > VIDEO_PRESETS.fast.shortEdge) box = 'fast'
    }
  }
  return { ...targetDimensions(width, height, box), videoBitrate, constrained, fits: videoBitrate >= MIN_VIDEO_BITRATE }
}

/**
 * Compresses `file` to H.264/AAC MP4 with the given preset, under `maxBytes`
 * when given. Resolves to the original whenever compressing isn't possible or
 * doesn't pay off; rejects only when `signal` aborts.
 */
export async function compressVideo(
  file: File,
  opts: {
    preset?: VideoPreset
    /** Leave anything at or under this size untouched (used where originals matter, like paid deliverables). */
    onlyAbove?: number
    /** The upload limit the result has to fit under. */
    maxBytes?: number
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
  } = {},
): Promise<CompressResult> {
  const preset = opts.preset ?? 'balanced'
  const original: CompressResult = { file, compressed: false, originalSize: file.size }
  const unsupported: CompressResult = { ...original, skipped: 'unsupported' }
  if (!isVideoFile(file)) return original
  if (!canCompressVideo()) return unsupported
  if (opts.onlyAbove !== undefined && file.size <= opts.onlyAbove) return original

  const mb = await import('mediabunny')
  const inputs: InstanceType<typeof mb.Input>[] = []
  const openInput = () => {
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
    inputs.push(input)
    return input
  }

  /** One encoding pass with `plan`. Resolves to the MP4 bytes, or null when this browser can't do it. */
  const encode = async (plan: ReturnType<typeof encodingPlan>, hasAudio: boolean) => {
    const videoQuality = new mb.Quality({ bitrate: plan.videoBitrate, bitrateMode: plan.constrained ? 'constant' : 'variable' })
    const encodable =
      (await mb.canEncodeVideo('avc', { width: plan.width, height: plan.height, quality: videoQuality })) &&
      (!hasAudio || (await mb.canEncodeAudio('aac')))
    // Dropping the sound to save space is never acceptable, so no AAC means no compression.
    if (!encodable) return null

    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
    const conversion = await mb.Conversion.init({
      input: openInput(),
      output,
      tracks: 'primary',
      video: {
        codec: 'avc',
        quality: videoQuality,
        // Only resize when shrinking; both sides are given so they stay even,
        // and 'fill' absorbs the sub-pixel rounding without bars or a crop.
        ...(plan.downscaled ? { width: plan.width, height: plan.height, fit: 'fill' as const } : {}),
      },
      audio: { codec: 'aac', quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) },
    })
    if (!conversion.isValid) return null

    if (opts.onProgress) {
      const report = opts.onProgress
      conversion.onProgress = (fraction) => report(Math.min(1, Math.max(0, fraction)))
    }
    const cancel = () => void conversion.cancel()
    opts.signal?.throwIfAborted()
    opts.signal?.addEventListener('abort', cancel, { once: true })
    try {
      await conversion.execute()
    } finally {
      opts.signal?.removeEventListener('abort', cancel)
    }
    return output.target.buffer
  }

  try {
    const input = openInput()
    const video = await input.getPrimaryVideoTrack()
    if (!video) return unsupported
    const hasAudio = !!(await input.getPrimaryAudioTrack())
    const duration = await input.computeDuration()
    const plan = encodingPlan(video.displayWidth, video.displayHeight, duration, preset, opts.maxBytes)
    // Too long to fit the limit at any watchable quality: don't spend minutes finding that out.
    if (!plan.fits) return { ...original, skipped: 'too-long' }
    const mustShrink = opts.maxBytes !== undefined && file.size > opts.maxBytes
    if (opts.onlyAbove === undefined && !mustShrink && alreadyEfficient(file.size, duration, plan.downscaled, preset)) return original

    let buffer = await encode(plan, hasAudio)
    if (!buffer) return unsupported
    // Hardware encoders have a floor: on very busy footage (confetti, rain,
    // crowds) they won't go below a few Mbps at 1080p, whatever they're asked.
    // If that left a clip over its limit, one more pass at 720p carries the same
    // floor in well under half the space. The progress bar restarts for it.
    if (opts.maxBytes !== undefined && buffer.byteLength > opts.maxBytes && preset !== 'fast') {
      const smaller = encodingPlan(video.displayWidth, video.displayHeight, duration, 'fast', opts.maxBytes)
      if (smaller.fits && smaller.downscaled) buffer = (await encode(smaller, hasAudio)) ?? buffer
    }

    // Over the limit, any real shrink is worth having; otherwise it has to be a meaningful one.
    if (buffer.byteLength >= file.size || (!mustShrink && buffer.byteLength > file.size * (1 - MIN_SAVING))) return original
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'video'}.mp4`
    return { file: new File([buffer], name, { type: 'video/mp4', lastModified: Date.now() }), compressed: true, originalSize: file.size }
  } catch (error) {
    if (opts.signal?.aborted || error instanceof mb.ConversionCanceledError) {
      throw new AppError('Upload cancelled.', { kind: 'validation', code: 'CANCELLED', cause: error })
    }
    // A codec this browser can't decode (e.g. HEVC on some desktops), a broken
    // file, running out of memory: fall back to uploading it as it is.
    console.warn('Video compression skipped:', error)
    return unsupported
  } finally {
    for (const input of inputs) input.dispose()
  }
}

/** Where compression applies, and how hard. Paid deliverables are only touched when they'd otherwise be refused. */
const BUCKET_VIDEO_POLICY: Partial<Record<Bucket, { preset: VideoPreset; onlyWhenOverLimit?: boolean }>> = {
  applications: { preset: 'balanced' },
  'creator-portfolio': { preset: 'balanced' },
  'brief-attachments': { preset: 'balanced' },
  'order-deliverables': { preset: 'high', onlyWhenOverLimit: true },
}

export type PreparedUpload = CompressResult

/**
 * The file to actually upload to `bucket`: checked for type first, then — if it
 * is a video and the bucket compresses videos — compressed, and only then
 * checked against the size limit. A big phone video that compresses under the
 * limit goes through; one that is still too big afterwards is refused with a
 * message that says so.
 */
export async function prepareUpload(
  bucket: Bucket,
  file: File,
  opts: { kinds?: ('image' | 'video' | 'audio' | 'doc')[]; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<PreparedUpload> {
  const policy = isVideoFile(file) ? BUCKET_VIDEO_POLICY[bucket] : undefined
  const max = BUCKET_RULES[bucket].maxBytes
  if (!policy || !canCompressVideo()) {
    const problem = validateFile(bucket, file, { kinds: opts.kinds })
    if (problem && policy && file.size > max) {
      // A browser without WebCodecs would otherwise have shrunk this.
      throw new AppError(`${problem} Try a shorter clip, or upload from Chrome, Edge or Safari, which compress videos automatically.`, {
        kind: 'validation',
        code: 'INVALID_FILE',
      })
    }
    if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
    return { file, compressed: false, originalSize: file.size }
  }

  const typeProblem = validateFile(bucket, file, { kinds: opts.kinds, ignoreSize: true })
  if (typeProblem) throw new AppError(typeProblem, { kind: 'validation', code: 'INVALID_FILE' })

  const result = await compressVideo(file, {
    preset: policy.preset,
    onlyAbove: policy.onlyWhenOverLimit ? max : undefined,
    maxBytes: max,
    onProgress: opts.onProgress,
    signal: opts.signal,
  })
  if (result.file.size > max) {
    const limit = formatBytes(max)
    const message = result.compressed
      ? `${file.name} is still ${formatBytes(result.file.size)} after compressing — the limit is ${limit}. Try a shorter clip.`
      : result.skipped === 'too-long'
        ? `${file.name} is too long to fit in ${limit}, even compressed. Try a shorter clip.`
        : result.skipped === 'unsupported'
          ? `${file.name} is larger than ${limit} and couldn’t be compressed in this browser. Try a shorter clip, or save it as an MP4 first.`
          : `${file.name} is larger than ${limit}. Try a shorter clip.`
    throw new AppError(message, { kind: 'validation', code: 'INVALID_FILE' })
  }
  return result
}

/** "Compressed 212 MB → 31 MB (85% smaller)" for showing what was saved. */
export function describeSaving(result: Pick<CompressResult, 'compressed' | 'originalSize' | 'file'>) {
  if (!result.compressed) return null
  const saved = Math.round((1 - result.file.size / result.originalSize) * 100)
  return `Compressed ${formatBytes(result.originalSize)} → ${formatBytes(result.file.size)} (${saved}% smaller)`
}
