/**
 * Client-side media helpers: image optimisation before upload and video
 * thumbnail capture. Everything runs in the browser; nothing leaves the
 * device until the optimised file is uploaded to Supabase Storage.
 */

export type ImageInfo = { blob: Blob; width: number; height: number; type: string }

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed.'))), type, quality)
  })
}

/**
 * Downscales to `maxSize` on the longest edge and re-encodes as WebP.
 * GIFs are returned untouched (animation would be lost).
 */
export async function optimizeImage(file: File, maxSize = 1600, quality = 0.84): Promise<ImageInfo> {
  if (file.type === 'image/gif') {
    const img = await loadImage(file)
    return { blob: file, width: img.naturalWidth, height: img.naturalHeight, type: file.type }
  }
  const img = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, width: img.naturalWidth, height: img.naturalHeight, type: file.type }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await canvasToBlob(canvas, 'image/webp', quality)
  // Keep the original if re-encoding made it bigger (e.g. tiny PNGs).
  if (blob.size > file.size && scale === 1) return { blob: file, width, height, type: file.type }
  return { blob, width, height, type: 'image/webp' }
}

export type VideoInfo = { thumbnail: Blob; width: number; height: number; duration: number }

/** Grabs a frame (~10% in, max 1s) as a WebP poster and reads dimensions/duration. */
export function captureVideoThumbnail(file: File, maxSize = 900): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = url
    const cleanup = () => URL.revokeObjectURL(url)
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not read that video. Try MP4 (H.264).'))
    }
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 1) * 0.1)
    }
    video.onseeked = async () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbnail = await canvasToBlob(canvas, 'image/webp', 0.8)
        resolve({ thumbnail, width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      } catch (e) {
        reject(e)
      } finally {
        cleanup()
      }
    }
  })
}

export function isImage(mime?: string | null) {
  return !!mime && mime.startsWith('image/')
}

export function isVideo(mime?: string | null) {
  return !!mime && mime.startsWith('video/')
}

export function isVideoUrl(url?: string | null) {
  return !!url && /\.(mp4|webm|mov)(\?|$)/i.test(url)
}
