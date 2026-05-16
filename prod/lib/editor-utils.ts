import * as fabric from "fabric";
import { useEditorStore } from "./store";
import { toast } from "sonner";
import { resolveVideoPlaybackUrl } from "./video-playback-url";

export const addMediaFromUrl = async (
  url: string,
  store: any,
  type?: "image" | "video",
  silent = false,
  forceObjectId?: string
) => {
  const { canvas, addLayer, setVideoState, addRecentAsset, videoState } = store;
  const { width: baseWidth, height: baseHeight } = canvas || { width: 1280, height: 720 };

  const getLiveFabricCanvas = () =>
    useEditorStore.getState().canvas.fabricCanvas ?? canvas?.fabricCanvas;

  const fabricCanvas = getLiveFabricCanvas();
  if (!fabricCanvas) {
    if (!silent) {
       toast.error("please select the canvus, then upload media from recents or add any other draw");
    }
    return;
  }

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

    if (!silent) addRecentAsset({ url, name: "Recent Video", type: "video" });
    const videoEl = document.createElement("video");
    videoEl.preload = "auto";
    videoEl.muted = true;
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
    // Render through an intermediate canvas for stable cross-browser frame painting in Fabric.
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = vWidth;
    frameCanvas.height = vHeight;
    const frameCtx = frameCanvas.getContext("2d");
    if (frameCtx) {
      try {
        frameCtx.drawImage(videoEl, 0, 0, vWidth, vHeight);
      } catch {
        // Ignore first-frame draw failures; sync loop will draw again when ready.
      }
    }
    const scale = Math.min((baseWidth * 0.8) / vWidth, (baseHeight * 0.8) / vHeight) || 1;

    const fabricVideo = new fabric.FabricImage(frameCanvas, { 
      left: (baseWidth - vWidth * scale) / 2, 
      top: (baseHeight - vHeight * scale) / 2, 
      width: vWidth,
      height: vHeight,
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
        name: "Video Layer",
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
        data: { url },
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
      let isTainted = false;
      try {
        loadedEl = await loadImg(proxyUrl, "anonymous");
      } catch {
        loadedEl = await loadImg(url);
        isTainted = true;
      }

      const imgWidth = loadedEl.naturalWidth;
      const imgHeight = loadedEl.naturalHeight;
      const scale = Math.min((baseWidth * 0.9) / imgWidth, (baseHeight * 0.9) / imgHeight) || 1;
      const objectId = forceObjectId || `img_${Date.now()}`;

      const fabricImg = new fabric.FabricImage(loadedEl, {
        left: (baseWidth - imgWidth * scale) / 2,
        top: (baseHeight - imgHeight * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        name: objectId,
        visible: true,
        opacity: 1,
        objectCaching: false
      });

      const liveCanvas = getLiveFabricCanvas();
      if (!liveCanvas) return;

      if (!silent) {
        liveCanvas.clear();
      }

      liveCanvas.add(fabricImg);
      liveCanvas.setActiveObject(fabricImg);
      liveCanvas.bringObjectToFront(fabricImg);
      liveCanvas.renderAll();

      setTimeout(() => liveCanvas.renderAll(), 100);

      if (!silent) {
        addLayer({
          type: "image",
          name: isTainted ? "Image (CORS)" : "Image Layer",
          locked: false,
          visible: true,
          objectId: objectId,
          data: { url },
          startTime: 0, 
          duration: 3600,
        });
        toast.success("Image preview loaded!");
        addRecentAsset({ 
          id: objectId, 
          type: "image", 
          url, 
          name: isLocalUrl ? "Upload" : "Recent Generation" 
        });
      }
    } catch (err) {
      console.error(err);
      if (!silent) toast.error("Load failed");
    }
  }
};

export const addTextToCanvas = (text: string, options: any, fabricCanvas: fabric.Canvas, objectId: string) => {
  const textBox = new fabric.IText(text, {
    left: fabricCanvas.width! / 2,
    top: fabricCanvas.height! / 2,
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
