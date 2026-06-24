"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/store";
import {
  Play,
  Pause,
  Download,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Canvas as FabricCanvas } from "fabric";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "@/lib/video-playback-url";
import {
  buildVideoComposition,
  resolveCompositionFrame,
} from "@/lib/video-composition";
import {
  getLinkedAudioTargetTime,
  getLinkedVideoAudio,
  isLinkedAudioActive,
} from "@/lib/linked-video-audio";
import {
  addMediaFromUrl,
  applyPersistedLayerState,
} from "@/lib/editor-utils";
import {
  applyResolvedFramePresentation,
  buildVideoFilterCss,
  isEffectActiveAtTime,
} from "@/lib/video-filters";
import {
  attachVideoOverlay,
  setVideoOverlayOpacity,
  setVideoOverlayVisibility,
  syncVideoOverlays,
} from "@/lib/video-overlay";

export function VideoPlayerCanvas() {
  const {
    videoState,
    setVideoState,
    setVideoEditorOpen,
    setEditorMode,
    getLayers,
    setVideoFabricCanvas,
    canvas: globalCanvas,
    selectLayer,
    saveToHistory,
  } = useEditorStore();
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const loadedVideoSourcesRef = useRef<(string | null)[]>([null, null]);
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());
  const linkedAudioElementsRef = useRef(new Map<string, HTMLAudioElement>());
  const videoResolutionRef = useRef({ width: 1920, height: 1080 });
  const [isExported, setIsExported] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState({
    width: 1920,
    height: 1080,
  });

  const {
    videoUrl,
    currentTime,
    duration,
    isPlaying,
    isMuted,
    volume,
    playbackRate,
    filters,
  } = videoState;
  const effectStartTime = videoState.effectStartTime ?? 0;
  const effectEndTime = videoState.effectEndTime ?? 0;
  const composition = useMemo(
    () => buildVideoComposition(getLayers()),
    [getLayers, globalCanvas.pages, globalCanvas.activePageId],
  );
  const filterCss = useMemo(() => buildVideoFilterCss(filters), [filters]);
  const activeFilterCss = useMemo(() => {
    if (
      !isEffectActiveAtTime(
        currentTime,
        effectStartTime,
        effectEndTime,
        composition.duration,
      )
    ) {
      return buildVideoFilterCss();
    }
    return filterCss;
  }, [
    composition.duration,
    currentTime,
    effectEndTime,
    effectStartTime,
    filterCss,
  ]);
  const audioLayers = useMemo(
    () => getLayers().filter((layer) => layer.type === "audio"),
    [getLayers, globalCanvas.pages, globalCanvas.activePageId],
  );

  const syncCanvasSize = useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const resolution = videoResolutionRef.current;
    canvas.setDimensions(resolution, { backstoreOnly: true });
    canvas.setDimensions(
      { width: `${width}px`, height: `${height}px` },
      { cssOnly: true },
    );
    (canvas as any).artboardExportBounds = {
      left: 0,
      top: 0,
      width: resolution.width,
      height: resolution.height,
    };
    canvas.setZoom(1);
    syncVideoOverlays(canvas);
    canvas.requestRenderAll();
  }, []);

  // Initialize Fabric Overlay
  useEffect(() => {
    if (!overlayCanvasRef.current) return;

    const canvas = new FabricCanvas(overlayCanvasRef.current, {
      width: videoResolutionRef.current.width,
      height: videoResolutionRef.current.height,
      selection: true,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
    });
    (canvas as any).artboardExportBounds = {
      left: 0,
      top: 0,
      width: videoResolutionRef.current.width,
      height: videoResolutionRef.current.height,
    };

    const syncNativeVideoLayers = () => syncVideoOverlays(canvas);
    canvas.on("after:render", syncNativeVideoLayers);

    const handleSelection = () => {
      const activeObjects = canvas.getActiveObjects() || [];
      if (activeObjects.length !== 1) {
        selectLayer(null);
        return;
      }
      const objectName = (activeObjects[0] as any).name as string | undefined;
      const layerId = getLayers().find((layer) => layer.objectId === objectName)?.id;
      selectLayer(layerId || null);
    };

    const persistCanvasState = () => {
      saveToHistory(JSON.stringify(canvas.toJSON()));
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => selectLayer(null));
    canvas.on("object:modified", persistCanvasState);

    canvas.targetFindTolerance = 8;
    fabricRef.current = canvas;
    setVideoFabricCanvas(canvas);
    window.addEventListener("resize", syncCanvasSize);
    setTimeout(syncCanvasSize, 100);

    return () => {
      if (useEditorStore.getState().videoFabricCanvas === canvas) {
        setVideoFabricCanvas(null);
      }
      canvas.off("after:render", syncNativeVideoLayers);
      canvas.dispose();
      fabricRef.current = null;
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [getLayers, saveToHistory, selectLayer, setVideoFabricCanvas, syncCanvasSize]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let cancelled = false;

    const restoreVisualLayers = async () => {
      for (const layer of getLayers()) {
        if (
          cancelled ||
          !layer.objectId ||
          !layer.data?.url ||
          !["image", "video", "sticker"].includes(layer.type) ||
          canvas.getObjects().some((object: any) => object.name === layer.objectId)
        ) {
          continue;
        }

        const objectId = await addMediaFromUrl(
          layer.data.url,
          useEditorStore.getState(),
          layer.type === "video" ? "video" : "image",
          true,
          layer.objectId,
          layer.data.name || layer.name,
          canvas,
        );
        const object = canvas
          .getObjects()
          .find((candidate: any) => candidate.name === objectId);
        if (object) applyPersistedLayerState(object, layer);
      }
      canvas.requestRenderAll();
    };

    void restoreVisualLayers();
    return () => {
      cancelled = true;
    };
  }, [getLayers, globalCanvas.activePageId, globalCanvas.pages]);

  useEffect(() => {
    const width = Math.max(1, Number(globalCanvas.width || 1920));
    const height = Math.max(1, Number(globalCanvas.height || 1080));
    videoResolutionRef.current = { width, height };
    setVideoResolution({ width, height });
    requestAnimationFrame(syncCanvasSize);
  }, [globalCanvas.height, globalCanvas.width, syncCanvasSize]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const selectedLayerId = globalCanvas.selectedLayerId;
    if (!selectedLayerId) {
      if (canvas.getActiveObjects().length === 1) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const layer = getLayers().find((item) => item.id === selectedLayerId);
    if (!layer?.objectId) {
      if (canvas.getActiveObjects().length === 1) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const object = canvas
      .getObjects()
      .find((candidate: any) => candidate.name === layer.objectId);
    if (!object || layer.visible === false) return;

    if (canvas.getActiveObject() !== object) {
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
    }
  }, [getLayers, globalCanvas.selectedLayerId, globalCanvas.pages]);

  useEffect(() => {
    const onLoadedMetadata = () => {
      requestAnimationFrame(syncCanvasSize);
    };
    const onError = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      const code = video.error?.code;
      const msg =
        code === 4
          ? "Video format not supported or file is corrupted."
          : code === 3
            ? "Video decode failed (try H.264/AAC MP4)."
            : "Could not load video (check URL or network).";
      toast.error(msg);
    };
    const videos = [videoARef.current, videoBRef.current].filter(
      (video): video is HTMLVideoElement => Boolean(video),
    );
    videos.forEach((video) => {
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    });
    return () => {
      videos.forEach((video) => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
      });
    };
  }, [syncCanvasSize]);

  // Sync Video with Timeline (Master Clock)
  useEffect(() => {
    if (!isPlaying) return;
    let animationFrameId = 0;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const latestState = useEditorStore.getState().videoState;
      const playbackEnd = Math.min(
        composition.duration,
        latestState.endTime > 0
          ? latestState.endTime
          : composition.duration,
      );
      const nextTime =
        latestState.currentTime + dt * latestState.playbackRate;

      if (nextTime >= playbackEnd) {
        setVideoState({
          currentTime: playbackEnd,
          isPlaying: false,
        });
        return;
      }

      setVideoState({ currentTime: nextTime });
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [composition.duration, isPlaying, setVideoState]);

  // Sync Video Element to Timeline Time
  useEffect(() => {
    const videos = [videoARef.current, videoBRef.current];
    const frames = resolveCompositionFrame(composition, currentTime);
    const canvas = fabricRef.current;
    const layers = getLayers();
    const fabricManagedObjectIds = new Set<string>();

    if (canvas) {
      layers.forEach((layer) => {
        if (layer.type !== "video" || !layer.objectId) return;

        const object = canvas
          .getObjects()
          .find((candidate: any) => candidate.name === layer.objectId) as any;
        const videoEl = object?._videoEl as HTMLVideoElement | undefined;
        if (!object || !videoEl) return;

        fabricManagedObjectIds.add(layer.objectId);
        const frame = frames.find(
          (candidate) => candidate.scene.layer.objectId === layer.objectId,
        );
        const layerStart = Number(layer.startTime || 0);
        const layerEnd = layerStart + Number(layer.duration || 0);
        const shouldShow =
          layer.visible !== false &&
          currentTime >= layerStart &&
          currentTime < layerEnd;

        attachVideoOverlay(canvas, object, videoEl);
        object.set({
          selectable: layer.locked ? false : true,
          evented: layer.locked ? false : true,
          lockMovementX: Boolean(layer.locked),
          lockMovementY: Boolean(layer.locked),
          lockScalingX: Boolean(layer.locked),
          lockScalingY: Boolean(layer.locked),
          hasControls: !layer.locked,
        });
        object.visible = shouldShow;
        setVideoOverlayVisibility(object, shouldShow);
        setVideoOverlayOpacity(object, shouldShow ? (frame?.opacity ?? 1) : 0);
        videoEl.style.filter = activeFilterCss;

        const linkedAudio = getLinkedVideoAudio(layer);
        videoEl.muted =
          isMuted || Boolean(linkedAudio && !linkedAudio.allowNativeAudio);
        videoEl.volume = volume;
        videoEl.playbackRate = playbackRate;

        if (!shouldShow || !frame) {
          if (!videoEl.paused) videoEl.pause();
          return;
        }

        const mediaStart = Number(layer.mediaStart || 0);
        const targetTime = mediaStart + (currentTime - layerStart);
        if (Math.abs(videoEl.currentTime - targetTime) > 0.12) {
          try {
            videoEl.currentTime = targetTime;
          } catch {
            // Metadata can briefly be unavailable during a remount.
          }
        }

        if (isPlaying && videoEl.paused) {
          void videoEl.play().catch(() => {});
        } else if (!isPlaying && !videoEl.paused) {
          videoEl.pause();
        }
      });

      syncVideoOverlays(canvas);
      canvas.requestRenderAll();
    }

    videos.forEach((video, index) => {
      if (!video) return;
      const frame = frames[index];
      if (
        frame &&
        fabricManagedObjectIds.has(frame.scene.layer.objectId || "")
      ) {
        video.style.opacity = "0";
        video.style.display = "none";
        if (!video.paused) video.pause();
        return;
      }

      if (!frame) {
        video.style.opacity = "0";
        if (!video.paused) video.pause();
        return;
      }

      const sourceUrl = frame.scene.layer.data?.url || videoUrl;
      if (!sourceUrl) return;
      const linkedAudio = getLinkedVideoAudio(frame.scene.layer);
      const resolvedSource = resolveVideoPlaybackUrl(sourceUrl);
      const syncPlayback = () => {
        if (loadedVideoSourcesRef.current[index] !== resolvedSource) return;
        if (video.readyState < 1) return;
        if (Math.abs(video.currentTime - frame.sourceTime) > 0.12) {
          video.currentTime = frame.sourceTime;
        }

        if (isPlaying && video.paused) {
          video.play().catch(() => { });
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      };

      if (loadedVideoSourcesRef.current[index] !== resolvedSource) {
        video.pause();
        if (videoNeedsCrossOrigin(resolvedSource)) {
          video.crossOrigin = "anonymous";
        } else {
          video.removeAttribute("crossorigin");
        }
        loadedVideoSourcesRef.current[index] = resolvedSource;
        video.preload = "auto";
        video.playsInline = true;
        video.src = resolvedSource;
        video.load();
        video.addEventListener("loadedmetadata", syncPlayback, { once: true });
      } else {
        syncPlayback();
      }

      applyResolvedFramePresentation(video, frame, activeFilterCss);
      video.style.display = "block";
      video.muted =
        isMuted || Boolean(linkedAudio && !linkedAudio.allowNativeAudio);
      video.volume = volume;
      video.playbackRate = playbackRate;
    });

    if (fabricRef.current) {
      layers.forEach((layer) => {
        if (layer.type === "video" || !layer.objectId) return;
        const object = fabricRef.current?.getObjects().find(
          (candidate: any) => candidate.name === layer.objectId,
        );
        if (!object) return;
        const layerStart = Number(layer.startTime || 0);
        const layerEnd = layerStart + Number(layer.duration || 0);
        object.visible =
          layer.visible !== false &&
          currentTime >= layerStart &&
          currentTime < layerEnd;
      });
      fabricRef.current.requestRenderAll();
    }
  }, [
    composition,
    currentTime,
    getLayers,
    isMuted,
    isPlaying,
    playbackRate,
    videoUrl,
    volume,
    activeFilterCss,
  ]);

  useEffect(() => {
    [videoARef.current, videoBRef.current].forEach((video) => {
      if (!video) return;
      video.volume = volume;
      video.playbackRate = playbackRate;
    });
  }, [playbackRate, volume]);

  useEffect(() => {
    if (isPlaying) return;
    [videoARef.current, videoBRef.current].forEach((video) => video?.pause());
  }, [isPlaying]);

  useEffect(() => {
    const activeLayerIds = new Set(audioLayers.map((layer) => layer.id));

    audioLayers.forEach((layer) => {
      const sourceUrl = layer.data?.url;
      if (!sourceUrl) return;
      const existingAudio = audioElementsRef.current.get(layer.id);
      if (existingAudio?.dataset.sourceUrl === sourceUrl) return;

      existingAudio?.pause();
      if (existingAudio) {
        existingAudio.removeAttribute("src");
        existingAudio.load();
      }

      const audio = new Audio(sourceUrl);
      audio.preload = "auto";
      audio.dataset.sourceUrl = sourceUrl;
      audioElementsRef.current.set(layer.id, audio);
    });

    audioElementsRef.current.forEach((audio, layerId) => {
      if (activeLayerIds.has(layerId)) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioElementsRef.current.delete(layerId);
    });
  }, [audioLayers]);

  useEffect(() => {
    audioLayers.forEach((layer) => {
      const audio = audioElementsRef.current.get(layer.id);
      if (!audio) return;

      const layerStart = Number(layer.startTime || 0);
      const layerDuration = Number(layer.duration || 0);
      const mediaStart = Number(layer.mediaStart || 0);
      const sourceDuration = Number(layer.data?.sourceDuration || 0);
      const shouldLoop = Boolean(layer.data?.loop && sourceDuration > 0);
      const isActive =
        layer.visible !== false &&
        currentTime >= layerStart &&
        currentTime < layerStart + layerDuration;
      const rawTargetTime = Math.max(
        0,
        mediaStart + currentTime - layerStart,
      );
      const targetTime = shouldLoop
        ? rawTargetTime % sourceDuration
        : rawTargetTime;

      audio.muted = false;
      audio.volume = Math.min(
        1,
        Math.max(0, Number(layer.data?.volume ?? 1)),
      );
      audio.playbackRate = playbackRate || 1;
      audio.loop = shouldLoop;

      if (!isActive) {
        if (!audio.paused) audio.pause();
        return;
      }

      if (
        !Number.isFinite(audio.currentTime) ||
        Math.abs(audio.currentTime - targetTime) > 0.2
      ) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // Metadata loading will make the next synchronization succeed.
        }
      }

      if (isPlaying && audio.paused) {
        void audio.play().catch(() => {});
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    });
  }, [audioLayers, currentTime, isPlaying, playbackRate]);

  useEffect(() => {
    const linkedEntries = composition.scenes
      .map((scene) => ({
        scene,
        linkedAudio: getLinkedVideoAudio(scene.layer),
      }))
      .filter(
        (
          entry,
        ): entry is typeof entry & {
          linkedAudio: NonNullable<typeof entry.linkedAudio>;
        } => Boolean(entry.linkedAudio),
      );
    const activeLayerIds = new Set(
      linkedEntries.map(({ scene }) => scene.layer.id),
    );

    linkedEntries.forEach(({ scene, linkedAudio }) => {
      const existing = linkedAudioElementsRef.current.get(scene.layer.id);
      if (existing?.dataset.sourceUrl === linkedAudio.url) return;

      existing?.pause();
      if (existing) {
        existing.removeAttribute("src");
        existing.load();
      }

      const audio = new Audio(linkedAudio.url);
      audio.preload = "auto";
      audio.dataset.sourceUrl = linkedAudio.url;
      linkedAudioElementsRef.current.set(scene.layer.id, audio);
    });

    linkedAudioElementsRef.current.forEach((audio, layerId) => {
      if (activeLayerIds.has(layerId)) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      linkedAudioElementsRef.current.delete(layerId);
    });
  }, [composition]);

  useEffect(() => {
    const activeFrames = new Map(
      resolveCompositionFrame(composition, currentTime).map((frame) => [
        frame.scene.layer.id,
        frame,
      ]),
    );

    composition.scenes.forEach((scene) => {
      const linkedAudio = getLinkedVideoAudio(scene.layer);
      const audio = linkedAudioElementsRef.current.get(scene.layer.id);
      if (!linkedAudio || !audio) return;

      const frame = activeFrames.get(scene.layer.id);
      const sceneElapsed = Math.max(0, currentTime - scene.timelineStart);
      const shouldPlay =
        Boolean(frame) &&
        scene.layer.visible !== false &&
        isLinkedAudioActive(linkedAudio, sceneElapsed);
      const targetTime = getLinkedAudioTargetTime(
        linkedAudio,
        sceneElapsed,
      );

      audio.muted = false;
      audio.volume = linkedAudio.volume * (frame?.opacity ?? 1);
      audio.playbackRate = playbackRate || 1;
      audio.loop = linkedAudio.loop;

      if (!shouldPlay) {
        if (!audio.paused) audio.pause();
        return;
      }

      if (
        !Number.isFinite(audio.currentTime) ||
        Math.abs(audio.currentTime - targetTime) > 0.2
      ) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // Metadata loading will make the next synchronization succeed.
        }
      }

      if (isPlaying && audio.paused) {
        void audio.play().catch(() => {});
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    });
  }, [composition, currentTime, isPlaying, playbackRate]);

  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });
      audioElementsRef.current.clear();
      linkedAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });
      linkedAudioElementsRef.current.clear();
    };
  }, []);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrentTime =
    safeDuration > 0
      ? Math.min(Math.max(0, currentTime), safeDuration)
      : 0;

  const handleSeek = (val: number[]) => {
    const nextTime = Number(val[0]);
    if (!Number.isFinite(nextTime)) return;
    setVideoState({
      currentTime:
        safeDuration > 0
          ? Math.min(Math.max(0, nextTime), safeDuration)
          : 0,
      isPlaying: false,
    });
  };

  const togglePlayback = useCallback(() => {
    const latestState = useEditorStore.getState().videoState;
    if (latestState.isPlaying) {
      videoARef.current?.pause();
      videoBRef.current?.pause();
      setVideoState({ isPlaying: false });
      return;
    }

    const compositionDuration = Math.max(0, composition.duration);
    const atEnd =
      compositionDuration > 0 &&
      latestState.currentTime >= compositionDuration - 0.01;

    setVideoState({
      ...(atEnd ? { currentTime: 0 } : {}),
      isPlaying: true,
    });
  }, [composition.duration, setVideoState]);

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.closest(
          "input, textarea, select, button, [contenteditable='true'], [role='slider']",
        )
      ) {
        return;
      }

      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener("keydown", handleSpacebar);
    return () => window.removeEventListener("keydown", handleSpacebar);
  }, [togglePlayback]);

  const getSafeTime = (time: number) =>
    Number.isFinite(time) ? Math.max(0, time) : 0;

  const formatTime = (time: number) => {
    const safeTime = getSafeTime(time);
    const mins = Math.floor(safeTime / 60);
    const secs = Math.floor(safeTime % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeParts = (time: number) => {
    const totalCentiseconds = Math.floor(getSafeTime(time) * 100);
    const mins = Math.floor(totalCentiseconds / 6000);
    const secs = Math.floor((totalCentiseconds % 6000) / 100);

    return {
      main: `${mins}:${secs.toString().padStart(2, "0")}`,
      fraction: (totalCentiseconds % 100).toString().padStart(2, "0"),
    };
  };

  const handleExport = async () => {
    setIsExported(false);
    const toastId = toast.loading("Rendering composition...");
    try {
      const { exportVideo } = await import("@/lib/video-renderer");
      const { uploadRenderedVideo } = await import("@/lib/rendered-video-upload");
      const rendered = await exportVideo("mp4");
      const result = await uploadRenderedVideo(
        rendered.blob,
        rendered.extension,
        rendered.mimeType || rendered.blob.type || (rendered.extension === "mp4" ? "video/mp4" : "video/webm"),
      );
      const fileName = `pixigen-video.${result.extension || rendered.extension}`;
      setDownloadUrl(
        `/api/download?key=${encodeURIComponent(result.key)}&filename=${encodeURIComponent(fileName)}`,
      );
      setIsExported(true);
      toast.success(
        (result.extension || rendered.extension) === "mp4"
          ? "MP4 is ready."
          : "WebM is ready.",
        { id: toastId },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export failed",
        { id: toastId },
      );
    }
  };

  const absoluteTimeParts = formatTimeParts(currentTime);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] overflow-hidden">
      {/* Top Professional Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f0f12]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setVideoEditorOpen(false);
              setEditorMode("photo");
            }}
            className="text-white/40 hover:text-white hover:bg-white/5 rounded-lg"
          >
            ← Back
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
            Video Studio <span className="text-blue-500/50 mx-2">//</span>{" "}
            <span className="text-white/80">Composition Mode</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {isExported && downloadUrl && (
            <Button
              asChild
              className="h-8 bg-green-600 hover:bg-green-500 text-white font-black text-[10px] uppercase tracking-widest px-4 rounded-lg animate-bounce"
            >
              <a href={downloadUrl} download="pixigen-video.mp4">
                <Download className="w-3.5 h-3.5 mr-2" />
                Download Video
              </a>
            </Button>
          )}
          <Button
            onClick={handleExport}
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest px-6 rounded-lg shadow-lg shadow-blue-500/10"
          >
            Export MP4
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#050507] p-4">
          {/* Scene Container */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <div
              ref={containerRef}
              className="group relative h-full w-auto max-h-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_100px_rgba(37,99,235,0.1)]"
              style={{
                aspectRatio: `${videoResolution.width} / ${videoResolution.height}`,
              }}
            >
              <video
                ref={videoARef}
                className="absolute inset-0 h-full w-full object-contain"
                playsInline
                preload="auto"
              />
              <video
                ref={videoBRef}
                className="absolute inset-0 h-full w-full object-contain"
                playsInline
                preload="auto"
              />

              {/* Fabric Overlay Canvas */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 pointer-events-auto"
              />

              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label="Play video"
                  className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center border-0 bg-black/20 p-0 backdrop-blur-[1px] transition-all pointer-events-none group-hover:bg-black/30"
                >
                  <span className="pointer-events-auto flex h-16 w-16 scale-90 items-center justify-center rounded-full bg-blue-600 shadow-2xl transition-transform group-hover:scale-100">
                    <Play className="ml-1 h-6 w-6 fill-white text-white" />
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Floating Time Info */}
          <div className="absolute right-8 top-8 flex w-32 flex-col items-end gap-1 text-right">
            <span className="text-[10px] uppercase font-black tracking-widest text-white/20">
              Absolute Time
            </span>
            <span
              className="inline-flex w-full items-baseline justify-end font-mono text-3xl font-light leading-none tracking-normal text-white tabular-nums"
              aria-live="off"
            >
              <span className="w-[5ch] text-right">
                {absoluteTimeParts.main}
              </span>
              <span className="w-[3ch] text-left text-white/20">
                .{absoluteTimeParts.fraction}
              </span>
            </span>
          </div>
        </div>

      </div>

      {/* Control Rail */}
      <div className="h-16 border-t border-white/5 bg-[#0f0f12] flex items-center px-10 gap-8">
        <button
          onClick={togglePlayback}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-black transition-transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-black" />
          ) : (
            <Play className="w-4 h-4 fill-black ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex gap-4 items-center">
          <span className="text-[10px] font-mono text-white/40">
            {formatTime(safeCurrentTime)}
          </span>
          <Slider
            value={[safeCurrentTime]}
            max={Math.max(0.1, safeDuration)}
            step={0.01}
            onValueChange={handleSeek}
          />
          <span className="text-[10px] font-mono text-white/40">
            {formatTime(safeDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
