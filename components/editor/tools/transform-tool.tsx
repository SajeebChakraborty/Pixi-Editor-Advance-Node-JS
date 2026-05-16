"use client";

import { FabricObject } from "fabric";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Move,
  Maximize,
  RotateCw,
  Lock,
  Unlock,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TransformToolProps {
  selectedObject: FabricObject;
}

export function TransformTool({ selectedObject }: TransformToolProps) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

  // Sync state with object on load
  useEffect(() => {
    const updateLocalState = () => {
      setWidth(
        Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1)),
      );
      setHeight(
        Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1)),
      );
      setRotation(Math.round(selectedObject.angle || 0) % 360);
    };

    updateLocalState();
    selectedObject.on("modified", updateLocalState);
    selectedObject.on("scaling", updateLocalState);
    selectedObject.on("rotating", updateLocalState);

    return () => {
      selectedObject.off("modified", updateLocalState);
      selectedObject.off("scaling", updateLocalState);
      selectedObject.off("rotating", updateLocalState);
    };
  }, [selectedObject]);

  const originalWidth = selectedObject.width || 1;
  const originalHeight = selectedObject.height || 1;
  const aspectRatio = originalWidth / originalHeight;

  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    const scaleX = newWidth / originalWidth;
    let scaleY = selectedObject.scaleY || 1;

    if (maintainAspectRatio) {
      scaleY = scaleX;
      setHeight(Math.round(newWidth / aspectRatio));
    }

    selectedObject.set({ scaleX, scaleY });
    selectedObject.canvas?.requestRenderAll();
  };

  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    const scaleY = newHeight / originalHeight;
    let scaleX = selectedObject.scaleX || 1;

    if (maintainAspectRatio) {
      scaleX = scaleY;
      setWidth(Math.round(newHeight * aspectRatio));
    }

    selectedObject.set({ scaleX, scaleY });
    selectedObject.canvas?.requestRenderAll();
  };

  const handleRotationChange = (newRotation: number) => {
    setRotation(newRotation % 360);
    selectedObject.set("angle", newRotation % 360);
    selectedObject.canvas?.requestRenderAll();
  };

  const rotate90 = () => {
    const currentAngle = selectedObject.angle || 0;
    const newAngle = (currentAngle + 90) % 360;
    setRotation(newAngle);
    selectedObject.set("angle", newAngle);
    selectedObject.canvas?.requestRenderAll();
  };

  const handleReset = () => {
    selectedObject.set({
      scaleX: 1,
      scaleY: 1,
      angle: 0,
    });
    setWidth(Math.round(originalWidth));
    setHeight(Math.round(originalHeight));
    setRotation(0);
    selectedObject.canvas?.requestRenderAll();
  };

  return (
    <div className="space-y-6">
      {/* Size Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Maximize className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">
              Dimensions
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px] gap-1.5 font-bold rounded-full transition-colors",
              maintainAspectRatio
                ? "bg-blue-50 text-blue-600"
                : "bg-gray-100 text-gray-500",
            )}
            onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
          >
            {maintainAspectRatio ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
            {maintainAspectRatio ? "LOCKED" : "FREE"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-gray-400 ml-1">
              WIDTH (PX)
            </Label>
            <Input
              type="number"
              value={width}
              onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
              className="h-9 text-xs font-mono font-bold bg-gray-50/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-gray-400 ml-1">
              HEIGHT (PX)
            </Label>
            <Input
              type="number"
              value={height}
              onChange={(e) =>
                handleHeightChange(parseInt(e.target.value) || 0)
              }
              className="h-9 text-xs font-mono font-bold bg-gray-50/50"
            />
          </div>
        </div>
      </div>

      {/* Rotation Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCw className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">
              Rotation
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={rotate90}
            className="h-6 px-2 text-[10px] font-bold border-gray-100 hover:bg-gray-50"
          >
            +90° SNAP
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Slider
            value={[rotation]}
            onValueChange={(val) => handleRotationChange(val[0])}
            min={0}
            max={360}
            step={1}
            className="flex-1"
          />
          <div className="w-14 h-9 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 text-xs font-mono font-bold text-gray-600">
            {Math.round(rotation)}°
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="text-[10px] font-bold h-8 border-gray-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100"
        >
          <RotateCcw className="w-3 h-3 mr-1.5" /> RESET ALL
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="text-[10px] font-bold h-8 text-gray-300"
        >
          <Move className="w-3 h-3 mr-1.5" /> CENTER OBJ
        </Button>
      </div>
    </div>
  );
}
