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
  _sourceMediaWidth?: number;
  _sourceMediaHeight?: number;
  _fitMediaKey?: string;
  _userTransform?: boolean;
};

const OVERLAY_ROOT_ATTRIBUTE = "data-video-overlay-root";

/** Scale video to fully fit inside the project canvas (no cropping). */
export const CANVAS_FIT_PADDING = 1;

export function computeContainedVideoRect(
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
) {
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  const safeMediaWidth = Math.max(1, mediaWidth);
  const safeMediaHeight = Math.max(1, mediaHeight);
  const scale =
    Math.min(
      safeCanvasWidth / safeMediaWidth,
      safeCanvasHeight / safeMediaHeight,
    ) * CANVAS_FIT_PADDING;

  const width = safeMediaWidth * scale;
  const height = safeMediaHeight * scale;

  return {
    left: (safeCanvasWidth - width) / 2,
    top: (safeCanvasHeight - height) / 2,
    width,
    height,
    scale,
  };
}

export function getCanvasProjectDimensions(canvas: Canvas) {
  const stored = (canvas as any).projectDimensions as
    | { width: number; height: number }
    | undefined;
  if (stored?.width && stored?.height) {
    return {
      width: Math.max(1, stored.width),
      height: Math.max(1, stored.height),
    };
  }

  return {
    width: Math.max(1, Number(canvas.getWidth?.() || canvas.width || 1280)),
    height: Math.max(1, Number(canvas.getHeight?.() || canvas.height || 720)),
  };
}

export function fitFabricCanvasToContainer(
  canvas: Canvas,
  cssWidth: number,
  cssHeight: number,
  projectWidth: number,
  projectHeight: number,
) {
  const width = Math.max(1, projectWidth);
  const height = Math.max(1, projectHeight);
  const viewWidth = Math.max(1, cssWidth);
  const viewHeight = Math.max(1, cssHeight);

  (canvas as any).projectDimensions = { width, height };

  canvas.setDimensions({ width, height }, { backstoreOnly: true });
  canvas.setDimensions(
    { width: `${viewWidth}px`, height: `${viewHeight}px` },
    { cssOnly: true },
  );

  const fitScale = Math.min(viewWidth / width, viewHeight / height) || 1;
  const scale = fitScale * CANVAS_FIT_PADDING;
  const offsetX = (viewWidth - width * scale) / 2;
  const offsetY = (viewHeight - height * scale) / 2;

  canvas.setViewportTransform([scale, 0, 0, scale, offsetX, offsetY]);
  canvas.setZoom(1);
  (canvas as any).artboardExportBounds = {
    left: offsetX,
    top: offsetY,
    width: width * scale,
    height: height * scale,
  };

  const wrapper = canvas.wrapperEl as HTMLElement | undefined;
  if (wrapper) {
    Object.assign(wrapper.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
    });
  }
}

/** Size the fabric object to the contained video rect (handles match visible video). */
export function fitVideoObjectToCanvas(
  object: FabricObject,
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
) {
  const safeMediaWidth = Math.max(1, mediaWidth);
  const safeMediaHeight = Math.max(1, mediaHeight);
  const rect = computeContainedVideoRect(
    canvasWidth,
    canvasHeight,
    safeMediaWidth,
    safeMediaHeight,
  );

  (object as VideoFabricObject)._sourceMediaWidth = safeMediaWidth;
  (object as VideoFabricObject)._sourceMediaHeight = safeMediaHeight;
  (object as VideoFabricObject)._fitMediaKey = `${canvasWidth}x${canvasHeight}:${safeMediaWidth}x${safeMediaHeight}`;

  object.set({
    left: rect.left,
    top: rect.top,
    originX: "left",
    originY: "top",
    width: rect.width,
    height: rect.height,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
  });
  object.setCoords();
  updateNativeVideoPlaceholder(object as VideoFabricObject);
}

function getViewportScale(canvas: Canvas) {
  const viewport = (canvas.viewportTransform || [1, 0, 0, 1, 0, 0]) as number[];
  return {
    scaleX: viewport[0] || 1,
    scaleY: viewport[3] || 1,
  };
}

function getObjectSceneRect(object: FabricObject) {
  object.setCoords();
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  const center = object.getCenterPoint();

  return {
    left: center.x - width / 2,
    top: center.y - height / 2,
    width,
    height,
  };
}

function getObjectOverlayRect(object: FabricObject, canvas: Canvas) {
  const scene = getObjectSceneRect(object);
  const { scaleX, scaleY } = getViewportScale(canvas);

  return {
    left: scene.left * scaleX,
    top: scene.top * scaleY,
    width: Math.max(1, scene.width * scaleX),
    height: Math.max(1, scene.height * scaleY),
  };
}

