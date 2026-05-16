"use client";

import { useState, useEffect } from "react";
import { FabricImage } from "fabric";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Expand, Pipette, BoxSelect, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";

interface ImagePropertiesProps {
  selectedObject: FabricImage;
}

export function ImageProperties({ selectedObject }: ImagePropertiesProps) {
  const [opacity, setOpacity] = useState(100);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [ratioLocked, setRatioLocked] = useState(true);
  const [radius, setRadius] = useState(0);
  const [colorTab, setColorTab] = useState<"fill" | "stroke">("fill");

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const updateLocalState = () => {
      setWidth(Math.round(selectedObject.getScaledWidth()));
      setHeight(Math.round(selectedObject.getScaledHeight()));
      setX(Math.round(selectedObject.left || 0));
      setY(Math.round(selectedObject.top || 0));
      setRotation(Math.round(selectedObject.angle || 0));
      setOpacity(Math.round((selectedObject.opacity || 1) * 100));
      // FabricImage doesn't have rx/ry by default, but we might have added them or use clipPath
      setRadius((selectedObject as any).rx || 0);
    };

    updateLocalState();
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
  }, [selectedObject]);

  const handleWidthChange = (val: number) => {
    setWidth(val);
    const scaleX = val / selectedObject.width!;
    selectedObject.set({ scaleX });
    if (ratioLocked) {
      selectedObject.set({ scaleY: scaleX });
      setHeight(Math.round(selectedObject.height! * scaleX));
    }
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const handleHeightChange = (val: number) => {
    setHeight(val);
    const scaleY = val / selectedObject.height!;
    selectedObject.set({ scaleY });
    if (ratioLocked) {
      selectedObject.set({ scaleX: scaleY });
      setWidth(Math.round(selectedObject.width! * scaleY));
    }
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const handleXChange = (val: number) => {
    setX(val);
    selectedObject.set({ left: val });
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const handleYChange = (val: number) => {
    setY(val);
    selectedObject.set({ top: val });
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const handleRotationChange = (val: number) => {
    setRotation(val);
    selectedObject.set({ angle: val });
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    selectedObject.set({ opacity: val / 100 });
    selectedObject.canvas?.requestRenderAll();
  };

  const handleRadiusChange = (val: number) => {
    setRadius(val);
    (selectedObject as any).rx = val;
    (selectedObject as any).ry = val;
    selectedObject.canvas?.requestRenderAll();
  };

  return (
    <div className="space-y-8">
      {/* Alignment / Dimensions */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Dimensions & Position
        </h3>
        {/* Width / Height */}
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Width
            </span>
            <Input
              type="number"
              value={width}
              onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
              className="h-10 bg-[#222] border-transparent text-white text-xs font-mono font-bold focus:border-[#8b5cf6]"
            />
          </div>
          <button
            onClick={() => setRatioLocked(!ratioLocked)}
            className={cn(
              "flex items-center justify-center p-2 mt-4 transition-colors",
              ratioLocked
                ? "text-[#8b5cf6]"
                : "text-gray-600 hover:text-gray-400",
            )}
          >
            {ratioLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Height
            </span>
            <Input
              type="number"
              value={height}
              onChange={(e) =>
                handleHeightChange(parseInt(e.target.value) || 0)
              }
              className="h-10 bg-[#222] border-transparent text-white text-xs font-mono font-bold focus:border-[#8b5cf6]"
            />
          </div>
        </div>

        {/* X / Y / Rotation */}
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              X
            </span>
            <Input
              type="number"
              value={x}
              onChange={(e) => handleXChange(parseInt(e.target.value) || 0)}
              className="h-10 bg-[#222] border-transparent text-white text-xs font-mono font-bold focus:border-[#8b5cf6]"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Y
            </span>
            <Input
              type="number"
              value={y}
              onChange={(e) => handleYChange(parseInt(e.target.value) || 0)}
              className="h-10 bg-[#222] border-transparent text-white text-xs font-mono font-bold focus:border-[#8b5cf6]"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Rotation
            </span>
            <div className="relative">
              <Input
                type="number"
                value={rotation}
                onChange={(e) =>
                  handleRotationChange(parseInt(e.target.value) || 0)
                }
                className="h-10 bg-[#222] border-transparent text-white text-xs font-mono font-bold focus:border-[#8b5cf6] pr-4"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">
                °
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Transparency
        </h3>
        <div className="space-y-4 px-1">
          <Slider
            value={[opacity]}
            onValueChange={(val) => handleOpacityChange(val[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-gray-500 bg-[#222] p-2 rounded-xl">
            <span className="text-gray-600">0%</span>
            <span className="text-white">{opacity}%</span>
            <span className="text-gray-600">100%</span>
          </div>
        </div>
      </div>

      {/* Color Panel */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Color
        </h3>
        <div className="bg-[#222] rounded-2xl overflow-hidden">
          <div className="flex p-1 gap-1">
            <button
              onClick={() => setColorTab("fill")}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all",
                colorTab === "fill"
                  ? "bg-white text-black"
                  : "text-gray-500 hover:text-gray-300",
              )}
            >
              Fill
            </button>
            <button
              onClick={() => setColorTab("stroke")}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all",
                colorTab === "stroke"
                  ? "bg-white text-black"
                  : "text-gray-500 hover:text-gray-300",
              )}
            >
              Stroke
            </button>
          </div>

          <div className="p-4 space-y-5">
            <ColorPicker
              color={
                colorTab === "fill"
                  ? typeof selectedObject.fill === "string"
                    ? selectedObject.fill
                    : "#000000"
                  : typeof selectedObject.stroke === "string"
                    ? selectedObject.stroke
                    : "#000000"
              }
              onChange={(c) => {
                if (colorTab === "fill") {
                  selectedObject.set({ fill: c });
                } else {
                  selectedObject.set({
                    stroke: c,
                    strokeWidth: selectedObject.strokeWidth || 4,
                  });
                }
                selectedObject.canvas?.requestRenderAll();
                // ensure state updates by forcing an artificial re-render if necessary
                setRadius((r) => r);
              }}
            />
          </div>
        </div>
      </div>

      {/* Corner Radius */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 mb-1 pl-1">
          <BoxSelect className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Corner Radius
          </h3>
        </div>
        <div className="flex items-center gap-4 px-1">
          <Slider
            value={[radius]}
            onValueChange={(val) => handleRadiusChange(val[0])}
            min={0}
            max={200}
            step={1}
            className="flex-1"
          />
          <span className="text-xs font-mono font-bold bg-[#222] px-2 py-1 rounded w-12 text-center text-gray-300">
            {radius}
          </span>
        </div>
      </div>
    </div>
  );
}
