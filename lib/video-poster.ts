/** Capture a JPEG poster from an already-loaded video element. */
export const captureVideoPosterFromElement = (
  video: HTMLVideoElement,
): string | null => {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.72);
};

/** Capture a JPEG poster frame from a video URL (blob or same-origin). */
export const captureVideoPoster = (
  sourceUrl: string,
  timeoutMs = 15_000,
): Promise<string | null> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;
    const finish = (poster: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.removeAttribute("src");
      video.load();
      resolve(poster);
    };

    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);

    const capture = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        finish(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(null);
        return;
      }

      ctx.drawImage(video, 0, 0);
      finish(canvas.toDataURL("image/jpeg", 0.72));
    };

    video.addEventListener(
      "error",
      () => finish(null),
      { once: true },
    );
    video.addEventListener(
      "loadeddata",
      () => {
        const target = Math.min(
          0.15,
          Math.max(0.01, (video.duration || 1) * 0.05),
        );
        video.addEventListener("seeked", capture, { once: true });
        video.currentTime = target;
      },
      { once: true },
    );

    video.src = sourceUrl;
    video.load();
  });
