import * as fabric from "fabric";
import { useEditorStore } from "./store";
import { toast } from "sonner";
import { resolveVideoPlaybackUrl } from "./video-playback-url";

export const addMediaFromUrl = async (
  url: string,
  store: any,
  type?: "image" | "video",
  silent = false,
  forceObjectId?: string,
  mediaName?: string,
  targetFabricCanvas?: fabric.Canvas | null
) => {
  const { canvas, addLayer, setVideoState, addRecentAsset, videoState, setCanvas } = store;
  const { width: storeWidth, height: storeHeight } = canvas || { width: 1280, height: 720 };

  const getLiveFabricCanvas = () =>
    targetFabricCanvas ?? useEditorStore.getState().canvas.fabricCanvas ?? canvas?.fabricCanvas;

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
    return;
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
      return;
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
       return;
    }

    const objectId = forceObjectId || `vid_${Date.now()}`;
    const vWidth = videoEl.videoWidth || 1280;
    const vHeight = videoEl.videoHeight || 720;
    const previewScale = Math.min(
      1,
      (baseWidth * 0.8) / vWidth,
      (baseHeight * 0.8) / vHeight,
      1280 / Math.max(vWidth, vHeight),
    ) || 1;
    const frameWidth = Math.max(1, Math.round(vWidth * previewScale));
    const frameHeight = Math.max(1, Math.round(vHeight * previewScale));
    // Render through an intermediate canvas for stable cross-browser frame painting in Fabric.
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = frameWidth;
    frameCanvas.height = frameHeight;
    const frameCtx = frameCanvas.getContext("2d");
    if (frameCtx) {
      try {
        frameCtx.drawImage(videoEl, 0, 0, frameWidth, frameHeight);
      } catch {
        // Ignore first-frame draw failures; sync loop will draw again when ready.
      }
    }
    const scale = Math.min((baseWidth * 0.8) / frameWidth, (baseHeight * 0.8) / frameHeight) || 1;

    const fabricVideo = new fabric.FabricImage(frameCanvas, { 
      left: (baseWidth - frameWidth * scale) / 2,
      top: (baseHeight - frameHeight * scale) / 2,
      width: frameWidth,
      height: frameHeight,
      scaleX: scale, 
      scaleY: scale,
      name: objectId,
      objectCaching: false, // CRITICAL: Force every frame refresh
      visible: true,
      opacity: 1,
    });
    (fabricVideo as any)._videoEl = videoEl;
    (fabricVideo as any)._videoFrameCanvas = frameCanvas;
    (fabricVideo as any)._videoFrameCtx = frameCtx;

    if (!silent) {
      fabricCanvas.clear();
    }
    fabricCanvas.add(fabricVideo);
    fabricCanvas.setActiveObject(fabricVideo);
    fabricCanvas.renderAll();

    if (!silent) {
      addLayer({
        type: "video",
        name: videoDisplayName,
        locked: false,
        visible: true,
        startTime: 0,
        duration:
          Number.isFinite(videoEl.duration) && videoEl.duration > 0
            ? videoEl.duration
            : Number.isFinite(videoState?.duration) && (videoState?.duration || 0) > 0
              ? (videoState?.duration as number)
              : 30,
        objectId: objectId,
        data: { url, name: videoDisplayName },
      });
      // Snap preview timeline to start so newly added short videos are immediately visible.
      setVideoState({
        currentTime: 0,
        startTime: 0,
        isPlaying: false,
        videoUrl: url,
      });
      toast.success("Video added to canvas!");
    }
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
      const hasImageLayer = currentLayers.some((layer: any) => layer.type === "image");
      const shouldAutoResizeCanvasToImage =
        !silent &&
        !hasImageLayer &&
        Number.isFinite(imgWidth) &&
        Number.isFinite(imgHeight) &&
        imgWidth > 0 &&
        imgHeight > 0;

      if (shouldAutoResizeCanvasToImage) {
        setCanvas?.({ width: imgWidth, height: imgHeight });
      }

      const targetWidth = shouldAutoResizeCanvasToImage ? imgWidth : baseWidth;
      const targetHeight = shouldAutoResizeCanvasToImage ? imgHeight : baseHeight;
      const scale = shouldAutoResizeCanvasToImage
        ? 1
        : Math.max(targetWidth / imgWidth, targetHeight / imgHeight) || 1;
      const objectId = forceObjectId || `img_${Date.now()}`;

      const fabricImg = new fabric.FabricImage(loadedEl, {
        left: shouldAutoResizeCanvasToImage ? 0 : (targetWidth - imgWidth * scale) / 2,
        top: shouldAutoResizeCanvasToImage ? 0 : (targetHeight - imgHeight * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        name: objectId,
        visible: true,
        opacity: 1,
        objectCaching: false
      });

      const liveCanvas = getLiveFabricCanvas();
      if (!liveCanvas) return;

      liveCanvas.add(fabricImg);
      liveCanvas.setActiveObject(fabricImg);
      liveCanvas.bringObjectToFront(fabricImg);
      liveCanvas.renderAll();

      setTimeout(() => liveCanvas.renderAll(), 100);

      if (!silent) {
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
          startTime: 0, 
          duration: 3600,
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
    } catch (err) {
      console.error(err);
      if (!silent) toast.error("Load failed");
    }
  }
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
