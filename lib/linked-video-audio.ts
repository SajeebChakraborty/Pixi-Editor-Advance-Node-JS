import type { Layer, LinkedVideoAudio } from "./store";

const clampVolume = (value: unknown) =>
  Math.min(1, Math.max(0, Number(value ?? 1)));

export const getLinkedVideoAudio = (
  layer: Layer | undefined,
): LinkedVideoAudio | null => {
  if (layer?.type !== "video") return null;
  const value = layer.data?.linkedAudio;
  if (!value || typeof value !== "object" || !value.url) return null;

  return {
    url: String(value.url),
    name: String(value.name || "Linked audio"),
    sourceDuration: Math.max(0, Number(value.sourceDuration || 0)),
    volume: clampVolume(value.volume),
    loop: Boolean(value.loop),
    allowNativeAudio: Boolean(value.allowNativeAudio),
  };
};

export const getLinkedAudioTargetTime = (
  linkedAudio: LinkedVideoAudio,
  sceneElapsed: number,
) => {
  const safeElapsed = Math.max(0, sceneElapsed);
  if (linkedAudio.loop && linkedAudio.sourceDuration > 0) {
    return safeElapsed % linkedAudio.sourceDuration;
  }
  return safeElapsed;
};

export const isLinkedAudioActive = (
  linkedAudio: LinkedVideoAudio,
  sceneElapsed: number,
) =>
  linkedAudio.loop ||
  linkedAudio.sourceDuration <= 0 ||
  sceneElapsed < linkedAudio.sourceDuration;
