import * as fabric from "fabric";
import { useEditorStore, type Layer } from "./store";

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  tint: number;
  blur: number;
};

export const IMAGE_PRESETS = [
  { id: "none", label: "None", category: "Basic" },
  { id: "grayscale", label: "Mono", category: "Basic" },
  { id: "sepia", label: "Sepia", category: "Basic" },
  { id: "vintage", label: "Vintage", category: "Basic" },
  { id: "vivid", label: "Vivid", category: "Creative" },
  { id: "cinema", label: "Cinema", category: "Creative" },
  { id: "dramatic", label: "Dramatic", category: "Creative" },
  { id: "soft", label: "Soft", category: "Creative" },
  { id: "matte", label: "Matte", category: "Creative" },
  { id: "warm", label: "Warm", category: "Temperature" },
  { id: "cool", label: "Cool", category: "Temperature" },
  { id: "fade", label: "Fade", category: "Style" },
  { id: "bright", label: "Bright", category: "Style" },
  { id: "moody", label: "Moody", category: "Style" },
  { id: "crisp", label: "Crisp", category: "Style" },
  { id: "portrait", label: "Portrait", category: "Use Case" },
  { id: "landscape", label: "Landscape", category: "Use Case" },
  { id: "sunset", label: "Sunset", category: "Color" },
  { id: "ocean", label: "Ocean", category: "Color" },
  { id: "emerald", label: "Emerald", category: "Color" },
  { id: "frost", label: "Frost", category: "Color" },
  { id: "noir", label: "Noir", category: "Film" },
  { id: "polaroid", label: "Polaroid", category: "Film" },
  { id: "kodachrome", label: "Kodachrome", category: "Film" },
  { id: "technicolor", label: "Technicolor", category: "Film" },
  { id: "brownie", label: "Brownie", category: "Film" },
] as const;

export type ImagePresetId = (typeof IMAGE_PRESETS)[number]["id"];

export const DEFAULT_IMAGE_PRESET_INTENSITY = 100;

export const normalizeImagePresetIntensity = (
  intensity?: number | null,
): number => {
  const parsed = Number(intensity);
  if (!Number.isFinite(parsed)) return DEFAULT_IMAGE_PRESET_INTENSITY;

  return Math.min(100, Math.max(0, Math.round(parsed)));
};

export const normalizeImagePreset = (preset?: string | null): ImagePresetId => {
  if (preset && IMAGE_PRESETS.some((item) => item.id === preset)) {
    return preset as ImagePresetId;
  }

  return "none";
};

export type CropState = {
  cropX: number;
  cropY: number;
  width: number;
  height: number;
  ratio: string;
};

export type BorderState = {
  color: string;
  width: number;
  radius: number;
};

export type ShadowState = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  tint: 0,
  blur: 0,
};

export const DEFAULT_BORDER: BorderState = {
  color: "#ffffff",
  width: 0,
  radius: 0,
};

export const DEFAULT_SHADOW: ShadowState = {
  color: "rgba(0,0,0,0.35)",
  blur: 0,
  offsetX: 0,
  offsetY: 0,
};

export const getLayerObject = (
  layer: Layer | undefined,
  canvas?: fabric.Canvas | null,
) => {
  if (!layer?.objectId || !canvas) return null;
  return (
    canvas
      .getObjects()
      .find((object) => (object as any).name === layer.objectId) || null
  );
};

export const commitCanvasHistory = (canvas?: fabric.Canvas | null) => {
  if (!canvas || (canvas as any).isHistoryLoading) return;
  const store = useEditorStore.getState();
  store.saveToHistory(JSON.stringify(canvas.toJSON()));
};

export const mergeLayerData = (layerId: string, data: Record<string, any>) => {
  const store = useEditorStore.getState();
  const layer = store.getLayers().find((item) => item.id === layerId);
  if (!layer) return;

  store.updateLayer(layerId, {
    data: {
      ...(layer.data || {}),
      ...data,
    },
  });
};

export const selectObjectForLayer = (layerId: string) => {
  const store = useEditorStore.getState();
  const layer = store.getLayers().find((item) => item.id === layerId);
  const object = getLayerObject(layer, store.canvas.fabricCanvas);
  store.selectLayer(layerId);

  if (object && store.canvas.fabricCanvas) {
    store.canvas.fabricCanvas.setActiveObject(object);
    store.canvas.fabricCanvas.requestRenderAll();
  }
};

