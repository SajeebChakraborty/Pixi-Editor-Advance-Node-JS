import * as fabric from "fabric";
import type { IText } from "fabric";

const HANDLE_COLOR = "#d1d5db";
const HANDLE_STROKE = "#ffffff";
const BORDER_COLOR = "#ffffff";

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
    cornerSize: 10,
    cornerStyle: "rect",
    padding: 0,
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
export function applyVideoOverlayControls(object: fabric.FabricObject) {
  applyFabricTransformControls(object);

  const isText = isTextFabricObject(object);
  object.set({
    selectable: true,
    evented: true,
    lockMovementX: false,
    lockMovementY: false,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: false,
    hasControls: true,
    hasBorders: true,
    perPixelTargetFind: false,
    hoverCursor: "move",
    moveCursor: "move",
    padding: isText ? 12 : 0,
    ...(isText ? { editable: false } : {}),
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
