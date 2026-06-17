"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FabricImage, Rect } from "fabric";
import {
  BoxSelect,
  ChevronDown,
  Crop,
  FlipHorizontal,
  FlipVertical,
  ImageOff,
  Lock,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";
import {
  DEFAULT_BORDER,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_IMAGE_PRESET_INTENSITY,
  DEFAULT_SHADOW,
  IMAGE_PRESETS,
  applyBorder,
  applyImageCrop,
  applyImagePreset,
  applyImageRadius,
  applyShadow,
  commitCanvasHistory,
  normalizeImagePreset,
  normalizeImagePresetIntensity,
  resetImageObject,
  type BorderState,
  type CropState,
  type ImageAdjustments,
  type ImagePresetId,
  type ShadowState,
} from "@/lib/editor-actions";

interface ImagePropertiesProps {
  selectedObject: FabricImage;
}

type CropRatioId = "free" | "1:1" | "4:5" | "16:9" | "9:16";

const cropRatios: { id: CropRatioId; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

const areAdjustmentsEqual = (a: ImageAdjustments, b: ImageAdjustments) =>
  a.brightness === b.brightness &&
  a.contrast === b.contrast &&
  a.saturation === b.saturation &&
  a.hue === b.hue &&
  a.tint === b.tint &&
  a.blur === b.blur;

const areBordersEqual = (a: BorderState, b: BorderState) =>
  a.color === b.color && a.width === b.width && a.radius === b.radius;

const areShadowsEqual = (a: ShadowState, b: ShadowState) =>
  a.color === b.color &&
  a.blur === b.blur &&
  a.offsetX === b.offsetX &&
  a.offsetY === b.offsetY;

const areCropsEqual = (a: CropState | null, b: CropState | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.cropX === b.cropX &&
    a.cropY === b.cropY &&
    a.width === b.width &&
    a.height === b.height &&
    a.ratio === b.ratio
  );
};

export function ImageProperties({ selectedObject }: ImagePropertiesProps) {
  const { getSelectedLayer, updateLayerData } = useEditorStore();
  const selectedLayer = getSelectedLayer();
  const layerData = selectedLayer?.data || {};

  const [opacity, setOpacity] = useState(100);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [ratioLocked, setRatioLocked] = useState(true);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(
    DEFAULT_IMAGE_ADJUSTMENTS,
  );
  const [preset, setPreset] = useState<ImagePresetId>("none");
  const [presetIntensity, setPresetIntensity] = useState(
    DEFAULT_IMAGE_PRESET_INTENSITY,
  );
  const [border, setBorder] = useState<BorderState>(DEFAULT_BORDER);
  const [shadow, setShadow] = useState<ShadowState>(DEFAULT_SHADOW);
  const [cropMode, setCropMode] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(true);
  const [crop, setCrop] = useState<CropState | null>(null);
  const [activeCropRatio, setActiveCropRatio] = useState<CropRatioId>("free");
  const cropOverlayRef = useRef<Rect | null>(null);

  const naturalSize = useMemo(() => {
    const element =
      (selectedObject as any).getElement?.() ||
      (selectedObject as any)._originalElement ||
      null;

    return {
      width: element?.naturalWidth || selectedObject.width || 1,
      height: element?.naturalHeight || selectedObject.height || 1,
    };
  }, [selectedObject]);

  useEffect(() => {
    const updateLocalState = () => {
      setWidth(Math.round(selectedObject.getScaledWidth()));
      setHeight(Math.round(selectedObject.getScaledHeight()));
      setX(Math.round(selectedObject.left || 0));
      setY(Math.round(selectedObject.top || 0));
      setRotation(Math.round(selectedObject.angle || 0));
      setOpacity(Math.round((selectedObject.opacity || 1) * 100));
    };

    updateLocalState();
    const nextAdjustments = layerData.adjustments || DEFAULT_IMAGE_ADJUSTMENTS;
    const nextPreset = normalizeImagePreset(layerData.effects?.preset);
    const nextPresetIntensity = normalizeImagePresetIntensity(
      layerData.effects?.presetIntensity,
    );
    const nextBorder = layerData.border || DEFAULT_BORDER;
    const nextShadow = layerData.effects?.shadow || DEFAULT_SHADOW;
    const nextCrop = layerData.crop || null;
    const nextCropRatio = (layerData.crop?.ratio as CropRatioId) || "free";

    setAdjustments((prev) =>
      areAdjustmentsEqual(prev, nextAdjustments) ? prev : nextAdjustments,
    );
    setPreset((prev) => (prev === nextPreset ? prev : nextPreset));
    setPresetIntensity((prev) =>
      prev === nextPresetIntensity ? prev : nextPresetIntensity,
    );
    setBorder((prev) => (areBordersEqual(prev, nextBorder) ? prev : nextBorder));
    setShadow((prev) => (areShadowsEqual(prev, nextShadow) ? prev : nextShadow));
    setCrop((prev) => (areCropsEqual(prev, nextCrop) ? prev : nextCrop));
    setActiveCropRatio((prev) => (prev === nextCropRatio ? prev : nextCropRatio));

    selectedObject.on("scaling", updateLocalState);
    selectedObject.on("moving", updateLocalState);
    selectedObject.on("rotating", updateLocalState);
    selectedObject.on("modified", updateLocalState);
    return () => {
      selectedObject.off("scaling", updateLocalState);
      selectedObject.off("moving", updateLocalState);
      selectedObject.off("rotating", updateLocalState);
      selectedObject.off("modified", updateLocalState);
    };
  }, [selectedObject, selectedLayer?.id]);

  useEffect(() => {
    return () => removeCropOverlay();
  }, [selectedObject]);

  const saveLayerData = (data: Record<string, any>) => {
    if (selectedLayer) updateLayerData(selectedLayer.id, data);
  };

  const commit = () => commitCanvasHistory(selectedObject.canvas);

  const setObjectProps = (props: Record<string, any>) => {
    selectedObject.set(props);
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const setRotationPreservingCenter = (angle: number) => {
    const center = selectedObject.getCenterPoint();
    selectedObject.set({ angle });
    selectedObject.setPositionByOrigin(center, "center", "center");
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  function runTransientCanvasMutation(mutator: () => void) {
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    const previousHistoryState = (canvas as any).isHistoryLoading;
    (canvas as any).isHistoryLoading = true;
    try {
      mutator();
      canvas.requestRenderAll();
    } finally {
      (canvas as any).isHistoryLoading = previousHistoryState;
    }
  }

  function removeCropOverlay() {
    const overlay = cropOverlayRef.current;
    const canvas = overlay?.canvas || selectedObject.canvas;
    if (!overlay || !canvas) {
      cropOverlayRef.current = null;
      return;
    }

    runTransientCanvasMutation(() => {
      canvas.remove(overlay);
    });
    cropOverlayRef.current = null;
  }

  function getCurrentCropBase(): CropState {
    return (
      crop ||
      layerData.crop || {
        cropX: Number(selectedObject.cropX) || 0,
        cropY: Number(selectedObject.cropY) || 0,
        width: selectedObject.width || naturalSize.width,
        height: selectedObject.height || naturalSize.height,
        ratio: "free",
      }
    );
  }

  function getCropRectForRatio(ratioId: CropRatioId) {
    const bounds = selectedObject.getBoundingRect();
    const ratio = cropRatios.find((item) => item.id === ratioId)?.ratio;

    if (!ratio) {
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    }

    let width = bounds.width;
    let height = width / ratio;
    if (height > bounds.height) {
      height = bounds.height;
      width = height * ratio;
    }

    return {
      left: bounds.left + (bounds.width - width) / 2,
      top: bounds.top + (bounds.height - height) / 2,
      width,
      height,
    };
  }

  function clampCropOverlay(overlay: Rect, ratioId: CropRatioId) {
    const bounds = selectedObject.getBoundingRect();
    const ratio = cropRatios.find((item) => item.id === ratioId)?.ratio;
    const baseWidth = Math.max(1, overlay.width || 1);
    const baseHeight = Math.max(1, overlay.height || 1);

    if (ratio) {
      const nextScale = Math.min(
        overlay.scaleX || 1,
        overlay.scaleY || 1,
        bounds.width / baseWidth,
        bounds.height / baseHeight,
      );
      overlay.set({
        scaleX: Math.max(0.03, nextScale),
        scaleY: Math.max(0.03, nextScale),
      });
    } else {
      if (overlay.getScaledWidth() > bounds.width) {
        overlay.set({ scaleX: bounds.width / baseWidth });
      }
      if (overlay.getScaledHeight() > bounds.height) {
        overlay.set({ scaleY: bounds.height / baseHeight });
      }
    }

    const overlayWidth = overlay.getScaledWidth();
    const overlayHeight = overlay.getScaledHeight();
    const minLeft = bounds.left;
    const minTop = bounds.top;
    const maxLeft = bounds.left + bounds.width - overlayWidth;
    const maxTop = bounds.top + bounds.height - overlayHeight;

    overlay.set({
      left: Math.min(Math.max(overlay.left || minLeft, minLeft), maxLeft),
      top: Math.min(Math.max(overlay.top || minTop, minTop), maxTop),
    });
    overlay.setCoords();
  }

  function startCrop(ratioId: CropRatioId = activeCropRatio) {
    const canvas = selectedObject.canvas;
    if (!canvas) return;

    removeCropOverlay();
    const rect = getCropRectForRatio(ratioId);
    const overlay = new Rect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      fill: "rgba(139, 92, 246, 0.12)",
      stroke: "#8b5cf6",
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      cornerColor: "#ffffff",
      cornerStrokeColor: "#8b5cf6",
      cornerSize: 13,
      cornerStyle: "circle",
      transparentCorners: false,
      objectCaching: false,
      lockRotation: true,
      lockScalingFlip: true,
      lockUniScaling: ratioId !== "free",
      hasRotatingPoint: false,
      name: `crop_overlay_${selectedLayer?.id || "image"}`,
    } as any);

    (overlay as any).excludeFromExport = true;
    overlay.on("moving", () => clampCropOverlay(overlay, ratioId));
    overlay.on("scaling", () => clampCropOverlay(overlay, ratioId));
    overlay.on("modified", () => clampCropOverlay(overlay, ratioId));

    cropOverlayRef.current = overlay;
    setCropMode(true);
    setActiveCropRatio(ratioId);

    runTransientCanvasMutation(() => {
      canvas.add(overlay);
      canvas.setActiveObject(overlay);
    });
  }

  function setCropRatio(ratioId: CropRatioId) {
    setActiveCropRatio(ratioId);
    const overlay = cropOverlayRef.current;
    if (!cropMode || !overlay) {
      startCrop(ratioId);
      return;
    }

    const rect = getCropRectForRatio(ratioId);
    overlay.set({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      scaleX: 1,
      scaleY: 1,
      lockUniScaling: ratioId !== "free",
    } as any);
    overlay.setCoords();
    selectedObject.canvas?.setActiveObject(overlay);
    selectedObject.canvas?.requestRenderAll();
  }

  function applyCropFromOverlay() {
    const overlay = cropOverlayRef.current;
    if (!overlay) return;

    clampCropOverlay(overlay, activeCropRatio);
    const bounds = selectedObject.getBoundingRect();
    const baseCrop = getCurrentCropBase();
    const overlayLeft = overlay.left || bounds.left;
    const overlayTop = overlay.top || bounds.top;
    const overlayRight = overlayLeft + overlay.getScaledWidth();
    const overlayBottom = overlayTop + overlay.getScaledHeight();
    const cropLeftRatio = (overlayLeft - bounds.left) / bounds.width;
    const cropTopRatio = (overlayTop - bounds.top) / bounds.height;
    const cropWidthRatio = (overlayRight - overlayLeft) / bounds.width;
    const cropHeightRatio = (overlayBottom - overlayTop) / bounds.height;

    const nextCrop: CropState = {
      cropX: Math.round(baseCrop.cropX + cropLeftRatio * baseCrop.width),
      cropY: Math.round(baseCrop.cropY + cropTopRatio * baseCrop.height),
      width: Math.max(1, Math.round(cropWidthRatio * baseCrop.width)),
      height: Math.max(1, Math.round(cropHeightRatio * baseCrop.height)),
      ratio: activeCropRatio,
    };

    removeCropOverlay();
    applyImageCrop(selectedObject, nextCrop, border.radius);
    selectedObject.set({
      left: overlayLeft,
      top: overlayTop,
      scaleX: (overlayRight - overlayLeft) / nextCrop.width,
      scaleY: (overlayBottom - overlayTop) / nextCrop.height,
    });
    selectedObject.setCoords();
    selectedObject.canvas?.setActiveObject(selectedObject);
    selectedObject.canvas?.requestRenderAll();
    setCrop(nextCrop);
    setCropMode(false);
    setWidth(Math.round(selectedObject.getScaledWidth()));
    setHeight(Math.round(selectedObject.getScaledHeight()));
    setX(Math.round(selectedObject.left || 0));
    setY(Math.round(selectedObject.top || 0));
    saveLayerData({ crop: nextCrop });
    commit();
  }

  function cancelCrop() {
    removeCropOverlay();
    setCropMode(false);
    selectedObject.canvas?.setActiveObject(selectedObject);
    selectedObject.canvas?.requestRenderAll();
  }

  const handleWidthChange = (val: number) => {
    const next = Math.max(1, val);
    setWidth(next);
    const scaleX = next / (selectedObject.width || 1);
    selectedObject.set({ scaleX });
    if (ratioLocked) {
      selectedObject.set({ scaleY: scaleX });
      setHeight(Math.round((selectedObject.height || 1) * scaleX));
    }
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
    commit();
  };

  const handleHeightChange = (val: number) => {
    const next = Math.max(1, val);
    setHeight(next);
    const scaleY = next / (selectedObject.height || 1);
    selectedObject.set({ scaleY });
    if (ratioLocked) {
      selectedObject.set({ scaleX: scaleY });
      setWidth(Math.round((selectedObject.width || 1) * scaleY));
    }
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
    commit();
  };

  const handleAdjustment = (
    key: keyof ImageAdjustments,
    value: number,
    shouldCommit = false,
  ) => {
    const next = { ...adjustments, [key]: value };
    setAdjustments(next);
    applyImagePreset(selectedObject, preset, next, presetIntensity);
    saveLayerData({ adjustments: next });
    if (shouldCommit) commit();
  };

  const handlePreset = (value: ImagePresetId) => {
    const nextIntensity =
      value === "none"
        ? 0
        : preset === "none" || presetIntensity <= 0
          ? DEFAULT_IMAGE_PRESET_INTENSITY
          : presetIntensity;

    setPreset(value);
    setPresetIntensity(nextIntensity);
    applyImagePreset(selectedObject, value, adjustments, nextIntensity);
    saveLayerData({
      effects: {
        ...(layerData.effects || {}),
        preset: value,
        presetIntensity: nextIntensity,
        shadow,
      },
    });
    commit();
  };

  const handlePresetIntensity = (value: number, shouldCommit = false) => {
    const next = normalizeImagePresetIntensity(value);
    setPresetIntensity(next);
    applyImagePreset(selectedObject, preset, adjustments, next);
    saveLayerData({
      effects: {
        ...(layerData.effects || {}),
        preset,
        presetIntensity: next,
        shadow,
      },
    });
    if (shouldCommit) commit();
  };

  const handleResetCrop = () => {
    const bounds = selectedObject.getBoundingRect();
    removeCropOverlay();
    setCrop(null);
    applyImageCrop(selectedObject, null, border.radius);
    selectedObject.set({
      left: bounds.left,
      top: bounds.top,
      scaleX: bounds.width / Math.max(1, naturalSize.width),
      scaleY: bounds.height / Math.max(1, naturalSize.height),
    });
    selectedObject.setCoords();
    selectedObject.canvas?.setActiveObject(selectedObject);
    saveLayerData({ crop: null });
    setCropMode(false);
    setWidth(Math.round(selectedObject.getScaledWidth()));
    setHeight(Math.round(selectedObject.getScaledHeight()));
    setX(Math.round(selectedObject.left || 0));
    setY(Math.round(selectedObject.top || 0));
    commit();
  };

  const handleBorder = (
    updates: Partial<BorderState>,
    shouldCommit = false,
  ) => {
    const next = { ...border, ...updates };
    setBorder(next);
    applyBorder(selectedObject, next);
    applyImageRadius(selectedObject, next.radius);
    selectedObject.canvas?.requestRenderAll();
    saveLayerData({ border: next });
    if (shouldCommit) commit();
  };

  const handleShadow = (
    updates: Partial<ShadowState>,
    shouldCommit = false,
  ) => {
    const next = { ...shadow, ...updates };
    setShadow(next);
    applyShadow(selectedObject, next);
    saveLayerData({
      effects: {
        ...(layerData.effects || {}),
        preset,
        shadow: next,
      },
    });
    if (shouldCommit) commit();
  };

  const handleReset = () => {
    removeCropOverlay();
    resetImageObject(selectedObject);
    selectedObject.canvas?.setActiveObject(selectedObject);
    setOpacity(100);
    setRotation(0);
    setAdjustments(DEFAULT_IMAGE_ADJUSTMENTS);
    setPreset("none");
    setPresetIntensity(DEFAULT_IMAGE_PRESET_INTENSITY);
    setBorder(DEFAULT_BORDER);
    setShadow(DEFAULT_SHADOW);
    setCrop(null);
    setCropMode(false);
    saveLayerData({
      adjustments: DEFAULT_IMAGE_ADJUSTMENTS,
      crop: null,
      effects: {
        preset: "none",
        presetIntensity: DEFAULT_IMAGE_PRESET_INTENSITY,
        shadow: DEFAULT_SHADOW,
      },
      border: DEFAULT_BORDER,
    });
    commit();
  };

  const adjustmentControls: {
    key: keyof ImageAdjustments;
    label: string;
    min: number;
    max: number;
  }[] = [
    { key: "brightness", label: "Brightness", min: -100, max: 100 },
    { key: "contrast", label: "Contrast", min: -100, max: 100 },
    { key: "saturation", label: "Saturation", min: -100, max: 100 },
    { key: "hue", label: "Hue", min: -100, max: 100 },
    { key: "tint", label: "Tint", min: -100, max: 100 },
    { key: "blur", label: "Blur", min: 0, max: 100 },
  ];

  return (
    <div className="space-y-7 pb-8">
      <section className="space-y-3">
        <PanelTitle icon={SlidersHorizontal} label="Transform" />
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
          <Field label="Width" value={width} onChange={handleWidthChange} />
          <button
            onClick={() => setRatioLocked(!ratioLocked)}
            className={cn(
              "mt-5 flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
              ratioLocked
                ? "border-[#8b5cf6]/50 bg-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                : "border-white/10 bg-[#222] text-gray-400 hover:border-white/20 hover:text-white",
            )}
            title={
              ratioLocked ? "Aspect ratio locked" : "Aspect ratio unlocked"
            }
            aria-label={
              ratioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"
            }
          >
            {ratioLocked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
          </button>
          <Field label="Height" value={height} onChange={handleHeightChange} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="X"
            value={x}
            onChange={(value) => {
              setX(value);
              setObjectProps({ left: value });
              commit();
            }}
          />
          <Field
            label="Y"
            value={y}
            onChange={(value) => {
              setY(value);
              setObjectProps({ top: value });
              commit();
            }}
          />
          <Field
            label="Rotation"
            value={rotation}
            onChange={(value) => {
              setRotation(value);
              setRotationPreservingCenter(value);
              commit();
            }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <IconButton
            label="Flip horizontal"
            icon={FlipHorizontal}
            onClick={() => {
              selectedObject.set("flipX", !selectedObject.flipX);
              selectedObject.canvas?.requestRenderAll();
              commit();
            }}
          />
          <IconButton
            label="Flip vertical"
            icon={FlipVertical}
            onClick={() => {
              selectedObject.set("flipY", !selectedObject.flipY);
              selectedObject.canvas?.requestRenderAll();
              commit();
            }}
          />
          <IconButton
            label="Rotate left"
            icon={RotateCcw}
            onClick={() => {
              const next = (rotation - 90) % 360;
              setRotation(next);
              setRotationPreservingCenter(next);
              commit();
            }}
          />
          <IconButton
            label="Rotate right"
            icon={RotateCw}
            onClick={() => {
              const next = (rotation + 90) % 360;
              setRotation(next);
              setRotationPreservingCenter(next);
              commit();
            }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <PanelTitle icon={Crop} label="Crop" />
        <div className="space-y-3 rounded-xl bg-[#111] p-3 ring-1 ring-white/10">
          <div className="grid grid-cols-4 gap-1.5">
            {cropRatios.map((item) => (
              <button
                key={item.id}
                onClick={() => setCropRatio(item.id)}
                className={cn(
                  "h-8 rounded-lg text-[10px] font-bold",
                  activeCropRatio === item.id && cropMode
                    ? "bg-[#8b5cf6] text-white"
                    : "bg-[#222] text-gray-400 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!cropMode ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => startCrop(activeCropRatio)}
                className="h-9 rounded-lg bg-white text-black hover:bg-gray-200"
              >
                <Crop className="h-4 w-4" /> Start Crop
              </Button>
              <Button
                onClick={handleResetCrop}
                variant="ghost"
                className="h-9 rounded-lg bg-[#222] text-gray-300 hover:bg-white/10 hover:text-white"
              >
                Reset Crop
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-violet-100">
                Crop active
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={applyCropFromOverlay}
                  className="h-9 rounded-lg"
                >
                  Apply
                </Button>
                <Button
                  onClick={cancelCrop}
                  variant="ghost"
                  className="h-9 rounded-lg bg-[#222] text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetCrop}
                  variant="ghost"
                  className="h-9 rounded-lg bg-[#222] text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
          {crop && !cropMode && (
            <div className="rounded-lg bg-black/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Crop applied: {crop.ratio}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setPresetsOpen((open) => !open)}
          className="group flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/5"
        >
          <PanelTitle
            iconSrc="https://www.zenbitx.com/email-assets/images/Presets.png"
            label="Presets"
          />
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-500 transition-transform group-hover:text-white",
              presetsOpen && "rotate-180",
            )}
          />
        </button>

        {presetsOpen && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#111] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 ring-1 ring-white/10">
              <span>{IMAGE_PRESETS.length} effects</span>
              <span className="text-violet-300">
                {IMAGE_PRESETS.find((item) => item.id === preset)?.label ||
                  "None"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {IMAGE_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.category}
                  onClick={() => handlePreset(item.id)}
                  className={cn(
                    "h-9 rounded-lg px-2 text-[11px] font-bold transition-colors",
                    preset === item.id
                      ? "bg-white text-black"
                      : "bg-[#222] text-gray-400 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {preset !== "none" && (
              <div className="rounded-xl bg-[#111] p-3 ring-1 ring-white/10">
                <ValueSlider
                  label="Preset Intensity"
                  value={presetIntensity}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => handlePresetIntensity(value)}
                  onCommit={(value) => handlePresetIntensity(value, true)}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setAdjustOpen((open) => !open)}
          className="group flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/5"
        >
          <PanelTitle icon={SlidersHorizontal} label="Adjust" />
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-500 transition-transform group-hover:text-white",
              adjustOpen && "rotate-180",
            )}
          />
        </button>

        {adjustOpen && (
          <div className="space-y-4">
            {adjustmentControls.map((control) => (
              <ValueSlider
                key={control.key}
                label={control.label}
                value={adjustments[control.key]}
                min={control.min}
                max={control.max}
                onChange={(value) => handleAdjustment(control.key, value)}
                onCommit={(value) =>
                  handleAdjustment(control.key, value, true)
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <PanelTitle icon={BoxSelect} label="Border & Effects" />
        <ValueSlider
          label="Transparency"
          value={opacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => {
            setOpacity(value);
            selectedObject.set("opacity", value / 100);
            selectedObject.canvas?.requestRenderAll();
          }}
          onCommit={(value) => {
            selectedObject.set("opacity", value / 100);
            saveLayerData({ opacity: value / 100 });
            commit();
          }}
        />
        <ValueSlider
          label="Border Width"
          value={border.width}
          min={0}
          max={40}
          onChange={(value) => handleBorder({ width: value })}
          onCommit={(value) => handleBorder({ width: value }, true)}
        />
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <ValueSlider
            label="Corner Radius"
            value={border.radius}
            min={0}
            max={200}
            onChange={(value) => handleBorder({ radius: value })}
            onCommit={(value) => handleBorder({ radius: value }, true)}
          />
          <div className="space-y-1.5">
            <span className="pl-1 text-[10px] font-bold uppercase text-gray-400">
              Border
            </span>
            <Input
              type="color"
              value={border.color}
              onChange={(event) =>
                handleBorder({ color: event.target.value }, true)
              }
              className="h-10 bg-[#222] p-1"
            />
          </div>
        </div>
        <ValueSlider
          label="Shadow Blur"
          value={shadow.blur}
          min={0}
          max={80}
          onChange={(value) => handleShadow({ blur: value })}
          onCommit={(value) => handleShadow({ blur: value }, true)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Shadow X"
            value={shadow.offsetX}
            onChange={(value) => handleShadow({ offsetX: value }, true)}
          />
          <Field
            label="Shadow Y"
            value={shadow.offsetY}
            onChange={(value) => handleShadow({ offsetY: value }, true)}
          />
        </div>
      </section>

      <Button
        onClick={handleReset}
        variant="ghost"
        className="h-10 w-full rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-100"
      >
        <ImageOff className="h-4 w-4" /> Reset Image Edits
      </Button>
    </div>
  );
}

function PanelTitle({
  icon: Icon,
  iconSrc,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  iconSrc?: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {iconSrc ? (
        <img src={iconSrc} alt="" className="h-3.5 w-3.5 object-contain" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 text-gray-300" />
      ) : null}
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-200">
        {label}
      </h3>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value || 0)));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
    }
  }, [isFocused, value]);

  const commitDraft = () => {
    const trimmed = draft.trim();
    const next = Number(trimmed);

    if (trimmed === "" || !Number.isFinite(next)) {
      setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
      return;
    }

    onChange(Math.round(next));
  };

  return (
    <label className="space-y-1.5">
      <span className="pl-1 text-[10px] font-bold uppercase text-gray-400">
        {label}
      </span>
      <Input
        type="number"
        value={draft}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          commitDraft();
          setIsFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
            event.currentTarget.blur();
          }
        }}
        className="h-10 border-transparent bg-[#222] font-mono text-xs font-bold text-white focus:border-[#8b5cf6]"
      />
    </label>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-9 items-center justify-center rounded-lg bg-[#222] text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ValueSlider({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-gray-300">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(next) => onChange(next[0])}
        onValueCommit={(next) => onCommit(next[0])}
      />
    </div>
  );
}