type FilterSpec = {
  name: string;
  options?: Record<string, any>;
};

const createFabricFilter = (
  filterName: string,
  options: Record<string, any> = {},
) => {
  const FilterConstructor = (fabric.filters as any)[filterName];
  if (!FilterConstructor) return null;

  try {
    return new FilterConstructor(options);
  } catch {
    return null;
  }
};

const buildFilters = (specs: FilterSpec[]) =>
  specs
    .map((spec) => createFabricFilter(spec.name, spec.options))
    .filter(Boolean) as any[];

const buildAdjustmentFilters = (adjustments: ImageAdjustments) => {
  const specs: FilterSpec[] = [];

  if (adjustments.brightness) {
    specs.push({
      name: "Brightness",
      options: { brightness: adjustments.brightness / 100 },
    });
  }

  if (adjustments.contrast) {
    specs.push({
      name: "Contrast",
      options: { contrast: adjustments.contrast / 100 },
    });
  }

  if (adjustments.saturation) {
    specs.push({
      name: "Saturation",
      options: { saturation: adjustments.saturation / 100 },
    });
  }

  if (adjustments.hue) {
    specs.push({
      name: "HueRotation",
      options: { rotation: adjustments.hue / 100 },
    });
  }

  if (adjustments.tint) {
    specs.push({
      name: "BlendColor",
      options: {
        color: adjustments.tint > 0 ? "#ff5ec9" : "#4ade80",
        mode: "tint",
        alpha: (Math.abs(adjustments.tint) / 100) * 0.25,
      },
    });
  }

  if (adjustments.blur) {
    specs.push({
      name: "Blur",
      options: { blur: adjustments.blur / 100 },
    });
  }

  return buildFilters(specs);
};

