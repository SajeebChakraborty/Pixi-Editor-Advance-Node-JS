import type { Canvas, FabricObject, IText } from "fabric";
import type { Layer } from "./store";
import { useEditorStore } from "./store";
import { getObjectOverlayRect } from "./video-overlay";

const MEDIA_OVERLAY_ROOT_ATTRIBUTE = "data-media-overlay-root";

export type MediaFabricObject = FabricObject & {
  name?: string;
  _mediaOverlayElement?: HTMLElement;
  _syncMediaOverlay?: () => void;
  _cleanupMediaOverlay?: () => void;
};

const isTextObject = (object: FabricObject) => {
  const type = String(object.type || "").toLowerCase();
  return type === "i-text" || type === "textbox" || type === "text";
};

const isImageObject = (object: FabricObject) =>
  String(object.type || "").toLowerCase() === "image";

export const isMediaOverlayObject = (object: FabricObject) =>
  isTextObject(object) || isImageObject(object);

function getMediaOverlayRoot(canvas: Canvas) {
  const wrapper = canvas.wrapperEl;
  const host = wrapper?.parentElement;
  if (!wrapper || !host) return null;

  let root = Array.from(host.children).find(
    (child) =>
      child instanceof HTMLDivElement &&
      child.hasAttribute(MEDIA_OVERLAY_ROOT_ATTRIBUTE),
  ) as HTMLDivElement | undefined;

  if (!root) {
    root = document.createElement("div");
    root.setAttribute(MEDIA_OVERLAY_ROOT_ATTRIBUTE, "");
    Object.assign(root.style, {
      position: "absolute",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "25",
      background: "transparent",
    });
    host.insertBefore(root, wrapper);
  }

  const bounds = (canvas as any).artboardExportBounds as
    | { left: number; top: number; width: number; height: number }
    | undefined;
  if (bounds) {
    Object.assign(root.style, {
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      overflow: "hidden",
    });
  }

  return root;
}

function getImageSource(object: FabricObject, layer?: Layer) {
  if (layer?.data?.url) return String(layer.data.url);
  const element = (object as FabricObject & { _element?: HTMLImageElement })
    ._element;
  if (element?.src) return element.src;
  const objects = (object as FabricObject & { _objects?: FabricObject[] })
    ._objects;
  if (objects?.length) {
    const nested = objects[0] as FabricObject & { _element?: HTMLImageElement };
    if (nested?._element?.src) return nested._element.src;
  }
  return "";
}

function ensureMediaOverlayElement(
  object: MediaFabricObject,
  layer?: Layer,
): HTMLElement | null {
  if (isImageObject(object)) {
    const source = getImageSource(object, layer);
    if (!source) return null;

    let image = object._mediaOverlayElement as HTMLImageElement | undefined;
    if (!(image instanceof HTMLImageElement)) {
      image = document.createElement("img");
      image.draggable = false;
      object._mediaOverlayElement = image;
    }
    if (image.src !== source) {
      image.src = source;
    }
    return image;
  }

  if (isTextObject(object)) {
    const textObject = object as IText;
    let element = object._mediaOverlayElement as HTMLDivElement | undefined;
    if (!(element instanceof HTMLDivElement)) {
      element = document.createElement("div");
      element.style.whiteSpace = "pre-wrap";
      element.style.wordBreak = "break-word";
      element.style.userSelect = "none";
      object._mediaOverlayElement = element;
    }

    element.textContent = String(textObject.text || layer?.data?.content || "");
    element.style.fontFamily = String(
      textObject.fontFamily || layer?.data?.fontFamily || "Roboto",
    );
    element.style.fontWeight = String(
      textObject.fontWeight || layer?.data?.fontWeight || "normal",
    );
    element.style.fontSize = `${Number(textObject.fontSize || layer?.data?.fontSize || 40)}px`;
    element.style.color = String(textObject.fill || layer?.data?.fill || "#ffffff");
    element.style.textAlign = String(textObject.textAlign || "left");
    element.style.lineHeight = String(textObject.lineHeight || 1.16);
    return element;
  }

  return null;
}

