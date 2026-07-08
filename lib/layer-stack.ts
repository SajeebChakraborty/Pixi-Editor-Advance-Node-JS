import type { Canvas, FabricObject } from "fabric";
import type { Layer } from "./store";
import { useEditorStore } from "./store";
import { applyOverlayControlVisibility } from "./fabric-transform-controls";
import { syncMediaOverlays } from "./media-overlay";
import { syncVideoOverlays } from "./video-overlay";

export const OVERLAY_LAYER_TYPES = new Set([
  "text",
  "image",
  "sticker",
  "shape",
]);

const getLayerObject = (canvas: Canvas, layer: Layer) => {
  if (!layer.objectId) return null;
  return (
    canvas
      .getObjects()
      .find((object) => (object as any).name === layer.objectId) || null
  );
};

/** Keep video placeholders at the back and overlay layers in front by track order. */
export function syncFabricLayerStack(
  canvas: Canvas | null | undefined,
  layers: Layer[],
) {
  if (!canvas) return;

  const videoObjects: FabricObject[] = [];
  const overlayEntries: {
    layer: Layer;
    object: FabricObject;
    index: number;
  }[] = [];

  layers.forEach((layer, index) => {
    const object = getLayerObject(canvas, layer);
    if (!object) return;

    if (layer.type === "video") {
      videoObjects.push(object);
      return;
    }

    if (OVERLAY_LAYER_TYPES.has(layer.type)) {
      overlayEntries.push({ layer, object, index });
    }
  });

  canvas.getObjects().forEach((object) => {
    if ((object as any)._videoEl && !videoObjects.includes(object)) {
      videoObjects.push(object);
    }
  });

  const overlayObjectIds = new Set(
    overlayEntries.map((entry) => (entry.object as any).name),
  );

  canvas.getObjects().forEach((object, index) => {
    if ((object as any)._videoEl) return;
    if (overlayObjectIds.has((object as any).name)) return;

    const type = String((object as any).type || "").toLowerCase();
    const isOverlayObject =
      type === "i-text" ||
      type === "textbox" ||
      type === "text" ||
      type === "image" ||
      type === "group";

    if (!isOverlayObject) return;

    overlayEntries.push({
      layer: {
        id: `orphan-${(object as any).name || index}`,
        type: type.includes("text") ? "text" : "image",
        name: String((object as any).name || "Overlay"),
        locked: false,
        visible: true,
        track: 9999,
      },
      object,
      index: 10_000 + index,
    });
  });

  videoObjects.forEach((object) => {
    (object as any).opacity = 0.004;
    canvas.sendObjectToBack(object);
  });

  overlayEntries
    .sort((left, right) => {
      const trackDelta = (left.layer.track ?? 0) - (right.layer.track ?? 0);
      if (trackDelta !== 0) return trackDelta;
      return left.index - right.index;
    })
    .forEach(({ object, layer }) => {
      canvas.bringObjectToFront(object);
      if (useEditorStore.getState().editorMode === "video" && !layer.locked) {
        applyOverlayControlVisibility(object);
        object.set({
          lockMovementX: Boolean(layer.locked),
          lockMovementY: Boolean(layer.locked),
          lockScalingX: Boolean(layer.locked),
          lockScalingY: Boolean(layer.locked),
          evented: !layer.locked,
          selectable: !layer.locked,
          uniformScaling: false,
        });
      }
    });

  syncVideoOverlays(canvas);
  syncMediaOverlays(canvas, layers);
  canvas.requestRenderAll();
}

export function getTopOverlayTrack(layers: Layer[]) {
  const overlayTracks = layers
    .filter((layer) => OVERLAY_LAYER_TYPES.has(layer.type))
    .map((layer) => layer.track ?? 0);

  return Math.max(3, ...overlayTracks, 2) + 1;
}

export function swapOverlayTracks(
  layers: Layer[],
  sourceTrack: number,
  targetTrack: number,
): Layer[] {
  if (sourceTrack === targetTrack) return layers;

  return layers.map((layer) => {
    if (!OVERLAY_LAYER_TYPES.has(layer.type)) return layer;
    const track = layer.track ?? 0;
    if (track === sourceTrack) return { ...layer, track: targetTrack };
    if (track === targetTrack) return { ...layer, track: sourceTrack };
    return layer;
  });
}