const presetFilterMap: Record<ImagePresetId, FilterSpec[]> = {
  none: [],
  grayscale: [{ name: "Saturation", options: { saturation: -1 } }],
  sepia: [
    { name: "Saturation", options: { saturation: -0.18 } },
    { name: "Contrast", options: { contrast: 0.06 } },
    { name: "Brightness", options: { brightness: 0.03 } },
    {
      name: "BlendColor",
      options: { color: "#b77945", mode: "tint", alpha: 0.1 },
    },
  ],
  vintage: [
    { name: "Contrast", options: { contrast: 0.05 } },
    { name: "Brightness", options: { brightness: 0.04 } },
    { name: "Saturation", options: { saturation: -0.12 } },
    {
      name: "BlendColor",
      options: { color: "#d7b388", mode: "screen", alpha: 0.08 },
    },
  ],
  vivid: [
    { name: "Contrast", options: { contrast: 0.12 } },
    { name: "Saturation", options: { saturation: 0.28 } },
    { name: "Vibrance", options: { vibrance: 0.28 } },
    { name: "Brightness", options: { brightness: 0.02 } },
  ],
  cinema: [
    { name: "Contrast", options: { contrast: 0.12 } },
    { name: "Saturation", options: { saturation: -0.06 } },
    { name: "Brightness", options: { brightness: 0.02 } },
    { name: "HueRotation", options: { rotation: -0.02 } },
    {
      name: "BlendColor",
      options: { color: "#47669f", mode: "tint", alpha: 0.08 },
    },
  ],
  dramatic: [
    { name: "Contrast", options: { contrast: 0.28 } },
    { name: "Brightness", options: { brightness: -0.07 } },
    { name: "Saturation", options: { saturation: 0.1 } },
  ],
  soft: [
    { name: "Contrast", options: { contrast: -0.08 } },
    { name: "Brightness", options: { brightness: 0.08 } },
    { name: "Saturation", options: { saturation: -0.06 } },
  ],
  matte: [
    { name: "Contrast", options: { contrast: -0.1 } },
    { name: "Brightness", options: { brightness: 0.05 } },
    { name: "Saturation", options: { saturation: -0.1 } },
    {
      name: "BlendColor",
      options: { color: "#222222", mode: "screen", alpha: 0.08 },
    },
  ],
  warm: [
    { name: "Saturation", options: { saturation: 0.18 } },
    { name: "Brightness", options: { brightness: 0.04 } },
    { name: "HueRotation", options: { rotation: 0.02 } },
    {
      name: "BlendColor",
      options: { color: "#ffb45c", mode: "tint", alpha: 0.08 },
    },
  ],
  cool: [
    { name: "Saturation", options: { saturation: -0.05 } },
    { name: "Brightness", options: { brightness: 0.04 } },
    { name: "HueRotation", options: { rotation: -0.05 } },
    {
      name: "BlendColor",
      options: { color: "#77b6ff", mode: "tint", alpha: 0.08 },
    },
  ],
  fade: [
    { name: "Contrast", options: { contrast: -0.16 } },
    { name: "Brightness", options: { brightness: 0.07 } },
    { name: "Saturation", options: { saturation: -0.2 } },
  ],
  bright: [
    { name: "Brightness", options: { brightness: 0.1 } },
    { name: "Contrast", options: { contrast: 0.06 } },
    { name: "Saturation", options: { saturation: 0.08 } },
  ],
  moody: [
    { name: "Brightness", options: { brightness: -0.01 } },
    { name: "Contrast", options: { contrast: 0.14 } },
    { name: "Saturation", options: { saturation: -0.08 } },
    {
      name: "BlendColor",
      options: { color: "#51627e", mode: "tint", alpha: 0.08 },
    },
  ],
  crisp: [
    { name: "Contrast", options: { contrast: 0.18 } },
    { name: "Saturation", options: { saturation: 0.1 } },
  ],
  portrait: [
    { name: "Brightness", options: { brightness: 0.04 } },
    { name: "Contrast", options: { contrast: 0.04 } },
    { name: "Saturation", options: { saturation: 0.12 } },
    {
      name: "BlendColor",
      options: { color: "#ffd1bf", mode: "screen", alpha: 0.06 },
    },
  ],
  landscape: [
    { name: "Contrast", options: { contrast: 0.1 } },
    { name: "Saturation", options: { saturation: 0.22 } },
    { name: "Brightness", options: { brightness: 0.02 } },
  ],
  sunset: [
    { name: "Brightness", options: { brightness: 0.05 } },
    { name: "Saturation", options: { saturation: 0.25 } },
    {
      name: "BlendColor",
      options: { color: "#ff8d4d", mode: "tint", alpha: 0.1 },
    },
  ],
  ocean: [
    { name: "Saturation", options: { saturation: 0.16 } },
    { name: "HueRotation", options: { rotation: -0.08 } },
    { name: "Contrast", options: { contrast: 0.04 } },
    { name: "Brightness", options: { brightness: 0.03 } },
    {
      name: "BlendColor",
      options: { color: "#58c5ff", mode: "tint", alpha: 0.08 },
    },
  ],
  emerald: [
    { name: "Saturation", options: { saturation: 0.12 } },
    { name: "HueRotation", options: { rotation: 0.05 } },
    { name: "Contrast", options: { contrast: 0.04 } },
    { name: "Brightness", options: { brightness: 0.03 } },
    {
      name: "BlendColor",
      options: { color: "#32d39a", mode: "tint", alpha: 0.08 },
    },
  ],
  frost: [
    { name: "Brightness", options: { brightness: 0.07 } },
    { name: "Saturation", options: { saturation: -0.22 } },
    { name: "HueRotation", options: { rotation: -0.08 } },
    {
      name: "BlendColor",
      options: { color: "#dbeafe", mode: "screen", alpha: 0.1 },
    },
  ],
  noir: [
    { name: "Saturation", options: { saturation: -1 } },
    { name: "Contrast", options: { contrast: 0.25 } },
    { name: "Brightness", options: { brightness: -0.06 } },
  ],
  polaroid: [
    { name: "Brightness", options: { brightness: 0.04 } },
    { name: "Contrast", options: { contrast: 0.08 } },
    { name: "Saturation", options: { saturation: -0.08 } },
    {
      name: "BlendColor",
      options: { color: "#f5d7a1", mode: "screen", alpha: 0.1 },
    },
  ],
  kodachrome: [
    { name: "Contrast", options: { contrast: 0.1 } },
    { name: "Saturation", options: { saturation: 0.14 } },
    { name: "Brightness", options: { brightness: 0.03 } },
    {
      name: "BlendColor",
      options: { color: "#de9950", mode: "tint", alpha: 0.07 },
    },
  ],
  technicolor: [
    { name: "Contrast", options: { contrast: 0.14 } },
    { name: "Saturation", options: { saturation: 0.16 } },
    { name: "Vibrance", options: { vibrance: 0.18 } },
  ],
  brownie: [
    { name: "Brightness", options: { brightness: 0.06 } },
    { name: "Contrast", options: { contrast: -0.02 } },
    { name: "Saturation", options: { saturation: -0.15 } },
    {
      name: "BlendColor",
      options: { color: "#a56a42", mode: "tint", alpha: 0.09 },
    },
  ],
};

