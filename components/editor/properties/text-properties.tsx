"use client";

import { IText } from "fabric";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Type,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Pipette,
  Expand,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEXT_PROPERTIES_FONT_OPTIONS } from "@/lib/editor-fonts";

interface TextPropertiesProps {
  selectedObject: IText;
}

export function TextProperties({ selectedObject }: TextPropertiesProps) {
  const [fontSize, setFontSize] = useState(selectedObject.fontSize as number);
  const [fontFamily, setFontFamily] = useState(
    (selectedObject.fontFamily as string) || "Roboto",
  );
  const [fontWeight, setFontWeight] = useState(
    (selectedObject.fontWeight as string) || "normal",
  );
  const [textAlign, setTextAlign] = useState(
    (selectedObject.textAlign as string) || "left",
  );
  const [colorTab, setColorTab] = useState<"fill" | "stroke">("fill");

  /* New State for Position */
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotation, setRotation] = useState(0);

  /* Listener for updates */
  useEffect(() => {
    const updateLocalState = () => {
      setX(Math.round(selectedObject.left || 0));
      setY(Math.round(selectedObject.top || 0));
      setRotation(Math.round(selectedObject.angle || 0));
      // Sync Font properties if changed via scaling or externally
      setFontSize(
        Math.round(
          selectedObject.get("fontSize") * (selectedObject.scaleX || 1),
        ),
      );
      setFontFamily((selectedObject.fontFamily as string) || "Roboto");
      setFontWeight((selectedObject.fontWeight as string) || "normal");
    };

    updateLocalState();
    selectedObject.on("moving", updateLocalState);
    selectedObject.on("rotating", updateLocalState);
    selectedObject.on("scaling", updateLocalState);
    selectedObject.on("modified", updateLocalState);

    return () => {
      selectedObject.off("moving", updateLocalState);
      selectedObject.off("rotating", updateLocalState);
      selectedObject.off("scaling", updateLocalState);
      selectedObject.off("modified", updateLocalState);
    };
  }, [selectedObject]);

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

  const applyChanges = (updates: Record<string, any>) => {
    selectedObject.set(updates);
    selectedObject.canvas?.renderAll();
  };

  return (
    <div className="space-y-8">
      {/* Position & Rotation */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Position & Rotation
        </h3>
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
          <div className="flex items-center gap-4">
            <Slider
              value={[(selectedObject.opacity || 1) * 100]}
              onValueChange={(val) => applyChanges({ opacity: val[0] / 100 })}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <div className="w-14 h-9 bg-[#222] rounded-lg border border-white/5 flex items-center justify-center">
              <span className="text-xs font-bold text-white tabular-nums">
                {Math.round((selectedObject.opacity || 1) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Color Section */}
      <div className="space-y-4">
        <div className="bg-[#222] rounded-2xl overflow-hidden p-1">
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

          <div className="p-3">
            <ColorPicker
              color={
                ((colorTab === "fill"
                  ? selectedObject.fill
                  : selectedObject.stroke) as string) ||
                (colorTab === "fill" ? "#000000" : "transparent")
              }
              onChange={(c: string) =>
                applyChanges({
                  [colorTab === "fill" ? "fill" : "stroke"]: c,
                  [colorTab === "stroke" ? "strokeWidth" : ""]:
                    colorTab === "stroke" ? 2 : undefined,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Typography Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Typography
        </h3>

        <div className="space-y-3">
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-gray-400 z-10">
              <Type className="w-4 h-4" />
            </div>
            <Select
              value={fontFamily}
              onValueChange={(val) => {
                setFontFamily(val);
                applyChanges({ fontFamily: val });
              }}
            >
              <SelectTrigger className="w-full h-11 bg-[#222] hover:bg-[#2a2a2a] pl-10 pr-4 flex items-center justify-between rounded-xl cursor-pointer transition-colors border-transparent focus:ring-0 focus:border-[#8b5cf6] text-sm font-bold text-white shadow-none">
                <SelectValue placeholder="Font Family" />
              </SelectTrigger>
              <SelectContent className="bg-[#222] text-white border-white/10 rounded-xl">
                {TEXT_PROPERTIES_FONT_OPTIONS.map((font) => (
                  <SelectItem
                    key={font}
                    value={font}
                    className="focus:bg-white/10 cursor-pointer"
                  >
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex-[2] relative group">
              <Select
                value={fontWeight.toString()}
                onValueChange={(val) => {
                  setFontWeight(val);
                  applyChanges({ fontWeight: val });
                }}
              >
                <SelectTrigger className="w-full h-11 bg-[#222] hover:bg-[#2a2a2a] px-4 flex items-center justify-between rounded-xl cursor-pointer border-transparent shadow-none focus:ring-0 text-xs font-bold text-white">
                  <SelectValue placeholder="Weight" />
                </SelectTrigger>
                <SelectContent className="bg-[#222] text-white border-white/10 rounded-xl">
                  {["normal", "bold"].map((w) => (
                    <SelectItem
                      key={w}
                      value={w}
                      className="focus:bg-white/10 cursor-pointer capitalize"
                    >
                      {w === "normal" ? "Regular" : "Bold"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                value={fontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setFontSize(val);
                  applyChanges({ fontSize: val });
                }}
                className="h-11 bg-[#222] border-transparent text-white text-sm font-mono font-bold text-center rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 pt-2 border-t border-white/5">
            {[
              { icon: AlignLeft, value: "left" },
              { icon: AlignCenter, value: "center" },
              { icon: AlignRight, value: "right" },
              { icon: AlignJustify, value: "justify" },
              { icon: List, value: "list" },
              { icon: ListOrdered, value: "ordered" },
            ].map((item) => (
              <Button
                key={item.value}
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (item.value !== "list" && item.value !== "ordered") {
                    setTextAlign(item.value);
                    applyChanges({ textAlign: item.value });
                  }
                }}
                className={cn(
                  "h-10 w-full rounded-lg bg-[#222] hover:bg-white/10",
                  textAlign === item.value
                    ? "text-[#8b5cf6] bg-white/5"
                    : "text-gray-500",
                )}
              >
                <item.icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
