import type { Layer } from "./store";
import {
  SCENE_TRANSITION_TYPES,
  type SceneTransitionType,
} from "./video-transitions";

export type { SceneTransitionType };

export interface SceneTransition {
  type: SceneTransitionType;
  duration: number;
}

export interface MidClipTransition {
  id: string;
  offset: number;
  duration: number;
  type: SceneTransitionType;
}

export const getMidClipTransitions = (layer: Layer): MidClipTransition[] => {
  const raw = layer.data?.transitionKeyframes;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => ({
      id: String(item?.id || ""),
      offset: finiteNonNegative(item?.offset),
      duration: finiteNonNegative(item?.duration),
      type: (item?.type || "none") as SceneTransitionType,
    }))
    .filter(
      (item) =>
        item.id && item.type !== "none" && item.duration >= MIN_SCENE_DURATION,
    );
};

export const clampMidClipTransition = (
  transition: Omit<MidClipTransition, "id">,
  clipDuration: number,
): Omit<MidClipTransition, "id"> => {
  const safeClipDuration = Math.max(MIN_SCENE_DURATION, clipDuration);
  const maxDuration = Math.max(
    MIN_SCENE_DURATION,
    Math.min(safeClipDuration / 2, safeClipDuration),
  );
  const duration =
    transition.type === "none"
      ? 0
      : Math.min(
          Math.max(MIN_SCENE_DURATION, transition.duration),
          maxDuration,
        );
  const maxOffset = Math.max(0, safeClipDuration - duration);
  const offset = Math.min(Math.max(0, transition.offset), maxOffset);

  return {
    ...transition,
    offset,
    duration,
  };
};

export const splitMidClipTransitions = (
  keyframes: MidClipTransition[],
  splitOffset: number,
  side: "left" | "right",
): MidClipTransition[] => {
  const splitAt = Math.max(0, splitOffset);

  return keyframes.flatMap((keyframe) => {
    const keyframeEnd = keyframe.offset + keyframe.duration;

    if (side === "left") {
      if (keyframe.offset >= splitAt) return [];
      if (keyframeEnd <= splitAt) return [keyframe];
      return [
        {
          ...keyframe,
          duration: Math.max(MIN_SCENE_DURATION, splitAt - keyframe.offset),
        },
      ];
    }

    if (keyframeEnd <= splitAt) return [];
    if (keyframe.offset >= splitAt) {
      return [
        {
          ...keyframe,
          offset: keyframe.offset - splitAt,
        },
      ];
    }

    return [
      {
        ...keyframe,
        id: keyframe.id,
        offset: 0,
        duration: Math.max(MIN_SCENE_DURATION, keyframeEnd - splitAt),
      },
    ];
  });
};

export interface CompositionScene {
  id: string;
  layer: Layer;
  order: number;
  timelineStart: number;
  timelineEnd: number;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  transitionBefore: SceneTransition;
  transitionAfter: SceneTransition;
}