export function syncMediaOverlay(
  object: MediaFabricObject,
  layer?: Layer,
  stackIndex = 0,
) {
  const canvas = object.canvas;
  if (!canvas || !isMediaOverlayObject(object)) return;

  const root = getMediaOverlayRoot(canvas);
  const element = ensureMediaOverlayElement(object, layer);
  if (!root || !element) return;

  if (element.parentElement !== root) {
    root.appendChild(element);
  }

  const rect = getObjectOverlayRect(object, canvas);
  const visible = object.visible !== false && layer?.visible !== false;

  Object.assign(element.style, {
    position: "absolute",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
    pointerEvents: "none",
    transform: object.angle ? `rotate(${object.angle}deg)` : "none",
    transformOrigin: "center center",
    opacity: visible ? "1" : "0",
    display: visible ? "block" : "none",
    zIndex: `${Math.max(1, stackIndex)}`,
  });

  object.set({
    opacity: 0,
    objectCaching: false,
    perPixelTargetFind: false,
    hoverCursor: "move",
    moveCursor: "move",
  });
}

export function attachMediaOverlay(
  canvas: Canvas,
  object: MediaFabricObject,
  layer?: Layer,
) {
  if (!isMediaOverlayObject(object)) return;

  const sync = () => {
    const currentLayer =
      layer ||
      useEditorStore
        .getState()
        .getLayers()
        .find((candidate) => candidate.objectId === object.name);
    syncMediaOverlay(object, currentLayer);
  };
  if (object._syncMediaOverlay === sync) {
    sync();
    return;
  }

  object._cleanupMediaOverlay?.();

  const events = ["moving", "scaling", "rotating", "skewing", "modified"];
  events.forEach((eventName) => object.on(eventName as any, sync));
  if (isTextObject(object)) {
    object.on("changed" as any, sync);
  }

  const cleanup = () => {
    events.forEach((eventName) => object.off(eventName as any, sync));
    if (isTextObject(object)) {
      object.off("changed" as any, sync);
    }
    object._mediaOverlayElement?.remove();
    object._mediaOverlayElement = undefined;
    object._syncMediaOverlay = undefined;
    object._cleanupMediaOverlay = undefined;
  };

  object._syncMediaOverlay = sync;
  object._cleanupMediaOverlay = cleanup;
  sync();
}

export function syncMediaOverlays(canvas: Canvas, layers: Layer[]) {
  getMediaOverlayRoot(canvas);

  const overlayObjects = canvas
    .getObjects()
    .filter((object) => isMediaOverlayObject(object))
    .map((object, index) => {
      const layer = layers.find(
        (candidate) => candidate.objectId === (object as any).name,
      );
      return {
        object: object as MediaFabricObject,
        layer,
        stack: layer?.track ?? index,
        index,
      };
    })
    .sort((left, right) => {
      const trackDelta = left.stack - right.stack;
      if (trackDelta !== 0) return trackDelta;
      return left.index - right.index;
    });

  overlayObjects.forEach(({ object, layer }, stackIndex) => {
    attachMediaOverlay(canvas, object, layer);
    syncMediaOverlay(object, layer, stackIndex + 1);
  });

  canvas.getObjects().forEach((object) => {
    const mediaObject = object as MediaFabricObject;
    if (!isMediaOverlayObject(mediaObject) || mediaObject._mediaOverlayElement) {
      return;
    }
    attachMediaOverlay(canvas, mediaObject);
  });
}

export function detachMediaOverlays(canvas: Canvas) {
  canvas.getObjects().forEach((object) => {
    (object as MediaFabricObject)._cleanupMediaOverlay?.();
  });
  const wrapper = canvas.wrapperEl;
  const host = wrapper?.parentElement;
  const root = host?.querySelector(
    `[${MEDIA_OVERLAY_ROOT_ATTRIBUTE}]`,
  ) as HTMLDivElement | undefined;
  root?.remove();
}
