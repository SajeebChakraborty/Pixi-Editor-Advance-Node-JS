import * as fabric from "fabric";
import { useEditorStore } from "./store";
import { toast } from "sonner";
import { resolveVideoPlaybackUrl } from "./video-playback-url";
import { attachVideoOverlay } from "./video-overlay";
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

export const PHOTO_DRAG_MIME_TYPE = "application/x-pixi-photo";

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
  if (persisted) object.set(persisted as any);

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

  const getLiveFabricCanvas = () => {
    const candidate =
      targetFabricCanvas ??
      useEditorStore.getState().canvas.fabricCanvas ??
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

  const isVideo = type === "video" || url.match(/\.(mp4|webm|mov)(\?.*)?$/i);

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
        const timeoutId = window.setTimeout(() => reject(new Error("Timeout while loading metadata")), 25000);

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          videoEl.onloadedmetadata = null;
          videoEl.onloadeddata = null;
          videoEl.oncanplay = null;
          videoEl.onerror = null;
        };

        videoEl.onloadedmetadata = () => {
          cleanup();
          resolve();
        };
        videoEl.oncanplay = () => {
          cleanup();
          resolve();
        };
        videoEl.onloadeddata = () => {
          cleanup();
          resolve();
        };
        videoEl.onerror = () => {
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

        videoEl.crossOrigin = sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:") ? null : "anonymous";
        videoEl.src = sourceUrl;
        videoEl.load();
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
       console.error(e);
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
      currentStore.setCanvas({ width: vWidth, height: vHeight });
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
    const targetWidth = Math.max(
      1,
      isFirstVideo && !silent ? vWidth : projectCanvas.width || baseWidth,
    );
    const targetHeight = Math.max(
      1,
      isFirstVideo && !silent ? vHeight : projectCanvas.height || baseHeight,
    );
    const displayScale =
      Math.min(targetWidth / vWidth, targetHeight / vHeight) || 1;
    // The browser composites the real video element. Fabric only owns this
    // transparent object for selection and transforms.
    const transparentPixel = document.createElement("canvas");
    transparentPixel.width = 1;
    transparentPixel.height = 1;

    const fabricVideo = new fabric.FabricImage(transparentPixel, {
      left: (targetWidth - vWidth * displayScale) / 2,
      top: (targetHeight - vHeight * displayScale) / 2,
      width: vWidth,
      height: vHeight,
      scaleX: displayScale,
      scaleY: displayScale,
      name: objectId,
      objectCaching: false,
      visible: true,
      opacity: 1,
    });
    (fabricVideo as any)._videoEl = videoEl;
    (fabricVideo as any)._videoOpacity = 1;
    (fabricVideo as any)._videoOverlayVisible = true;
    (fabricVideo as any)._disposeVideo = () => {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    };

    targetCanvas.add(fabricVideo);
    if (targetCanvas !== currentStore.videoFabricCanvas) {
      attachVideoOverlay(targetCanvas, fabricVideo as any, videoEl);
    }
    targetCanvas.setActiveObject(fabricVideo);
    targetCanvas.bringObjectToFront(fabricVideo);
    targetCanvas.requestRenderAll();

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

      const imgWidth = loadedEl.naturalWidth;
      const imgHeight = loadedEl.naturalHeight;
      const currentLayers = useEditorStore.getState().getLayers();
      const hasVideoLayer = currentLayers.some(
        (layer: any) => layer.type === "video",
      );
      const hasVisualLayer = currentLayers.some((layer: any) =>
        ["image", "video", "sticker"].includes(layer.type),
      );
      const shouldAutoResizeCanvasToImage =
        !silent &&
        !hasVisualLayer &&
        Number.isFinite(imgWidth) &&
        Number.isFinite(imgHeight) &&
        imgWidth > 0 &&
        imgHeight > 0;

      if (shouldAutoResizeCanvasToImage) {
        setCanvas?.({ width: imgWidth, height: imgHeight });
        // Let the canvas dimension effect finish before attaching the first
        // image, then reacquire the active Fabric instance below.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }

      const targetWidth = shouldAutoResizeCanvasToImage ? imgWidth : baseWidth;
      const targetHeight = shouldAutoResizeCanvasToImage ? imgHeight : baseHeight;
      const scale = shouldAutoResizeCanvasToImage
        ? 1
        : hasVisualLayer
          ? Math.min(
              1,
              (targetWidth * 0.45) / imgWidth,
              (targetHeight * 0.45) / imgHeight,
            ) || 1
          : Math.max(targetWidth / imgWidth, targetHeight / imgHeight) || 1;
      const objectId = forceObjectId || `img_${Date.now()}`;
      const renderedWidth = imgWidth * scale;
      const renderedHeight = imgHeight * scale;
      const imageLeft = placement
        ? placement.left - renderedWidth / 2
        : shouldAutoResizeCanvasToImage
          ? 0
          : (targetWidth - renderedWidth) / 2;
      const imageTop = placement
        ? placement.top - renderedHeight / 2
        : shouldAutoResizeCanvasToImage
          ? 0
          : (targetHeight - renderedHeight) / 2;

      const fabricImg = new fabric.FabricImage(loadedEl, {
        left: imageLeft,
        top: imageTop,
        scaleX: scale,
        scaleY: scale,
        name: objectId,
        visible: true,
        opacity: 1,
        objectCaching: false
      });

      const liveCanvas =
        targetFabricCanvas ?? useEditorStore.getState().canvas.fabricCanvas;
      if (!liveCanvas) return null;

      liveCanvas.add(fabricImg);
      fabricImg.set({
        visible: true,
        opacity: 1,
        evented: true,
        selectable: true,
      });
      fabricImg.setCoords();
      liveCanvas.setActiveObject(fabricImg);
      liveCanvas.bringObjectToFront(fabricImg);
      liveCanvas.requestRenderAll();

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
          data: {
            url,
            name: imageDisplayName,
            originalUrl: url,
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
        useEditorStore
          .getState()
          .saveToHistory(JSON.stringify(liveCanvas.toJSON()));
        fabricImg.set({ visible: true, opacity: 1 });
        liveCanvas.setActiveObject(fabricImg);
        liveCanvas.requestRenderAll();
        toast.success("Image preview loaded!");
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
  const textBox = new fabric.IText(text, {
    left: width / 2,
    top: height / 2,
    fill: "#000000",
    fontFamily: "Roboto",
    fontSize: 40,
    originX: "center",
    originY: "center",
    ...options,
    name: objectId,
  });
  fabricCanvas.add(textBox);
  fabricCanvas.setActiveObject(textBox);
  fabricCanvas.renderAll();
  return textBox;
};
