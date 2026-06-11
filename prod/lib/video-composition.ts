import type { Layer } from "./store";

export type SceneTransitionType = "none" | "fade" | "dissolve";

export interface SceneTransition {
  type: SceneTransitionType;
  duration: number;
}

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

export const normalizeTransition = (
  value: unknown,
  maxDuration = Number.POSITIVE_INFINITY,
): SceneTransition => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<SceneTransition>)
      : {};
  const type: SceneTransitionType =
    candidate.type === "fade" || candidate.type === "dissolve"
      ? candidate.type
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
    const requestedBefore = normalizeTransition(layer.data?.transitionBefore);
    const previousAfter = previousScene?.transitionAfter;
    const boundaryTransition =
      previousAfter?.type && previousAfter.type !== "none"
        ? previousAfter
        : requestedBefore;
    const overlap = previousScene
      ? Math.min(
          boundaryTransition.duration,
          previousScene.duration / 2,
          duration / 2,
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
    let opacity = 1;
    const previousScene = composition.scenes[scene.order - 1];
    const nextScene = composition.scenes[scene.order + 1];

    if (
      previousScene &&
      scene.transitionBefore.type !== "none" &&
      safeTime < previousScene.timelineEnd
    ) {
      const progress =
        (safeTime - scene.timelineStart) /
        Math.max(MIN_SCENE_DURATION, scene.transitionBefore.duration);
      opacity = Math.min(1, Math.max(0, progress));
    }

    if (
      nextScene &&
      nextScene.transitionBefore.type !== "none" &&
      safeTime >= nextScene.timelineStart
    ) {
      const progress =
        (safeTime - nextScene.timelineStart) /
        Math.max(MIN_SCENE_DURATION, nextScene.transitionBefore.duration);
      opacity = Math.min(opacity, Math.max(0, 1 - progress));
    }

    if (
      !previousScene &&
      scene.transitionBefore.type === "fade" &&
      scene.transitionBefore.duration > 0
    ) {
      opacity = Math.min(
        opacity,
        (safeTime - scene.timelineStart) / scene.transitionBefore.duration,
      );
    }

    if (
      !nextScene &&
      scene.transitionAfter.type === "fade" &&
      scene.transitionAfter.duration > 0
    ) {
      opacity = Math.min(
        opacity,
        (scene.timelineEnd - safeTime) / scene.transitionAfter.duration,
      );
    }

    return {
      scene,
      sourceTime:
        scene.sourceStart + Math.max(0, safeTime - scene.timelineStart),
      opacity: Math.min(1, Math.max(0, opacity)),
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
        transitionBefore: scene.transitionBefore,
        transitionAfter: scene.transitionAfter,
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
