import * as fabric from "fabric";

const HANDLE_COLOR = "#d1d5db";
const HANDLE_STROKE = "#ffffff";
const BORDER_COLOR = "#ffffff";

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
