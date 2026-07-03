import type { Canvas, FabricObject, IText } from "fabric";
import type { Layer } from "./store";
import { isMediaOverlayObject } from "./media-overlay";

const imageCache = new Map<string, HTMLImageElement>();

const isTextObject = (object: FabricObject) => {
  const type = String(object.type || "").toLowerCase();
  return type === "i-text" || type === "textbox" || type === "text";
};

const isImageObject = (object: FabricObject) =>
  String(object.type || "").toLowerCase() === "image";

function resolveImageUrl(url: string) {
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/")) {
    return url;
  }
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached?.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const src = resolveImageUrl(url);
    const image = new Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:") && !src.startsWith("/")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => {
      imageCache.set(url, image);
      resolve(image);
    };
    image.onerror = () =>
      reject(new Error(`Could not load overlay image for export: ${url}`));
    image.src = src;
  });
}

function getImageElement(
  object: FabricObject & { _element?: HTMLImageElement },
  layer?: Layer,
) {
  const element = object._element;
  if (element?.complete && element.naturalWidth > 0) {
    return element;
  }

  const url = String(layer?.data?.url || element?.src || "");
  if (!url) return null;
  return imageCache.get(url) || null;
}

function applyObjectTransform(
  context: CanvasRenderingContext2D,
  object: FabricObject,
) {
  const matrix = object.calcTransformMatrix();
  context.transform(
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5],
  );
}

function getOriginOffset(
  object: FabricObject,
  width: number,
  height: number,
) {
  const originX = String(object.originX || "left");
  const originY = String(object.originY || "top");

  const offsetX =
    originX === "center"
      ? -width / 2
      : originX === "right"
        ? -width
        : 0;
  const offsetY =
    originY === "center"
      ? -height / 2
      : originY === "bottom"
        ? -height
        : 0;

  return { offsetX, offsetY };
}

function drawTextOverlay(context: CanvasRenderingContext2D, object: IText) {
  const text = String(object.text || "").trim();
  if (!text) return;

  const fontSize = Math.max(1, Number(object.fontSize || 40));
  const fontFamily = String(object.fontFamily || "Roboto");
  const fontWeight = String(object.fontWeight || "normal");

  context.save();
  applyObjectTransform(context, object);
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.fillStyle = String(object.fill || "#ffffff");
  context.textAlign = (object.textAlign as CanvasTextAlign) || "center";
  context.textBaseline = "middle";
  context.fillText(text.replace(/\n/g, " "), 0, 0);
  context.restore();
}

function drawImageOverlay(
  context: CanvasRenderingContext2D,
  object: FabricObject,
  layer?: Layer,
) {
  const image = getImageElement(
    object as FabricObject & { _element?: HTMLImageElement },
    layer,
  );
  if (!image) return;

  const width = Math.max(1, Number(object.width || image.naturalWidth || 1));
  const height = Math.max(1, Number(object.height || image.naturalHeight || 1));
  const { offsetX, offsetY } = getOriginOffset(object, width, height);

  context.save();
  applyObjectTransform(context, object);
  context.drawImage(image, offsetX, offsetY, width, height);
  context.restore();
}

export async function preloadOverlayImages(
  layers: Layer[],
  fabricCanvas: Canvas,
) {
  const urls = new Set<string>();

  layers.forEach((layer) => {
    if (!["image", "sticker"].includes(layer.type)) return;
    const url = String(layer.data?.url || "");
    if (url) urls.add(url);
  });

  fabricCanvas.getObjects().forEach((object: any) => {
    if (!isMediaOverlayObject(object) || isTextObject(object)) return;
    const url = String(object._element?.src || "");
    if (url) urls.add(url);
  });

  await Promise.all([...urls].map((url) => loadImage(url)));
}

export function drawCompositionOverlays(
  context: CanvasRenderingContext2D,
  fabricCanvas: Canvas,
  layers: Layer[],
  compositionTime: number,
) {
  const overlayLayers = layers
    .filter(
      (layer) =>
        ["text", "image", "sticker"].includes(layer.type) && layer.objectId,
    )
    .sort((left, right) => (left.track ?? 0) - (right.track ?? 0));

  overlayLayers.forEach((layer) => {
    const start = Number(layer.startTime || 0);
    const end = start + Number(layer.duration || 0);
    if (
      layer.visible === false ||
      compositionTime < start ||
      compositionTime >= end
    ) {
      return;
    }

    const object = fabricCanvas
      .getObjects()
      .find((candidate: any) => candidate.name === layer.objectId);
    if (!object || object.visible === false || (object as any)._videoEl) {
      return;
    }

    context.save();
    context.globalAlpha = 1;

    if (isTextObject(object)) {
      drawTextOverlay(context, object as IText);
    } else if (isImageObject(object)) {
      drawImageOverlay(context, object, layer);
    }

    context.restore();
  });
}

export function clearOverlayImageCache() {
  imageCache.clear();
}
