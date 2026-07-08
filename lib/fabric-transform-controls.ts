import * as fabric from "fabric";
import type { IText } from "fabric";

const HANDLE_COLOR = "#ffffff";
const HANDLE_STROKE = "#6366f1";
const BORDER_COLOR = "#a855f7";

const isTextFabricObject = (object: fabric.FabricObject) => {
  const type = String(object.type || "").toLowerCase();
  return type === "i-text" || type === "textbox" || type === "text";
};

/** 8 resize handles (corners + edges), no rotation — matches video canvas UX. */
export function applyFabricTransformControls(object: fabric.FabricObject) {
  object.set({
    borderColor: BORDER_COLOR,
    borderScaleFactor: 1.5,
    borderDashArray: [],
    transparentCorners: false,
    cornerColor: HANDLE_COLOR,
    cornerStrokeColor: HANDLE_STROKE,
    cornerSize: 14,
    cornerStyle: "rect",
    padding: 6,
    borderOpacityWhenMoving: 1,
    strokeUniform: true,
    hasControls: true,
    hasBorders: true,
    hasRotatingPoint: false,
  });

  if (object.controls?.mtr) {
    object.controls.mtr.visible = false;
  }
}

/** Drag/resize overlays on the video canvas (HTML preview + invisible fabric target). */
export function applyVideoResizeControls(object: fabric.FabricObject) {
  applyFabricTransformControls(object);

  object.set({
    selectable: true,
    evented: true,
    lockMovementX: false,
    lockMovementY: false,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: true,
    uniformScaling: false,
    centeredScaling: true,
    hasControls: true,
    hasBorders: true,
    perPixelTargetFind: true,
    hoverCursor: "nwse-resize",
    moveCursor: "move",
  });

  const controls = object.controls;
  if (controls) {
    (["tl", "tr", "bl", "br", "ml", "mr", "mt", "mb"] as const).forEach(
      (key) => {
        if (controls[key]) controls[key].visible = true;
      },
    );
    if (controls.mtr) controls.mtr.visible = false;
  }
}

/** Drag/resize overlays on the video canvas (HTML preview + invisible fabric target). */
export function applyVideoOverlayControls(object: fabric.FabricObject) {
  applyVideoResizeControls(object);

  const isText = isTextFabricObject(object);
  object.set({
    padding: isText ? 14 : 10,
    ...(isText ? { editable: false, lockRotation: false } : {}),
  });

  if (!isText) return;

  const text = object as IText & {
    __videoOverlayDblClick?: (event: fabric.TEvent) => void;
    __videoOverlayEditExit?: () => void;
  };

  if (text.__videoOverlayDblClick) {
    text.off("mousedblclick", text.__videoOverlayDblClick);
  }
  if (text.__videoOverlayEditExit) {
    text.off("editing:exited", text.__videoOverlayEditExit);
  }

  text.__videoOverlayDblClick = () => {
    text.editable = true;
    text.enterEditing();
    text.__videoOverlayEditExit = () => {
      text.editable = false;
      text.setCoords();
      (text as any)._syncMediaOverlay?.();
      if (text.__videoOverlayEditExit) {
        text.off("editing:exited", text.__videoOverlayEditExit);
        text.__videoOverlayEditExit = undefined;
      }
    };
    text.on("editing:exited", text.__videoOverlayEditExit);
  };
  text.on("mousedblclick", text.__videoOverlayDblClick);
}

/** Keep fabric controls visible even when the HTML preview carries the pixels. */
export const applyOverlayControlVisibility = (object: fabric.FabricObject) => {
  if ((object as fabric.FabricObject & { _videoEl?: unknown })._videoEl) {
    applyVideoResizeControls(object);
  } else {
    applyVideoOverlayControls(object);
  }

  object.set({
    hasControls: true,
    hasBorders: true,
    selectable: true,
    evented: true,
    opacity: 0.004,
    stroke: "rgba(255,255,255,0.01)",
    strokeWidth: 1,
  });
  object.setCoords();
};

export function installFabricTransformControlDefaults(canvas: fabric.Canvas) {
  fabric.Object.prototype.set({
    borderColor: BORDER_COLOR,
    cornerColor: HANDLE_COLOR,
    cornerStrokeColor: HANDLE_STROKE,
    cornerStyle: "rect",
    transparentCorners: false,
    hasRotatingPoint: false,
  });

  canvas.on("object:added", (event) => {
    if (event.target) applyFabricTransformControls(event.target);
  });
}
