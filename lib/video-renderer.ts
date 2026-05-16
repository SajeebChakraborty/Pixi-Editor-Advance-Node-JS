import { useEditorStore } from "./store";

export type VideoExportFormat = "mp4" | "webm";

const webmCandidates = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** Chrome/Edge sometimes expose MP4 (H.264/AAC) for MediaRecorder; most browsers still need WebM + server transcode. */
const mp4RecorderCandidates = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.4D001E,mp4a.40.2",
  "video/mp4;codecs=avc1.42001E,mp4a.40.2",
  "video/mp4;codecs=hvc1.1.6.L93.B0,mp4a.40.2",
  "video/mp4",
];

const pickRecorderMime = (format: VideoExportFormat) => {
  const tryList =
    format === "mp4"
      ? [...mp4RecorderCandidates, ...webmCandidates]
      : webmCandidates;

  if (typeof MediaRecorder === "undefined") return null;

  for (const mime of tryList) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return null;
};

export const exportVideo = async (preferredFormat: VideoExportFormat = "webm") => {
  const store = useEditorStore.getState();
  const fabricCanvas = store.canvas.fabricCanvas;

  if (!fabricCanvas) {
    throw new Error("Canvas not initialized");
  }

  const layers = store.getLayers();
  const videoLayers = layers.filter((l) => l.type === "video");
  const layersEnd = videoLayers.reduce(
    (max, l) => Math.max(max, Number(l.startTime || 0) + Number(l.duration || 0)),
    0,
  );
  const rawDuration = Number(layersEnd || store.videoState.duration || 0);
  const startTime = Number(store.videoState.startTime || 0);
  const endTime = Number(store.videoState.endTime || 0);
  const rangeDuration = endTime > startTime ? endTime - startTime : 0;
  // Use trimmed range when present; fallback to media duration; guard against huge accidental values.
  const safeDuration = Math.min(
    300, // hard cap 5 minutes to avoid hanging exports
    Math.max(1, rangeDuration || rawDuration || 5),
  );

  if (safeDuration <= 0 || !Number.isFinite(safeDuration)) {
    throw new Error("Invalid export duration. Add a video layer before exporting.");
  }
  // Canvas should be ready

  // Ensure canvas has contents rendered
  fabricCanvas.requestRenderAll();

  const canvasEl = fabricCanvas.getElement(); // fallback
  const renderCanvas = ((fabricCanvas as any).lowerCanvasEl ||
    (fabricCanvas as any).contextContainer?.canvas ||
    canvasEl) as HTMLCanvasElement;
  // In FabricJS, the 'getElement()' returns the wrapper usually, or we access lowerCanvasEl
  // fabricCanvas.getElement() returns the upper canvas usually for interaction? 
  // No, fabricCanvas.getElement() is the wrapper div in older versions? 
  // In v5/6: fabricCanvas.getElement() is HTMLCanvasElement (upper) 
  // We want the rendering canvas. 
  // Usually capturing stream from the main canvas element works.

  const stream = renderCanvas.captureStream(60); // 60 FPS
  
  // TODO: Audio mixing (we need to mix audio elements playing)
  // For now: Silent video export or basic
  
  let mimeType = pickRecorderMime(preferredFormat);
  if (!mimeType) {
    mimeType = pickRecorderMime("webm") || "";
  }
  const options = mimeType ? { mimeType } : undefined;
  const mediaRecorder = new MediaRecorder(stream, options);
  
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<{ blob: Blob; mimeType: string; extension: "mp4" | "webm" }>((resolve) => {
      mediaRecorder.onstop = () => {
          const resolvedMime = mimeType || mediaRecorder.mimeType || "video/webm";
          const extension = resolvedMime.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunks, { type: resolvedMime });
          resolve({ blob, mimeType: resolvedMime, extension });
      };

      // Start recording and ask for chunks periodically for reliability.
      mediaRecorder.start(250);

      // Start playback from selected trim start
      store.setVideoState({ currentTime: startTime, isPlaying: true });

      // Stop after duration
      setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            try {
              mediaRecorder.requestData();
            } catch {
              // Ignore unsupported requestData timing issues.
            }
          }
          mediaRecorder.stop();
          store.setVideoState({ isPlaying: false, currentTime: startTime }); // Reset
      }, safeDuration * 1000 + 250); // Small buffer
  });
};
