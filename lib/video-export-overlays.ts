import type { Canvas, FabricObject } from "fabric";
import { isMediaOverlayObject } from "./media-overlay";

export type OverlayExportState = {
  viewport: number[];
  objects: Array<{
    object: FabricObject;
    opacity: number;
    visible: boolean;
  }>;
};

/** Prepare the fabric canvas so image/text overlays can be rasterized for export. */
export function beginOverlayExportPass(fabricCanvas: Canvas): OverlayExportState {
  const viewport = (fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0]).slice();
  const objects = fabricCanvas.getObjects().map((object: any) => {
    const snapshot = {
      object,
      opacity: object.opacity,
      visible: object.visible,
    };

    if (object._videoEl) {
      object.visible = false;
      return snapshot;
    }

    if (isMediaOverlayObject(object)) {
      object.opacity = 1;
    }

    return snapshot;
  });

  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  return { viewport, objects };
}

export function drawOverlayExportPass(
  context: CanvasRenderingContext2D,
  fabricCanvas: Canvas,
  width: number,
  height: number,
) {
  fabricCanvas.renderAll();
  const element = fabricCanvas.toCanvasElement(1, {
    width,
    height,
  });
  context.drawImage(element, 0, 0, width, height);
}

export function endOverlayExportPass(
  fabricCanvas: Canvas,
  state: OverlayExportState,
) {
  fabricCanvas.setViewportTransform(state.viewport as any);
  state.objects.forEach(({ object, opacity, visible }) => {
    object.set({ opacity, visible });
  });
  fabricCanvas.requestRenderAll();
}
