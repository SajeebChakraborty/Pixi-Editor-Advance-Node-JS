import type { Canvas, FabricObject } from "fabric";

type VideoFabricObject = FabricObject & {
  _videoEl?: HTMLVideoElement;
  _videoOverlayElement?: HTMLVideoElement;
  _videoOverlayVisible?: boolean;
  _videoOpacity?: number;
  _nativeVideoPlaceholder?: boolean;
  _syncVideoOverlay?: () => void;
  _cleanupVideoOverlay?: () => void;
  _disposeVideo?: () => void;
};

const OVERLAY_ROOT_ATTRIBUTE = "data-video-overlay-root";

function multiplyTransforms(
  viewport: number[],
  object: number[],
): [number, number, number, number, number, number] {
  return [
    viewport[0] * object[0] + viewport[2] * object[1],
    viewport[1] * object[0] + viewport[3] * object[1],
    viewport[0] * object[2] + viewport[2] * object[3],
    viewport[1] * object[2] + viewport[3] * object[3],
    viewport[0] * object[4] + viewport[2] * object[5] + viewport[4],
    viewport[1] * object[4] + viewport[3] * object[5] + viewport[5],
  ];
}

function getOverlayRoot(canvas: Canvas) {
  const wrapper = canvas.wrapperEl;
  const host = wrapper?.parentElement;
  if (!wrapper || !host) return null;

  wrapper.style.zIndex = "2";
  wrapper.style.background = "transparent";

  let root = Array.from(host.children).find(
    (child) =>
      child instanceof HTMLDivElement &&
      child.hasAttribute(OVERLAY_ROOT_ATTRIBUTE),
  ) as HTMLDivElement | undefined;

  if (!root) {
    root = document.createElement("div");
    root.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "");
    Object.assign(root.style, {
      position: "absolute",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "1",
      background: "transparent",
    });
    host.insertBefore(root, wrapper);
  }

  const bounds = (canvas as any).artboardExportBounds as
    | { left: number; top: number; width: number; height: number }
    | undefined;
  if (!bounds) return root;

  root.style.left = `${bounds.left}px`;
  root.style.top = `${bounds.top}px`;
  root.style.width = `${bounds.width}px`;
  root.style.height = `${bounds.height}px`;
  return root;
}

export function syncVideoOverlay(object: VideoFabricObject) {
  const canvas = object.canvas;
  const video = object._videoOverlayElement;
  if (!canvas || !video) return;

  const root = getOverlayRoot(canvas);
  if (!root) return;
  if (video.parentElement !== root) root.appendChild(video);

  const viewport = (canvas.viewportTransform || [1, 0, 0, 1, 0, 0]) as number[];
  const objectMatrix = object.calcTransformMatrix() as number[];
  const [a, b, c, d, e, f] = multiplyTransforms(viewport, objectMatrix);
  const bounds = (canvas as any).artboardExportBounds as
    | { left: number; top: number }
    | undefined;
  const rootLeft = bounds?.left || 0;
  const rootTop = bounds?.top || 0;
  const width = Math.max(1, Number(object.width || video.videoWidth || 1));
  const height = Math.max(1, Number(object.height || video.videoHeight || 1));
  const objectIndex = canvas.getObjects().indexOf(object);

  video.style.width = `${width}px`;
  video.style.height = `${height}px`;
  video.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e - rootLeft}, ${f - rootTop}) translate(${-width / 2}px, ${-height / 2}px)`;
  video.style.zIndex = `${Math.max(0, objectIndex)}`;
  video.style.opacity = `${Math.min(
    1,
    Math.max(0, Number(object._videoOpacity ?? 1)),
  )}`;
  video.style.display =
    object._videoOverlayVisible === false || object.visible === false
      ? "none"
      : "block";
}

export function attachVideoOverlay(
  canvas: Canvas,
  object: VideoFabricObject,
  video: HTMLVideoElement,
) {
  if (!object._nativeVideoPlaceholder) {
    const imageObject = object as VideoFabricObject & {
      setElement?: (
        element: HTMLCanvasElement,
        options?: { width?: number; height?: number },
      ) => void;
    };
    if (imageObject.setElement) {
      const width = Math.max(1, Number(object.width || video.videoWidth || 1));
      const height = Math.max(1, Number(object.height || video.videoHeight || 1));
      const scaleX = Number(object.scaleX || 1);
      const scaleY = Number(object.scaleY || 1);
      const transparentPixel = document.createElement("canvas");
      transparentPixel.width = 1;
      transparentPixel.height = 1;
      imageObject.setElement(transparentPixel, { width, height });
      object.set({ width, height, scaleX, scaleY, objectCaching: false });
    }
    object._nativeVideoPlaceholder = true;
  }

  if (
    object._videoOverlayElement === video &&
    typeof object._syncVideoOverlay === "function"
  ) {
    object._syncVideoOverlay();
    return;
  }

  object._cleanupVideoOverlay?.();
  object._videoEl = video;
  object._videoOverlayElement = video;
  object._videoOverlayVisible = object._videoOverlayVisible ?? true;
  object._videoOpacity = object._videoOpacity ?? 1;

  Object.assign(video.style, {
    position: "absolute",
    left: "0",
    top: "0",
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
    pointerEvents: "none",
    transformOrigin: "0 0",
    willChange: "transform, opacity",
  });
  video.playsInline = true;
  video.preload = "auto";
  video.disablePictureInPicture = true;

  const sync = () => syncVideoOverlay(object);
  const events = ["moving", "scaling", "rotating", "skewing", "modified"];
  events.forEach((eventName) => object.on(eventName as any, sync));

  const cleanupOverlay = () => {
    events.forEach((eventName) => object.off(eventName as any, sync));
    video.remove();
    object._videoOverlayElement = undefined;
    object._syncVideoOverlay = undefined;
    object._cleanupVideoOverlay = undefined;
  };

  object._syncVideoOverlay = sync;
  object._cleanupVideoOverlay = cleanupOverlay;

  const previousDispose = object._disposeVideo;
  object._disposeVideo = () => {
    cleanupOverlay();
    previousDispose?.();
  };

  getOverlayRoot(canvas)?.appendChild(video);
  sync();
}

export function setVideoOverlayVisibility(
  object: VideoFabricObject,
  visible: boolean,
) {
  object._videoOverlayVisible = visible;
  syncVideoOverlay(object);
}

export function setVideoOverlayOpacity(
  object: VideoFabricObject,
  opacity: number,
) {
  object._videoOpacity = Math.min(1, Math.max(0, opacity));
  syncVideoOverlay(object);
}

export function syncVideoOverlays(canvas: Canvas) {
  getOverlayRoot(canvas);
  canvas.getObjects().forEach((object) => {
    const videoObject = object as VideoFabricObject;
    if (videoObject._videoEl) {
      attachVideoOverlay(canvas, videoObject, videoObject._videoEl);
      syncVideoOverlay(videoObject);
    }
  });
}
