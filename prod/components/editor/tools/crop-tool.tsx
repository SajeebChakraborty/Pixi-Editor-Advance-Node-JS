"use client";

import { useState, useEffect } from "react";
import { FabricImage, Rect, Point } from "fabric";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check, X, Maximize, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CropToolProps {
  selectedObject: FabricImage;
  onApplyCrop?: () => void;
  onCancel?: () => void;
}

export function CropTool({
  selectedObject,
  onApplyCrop,
  onCancel,
}: CropToolProps) {
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(selectedObject.width || 100);
  const [cropHeight, setCropHeight] = useState(selectedObject.height || 100);
  const [activeRatio, setActiveRatio] = useState<string>("free");

  const imageWidth = selectedObject.width || 100;
  const imageHeight = selectedObject.height || 100;

  const ratios = [
    { label: "Free", value: "free" },
    { label: "1:1", value: "1:1", factor: 1 },
    { label: "4:5", value: "4:5", factor: 0.8 },
    { label: "16:9", value: "16:9", factor: 16 / 9 },
  ];

  const applyRatio = (ratio: (typeof ratios)[0]) => {
    setActiveRatio(ratio.value);
    if (ratio.value === "free") return;

    const factor = ratio.factor!;
    let newW = imageWidth;
    let newH = imageWidth / factor;

    if (newH > imageHeight) {
      newH = imageHeight;
      newW = imageHeight * factor;
    }

    setCropWidth(Math.round(newW));
    setCropHeight(Math.round(newH));
    setCropX(Math.round((imageWidth - newW) / 2));
    setCropY(Math.round((imageHeight - newH) / 2));
  };

  const handleApply = () => {
    const clipPath = new Rect({
      left: cropX - selectedObject.width! / 2,
      top: cropY - selectedObject.height! / 2,
      width: cropWidth,
      height: cropHeight,
      // Fabric 6 uses relative coordinates for clipPath if it's assigned to object
    });

    selectedObject.set("clipPath", clipPath);
    selectedObject.canvas?.requestRenderAll();
    onApplyCrop?.();
  };

  const handleReset = () => {
    setCropX(0);
    setCropY(0);
    setCropWidth(imageWidth);
    setCropHeight(imageHeight);
    setActiveRatio("free");
    selectedObject.set("clipPath", undefined);
    selectedObject.canvas?.requestRenderAll();
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center gap-2 mb-2">
        <Maximize className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Preset Ratios
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {ratios.map((r) => (
          <Button
            key={r.value}
            variant={activeRatio === r.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 text-[10px] font-bold px-0",
              activeRatio === r.value
                ? "bg-blue-600"
                : "bg-white border-gray-100",
            )}
            onClick={() => applyRatio(r)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold text-gray-400 uppercase">
            Crop Area
          </Label>
          <span className="text-[10px] font-mono text-gray-400">
            {Math.round(cropWidth)} × {Math.round(cropHeight)}
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-500">
              <span>X OFFSET</span>
              <span>{Math.round(cropX)}px</span>
            </div>
            <Slider
              value={[cropX]}
              onValueChange={(val) =>
                setCropX(Math.max(0, Math.min(val[0], imageWidth - cropWidth)))
              }
              min={0}
              max={imageWidth - cropWidth}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-500">
              <span>Y OFFSET</span>
              <span>{Math.round(cropY)}px</span>
            </div>
            <Slider
              value={[cropY]}
              onValueChange={(val) =>
                setCropY(
                  Math.max(0, Math.min(val[0], imageHeight - cropHeight)),
                )
              }
              min={0}
              max={imageHeight - cropHeight}
              step={1}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleApply}
          className="flex-1 bg-blue-600 hover:bg-blue-700 h-10 text-[10px] font-bold gap-2"
        >
          <Check className="w-3.5 h-3.5" /> APPLY
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="h-10 px-3 border-gray-100"
          title="Reset Crop"
        >
          <RefreshCcw className="w-3.5 h-3.5 text-gray-400" />
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="h-10 px-3 hover:bg-red-50 hover:text-red-500"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
