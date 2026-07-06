"use client";

import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { resolveVideoPlaybackUrl } from "@/lib/video-playback-url";
import type { VideoSourceHints } from "@/lib/video-loader";

type LibraryVideoThumbnailProps = {
  url: string;
  sourceHints?: VideoSourceHints;
  thumbnailUrl?: string;
  className?: string;
};

export function LibraryVideoThumbnail({
  url,
  sourceHints,
  thumbnailUrl,
  className = "",
}: LibraryVideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [poster, setPoster] = useState<string | null>(thumbnailUrl ?? null);
  const [failed, setFailed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const playbackSrc =
    sourceHints?.localSrc || resolveVideoPlaybackUrl(url);

  useEffect(() => {
    if (thumbnailUrl) {
      setPoster(thumbnailUrl);
      return;
    }

    // Prefer local blob for instant preview — never hit S3 while uploading.
    if (sourceHints?.localSrc) {
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };

    const capture = () => {
      if (cancelled || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      setPoster(canvas.toDataURL("image/jpeg", 0.72));
    };

    const onLoadedData = () => {
      const target = Math.min(
        0.15,
        Math.max(0.01, (video.duration || 1) * 0.05),
      );
      video.addEventListener("seeked", capture, { once: true });
      video.currentTime = target;
    };

    video.addEventListener("error", () => {
      if (!cancelled) setFailed(true);
    });
    video.addEventListener("loadeddata", onLoadedData, { once: true });
    video.src = playbackSrc;
    video.load();

    return cleanup;
  }, [playbackSrc, thumbnailUrl, sourceHints?.localSrc]);

  const handleMouseEnter = () => {
    setHovering(true);
    const element = videoRef.current;
    if (!element) return;
    void element.play().catch(() => undefined);
  };

  const handleMouseLeave = () => {
    setHovering(false);
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0;
  };

  if (failed && !poster) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-[#1a1a1a] ${className}`}
      >
        <Film className="h-8 w-8 text-white/30" />
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            hovering ? "opacity-0" : "opacity-100"
          }`}
        />
      ) : null}
      <video
        ref={videoRef}
        src={playbackSrc}
        muted
        playsInline
        preload="auto"
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          poster && !hovering ? "opacity-0" : "opacity-60 group-hover:opacity-100"
        }`}
        onLoadedData={(event) => {
          const element = event.currentTarget;
          if (element.currentTime === 0) {
            element.currentTime = 0.1;
          }
        }}
      />
    </div>
  );
}
