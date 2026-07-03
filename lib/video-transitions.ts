export const SCENE_TRANSITION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'wipe-left', label: 'Wipe Left' },
] as const

export const SCENE_TRANSITION_TYPES = SCENE_TRANSITION_OPTIONS.map(
  (option) => option.value,
)

export type SceneTransitionType = (typeof SCENE_TRANSITION_TYPES)[number]

export const SCENE_TRANSITION_DESCRIPTIONS: Record<
  SceneTransitionType,
  string
> = {
  none: 'No transition — clips cut directly.',
  fade: 'Outgoing clip fades out while the next fades in.',
  dissolve: 'Smooth crossfade blend between both clips.',
  'slide-left': 'Next clip slides in from the right.',
  'slide-right': 'Next clip slides in from the left.',
  'slide-up': 'Next clip slides in from the bottom.',
  'slide-down': 'Next clip slides in from the top.',
  'zoom-in': 'Next clip zooms in over the outgoing clip.',
  'zoom-out': 'Outgoing clip zooms away revealing the next.',
  'wipe-left': 'Next clip wipes in from the right edge.',
}