export interface ResolvedSceneFrame {
  scene: CompositionScene;
  sourceTime: number;
  opacity: number;
  translateXPercent: number;
  translateYPercent: number;
  scale: number;
  clipInset: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface VideoComposition {
  scenes: CompositionScene[];
  duration: number;
}

const MIN_SCENE_DURATION = 0.1;
const DEFAULT_TRANSITION_DURATION = 0.5;

const finiteNonNegative = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const emptyClipInset = () => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

const defaultFrameStyle = () => ({
  opacity: 1,
  translateXPercent: 0,
  translateYPercent: 0,
  scale: 1,
  clipInset: emptyClipInset(),
});

const getTransitionProgress = (elapsed: number, duration: number) =>
  clamp01(elapsed / Math.max(MIN_SCENE_DURATION, duration));

const applyEnterTransition = (
  type: SceneTransitionType,
  progress: number,
) => {
  const style = defaultFrameStyle();

  switch (type) {
    case "fade":
    case "dissolve":
      style.opacity = progress;
      break;
    case "slide-left":
      style.translateXPercent = (1 - progress) * 100;
      break;
    case "slide-right":
      style.translateXPercent = -(1 - progress) * 100;
      break;
    case "slide-up":
      style.translateYPercent = (1 - progress) * 100;
      break;
    case "slide-down":
      style.translateYPercent = -(1 - progress) * 100;
      break;
    case "zoom-in":
      style.scale = 0.5 + progress * 0.5;
      style.opacity = progress;
      break;
    case "zoom-out":
      style.scale = 1.5 - progress * 0.5;
      style.opacity = progress;
      break;
    case "wipe-left":
      style.clipInset.right = (1 - progress) * 100;
      break;
    default:
      break;
  }

  return style;
};

const applyExitTransition = (
  type: SceneTransitionType,
  progress: number,
) => {
  const style = defaultFrameStyle();

  switch (type) {
    case "fade":
    case "dissolve":
      style.opacity = 1 - progress;
      break;
    case "slide-left":
      style.translateXPercent = -progress * 100;
      break;
    case "slide-right":
      style.translateXPercent = progress * 100;
      break;
    case "slide-up":
      style.translateYPercent = -progress * 100;
      break;
    case "slide-down":
      style.translateYPercent = progress * 100;
      break;
    case "zoom-in":
      style.scale = 1 + progress * 0.5;
      style.opacity = 1 - progress;
      break;
    case "zoom-out":
      style.scale = 1 - progress * 0.5;
      style.opacity = 1 - progress;
      break;
    case "wipe-left":
      style.clipInset.left = progress * 100;
      break;
    default:
      break;
  }

  return style;
};

const mergeFrameStyles = (
  base: ReturnType<typeof defaultFrameStyle>,
  overlay: ReturnType<typeof defaultFrameStyle>,
) => ({
  opacity: Math.min(base.opacity, overlay.opacity),
  translateXPercent: overlay.translateXPercent || base.translateXPercent,
  translateYPercent: overlay.translateYPercent || base.translateYPercent,
  scale: overlay.scale !== 1 ? overlay.scale : base.scale,
  clipInset: {
    top: Math.max(base.clipInset.top, overlay.clipInset.top),
    right: Math.max(base.clipInset.right, overlay.clipInset.right),
    bottom: Math.max(base.clipInset.bottom, overlay.clipInset.bottom),
    left: Math.max(base.clipInset.left, overlay.clipInset.left),
  },
});

export const getSceneOverlapDuration = (
  transition: SceneTransition,
  leftDuration: number,
  rightDuration: number,
) => {
  if (transition.type === "none" || transition.duration <= 0) return 0;
  return Math.min(
    transition.duration,
    leftDuration / 2,
    rightDuration / 2,
  );
};

export const normalizeTransition = (
  value: unknown,
  maxDuration = Number.POSITIVE_INFINITY,
): SceneTransition => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<SceneTransition>)
      : {};
  const type: SceneTransitionType = SCENE_TRANSITION_TYPES.includes(
    candidate.type as SceneTransitionType,
  )
    ? (candidate.type as SceneTransitionType)
    : "none";
  const requestedDuration = finiteNonNegative(
    candidate.duration,
    DEFAULT_TRANSITION_DURATION,
  );

  return {
    type,
    duration:
      type === "none"
        ? 0
        : Math.min(Math.max(MIN_SCENE_DURATION, requestedDuration), maxDuration),
  };
};

const getSceneOrder = (layer: Layer, fallback: number) => {
  const order = Number(layer.data?.sceneOrder);
  return Number.isFinite(order) ? order : fallback;
};

export const buildVideoComposition = (
  layers: Layer[],
): VideoComposition => {
  const orderedLayers = layers
    .filter((layer) => layer.type === "video" && layer.visible !== false)
    .map((layer, index) => ({ layer, index }))
    .sort((left, right) => {
      const orderDifference =
        getSceneOrder(left.layer, left.index) -
        getSceneOrder(right.layer, right.index);
      if (orderDifference !== 0) return orderDifference;
      return (
        finiteNonNegative(left.layer.startTime) -
        finiteNonNegative(right.layer.startTime)
      );
    });

  const scenes: CompositionScene[] = [];
  let cursor = 0;

  orderedLayers.forEach(({ layer }, index) => {
    const sourceStart = finiteNonNegative(layer.mediaStart);
    const sourceDuration = finiteNonNegative(layer.data?.sourceDuration);
    const requestedDuration = Math.max(
      MIN_SCENE_DURATION,
      finiteNonNegative(layer.duration, sourceDuration || MIN_SCENE_DURATION),
    );
    const duration =
      sourceDuration > 0
        ? Math.min(requestedDuration, Math.max(MIN_SCENE_DURATION, sourceDuration - sourceStart))
        : requestedDuration;
    const previousScene = scenes[index - 1];
    const boundaryTransition = previousScene
      ? normalizeTransition(previousScene.layer.data?.transitionAfter)
      : { type: "none" as const, duration: 0 };
    const overlap = previousScene
      ? getSceneOverlapDuration(
          boundaryTransition,
          previousScene.duration,
          duration,
        )
      : 0;

    cursor = previousScene ? previousScene.timelineEnd - overlap : 0;
    const transitionBefore = previousScene
      ? { ...boundaryTransition, duration: overlap }
      : normalizeTransition(layer.data?.transitionBefore, duration / 2);
    const transitionAfter = normalizeTransition(
      layer.data?.transitionAfter,
      duration / 2,
    );

    scenes.push({
      id: layer.id,
      layer,
      order: index,
      timelineStart: cursor,
      timelineEnd: cursor + duration,
      sourceStart,
      sourceEnd: sourceStart + duration,
      duration,
      transitionBefore,
      transitionAfter,
    });
    cursor += duration;
  });

  return {
    scenes,
    duration: scenes.at(-1)?.timelineEnd || 0,
  };
};

