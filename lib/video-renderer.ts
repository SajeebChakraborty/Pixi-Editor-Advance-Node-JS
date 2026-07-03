import {
  buildVideoComposition,
  resolveCompositionFrame,
  type ResolvedSceneFrame,
} from "./video-composition";
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from "./video-playback-url";
import { useEditorStore } from "./store";
import {
  getLinkedAudioTargetTime,
  getLinkedVideoAudio,
  isLinkedAudioActive,
} from "./linked-video-audio";
import { buildVideoFilterCss, isEffectActiveAtTime } from "./video-filters";
import {
  beginOverlayExportPass,
  drawOverlayExportPass,
  endOverlayExportPass,
} from "./video-export-overlays";

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

const waitForAudioMetadata = (audio: HTMLAudioElement) =>
  new Promise<void>((resolve, reject) => {
    if (audio.readyState >= 1) {
      resolve();
      return;
    }
    const timeoutId = window.setTimeout(
      () => reject(new Error("Timed out while loading an export audio source")),
      20000,
    );
    const finish = () => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", finish);
      audio.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", finish);
      audio.removeEventListener("error", fail);
      reject(new Error("Could not decode audio used by this composition"));
    };
    audio.addEventListener("loadedmetadata", finish, { once: true });
    audio.addEventListener("error", fail, { once: true });
  });

