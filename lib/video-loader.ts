import { resolveVideoPlaybackUrl } from "./video-playback-url";

const METADATA_TIMEOUT_MS = 90_000;
const DIMENSION_TIMEOUT_MS = 12_000;

const MEDIA_ERROR_MESSAGES: Record<number, string> = {
  1: "Video loading aborted",
  2: "Network error while fetching video",
  3: "Video decode error (unsupported codec/file)",
  4: "Video source not supported",
};

export const getVideoPlaybackCandidates = (url: string) => {
  const trimmed = String(url || "").trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return [trimmed];
  }

  if (trimmed.startsWith("/api/assets/file")) {
    return [trimmed];
  }

  if (trimmed.startsWith("/")) {
    return [trimmed];
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const proxied = resolveVideoPlaybackUrl(trimmed);
    return proxied === trimmed ? [trimmed] : [proxied, trimmed];
  }

  return [trimmed];
};

export const verifyEditorAssetAvailable = async (
  assetUrl: string,
  options?: {
    maxAttempts?: number;
    fileSize?: number;
  },
) => {
  if (!assetUrl.startsWith("/api/assets/file")) return;

  const fileSize = Math.max(0, Number(options?.fileSize || 0));
  const maxAttempts =
    options?.maxAttempts ??
    (fileSize > 80 * 1024 * 1024
      ? 18
      : fileSize > 20 * 1024 * 1024
        ? 14
        : 10);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(assetUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (response.ok) return;
    } catch {
      // Retry while storage catches up.
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(5000, 350 + attempt * 450)),
    );
  }

  throw new Error(
    "Uploaded video is not available from storage yet. Please try again in a few seconds.",
  );
};

const applyVideoSource = (video: HTMLVideoElement, sourceUrl: string) => {
  if (/^https?:\/\//i.test(sourceUrl)) {
    video.crossOrigin = "anonymous";
  } else {
    video.removeAttribute("crossorigin");
  }
  video.preload = "metadata";
  video.src = sourceUrl;
  video.load();
};

export const loadVideoElementMetadata = (
  video: HTMLVideoElement,
  sourceUrl: string,
  timeoutMs = METADATA_TIMEOUT_MS,
) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };

    const handleReady = () => {
      const hasDuration =
        Number.isFinite(video.duration) && video.duration > 0;
      const hasDimensions =
        (video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0;
      if (!hasDuration && !hasDimensions) {
        return;
      }
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      const mediaError = video.error;
      const errorCode = mediaError?.code;
      reject(
        new Error(
          MEDIA_ERROR_MESSAGES[errorCode || 0] ||
            `Failed to load video source: ${sourceUrl}`,
        ),
      );
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "The video server did not return readable metadata in time. Try a smaller MP4 file or check your connection.",
        ),
      );
    }, timeoutMs);

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);

    applyVideoSource(video, sourceUrl);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      const hasDuration =
        Number.isFinite(video.duration) && video.duration > 0;
      const hasDimensions =
        (video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0;
      if (hasDuration || hasDimensions) {
        handleReady();
      }
    }
  });

export const loadVideoFromCandidates = async (
  video: HTMLVideoElement,
  url: string,
) => {
  const candidates = getVideoPlaybackCandidates(url);
  if (candidates.length === 0) {
    throw new Error("Invalid video URL");
  }

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      await loadVideoElementMetadata(video, candidate);
      return candidate;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Failed to load video source");
      video.removeAttribute("src");
      video.load();
    }
  }

  throw lastError || new Error("Failed to load video source");
};

export const waitForVideoElementDimensions = (
  video: HTMLVideoElement,
  timeoutMs = DIMENSION_TIMEOUT_MS,
) =>
  new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      if (width > 0 && height > 0) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Video dimensions unavailable"));
        return;
      }
      requestAnimationFrame(check);
    };

    check();
  });

export const warmUpVideoElementFrame = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    const finalize = () => {
      video.pause();
      resolve();
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        video.currentTime = Math.min(
          0.05,
          Math.max(0, (video.duration || 0) - 0.01),
        );
      } catch {
        // Ignore seek failures for edge codecs.
      }
      requestAnimationFrame(() => finalize());
      return;
    }

    const timeoutId = window.setTimeout(finalize, 2500);
    video.addEventListener(
      "loadeddata",
      () => {
        window.clearTimeout(timeoutId);
        try {
          video.currentTime = Math.min(
            0.05,
            Math.max(0, (video.duration || 0) - 0.01),
          );
        } catch {
          // Ignore and continue.
        }
        requestAnimationFrame(() => finalize());
      },
      { once: true },
    );
  });