export const resolveCompositionFrame = (
  composition: VideoComposition,
  time: number,
): ResolvedSceneFrame[] => {
  if (composition.scenes.length === 0) return [];
  const safeTime = Math.min(
    Math.max(0, finiteNonNegative(time)),
    Math.max(0, composition.duration - 0.0001),
  );
  const activeScenes = composition.scenes.filter(
    (scene) =>
      safeTime >= scene.timelineStart && safeTime < scene.timelineEnd,
  );

  return activeScenes.map((scene) => {
    let style = defaultFrameStyle();
    const previousScene = composition.scenes[scene.order - 1];
    const nextScene = composition.scenes[scene.order + 1];
    const sceneElapsed = safeTime - scene.timelineStart;

    if (
      previousScene &&
      scene.transitionBefore.type !== "none" &&
      scene.transitionBefore.duration > 0 &&
      sceneElapsed < scene.transitionBefore.duration
    ) {
      const progress = getTransitionProgress(
        sceneElapsed,
        scene.transitionBefore.duration,
      );
      style = mergeFrameStyles(
        style,
        applyEnterTransition(scene.transitionBefore.type, progress),
      );
    }

    if (
      nextScene &&
      nextScene.transitionBefore.type !== "none" &&
      nextScene.transitionBefore.duration > 0
    ) {
      const junctionElapsed = safeTime - nextScene.timelineStart;
      if (
        junctionElapsed >= 0 &&
        junctionElapsed < nextScene.transitionBefore.duration
      ) {
        const progress = getTransitionProgress(
          junctionElapsed,
          nextScene.transitionBefore.duration,
        );
        style = mergeFrameStyles(
          style,
          applyExitTransition(nextScene.transitionBefore.type, progress),
        );
      }
    }

    if (
      !previousScene &&
      scene.transitionBefore.type !== "none" &&
      scene.transitionBefore.duration > 0 &&
      sceneElapsed < scene.transitionBefore.duration
    ) {
      const progress = getTransitionProgress(
        sceneElapsed,
        scene.transitionBefore.duration,
      );
      style = mergeFrameStyles(
        style,
        applyEnterTransition(scene.transitionBefore.type, progress),
      );
    }

    const userStart = normalizeTransition(scene.layer.data?.transitionBefore);
    if (
      previousScene &&
      userStart.type !== "none" &&
      userStart.duration > 0 &&
      sceneElapsed < userStart.duration
    ) {
      const progress = getTransitionProgress(sceneElapsed, userStart.duration);
      style = mergeFrameStyles(
        style,
        applyEnterTransition(userStart.type, progress),
      );
    }

    if (
      !nextScene &&
      scene.transitionAfter.type !== "none" &&
      scene.transitionAfter.duration > 0
    ) {
      const remaining = scene.timelineEnd - safeTime;
      if (remaining <= scene.transitionAfter.duration) {
        const progress = getTransitionProgress(
          scene.transitionAfter.duration - remaining,
          scene.transitionAfter.duration,
        );
        style = mergeFrameStyles(
          style,
          applyExitTransition(scene.transitionAfter.type, progress),
        );
      }
    }

    for (const midTransition of getMidClipTransitions(scene.layer)) {
      const midStart = midTransition.offset;
      const midEnd = midTransition.offset + midTransition.duration;
      if (sceneElapsed >= midStart && sceneElapsed < midEnd) {
        const progress = getTransitionProgress(
          sceneElapsed - midStart,
          midTransition.duration,
        );
        // Replace the frame during mid-clip transitions so the clip does not
        // flash full-frame before the animation starts.
        style = applyEnterTransition(midTransition.type, progress);
        break;
      }
    }

    return {
      scene,
      sourceTime:
        scene.sourceStart + Math.max(0, safeTime - scene.timelineStart),
      opacity: clamp01(style.opacity),
      translateXPercent: style.translateXPercent,
      translateYPercent: style.translateYPercent,
      scale: style.scale,
      clipInset: style.clipInset,
    };
  });
};

export const synchronizeVideoSceneLayers = (layers: Layer[]): Layer[] => {
  const composition = buildVideoComposition(layers);
  const sceneById = new Map(composition.scenes.map((scene) => [scene.id, scene]));

  return layers.map((layer) => {
    const scene = sceneById.get(layer.id);
    if (!scene) return layer;

    return {
      ...layer,
      startTime: scene.timelineStart,
      duration: scene.duration,
      mediaStart: scene.sourceStart,
      track: 0,
      data: {
        ...(layer.data || {}),
        sceneOrder: scene.order,
      },
    };
  });
};

export const reorderVideoScenes = (
  layers: Layer[],
  sceneId: string,
  targetIndex: number,
): Layer[] => {
  const composition = buildVideoComposition(layers);
  const orderedIds = composition.scenes.map((scene) => scene.id);
  const currentIndex = orderedIds.indexOf(sceneId);
  if (currentIndex === -1) return layers;
  const safeTargetIndex = Math.min(
    Math.max(0, targetIndex),
    orderedIds.length - 1,
  );
  if (currentIndex === safeTargetIndex) return layers;

  const [movedId] = orderedIds.splice(currentIndex, 1);
  orderedIds.splice(safeTargetIndex, 0, movedId);
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));

  return synchronizeVideoSceneLayers(
    layers.map((layer) =>
      orderById.has(layer.id)
        ? {
            ...layer,
            data: {
              ...(layer.data || {}),
              sceneOrder: orderById.get(layer.id),
            },
          }
        : layer,
    ),
  );
};
