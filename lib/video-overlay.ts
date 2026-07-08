import { FabricImage, type Canvas, type FabricObject } from "fabric";
import { videoNeedsCrossOrigin } from "./video-playback-url";
import { computeVideoOverlayZIndex } from "./overlay-z-index";

export type VideoFabricObject = FabricObject & {
  name?: string;
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
  _presentationFrame?: VideoPresentationFrame;
  _presentationFilterCss?: string;
};

export type VideoPresentationFrame = {
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
};

const OVERLAY_ROOT_ATTRIBUTE = "data-video-overlay-root";

/** Scale video to fully fit inside the project canvas (no cropping). */
export const CANVAS_FIT_PADDING = 1;

const MAX_PROJECT_CANVAS_EDGE = 1920;
const MIN_PROJECT_CANVAS_EDGE = 240;

/** Match project canvas to media aspect ratio (portrait, landscape, or square). */
export function getProjectCanvasSizeForVideo(
  mediaWidth: number,
  mediaHeight: number,
) {
  const safeWidth = Math.max(1, Math.round(mediaWidth));
  const safeHeight = Math.max(1, Math.round(mediaHeight));
  const longest = Math.max(safeWidth, safeHeight);
  const scale =
    longest > MAX_PROJECT_CANVAS_EDGE
      ? MAX_PROJECT_CANVAS_EDGE / longest
      : longest < MIN_PROJECT_CANVAS_EDGE
        ? MIN_PROJECT_CANVAS_EDGE / longest
        : 1;

  return {
    width: Math.max(MIN_PROJECT_CANVAS_EDGE, Math.round(safeWidth * scale)),
    height: Math.max(MIN_PROJECT_CANVAS_EDGE, Math.round(safeHeight * scale)),
  };
}

export function isPortraitMedia(mediaWidth: number, mediaHeight: number) {
  return mediaHeight > mediaWidth * 1.05;
}

export function shouldMatchCanvasToVideo(
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
) {
  const canvasAspect = Math.max(1, canvasWidth) / Math.max(1, canvasHeight);
  const videoAspect = Math.max(1, videoWidth) / Math.max(1, videoHeight);
  return Math.abs(canvasAspect - videoAspect) / videoAspect > 0.06;
}

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
      zIndex: "50",
      background: "transparent",
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

export function getObjectOverlayRect(object: FabricObject, canvas: Canvas) {
  object.setCoords();
  const bounds = (canvas as any).artboardExportBounds as
    | { left: number; top: number; width: number; height: number }
    | undefined;
  const rect = object.getBoundingRect();

  if (bounds) {
    const project = (canvas as any).projectDimensions as
      | { width: number; height: number }
      | undefined;
    const projectWidth = Math.max(1, project?.width || canvas.getWidth());
    const projectHeight = Math.max(1, project?.height || canvas.getHeight());
    const scaleX = bounds.width / projectWidth;
    const scaleY = bounds.height / projectHeight;

    return {
      left: rect.left * scaleX,
      top: rect.top * scaleY,
      width: Math.max(1, rect.width * scaleX),
      height: Math.max(1, rect.height * scaleY),
    };
  }

  const scene = getObjectSceneRect(object);
  const { scaleX, scaleY } = getViewportScale(canvas);

  return {
    left: scene.left * scaleX,
    top: scene.top * scaleY,
    width: Math.max(1, scene.width * scaleX),
    height: Math.max(1, scene.height * scaleY),
  };
}

export function centerObjectOnProjectCanvas(
  object: FabricObject,
  canvas: Canvas,
) {
  const project = (canvas as any).projectDimensions as
    | { width: number; height: number }
    | undefined;
  const width = Math.max(1, project?.width || canvas.getWidth());
  const height = Math.max(1, project?.height || canvas.getHeight());

  object.set({
    originX: "center",
    originY: "center",
    left: width / 2,
    top: height / 2,
  });
  object.setCoords();
}

function getOverlayRoot(canvas: Canvas) {
  const wrapper = canvas.wrapperEl;
  const host = wrapper?.parentElement;
  if (!wrapper || !host) return null;

  wrapper.style.zIndex = "50";
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
      overflow: "visible",
      pointerEvents: "none",
      zIndex: "5",
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
      overflow: "visible",
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
    opacity: 0,
  });
  object._nativeVideoPlaceholder = true;
}

function applyPresentationToVideoElement(
  video: HTMLVideoElement,
  presentation: VideoPresentationFrame,
  layoutAngle: number,
  videoOpacity: number,
  filterCss?: string,
) {
  const hasMotion =
    presentation.translateXPercent !== 0 ||
    presentation.translateYPercent !== 0 ||
    presentation.scale !== 1;
  const layoutTransform = layoutAngle ? `rotate(${layoutAngle}deg)` : "";
  const motionTransform = hasMotion
    ? `translate(${presentation.translateXPercent}%, ${presentation.translateYPercent}%) scale(${presentation.scale})`
    : presentation.scale !== 1
      ? `scale(${presentation.scale})`
      : "";
  video.style.transform =
    [motionTransform, layoutTransform].filter(Boolean).join(" ") || "none";
  video.style.transformOrigin = "center center";

  const { top, right, bottom, left } = presentation.clipInset;
  video.style.clipPath =
    top || right || bottom || left
      ? `inset(${top}% ${right}% ${bottom}% ${left}%)`
      : "none";

  video.style.opacity = String(
    Math.min(
      1,
      Math.max(0, presentation.opacity * Math.min(1, Math.max(0, videoOpacity))),
    ),
  );
  if (filterCss) {
    video.style.filter = filterCss;
  }
}

