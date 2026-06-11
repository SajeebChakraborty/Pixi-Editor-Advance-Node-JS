import {
  buildVideoComposition,
  resolveCompositionFrame,
} from "./video-composition";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "./video-playback-url";
import { useEditorStore } from "./store";

export type VideoExportFormat = "mp4" | "webm";

const webmCandidates = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const mp4RecorderCandidates = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.4D001E,mp4a.40.2",
  "video/mp4;codecs=avc1.42001E,mp4a.40.2",
  "video/mp4",
];

const pickRecorderMime = (format: VideoExportFormat) => {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates =
    format === "mp4"
      ? [...mp4RecorderCandidates, ...webmCandidates]
      : webmCandidates;
  return (
    candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || null
  );
};

const waitForMetadata = (video: HTMLVideoElement) =>
  new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    const timeoutId = window.setTimeout(
      () => reject(new Error("Timed out while loading an export source")),
      20000,
    );
    const finish = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("error", fail);
      reject(new Error("Could not decode a video used by this composition"));
    };
    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("error", fail, { once: true });
  });

const drawContainedVideo = (
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) => {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    video,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
};

export const exportVideo = async (
  preferredFormat: VideoExportFormat = "webm",
) => {
  const store = useEditorStore.getState();
  const fabricCanvas =
    store.videoFabricCanvas || store.canvas.fabricCanvas;
  if (!fabricCanvas) throw new Error("Canvas not initialized");

  const layers = store.getLayers();
  const composition = buildVideoComposition(layers);
  if (composition.scenes.length === 0 || composition.duration <= 0) {
    throw new Error("Add at least one video scene before exporting.");
  }

  const rangeStart = Math.min(
    Math.max(0, Number(store.videoState.startTime || 0)),
    composition.duration,
  );
  const requestedEnd = Number(store.videoState.endTime || 0);
  const rangeEnd = Math.min(
    composition.duration,
    requestedEnd > rangeStart ? requestedEnd : composition.duration,
  );
  const playbackRate = Math.max(
    0.1,
    Number(store.videoState.playbackRate || 1),
  );
  const exportDuration = (rangeEnd - rangeStart) / playbackRate;
  if (exportDuration <= 0) throw new Error("Invalid export range.");

  const width = Math.max(1, Math.round(store.canvas.width));
  const height = Math.max(1, Math.round(store.canvas.height));
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = width;
  renderCanvas.height = height;
  const context = renderCanvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not create export canvas.");

  const sourceVideos = new Map<string, HTMLVideoElement>();
  await Promise.all(
    composition.scenes.map(async (scene) => {
      const sourceUrl = scene.layer.data?.url;
      if (!sourceUrl || sourceVideos.has(sourceUrl)) return;
      const video = document.createElement("video");
      const resolvedSource = resolveVideoPlaybackUrl(sourceUrl);
      if (videoNeedsCrossOrigin(resolvedSource)) {
        video.crossOrigin = "anonymous";
      }
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = resolvedSource;
      video.load();
      sourceVideos.set(sourceUrl, video);
      await waitForMetadata(video);
    }),
  );

  const mimeType =
    pickRecorderMime(preferredFormat) || pickRecorderMime("webm") || "";
  const stream = renderCanvas.captureStream(60);
  const mediaRecorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const previousVideoState = { ...store.videoState };
  const lowerCanvas = (fabricCanvas as any).lowerCanvasEl as
    | HTMLCanvasElement
    | undefined;
  let animationFrameId = 0;
  let stopped = false;

  const result = new Promise<{
    blob: Blob;
    mimeType: string;
    extension: "mp4" | "webm";
  }>((resolve, reject) => {
    mediaRecorder.onerror = () =>
      reject(new Error("Browser video recording failed."));
    mediaRecorder.onstop = () => {
      const resolvedMime =
        mimeType || mediaRecorder.mimeType || "video/webm";
      const extension = resolvedMime.includes("mp4") ? "mp4" : "webm";
      resolve({
        blob: new Blob(chunks, { type: resolvedMime }),
        mimeType: resolvedMime,
        extension,
      });
    };
  });

  const startedAt = performance.now();
  const renderFrame = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const compositionTime = Math.min(
      rangeEnd,
      rangeStart + elapsed * playbackRate,
    );
    const frames = resolveCompositionFrame(composition, compositionTime);
    const activeUrls = new Set(
      frames
        .map((frame) => frame.scene.layer.data?.url)
        .filter((url): url is string => Boolean(url)),
    );

    sourceVideos.forEach((video, url) => {
      if (!activeUrls.has(url) && !video.paused) video.pause();
    });

    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    frames.forEach((frame) => {
      const sourceUrl = frame.scene.layer.data?.url;
      const video = sourceUrl ? sourceVideos.get(sourceUrl) : undefined;
      if (!video || video.readyState < 2) return;
      video.playbackRate = playbackRate;
      if (Math.abs(video.currentTime - frame.sourceTime) > 0.12) {
        try {
          video.currentTime = frame.sourceTime;
        } catch {
          return;
        }
      }
      if (video.paused) void video.play().catch(() => {});
      context.save();
      context.globalAlpha = frame.opacity;
      drawContainedVideo(context, video, width, height);
      context.restore();
    });

    layers.forEach((layer) => {
      if (layer.type === "video" || !layer.objectId) return;
      const object = fabricCanvas
        .getObjects()
        .find((candidate: any) => candidate.name === layer.objectId);
      if (!object) return;
      const start = Number(layer.startTime || 0);
      const end = start + Number(layer.duration || 0);
      object.visible =
        layer.visible !== false &&
        compositionTime >= start &&
        compositionTime < end;
    });
    fabricCanvas.requestRenderAll();
    if (lowerCanvas) context.drawImage(lowerCanvas, 0, 0, width, height);

    store.setVideoState({ currentTime: compositionTime, isPlaying: false });
    if (elapsed >= exportDuration) {
      stopped = true;
      try {
        mediaRecorder.requestData();
      } catch {
        // Some implementations do not allow an immediate final request.
      }
      mediaRecorder.stop();
      return;
    }
    animationFrameId = requestAnimationFrame(renderFrame);
  };

  mediaRecorder.start(250);
  animationFrameId = requestAnimationFrame(renderFrame);

  try {
    return await result;
  } finally {
    if (!stopped) cancelAnimationFrame(animationFrameId);
    sourceVideos.forEach((video) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
    store.setVideoState(previousVideoState);
    layers.forEach((layer) => {
      if (!layer.objectId) return;
      const object = fabricCanvas
        .getObjects()
        .find((candidate: any) => candidate.name === layer.objectId);
      if (object) object.visible = layer.visible !== false;
    });
    fabricCanvas.requestRenderAll();
  }
};
