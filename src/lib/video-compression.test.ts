import { afterEach, describe, expect, it, vi } from 'vitest'
import { alreadyEfficient, canCompressVideo, describeSaving, encodingPlan, isVideoFile, prepareUpload, targetDimensions } from './video-compression'

const MB = 1024 * 1024
const fileOf = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type })

describe('targetDimensions', () => {
  it('shrinks 4K landscape to 1080p', () => {
    expect(targetDimensions(3840, 2160, 'balanced')).toEqual({ width: 1920, height: 1080, downscaled: true })
  })

  it('shrinks portrait phone video to 1080 wide, keeping it portrait', () => {
    expect(targetDimensions(2160, 3840, 'balanced')).toEqual({ width: 1080, height: 1920, downscaled: true })
  })

  it('never upscales', () => {
    expect(targetDimensions(1280, 720, 'balanced')).toEqual({ width: 1280, height: 720, downscaled: false })
    expect(targetDimensions(640, 360, 'high')).toEqual({ width: 640, height: 360, downscaled: false })
  })

  it('uses 720p for the fast preset', () => {
    expect(targetDimensions(1920, 1080, 'fast')).toEqual({ width: 1280, height: 720, downscaled: true })
  })

  it('keeps sides even for H.264 and keeps the aspect ratio', () => {
    const out = targetDimensions(2000, 1333, 'balanced')
    expect(out.width % 2).toBe(0)
    expect(out.height % 2).toBe(0)
    expect(out.width / out.height).toBeCloseTo(2000 / 1333, 2)
  })
})

describe('alreadyEfficient', () => {
  // Balanced is 4 Mbps video + 128 kbps audio ≈ 0.52 MB per second.
  it('skips a video already near the target bitrate', () => {
    expect(alreadyEfficient(30 * MB, 60, false, 'balanced')).toBe(true)
  })

  it('compresses a video well above the target bitrate', () => {
    expect(alreadyEfficient(200 * MB, 60, false, 'balanced')).toBe(false)
  })

  it('always compresses when the picture has to shrink', () => {
    expect(alreadyEfficient(5 * MB, 60, true, 'balanced')).toBe(false)
  })

  it('does not trust a missing duration', () => {
    expect(alreadyEfficient(5 * MB, 0, false, 'balanced')).toBe(false)
    expect(alreadyEfficient(5 * MB, Number.NaN, false, 'balanced')).toBe(false)
  })
})

describe('encodingPlan', () => {
  it('uses the preset as is when the clip fits', () => {
    expect(encodingPlan(3840, 2160, 20, 'balanced', 20 * MB)).toMatchObject({ width: 1920, height: 1080, videoBitrate: 4_000_000, constrained: false, fits: true })
  })

  it('lowers the bitrate so a long clip fits its limit', () => {
    const plan = encodingPlan(1080, 1920, 45, 'balanced', 20 * MB)
    expect(plan.constrained).toBe(true)
    expect(plan.fits).toBe(true)
    // video + audio at the planned rate stays inside the limit
    expect(((plan.videoBitrate + 128_000) * 45) / 8).toBeLessThan(20 * MB)
    expect({ width: plan.width, height: plan.height }).toEqual({ width: 1080, height: 1920 })
  })

  it('drops to 720p when the bitrate gets too low for 1080p', () => {
    // A 90 s reel still gets ~1.55 Mbps under 20 MB — enough for 1080p; two minutes does not.
    expect(encodingPlan(1080, 1920, 90, 'balanced', 20 * MB)).toMatchObject({ width: 1080, height: 1920, fits: true })
    const plan = encodingPlan(1080, 1920, 120, 'balanced', 20 * MB)
    expect(plan.fits).toBe(true)
    expect({ width: plan.width, height: plan.height }).toEqual({ width: 720, height: 1280 })
  })

  it('gives up on a clip far too long for its limit', () => {
    expect(encodingPlan(1920, 1080, 600, 'balanced', 20 * MB).fits).toBe(false)
  })

  it('ignores the limit when the duration is unknown', () => {
    expect(encodingPlan(1920, 1080, 0, 'balanced', 20 * MB)).toMatchObject({ constrained: false, fits: true })
  })
})

describe('isVideoFile', () => {
  it('recognises videos by type or by extension', () => {
    expect(isVideoFile(fileOf('a.mp4', 'video/mp4', 1))).toBe(true)
    expect(isVideoFile(fileOf('IMG_0001.MOV', '', 1))).toBe(true)
    expect(isVideoFile(fileOf('a.jpg', 'image/jpeg', 1))).toBe(false)
  })
})

describe('describeSaving', () => {
  it('says how much was saved', () => {
    expect(describeSaving({ compressed: true, originalSize: 200 * MB, file: fileOf('a.mp4', 'video/mp4', 30 * MB) })).toMatch(/85% smaller/)
  })

  it('says nothing when the original was kept', () => {
    expect(describeSaving({ compressed: false, originalSize: 10, file: fileOf('a.mp4', 'video/mp4', 10) })).toBeNull()
  })
})

describe('prepareUpload without WebCodecs', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is what the test runner looks like: no encoder', () => {
    expect(canCompressVideo()).toBe(false)
  })

  it('passes a video under the limit through untouched', async () => {
    const file = fileOf('clip.mp4', 'video/mp4', 2 * MB)
    const result = await prepareUpload('applications', file)
    expect(result).toEqual({ file, compressed: false, originalSize: file.size })
  })

  it('refuses a video over the limit, as before', async () => {
    const file = fileOf('clip.mp4', 'video/mp4', 21 * MB)
    await expect(prepareUpload('applications', file)).rejects.toThrow(/larger than 20/)
  })

  it('still refuses the wrong file type', async () => {
    await expect(prepareUpload('creator-portfolio', fileOf('notes.txt', 'text/plain', 10))).rejects.toThrow(/aren’t supported/)
  })

  it('leaves images to the existing checks', async () => {
    const file = fileOf('photo.jpg', 'image/jpeg', 1 * MB)
    expect((await prepareUpload('creator-portfolio', file)).file).toBe(file)
  })
})
