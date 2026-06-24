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
  Sparkles,
  Layers,
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
import {
  buildTimelineRows,
  EFFECT_RANGE_LAYER_ID,
  getNextOverlayTrack,
  type TimelineRow,
  type TimelineSegment,
} from "@/lib/timeline-tracks";

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
    type: "move" | "resize-start" | "resize-end" | "row-resize";
    layerId: string;
    rowId?: string;
    startX: number;
    startY: number;
    originalStart: number;
    originalDuration: number;
    originalTrack: number;
    originalMediaStart: number;
    originalRowHeight?: number;
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
  const filterPreset = videoState.filterPreset;
  const filterPresetIntensity = videoState.filterPresetIntensity;
  const videoFilters = videoState.filters;
  const effectStartTime = videoState.effectStartTime ?? 0;
  const effectEndTime = videoState.effectEndTime ?? 0;

  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const timelineRows = buildTimelineRows({
    layers,
    composition,
    filterPreset: filterPreset || "none",
    filterPresetIntensity: filterPresetIntensity ?? 100,
    filters: videoFilters,
    effectStartTime,
    effectEndTime,
  });

  const handleAddTextLayer = () => {
    addLayer({
      type: "text",
      name: "Text Layer",
      locked: false,
      visible: true,
      startTime: currentTime,
      duration: Math.max(1, duration - currentTime),
      track: getNextOverlayTrack(layers),
      data: {
        content: "Your Text Here",
        fontFamily: "Arial",
        fontWeight: "bold",
        fill: "#ffffff",
        fontSize: 48,
      },
    });
    toast.success("Text layer added to timeline");
  };

  const handleAddAudioLayer = () => {
    toast.info("Open the Audio tab to upload or add background music");
  };

  const handleAddOverlayLayer = () => {
    toast.info("Open the Photos tab to add an image overlay to the timeline");
  };

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
        if (dragState.layerId === EFFECT_RANGE_LAYER_ID) {
          let newStart = dragState.originalStart + deltaTime;
          newStart = Math.max(
            0,
            Math.min(newStart, duration - dragState.originalDuration),
          );
          setVideoState({
            effectStartTime: newStart,
            effectEndTime: newStart + dragState.originalDuration,
          });
          return;
        }

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
      } else if (dragState.type === "row-resize" && dragState.rowId) {
        const nextHeight = Math.min(
          120,
          Math.max(36, (dragState.originalRowHeight || 48) + (e.clientY - dragState.startY)),
        );
        setRowHeights((previous) => ({
          ...previous,
          [dragState.rowId!]: nextHeight,
        }));
      } else if (dragState.type === "resize-start") {
        if (dragState.layerId === EFFECT_RANGE_LAYER_ID) {
          const fixedEnd =
            dragState.originalStart + dragState.originalDuration;
          const newStart = Math.min(
            fixedEnd - 0.1,
            Math.max(0, dragState.originalStart + deltaTime),
          );
          setVideoState({
            effectStartTime: newStart,
            effectEndTime: fixedEnd,
          });
          return;
        }

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
        if (dragState.layerId === EFFECT_RANGE_LAYER_ID) {
          let newDuration = dragState.originalDuration + deltaTime;
          newDuration = Math.max(
            0.1,
            Math.min(newDuration, duration - dragState.originalStart),
          );
          setVideoState({
            effectEndTime: dragState.originalStart + newDuration,
          });
          return;
        }

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
      setVideoState,
    ],
  );

  const handleSegmentMouseDown = (
    event: React.MouseEvent,
    segment: TimelineSegment,
  ) => {
    if (segment.kind === "effects" && segment.layerId === EFFECT_RANGE_LAYER_ID) {
      event.stopPropagation();
      setDragState({
        type: "move",
        layerId: EFFECT_RANGE_LAYER_ID,
        startX: event.clientX,
        startY: event.clientY,
        originalStart: segment.startTime,
        originalDuration: segment.duration,
        originalTrack: 0,
        originalMediaStart: 0,
      });
      return;
    }

    if (!segment.layerId || segment.draggable === false) {
      if (segment.layerId) selectLayer(segment.layerId);
      event.stopPropagation();
      return;
    }
    handleLayerMouseDown(event, segment.layerId);
  };

  const handleSegmentResizeStart = (
    event: React.MouseEvent,
    segment: TimelineSegment,
    side: "start" | "end",
  ) => {
    event.stopPropagation();

    if (segment.kind === "effects" && segment.layerId === EFFECT_RANGE_LAYER_ID) {
      setDragState({
        type: side === "start" ? "resize-start" : "resize-end",
        layerId: EFFECT_RANGE_LAYER_ID,
        startX: event.clientX,
        startY: event.clientY,
        originalStart: segment.startTime,
        originalDuration: segment.duration,
        originalTrack: 0,
        originalMediaStart: 0,
      });
      return;
    }

    if (!segment.layerId || segment.resizable === false) return;
    handleResizeStart(event, segment.layerId, side);
  };

  const handleRowResizeStart = (
    event: React.MouseEvent,
    rowId: string,
    currentHeight: number,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setDragState({
      type: "row-resize",
      layerId: rowId,
      rowId,
      startX: event.clientX,
      startY: event.clientY,
      originalStart: 0,
      originalDuration: 0,
      originalTrack: 0,
      originalMediaStart: 0,
      originalRowHeight: currentHeight,
    });
  };

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
          <div className="flex flex-col mt-4 gap-2 px-4 pb-4">
            {timelineRows.map((row) => (
              <TimelineTrackRow
                key={row.id}
                row={row}
                duration={duration}
                rowHeight={rowHeights[row.id] ?? 48}
                selectedLayerId={selectedLayerId}
                onSegmentMouseDown={handleSegmentMouseDown}
                onSegmentResizeStart={handleSegmentResizeStart}
                onRowResizeStart={handleRowResizeStart}
              />
            ))}

            <div className="flex items-center gap-2 pt-2">
              <span className="w-24 flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400">
                Add Layer
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddAudioLayer}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Audio
                </button>
                <button
                  type="button"
                  onClick={handleAddTextLayer}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-[10px] font-bold text-purple-700 transition-colors hover:bg-purple-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Text
                </button>
                <button
                  type="button"
                  onClick={handleAddOverlayLayer}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 text-[10px] font-bold text-orange-700 transition-colors hover:bg-orange-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Image
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTrackRow({
  row,
  duration,
  rowHeight,
  selectedLayerId,
  onSegmentMouseDown,
  onSegmentResizeStart,
  onRowResizeStart,
}: {
  row: TimelineRow;
  duration: number;
  rowHeight: number;
  selectedLayerId: string | null;
  onSegmentMouseDown: (
    event: React.MouseEvent,
    segment: TimelineSegment,
  ) => void;
  onSegmentResizeStart: (
    event: React.MouseEvent,
    segment: TimelineSegment,
    side: "start" | "end",
  ) => void;
  onRowResizeStart: (
    event: React.MouseEvent,
    rowId: string,
    currentHeight: number,
  ) => void;
}) {
  const layers = useEditorStore.getState().getLayers();
  const isRowSelected = row.segments.some(
    (segment) => segment.layerId && segment.layerId === selectedLayerId,
  );

  const RowIcon =
    row.kind === "video"
      ? Video
      : row.kind === "audio"
        ? Music
        : row.kind === "effects"
          ? Sparkles
          : Layers;

  const rowAccent =
    row.kind === "video"
      ? "text-blue-500"
      : row.kind === "audio"
        ? "text-emerald-500"
        : row.kind === "effects"
          ? "text-violet-500"
          : "text-orange-500";

  return (
    <div className="group/track relative flex" style={{ height: rowHeight }}>
      <div className="sticky left-0 z-20 flex w-24 flex-shrink-0 flex-col justify-center px-1">
        <div
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-gray-100 bg-white/50 px-2 py-1.5 text-[9px] font-black uppercase text-gray-400 shadow-sm backdrop-blur-sm transition-all",
            isRowSelected && "border-blue-500/30 bg-blue-50/50 text-blue-600",
          )}
        >
          <RowIcon className={cn("h-3.5 w-3.5", rowAccent)} />
          <span className="max-w-[50px] truncate">{row.label}</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-100/50 bg-white/30 shadow-sm transition-colors hover:bg-white/50">
        {row.segments.map((segment) => {
          const isSelected =
            segment.layerId === EFFECT_RANGE_LAYER_ID
              ? false
              : Boolean(segment.layerId) &&
                segment.layerId === selectedLayerId;
          const segmentWidth = Math.max(
            0,
            (segment.duration / duration) * 100,
          );
          const segmentLeft = Math.max(
            0,
            (segment.startTime / duration) * 100,
          );
          const videoUrl =
            segment.kind === "video"
              ? layers.find((layer) => layer.id === segment.layerId)?.data?.url
              : undefined;

          return (
            <div
              key={segment.id}
              className={cn(
                "absolute top-1 bottom-1 flex cursor-pointer items-center overflow-hidden rounded-md border px-2 text-[10px] shadow-md transition-all select-none",
                isSelected
                  ? "z-10 brightness-105 ring-2 ring-blue-500/50"
                  : "opacity-90 hover:opacity-100 hover:ring-1 hover:ring-black/5",
                segment.kind === "video" &&
                  "border-blue-200 bg-blue-100 text-blue-800",
                (segment.kind === "audio" || segment.kind === "video-sound") &&
                  "border-emerald-200 bg-emerald-100 text-emerald-800",
                segment.kind === "effects" &&
                  (segment.label === "No effects applied"
                    ? "border-dashed border-violet-200 bg-violet-50/70 text-violet-400"
                    : "border-violet-200 bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-800"),
                segment.kind === "text" &&
                  "border-purple-200 bg-purple-100 text-purple-800",
                (segment.kind === "image" || segment.kind === "overlay") &&
                  "border-orange-200 bg-orange-100 text-orange-800",
              )}
              style={{
                left: `${segmentLeft}%`,
                width: `${segmentWidth}%`,
                minWidth: segment.kind === "effects" ? undefined : "28px",
              }}
              onMouseDown={(event) => onSegmentMouseDown(event, segment)}
            >
              {segment.kind === "video" && <VideoFrameStrip url={videoUrl} />}
              {(segment.kind === "audio" || segment.kind === "video-sound") && (
                <AudioWaveformStrip />
              )}
              {segment.kind === "effects" &&
                segment.label !== "No effects applied" && (
                  <Sparkles className="pointer-events-none absolute left-2 h-3 w-3 text-violet-500/70" />
                )}

              {segment.resizable !== false && (
                <div
                  className={cn(
                    "absolute top-0 bottom-0 left-0 z-20 flex w-4 cursor-ew-resize items-center justify-center transition-opacity",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover/track:opacity-100",
                  )}
                  onMouseDown={(event) =>
                    onSegmentResizeStart(event, segment, "start")
                  }
                >
                  <div className="pointer-events-none z-30 flex h-1/2 min-h-[16px] w-1.5 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm">
                    <div className="h-2 w-[1px] bg-gray-400" />
                  </div>
                </div>
              )}

              <span className="pointer-events-none z-0 flex min-w-0 items-center gap-1 truncate px-3 font-bold whitespace-nowrap">
                {segment.kind === "video-sound" && (
                  <Music className="h-3 w-3 shrink-0" />
                )}
                {segment.label}
              </span>

              {segment.resizable !== false && (
                <div
                  className={cn(
                    "absolute top-0 right-0 bottom-0 z-20 flex w-4 cursor-ew-resize items-center justify-center transition-opacity",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover/track:opacity-100",
                  )}
                  onMouseDown={(event) =>
                    onSegmentResizeStart(event, segment, "end")
                  }
                >
                  <div className="pointer-events-none z-30 flex h-1/2 min-h-[16px] w-1.5 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm">
                    <div className="h-2 w-[1px] bg-gray-400" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={`Resize ${row.label} track height`}
        onMouseDown={(event) => onRowResizeStart(event, row.id, rowHeight)}
        className="absolute right-0 -bottom-1 left-24 z-30 h-2 cursor-row-resize opacity-0 transition-opacity group-hover/track:opacity-100"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-gray-300/80" />
      </button>
    </div>
  );
}

function AudioWaveformStrip() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-35"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(16,185,129,0.55) 0 2px, transparent 2px 6px)",
        maskImage:
          "repeating-linear-gradient(180deg, transparent 0 20%, black 20% 80%, transparent 80% 100%)",
      }}
    />
  );
}