function getOverlayRoot(canvas: Canvas) {
  const wrapper = canvas.wrapperEl;
  const host = wrapper?.parentElement;
  if (!wrapper || !host) return null;

  wrapper.style.zIndex = "30";
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
      zIndex: "20",
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

function updateNativeVideoPlaceholder(object: VideoFabricObject) {
  const imageObject = object as VideoFabricObject & {
    setElement?: (
      element: HTMLCanvasElement,
      options?: { width?: number; height?: number },
    ) => void;
  };

  const width = Math.max(1, Number(object.width || 1));
  const height = Math.max(1, Number(object.height || 1));

  if (imageObject.setElement) {
    const transparentPixel = document.createElement("canvas");
    transparentPixel.width = 1;
    transparentPixel.height = 1;
    imageObject.setElement(transparentPixel, { width, height });
  }

  object.set({
    width,
    height,
    scaleX: Number(object.scaleX || 1),
    scaleY: Number(object.scaleY || 1),
    objectCaching: false,
  });
  object._nativeVideoPlaceholder = true;
}

export function syncVideoOverlay(object: VideoFabricObject) {
  const canvas = object.canvas;
  const video = object._videoOverlayElement;
  if (!canvas || !video) return;

  const root = getOverlayRoot(canvas);
  if (!root) return;
  if (video.parentElement !== root) root.appendChild(video);

  const objectIndex = canvas.getObjects().indexOf(object);

  if (!object._userTransform) {
    video.style.left = "0";
    video.style.top = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "contain";
  } else {
    const rect = getObjectOverlayRect(object, canvas);
    video.style.left = `${rect.left}px`;
    video.style.top = `${rect.top}px`;
    video.style.width = `${rect.width}px`;
    video.style.height = `${rect.height}px`;
    video.style.objectFit = "fill";
  }

  video.style.clipPath = "none";
  video.style.transform = object.angle
    ? `rotate(${object.angle}deg)`
    : "none";
  video.style.transformOrigin = "center center";
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
  updateNativeVideoPlaceholder(object);

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
    objectFit: "contain",
    pointerEvents: "none",
    transformOrigin: "center center",
    willChange: "transform, opacity",
  });
  video.playsInline = true;
  video.preload = "auto";
  video.disablePictureInPicture = true;

  const sync = () => syncVideoOverlay(object);
  const events = ["moving", "scaling", "rotating", "skewing", "modified"];
  events.forEach((eventName) => object.on(eventName as any, sync));

  const onMetadata = () => {
    if (object._userTransform) {
      sync();
      return;
    }

    const { width: canvasWidth, height: canvasHeight } =
      getCanvasProjectDimensions(canvas);
    const mediaWidth = Math.max(
      1,
      video.videoWidth || object._sourceMediaWidth || object.width || 1,
    );
    const mediaHeight = Math.max(
      1,
      video.videoHeight || object._sourceMediaHeight || object.height || 1,
    );

    fitVideoObjectToCanvas(
      object,
      canvasWidth,
      canvasHeight,
      mediaWidth,
      mediaHeight,
    );
    sync();
    canvas.requestRenderAll();
  };

  video.addEventListener("loadedmetadata", onMetadata);
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    onMetadata();
  }

  const cleanupOverlay = () => {
    events.forEach((eventName) => object.off(eventName as any, sync));
    video.removeEventListener("loadedmetadata", onMetadata);
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
      syncVideoOverlay(videoObject);
    }
  });
}

export function refitAllVideosToProjectCanvas(
  canvas: Canvas,
  projectWidth: number,
  projectHeight: number,
  getMediaDimensions?: (
    object: VideoFabricObject,
  ) => { width: number; height: number } | null,
) {
  const width = Math.max(1, projectWidth);
  const height = Math.max(1, projectHeight);

  canvas.getObjects().forEach((object) => {
    const videoObject = object as VideoFabricObject;
    if (!videoObject._videoEl || videoObject._userTransform) return;

    const media = getMediaDimensions?.(videoObject);
    const mediaWidth = Math.max(
      1,
      media?.width ||
        videoObject._sourceMediaWidth ||
        videoObject._videoEl?.videoWidth ||
        videoObject.width ||
        width,
    );
    const mediaHeight = Math.max(
      1,
      media?.height ||
        videoObject._sourceMediaHeight ||
        videoObject._videoEl?.videoHeight ||
        videoObject.height ||
        height,
    );

    fitVideoObjectToCanvas(
      videoObject,
      width,
      height,
      mediaWidth,
      mediaHeight,
    );
  });
}

export function maybeFitVideoObjectToCanvas(
  object: FabricObject,
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
) {
  const videoObject = object as VideoFabricObject;
  if (videoObject._userTransform) return;

  fitVideoObjectToCanvas(
    object,
    canvasWidth,
    canvasHeight,
    mediaWidth,
    mediaHeight,
  );
}
