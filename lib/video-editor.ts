import { resolveVideoPlaybackUrl, videoNeedsCrossOrigin } from './video-playback-url'

export interface VideoTrim {
  startTime: number // seconds
  endTime: number // seconds
}

export interface VideoOverlay {
  id: string
  type: 'text' | 'image' | 'sticker'
  content: string // text or image URL
  x: number
  y: number
  width: number
  height: number
  opacity: number
  startTime: number // seconds
  endTime: number // seconds
  rotation?: number
  color?: string // for text
  fontSize?: number // for text
}

export interface VideoSettings {
  url: string
  width: number
  height: number
  duration: number
  trim?: VideoTrim
  speed: number // 0.5, 1, 1.5, 2
  muted: boolean
  overlays: VideoOverlay[]
}

export class VideoEditor {
  /**
   * Get video metadata
   */
  static async getVideoMetadata(
    videoUrl: string
  ): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const resolved = resolveVideoPlaybackUrl(videoUrl)
      if (videoNeedsCrossOrigin(resolved)) {
        video.crossOrigin = 'anonymous'
      }
      video.preload = 'metadata'

      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        })
      }

      video.onerror = () => {
        reject(new Error('Failed to load video'))
      }

      video.src = resolved
      video.load()
    })
  }

  /**
   * Create video preview with current settings
   */
  static createPreviewCanvas(
    videoElement: HTMLVideoElement,
    settings: VideoSettings,
    currentTime: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = settings.width
    canvas.height = settings.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    // Draw video frame
    ctx.drawImage(videoElement, 0, 0, settings.width, settings.height)

    // Draw overlays
    const activeOverlays = settings.overlays.filter(
      (o) => currentTime >= o.startTime && currentTime <= o.endTime
    )

    activeOverlays.forEach((overlay) => {
      ctx.globalAlpha = overlay.opacity

      if (overlay.type === 'text') {
        ctx.font = `${overlay.fontSize || 20}px Arial`
        ctx.fillStyle = overlay.color || '#ffffff'
        ctx.fillText(overlay.content, overlay.x, overlay.y)
      } else if (overlay.type === 'image' || overlay.type === 'sticker') {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          ctx.globalAlpha = overlay.opacity
          if (overlay.rotation) {
            ctx.save()
            ctx.translate(overlay.x + overlay.width / 2, overlay.y + overlay.height / 2)
            ctx.rotate((overlay.rotation * Math.PI) / 180)
            ctx.drawImage(img, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height)
            ctx.restore()
          } else {
            ctx.drawImage(img, overlay.x, overlay.y, overlay.width, overlay.height)
          }
          ctx.globalAlpha = 1
        }
        img.src = overlay.content
      }

      ctx.globalAlpha = 1
    })

    return canvas
  }

  /**
   * Calculate export parameters
   */
  static getExportParams(settings: VideoSettings) {
    const trimDuration = settings.trim
      ? settings.trim.endTime - settings.trim.startTime
      : settings.duration

    const actualDuration = trimDuration / settings.speed

    return {
      startTime: settings.trim?.startTime || 0,
      duration: trimDuration,
      speed: settings.speed,
      actualDuration,
      videoFilter: settings.muted ? '' : '-c:a aac',
    }
  }

  /**
   * Format time for display
   */
  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  /**
   * Add text overlay
   */
  static addTextOverlay(settings: VideoSettings, overlay: Omit<VideoOverlay, 'id'>) {
    const id = `overlay-${Date.now()}-${Math.random()}`
    settings.overlays.push({ ...overlay, id })
    return id
  }

  /**
   * Remove overlay
   */
  static removeOverlay(settings: VideoSettings, overlayId: string) {
    settings.overlays = settings.overlays.filter((o) => o.id !== overlayId)
  }

  /**
   * Update overlay
   */
  static updateOverlay(
    settings: VideoSettings,
    overlayId: string,
    updates: Partial<VideoOverlay>
  ) {
    const overlay = settings.overlays.find((o) => o.id === overlayId)
    if (overlay) {
      Object.assign(overlay, updates)
    }
  }

  /**
   * Set trim
   */
  static setTrim(settings: VideoSettings, startTime: number, endTime: number) {
    if (startTime >= 0 && endTime <= settings.duration && startTime < endTime) {
      settings.trim = { startTime, endTime }
    }
  }

  /**
   * Set playback speed
   */
  static setSpeed(settings: VideoSettings, speed: number) {
    const validSpeeds = [0.5, 1, 1.5, 2]
    if (validSpeeds.includes(speed)) {
      settings.speed = speed
    }
  }
}
