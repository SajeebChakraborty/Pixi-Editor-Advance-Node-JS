"use client";

import { useState, useEffect } from "react";
import { Pipette, Check } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  "#000000",
  "#ffffff",
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#facc15",
  "#a3e635",
  "#4ade80",
  "#34d399",
  "#2dd4bf",
  "#22d3ee",
  "#38bdf8",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#e879f9",
  "#f472b6",
  "#fb7185",
];

const BRAND_PALETTES = [
  {
    brand: "Pixizen",
    colors: [
      { name: "Pixizen Teal", color: "#20B486" },
      { name: "Pixizen Pink", color: "#ec4899" },
      { name: "Pixizen Purple", color: "#8b5cf6" },
      { name: "Pixizen Orange", color: "#f97316" },
    ],
  },
];

export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(color);

  useEffect(() => {
    setInputValue(color);
  }, [color]);

  const handleHexChange = (val: string) => {
    let newColor = val.startsWith("#") ? val : `#${val}`;
    setInputValue(newColor);

    // Validate hex
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(newColor)) {
      onChange(newColor);
    }
  };

  const handleEyeDropper = async () => {
    if (!window.EyeDropper) {
      console.warn("EyeDropper API not supported");
      return;
    }

    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch (e) {
      console.log("EyeDropper cancelled or failed");
    }
  };

  return (
    <div className="space-y-4">
      {label && (
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
          {label}
        </h3>
      )}

      {/* Spectrum Picker */}
      <div className="w-full">
        <HexColorPicker
          color={color}
          onChange={(newColor) => {
            setInputValue(newColor);
            onChange(newColor);
          }}
        />
      </div>

      {/* Hex Input & Pipette */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 relative flex items-center h-11 bg-[#111] rounded-xl border border-white/5 pr-2 focus-within:border-[#8b5cf6]/50 transition-colors">
          <div
            className="w-7 h-7 rounded-lg ml-2 border border-white/10 shadow-inner"
            style={{ backgroundColor: color }}
          />
          <Input
            value={inputValue.toUpperCase()}
            onChange={(e) => handleHexChange(e.target.value)}
            className="h-full bg-transparent border-transparent text-white font-mono text-xs font-bold pl-3 focus-visible:ring-0"
            placeholder="#000000"
          />
          <Button
            onClick={handleEyeDropper}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg shrink-0"
            title="Pick color from screen"
          >
            <Pipette className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="space-y-4 px-1">
        {BRAND_PALETTES.map((palette) => (
          <div key={palette.brand} className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
              Brand colors- {palette.brand}
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {palette.colors.map((bc) => (
                <button
                  key={bc.color}
                  onClick={() => onChange(bc.color)}
                  className={cn(
                    "w-8 h-8 rounded-full ring-2 ring-white/5 cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg relative flex items-center justify-center",
                    color.toLowerCase() === bc.color.toLowerCase() &&
                      "ring-[#8b5cf6] ring-offset-2 ring-offset-[#161616]",
                  )}
                  style={{ backgroundColor: bc.color }}
                  title={bc.name}
                >
                  {color.toLowerCase() === bc.color.toLowerCase() && (
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div className="space-y-3 px-1 pt-2">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Presets
        </h4>
        <div className="grid grid-cols-7 gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cn(
                "w-full aspect-square rounded-lg border border-white/5 cursor-pointer hover:scale-110 active:scale-95 transition-all",
                color.toLowerCase() === c.toLowerCase() &&
                  "ring-2 ring-[#8b5cf6]",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Add EyeDropper type definition for TS
declare global {
  interface Window {
    EyeDropper: any;
  }
}