const scaleFilterSpec = (spec: FilterSpec, amount: number): FilterSpec => ({
  name: spec.name,
  options: spec.options
    ? Object.fromEntries(
        Object.entries(spec.options).map(([key, value]) => [
          key,
          typeof value === "number" ? value * amount : value,
        ]),
      )
    : undefined,
});

const buildPresetFilters = (
  preset: ImagePresetId,
  presetIntensity = DEFAULT_IMAGE_PRESET_INTENSITY,
) => {
  const amount = normalizeImagePresetIntensity(presetIntensity) / 100;

  if (preset === "none" || amount <= 0) return [];

  return buildFilters(
    presetFilterMap[preset].map((spec) => scaleFilterSpec(spec, amount)),
  );
};

export const applyImageAdjustments = (
  image: fabric.FabricImage,
  adjustments: ImageAdjustments,
) => {
  image.filters = buildAdjustmentFilters(adjustments);
  image.applyFilters();
  image.canvas?.requestRenderAll();
};

export const applyImagePreset = (
  image: fabric.FabricImage,
  preset: ImagePresetId | string,
  adjustments: ImageAdjustments,
  presetIntensity = DEFAULT_IMAGE_PRESET_INTENSITY,
) => {
  const safePreset = normalizeImagePreset(preset);
  image.filters = [
    ...buildAdjustmentFilters(adjustments),
    ...buildPresetFilters(safePreset, presetIntensity),
  ];
  image.applyFilters();
  image.canvas?.requestRenderAll();
};

export const applyImageCrop = (
  image: fabric.FabricImage,
  crop: CropState | null,
  radius = 0,
) => {
  if (!crop) {
    image.set({
      cropX: 0,
      cropY: 0,
      width: (image as any)._originalElement?.naturalWidth || image.width,
      height: (image as any)._originalElement?.naturalHeight || image.height,
    });
  } else {
    image.set({
      cropX: crop.cropX,
      cropY: crop.cropY,
      width: crop.width,
      height: crop.height,
    });
  }

  applyImageRadius(image, radius);
  image.setCoords();
  image.canvas?.requestRenderAll();
};

export const applyImageRadius = (image: fabric.FabricImage, radius: number) => {
  if (radius <= 0) {
    image.set("clipPath", undefined);
    return;
  }

  image.set(
    "clipPath",
    new fabric.Rect({
      left: -(image.width || 0) / 2,
      top: -(image.height || 0) / 2,
      width: image.width || 0,
      height: image.height || 0,
      rx: radius,
      ry: radius,
    }),
  );
};

export const applyBorder = (
  object: fabric.FabricObject,
  border: BorderState,
) => {
  object.set({
    stroke: border.width > 0 ? border.color : undefined,
    strokeWidth: border.width,
  });
  object.canvas?.requestRenderAll();
};

export const applyShadow = (
  object: fabric.FabricObject,
  shadow: ShadowState,
) => {
  object.set({
    shadow:
      shadow.blur > 0
        ? new fabric.Shadow({
            color: shadow.color,
            blur: shadow.blur,
            offsetX: shadow.offsetX,
            offsetY: shadow.offsetY,
          })
        : null,
  });
  object.canvas?.requestRenderAll();
};

export const resetImageObject = (image: fabric.FabricImage) => {
  image.set({
    opacity: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    stroke: undefined,
    strokeWidth: 0,
    shadow: null,
    cropX: 0,
    cropY: 0,
    width: (image as any)._originalElement?.naturalWidth || image.width,
    height: (image as any)._originalElement?.naturalHeight || image.height,
    clipPath: undefined,
  });
  image.filters = [];
  image.applyFilters();
  image.setCoords();
  image.canvas?.requestRenderAll();
};
