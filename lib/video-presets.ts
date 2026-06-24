import {
  DEFAULT_IMAGE_PRESET_INTENSITY,
  getPresetFilterSpecs,
  IMAGE_PRESETS,
  normalizeImagePreset,
  normalizeImagePresetIntensity,
  type ImagePresetId,
} from './editor-actions'
import {
  DEFAULT_VIDEO_FILTERS,
  type VideoFilters,
} from './video-filters'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount

const hexToHueEstimate = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return 0

  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  if (delta === 0) return 0

  let hue = 0
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4

  return Math.round((hue * 60 + 360) % 360)
}

export const buildVideoFiltersFromPreset = (
  preset: ImagePresetId | string,
  presetIntensity = DEFAULT_IMAGE_PRESET_INTENSITY,
): VideoFilters => {
  const safePreset = normalizeImagePreset(preset)
  const intensity = normalizeImagePresetIntensity(presetIntensity) / 100

  if (safePreset === 'none' || intensity <= 0) {
    return { ...DEFAULT_VIDEO_FILTERS }
  }

  const specs = getPresetFilterSpecs(safePreset, presetIntensity)
  let brightness = 0
  let contrast = 0
  let saturation = 0
  let hueRotate = 0
  let sepia = 0
  let grayscale = 0

  specs.forEach((spec) => {
    const options = spec.options || {}

    switch (spec.name) {
      case 'Brightness':
        brightness += Number(options.brightness) || 0
        break
      case 'Contrast':
        contrast += Number(options.contrast) || 0
        break
      case 'Saturation': {
        const value = Number(options.saturation) || 0
        if (value <= -0.99) grayscale = 100
        else saturation += value
        break
      }
      case 'HueRotation':
        hueRotate += (Number(options.rotation) || 0) * 180
        break
      case 'Vibrance':
        saturation += (Number(options.vibrance) || 0) * 0.65
        break
      case 'BlendColor': {
        const alpha = Number(options.alpha) || 0
        const color = String(options.color || '')
        sepia += alpha * 55
        hueRotate += hexToHueEstimate(color) * alpha * 0.35
        if (options.mode === 'screen') brightness += alpha * 0.08
        break
      }
      default:
        break
    }
  })

  const target: VideoFilters = {
    grayscale: clamp(grayscale * 100, 0, 100),
    blur: 0,
    brightness: clamp(100 + brightness * 100, 50, 200),
    contrast: clamp(100 + contrast * 100, 50, 200),
    saturation:
      grayscale >= 99
        ? 100
        : clamp(100 + saturation * 100, 0, 200),
    sepia: clamp(sepia * 100, 0, 100),
    hueRotate: clamp(Math.round(hueRotate), 0, 360),
    invert: 0,
  }

  return {
    grayscale: Math.round(lerp(DEFAULT_VIDEO_FILTERS.grayscale, target.grayscale, intensity)),
    blur: 0,
    brightness: Math.round(lerp(DEFAULT_VIDEO_FILTERS.brightness, target.brightness, intensity)),
    contrast: Math.round(lerp(DEFAULT_VIDEO_FILTERS.contrast, target.contrast, intensity)),
    saturation: Math.round(lerp(DEFAULT_VIDEO_FILTERS.saturation, target.saturation, intensity)),
    sepia: Math.round(lerp(DEFAULT_VIDEO_FILTERS.sepia, target.sepia, intensity)),
    hueRotate: Math.round(lerp(DEFAULT_VIDEO_FILTERS.hueRotate, target.hueRotate, intensity)),
    invert: 0,
  }
}

export { IMAGE_PRESETS, type ImagePresetId }
