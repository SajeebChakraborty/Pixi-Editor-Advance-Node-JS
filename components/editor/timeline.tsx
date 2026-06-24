"use client";

import {
  findMergeableMediaPair,
  type Layer,
  useEditorStore,
} from "@/lib/store";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Scissors,
  Music,
  Video,
  Type,
  Image as ImageIcon,
  Plus,
  Trash2,
  Combine,
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "@/lib/video-playback-url";
import { toast } from "sonner";
import {
  buildVideoComposition,
  type SceneTransitionType,
} from "@/lib/video-composition";
import { SCENE_TRANSITION_OPTIONS } from "@/lib/video-transitions";

const videoFrameCache = new Map<string, Promise<string[]>>();

function hasMergedNeighbor(
  layer: Layer,
  trackLayers: Layer[],
  side: "before" | "after",
) {
  const mergeGroupId = layer.data?.mergeGroupId;
  if (!mergeGroupId) return false;

  const layerStart = Number(layer.startTime || 0);
  const layerEnd = layerStart + Number(layer.duration || 0);
  return trackLayers.some((candidate) => {
    if (
      candidate.id === layer.id ||
      candidate.data?.mergeGroupId !== mergeGroupId
    ) {
      return false;
    }
    const candidateStart = Number(candidate.startTime || 0);
    const candidateEnd =
      candidateStart + Number(candidate.duration || 0);
    return side === "before"
      ? Math.abs(candidateEnd - layerStart) <= 0.01
      : Math.abs(layerEnd - candidateStart) <= 0.01;
  });
}

function captureVideoFrames(url: string) {
  const cached = videoFrameCache.get(url);
  if (cached) return cached;

  const capturePromise = new Promise<string[]>((resolve) => {
    const video = document.createElement("video");
    const resolvedUrl = resolveVideoPlaybackUrl(url);
    if (videoNeedsCrossOrigin(resolvedUrl)) {
      video.crossOrigin = "anonymous";
    }
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    video.onerror = () => {
      cleanup();
      resolve([]);
    };
    video.onloadedmetadata = async () => {
      const sourceDuration = Number.isFinite(video.duration)
        ? video.duration
        : 0;
      const sampleCount = 6;
      const nextFrames: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext("2d");
      if (!context || sourceDuration <= 0) {
        cleanup();
        resolve([]);
        return;
      }

      for (let index = 0; index < sampleCount; index += 1) {
        const sampleTime =
          Math.max(0, sourceDuration - 0.05) *
          (index / (sampleCount - 1));

        await new Promise<void>((finishSeek) => {
          if (Math.abs(video.currentTime - sampleTime) < 0.01) {
            finishSeek();
            return;
          }
          let timeoutId = 0;
          const finish = () => {
            window.clearTimeout(timeoutId);
            video.removeEventListener("seeked", finish);
            finishSeek();
          };
          timeoutId = window.setTimeout(finish, 1200);
          video.addEventListener("seeked", finish, { once: true });
          video.currentTime = sampleTime;
        });

        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          nextFrames.push(canvas.toDataURL("image/jpeg", 0.6));
        } catch {
          break;
        }
      }

      cleanup();
      resolve(nextFrames);
    };
    video.src = resolvedUrl;
    video.load();
  });

  videoFrameCache.set(url, capturePromise);
  return capturePromise;
}

