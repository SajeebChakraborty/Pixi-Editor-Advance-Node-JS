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
  ArrowLeftRight,
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
} from "@/lib/video-composition";
import {
  buildTimelineRows,
  EFFECT_RANGE_LAYER_ID,
  getNextOverlayTrack,
  type TimelineRow,
  type TimelineSegment,
} from "@/lib/timeline-tracks";
import { swapOverlayTracks, syncFabricLayerStack } from "@/lib/layer-stack";

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
    selectLayer,
    deleteLayer,
    addLayer,
    addMidClipTransition,
    removeMidClipTransition,
    setVideoSceneTransition,
    setJunctionTransition,
  } = useEditorStore();
  const layers = getLayers();
  const composition = buildVideoComposition(layers);

  const selectedLayerId = canvas.selectedLayerId;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const isTrimmable = true; // All layers can be trimmed/split
  const canMergeSelected = Boolean(
    selectedLayerId && findMergeableMediaPair(layers, selectedLayerId),
  );
  const selectedVideoScene = selectedLayerId
    ? composition.scenes.find((scene) => scene.layer.id === selectedLayerId)
    : undefined;

  const [zoom, setZoom] = useState(100);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: "move" | "resize-start" | "resize-end" | "row-resize" | "row-reorder";
    layerId: string;
    rowId?: string;
    startX: number;
    startY: number;
    trackWidth: number;
    originalStart: number;
    originalDuration: number;
    originalTrack: number;
    originalMediaStart: number;
    originalRowHeight?: number;
    segmentKind?: TimelineSegment["kind"];
    transitionSide?: "before" | "after" | "junction" | "mid";
    transitionType?: string;
    transitionId?: string;
    lastY?: number;
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
  const canAddMidTransition = Boolean(
    selectedVideoScene &&
      currentTime >= selectedVideoScene.timelineStart &&
      currentTime < selectedVideoScene.timelineEnd,
  );

  const pendingSceneReorderRef = useRef<{
    layerId: string;
    targetIndex: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const getTrackWidth = (element: HTMLElement | null) => {
    const track =
      element?.closest<HTMLElement>("[data-timeline-track]") ||
      rulerRef.current;
    return Math.max(1, track?.getBoundingClientRect().width || 1);
  };

  const beginDrag = (
    drag: NonNullable<typeof dragRef.current>,
    element: HTMLElement | null,
    pointerId?: number,
  ) => {
    if (element && pointerId !== undefined) {
      element.setPointerCapture(pointerId);
    }
    dragRef.current = { ...drag, trackWidth: getTrackWidth(element) };
    setIsDragging(true);
  };

  const applyDragAt = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.lastY = clientY;

    const store = useEditorStore.getState();
    const currentLayers = store.getLayers();
    const currentComposition = buildVideoComposition(currentLayers);
    const timelineDuration = Math.max(
      0.1,
      Number(
        currentComposition.duration || store.videoState.duration || 30,
      ),
    );
    const deltaTime =
      ((clientX - drag.startX) / drag.trackWidth) * timelineDuration;

    if (drag.type === "row-reorder" && drag.rowId) {
      const overlayRows = buildTimelineRows({
        layers: currentLayers,
        composition: currentComposition,
        filterPreset: store.videoState.filterPreset || "none",
        filterPresetIntensity: store.videoState.filterPresetIntensity ?? 100,
        filters: store.videoState.filters,
        effectStartTime: store.videoState.effectStartTime ?? 0,
        effectEndTime: store.videoState.effectEndTime ?? 0,
      }).filter((row) => row.kind === "overlay");

      const sourceIndex = overlayRows.findIndex(
        (row) => row.trackIndex === drag.originalTrack,
      );
      if (sourceIndex === -1) return;

      const rowStride = 56;
      const targetIndex = Math.max(
        0,
        Math.min(
          overlayRows.length - 1,
          sourceIndex + Math.round((clientY - drag.startY) / rowStride),
        ),
      );
      if (targetIndex === sourceIndex) return;

      const sourceTrack = overlayRows[sourceIndex].trackIndex;
      const targetTrack = overlayRows[targetIndex].trackIndex;
      const swappedLayers = swapOverlayTracks(
        currentLayers,
        sourceTrack,
        targetTrack,
      );
      swappedLayers.forEach((layer) => {
        const previous = currentLayers.find((item) => item.id === layer.id);
        if (previous && previous.track !== layer.track) {
          store.updateLayer(layer.id, { track: layer.track });
        }
      });
      drag.originalTrack = targetTrack;
      drag.startY = clientY;
      return;
    }

    if (drag.type === "move") {
      if (
        drag.segmentKind === "transition" &&
        drag.transitionSide === "mid" &&
        drag.transitionId
      ) {
        const scene = currentComposition.scenes.find(
          (item) => item.layer.id === drag.layerId,
        );
        if (!scene) return;

        const clipStart = scene.timelineStart;
        const clipEnd = scene.timelineEnd;
        let newStart = drag.originalStart + deltaTime;
        newStart = Math.max(
          clipStart,
          Math.min(newStart, clipEnd - drag.originalDuration),
        );
        store.updateMidClipTransition(drag.layerId, drag.transitionId, {
          offset: newStart - clipStart,
        });
        return;
      }

      const layer = currentLayers.find((item) => item.id === drag.layerId);
      if (drag.layerId === EFFECT_RANGE_LAYER_ID) {
        let newStart = drag.originalStart + deltaTime;
        newStart = Math.max(
          0,
          Math.min(newStart, timelineDuration - drag.originalDuration),
        );
        store.setVideoState({
          effectStartTime: newStart,
          effectEndTime: newStart + drag.originalDuration,
        });
        return;
      }

      if (layer?.type === "video") {
        const draggedCenter =
          drag.originalStart + drag.originalDuration / 2 + deltaTime;
        const targetIndex = currentComposition.scenes.reduce(
          (closestIndex, scene, index) => {
            const currentDistance = Math.abs(
              draggedCenter -
                (currentComposition.scenes[closestIndex]?.timelineStart || 0),
            );
            const nextDistance = Math.abs(
              draggedCenter - scene.timelineStart,
            );
            return nextDistance < currentDistance ? index : closestIndex;
          },
          0,
        );
        pendingSceneReorderRef.current = {
          layerId: drag.layerId,
          targetIndex,
        };
        return;
      }

      let newStart = drag.originalStart + deltaTime;
      newStart = Math.max(
        0,
        Math.min(newStart, timelineDuration - drag.originalDuration),
      );
      const deltaY = clientY - drag.startY;
      const trackDelta = Math.round(deltaY / 56);
      const minTrack =
        layer && ["text", "image", "sticker", "shape"].includes(layer.type)
          ? 3
          : 0;
      const newTrack = Math.max(minTrack, drag.originalTrack + trackDelta);
      store.updateLayer(drag.layerId, {
        startTime: newStart,
        track: newTrack,
      });
      return;
    }

    if (drag.type === "row-resize" && drag.rowId) {
      const nextHeight = Math.min(
        120,
        Math.max(36, (drag.originalRowHeight || 48) + (clientY - drag.startY)),
      );
      setRowHeights((previous) => ({
        ...previous,
        [drag.rowId!]: nextHeight,
      }));
      return;
    }

    if (drag.segmentKind === "transition" && drag.transitionSide) {
      const layer = currentLayers.find((item) => item.id === drag.layerId);
      if (!layer) return;

      if (drag.transitionSide === "mid" && drag.transitionId) {
        const scene = currentComposition.scenes.find(
          (item) => item.layer.id === drag.layerId,
        );
        if (!scene) return;

        const clipStart = scene.timelineStart;
        const clipDuration = scene.duration;
        const currentOffset = drag.originalStart - clipStart;

        if (drag.type === "resize-start") {
          const fixedEnd = drag.originalStart + drag.originalDuration;
          let newStart = drag.originalStart + deltaTime;
          newStart = Math.max(
            clipStart,
            Math.min(newStart, fixedEnd - 0.1),
          );
          store.updateMidClipTransition(drag.layerId, drag.transitionId, {
            offset: newStart - clipStart,
            duration: Math.max(0.1, fixedEnd - newStart),
          });
          return;
        }

        let newDuration =
          drag.type === "resize-end"
            ? drag.originalDuration + deltaTime
            : drag.originalDuration;
        newDuration = Math.max(
          0.1,
          Math.min(newDuration, clipDuration - currentOffset),
        );
        store.updateMidClipTransition(drag.layerId, drag.transitionId, {
          duration: newDuration,
        });
        return;
      }

      const maxDuration = Math.max(
        0.1,
        Math.min(timelineDuration / 2, Number(layer.duration || 1) / 2),
      );
      let newDuration =
        drag.type === "resize-end"
          ? drag.originalDuration + deltaTime
          : drag.originalDuration - deltaTime;
      newDuration = Math.max(0.1, Math.min(maxDuration, newDuration));

      if (drag.transitionSide === "before") {
        const existing = layer.data?.transitionBefore;
        const transitionType =
          existing?.type || drag.transitionType || "dissolve";
        if (transitionType === "none") return;
        store.setVideoSceneTransition(drag.layerId, "before", {
          type: transitionType,
          duration: newDuration,
        });
        return;
      }

      const existing = layer.data?.transitionAfter;
      const transitionType = existing?.type || drag.transitionType || "dissolve";
      if (transitionType === "none") return;
      store.setJunctionTransition(drag.layerId, {
        type: transitionType,
        duration: newDuration,
      });
      return;
    }

    if (drag.type === "resize-start") {
      if (drag.layerId === EFFECT_RANGE_LAYER_ID) {
        const fixedEnd = drag.originalStart + drag.originalDuration;
        const newStart = Math.min(
          fixedEnd - 0.1,
          Math.max(0, drag.originalStart + deltaTime),
        );
        store.setVideoState({
          effectStartTime: newStart,
          effectEndTime: fixedEnd,
        });
        return;
      }

      const layer = currentLayers.find((item) => item.id === drag.layerId);
      if (layer?.type === "video") {
        const maxExtend = drag.originalMediaStart;
        const maxTrim = drag.originalDuration - 0.1;
        const shift = Math.max(-maxExtend, Math.min(maxTrim, deltaTime));
        store.updateLayer(drag.layerId, {
          mediaStart: Math.max(0, drag.originalMediaStart + shift),
          duration: Math.max(0.1, drag.originalDuration - shift),
        });
        return;
      }

      if (layer?.type === "audio") {
        const fixedEnd = drag.originalStart + drag.originalDuration;
        const earliestTimelineStart = Math.max(
          0,
          drag.originalStart - drag.originalMediaStart,
        );
        const newStart = Math.min(
          fixedEnd - 0.1,
          Math.max(earliestTimelineStart, drag.originalStart + deltaTime),
        );
        const shift = newStart - drag.originalStart;
        store.updateLayer(drag.layerId, {
          startTime: newStart,
          duration: fixedEnd - newStart,
          mediaStart: Math.max(0, drag.originalMediaStart + shift),
        });
        return;
      }

      let newStart = drag.originalStart + deltaTime;
      let newDuration = drag.originalDuration - deltaTime;
      if (newStart < 0) {
        newDuration += newStart;
        newStart = 0;
      }
      if (newDuration < 0.1) {
        newStart = drag.originalStart + drag.originalDuration - 0.1;
        newDuration = 0.1;
      }
      store.updateLayer(drag.layerId, {
        startTime: newStart,
        duration: newDuration,
      });
      return;
    }

    if (drag.type === "resize-end") {
      if (drag.layerId === EFFECT_RANGE_LAYER_ID) {
        let newDuration = drag.originalDuration + deltaTime;
        newDuration = Math.max(
          0.1,
          Math.min(newDuration, timelineDuration - drag.originalStart),
        );
        store.setVideoState({
          effectEndTime: drag.originalStart + newDuration,
        });
        return;
      }

      let newDuration = drag.originalDuration + deltaTime;
      if (newDuration < 0.1) newDuration = 0.1;

      const layer = currentLayers.find((item) => item.id === drag.layerId);
      const sourceDuration = Number(layer?.data?.sourceDuration || 0);
      if (
        (layer?.type === "video" || layer?.type === "audio") &&
        sourceDuration > 0
      ) {
        newDuration = Math.min(
          newDuration,
          Math.max(0.1, sourceDuration - drag.originalMediaStart),
        );
      }

      store.updateLayer(drag.layerId, { duration: newDuration });
    }
  }, []);

  const endDrag = useCallback(() => {
    const pendingReorder = pendingSceneReorderRef.current;
    pendingSceneReorderRef.current = null;
    if (pendingReorder) {
      reorderVideoScene(
        pendingReorder.layerId,
        pendingReorder.targetIndex,
      );
    }

    const store = useEditorStore.getState();
    const fabricCanvas =
      store.editorMode === "video"
        ? store.videoFabricCanvas || store.canvas.fabricCanvas
        : store.canvas.fabricCanvas;
    syncFabricLayerStack(fabricCanvas, store.getLayers());

    dragRef.current = null;
    setIsDragging(false);
  }, [reorderVideoScene]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      applyDragAt(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      if (!dragRef.current) return;
      endDrag();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [applyDragAt, endDrag]);

  const timelineRows = buildTimelineRows({
    layers,
    composition,
    filterPreset: filterPreset || "none",
    filterPresetIntensity: filterPresetIntensity ?? 100,
    filters: videoFilters,
    effectStartTime,
    effectEndTime,
  });

  const selectedSegment = selectedSegmentId
    ? timelineRows
        .flatMap((row) => row.segments)
        .find((segment) => segment.id === selectedSegmentId)
    : undefined;
  const isTransitionSelected = selectedSegment?.kind === "transition";

  const handleDeleteSelection = () => {
    if (selectedSegment?.kind === "transition" && selectedSegment.layerId) {
      if (selectedSegment.transitionSide === "mid" && selectedSegment.transitionId) {
        removeMidClipTransition(
          selectedSegment.layerId,
          selectedSegment.transitionId,
        );
      } else if (selectedSegment.transitionSide === "before") {
        setVideoSceneTransition(selectedSegment.layerId, "before", {
          type: "none",
          duration: 0,
        });
      } else {
        setJunctionTransition(selectedSegment.layerId, {
          type: "none",
          duration: 0,
        });
      }
      setSelectedSegmentId(null);
      toast.success("Transition removed");
      return;
    }

    if (selectedLayerId) {
      deleteLayer(selectedLayerId);
      setSelectedSegmentId(null);
    }
  };

  useEffect(() => {
    if (!selectedLayerId) {
      if (
        selectedSegmentId &&
        !timelineRows.some((row) =>
          row.segments.some((segment) => segment.id === selectedSegmentId),
        )
      ) {
        setSelectedSegmentId(null);
      }
      return;
    }

    const matchingSegments = timelineRows.flatMap((row) =>
      row.segments.filter((segment) => segment.layerId === selectedLayerId),
    );
    if (matchingSegments.length === 0) return;

    const preferredSegment =
      matchingSegments.find((segment) => segment.kind === "video") ||
      matchingSegments[0];
    if (
      !selectedSegmentId ||
      !matchingSegments.some((segment) => segment.id === selectedSegmentId)
    ) {
      setSelectedSegmentId(preferredSegment.id);
    }
  }, [selectedLayerId, selectedSegmentId, timelineRows]);

  const handleAddTextLayer = () => {
    const objectId = `text_${Date.now()}`;
    addLayer({
      type: "text",
      name: "Text Layer",
      locked: false,
      visible: true,
      objectId,
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
  const handleLayerMouseDown = (
    e: React.PointerEvent,
    layerId: string,
    segment?: TimelineSegment,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    setSelectedSegmentId(segment?.id || layerId);
    beginDrag(
      {
        type: "move",
        layerId,
        startX: e.clientX,
        startY: e.clientY,
        trackWidth: 1,
        originalStart: segment?.startTime ?? layer.startTime ?? 0,
        originalDuration: segment?.duration ?? layer.duration ?? duration,
        originalTrack: layer.track ?? 0,
        originalMediaStart: layer.mediaStart || 0,
      },
      e.currentTarget as HTMLElement,
      e.pointerId,
    );
    pendingSceneReorderRef.current = null;
    selectLayer(layerId);
  };

  const handleSegmentMouseDown = (
    event: React.PointerEvent,
    segment: TimelineSegment,
  ) => {
    if (event.button !== 0) return;
    setSelectedSegmentId(segment.id);

    if (segment.kind === "transition" && segment.layerId) {
      event.stopPropagation();
      selectLayer(segment.layerId);
      if (segment.transitionSide === "mid" && segment.draggable) {
        beginDrag(
          {
            type: "move",
            layerId: segment.layerId,
            startX: event.clientX,
            startY: event.clientY,
            trackWidth: 1,
            originalStart: segment.startTime,
            originalDuration: segment.duration,
            originalTrack: 0,
            originalMediaStart: 0,
            segmentKind: "transition",
            transitionSide: segment.transitionSide,
            transitionType: segment.transitionType,
            transitionId: segment.transitionId,
          },
          event.currentTarget as HTMLElement,
          event.pointerId,
        );
      }
      return;
    }

    if (segment.kind === "effects" && segment.layerId === EFFECT_RANGE_LAYER_ID) {
      event.stopPropagation();
      selectLayer(null);
      beginDrag(
        {
          type: "move",
          layerId: EFFECT_RANGE_LAYER_ID,
          startX: event.clientX,
          startY: event.clientY,
          trackWidth: 1,
          originalStart: segment.startTime,
          originalDuration: segment.duration,
          originalTrack: 0,
          originalMediaStart: 0,
        },
        event.currentTarget as HTMLElement,
        event.pointerId,
      );
      return;
    }

    if (!segment.layerId || segment.draggable === false) {
      if (segment.layerId && segment.layerId !== EFFECT_RANGE_LAYER_ID) {
        selectLayer(segment.layerId);
      } else {
        selectLayer(null);
      }
      event.stopPropagation();
      return;
    }
    handleLayerMouseDown(event, segment.layerId, segment);
  };

  const handleSegmentResizeStart = (
    event: React.PointerEvent,
    segment: TimelineSegment,
    side: "start" | "end",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    setSelectedSegmentId(segment.id);

    const baseDrag = {
      type: side === "start" ? ("resize-start" as const) : ("resize-end" as const),
      startX: event.clientX,
      startY: event.clientY,
      trackWidth: 1,
      originalStart: segment.startTime,
      originalDuration: segment.duration,
      originalTrack: 0,
      originalMediaStart: 0,
    };

    if (segment.kind === "effects" && segment.layerId === EFFECT_RANGE_LAYER_ID) {
      selectLayer(null);
      beginDrag(
        { ...baseDrag, layerId: EFFECT_RANGE_LAYER_ID },
        event.currentTarget as HTMLElement,
        event.pointerId,
      );
      return;
    }

    if (segment.kind === "transition" && segment.layerId) {
      selectLayer(segment.layerId);
      beginDrag(
        {
          ...baseDrag,
          layerId: segment.layerId,
          segmentKind: "transition",
          transitionSide: segment.transitionSide,
          transitionType: segment.transitionType,
          transitionId: segment.transitionId,
        },
        event.currentTarget as HTMLElement,
        event.pointerId,
      );
      return;
    }

    if (!segment.layerId || segment.resizable === false) return;

    const layer = layers.find((item) => item.id === segment.layerId);
    selectLayer(segment.layerId);
    beginDrag(
      {
        ...baseDrag,
        layerId: segment.layerId,
        originalMediaStart: layer?.mediaStart || 0,
        originalTrack: layer?.track ?? 0,
        segmentKind: segment.kind,
      },
      event.currentTarget as HTMLElement,
      event.pointerId,
    );
  };

  const handleRowReorderStart = (
    event: React.PointerEvent,
    row: TimelineRow,
  ) => {
    if (event.button !== 0 || row.kind !== "overlay") return;
    event.stopPropagation();
    event.preventDefault();
    beginDrag(
      {
        type: "row-reorder",
        layerId: "",
        rowId: row.id,
        startX: event.clientX,
        startY: event.clientY,
        trackWidth: 1,
        originalStart: 0,
        originalDuration: 0,
        originalTrack: row.trackIndex,
        originalMediaStart: 0,
      },
      event.currentTarget as HTMLElement,
      event.pointerId,
    );
  };

  const handleRowResizeStart = (
    event: React.PointerEvent,
    rowId: string,
    currentHeight: number,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    beginDrag(
      {
        type: "row-resize",
        layerId: rowId,
        rowId,
        startX: event.clientX,
        startY: event.clientY,
        trackWidth: 1,
        originalStart: 0,
        originalDuration: 0,
        originalTrack: 0,
        originalMediaStart: 0,
        originalRowHeight: currentHeight,
      },
      event.currentTarget as HTMLElement,
      event.pointerId,
    );
  };


  return (
    <div
      className={cn(
        "w-full h-full flex flex-col bg-white text-gray-900 border-t border-gray-200",
        isDragging && "cursor-ew-resize select-none",
      )}
    >
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
              if (!selectedVideoScene) return;
              const offset = currentTime - selectedVideoScene.timelineStart;
              const transitionId = addMidClipTransition(selectedVideoScene.layer.id, {
                offset,
                duration: 0.5,
                type: "dissolve",
              });
              if (transitionId) {
                toast.success("Transition added at playhead");
              } else {
                toast.error("Could not add transition here");
              }
            }}
            disabled={!canAddMidTransition}
            className={cn(
              "p-2 rounded-lg transition-all",
              canAddMidTransition
                ? "hover:bg-gray-200 text-gray-700 hover:text-violet-600"
                : "text-gray-300 cursor-not-allowed",
            )}
            title="Add Transition at Playhead"
          >
            <Sparkles className="w-5 h-5" />
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
            onClick={handleDeleteSelection}
            disabled={!selectedLayerId && !isTransitionSelected}
            className={cn(
              "p-2 rounded-lg transition-all",
              selectedLayerId || isTransitionSelected
                ? "hover:bg-red-50 text-red-500"
                : "text-gray-300 cursor-not-allowed",
            )}
            title={isTransitionSelected ? "Delete Transition" : "Delete Layer"}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
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
                data-timeline-track
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
                selectedSegmentId={selectedSegmentId}
                onSegmentMouseDown={handleSegmentMouseDown}
                onSegmentResizeStart={handleSegmentResizeStart}
                onRowResizeStart={handleRowResizeStart}
                onRowReorderStart={handleRowReorderStart}
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
  selectedSegmentId,
  onSegmentMouseDown,
  onSegmentResizeStart,
  onRowResizeStart,
  onRowReorderStart,
}: {
  row: TimelineRow;
  duration: number;
  rowHeight: number;
  selectedLayerId: string | null;
  selectedSegmentId: string | null;
  onSegmentMouseDown: (
    event: React.PointerEvent,
    segment: TimelineSegment,
  ) => void;
  onSegmentResizeStart: (
    event: React.PointerEvent,
    segment: TimelineSegment,
    side: "start" | "end",
  ) => void;
  onRowResizeStart: (
    event: React.PointerEvent,
    rowId: string,
    currentHeight: number,
  ) => void;
  onRowReorderStart: (
    event: React.PointerEvent,
    row: TimelineRow,
  ) => void;
}) {
  const layers = useEditorStore.getState().getLayers();
  const isRowSelected = row.segments.some(
    (segment) => segment.id === selectedSegmentId,
  );

  const RowIcon =
    row.kind === "video"
      ? Video
      : row.kind === "audio"
        ? Music
        : row.kind === "effects"
          ? Sparkles
          : row.kind === "transitions"
            ? ArrowLeftRight
            : Layers;

  const rowAccent =
    row.kind === "video"
      ? "text-blue-500"
      : row.kind === "audio"
        ? "text-emerald-500"
        : row.kind === "effects"
          ? "text-violet-500"
          : row.kind === "transitions"
            ? "text-amber-500"
            : "text-orange-500";

  return (
    <div className="group/track relative flex" style={{ height: rowHeight }}>
      <div className="sticky left-0 z-20 flex w-24 flex-shrink-0 flex-col justify-center px-1">
        <div
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-gray-100 bg-white/50 px-2 py-1.5 text-[9px] font-black uppercase text-gray-400 shadow-sm backdrop-blur-sm transition-all",
            isRowSelected && "border-blue-500/30 bg-blue-50/50 text-blue-600",
            row.kind === "overlay" &&
              "cursor-grab active:cursor-grabbing hover:border-orange-200 hover:bg-orange-50/60",
          )}
          onPointerDown={
            row.kind === "overlay"
              ? (event) => onRowReorderStart(event, row)
              : undefined
          }
          title={
            row.kind === "overlay"
              ? "Drag up/down to change layer order"
              : undefined
          }
        >
          <RowIcon className={cn("h-3.5 w-3.5", rowAccent)} />
          <span className="max-w-[50px] truncate">{row.label}</span>
        </div>
      </div>

      <div
        data-timeline-track
        className="relative flex-1 overflow-hidden rounded-lg border border-gray-100/50 bg-white/30 shadow-sm transition-colors hover:bg-white/50"
      >
        {row.segments.map((segment) => {
          const isSelected = segment.id === selectedSegmentId;
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
                "group/segment absolute top-1 bottom-1 flex cursor-pointer items-center overflow-visible rounded-md border px-2 text-[10px] shadow-md transition-all select-none",
                isSelected
                  ? "z-10 brightness-105 ring-2 ring-blue-500/50"
                  : "opacity-90 hover:opacity-100 hover:ring-1 hover:ring-black/5",
                segment.kind === "video" &&
                  "overflow-hidden border-blue-200 bg-blue-100 text-blue-800",
                (segment.kind === "audio" || segment.kind === "video-sound") &&
                  "overflow-hidden border-emerald-200 bg-emerald-100 text-emerald-800",
                segment.kind === "effects" &&
                  (segment.label === "No effects applied"
                    ? "overflow-hidden border-dashed border-violet-200 bg-violet-50/70 text-violet-400"
                    : "overflow-hidden border-violet-200 bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-800"),
                segment.kind === "transition" &&
                  "border-amber-200 bg-amber-50 text-amber-900",
                segment.kind === "text" &&
                  "overflow-hidden border-purple-200 bg-purple-100 text-purple-800",
                (segment.kind === "image" || segment.kind === "overlay") &&
                  "overflow-hidden border-orange-200 bg-orange-100 text-orange-800",
              )}
              style={{
                left: `${segmentLeft}%`,
                width: `${segmentWidth}%`,
                minWidth: segment.kind === "effects" ? undefined : "28px",
              }}
              onPointerDown={(event) => onSegmentMouseDown(event, segment)}
            >
              {segment.kind === "video" && <VideoFrameStrip url={videoUrl} />}
              {(segment.kind === "audio" || segment.kind === "video-sound") && (
                <AudioWaveformStrip />
              )}
              {segment.kind === "effects" &&
                segment.label !== "No effects applied" && (
                  <Sparkles className="pointer-events-none absolute left-2 h-3 w-3 text-violet-500/70" />
                )}
              {segment.kind === "transition" && (
                <ArrowLeftRight className="pointer-events-none absolute left-1.5 h-3 w-3 text-amber-600/80" />
              )}

              {segment.resizable !== false && (
                <div
                  className={cn(
                    "absolute top-0 bottom-0 left-0 z-50 flex w-6 cursor-ew-resize items-center justify-center transition-opacity pointer-events-auto",
                    isSelected
                      ? "opacity-100"
                      : "opacity-80 group-hover/segment:opacity-100",
                  )}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSegmentResizeStart(event, segment, "start");
                  }}
                  title="Trim start"
                >
                  <div className="pointer-events-none flex h-2/3 min-h-[20px] w-2 items-center justify-center rounded-full border-2 border-blue-400 bg-white shadow-md">
                    <div className="h-3 w-[2px] rounded-full bg-blue-500" />
                  </div>
                </div>
              )}

              <span className="pointer-events-none z-0 flex min-w-0 items-center gap-1 truncate px-5 font-bold whitespace-nowrap">
                {segment.kind === "video-sound" && (
                  <Music className="h-3 w-3 shrink-0" />
                )}
                {segment.kind === "transition" ? (
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{segment.label}</span>
                    {segment.linkedLayerName && (
                      <span className="truncate text-[8px] font-medium normal-case opacity-70">
                        → {segment.linkedLayerName}
                      </span>
                    )}
                  </span>
                ) : (
                  segment.label
                )}
              </span>

              {segment.resizable !== false && (
                <div
                  className={cn(
                    "absolute top-0 right-0 bottom-0 z-50 flex w-6 cursor-ew-resize items-center justify-center transition-opacity pointer-events-auto",
                    isSelected
                      ? "opacity-100"
                      : "opacity-80 group-hover/segment:opacity-100",
                  )}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSegmentResizeStart(event, segment, "end");
                  }}
                  title="Trim end"
                >
                  <div className="pointer-events-none flex h-2/3 min-h-[20px] w-2 items-center justify-center rounded-full border-2 border-blue-400 bg-white shadow-md">
                    <div className="h-3 w-[2px] rounded-full bg-blue-500" />
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
        onPointerDown={(event) => onRowResizeStart(event, row.id, rowHeight)}
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
