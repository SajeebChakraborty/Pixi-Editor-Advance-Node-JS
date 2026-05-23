"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/lib/store";
import { Eraser, Pencil, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function PenProperties() {
  const { penSettings, setPenSettings } = useEditorStore();
  const intensity = Math.round((penSettings.width / 80) * 100);

  const handleDrawingUndo = () => {
    window.dispatchEvent(new CustomEvent("editor:drawing-undo"));
  };

  const handleDrawingRedo = () => {
    window.dispatchEvent(new CustomEvent("editor:drawing-redo"));
  };

  return (
    <div className="space-y-5 rounded-xl border border-white/10 bg-[#111] p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        Draw Brush
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPenSettings({ mode: "brush" })}
          className={cn(
            "flex h-9 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-colors",
            penSettings.mode === "brush"
              ? "border-[#8b5cf6] bg-[#8b5cf6]/20 text-white"
              : "border-white/10 bg-[#1b1b1b] text-gray-400 hover:text-white",
          )}
        >
          <Pencil className="h-4 w-4" />
          Brush
        </button>
        <button
          type="button"
          onClick={() => setPenSettings({ mode: "eraser" })}
          className={cn(
            "flex h-9 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-colors",
            penSettings.mode === "eraser"
              ? "border-[#8b5cf6] bg-[#8b5cf6]/20 text-white"
              : "border-white/10 bg-[#1b1b1b] text-gray-400 hover:text-white",
          )}
        >
          <Eraser className="h-4 w-4" />
          Eraser
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleDrawingUndo}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#1b1b1b] text-xs font-bold text-gray-300 transition-colors hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Undo
        </button>
        <button
          type="button"
          onClick={handleDrawingRedo}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#1b1b1b] text-xs font-bold text-gray-300 transition-colors hover:text-white"
        >
          <RotateCw className="h-4 w-4" />
          Redo
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400">
          <span>Thickness</span>
          <span className="font-mono text-gray-200">{penSettings.width}px</span>
        </div>
        <Slider
          value={[penSettings.width]}
          min={1}
          max={80}
          step={1}
          onValueChange={(next) => setPenSettings({ width: next[0] })}
          onValueCommit={(next) => setPenSettings({ width: next[0] })}
        />
        <div className="rounded-lg border border-white/10 bg-[#161616] p-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-gray-500">
            <span>Intensity</span>
            <span>{intensity}%</span>
          </div>
          <div className="flex h-10 items-center justify-center">
            <div
              className="rounded-full mb-2"
              style={{
                width: Math.min(56, Math.max(8, penSettings.width * 0.9)),
                height: Math.min(56, Math.max(8, penSettings.width * 0.9)),
                background:
                  penSettings.mode === "eraser" ? "#e5e7eb" : penSettings.color,
                opacity: penSettings.mode === "eraser" ? 0.9 : 1,
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="pl-1 text-[10px] font-bold uppercase text-gray-400">
          Color
        </span>
        <Input
          type="color"
          value={penSettings.color}
          onChange={(event) => setPenSettings({ color: event.target.value })}
          disabled={penSettings.mode === "eraser"}
          className="h-10 bg-[#222] p-1"
        />
      </div>
    </div>
  );
}