const drawContainedVideo = (
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  frame?: Pick<
    ResolvedSceneFrame,
    | "translateXPercent"
    | "translateYPercent"
    | "scale"
    | "clipInset"
    | "opacity"
  >,
  filterCss?: string,
) => {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  context.save();
  if (filterCss) {
    context.filter = filterCss;
  }
  context.globalAlpha *= frame?.opacity ?? 1;

  if (frame) {
    const { top, right, bottom, left } = frame.clipInset;
    if (top || right || bottom || left) {
      context.beginPath();
      context.rect(
        drawX + (left / 100) * drawWidth,
        drawY + (top / 100) * drawHeight,
        drawWidth * (1 - (left + right) / 100),
        drawHeight * (1 - (top + bottom) / 100),
      );
      context.clip();
    }

    context.translate(width / 2, height / 2);
    context.translate(
      (frame.translateXPercent / 100) * width,
      (frame.translateYPercent / 100) * height,
    );
    context.scale(frame.scale, frame.scale);
    context.translate(-width / 2, -height / 2);
  }

  context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
  context.restore();
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
      video.muted = false;
      video.playsInline = true;
      video.src = resolvedSource;
      video.load();
      sourceVideos.set(sourceUrl, video);
      await waitForMetadata(video);
    }),
  );

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser cannot mix audio during video export.");
  }

  const audioContext = new AudioContextClass();
  await audioContext.resume();
  const audioDestination = audioContext.createMediaStreamDestination();
  const sourceVideoGains = new Map<string, GainNode>();

  sourceVideos.forEach((video, sourceUrl) => {
    const source = audioContext.createMediaElementSource(video);
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(audioDestination);
    sourceVideoGains.set(sourceUrl, gain);
  });

  const audioLayers = layers.filter(
    (layer) =>
      layer.type === "audio" &&
      layer.visible !== false &&
      Boolean(layer.data?.url),
  );
  const timelineAudio = new Map<
    string,
    { element: HTMLAudioElement; gain: GainNode }
  >();
  await Promise.all(
    audioLayers.map(async (layer) => {
      const sourceUrl = String(layer.data?.url);
      const resolvedSource = resolveVideoPlaybackUrl(sourceUrl);
      const audio = new Audio();
      if (videoNeedsCrossOrigin(resolvedSource)) {
        audio.crossOrigin = "anonymous";
      }
      audio.preload = "auto";
      audio.src = resolvedSource;
      audio.load();
      await waitForAudioMetadata(audio);

      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(audioDestination);
      timelineAudio.set(layer.id, { element: audio, gain });
    }),
  );

  const linkedAudio = new Map<
    string,
    {
      element: HTMLAudioElement;
      gain: GainNode;
      config: NonNullable<ReturnType<typeof getLinkedVideoAudio>>;
    }
  >();
  await Promise.all(
    composition.scenes.map(async (scene) => {
      const config = getLinkedVideoAudio(scene.layer);
      if (!config) return;

      const resolvedSource = resolveVideoPlaybackUrl(config.url);
      const audio = new Audio();
      if (videoNeedsCrossOrigin(resolvedSource)) {
        audio.crossOrigin = "anonymous";
      }
      audio.preload = "auto";
      audio.src = resolvedSource;
      audio.load();
      await waitForAudioMetadata(audio);

      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(audioDestination);
      linkedAudio.set(scene.layer.id, { element: audio, gain, config });
    }),
  );

  const mimeType =
    pickRecorderMime(preferredFormat) || pickRecorderMime("webm") || "";
  const stream = renderCanvas.captureStream(60);
  audioDestination.stream
    .getAudioTracks()
    .forEach((track) => stream.addTrack(track));
  const mediaRecorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const previousVideoState = { ...store.videoState };
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
      if (!activeUrls.has(url)) {
        sourceVideoGains.get(url)?.gain.setValueAtTime(
          0,
          audioContext.currentTime,
        );
        if (!video.paused) video.pause();
      }
    });

    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    const filterCss = isEffectActiveAtTime(
      compositionTime,
      store.videoState.effectStartTime ?? 0,
      store.videoState.effectEndTime ?? 0,
      composition.duration,
    )
      ? buildVideoFilterCss(store.videoState.filters)
      : buildVideoFilterCss();
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
      const customAudio = getLinkedVideoAudio(frame.scene.layer);
      sourceVideoGains.get(sourceUrl)?.gain.setValueAtTime(
        store.videoState.isMuted ||
          Boolean(customAudio && !customAudio.allowNativeAudio)
          ? 0
          : Math.min(1, Math.max(0, store.videoState.volume)) * frame.opacity,
        audioContext.currentTime,
      );
      drawContainedVideo(context, video, width, height, frame, filterCss);
    });

    const activeFrameByLayerId = new Map(
      frames.map((frame) => [frame.scene.layer.id, frame]),
    );
    linkedAudio.forEach(({ element: audio, gain, config }, layerId) => {
      const frame = activeFrameByLayerId.get(layerId);
      const scene = frame?.scene;
      const sceneElapsed = scene
        ? Math.max(0, compositionTime - scene.timelineStart)
        : 0;
      const isActive =
        Boolean(frame) && isLinkedAudioActive(config, sceneElapsed);

      if (!isActive) {
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        if (!audio.paused) audio.pause();
        return;
      }

      const targetTime = getLinkedAudioTargetTime(config, sceneElapsed);
      audio.loop = config.loop;
      audio.playbackRate = playbackRate;
      gain.gain.setValueAtTime(
        config.volume * (frame?.opacity ?? 1),
        audioContext.currentTime,
      );
      if (Math.abs(audio.currentTime - targetTime) > 0.12) {
        try {
          audio.currentTime = targetTime;
        } catch {
          return;
        }
      }
      if (audio.paused) void audio.play().catch(() => {});
    });

    audioLayers.forEach((layer) => {
      const timelineEntry = timelineAudio.get(layer.id);
      if (!timelineEntry) return;

      const { element: audio, gain } = timelineEntry;
      const layerStart = Number(layer.startTime || 0);
      const layerDuration = Number(layer.duration || 0);
      const mediaStart = Number(layer.mediaStart || 0);
      const sourceDuration = Number(layer.data?.sourceDuration || audio.duration || 0);
      const shouldLoop = Boolean(layer.data?.loop && sourceDuration > 0);
      const isActive =
        compositionTime >= layerStart &&
        compositionTime < layerStart + layerDuration;

      if (!isActive) {
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        if (!audio.paused) audio.pause();
        return;
      }

      const rawTargetTime = Math.max(
        0,
        mediaStart + compositionTime - layerStart,
      );
      const targetTime = shouldLoop
        ? rawTargetTime % sourceDuration
        : rawTargetTime;
      audio.loop = shouldLoop;
      audio.playbackRate = playbackRate;
      gain.gain.setValueAtTime(
        Math.min(1, Math.max(0, Number(layer.data?.volume ?? 1))),
        audioContext.currentTime,
      );
      if (Math.abs(audio.currentTime - targetTime) > 0.12) {
        try {
          audio.currentTime = targetTime;
        } catch {
          return;
        }
      }
      if (audio.paused) void audio.play().catch(() => {});
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

    const overlayState = beginOverlayExportPass(fabricCanvas);
    try {
      drawOverlayExportPass(context, fabricCanvas, width, height);
    } finally {
      endOverlayExportPass(fabricCanvas, overlayState);
    }

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
    timelineAudio.forEach(({ element: audio }) => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    });
    linkedAudio.forEach(({ element: audio }) => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    });
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
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
