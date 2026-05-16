"use client";

import { useEffect, useState } from "react";
import { FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useEditorStore } from "@/lib/store";

interface VideoPropertiesProps {
  selectedObject: FabricImage;
}

export function VideoProperties({ selectedObject }: VideoPropertiesProps) {
  const { setVideoState } = useEditorStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [opacity, setOpacity] = useState(selectedObject.opacity || 1);
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

    const updateState = () => {
      setIsPlaying(!videoEl.paused);
      setVolume(videoEl.volume);
      setSpeed(videoEl.playbackRate);
      setCurrentTime(videoEl.currentTime);
      // Retrieve custom trim data if saved
      // @ts-ignore
      setTrimStart(selectedObject.trimStart || 0);
      // @ts-ignore
      setTrimEnd(selectedObject.trimEnd || videoEl.duration);
      if (!duration) setDuration(videoEl.duration);
    };

    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const handleMetadata = () => {
      setDuration(videoEl.duration);
      // @ts-ignore
      if (!selectedObject.trimEnd) setTrimEnd(videoEl.duration);
    };

    videoEl.addEventListener("play", updateState);
    videoEl.addEventListener("pause", updateState);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    videoEl.addEventListener("loadedmetadata", handleMetadata);

    // Initial sync
    updateState();

    return () => {
      videoEl.removeEventListener("play", updateState);
      videoEl.removeEventListener("pause", updateState);
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
      videoEl.removeEventListener("loadedmetadata", handleMetadata);
    };
  }, [selectedObject, videoEl]);

  const togglePlay = () => {
    if (!videoEl) return;
    if (isPlaying) videoEl.pause();
    else videoEl.play();
    setVideoState({ isPlaying: !isPlaying });
  };

  const handleSeek = (val: number) => {
    if (!videoEl) return;
    videoEl.currentTime = val;
    setCurrentTime(val);
    setVideoState({ currentTime: val });
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
    selectedObject.set("opacity", val);
    setOpacity(val);
    selectedObject.canvas?.requestRenderAll();
  };

  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
    // Save to object
    // @ts-ignore
    selectedObject.trimStart = start;
    // @ts-ignore
    selectedObject.trimEnd = end;
  };

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
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={(vals) => handleSeek(vals[0])}
              className="cursor-pointer"
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
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          Trim Video
        </h3>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Start</span>
              <span className="text-white font-mono">
                {formatTime(trimStart)}
              </span>
            </div>
            <Slider
              value={[trimStart]}
              max={duration}
              step={0.1}
              onValueChange={(vals) =>
                handleTrimChange(Math.min(vals[0], trimEnd), trimEnd)
              }
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>End</span>
              <span className="text-white font-mono">
                {formatTime(trimEnd)}
              </span>
            </div>
            <Slider
              value={[trimEnd]}
              max={duration}
              step={0.1}
              onValueChange={(vals) =>
                handleTrimChange(trimStart, Math.max(vals[0], trimStart))
              }
            />
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
