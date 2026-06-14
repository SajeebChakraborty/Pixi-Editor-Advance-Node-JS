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
import { cn } from "@/lib/utils";
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

export function VideoPlayerCanvas() {
  const {
    videoState,
    setVideoState,
    setVideoEditorOpen,
    setEditorMode,
    getLayers,
    setVideoFabricCanvas,
    canvas: globalCanvas,
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
  const composition = useMemo(
    () => buildVideoComposition(getLayers()),
    [getLayers, globalCanvas.pages, globalCanvas.activePageId],
  );
  const audioLayers = useMemo(
    () => getLayers().filter((layer) => layer.type === "audio"),
    [getLayers, globalCanvas.pages, globalCanvas.activePageId],
  );

  const syncCanvasSize = useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    canvas.setDimensions(videoResolutionRef.current, { backstoreOnly: true });
    canvas.setDimensions(
      { width: `${width}px`, height: `${height}px` },
      { cssOnly: true },
    );
    canvas.setZoom(1);
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

    fabricRef.current = canvas;
    setVideoFabricCanvas(canvas);
    window.addEventListener("resize", syncCanvasSize);
    setTimeout(syncCanvasSize, 100);

    return () => {
      if (useEditorStore.getState().videoFabricCanvas === canvas) {
        setVideoFabricCanvas(null);
      }
      canvas.dispose();
      fabricRef.current = null;
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [setVideoFabricCanvas, syncCanvasSize]);

  useEffect(() => {
    const width = Math.max(1, Number(globalCanvas.width || 1920));
    const height = Math.max(1, Number(globalCanvas.height || 1080));
    videoResolutionRef.current = { width, height };
    setVideoResolution({ width, height });
    requestAnimationFrame(syncCanvasSize);
  }, [globalCanvas.height, globalCanvas.width, syncCanvasSize]);

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

    videos.forEach((video, index) => {
      if (!video) return;
      const frame = frames[index];
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

      video.style.opacity = String(frame.opacity);
      video.style.display = "block";
      video.muted =
        isMuted || Boolean(linkedAudio && !linkedAudio.allowNativeAudio);
      video.volume = volume;
      video.playbackRate = playbackRate;
    });

    // Ensure fabric canvas is rendered when video visibility changes
    if (fabricRef.current) {
      getLayers().forEach((layer) => {
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

  const handleSeek = (val: number[]) => {
    setVideoState({ currentTime: val[0] });
  };

  const togglePlayback = useCallback(() => {
    const latestState = useEditorStore.getState().videoState;
    if (latestState.isPlaying) {
      videoARef.current?.pause();
      videoBRef.current?.pause();
      setVideoState({ isPlaying: false });
      return;
    }

    setVideoState({
      currentTime:
        latestState.currentTime >= composition.duration - 0.01
          ? 0
          : latestState.currentTime,
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
      const rendered = await exportVideo("mp4");
      const formData = new FormData();
      formData.append(
        "file",
        new File([rendered.blob], `composition.${rendered.extension}`, {
          type: rendered.mimeType,
        }),
      );
      formData.append("extension", "mp4");
      const response = await fetch("/api/upload-rendered-video", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result?.key) {
        throw new Error(result?.error || "MP4 conversion failed");
      }
      setDownloadUrl(
        `/api/download?key=${encodeURIComponent(result.key)}&filename=${encodeURIComponent("pixigen-video.mp4")}`,
      );
      setIsExported(true);
      toast.success("MP4 is ready.", { id: toastId });
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
                style={{
                  filter: `grayscale(${filters.grayscale}%) blur(${filters.blur}px) brightness(${filters.brightness}%)`,
                }}
                playsInline
                preload="auto"
              />
              <video
                ref={videoBRef}
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: `grayscale(${filters.grayscale}%) blur(${filters.blur}px) brightness(${filters.brightness}%)`,
                }}
                playsInline
                preload="auto"
              />

              {/* Fabric Overlay Canvas */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 pointer-events-auto"
              />

              {/* Status Overlays */}
              <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-md px-2 py-1 flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isPlaying ? "bg-red-500 animate-pulse" : "bg-gray-500",
                    )}
                  />
                  <span className="text-[9px] font-mono text-white/80 uppercase">
                    Composition
                  </span>
                </div>
              </div>

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] cursor-pointer group-hover:bg-black/30 transition-all pointer-events-none">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                  </div>
                </div>
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
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.01}
            onValueChange={handleSeek}
          />
          <span className="text-[10px] font-mono text-white/40">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
