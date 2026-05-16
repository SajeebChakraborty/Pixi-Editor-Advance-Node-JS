"use client";

import { useState, useEffect } from "react";
import { FabricObject } from "fabric";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Link2,
  Pipette,
  Copy,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";

interface ShapePropertiesProps {
  selectedObject: FabricObject;
}

export function ShapeProperties({ selectedObject }: ShapePropertiesProps) {
  const [opacity, setOpacity] = useState(100);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [ratioLocked, setRatioLocked] = useState(true);
  const [colorTab, setColorTab] = useState<"fill" | "stroke">("fill");

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

  const applyColor = (color: string) => {
    const isGroup = selectedObject.type === "group";

    if (isGroup) {
      const group = selectedObject as any;
      group.forEachObject((obj: any) => {
        if (colorTab === "fill") {
          obj.set({ fill: color });
        } else {
          obj.set({ stroke: color, strokeWidth: 2 });
        }
      });
    } else {
      if (colorTab === "fill") {
        selectedObject.set({ fill: color });
      } else {
        selectedObject.set({ stroke: color, strokeWidth: 4 });
      }
    }
    selectedObject.set({ dirty: true });
    selectedObject.canvas?.requestRenderAll();
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Alignment / Dimensions */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          Dimensions & Position
        </h3>
        {/* Width / Height */}
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Width
            </span>
            <Input
              type="number"
              value={width}
              onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
              className="h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6] placeholder:text-gray-700"
            />
          </div>
          <button
            onClick={() => setRatioLocked(!ratioLocked)}
            className={cn(
              "flex items-center justify-center p-2 mt-6 transition-colors rounded-lg",
              ratioLocked
                ? "bg-[#8b5cf6]/10 text-[#8b5cf6]"
                : "text-gray-600 hover:text-gray-400",
            )}
          >
            <Link2 className="w-4 h-4" />
          </button>
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Height
            </span>
            <Input
              type="number"
              value={height}
              onChange={(e) =>
                handleHeightChange(parseInt(e.target.value) || 0)
              }
              className="h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6] placeholder:text-gray-700"
            />
          </div>
        </div>

        {/* X / Y / Rotation */}
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              X
            </span>
            <Input
              type="number"
              value={x}
              onChange={(e) => handleXChange(parseInt(e.target.value) || 0)}
              className="h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6]"
            />
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Y
            </span>
            <Input
              type="number"
              value={y}
              onChange={(e) => handleYChange(parseInt(e.target.value) || 0)}
              className="h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6]"
            />
          </div>
          <div className="flex-1 space-y-2">
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
                className="h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6] pr-6"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">
                °
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency */}
      <div className="space-y-5">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          Transparency
        </h3>
        <div className="space-y-4 px-1">
          <div className="flex items-center gap-4">
            <Slider
              value={[opacity]}
              onValueChange={(val) => handleOpacityChange(val[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <div className="w-14 h-9 bg-[#111] rounded-lg border border-white/5 flex items-center justify-center">
              <span className="text-xs font-bold text-white tabular-nums">
                {opacity}%
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-bold text-gray-600 uppercase tracking-tighter px-1">
            <span>Opaque</span>
            <span>Transparent</span>
          </div>
        </div>
      </div>

      {/* Color Panel */}
      <div className="space-y-5">
        <div className="flex bg-[#111] p-1 rounded-xl gap-1 mx-1">
          <button
            onClick={() => setColorTab("fill")}
            className={cn(
              "flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2",
              colorTab === "fill"
                ? "bg-white text-black shadow-lg"
                : "text-gray-500 hover:text-gray-300",
            )}
          >
            <div className="w-3 h-3 rounded-sm bg-current" /> Fill
          </button>
          <button
            onClick={() => setColorTab("stroke")}
            className={cn(
              "flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2",
              colorTab === "stroke"
                ? "bg-white text-black shadow-lg"
                : "text-gray-500 hover:text-gray-300",
            )}
          >
            <div className="w-3 h-3 rounded-sm border-2 border-current" />{" "}
            Stroke
          </button>
        </div>

        <ColorPicker
          color={
            ((colorTab === "fill"
              ? selectedObject.fill
              : selectedObject.stroke) as string) || "#000000"
          }
          onChange={applyColor}
        />
      </div>
    </div>
  );
}
