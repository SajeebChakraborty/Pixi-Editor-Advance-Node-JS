"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Scissors,
  Maximize,
  Download,
  Plus,
  Type,
  ImageIcon,
  Music,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Canvas as FabricCanvas, FabricImage, IText } from "fabric";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "@/lib/video-playback-url";

export function VideoPlayerCanvas() {
  const {
    videoState,
    setVideoState,
    setVideoEditorOpen,
    addLayer,
    deleteLayer,
    getLayers,
    setFabricCanvas,
    splitLayer,
    canvas: globalCanvas,
  } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const videoResolutionRef = useRef({ width: 1920, height: 1080 });
  const [isExported, setIsExported] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState({
    width: 1920,
    height: 1080,
  });

  // Effects State
  const [filters, setFilters] = useState({
    grayscale: 0,
    blur: 0,
    brightness: 100,
  });

  const {
    videoUrl,
    currentTime,
    duration,
    isPlaying,
    isMuted,
    volume,
    playbackRate,
    startTime,
    endTime,
  } = videoState;

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
    setFabricCanvas(canvas);
    window.addEventListener("resize", syncCanvasSize);
    setTimeout(syncCanvasSize, 100);

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [setFabricCanvas, syncCanvasSize]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!videoUrl) {
      video.src = "";
      video.load();
      return;
    }
    const resolved = resolveVideoPlaybackUrl(videoUrl);
    if (videoNeedsCrossOrigin(resolved)) {
      video.crossOrigin = "anonymous";
    } else {
      video.removeAttribute("crossorigin");
    }
    video.preload = "auto";
    video.playsInline = true;
    video.src = resolved;
    video.load();

    const onLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width > 0 && height > 0) {
        videoResolutionRef.current = { width, height };
        setVideoResolution({ width, height });
        requestAnimationFrame(syncCanvasSize);
      }
    };
    const onError = () => {
      const code = video.error?.code;
      const msg =
        code === 4
          ? "Video format not supported or file is corrupted."
          : code === 3
            ? "Video decode failed (try H.264/AAC MP4)."
            : "Could not load video (check URL or network).";
      toast.error(msg);
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [syncCanvasSize, videoUrl]);

  // Sync Video with Timeline (Master Clock)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        setVideoState({
          currentTime: Math.min(duration, currentTime + dt * playbackRate),
        });

        // Loop Logic
        if (currentTime >= endTime) {
          setVideoState({ currentTime: startTime });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      loop();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    isPlaying,
    currentTime,
    duration,
    startTime,
    endTime,
    playbackRate,
    setVideoState,
  ]);

  // Sync Video Element to Timeline Time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const layers = getLayers();
    const videoLayers = layers.filter((l) => l.type === "video");

    // Find active video layer - include tolerance for exact boundary
    const activeLayer = videoLayers.find((l) => {
      const layerStart = l.startTime || 0;
      const layerEnd = layerStart + (l.duration || 0);
      const tolerance = 0.1;
      return currentTime >= layerStart - tolerance && currentTime < layerEnd + tolerance;
    });
    const retainedLayer = activeLayer
      ? null
      : videoLayers
          .filter(
            (layer) =>
              currentTime >=
              Number(layer.startTime || 0) + Number(layer.duration || 0),
          )
          .sort(
            (left, right) =>
              Number(right.startTime || 0) - Number(left.startTime || 0),
          )[0];
    const visibleLayer = activeLayer || retainedLayer;

    if (visibleLayer) {
      // Calculate target video time based on offset and layer start
      const offset = activeLayer
        ? currentTime - (activeLayer.startTime || 0)
        : Math.max(0, Number(visibleLayer.duration || 0) - 0.001);
      const targetTime = (visibleLayer.mediaStart || 0) + offset;

      // Sync video state
      if (Math.abs(video.currentTime - targetTime) > 0.2) {
        video.currentTime = targetTime;
      }

      if (activeLayer && video.paused && isPlaying) {
        video.play().catch(() => { });
      } else if (!activeLayer && !video.paused) {
        video.pause();
      }
      video.style.opacity = "1";
      video.style.display = "block";
    } else {
      // No video at this time (gap) - but keep display block for potential visibility
      video.style.opacity = "0";
      if (!video.paused) video.pause();
    }

    // Ensure fabric canvas is rendered when video visibility changes
    if (fabricRef.current) {
      fabricRef.current.requestRenderAll();
    }
  }, [currentTime, isPlaying, videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  const handleSeek = (val: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = val[0];
      setVideoState({ currentTime: val[0] });
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setVideoState({ isPlaying: false });
      return;
    }

    const videoLayers = getLayers().filter((layer) => layer.type === "video");
    const hasActiveVideo = videoLayers.some((layer) => {
      const layerStart = Number(layer.startTime || 0);
      const layerEnd = layerStart + Number(layer.duration || 0);
      return currentTime >= layerStart && currentTime < layerEnd;
    });
    const firstVideoStart = videoLayers.reduce(
      (earliest, layer) =>
        Math.min(earliest, Number(layer.startTime || 0)),
      Number.POSITIVE_INFINITY,
    );

    setVideoState({
      currentTime:
        !hasActiveVideo && Number.isFinite(firstVideoStart)
          ? firstVideoStart
          : currentTime,
      isPlaying: true,
    });
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleExport = async () => {
    if (!videoUrl) return;
    setIsExported(false);
    toast.promise(
      new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          if (progress >= 100) {
            clearInterval(interval);
            setIsExported(true);
            setDownloadUrl(videoUrl); // Simulate download of the same file
            resolve(true);
          }
        }, 150);
      }),
      {
        loading: "Rendering video layers & effects...",
        success: "Video is ready for download!",
        error: "Export failed",
      },
    );
  };

  const handleAddText = useCallback(async () => {
    if (!fabricRef.current) return;
    const objectId = `text_${Date.now()}`;
    const text = new IText("Enter subtitle...", {
      left: 1920 / 2,
      top: 1080 / 2,
      fontFamily: "Inter",
      fill: "#ffffff",
      fontSize: 80,
      fontWeight: "bold",
      originX: "center",
      originY: "center",
      name: objectId,
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);

    addLayer({
      type: "text",
      name: "Text Overlay",
      locked: false,
      visible: true,
      startTime: currentTime,
      duration: 5,
      objectId: objectId,
    });
    toast.success("Subtitle added to timeline");
  }, [addLayer, currentTime]);

  const handleAddSubtitle = useCallback(async () => {
    if (!fabricRef.current) return;
    const objectId = `subtitle_${Date.now()}`;
    const text = new IText("Type subtitle here...", {
      left: 1920 / 2,
      top: 1080 - 150, // Bottom alignment
      fontFamily: "Inter",
      fill: "#ffffff",
      fontSize: 60,
      fontWeight: "bold",
      originX: "center",
      originY: "center",
      name: objectId,
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: 10,
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);

    addLayer({
      type: "text",
      name: "Subtitle",
      locked: false,
      visible: true,
      startTime: currentTime,
      duration: 3,
      objectId: objectId,
    });
    toast.success("Subtitle segment created");
  }, [addLayer, currentTime]);

  const handleAddImage = useCallback(async () => {
    if (!fabricRef.current) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const img = await FabricImage.fromURL(url);
        const objectId = `img_${Date.now()}`;

        // Scale to fit nicely
        const scale = Math.min(800 / img.width!, 600 / img.height!);
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: 1920 / 2,
          top: 1080 / 2,
          originX: "center",
          originY: "center",
          name: objectId,
        });

        fabricRef.current?.add(img);
        fabricRef.current?.setActiveObject(img);

        addLayer({
          type: "image",
          name: file.name,
          locked: false,
          visible: true,
          startTime: currentTime,
          duration: 5,
          objectId: objectId,
        });
        toast.success("Image overlay added");
      }
    };
    input.click();
  }, [addLayer, currentTime]);

  const handleAddAudio = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        addLayer({
          type: "audio",
          name: file.name,
          locked: false,
          visible: true,
          startTime: currentTime,
          duration: 10, // Default 10s audio clip
          data: { url },
        });
        toast.success("Audio track added to timeline");
      }
    };
    input.click();
  }, [addLayer, currentTime]);

  const handleSplit = useCallback(() => {
    // Find a layer to split (selected or first video)
    const layers = getLayers();
    const selectedLayerId = globalCanvas.selectedLayerId;
    let targetLayerId = selectedLayerId;

    if (!targetLayerId) {
      const videoLayer = layers.find((l) => l.type === "video");
      if (videoLayer) targetLayerId = videoLayer.id;
    }

    if (!targetLayerId) {
      toast.error("No layer selected to split");
      return;
    }

    splitLayer(targetLayerId, currentTime);
    toast.success("Layer split at current time");
  }, [getLayers, globalCanvas.selectedLayerId, splitLayer, currentTime]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] overflow-hidden">
      {/* Top Professional Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f0f12]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVideoEditorOpen(false)}
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
        {/* Left Vertical Tool Rail */}
        <div className="w-16 border-r border-white/5 bg-[#0a0a0c] flex flex-col items-center py-6 gap-6">
          <button
            onClick={handleAddText}
            className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all flex flex-col items-center gap-1 group"
          >
            <Type className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] uppercase font-bold tracking-tighter">
              Text
            </span>
          </button>
          <button
            onClick={handleAddSubtitle}
            className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all flex flex-col items-center gap-1 group bg-white/5"
          >
            <Sparkles className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] uppercase font-bold tracking-tighter">
              Subtitles
            </span>
          </button>
          <button
            onClick={handleAddImage}
            className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all flex flex-col items-center gap-1 group"
          >
            <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] uppercase font-bold tracking-tighter">
              Image
            </span>
          </button>
          <button
            onClick={handleAddAudio}
            className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all flex flex-col items-center gap-1 group"
          >
            <Music className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] uppercase font-bold tracking-tighter">
              Audio
            </span>
          </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col bg-[#050507] relative p-12">
          {/* Scene Container */}
          <div className="flex-1 flex items-center justify-center relative">
            <div
              ref={containerRef}
              className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.1)] border border-white/10 group"
              style={{
                aspectRatio: `${videoResolution.width} / ${videoResolution.height}`,
              }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain transition-all duration-200"
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
          <div className="absolute top-8 right-8 flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-white/20">
              Absolute Time
            </span>
            <span className="text-3xl font-mono font-light text-white tracking-tighter">
              {formatTime(currentTime)}
              <span className="text-white/20">
                .
                {Math.floor((currentTime % 1) * 100)
                  .toString()
                  .padStart(2, "0")}
              </span>
            </span>
          </div>
        </div>

        {/* Professional Sidebar */}
        <div className="w-80 border-l border-white/5 bg-[#0f0f12] flex flex-col p-6 gap-8 overflow-y-auto no-scrollbar">
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">
              Properties
            </h3>
            <div className="space-y-6">
              {/* Playback Speed */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/60 uppercase">
                  Speed Factor
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setVideoState({ playbackRate: s });
                        if (videoRef.current) videoRef.current.playbackRate = s;
                      }}
                      className={cn(
                        "h-8 rounded-md text-[10px] font-black transition-all border",
                        playbackRate === s
                          ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                          : "bg-[#18181b] border-white/10 text-white/40 hover:text-white",
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-white/60 uppercase">
                    Audio Level
                  </label>
                  <span className="text-[10px] font-mono text-white/40">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setVideoState({ isMuted: !isMuted })}
                    className="p-2 bg-[#18181b] rounded-lg border border-white/5 text-white/40 hover:text-white"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={(val) =>
                      setVideoState({ volume: val[0], isMuted: val[0] === 0 })
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5 pb-2 flex justify-between">
              <span>Visual Effects</span>
              <span
                className="text-blue-400 cursor-pointer hover:text-blue-300"
                onClick={() =>
                  setFilters({ grayscale: 0, blur: 0, brightness: 100 })
                }
              >
                Reset
              </span>
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 uppercase">
                  Grayscale
                </span>
                <Slider
                  value={[filters.grayscale]}
                  max={100}
                  step={1}
                  onValueChange={(val) =>
                    setFilters((prev) => ({ ...prev, grayscale: val[0] }))
                  }
                  className="py-1"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 uppercase">Blur</span>
                <Slider
                  value={[filters.blur]}
                  max={20}
                  step={1}
                  onValueChange={(val) =>
                    setFilters((prev) => ({ ...prev, blur: val[0] }))
                  }
                  className="py-1"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 uppercase">
                  Brightness
                </span>
                <Slider
                  value={[filters.brightness]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(val) =>
                    setFilters((prev) => ({ ...prev, brightness: val[0] }))
                  }
                  className="py-1"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">
              Primary Trim
            </h3>
            <div className="space-y-8 bg-[#18181b]/50 rounded-xl p-4 border border-white/5">
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/40">IN POINT</span>
                  <span className="text-blue-400">{formatTime(startTime)}</span>
                </div>
                <Slider
                  value={[startTime]}
                  max={endTime}
                  step={0.1}
                  onValueChange={(val) => setVideoState({ startTime: val[0] })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/40">OUT POINT</span>
                  <span className="text-red-400">{formatTime(endTime)}</span>
                </div>
                <Slider
                  value={[endTime]}
                  min={startTime}
                  max={duration}
                  step={0.1}
                  onValueChange={(val) => setVideoState({ endTime: val[0] })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">
              Layers List
            </h3>
            <div className="space-y-2">
              {getLayers().map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-all group/layer"
                >
                  <div className="flex items-center gap-3">
                    {layer.type === "text" ? (
                      <Type className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                    )}
                    <span className="text-[10px] font-bold text-white/80 truncate w-32">
                      {layer.name}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteLayer(layer.id)}
                    className="text-white/20 hover:text-red-400 opacity-0 group-hover/layer:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
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

        <div className="flex items-center gap-4">
          <button
            onClick={handleSplit}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/60 transition-all active:scale-95"
          >
            <Scissors className="w-3.5 h-3.5" />
            Split
          </button>
          <button className="p-2 text-white/20 hover:text-white transition-colors">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
