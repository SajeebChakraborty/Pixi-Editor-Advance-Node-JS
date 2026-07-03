import * as fabric from "fabric";
import { useEditorStore, type Layer } from "./store";
import { toast } from "sonner";
import { resolveVideoPlaybackUrl } from "./video-playback-url";
import {
  attachVideoOverlay,
  centerObjectOnProjectCanvas,
  fitFabricCanvasToContainer,
  fitVideoObjectToCanvas,
  refitAllVideosToProjectCanvas,
  setVideoOverlayVisibility,
  syncVideoOverlays,
  syncVideoOverlay,
} from "./video-overlay";
import { applyFabricTransformControls, applyVideoOverlayControls, applyVideoResizeControls } from "./fabric-transform-controls";
import { buildVideoComposition } from "./video-composition";
import {
  applyBorder,
  applyImageCrop,
  applyImagePreset,
  applyShadow,
  DEFAULT_BORDER,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_SHADOW,
} from "./editor-actions";
import { getPersistedLayerObjectState } from "./project-persistence";
import { syncFabricLayerStack } from "./layer-stack";
import { attachMediaOverlay } from "./media-overlay";
import { getNextOverlayTrack } from "./timeline-tracks";

export const PHOTO_DRAG_MIME_TYPE = "application/x-pixi-photo";

export const resolveCanvasPlacementFromEvent = (
  canvas: fabric.Canvas,
  clientEvent: DragEvent | MouseEvent | PointerEvent,
) => {
  canvas.calcOffset();
  const pointer = canvas.getPointer(clientEvent as any);
  return {
    left: Number(pointer.x || 0),
    top: Number(pointer.y || 0),
  };
};

export const persistOverlayObjectState = (object: fabric.FabricObject) => {
  const objectId = String((object as any).name || "");
  if (!objectId) return;

  const store = useEditorStore.getState();
  const layer = store.getLayers().find((item) => item.objectId === objectId);
  if (!layer) return;

  store.updateLayerData(layer.id, {
    userPlaced: true,
    fabric: {
      left: object.left,
      top: object.top,
      width: object.width,
      height: object.height,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      angle: object.angle,
      flipX: object.flipX,
      flipY: object.flipY,
      originX: object.originX,
      originY: object.originY,
      visible: object.visible,
    },
  });
};

export const applyTextObjectUpdates = (
  object: fabric.IText,
  updates: Record<string, unknown>,
) => {
  const nextUpdates = { ...updates };
  if ("fontSize" in nextUpdates) {
    nextUpdates.scaleX = 1;
    nextUpdates.scaleY = 1;
  }

  object.set(nextUpdates as any);
  if (
    "text" in nextUpdates ||
    "fontSize" in nextUpdates ||
    "fontFamily" in nextUpdates
  ) {
    (object as any).dirty = true;
    (object as any).initDimensions?.();
  }
  object.setCoords();

  const objectId = String((object as any).name || "");
  const store = useEditorStore.getState();
  const layer = store.getLayers().find((item) => item.objectId === objectId);

  if (layer) {
    const nextContent =
      typeof updates.text === "string" ? updates.text : String(object.text || "");
    store.updateLayerData(layer.id, {
      content: nextContent,
      fill: String(object.fill || layer.data?.fill || "#ffffff"),
      fontFamily: String(object.fontFamily || layer.data?.fontFamily || "Roboto"),
      fontWeight: String(object.fontWeight || layer.data?.fontWeight || "normal"),
      fontSize: Number(object.fontSize || layer.data?.fontSize || 40),
    });
    if (typeof updates.text === "string" && updates.text.trim()) {
      store.updateLayer(layer.id, { name: updates.text.trim().slice(0, 48) });
    }
  }

  (object as any)._syncMediaOverlay?.();
  object.canvas?.requestRenderAll();
  persistOverlayObjectState(object);
};

fabric.FabricObject.customProperties = Array.from(
  new Set([
    ...(fabric.FabricObject.customProperties || []),
    "name",
    "data",
  ]),
);

