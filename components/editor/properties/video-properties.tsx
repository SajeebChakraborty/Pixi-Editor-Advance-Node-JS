"use client";

import { useEffect, useRef, useState } from "react";
import { FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  CirclePlay,
  Link2,
  Music,
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { setVideoOverlayOpacity } from "@/lib/video-overlay";
import { getLinkedVideoAudio } from "@/lib/linked-video-audio";
import { toast } from "sonner";

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
    updateLayerData,
    videoRecentAssets,
    addRecentAsset,
  } = useEditorStore();
  const selectedLayer = getSelectedLayer();
  const linkedAudio = getLinkedVideoAudio(selectedLayer);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
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
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
    };
  }, []);

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

  const getAudioDuration = (url: string) =>
    new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      const finish = (value: number) => {
        audio.removeAttribute("src");
        audio.load();
        resolve(value);
      };
      audio.onloadedmetadata = () =>
        finish(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => finish(0);
      audio.src = url;
      audio.load();
    });

  const assignLinkedAudio = async (name: string, url: string) => {
    if (!selectedLayer) return;
    const sourceDuration = await getAudioDuration(url);
    if (sourceDuration <= 0) {
      toast.error("Could not read this audio file.");
      return;
    }

    updateLayerData(selectedLayer.id, {
      linkedAudio: {
        url,
        name,
        sourceDuration,
        volume: linkedAudio?.volume ?? 1,
        loop: linkedAudio?.loop ?? false,
        allowNativeAudio: false,
      },
    });
    setVideoState({
      currentTime: Number(selectedLayer.startTime || 0),
      isPlaying: false,
    });
    toast.success(`Linked ${name} to ${selectedLayer.name}`);
  };

  const uploadLinkedAudio = async (file: File) => {
    const isAudio =
      file.type.startsWith("audio/") ||
      /\.(mp3|mpeg|mpga|wav|m4a|aac|ogg|flac)$/i.test(file.name);
    if (!isAudio) {
      toast.error("Choose a valid audio file.");
      return;
    }

    setIsUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result?.url) {
        throw new Error(result?.error || "Audio upload failed");
      }
      addRecentAsset(
        { url: result.url, name: file.name, type: "audio" },
        "video",
      );
      await assignLinkedAudio(file.name, result.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Audio upload failed",
      );
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const toggleAudioPreview = (url: string) => {
    setVideoState({ isPlaying: false });
    if (previewingUrl === url) {
      previewAudioRef.current?.pause();
      setPreviewingUrl(null);
      return;
    }

    previewAudioRef.current?.pause();
    const audio = new Audio(url);
    audio.volume = linkedAudio?.url === url ? linkedAudio.volume : 1;
    audio.onended = () => setPreviewingUrl(null);
    audio.onerror = () => {
      setPreviewingUrl(null);
      toast.error("Could not preview this audio.");
    };
    void audio.play().catch(() => {
      setPreviewingUrl(null);
      toast.error("Could not preview this audio.");
    });
    previewAudioRef.current = audio;
    setPreviewingUrl(url);
  };

  const updateLinkedAudio = (updates: Record<string, unknown>) => {
    if (!selectedLayer || !linkedAudio) return;
    updateLayerData(selectedLayer.id, {
      linkedAudio: { ...linkedAudio, ...updates },
    });
  };

  const removeLinkedAudio = () => {
    if (!selectedLayer) return;
    previewAudioRef.current?.pause();
    setPreviewingUrl(null);
    updateLayerData(selectedLayer.id, { linkedAudio: null });
    setVideoState({ isPlaying: false });
    toast.success("Linked audio removed.");
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
    <div className="space-y-6 pb-12">
      {/* Playback Controls */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-200">
          <CirclePlay className="h-3.5 w-3.5 text-violet-400" />
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

      <div className="space-y-3 border-t border-white/5 pt-4">
        <h3 className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-200">
          <Link2 className="h-3.5 w-3.5 text-violet-400" />
          Linked Audio
        </h3>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.mpeg,.mpga,.wav,.m4a,.aac,.ogg,.flac"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadLinkedAudio(file);
          }}
        />

        {linkedAudio ? (
          <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAudioPreview(linkedAudio.url)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/30 text-violet-200 hover:bg-violet-600"
                title="Preview linked audio"
              >
                {previewingUrl === linkedAudio.url ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{linkedAudio.name}</p>
                <p className="text-[9px] uppercase tracking-wider text-violet-300">
                  Custom audio replaces native sound
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={removeLinkedAudio}
                className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                title="Remove linked audio"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-gray-300">
                <span>Linked audio volume</span>
                <span>{Math.round(linkedAudio.volume * 100)}%</span>
              </div>
              <Slider
                value={[linkedAudio.volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(values) =>
                  updateLinkedAudio({ volume: values[0] })
                }
              />
            </div>

            <label className="flex items-center justify-between text-[10px] text-gray-300">
              Loop audio to fit video
              <input
                type="checkbox"
                checked={linkedAudio.loop}
                onChange={(event) =>
                  updateLinkedAudio({ loop: event.target.checked })
                }
                className="h-4 w-4 accent-violet-500"
              />
            </label>
            <label className="flex items-center justify-between text-[10px] text-gray-300">
              Also play native video audio
              <input
                type="checkbox"
                checked={linkedAudio.allowNativeAudio}
                onChange={(event) =>
                  updateLinkedAudio({
                    allowNativeAudio: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-violet-500"
              />
            </label>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center text-[10px] text-gray-500">
            No audio linked to this video
          </div>
        )}

        <Button
          variant="outline"
          disabled={isUploadingAudio}
          onClick={() => audioInputRef.current?.click()}
          className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploadingAudio
            ? "Uploading..."
            : linkedAudio
              ? "Replace audio"
              : "Upload audio"}
        </Button>

        {videoRecentAssets.some((asset) => asset.type === "audio") && (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
              Recent audio
            </p>
            {videoRecentAssets
              .filter((asset) => asset.type === "audio")
              .map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.03] p-2"
                >
                  <Music className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <span className="min-w-0 flex-1 truncate text-[10px]">
                    {asset.name}
                  </span>
                  <button
                    onClick={() => toggleAudioPreview(asset.url)}
                    className="text-gray-400 hover:text-white"
                    title="Preview audio"
                  >
                    {previewingUrl === asset.url ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => void assignLinkedAudio(asset.name, asset.url)}
                    className="text-[9px] font-bold uppercase text-violet-300 hover:text-white"
                  >
                    Use
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Trimming */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-2">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-200">
            <Scissors className="h-3.5 w-3.5 text-violet-400" />
            Trim Video
          </h3>
          <button
            onClick={resetTrim}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-white"
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

    </div>
  );
}
