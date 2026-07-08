import type { Layer } from "./store";

const VIDEO_Z_BASE = 10;
const MEDIA_Z_BASE = 100;

/** HTML video overlay z-index inside the video overlay root. */
export const computeVideoOverlayZIndex = (sceneOrder: number) =>
  VIDEO_Z_BASE + Math.max(0, sceneOrder) * 2;

/** HTML image/text overlay z-index inside the media overlay root. */
export const computeMediaOverlayZIndex = (
  layer: Layer | undefined,
  stackIndex: number,
) =>
  MEDIA_Z_BASE +
  Math.max(0, layer?.track ?? 0) * 10 +
  Math.max(1, stackIndex);