export const applyPersistedLayerState = (
  object: fabric.FabricObject,
  layer: any,
) => {
  const persisted = getPersistedLayerObjectState(layer);
  const isVideoOverlayImage =
    useEditorStore.getState().editorMode === "video" &&
    object instanceof fabric.FabricImage &&
    layer.type !== "video";
  const userPlaced = Boolean(layer.data?.userPlaced);

  if (persisted) {
    if (isVideoOverlayImage && !userPlaced) {
      const { left: _left, top: _top, originX: _ox, originY: _oy, ...rest } =
        persisted as Record<string, unknown>;
      if (Object.keys(rest).length > 0) {
        object.set(rest as any);
      }
      if (object.canvas) {
        centerObjectOnProjectCanvas(object, object.canvas);
      }
    } else if (isVideoOverlayImage && persisted.originX !== "center") {
      object.set(persisted as any);
      object.setCoords();
      const rect = object.getBoundingRect();
      object.set({
        originX: "center",
        originY: "center",
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
      });
    } else {
      object.set(persisted as any);
    }

    if (layer.type === "video" && (object as any)._videoEl) {
      (object as any)._userTransform = true;
      object.setCoords();
    }
  } else if (isVideoOverlayImage && object.canvas) {
    centerObjectOnProjectCanvas(object, object.canvas);
  }

  if (
    object instanceof fabric.FabricImage &&
    layer.data &&
    layer.type !== "video"
  ) {
    const adjustments =
      layer.data.adjustments || DEFAULT_IMAGE_ADJUSTMENTS;
    const effects = layer.data.effects || {};
    applyImagePreset(
      object,
      effects.preset || "none",
      adjustments,
      effects.presetIntensity,
    );
    applyImageCrop(
      object,
      layer.data.crop || null,
      layer.data.border?.radius || 0,
    );
    applyBorder(object, layer.data.border || DEFAULT_BORDER);
    applyShadow(object, effects.shadow || DEFAULT_SHADOW);
  }

  object.setCoords();
  object.canvas?.requestRenderAll();
};

