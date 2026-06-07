import type { Canvas, FabricObject } from "fabric";

type ImageExportFormat = "png" | "jpeg";

type VideoFabricObject = FabricObject & {
  _videoEl?: HTMLVideoElement;
  _videoOverlayVisible?: boolean;
  _videoOpacity?: number;
};

type ExportBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not prepare the canvas layer for export."));
    image.src = src;
  });
}

function multiplyTransforms(
  viewport: number[],
  object: number[],
): [number, number, number, number, number, number] {
  return [
    viewport[0] * object[0] + viewport[2] * object[1],
    viewport[1] * object[0] + viewport[3] * object[1],
    viewport[0] * object[2] + viewport[2] * object[3],
    viewport[1] * object[2] + viewport[3] * object[3],
    viewport[0] * object[4] + viewport[2] * object[5] + viewport[4],
    viewport[1] * object[4] + viewport[3] * object[5] + viewport[5],
  ];
}

export async function exportArtboardDataUrl(
  canvas: Canvas,
  format: ImageExportFormat,
  multiplier = 1,
  quality = 0.92,
) {
  const bounds = (canvas as Canvas & { artboardExportBounds?: ExportBounds })
    .artboardExportBounds;
  const crop = bounds || {
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };

  // Fabric owns shapes and text, while videos are DOM overlays behind it.
  // Export Fabric as transparent PNG so the current video frames can be
  // composited in the same order as the editor preview.
  const fabricLayerUrl = canvas.toDataURL({
    format: "png",
    multiplier,
    ...crop,
  });
  const fabricLayer = await loadImage(fabricLayerUrl);
  const output = document.createElement("canvas");
  output.width = fabricLayer.naturalWidth;
  output.height = fabricLayer.naturalHeight;

  const context = output.getContext("2d");
  if (!context) {
    throw new Error("Could not create the image export canvas.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);

  const viewport = (canvas.viewportTransform || [1, 0, 0, 1, 0, 0]) as number[];
  for (const object of canvas.getObjects() as VideoFabricObject[]) {
    const video = object._videoEl;
    if (
      !video ||
      object.visible === false ||
      object._videoOverlayVisible === false
    ) {
      continue;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error("The current video frame is not ready yet. Try exporting again.");
    }

    const [a, b, c, d, e, f] = multiplyTransforms(
      viewport,
      object.calcTransformMatrix() as number[],
    );
    const width = Math.max(1, Number(object.width || video.videoWidth || 1));
    const height = Math.max(1, Number(object.height || video.videoHeight || 1));

    context.save();
    context.globalAlpha = Math.min(
      1,
      Math.max(0, Number(object._videoOpacity ?? 1)),
    );
    context.setTransform(
      a * multiplier,
      b * multiplier,
      c * multiplier,
      d * multiplier,
      (e - crop.left) * multiplier,
      (f - crop.top) * multiplier,
    );
    context.drawImage(video, -width / 2, -height / 2, width, height);
    context.restore();
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.drawImage(fabricLayer, 0, 0);

  try {
    return output.toDataURL(
      format === "png" ? "image/png" : "image/jpeg",
      quality,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new Error(
        "The video server blocked image export. Use an uploaded video or a CORS-enabled source.",
      );
    }
    throw error;
  }
}
