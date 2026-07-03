import type { Layer } from './store'
import type { VideoComposition } from './video-composition'
import { getLinkedVideoAudio } from './linked-video-audio'
import { IMAGE_PRESETS } from './editor-actions'
import type { VideoFilters } from './video-filters'
import { DEFAULT_VIDEO_FILTERS } from './video-filters'
import type { ImagePresetId } from './editor-actions'
import { SCENE_TRANSITION_OPTIONS } from './video-transitions'
import { OVERLAY_LAYER_TYPES } from './layer-stack'

const transitionLabel = (type: string) =>
  SCENE_TRANSITION_OPTIONS.find((option) => option.value === type)?.label ||
  type.replace(/-/g, ' ')

export type TimelineSegmentKind =
  | 'video'
  | 'audio'
  | 'video-sound'
  | 'effects'
  | 'text'
  | 'image'
  | 'overlay'
  | 'transition'

export interface TimelineSegment {
  id: string
  kind: TimelineSegmentKind
  label: string
  startTime: number
  duration: number
  layerId?: string
  virtual?: boolean
  selectable?: boolean
  draggable?: boolean
  resizable?: boolean
  transitionSide?: 'before' | 'after'
  transitionType?: string
  linkedLayerName?: string
}

export type TimelineRowKind =
  | 'video'
  | 'audio'
  | 'effects'
  | 'overlay'
  | 'transitions'

export interface TimelineRow {
  id: string
  kind: TimelineRowKind
  label: string
  trackIndex: number
  segments: TimelineSegment[]
  addable?: boolean
}

const hasActiveEffects = (
  filterPreset: ImagePresetId | string | undefined,
  filters: Partial<VideoFilters>,
) => {
  if (filterPreset && filterPreset !== 'none') return true

  return (
    (filters.grayscale ?? 0) !== DEFAULT_VIDEO_FILTERS.grayscale ||
    (filters.blur ?? 0) !== DEFAULT_VIDEO_FILTERS.blur ||
    (filters.brightness ?? 100) !== DEFAULT_VIDEO_FILTERS.brightness ||
    (filters.contrast ?? 100) !== DEFAULT_VIDEO_FILTERS.contrast ||
    (filters.saturation ?? 100) !== DEFAULT_VIDEO_FILTERS.saturation ||
    (filters.sepia ?? 0) !== DEFAULT_VIDEO_FILTERS.sepia ||
    (filters.hueRotate ?? 0) !== DEFAULT_VIDEO_FILTERS.hueRotate ||
    (filters.invert ?? 0) !== DEFAULT_VIDEO_FILTERS.invert
  )
}

export const EFFECT_RANGE_LAYER_ID = '__effect-range__'

