"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "@/lib/video-playback-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { useEditorStore } from "@/lib/store";

interface VideoEditorProps {
  videoUrl: string;
}

export function VideoEditorComplete({ videoUrl }: VideoEditorProps) {
  const { setVideoEditorOpen, setVideoState, setEditorMode } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const resolvedSrc = useMemo(
    () => resolveVideoPlaybackUrl(videoUrl),
    [videoUrl],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedSrc) return;

    if (videoNeedsCrossOrigin(resolvedSrc)) {
      video.crossOrigin = "anonymous";
    } else {
      video.removeAttribute("crossorigin");
    }
    video.preload = "auto";
    video.playsInline = true;
    video.src = resolvedSrc;
    video.load();

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setEndTime(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [resolvedSrc]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimelineChange = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <div className="bg-black rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full max-h-64 bg-black" playsInline />
      </div>

      {/* Playback Controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={togglePlayPause}
            className="h-8 w-8 p-0 bg-transparent"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>

          <div className="flex-1">
            <Slider
              value={[currentTime]}
              onValueChange={(val) => handleTimelineChange(val[0])}
              min={0}
              max={duration || 100}
              step={0.1}
              className="w-full"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMuted(!isMuted)}
            className="h-8 w-8 p-0"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Control */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Playback Speed</Label>
        <div className="grid grid-cols-4 gap-2">
          {[0.5, 1, 1.5, 2].map((speed) => (
            <Button
              key={speed}
              size="sm"
              variant={playbackRate === speed ? "default" : "outline"}
              onClick={() => handlePlaybackRateChange(speed)}
              className="text-xs"
            >
              {speed}x
            </Button>
          ))}
        </div>
      </div>

      {/* Trim Controls */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Trim Video</Label>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">
            Start: {formatTime(startTime)}
          </Label>
          <Slider
            value={[startTime]}
            onValueChange={(val) => setStartTime(val[0])}
            min={0}
            max={endTime}
            step={0.1}
            className="w-full"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">
            End: {formatTime(endTime)}
          </Label>
          <Slider
            value={[endTime]}
            onValueChange={(val) => setEndTime(val[0])}
            min={startTime}
            max={duration}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>

      {/* Precision Editor Toggle */}
      <div className="border-t border-white/10 pt-4">
        <Button
          onClick={() => {
            setVideoState({ videoUrl, isPlaying: false });
            setEditorMode("video");
            setVideoEditorOpen(true);
          }}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          Precision Edit Mode
        </Button>
      </div>

      {/* Overlay Options */}
      <div className="border-t border-gray-200 pt-4">
        <Label className="text-sm font-medium mb-2 block">Add Overlay</Label>
        <div className="space-y-2">
          <Button variant="outline" className="w-full text-sm bg-transparent">
            Add Text Overlay
          </Button>
          <Button variant="outline" className="w-full text-sm bg-transparent">
            Add Image Overlay
          </Button>
        </div>
      </div>
    </div>
  );
}