function VideoFrameStrip({ url }: { url?: string }) {
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    if (!url) {
      setFrames([]);
      return;
    }

    let cancelled = false;
    void captureVideoFrames(url).then((nextFrames) => {
      if (!cancelled) setFrames(nextFrames);
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (frames.length === 0) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden opacity-55 pointer-events-none">
      {frames.map((frame, index) => (
        <img
          key={`${frame.slice(-16)}-${index}`}
          src={frame}
          alt=""
          className="h-full min-w-0 flex-1 object-cover"
        />
      ))}
    </div>
  );
}

export function Timeline() {
  const {
    getLayers,
    canvas,
    videoState,
    setVideoState,
    splitLayer,
    mergeLayer,
    updateLayer,
    reorderVideoScene,
    setVideoSceneTransition,
    selectLayer,
    deleteLayer,
    addLayer,
  } = useEditorStore();
  const layers = getLayers();
  const composition = buildVideoComposition(layers);

  const selectedLayerId = canvas.selectedLayerId;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isTrimmable = true; // All layers can be trimmed/split
  const canMergeSelected = Boolean(
    selectedLayerId && findMergeableMediaPair(layers, selectedLayerId),
  );

  const [zoom, setZoom] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const pendingSceneReorderRef = useRef<{
    layerId: string;
    targetIndex: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize-start" | "resize-end";
    layerId: string;
    startX: number;
    startY: number;
    originalStart: number;
    originalDuration: number;
    originalTrack: number;
    originalMediaStart: number;
  } | null>(null);

  const duration = Math.max(
    0.1,
    Number(composition.duration || videoState.duration || 30),
  );
  const currentTime = Math.min(
    Math.max(0, Number(videoState.currentTime || 0)),
    duration,
  );
  const isPlaying = videoState.isPlaying;

  const tracksMap = new Map<number, typeof layers>();
  let nextTrack = 0;

  layers.forEach((layer) => {
    let t = layer.track;
    if (typeof t !== "number") {
      t = nextTrack;
      nextTrack++;
    } else {
      nextTrack = Math.max(nextTrack, t + 1);
    }
    if (!tracksMap.has(t)) {
      tracksMap.set(t, []);
    }
    tracksMap.get(t)!.push(layer);
  });

  const trackIndices = Array.from(tracksMap.keys()).sort((a, b) => a - b);

  const setCurrentTime = (time: number) => {
    if (!Number.isFinite(time)) return;
    setVideoState({
      currentTime: Math.min(Math.max(0, time), duration),
      isPlaying: false,
    });
  };

  const togglePlay = () => {
    if (isPlaying) {
      setVideoState({ isPlaying: false });
      return;
    }

    const atEnd = currentTime >= duration - 0.01;
    setVideoState({
      ...(atEnd ? { currentTime: 0 } : {}),
      isPlaying: true,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Sync Video Element Control (Canvas handles the loop, Timeline handles the UI state)
  // We strictly rely on store updates from Canvas for 'currentTime' during playback.
  // But we need to ensure local seek updates store. (setCurrentTime does that).

  // Interaction Handlers
  const handleLayerMouseDown = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    setDragState({
      type: "move",
      layerId,
      startX: e.clientX,
      startY: e.clientY,
      originalStart: layer.startTime || 0,
      originalDuration: layer.duration || duration,
      originalTrack: layer.track ?? 0,
      originalMediaStart: layer.mediaStart || 0,
    });
    pendingSceneReorderRef.current = null;
    selectLayer(layerId);
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    layerId: string,
    side: "start" | "end",
  ) => {
    e.stopPropagation();
    selectLayer(layerId);
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    setDragState({
      type: side === "start" ? "resize-start" : "resize-end",
      layerId,
      startX: e.clientX,
      startY: e.clientY,
      originalStart: layer.startTime || 0,
      originalDuration: layer.duration || duration,
      originalTrack: layer.track ?? 0,
      originalMediaStart: layer.mediaStart || 0,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!dragState || !rulerRef.current) return;

      const rect = rulerRef.current.getBoundingClientRect();
      const totalWidthPixels = rect.width;
      const deltaPixels = e.clientX - dragState.startX;
      const deltaTime = (deltaPixels / totalWidthPixels) * duration;

      if (dragState.type === "move") {
        const layer = layers.find((item) => item.id === dragState.layerId);
        if (layer?.type === "video") {
          const draggedCenter =
            dragState.originalStart +
            dragState.originalDuration / 2 +
            deltaTime;
          const targetIndex = composition.scenes.reduce(
            (closestIndex, scene, index) => {
              const currentDistance = Math.abs(
                draggedCenter -
                  (composition.scenes[closestIndex]?.timelineStart || 0),
              );
              const nextDistance = Math.abs(
                draggedCenter - scene.timelineStart,
              );
              return nextDistance < currentDistance ? index : closestIndex;
            },
            0,
          );
          pendingSceneReorderRef.current = {
            layerId: dragState.layerId,
            targetIndex,
          };
          return;
        }

        let newStart = dragState.originalStart + deltaTime;
        // Clamp
        newStart = Math.max(
          0,
          Math.min(newStart, duration - dragState.originalDuration),
        );

        const deltaY = e.clientY - dragState.startY;
        const trackDelta = Math.round(deltaY / 56); // 48px height + 8px gap
        const newTrack = Math.max(0, dragState.originalTrack + trackDelta);

        updateLayer(dragState.layerId, {
          startTime: newStart,
          track: newTrack,
        });
      } else if (dragState.type === "resize-start") {
        const layer = layers.find((l) => l.id === dragState.layerId);
        if (layer && (layer.type === "video" || layer.type === "audio")) {
          const fixedEnd =
            dragState.originalStart + dragState.originalDuration;
          const earliestTimelineStart = Math.max(
            0,
            dragState.originalStart - dragState.originalMediaStart,
          );
          const newStart = Math.min(
            fixedEnd - 0.1,
            Math.max(
              earliestTimelineStart,
              dragState.originalStart + deltaTime,
            ),
          );
          const shift = newStart - dragState.originalStart;
          updateLayer(dragState.layerId, {
            startTime: newStart,
            duration: fixedEnd - newStart,
            mediaStart: Math.max(0, dragState.originalMediaStart + shift),
          });
        } else {
          let newStart = dragState.originalStart + deltaTime;
          let newDuration = dragState.originalDuration - deltaTime;

          if (newStart < 0) {
            newDuration += newStart;
            newStart = 0;
          }
          if (newDuration < 0.1) {
            newStart =
              dragState.originalStart + dragState.originalDuration - 0.1;
            newDuration = 0.1;
          }
          updateLayer(dragState.layerId, {
            startTime: newStart,
            duration: newDuration,
          });
        }
      } else if (dragState.type === "resize-end") {
        let newDuration = dragState.originalDuration + deltaTime;
        if (newDuration < 0.1) newDuration = 0.1;

        const layer = layers.find((item) => item.id === dragState.layerId);
        const sourceDuration = Number(layer?.data?.sourceDuration || 0);
        if (
          (layer?.type === "video" || layer?.type === "audio") &&
          sourceDuration > 0
        ) {
          newDuration = Math.min(
            newDuration,
            Math.max(0.1, sourceDuration - dragState.originalMediaStart),
          );
        }

        updateLayer(dragState.layerId, { duration: newDuration });
      }
    },
    [
      composition.scenes,
      dragState,
      duration,
      updateLayer,
      layers,
    ],
  );

  const setSelectedTransition = (
    side: "before" | "after",
    type: SceneTransitionType,
  ) => {
    if (!selectedLayer || selectedLayer.type !== "video") return;
    setVideoSceneTransition(selectedLayer.id, side, {
      type,
      duration: type === "none" ? 0 : 0.5,
    });
  };

  const handleMouseUp = useCallback(() => {
    const pendingReorder = pendingSceneReorderRef.current;
    pendingSceneReorderRef.current = null;
    if (pendingReorder) {
      reorderVideoScene(
        pendingReorder.layerId,
        pendingReorder.targetIndex,
      );
    }
    setDragState(null);
  }, [reorderVideoScene]);

  useEffect(() => {
    if (dragState) {
      const onMove = (e: MouseEvent) => handleMouseMove(e);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full h-full flex flex-col bg-white text-gray-900 border-t border-gray-200">
      {/* Time Controls */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs font-mono bg-white border border-gray-200 px-3 py-1.5 rounded-md shadow-sm min-w-[120px] justify-center">
            <span className="text-blue-600 font-bold">
              {formatTime(currentTime)}
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => setCurrentTime(0)}
            className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-all"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center bg-[#8b5cf6] text-white rounded-full hover:bg-[#7c3aed] shadow-lg hover:shadow-xl hover:shadow-[#8b5cf6]/20 transition-all active:scale-95 group"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5 group-hover:scale-110 transition-transform" />
            )}
          </button>
          <button
            onClick={() => {
              if (selectedLayerId && isTrimmable)
                splitLayer(selectedLayerId, currentTime);
            }}
            disabled={!selectedLayerId || !isTrimmable}
            className={cn(
              "p-2 rounded-lg transition-all",
              selectedLayerId && isTrimmable
                ? "hover:bg-gray-200 text-gray-700 hover:text-blue-600"
                : "text-gray-300 cursor-not-allowed",
            )}
            title="Split Selected Layer (S)"
          >
            <Scissors className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (!selectedLayerId) return;
              if (mergeLayer(selectedLayerId)) {
                toast.success("Videos merged into one sequence");
              } else {
                toast.error(
                  "Select two touching video clips on the same track",
                );
              }
            }}
            disabled={!canMergeSelected}
            className={cn(
              "p-2 rounded-lg transition-all",
              canMergeSelected
                ? "hover:bg-gray-200 text-gray-700 hover:text-blue-600"
                : "text-gray-300 cursor-not-allowed",
            )}
            title="Merge With Adjacent Clip"
          >
            <Combine className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (selectedLayerId) deleteLayer(selectedLayerId);
            }}
            disabled={!selectedLayerId}
            className={cn(
              "p-2 rounded-lg transition-all",
              selectedLayerId
                ? "hover:bg-red-50 text-red-500"
                : "text-gray-300 cursor-not-allowed",
            )}
            title="Delete Layer"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedLayer?.type === "video" && (
            <>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
                Before
                <select
                  value={selectedLayer.data?.transitionBefore?.type || "none"}
                  onChange={(event) =>
                    setSelectedTransition(
                      "before",
                      event.target.value as SceneTransitionType,
                    )
                  }
                  className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[10px] normal-case text-gray-700"
                >
                  {SCENE_TRANSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
                After
                <select
                  value={selectedLayer.data?.transitionAfter?.type || "none"}
                  onChange={(event) =>
                    setSelectedTransition(
                      "after",
                      event.target.value as SceneTransitionType,
                    )
                  }
                  className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[10px] normal-case text-gray-700"
                >
                  {SCENE_TRANSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <ZoomOut className="w-4 h-4 text-gray-400" />
          <Slider
            className="w-24"
            defaultValue={[100]}
            min={10}
            max={300}
            step={10}
            onValueChange={(v) => setZoom(v[0])}
          />
          <ZoomIn className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Timeline Area */}
      <div
        className="flex-1 overflow-auto relative custom-scrollbar bg-[#f8f9fa]"
        ref={containerRef}
      >
        <div
          className="min-h-full min-w-full relative py-2 select-none"
          style={{ width: `${Math.max(100, zoom)}%` }}
        >
          {/* Ruler */}
          <div className="sticky top-0 z-30 bg-gray-50/95 shadow-sm px-4">
            <div className="flex h-8">
              <div className="w-24 flex-shrink-0 border-b border-gray-200/50 sticky left-0 z-40 bg-gray-50/95" />
              <div
                ref={rulerRef}
                className="flex-1 border-b border-gray-200/50 flex items-end cursor-pointer relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const newTime = Math.max(
                    0,
                    Math.min((x / rect.width) * duration, duration),
                  );
                  setCurrentTime(newTime);
                }}
              >
                {[...Array(Math.ceil(duration))].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-l border-gray-300 h-3 relative group"
                  >
                    {i % 5 === 0 && (
                      <span className="text-[10px] text-gray-400 absolute -top-5 left-1 font-mono font-medium">
                        {formatTime(i)}
                      </span>
                    )}
                    {/* Sub ticks */}
                    <div className="absolute bottom-0 left-1/2 w-px h-1.5 bg-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-40 flex flex-col items-center group/playhead transition-transform duration-75 ease-out"
                  style={{
                    left: `${(currentTime / duration) * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#8b5cf6] drop-shadow-md" />
                  <div className="w-0.5 h-[100vh] bg-[#8b5cf6] shadow-[0_0_4px_rgba(139,92,246,0.5)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="flex flex-col mt-4 gap-2 px-4 pb-12">
            {trackIndices.map((trackIdx) => {
              const trackLayers = tracksMap.get(trackIdx)!;
              const primaryLayer =
                trackLayers.find((l) => l.id === selectedLayerId) ||
                trackLayers[0];

              return (
                <div
                  key={`track-${trackIdx}`}
                  className="flex h-12 group/track relative"
                >
                  {/* Header */}
                  <div className="w-24 flex-shrink-0 sticky left-0 z-20 flex flex-col justify-center px-1">
                    <div
                      className={cn(
                        "flex items-center gap-2 text-gray-400 uppercase text-[9px] font-black bg-white/50 px-2 py-1.5 rounded-lg border border-gray-100 w-full backdrop-blur-sm shadow-sm transition-all",
                        trackLayers.some((l) => l.id === selectedLayerId) &&
                          "border-blue-500/30 text-blue-600 bg-blue-50/50",
                      )}
                    >
                      {primaryLayer.type === "video" && (
                        <Video className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      {primaryLayer.type === "audio" && (
                        <Music className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {primaryLayer.type === "text" && (
                        <Type className="w-3.5 h-3.5 text-purple-500" />
                      )}
                      {primaryLayer.type === "image" && (
                        <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                      )}
                      <span className="truncate max-w-[50px]">
                        {primaryLayer.name || `Track ${trackIdx + 1}`}
                      </span>
                    </div>
                  </div>

                  {/* Lane */}
                  <div className="flex-1 relative bg-white/30 border border-gray-100/50 rounded-lg shadow-sm overflow-hidden hover:bg-white/50 transition-colors">
                    {trackLayers.map((layer) => (
                      <div
                        key={layer.id}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md border text-[10px] flex items-center px-2 cursor-pointer transition-all select-none shadow-md overflow-hidden",
                          selectedLayerId === layer.id
                            ? "ring-2 ring-blue-500/50 z-10 brightness-105"
                            : "hover:ring-1 hover:ring-black/5 opacity-90 hover:opacity-100",
                          hasMergedNeighbor(layer, trackLayers, "before") &&
                            "rounded-l-none border-l-0",
                          hasMergedNeighbor(layer, trackLayers, "after") &&
                            "rounded-r-none",
                          layer.type === "video"
                            ? "bg-blue-100 border-blue-200 text-blue-800"
                            : layer.type === "audio"
                              ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                              : layer.type === "text"
                                ? "bg-purple-100 border-purple-200 text-purple-800"
                                : "bg-orange-100 border-orange-200 text-orange-800",
                        )}
                        style={{
                          left: `${(layer.startTime! / duration) * 100}%`,
                          width: `${(layer.duration! / duration) * 100}%`,
                        }}
                        onMouseDown={(e) => handleLayerMouseDown(e, layer.id)}
                      >
                        {layer.type === "video" && (
                          <VideoFrameStrip
                            url={layer.data?.url}
                          />
                        )}

                        {/* Trim Handles (Start) */}
                        <div
                          className={cn(
                            "absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 transition-opacity",
                            selectedLayerId === layer.id
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                          onMouseDown={(e) =>
                            handleResizeStart(e, layer.id, "start")
                          }
                        >
                          <div className="w-1.5 h-1/2 min-h-[16px] bg-white border border-gray-300 rounded-full shadow-sm z-30 pointer-events-none flex items-center justify-center">
                            <div className="w-[1px] h-2 bg-gray-400" />
                          </div>
                        </div>

                        <span className="flex min-w-0 items-center gap-1 truncate font-bold px-3 whitespace-nowrap z-0 pointer-events-none">
                          {layer.type === "video" &&
                            layer.data?.linkedAudio?.url && (
                              <Music
                                className="h-3 w-3 shrink-0 text-violet-600"
                                aria-label="Linked audio"
                              />
                            )}
                          {layer.name}
                        </span>

                        {/* Trim Handles (End) */}
                        <div
                          className={cn(
                            "absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 transition-opacity",
                            selectedLayerId === layer.id
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                          onMouseDown={(e) =>
                            handleResizeStart(e, layer.id, "end")
                          }
                        >
                          <div className="w-1.5 h-1/2 min-h-[16px] bg-white border border-gray-300 rounded-full shadow-sm z-30 pointer-events-none flex items-center justify-center">
                            <div className="w-[1px] h-2 bg-gray-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
