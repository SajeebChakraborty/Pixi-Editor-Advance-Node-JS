export interface VideoFilters {
  grayscale: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
  sepia: number
  hueRotate: number
  invert: number
}

export const DEFAULT_VIDEO_FILTERS: VideoFilters = {
  grayscale: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  hueRotate: 0,
  invert: 0,
}

export const buildVideoFilterCss = (filters: Partial<VideoFilters> = {}) => {
  const merged = { ...DEFAULT_VIDEO_FILTERS, ...filters }
  return [
    `grayscale(${merged.grayscale}%)`,
    `blur(${merged.blur}px)`,
    `brightness(${merged.brightness}%)`,
    `contrast(${merged.contrast}%)`,
    `saturate(${merged.saturation}%)`,
    `sepia(${merged.sepia}%)`,
    `hue-rotate(${merged.hueRotate}deg)`,
    `invert(${merged.invert}%)`,
  ].join(' ')
}

export const getEffectRange = (
  effectStartTime: number,
  effectEndTime: number,
  compositionDuration: number,
) => {
  const safeDuration = Math.max(0.1, compositionDuration)
  const start = Math.min(
    Math.max(0, effectStartTime),
    Math.max(0, safeDuration - 0.1),
  )
  const end =
    effectEndTime > 0
      ? Math.min(Math.max(start + 0.1, effectEndTime), safeDuration)
      : safeDuration

  return { start, end, duration: Math.max(0.1, end - start) }
}

export const isEffectActiveAtTime = (
  time: number,
  effectStartTime: number,
  effectEndTime: number,
  compositionDuration: number,
) => {
  const { start, end } = getEffectRange(
    effectStartTime,
    effectEndTime,
    compositionDuration,
  )
  return time >= start && time < end
}

export const applyResolvedFramePresentation = (
  element: HTMLElement,
  frame: {
    opacity: number
    translateXPercent: number
    translateYPercent: number
    scale: number
    clipInset: {
      top: number
      right: number
      bottom: number
      left: number
    }
  },
  filterCss: string,
) => {
  element.style.opacity = String(frame.opacity)
  element.style.filter = filterCss
  element.style.transformOrigin = 'center center'

  if (
    frame.translateXPercent ||
    frame.translateYPercent ||
    frame.scale !== 1
  ) {
    element.style.transform = `translate(${frame.translateXPercent}%, ${frame.translateYPercent}%) scale(${frame.scale})`
  } else {
    element.style.transform = ''
  }

  const { top, right, bottom, left } = frame.clipInset
  if (top || right || bottom || left) {
    element.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`
  } else {
    element.style.clipPath = ''
  }
}
