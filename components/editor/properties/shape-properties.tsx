"use client";

import { useState, useEffect } from "react";
import { FabricObject } from "fabric";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Link2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { commitCanvasHistory } from "@/lib/editor-actions";

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
  const [fillColor, setFillColor] = useState("#C4C4C4");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [hasFill, setHasFill] = useState(true);
  const [hasStroke, setHasStroke] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(0);

  const isImageLike =
    selectedObject.type === "image" ||
    selectedObject.type === "video" ||
    selectedObject.type === "fabricimage";
  const canEditFillStroke = !isImageLike;

  const normalizeColor = (value: unknown, fallback: string) => {
    if (typeof value !== "string") return fallback;
    if (/^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value)) return value;

    const rgb = value.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
    );
    if (!rgb) return fallback;

    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((channel) =>
        Math.max(0, Math.min(255, Number(channel)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  };

  const isVisiblePaint = (value: unknown) =>
    Boolean(value && value !== "transparent" && value !== "rgba(0,0,0,0)");

  const getFirstPaintableObject = () => {
    if (selectedObject.type !== "group") return selectedObject as any;
    return (selectedObject as any)
      .getObjects?.()
      ?.find((obj: any) => obj.type !== "image" && obj.type !== "video");
  };

  useEffect(() => {
    const updateLocalState = () => {
      const paintSource = getFirstPaintableObject();
      setWidth(Math.round(selectedObject.getScaledWidth()));
      setHeight(Math.round(selectedObject.getScaledHeight()));
      setX(Math.round(selectedObject.left || 0));
      setY(Math.round(selectedObject.top || 0));
      setRotation(Math.round(selectedObject.angle || 0));
      setOpacity(Math.round((selectedObject.opacity || 1) * 100));

      if (paintSource) {
        const nextFillVisible = isVisiblePaint(paintSource.fill);
        const nextStrokeWidth = Number(paintSource.strokeWidth || 0);
        const nextStrokeVisible =
          isVisiblePaint(paintSource.stroke) && nextStrokeWidth > 0;

        setHasFill(nextFillVisible);
        setHasStroke(nextStrokeVisible);
        setStrokeWidth(nextStrokeWidth);
        if (nextFillVisible) {
          setFillColor((prev) => normalizeColor(paintSource.fill, prev));
        }
        if (isVisiblePaint(paintSource.stroke)) {
          setStrokeColor((prev) => normalizeColor(paintSource.stroke, prev));
        }
      }
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

  const updatePaintableObjects = (updater: (obj: any) => void) => {
    if (selectedObject.type === "group") {
      (selectedObject as any).forEachObject((obj: any) => {
        if (obj.type !== "image" && obj.type !== "video") updater(obj);
      });
    } else {
      updater(selectedObject as any);
    }

    selectedObject.set({ dirty: true });
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const applyColor = (color: string) => {
    if (!canEditFillStroke) return;

    updatePaintableObjects((obj) => {
      if (colorTab === "fill") {
        obj.set({ fill: color });
      } else {
        obj.set({
          stroke: color,
          strokeWidth: Math.max(Number(obj.strokeWidth || 0), 2),
        });
      }
    });

    if (colorTab === "fill") {
      setFillColor(color);
      setHasFill(true);
    } else {
      setStrokeColor(color);
      setHasStroke(true);
      setStrokeWidth((prev) => Math.max(prev, 2));
    }
  };

  const togglePaint = (kind: "fill" | "stroke", enabled: boolean) => {
    if (!canEditFillStroke) return;

    updatePaintableObjects((obj) => {
      if (kind === "fill") {
        obj.set({ fill: enabled ? fillColor : "transparent" });
      } else {
        obj.set({
          stroke: enabled ? strokeColor : "transparent",
          strokeWidth: enabled ? Math.max(strokeWidth || 0, 2) : 0,
        });
      }
    });

    if (kind === "fill") {
      setHasFill(enabled);
    } else {
      setHasStroke(enabled);
      setStrokeWidth(enabled ? Math.max(strokeWidth || 0, 2) : 0);
    }

    commitCanvasHistory(selectedObject.canvas);
  };

  const handleStrokeWidthChange = (val: number) => {
    const nextWidth = Math.max(0, Math.min(100, Math.round(val)));
    setStrokeWidth(nextWidth);
    setHasStroke(nextWidth > 0);

    updatePaintableObjects((obj) => {
      obj.set({
        stroke: nextWidth > 0 ? strokeColor : "transparent",
        strokeWidth: nextWidth,
      });
    });
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
            <DraftNumberInput value={width} onCommit={handleWidthChange} />
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
            <DraftNumberInput value={height} onCommit={handleHeightChange} />
          </div>
        </div>

        {/* X / Y / Rotation */}
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              X
            </span>
            <DraftNumberInput value={x} onCommit={handleXChange} />
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Y
            </span>
            <DraftNumberInput value={y} onCommit={handleYChange} />
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-tight">
              Rotation
            </span>
            <div className="relative">
              <DraftNumberInput
                value={rotation}
                onCommit={handleRotationChange}
                className="pr-6"
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
      {canEditFillStroke ? (
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
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-sm border border-black/10",
                  !hasFill && "bg-transparent",
                )}
                style={{ backgroundColor: hasFill ? fillColor : "transparent" }}
              >
                {!hasFill && <Ban className="w-3 h-3 text-current" />}
              </div>
              Fill
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
              <div
                className="w-3.5 h-3.5 rounded-sm border-2"
                style={{
                  borderColor: hasStroke ? strokeColor : "currentColor",
                }}
              >
                {!hasStroke && <Ban className="w-3 h-3 text-current" />}
              </div>
              Stroke
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 px-1">
            <button
              onClick={() => togglePaint(colorTab, true)}
              className={cn(
                "h-9 rounded-lg border text-[10px] font-black uppercase transition-all",
                (colorTab === "fill" ? hasFill : hasStroke)
                  ? "bg-white text-black border-white"
                  : "bg-[#111] text-gray-400 border-white/10 hover:text-white",
              )}
            >
              Color
            </button>
            <button
              onClick={() => togglePaint(colorTab, false)}
              className={cn(
                "h-9 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                !(colorTab === "fill" ? hasFill : hasStroke)
                  ? "bg-white text-black border-white"
                  : "bg-[#111] text-gray-400 border-white/10 hover:text-white",
              )}
            >
              <Ban className="w-3.5 h-3.5" />
              None
            </button>
          </div>

          {colorTab === "stroke" && (
            <div className="space-y-3 px-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Stroke width
                </span>
                <Input
                  type="number"
                  value={strokeWidth}
                  min={0}
                  max={100}
                  onChange={(event) =>
                    handleStrokeWidthChange(parseInt(event.target.value) || 0)
                  }
                  onBlur={() => commitCanvasHistory(selectedObject.canvas)}
                  className="h-8 w-16 bg-[#111] border-white/10 text-white text-xs font-bold rounded-lg"
                />
              </div>
              <Slider
                value={[strokeWidth]}
                min={0}
                max={40}
                step={1}
                onValueChange={(val) => handleStrokeWidthChange(val[0])}
                onValueCommit={() => commitCanvasHistory(selectedObject.canvas)}
              />
            </div>
          )}

          <ColorPicker
            color={colorTab === "fill" ? fillColor : strokeColor}
            onChange={applyColor}
            onCommit={() => commitCanvasHistory(selectedObject.canvas)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#111] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Image sticker
          </p>
          <p className="mt-2 text-xs font-medium text-gray-400">
            Fill and stroke are unavailable for this object.
          </p>
        </div>
      )}
    </div>
  );
}

function DraftNumberInput({
  value,
  onCommit,
  className,
}: {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
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

    onCommit(Math.round(next));
  };

  return (
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
      className={cn(
        "h-11 bg-[#111] border-transparent text-white text-[12px] font-bold rounded-xl focus:border-[#8b5cf6] placeholder:text-gray-700",
        className,
      )}
    />
  );
}
