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
