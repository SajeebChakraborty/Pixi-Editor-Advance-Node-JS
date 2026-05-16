import { useEditorStore, CANVAS_PRESETS, CanvasPreset } from "@/lib/store";
import { Copy, Trash2, Monitor, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ColorPicker } from "./color-picker";

export function CanvasProperties() {
  const {
    canvas: { width, height, preset, pages, activePageId, fabricCanvas },
    setCanvas,
    setCanvasPreset,
    addPage,
    deletePage,
    duplicatePage,
    reorderPage,
    setActivePage,
  } = useEditorStore();

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setCanvas({ width: val });
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setCanvas({ height: val });
    }
  };

  const handlePresetChange = (val: string) => {
    setCanvasPreset(val as CanvasPreset);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Dimensions & Preset */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          Canvas Size
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Width</Label>
              <Input
                type="number"
                value={width}
                onChange={handleWidthChange}
                className="bg-white/5 border-white/10 text-white h-8 text-xs focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Height</Label>
              <Input
                type="number"
                value={height}
                onChange={handleHeightChange}
                className="bg-white/5 border-white/10 text-white h-8 text-xs focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-8 text-xs">
              <SelectValue placeholder="Select preset" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CANVAS_PRESETS).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  {data.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Background Color */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1">
          Background
        </h3>
        <div className="px-1">
          <ColorPicker
            color={(fabricCanvas?.backgroundColor as string) || "#ffffff"}
            onChange={(color: string) => {
              if (fabricCanvas) {
                fabricCanvas.set({ backgroundColor: color });
                fabricCanvas.renderAll();
              }
            }}
          />
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Page Manager */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Pages ({pages.length})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addPage()}
            className="h-6 px-2 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10"
          >
            + Add Page
          </Button>
        </div>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {pages.map((page, index) => {
            const isActive = page.id === activePageId;
            return (
              <div
                key={page.id}
                className={`group flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  isActive
                    ? "bg-indigo-500/10 border-indigo-500/50"
                    : "bg-white/5 border-transparent hover:bg-white/10"
                }`}
                onClick={() => setActivePage(page.id)}
              >
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? "bg-indigo-500 text-white"
                      : "bg-white/10 text-gray-400"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      isActive ? "text-white" : "text-gray-400"
                    }`}
                  >
                    {page.name}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {page.layers.length} layers
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 text-gray-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderPage(page.id, "up");
                      }}
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 text-gray-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderPage(page.id, "down");
                      }}
                      disabled={index === pages.length - 1}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePage(page.id);
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePage(page.id);
                    }}
                    disabled={pages.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
