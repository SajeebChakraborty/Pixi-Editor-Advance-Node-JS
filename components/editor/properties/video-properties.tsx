"use client";

import { useEffect, useState } from "react";
import { FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { setVideoOverlayOpacity } from "@/lib/video-overlay";

interface VideoPropertiesProps {
  selectedObject: FabricImage;
}

const finiteMediaTime = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export function VideoProperties({ selectedObject }: VideoPropertiesProps) {
  const {
    videoState,
    setVideoState,
    getSelectedLayer,
    updateLayer,
  } = useEditorStore();
  const selectedLayer = getSelectedLayer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [opacity, setOpacity] = useState(
    Number((selectedObject as any)._videoOpacity ?? 1),
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Trimming
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const element = selectedObject.getElement();
  const videoEl = ((selectedObject as any)._videoEl ||
    (element?.tagName === "VIDEO" ? element : null)) as HTMLVideoElement | null;

  useEffect(() => {
    if (!videoEl) return;

    const updatePlaybackState = () => {
      setIsPlaying(!videoEl.paused);
      setVolume(videoEl.volume);
      setSpeed(videoEl.playbackRate);
    };

    const handleTimeUpdate = () => {
      const clipStart = Math.max(0, Number(selectedLayer?.mediaStart || 0));
      const clipEnd =
        clipStart + Math.max(0.1, Number(selectedLayer?.duration || 0.1));
      setCurrentTime(
        Math.min(clipEnd, Math.max(clipStart, videoEl.currentTime)),
      );
    };
    const handleMetadata = () => {
      const nextDuration = finiteMediaTime(videoEl.duration);
      setDuration((previous) =>
        Math.abs(previous - nextDuration) < 0.001 ? previous : nextDuration,
      );
    };

    videoEl.addEventListener("play", updatePlaybackState);
    videoEl.addEventListener("pause", updatePlaybackState);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    videoEl.addEventListener("loadedmetadata", handleMetadata);

    updatePlaybackState();
    handleMetadata();

    return () => {
      videoEl.removeEventListener("play", updatePlaybackState);
      videoEl.removeEventListener("pause", updatePlaybackState);
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
      videoEl.removeEventListener("loadedmetadata", handleMetadata);
    };
  }, [
    selectedObject,
    videoEl,
    selectedLayer?.id,
    selectedLayer?.mediaStart,
    selectedLayer?.duration,
  ]);

  const sourceDuration = finiteMediaTime(
    selectedLayer?.data?.sourceDuration,
    finiteMediaTime(duration, finiteMediaTime(videoEl?.duration)),
  );
  const committedTrimStart = finiteMediaTime(selectedLayer?.mediaStart);
  const committedTrimEnd = Math.min(
    sourceDuration,
    committedTrimStart +
      Math.max(
        0.1,
        finiteMediaTime(selectedLayer?.duration, sourceDuration),
      ),
  );
  const hasPendingTrim =
    Math.abs(trimStart - committedTrimStart) >= 0.01 ||
    Math.abs(trimEnd - committedTrimEnd) >= 0.01;

  useEffect(() => {
    if (!selectedLayer || sourceDuration <= 0) return;

    setTrimStart((previous) =>
      Math.abs(previous - committedTrimStart) < 0.001
        ? previous
        : committedTrimStart,
    );
    setTrimEnd((previous) =>
      Math.abs(previous - committedTrimEnd) < 0.001
        ? previous
        : committedTrimEnd,
    );
    setCurrentTime((previous) => {
      const next = Math.min(
        committedTrimEnd,
        Math.max(committedTrimStart, previous || videoEl?.currentTime || 0),
      );
      return Math.abs(previous - next) < 0.001 ? previous : next;
    });
  }, [
    selectedLayer?.id,
    committedTrimStart,
    committedTrimEnd,
    sourceDuration,
    videoEl,
  ]);

  const togglePlay = () => {
    setVideoState({ isPlaying: !videoState.isPlaying });
  };

  const handleSeek = (val: number) => {
    const timelineTime =
      Number(selectedLayer?.startTime || 0) +
      Math.max(0, val - Number(selectedLayer?.mediaStart || 0));
    setCurrentTime(val);
    setVideoState({ currentTime: timelineTime, isPlaying: false });
  };

  const handleVolume = (val: number) => {
    if (!videoEl) return;
    videoEl.volume = val;
    videoEl.muted = val === 0;
    setVolume(val);
    setVideoState({ volume: val, isMuted: val === 0 });
  };

  const handleSpeed = (val: number) => {
    if (!videoEl) return;
    videoEl.playbackRate = val;
    setSpeed(val);
    setVideoState({ playbackRate: val });
  };

  const handleOpacity = (val: number) => {
    setVideoOverlayOpacity(selectedObject as any, val);
    setOpacity(val);
  };

  const normalizeTrimRange = (start: number, end: number) => {
    const availableDuration = Math.max(0.1, sourceDuration);
    const safeStart = Math.min(
      Math.max(0, start),
      Math.max(0, availableDuration - 0.1),
    );
    const safeEnd = Math.min(
      availableDuration,
      Math.max(safeStart + 0.1, end),
    );

    return { safeStart, safeEnd };
  };

  const previewTrimRange = (
    start: number,
    end: number,
    previewTime: number,
  ) => {
    const { safeStart, safeEnd } = normalizeTrimRange(start, end);

    setTrimStart(safeStart);
    setTrimEnd(safeEnd);
    setCurrentTime(Math.min(safeEnd, Math.max(safeStart, previewTime)));

    if (videoEl) {
      videoEl.pause();
      try {
        videoEl.currentTime = Math.min(
          safeEnd,
          Math.max(safeStart, previewTime),
        );
      } catch {
        // Metadata sync will seek to the preview frame once it is available.
      }
    }

    if (videoState.isPlaying) {
      setVideoState({ isPlaying: false });
    }
  };

  const applyTrimRange = (start: number, end: number) => {
    if (!selectedLayer) return;

    const { safeStart, safeEnd } = normalizeTrimRange(start, end);
    const clipTimelineStart = Math.max(0, Number(selectedLayer.startTime || 0));

    setTrimStart(safeStart);
    setTrimEnd(safeEnd);
    setCurrentTime(safeStart);
    updateLayer(selectedLayer.id, {
      mediaStart: safeStart,
      duration: safeEnd - safeStart,
    });
    setVideoState({
      currentTime: clipTimelineStart,
      isPlaying: false,
    });

    if (videoEl) {
      videoEl.pause();
      try {
        videoEl.currentTime = safeStart;
      } catch {
        // Canvas synchronization retries when metadata is ready.
      }
    }
  };

  const applyTrim = () => applyTrimRange(trimStart, trimEnd);
  const resetTrim = () => applyTrimRange(0, sourceDuration);

  const formatTime = (seconds: number) => {
    if (!seconds && seconds !== 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Playback Controls */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          Playback
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={togglePlay}
            size="sm"
            className="w-10 h-10 p-0 rounded-full bg-white text-black hover:bg-gray-200"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>
          <div className="flex-1 space-y-1">
            <input
              type="range"
              value={finiteMediaTime(currentTime)}
              min={trimStart}
              max={Math.max(trimStart + 0.1, trimEnd || duration || 0.1)}
              step={0.1}
              onChange={(event) =>
                handleSeek(finiteMediaTime(event.currentTarget.value))
              }
              className="w-full cursor-pointer accent-[#8b5cf6]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audio & Speed */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-300">Volume</Label>
            <span className="text-[10px] text-gray-500">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVolume(volume === 0 ? 1 : 0)}
              className="text-gray-400 hover:text-white"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <Slider
              value={[volume]}
              max={1}
              step={0.1}
              onValueChange={(vals) => handleVolume(vals[0])}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-300">Playback Speed</Label>
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeed(s)}
                className={`text-[10px] font-bold py-1.5 rounded border transition-all ${
                  speed === s
                    ? "bg-[#8b5cf6] border-[#8b5cf6] text-white"
                    : "bg-transparent border-white/10 text-gray-400 hover:border-white/30"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trimming */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Trim Video
          </h3>
          <button
            onClick={resetTrim}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Start</span>
              <span className="text-white font-mono">
                {formatTime(trimStart)}
              </span>
            </div>
            <input
              type="range"
              value={trimStart}
              min={0}
              max={Math.max(0.1, trimEnd - 0.1)}
              step={0.1}
              onChange={(event) =>
                previewTrimRange(
                  finiteMediaTime(event.currentTarget.value),
                  trimEnd,
                  finiteMediaTime(event.currentTarget.value),
                )
              }
              className="w-full accent-[#8b5cf6]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>End</span>
              <span className="text-white font-mono">
                {formatTime(trimEnd)}
              </span>
            </div>
            <input
              type="range"
              value={trimEnd}
              min={Math.min(sourceDuration, trimStart + 0.1)}
              max={Math.max(0.1, sourceDuration)}
              step={0.1}
              onChange={(event) =>
                previewTrimRange(
                  trimStart,
                  finiteMediaTime(event.currentTarget.value),
                  finiteMediaTime(event.currentTarget.value),
                )
              }
              className="w-full accent-[#8b5cf6]"
            />
          </div>

          <div className="space-y-2">
            <Button
              onClick={applyTrim}
              disabled={!selectedLayer || !hasPendingTrim}
              className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-white/10 disabled:text-gray-500"
            >
              <Scissors className="mr-2 h-4 w-4" />
              Trim to {formatTime(trimEnd - trimStart)}
            </Button>
            <p className="text-[10px] leading-relaxed text-gray-500">
              Drag to preview frames. Trim applies the selected range to the
              timeline without modifying the source file.
            </p>
          </div>
        </div>
      </div>

      {/* Transform */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          Appearance
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-300">Opacity</Label>
            <span className="text-[10px] text-gray-500">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <Slider
            value={[opacity]}
            max={1}
            step={0.01}
            onValueChange={(vals) => handleOpacity(vals[0])}
          />
        </div>
      </div>
    </div>
  );
}
