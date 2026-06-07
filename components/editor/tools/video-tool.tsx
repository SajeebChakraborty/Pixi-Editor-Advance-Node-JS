import React, { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoEditorComplete } from "./video-editor-complete";
import { Upload, Plus, Film, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addMediaFromUrl } from "@/lib/editor-utils";
import { AssetService } from "@/lib/asset-service";

export function VideoTool() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const { canvas, setVideoState, recentAssets, removeRecentAsset } =
    useEditorStore();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void loadVideos();
  }, []);

  useEffect(() => {
    const recentMedia = recentAssets.filter(
      (asset) => asset.type === "video" || asset.type === "image",
    );
    setLibraryVideos((previous) => {
      const persisted = previous.filter((item) => item.persisted);
      const combined = [...recentMedia, ...persisted];
      return combined.filter(
        (item, index) =>
          combined.findIndex((candidate) => candidate.url === item.url) === index,
      );
    });
  }, [recentAssets]);

  useEffect(() => {
    const queryVideoUrl = searchParams.get("video_url");
    if (!queryVideoUrl) return;
    const normalized = queryVideoUrl.trim();
    if (!normalized) return;

    setVideoUrl(normalized);
    setLibraryVideos((prev) => {
      const exists = prev.some((v) => (v.url || "").trim() === normalized);
      if (exists) return prev;
      return [
        {
          id: `query_${Date.now()}`,
          name: "External Video",
          url: normalized,
        },
        ...prev,
      ];
    });
  }, [searchParams]);

  const loadVideos = async () => {
    const videos = await AssetService.getAssets("video");
    setLibraryVideos((previous) => {
      const persisted = videos.map((video) => ({ ...video, persisted: true }));
      const local = previous.filter((item) => !item.persisted);
      const combined = [...local, ...persisted];
      return combined.filter(
        (item, index) =>
          combined.findIndex((candidate) => candidate.url === item.url) === index,
      );
    });
  };

  const handleDeleteLibraryVideo = async (
    event: React.MouseEvent<HTMLButtonElement>,
    video: any,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (deletingVideoId) return;

    setDeletingVideoId(video.id);
    try {
      if (video.persisted) {
        const deleted = await AssetService.deleteAsset(video.id);
        if (!deleted) {
          toast.error("Could not delete video from Stock/Library.");
          return;
        }
      }

      setLibraryVideos((previous) =>
        previous.filter((item) => item.id !== video.id),
      );
      removeRecentAsset(video.url);
      if (selectedVideo === video.url) setSelectedVideo(null);
      if (typeof video.url === "string" && video.url.startsWith("blob:")) {
        URL.revokeObjectURL(video.url);
      }
      toast.success("Video deleted from Stock/Library.");
    } catch {
      toast.error("Could not delete video from Stock/Library.");
    } finally {
      setDeletingVideoId(null);
    }
  };

  const processVideoFile = async (file: File) => {
    const allowedMime = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/ogg",
      "video/x-m4v",
    ];
    const hasAllowedExt = /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
    const mimeAllowed =
      !file.type ||
      file.type.startsWith("video/") ||
      file.type === "application/octet-stream";
    if (
      !hasAllowedExt &&
      (!mimeAllowed || !allowedMime.includes(file.type))
    ) {
      toast.error("Unsupported video format. Please use MP4, WebM, MOV, or OGG.");
      return;
    }
    if (
      file.type.startsWith("video/") &&
      !allowedMime.includes(file.type) &&
      !hasAllowedExt
    ) {
      toast.error("Unsupported video format. Please use MP4, WebM, MOV, or OGG.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing video...");
    // Use blob URL for local videos to avoid massive data URLs and metadata load failures.
    const localUrl = URL.createObjectURL(file);
    toast.success("Video loaded successfully", { id: toastId });
    const localVideo = {
      id: Date.now().toString(),
      name: file.name,
      url: localUrl,
    };
    setLibraryVideos((prev) => [localVideo, ...prev]);
    await handleAddVideoToCanvas(localUrl);
    setLoading(false);
  };

  const processFile = async (file: File) => {
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name);

    if (isImage) {
      setLoading(true);
      const toastId = toast.loading("Adding image overlay...");
      const localUrl = URL.createObjectURL(file);
      const objectId = await addMediaFromUrl(
        localUrl,
        useEditorStore.getState(),
        "image",
        false,
        undefined,
        file.name,
      );
      setLoading(false);

      if (objectId) {
        setLibraryVideos((previous) => [
          {
            id: `image_${Date.now()}`,
            name: file.name,
            url: localUrl,
            type: "image",
          },
          ...previous,
        ]);
        useEditorStore.getState().addRecentAsset({
          type: "image",
          url: localUrl,
          name: file.name,
        });
        toast.success("Image overlay added to video.", { id: toastId });
      } else {
        URL.revokeObjectURL(localUrl);
        toast.error("Could not add image overlay.", { id: toastId });
      }
      return;
    }

    await processVideoFile(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await processFile(file);
    }
    // Reset input value so the same files can be uploaded again.
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) {
      await processFile(file);
    }
  };

  const handleAddFromUrl = async () => {
    const url = videoUrl.trim();
    if (!url) return;
    const lower = url.toLowerCase();
    const isHttp = lower.startsWith("http://") || lower.startsWith("https://");
    if (!isHttp) {
      toast.error("Please provide a valid external URL (http/https).");
      return;
    }

    // Block known web-page links that are not raw video files.
    const isKnownPageUrl =
      lower.includes("youtube.com/watch") ||
      lower.includes("youtu.be/") ||
      lower.includes("vimeo.com/") ||
      lower.includes("facebook.com/");
    if (isKnownPageUrl) {
      toast.error("Page links are not supported. Please use a direct video file URL.");
      return;
    }

    const normalized = url.trim();
    const exists = libraryVideos.some((v) => (v.url || "").trim() === normalized);
    const libraryItem = exists
      ? null
      : {
          id: `ext_${Date.now()}`,
          name: "External Video",
          url: normalized,
        };

    if (libraryItem) {
      setLibraryVideos((prev) => [libraryItem, ...prev]);
    }

    // Auto add to canvas after storing in Stock/Library.
    await handleAddVideoToCanvas(normalized);
    setVideoUrl("");
  };

  const handleAddVideoToCanvas = async (url?: string) => {
    const targetUrl = url || selectedVideo;
    if (!targetUrl) return false;
    const store = useEditorStore.getState();
    const objectId = await addMediaFromUrl(
      targetUrl,
      store,
      "video",
      false,
      undefined,
      libraryVideos.find((video) => video.url === targetUrl)?.name,
    );
    if (!url) setSelectedVideo(null); // Only clear selection if added from editor, keep library open
    return Boolean(objectId);
  };

  if (selectedVideo) {
    return (
      <div className="flex flex-col h-full bg-[#161616] space-y-4 px-5 py-6">
        <Button
          onClick={() => setSelectedVideo(null)}
          className="w-full bg-[#222] hover:bg-[#333] text-white border-transparent"
        >
          ← Back
        </Button>
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/50">
          <VideoEditorComplete videoUrl={selectedVideo} />
        </div>
        <Button
          onClick={() => handleAddVideoToCanvas()}
          className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-bold h-10"
        >
          Add to Canvas
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#161616] px-5 py-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="space-y-4">
        <Button className="w-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-bold h-10 shadow-lg shadow-purple-500/20 pointer-events-none">
          Video Library
        </Button>

        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Upload Media
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-24 border-2 border-dashed transition-all flex flex-col gap-2 ${
              isDragging
                ? "border-[#8b5cf6] bg-[#8b5cf6]/10 text-white"
                : "border-white/10 bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white hover:border-[#8b5cf6]/50"
            }`}
            variant="ghost"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center pointer-events-none">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold pointer-events-none">
              {loading
                ? "Uploading..."
                : isDragging
                  ? "Drop Video or Image Here"
                  : "Click or Drag Video / Image Here"}
            </span>
          </Button>
        </div>

        {/* Library Section */}
        {libraryVideos.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Stock / Library
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {libraryVideos.map((video) => (
                <div
                  key={video.id}
                  className="group relative aspect-video rounded-lg overflow-hidden bg-black/50 cursor-pointer ring-1 ring-white/5 hover:ring-[#8b5cf6] transition-all"
                  onClick={() => {
                    if (video.type === "image") {
                      void addMediaFromUrl(
                        video.url,
                        useEditorStore.getState(),
                        "image",
                        false,
                        undefined,
                        video.name,
                      );
                      return;
                    }
                    void handleAddVideoToCanvas(video.url);
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Delete ${video.name || "video"}`}
                    title="Delete from Stock/Library"
                    disabled={deletingVideoId === video.id}
                    onClick={(event) => {
                      void handleDeleteLibraryVideo(event, video);
                    }}
                    className="absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {video.type === "image" ? (
                    <img
                      src={video.url}
                      alt={video.name}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                      muted
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] font-bold text-white truncate">
                      {video.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
          <span className="px-2 bg-[#161616] text-gray-600">Or use URL</span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
          External Link
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/video.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddFromUrl()}
            className="h-10 bg-[#222] border-transparent text-white text-xs rounded-xl focus:border-[#8b5cf6]"
          />
          <Button
            onClick={() => {
              void handleAddFromUrl();
            }}
            size="icon"
            className="h-10 w-10 bg-[#333] hover:bg-[#444] text-white rounded-xl"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-[#222] p-4 space-y-2 border border-white/5">
        <div className="flex items-center gap-2 text-white text-xs font-bold">
          <Film className="w-3 h-3 text-[#8b5cf6]" />
          <span>Supported Formats</span>
        </div>
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>• MP4, WebM (max 50MB)</p>
          <p>• Drag & drop supported</p>
          <p>• Auto-optimizes for web playback</p>
        </div>
      </div>
    </div>
  );
}