export const buildTimelineRows = ({
  layers,
  composition,
  filterPreset,
  filterPresetIntensity,
  filters,
  effectStartTime = 0,
  effectEndTime = 0,
}: {
  layers: Layer[]
  composition: VideoComposition
  filterPreset?: ImagePresetId | string
  filterPresetIntensity?: number
  filters: Partial<VideoFilters>
  effectStartTime?: number
  effectEndTime?: number
}): TimelineRow[] => {
  const rows: TimelineRow[] = []
  const compositionDuration = Math.max(0.1, composition.duration || 0.1)

  const overlayLayers = layers.filter((layer) =>
    ['text', 'image', 'sticker', 'shape'].includes(layer.type),
  )
  const overlayTrackMap = new Map<number, Layer[]>()

  overlayLayers.forEach((layer) => {
    const track = typeof layer.track === 'number' ? layer.track : 3
    if (!overlayTrackMap.has(track)) overlayTrackMap.set(track, [])
    overlayTrackMap.get(track)!.push(layer)
  })

  Array.from(overlayTrackMap.entries())
    .sort(([left], [right]) => right - left)
    .forEach(([trackIndex, trackLayers]) => {
      rows.push({
        id: `row-overlay-${trackIndex}`,
        kind: 'overlay',
        label:
          trackLayers.length === 1
            ? trackLayers[0].type === 'text'
              ? 'Text'
              : trackLayers[0].type === 'image'
                ? 'Image'
                : 'Overlay'
            : `Overlay ${trackIndex - 2}`,
        trackIndex,
        segments: trackLayers.map((layer) => ({
          id: layer.id,
          kind: layer.type === 'text' ? 'text' : 'overlay',
          label: layer.name || layer.type,
          startTime: Number(layer.startTime || 0),
          duration: Number(layer.duration || 0),
          layerId: layer.id,
          selectable: true,
          draggable: true,
          resizable: true,
        })),
        addable: true,
      })
    })

  const videoLayers = layers.filter((layer) => layer.type === 'video')
  rows.push({
    id: 'row-video',
    kind: 'video',
    label: videoLayers.length > 1 ? 'Video Clips' : 'Video',
    trackIndex: 0,
    segments: composition.scenes.map((scene) => ({
      id: scene.layer.id,
      kind: 'video',
      label: scene.layer.name || 'Video',
      startTime: scene.timelineStart,
      duration: scene.duration,
      layerId: scene.layer.id,
      selectable: true,
      draggable: true,
      resizable: true,
    })),
    addable: true,
  })

  const transitionSegments: TimelineSegment[] = []
  composition.scenes.forEach((scene, index) => {
    const layerName = scene.layer.name || 'Video'
    const before = scene.transitionBefore
    if (before.type !== 'none' && before.duration > 0) {
      const overlapStart = Math.max(
        0,
        scene.timelineStart - before.duration,
      )
      transitionSegments.push({
        id: `transition-before-${scene.id}`,
        kind: 'transition',
        label: `${index === 0 ? 'Open' : 'In'}: ${transitionLabel(before.type)}`,
        startTime: overlapStart,
        duration: before.duration,
        layerId: scene.layer.id,
        virtual: true,
        selectable: true,
        draggable: false,
        resizable: true,
        transitionSide: 'before',
        transitionType: before.type,
        linkedLayerName: layerName,
      })
    }

    const after = scene.transitionAfter
    if (after.type !== 'none' && after.duration > 0) {
      const overlapStart = Math.max(
        0,
        scene.timelineEnd - after.duration,
      )
      transitionSegments.push({
        id: `transition-after-${scene.id}`,
        kind: 'transition',
        label: `Out: ${transitionLabel(after.type)}`,
        startTime: overlapStart,
        duration: after.duration,
        layerId: scene.layer.id,
        virtual: true,
        selectable: true,
        draggable: false,
        resizable: true,
        transitionSide: 'after',
        transitionType: after.type,
        linkedLayerName: layerName,
      })
    }
  })

  if (transitionSegments.length > 0) {
    rows.push({
      id: 'row-transitions',
      kind: 'transitions',
      label: 'Transitions',
      trackIndex: 0.5,
      segments: transitionSegments,
    })
  }

  const soundSegments: TimelineSegment[] = []

  composition.scenes.forEach((scene) => {
    const linkedAudio = getLinkedVideoAudio(scene.layer)
    if (linkedAudio && !linkedAudio.allowNativeAudio) {
      soundSegments.push({
        id: `linked-audio-${scene.layer.id}`,
        kind: 'video-sound',
        label: linkedAudio.name || 'Linked Audio',
        startTime: scene.timelineStart,
        duration: scene.duration,
        layerId: scene.layer.id,
        virtual: true,
        selectable: true,
        draggable: false,
        resizable: true,
      })
      return
    }

    soundSegments.push({
      id: `video-sound-${scene.layer.id}`,
      kind: 'video-sound',
      label: `${scene.layer.name || 'Video'} Sound`,
      startTime: scene.timelineStart,
      duration: scene.duration,
      layerId: scene.layer.id,
      virtual: true,
      selectable: true,
      draggable: false,
      resizable: true,
    })
  })

  layers
    .filter((layer) => layer.type === 'audio')
    .forEach((layer) => {
      soundSegments.push({
        id: layer.id,
        kind: 'audio',
        label: layer.name || 'Audio',
        startTime: Number(layer.startTime || 0),
        duration: Number(layer.duration || 0),
        layerId: layer.id,
        selectable: true,
        draggable: true,
        resizable: true,
      })
    })

  rows.push({
    id: 'row-audio',
    kind: 'audio',
    label: 'Sound',
    trackIndex: 1,
    segments: soundSegments,
    addable: true,
  })

  const effectLabel =
    filterPreset && filterPreset !== 'none'
      ? IMAGE_PRESETS.find((item) => item.id === filterPreset)?.label ||
        'Custom Effect'
      : hasActiveEffects(filterPreset, filters)
        ? 'Custom Adjust'
        : 'Effects'

  const effectRangeStart = Math.max(0, effectStartTime)
  const effectRangeEnd =
    effectEndTime > 0 ? effectEndTime : compositionDuration
  const effectRangeDuration = Math.max(
    0.1,
    Math.min(compositionDuration, effectRangeEnd) - effectRangeStart,
  )

  rows.push({
    id: 'row-effects',
    kind: 'effects',
    label: 'Effects',
    trackIndex: 2,
    segments: hasActiveEffects(filterPreset, filters)
      ? [
          {
            id: 'global-effects',
            kind: 'effects',
            label:
              filterPreset && filterPreset !== 'none'
                ? `${effectLabel} (${filterPresetIntensity ?? 100}%)`
                : effectLabel,
            startTime: effectRangeStart,
            duration: effectRangeDuration,
            layerId: EFFECT_RANGE_LAYER_ID,
            virtual: true,
            selectable: true,
            draggable: true,
            resizable: true,
          },
        ]
      : [
          {
            id: 'effects-placeholder',
            kind: 'effects',
            label: 'No effects applied',
            startTime: 0,
            duration: compositionDuration,
            virtual: true,
            selectable: false,
            draggable: false,
            resizable: false,
          },
        ],
  })

  return rows
}

export const getNextOverlayTrack = (layers: Layer[]) => {
  const overlayTracks = layers
    .filter((layer) => OVERLAY_LAYER_TYPES.has(layer.type))
    .map((layer) => layer.track ?? 0);

  return Math.max(3, ...overlayTracks, 2) + 1;
}