export const addMediaFromUrl = async (
  url: string,
  store: any,
  type?: "image" | "video",
  silent = false,
  forceObjectId?: string,
  mediaName?: string,
  targetFabricCanvas?: fabric.Canvas | null,
  placement?: { left: number; top: number },
): Promise<string | null> => {
  const { canvas, addLayer, setVideoState, addRecentAsset, videoState, setCanvas } = store;
  const { width: storeWidth, height: storeHeight } = canvas || { width: 1280, height: 720 };
  const isVideo = type === "video" || url.match(/\.(mp4|webm|mov)(\?.*)?$/i);

  const getLiveFabricCanvas = () => {
    const state = useEditorStore.getState();
    const candidate =
      targetFabricCanvas ??
      (state.editorMode === "video"
        ? state.videoFabricCanvas || state.canvas.fabricCanvas
        : state.canvas.fabricCanvas || state.videoFabricCanvas) ??
      canvas?.fabricCanvas;

    if (
      !candidate ||
      candidate.disposed ||
      candidate.destroyed ||
      !candidate.lowerCanvasEl?.isConnected
    ) {
      return null;
    }

    return candidate;
  };

  const waitForLiveFabricCanvas = async () => {
    const existingCanvas = getLiveFabricCanvas();
    if (existingCanvas) return existingCanvas;

    const startedAt = Date.now();
    const timeoutMs = 10000;

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const nextCanvas = getLiveFabricCanvas();
      if (nextCanvas) return nextCanvas;
    }

    return null;
  };

  const fabricCanvas = await waitForLiveFabricCanvas();
  if (!fabricCanvas) {
    if (!silent) {
       toast.error("Canvas is still loading. Please try again in a moment.");
    }
    return null;
  }
  const latestCanvasState = useEditorStore.getState().canvas;
  const baseWidth = Math.max(1, latestCanvasState.width || storeWidth || 1280);
  const baseHeight = Math.max(1, latestCanvasState.height || storeHeight || 720);

  const isLikelyLoadableVideoUrl = (targetUrl: string) => {
    if (targetUrl.startsWith("blob:") || targetUrl.startsWith("data:") || targetUrl.startsWith("/")) {
      return true;
    }
    const lower = targetUrl.toLowerCase();
    const hasVideoExt = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(lower);
    const isHttp = lower.startsWith("http://") || lower.startsWith("https://");
    const isKnownPageUrl =
      lower.includes("youtube.com/watch") ||
      lower.includes("youtu.be/") ||
      lower.includes("vimeo.com/") ||
      lower.includes("facebook.com/");

    // Allow http(s) links even without extensions (signed/CDN URLs), but block common page links.
    return (hasVideoExt || isHttp) && !isKnownPageUrl;
  };

  if (isVideo) {
    if (!isLikelyLoadableVideoUrl(url)) {
      if (!silent) {
        toast.error("Invalid video URL. Use a direct or CDN video link; page links are not supported.");
      }
      return null;
    }

    const videoDisplayName = mediaName?.trim() || "Recent Video";

    if (!silent) addRecentAsset({ url, name: videoDisplayName, type: "video" });
    const videoEl = document.createElement("video");
    videoEl.preload = "auto";
    videoEl.muted = Boolean(videoState?.isMuted);
    videoEl.volume = videoState?.isMuted
      ? 0
      : Math.min(1, Math.max(0, Number(videoState?.volume ?? 1)));
    videoEl.playbackRate = Number(videoState?.playbackRate || 1);
    videoEl.playsInline = true;

    const buildProxyUrl = (targetUrl: string) => {
      const resolved = resolveVideoPlaybackUrl(targetUrl);
      return resolved || targetUrl;
    };

    const loadVideoMetadata = (sourceUrl: string) =>
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          window.clearTimeout(timeoutId);
          videoEl.removeEventListener("loadedmetadata", handleReady);
          videoEl.removeEventListener("loadeddata", handleReady);
          videoEl.removeEventListener("canplay", handleReady);
          videoEl.removeEventListener("error", handleError);
        };

        const handleReady = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          const mediaError = videoEl.error;
          const errorCode = mediaError?.code;
          const errorMap: Record<number, string> = {
            1: "Video loading aborted",
            2: "Network error while fetching video",
            3: "Video decode error (unsupported codec/file)",
            4: "Video source not supported",
          };
          reject(new Error(errorMap[errorCode || 0] || `Failed to load video source: ${sourceUrl}`));
        };
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error("The video server did not return readable metadata in time"));
        }, 25000);

        videoEl.addEventListener("loadedmetadata", handleReady);
        videoEl.addEventListener("loadeddata", handleReady);
        videoEl.addEventListener("canplay", handleReady);
        videoEl.addEventListener("error", handleError);

        if (/^https?:\/\//i.test(sourceUrl)) {
          videoEl.crossOrigin = "anonymous";
        } else {
          videoEl.removeAttribute("crossorigin");
        }
        videoEl.src = sourceUrl;
        videoEl.load();

        if (videoEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
          handleReady();
        }
      });

    const waitForVideoDimensions = () =>
      new Promise<void>((resolve, reject) => {
        const startedAt = Date.now();
        const maxWaitMs = 4000;

        const check = () => {
          const w = videoEl.videoWidth || 0;
          const h = videoEl.videoHeight || 0;
          if (w > 0 && h > 0) {
            resolve();
            return;
          }
          if (Date.now() - startedAt > maxWaitMs) {
            reject(new Error("Video dimensions unavailable"));
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });

    try {
      try {
        await loadVideoMetadata(url);
      } catch (directError) {
        // Fallback through same-origin proxy for external URLs without CORS.
        const proxyUrl = buildProxyUrl(url);
        if (proxyUrl === url) {
          throw directError instanceof Error ? directError : new Error("Failed to load local video");
        }
        await loadVideoMetadata(proxyUrl);
      }

      const resolvedDuration =
        Number.isFinite(videoEl.duration) && videoEl.duration > 0
          ? videoEl.duration
          : Number.isFinite(videoState?.duration) && (videoState?.duration || 0) > 0
            ? (videoState?.duration as number)
            : 30;

      if (resolvedDuration > (videoState?.duration || 0)) {
        setVideoState({ duration: resolvedDuration, endTime: resolvedDuration });
      }

      // Ensure dimensions are ready before creating Fabric image.
      await waitForVideoDimensions();

      // Warm up first decodable frame so Fabric does not render a blank white video object.
      await new Promise<void>((resolve) => {
        const finalize = () => {
          videoEl.pause();
          resolve();
        };

        const readyEnough = videoEl.readyState >= 2;
        if (readyEnough) {
          try {
            videoEl.currentTime = Math.min(0.05, Math.max(0, (videoEl.duration || 0) - 0.01));
          } catch {
            // Ignore seek failures for edge codecs; still continue.
          }
          requestAnimationFrame(() => finalize());
          return;
        }

        const timeoutId = window.setTimeout(finalize, 1500);
        videoEl.onloadeddata = () => {
          window.clearTimeout(timeoutId);
          try {
            videoEl.currentTime = Math.min(0.05, Math.max(0, (videoEl.duration || 0) - 0.01));
          } catch {
            // Ignore and continue.
          }
          requestAnimationFrame(() => finalize());
        };
      });
    } catch (e) {
       console.warn("[VIDEO_METADATA]", e);
       if (!silent) {
        const message = e instanceof Error ? e.message : "Video load failed";
        toast.error(`Video load failed: ${message}`);
       }
       return null;
    }

    const objectId = forceObjectId || `vid_${Date.now()}`;
    const vWidth = videoEl.videoWidth || 1280;
    const vHeight = videoEl.videoHeight || 720;

    let targetCanvas = fabricCanvas;
    const currentStore = useEditorStore.getState();
    const existingVideoLayers = currentStore
      .getLayers()
      .filter((layer: any) => layer.type === "video");
    const isFirstVideo = existingVideoLayers.length === 0;
    const appendStart = existingVideoLayers.reduce(
      (max: number, layer: any) =>
        Math.max(
          max,
          Number(layer.startTime || 0) + Number(layer.duration || 0),
        ),
      0,
    );
    const videoTrack =
      existingVideoLayers.length > 0
        ? existingVideoLayers[0]?.track ?? 0
        : undefined;

    if (!silent && isFirstVideo) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      targetCanvas = await waitForLiveFabricCanvas();
      if (!targetCanvas) {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
        toast.error("Canvas is still loading. Please try again in a moment.");
        return null;
      }
    }

    const projectCanvas = useEditorStore.getState().canvas;
    const targetWidth = Math.max(1, projectCanvas.width || baseWidth);
    const targetHeight = Math.max(1, projectCanvas.height || baseHeight);
    const transparentPixel = document.createElement("canvas");
    transparentPixel.width = 1;
    transparentPixel.height = 1;

    const fabricVideo = new fabric.FabricImage(transparentPixel, {
      name: objectId,
      width: vWidth,
      height: vHeight,
      originX: "center",
      originY: "center",
      objectCaching: false,
      visible: true,
      opacity: 1,
      selectable: true,
      evented: true,
      hasControls: true,
      lockMovementX: false,
      lockMovementY: false,
      lockScalingX: false,
      lockScalingY: false,
    });
    fitVideoObjectToCanvas(
      fabricVideo,
      targetWidth,
      targetHeight,
      vWidth,
      vHeight,
    );
    applyVideoResizeControls(fabricVideo);
    delete (fabricVideo as any)._userTransform;
    fabricVideo.set({ opacity: 0 });
    (fabricVideo as any)._videoEl = videoEl;
    (fabricVideo as any)._videoOpacity = 1;
    (fabricVideo as any)._videoOverlayVisible = true;
    (fabricVideo as any)._disposeVideo = () => {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    };

    targetCanvas.add(fabricVideo);
    attachVideoOverlay(targetCanvas, fabricVideo as any, videoEl);
    setVideoOverlayVisibility(fabricVideo as any, true);

    const videoFabricCanvas = useEditorStore.getState().videoFabricCanvas;
    if (videoFabricCanvas === targetCanvas && targetCanvas.wrapperEl?.parentElement) {
      const hostRect = targetCanvas.wrapperEl.parentElement.getBoundingClientRect();
      const projectW = projectCanvas.width || targetWidth;
      const projectH = projectCanvas.height || targetHeight;
      targetCanvas.setDimensions(
        { width: projectW, height: projectH },
        { backstoreOnly: true },
      );
      fitFabricCanvasToContainer(
        targetCanvas,
        hostRect.width,
        hostRect.height,
        projectW,
        projectH,
      );
      refitAllVideosToProjectCanvas(targetCanvas, projectW, projectH, () => ({
        width: vWidth,
        height: vHeight,
      }));
    }
    syncVideoOverlay(fabricVideo as any);

    targetCanvas.setActiveObject(fabricVideo);
    syncFabricLayerStack(
      targetCanvas,
      useEditorStore.getState().getLayers(),
    );

    if (!silent) {
      const videoDuration =
        Number.isFinite(videoEl.duration) && videoEl.duration > 0
          ? videoEl.duration
          : Number.isFinite(videoState?.duration) && (videoState?.duration || 0) > 0
            ? (videoState?.duration as number)
            : 30;
      addLayer({
        type: "video",
        name: videoDisplayName,
        locked: false,
        visible: true,
        startTime: appendStart,
        duration: videoDuration,
        objectId: objectId,
        track: videoTrack,
        data: {
          url,
          name: videoDisplayName,
          sourceDuration: videoDuration,
          width: vWidth,
          height: vHeight,
          sceneOrder: existingVideoLayers.length,
          transitionBefore: { type: "none", duration: 0 },
          transitionAfter: { type: "none", duration: 0 },
        },
      });
      const composition = buildVideoComposition(
        useEditorStore.getState().getLayers(),
      );
      // Show the newly appended clip immediately.
      setVideoState({
        currentTime:
          composition.scenes.find((scene) => scene.layer.objectId === objectId)
            ?.timelineStart || appendStart,
        startTime: 0,
        endTime: composition.duration,
        duration: composition.duration,
        isPlaying: false,
        videoUrl: url,
      });
      fabricVideo.set({ visible: true, opacity: 1 });
      fabricVideo.setCoords();
      targetCanvas.setActiveObject(fabricVideo);
      targetCanvas.requestRenderAll();
      toast.success(
        isFirstVideo
          ? "Video added to canvas!"
          : "Video appended to the timeline!",
      );
      requestAnimationFrame(() => {
        useEditorStore.getState().saveActiveCanvasToHistory();
      });
    }
    return objectId;
  } else {
    // Image Loading Logic 
    const isLocalUrl = url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/");
    const proxyUrl = isLocalUrl ? url : `/api/proxy?url=${encodeURIComponent(url)}`;
    const imageDisplayName =
      mediaName?.trim() || (isLocalUrl ? "Upload" : "Recent Generation");
    
    try {
      const loadImg = (src: string, crossOrigin?: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          if (crossOrigin) img.crossOrigin = crossOrigin;
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      let loadedEl: HTMLImageElement;
      try {
        loadedEl = await loadImg(proxyUrl, "anonymous");
      } catch {
        loadedEl = await loadImg(url);
      }

      const imgWidth = Math.max(1, loadedEl.naturalWidth || loadedEl.width || 1);
      const imgHeight = Math.max(1, loadedEl.naturalHeight || loadedEl.height || 1);
      const currentLayers = useEditorStore.getState().getLayers();
      const hasVideoLayer = currentLayers.some(
        (layer: any) => layer.type === "video",
      );
      const hasVisualLayer = currentLayers.some((layer: any) =>
        ["image", "video", "sticker"].includes(layer.type),
      );
      const shouldAutoResizeCanvasToImage =
        !silent &&
        useEditorStore.getState().editorMode === "photo" &&
        !hasVisualLayer &&
        !placement &&
        Number.isFinite(imgWidth) &&
        Number.isFinite(imgHeight) &&
        imgWidth > 0 &&
        imgHeight > 0;

      if (shouldAutoResizeCanvasToImage) {
        setCanvas?.({ width: imgWidth, height: imgHeight });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }

      const targetWidth = shouldAutoResizeCanvasToImage ? imgWidth : baseWidth;
      const targetHeight = shouldAutoResizeCanvasToImage ? imgHeight : baseHeight;
      const scale = shouldAutoResizeCanvasToImage
        ? 1
        : hasVisualLayer || placement
          ? Math.min(
              1,
              (targetWidth * 0.45) / imgWidth,
              (targetHeight * 0.45) / imgHeight,
            ) || 1
          : Math.min(targetWidth / imgWidth, targetHeight / imgHeight) || 1;
      const objectId = forceObjectId || `img_${Date.now()}`;
      const isVideoMode = useEditorStore.getState().editorMode === "video";

      const liveCanvas = fabricCanvas;
      if (!liveCanvas) return null;

      const projectDims = (liveCanvas as any).projectDimensions as
        | { width: number; height: number }
        | undefined;
      const canvasWidth = Math.max(
        1,
        projectDims?.width || liveCanvas.getWidth() || targetWidth,
      );
      const canvasHeight = Math.max(
        1,
        projectDims?.height || liveCanvas.getHeight() || targetHeight,
      );

      if (
        isVideoMode &&
        liveCanvas.wrapperEl?.parentElement &&
        !(liveCanvas as any).artboardExportBounds
      ) {
        const hostRect =
          liveCanvas.wrapperEl.parentElement.getBoundingClientRect();
        fitFabricCanvasToContainer(
          liveCanvas,
          hostRect.width,
          hostRect.height,
          canvasWidth,
          canvasHeight,
        );
      }

      const imageLeft = placement
        ? placement.left
        : isVideoMode
          ? canvasWidth / 2
          : shouldAutoResizeCanvasToImage
            ? imgWidth / 2
            : canvasWidth / 2;
      const imageTop = placement
        ? placement.top
        : isVideoMode
          ? canvasHeight / 2
          : shouldAutoResizeCanvasToImage
            ? imgHeight / 2
            : canvasHeight / 2;

      const fabricImg = new fabric.FabricImage(loadedEl, {
        left: imageLeft,
        top: imageTop,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        name: objectId,
        visible: true,
        opacity: 1,
        objectCaching: false,
      });

      if (!liveCanvas) return null;

      liveCanvas.add(fabricImg);
      fabricImg.set({
        visible: true,
        opacity: 1,
        evented: true,
        selectable: true,
      });
      fabricImg.setCoords();
      if (useEditorStore.getState().editorMode === "video") {
        applyVideoOverlayControls(fabricImg);
      }
      liveCanvas.setActiveObject(fabricImg);
      syncFabricLayerStack(
        liveCanvas,
        useEditorStore.getState().getLayers(),
      );
      attachMediaOverlay(liveCanvas, fabricImg as any);

      if (!silent) {
        const currentVideoState = useEditorStore.getState().videoState;
        const imageStartTime = hasVideoLayer
          ? Math.max(0, Number(currentVideoState.currentTime || 0))
          : 0;
        const imageDuration = hasVideoLayer
          ? Math.max(
              0.1,
              Number(currentVideoState.duration || 0) - imageStartTime,
            )
          : 3600;

        addLayer({
          type: "image",
          name: imageDisplayName,
          locked: false,
          visible: true,
          objectId: objectId,
          track: getNextOverlayTrack(useEditorStore.getState().getLayers()),
          data: {
            url,
            name: imageDisplayName,
            originalUrl: url,
            userPlaced: Boolean(placement),
            adjustments: {
              brightness: 0,
              contrast: 0,
              saturation: 0,
              blur: 0,
            },
            crop: null,
            effects: {
              preset: "none",
              shadow: {
                color: "rgba(0,0,0,0.35)",
                blur: 0,
                offsetX: 0,
                offsetY: 0,
              },
            },
            border: {
              color: "#ffffff",
              width: 0,
              radius: 0,
            },
          },
          startTime: imageStartTime,
          duration: imageDuration,
        });
        requestAnimationFrame(() => {
          useEditorStore.getState().saveActiveCanvasToHistory();
        });
        fabricImg.set({ visible: true, opacity: 1 });
        liveCanvas.setActiveObject(fabricImg);
        syncFabricLayerStack(
          liveCanvas,
          useEditorStore.getState().getLayers(),
        );
        attachMediaOverlay(
          liveCanvas,
          fabricImg as any,
          useEditorStore
            .getState()
            .getLayers()
            .find((layer) => layer.objectId === objectId),
        );
        requestAnimationFrame(() => {
          fabricImg.setCoords();
          (fabricImg as any)._syncMediaOverlay?.();
          liveCanvas.requestRenderAll();
        });
        toast.success(
          shouldAutoResizeCanvasToImage
            ? `Canvas sized to ${imgWidth}×${imgHeight}`
            : "Image preview loaded!",
        );
        addRecentAsset({ 
          id: objectId, 
          type: "image", 
          url, 
          name: imageDisplayName
        });
      }
      return objectId;
    } catch (err) {
      console.error(err);
      if (!silent) toast.error("Load failed");
      return null;
    }
  }

  return null;
};

