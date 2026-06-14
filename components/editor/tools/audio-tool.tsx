"use client";

import {
  Music,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadEditorAsset } from "@/lib/editor-assets";
import { getEditorProjectId } from "@/lib/project-persistence";

type MusicItem = {
  title: string;
  url: string;
};

export function AudioTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    addLayer,
    deleteLayer,
    getLayers,
    videoRecentAssets,
    addRecentAsset,
    updateLayerData,
    videoState,
    setVideoState,
  } = useEditorStore();

  const backgroundMusic = getLayers().find(
    (layer) =>
      layer.type === "audio" && layer.data?.role === "background-music",
  );
  const musicVolume = Number(backgroundMusic?.data?.volume ?? 0.7);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
    };
  }, []);

  const getAudioDuration = (url: string) =>
    new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";

      const finish = (duration: number) => {
        audio.removeAttribute("src");
        audio.load();
        resolve(duration);
      };

      audio.onloadedmetadata = () =>
        finish(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => finish(0);
      audio.src = url;
      audio.load();
    });

  const replaceBackgroundMusic = async (item: MusicItem) => {
    previewAudioRef.current?.pause();
    setPreviewingUrl(null);
    const state = useEditorStore.getState();
    const projectDuration = Math.max(0.1, state.videoState.duration || 30);
    const sourceDuration = await getAudioDuration(item.url);

    if (sourceDuration <= 0) {
      toast.error("Could not read this audio file.");
      return;
    }

    state
      .getLayers()
      .filter(
        (layer) =>
          layer.type === "audio" &&
          layer.data?.role === "background-music",
      )
      .forEach((layer) => state.deleteLayer(layer.id));

    addLayer({
      type: "audio",
      name: item.title,
      locked: false,
      visible: true,
      startTime: 0,
      duration: projectDuration,
      data: {
        url: item.url,
        sourceDuration,
        volume: 0.7,
        loop: true,
        role: "background-music",
      },
    });

    setVideoState({
      currentTime: 0,
      isPlaying: false,
    });
    toast.success(`Background music changed to ${item.title}`);
  };

  const processAudioFile = async (file: File) => {
    const isAudio =
      file.type.startsWith("audio/") ||
      /\.(mp3|mpeg|mpga|wav|m4a|aac|ogg|flac)$/i.test(file.name);
    if (!isAudio) {
      toast.error("Choose a valid audio file.");
      return;
    }

    const toastId = toast.loading("Uploading audio...");
    try {
      const { url } = await uploadEditorAsset(
        file,
        "audio",
        getEditorProjectId(),
      );
      addRecentAsset({ url, name: file.name, type: "audio" }, "video");
      await replaceBackgroundMusic({ title: file.name, url });
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Audio upload failed",
        { id: toastId },
      );
    }
  };

  const handleUploadAudio = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await processAudioFile(file);
  };

  const handleAudioDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = Array.from(event.dataTransfer.files).find(
      (candidate) =>
        candidate.type.startsWith("audio/") ||
        /\.(mp3|mpeg|mpga|wav|m4a|aac|ogg|flac)$/i.test(candidate.name),
    );
    if (!file) {
      toast.error("Drop a valid audio file.");
      return;
    }
    void processAudioFile(file);
  };

  const togglePreview = (url: string) => {
    setVideoState({ isPlaying: false });
    if (previewingUrl === url) {
      previewAudioRef.current?.pause();
      setPreviewingUrl(null);
      return;
    }

    previewAudioRef.current?.pause();
    const audio = new Audio(url);
    audio.volume = 0.8;
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

  const changeMusicVolume = (value: number) => {
    if (!backgroundMusic) return;
    updateLayerData(backgroundMusic.id, { volume: value });
  };

  const removeBackgroundMusic = () => {
    if (!backgroundMusic) return;
    deleteLayer(backgroundMusic.id);
    setVideoState({ isPlaying: false, isMuted: false });
    toast.success("Background music removed.");
  };

  const changeOriginalAudio = (value: number) => {
    setVideoState({
      volume: value,
      isMuted: value === 0,
    });
  };

  const uploadedAudio = videoRecentAssets.filter((asset) => asset.type === "audio");

  return (
    <div className="flex h-full flex-col bg-[#161616] text-white">
      <div className="border-b border-white/5 p-5">
        <div className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-3 text-center shadow-lg">
          <h2 className="flex items-center justify-center gap-2 text-sm font-bold">
            <Music className="h-4 w-4" />
            Background Music
          </h2>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5 no-scrollbar">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,audio/mpeg,.mp3,.mpeg,.mpga,.wav,.m4a,.aac,.ogg,.flac"
          onChange={handleUploadAudio}
          className="hidden"
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleAudioDrop}
          className={cn(
            "h-20 w-full flex-col gap-2 border-2 border-dashed text-white",
            isDragging
              ? "border-violet-400 bg-violet-500/20"
              : "border-white/15 bg-white/5 hover:border-violet-400/70 hover:bg-violet-500/10",
          )}
        >
          <Upload className="h-5 w-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Upload and replace music
          </span>
        </Button>

        <section className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Current Music
          </h3>

          {backgroundMusic ? (
            <div className="space-y-4 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">
                    {backgroundMusic.name}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-violet-300">
                    Loops to fit the video
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={removeBackgroundMusic}
                  className="h-8 w-8 shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  title="Remove background music"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-2 text-gray-300">
                    <Volume2 className="h-3.5 w-3.5" />
                    Music volume
                  </span>
                  <span className="font-mono text-gray-400">
                    {Math.round(musicVolume * 100)}%
                  </span>
                </div>
                <Slider
                  value={[musicVolume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(values) => changeMusicVolume(values[0])}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-[10px] text-gray-500">
              No background music added
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Original Video Sound
          </h3>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-2 text-gray-300">
                {videoState.isMuted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Video className="h-3.5 w-3.5" />
                )}
                Source audio
              </span>
              <span className="font-mono text-gray-400">
                {videoState.isMuted
                  ? "Muted"
                  : `${Math.round(videoState.volume * 100)}%`}
              </span>
            </div>
            <Slider
              value={[videoState.isMuted ? 0 : videoState.volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(values) => changeOriginalAudio(values[0])}
            />
          </div>
        </section>

        {uploadedAudio.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Recent Uploads
            </h3>
            <div className="space-y-2">
              {uploadedAudio.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2"
                >
                  <button
                    onClick={() => togglePreview(asset.url)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/30 text-violet-300 hover:bg-violet-600 hover:text-white"
                    title="Preview audio"
                  >
                    {previewingUrl === asset.url ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    )}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/75">
                    {asset.name}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void replaceBackgroundMusic({
                        title: asset.name,
                        url: asset.url,
                      })
                    }
                    className="h-8 w-8 shrink-0 text-gray-400 hover:bg-violet-500/15 hover:text-violet-300"
                    title="Use as background music"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