export function setVideoPresentationFrame(
  object: VideoFabricObject,
  frame: VideoPresentationFrame | null,
  filterCss = "",
) {
  object._presentationFrame = frame || undefined;
  object._presentationFilterCss = frame ? filterCss : undefined;
  syncVideoOverlay(object);
}

export function syncVideoOverlay(object: VideoFabricObject) {
  const canvas = object.canvas;
  const video = object._videoOverlayElement;
  if (!canvas || !video) return;

  const root = getOverlayRoot(canvas);
  if (!root) return;
  if (video.parentElement !== root) root.appendChild(video);

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

  const presentation = object._presentationFrame;
  if (presentation) {
    applyPresentationToVideoElement(
      video,
      presentation,
      Number(object.angle || 0),
      Number(object._videoOpacity ?? 1),
      object._presentationFilterCss,
    );
  } else {
    video.style.clipPath = "none";
    video.style.transform = object.angle
      ? `rotate(${object.angle}deg)`
      : "none";
    video.style.transformOrigin = "center center";
    video.style.opacity = `${Math.min(
      1,
      Math.max(0, Number(object._videoOpacity ?? 1)),
    )}`;
  }

  video.style.zIndex = `${computeVideoOverlayZIndex(
    Number((object as VideoFabricObject & { _sceneOrder?: number })._sceneOrder ?? 0),
  )}`;
  video.style.display =
    object._videoOverlayVisible === false || object.visible === false
      ? "none"
      : "block";

  const needsClip =
    Boolean(presentation) &&
    (presentation!.translateXPercent !== 0 ||
      presentation!.translateYPercent !== 0 ||
      presentation!.opacity < 0.999 ||
      presentation!.scale !== 1 ||
      presentation!.clipInset.top > 0 ||
      presentation!.clipInset.right > 0 ||
      presentation!.clipInset.bottom > 0 ||
      presentation!.clipInset.left > 0);
  root.style.overflow = needsClip ? "hidden" : "visible";
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
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
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

async function waitForClonedVideoMetadata(
  videoEl: HTMLVideoElement,
  timeoutMs = 15000,
): Promise<void> {
  if (videoEl.readyState >= HTMLMediaElement.HAVE_METADATA) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Split clip video metadata timed out"));
    }, timeoutMs);

    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    videoEl.addEventListener("loadedmetadata", finish, { once: true });
    videoEl.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("Split clip video failed to load"));
      },
      { once: true },
    );
    videoEl.load();
  });
}

/** Clone an on-canvas video object for a split clip (same source, independent seek). */
export async function cloneVideoFabricObjectForSplit(
  canvas: Canvas,
  sourceObjectId: string,
  targetObjectId: string,
): Promise<VideoFabricObject | null> {
  const existing = canvas
    .getObjects()
    .find((object) => (object as VideoFabricObject).name === targetObjectId) as
    | VideoFabricObject
    | undefined;
  if (existing?._videoEl) return existing;

  const source = canvas
    .getObjects()
    .find((object) => (object as VideoFabricObject).name === sourceObjectId) as
    | VideoFabricObject
    | undefined;
  const sourceVideo = source?._videoEl;
  if (!source || !sourceVideo) return null;

  const src = sourceVideo.currentSrc || sourceVideo.src;
  if (!src) return null;

  const videoEl = document.createElement("video");
  videoEl.muted = sourceVideo.muted;
  videoEl.volume = sourceVideo.volume;
  videoEl.playbackRate = sourceVideo.playbackRate;
  videoEl.playsInline = true;
  videoEl.preload = "auto";
  videoEl.disablePictureInPicture = true;
  if (videoNeedsCrossOrigin(src)) {
    videoEl.crossOrigin = "anonymous";
  }
  videoEl.src = src;

  try {
    await waitForClonedVideoMetadata(videoEl);
  } catch {
    videoEl.pause();
    videoEl.removeAttribute("src");
    videoEl.load();
    return null;
  }

  const vWidth = Math.max(
    1,
    videoEl.videoWidth || Number(source.width || 1),
  );
  const vHeight = Math.max(
    1,
    videoEl.videoHeight || Number(source.height || 1),
  );
  const transparentPixel = document.createElement("canvas");
  transparentPixel.width = 1;
  transparentPixel.height = 1;

  const fabricVideo = new FabricImage(transparentPixel, {
    name: targetObjectId,
    width: vWidth,
    height: vHeight,
    originX: source.originX,
    originY: source.originY,
    left: source.left,
    top: source.top,
    scaleX: source.scaleX,
    scaleY: source.scaleY,
    angle: source.angle,
    objectCaching: false,
    visible: false,
    opacity: 0,
    selectable: source.selectable,
    evented: source.evented,
    hasControls: source.hasControls,
    lockMovementX: source.lockMovementX,
    lockMovementY: source.lockMovementY,
    lockScalingX: source.lockScalingX,
    lockScalingY: source.lockScalingY,
  }) as VideoFabricObject;

  if (source._userTransform) {
    fabricVideo._userTransform = true;
  }
  fabricVideo._sourceMediaWidth = source._sourceMediaWidth;
  fabricVideo._sourceMediaHeight = source._sourceMediaHeight;
  fabricVideo._disposeVideo = () => {
    videoEl.pause();
    videoEl.removeAttribute("src");
    videoEl.load();
  };

  canvas.add(fabricVideo);
  attachVideoOverlay(canvas, fabricVideo, videoEl);
  setVideoOverlayVisibility(fabricVideo, false);
  syncVideoOverlay(fabricVideo);

  return fabricVideo;
}