export const addTextToCanvas = (text: string, options: any, fabricCanvas: fabric.Canvas, objectId: string) => {
  const { width, height } = useEditorStore.getState().canvas;
  const isVideoMode = useEditorStore.getState().editorMode === "video";
  const fontFamily = options.fontFamily || "Roboto";
  const fontWeight = options.fontWeight || "normal";
  const fill = options.fill || "#ffffff";
  const fontSize = options.fontSize || 40;
  const textBox = new fabric.IText(text, {
    left: width / 2,
    top: height / 2,
    fill,
    fontFamily,
    fontWeight,
    fontSize,
    originX: "center",
    originY: "center",
    splitByGrapheme: false,
    editable: isVideoMode ? false : true,
    ...options,
    name: objectId,
  });
  (textBox as any).objectId = objectId;
  (textBox as any).data = {
    content: text,
    fontFamily,
    fontWeight,
    fill,
    fontSize,
  };
  fabricCanvas.add(textBox);
  fabricCanvas.setActiveObject(textBox);
  if (isVideoMode) {
    applyVideoOverlayControls(textBox);
  } else {
    applyFabricTransformControls(textBox);
  }
  attachMediaOverlay(fabricCanvas, textBox as any);
  return textBox;
};

const loadVideoElementForHistory = (video: HTMLVideoElement, url: string) =>
  new Promise<void>((resolve, reject) => {
    const resolved = resolveVideoPlaybackUrl(url);
    video.preload = "auto";
    video.playsInline = true;
    video.muted = true;
    video.src = resolved;
    video.load();

    const finish = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("Could not reload video for history restore"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("error", fail);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("error", fail, { once: true });
  });

export const rehydrateCanvasMediaAfterHistory = async (
  canvas: fabric.Canvas,
  layers: Layer[],
) => {
  const store = useEditorStore.getState();
  const layerObjectIds = new Set(
    layers
      .map((layer) => layer.objectId)
      .filter((objectId): objectId is string => Boolean(objectId)),
  );

  canvas.getObjects().forEach((candidate) => {
    const name = (candidate as any).name as string | undefined;
    if (
      name &&
      /^(img|vid|text|emoji|circle|square|star|heart|triangle|line|arrow|bolt)_/.test(
        name,
      ) &&
      !layerObjectIds.has(name)
    ) {
      ;(candidate as any)._disposeVideo?.();
      ;(candidate as any)._cleanupVideoOverlay?.();
      canvas.remove(candidate);
    }
  });

  for (const layer of layers) {
    if (!layer.objectId) continue;

    let object = canvas
      .getObjects()
      .find((candidate) => (candidate as any).name === layer.objectId);

    if (!object) {
      if (layer.type === "text") {
        object = addTextToCanvas(
          layer.data?.content || layer.name,
          {
            fontFamily: layer.data?.fontFamily || "Roboto",
            fontWeight: layer.data?.fontWeight || "normal",
            fill: layer.data?.fill || "#ffffff",
            fontSize: layer.data?.fontSize || 40,
          },
          canvas,
          layer.objectId,
        );
        applyPersistedLayerState(object, layer);
        applyVideoOverlayControls(object);
        attachMediaOverlay(canvas, object as any, layer);
        (object as any)._syncMediaOverlay?.();
        continue;
      }

      if (
        layer.data?.url &&
        ["image", "video", "sticker"].includes(layer.type)
      ) {
        await addMediaFromUrl(
          layer.data.url,
          store,
          layer.type === "video" ? "video" : "image",
          true,
          layer.objectId,
          layer.data?.name || layer.name,
          canvas,
        );
        object = canvas
          .getObjects()
          .find((candidate) => (candidate as any).name === layer.objectId);
      }
    }

    if (!object) continue;

    if (layer.type === "video" && layer.data?.url) {
      const videoObject = object as any;
      if (!videoObject._videoEl || !videoObject._videoOverlayElement) {
        const videoEl = document.createElement("video");
        try {
          await loadVideoElementForHistory(videoEl, layer.data.url);
        } catch {
          continue;
        }

        videoObject._videoEl = videoEl;
        videoObject._videoOpacity = videoObject._videoOpacity ?? 1;
        videoObject._videoOverlayVisible =
          videoObject._videoOverlayVisible ?? true;
        videoObject._disposeVideo = () => {
          videoEl.pause();
          videoEl.removeAttribute("src");
          videoEl.load();
        };
        attachVideoOverlay(canvas, videoObject, videoEl);
        setVideoOverlayVisibility(videoObject, true);
      }

      applyPersistedLayerState(object, layer);
      applyVideoResizeControls(videoObject);
      continue;
    }

    if (["image", "text", "sticker"].includes(layer.type)) {
      applyPersistedLayerState(object, layer);
      applyVideoOverlayControls(object);
      attachMediaOverlay(canvas, object as any, layer);
      (object as any)._syncMediaOverlay?.();
    }
  }

  syncFabricLayerStack(canvas, layers);
  syncVideoOverlays(canvas);
  canvas.requestRenderAll();
};
