"use client";

import { useEditorStore } from "@/lib/store";
import {
  Settings,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from "lucide-react";
import { ImageProperties } from "./properties/image-properties";
import { TextProperties } from "./properties/text-properties";
import { ShapeProperties } from "./properties/shape-properties";
import { CanvasProperties } from "./properties/canvas-properties";
import { VideoProperties } from "./properties/video-properties";
import { Button } from "@/components/ui/button";

export function PropertiesPanel() {
  const {
    canvas: { fabricCanvas },
    getSelectedLayer,
  } = useEditorStore();

  const selectedLayer = getSelectedLayer();
  const selectedObject =
    selectedLayer && fabricCanvas
      ? fabricCanvas
          .getObjects()
          .find((obj) => (obj as any).name === selectedLayer.objectId)
      : null;

  const handleAlign = (type: string) => {
    if (!selectedObject || !fabricCanvas) return;

    const canvasWidth = fabricCanvas.width!;
    const canvasHeight = fabricCanvas.height!;
    const bound = selectedObject.getBoundingRect();
    const objWidth = bound.width;
    const objHeight = bound.height;

    const objLeft = selectedObject.left || 0;
    const objTop = selectedObject.top || 0;

    // Calculate the distance from the bounding box edge to the object's origin
    const offsetX = objLeft - bound.left;
    const offsetY = objTop - bound.top;

    switch (type) {
      case "left":
        selectedObject.set({ left: 0 + offsetX });
        break;
      case "centerH":
        selectedObject.set({ left: (canvasWidth - objWidth) / 2 + offsetX });
        break;
      case "right":
        selectedObject.set({ left: canvasWidth - objWidth + offsetX });
        break;
      case "top":
        selectedObject.set({ top: 0 + offsetY });
        break;
      case "centerV":
        selectedObject.set({ top: (canvasHeight - objHeight) / 2 + offsetY });
        break;
      case "bottom":
        selectedObject.set({ top: canvasHeight - objHeight + offsetY });
        break;
    }

    selectedObject.setCoords();
    fabricCanvas.requestRenderAll();
  };

  if (!selectedLayer || !selectedObject) {
    return <CanvasProperties />;
  }

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white dark">
      <div className="flex flex-col gap-8">
        {/* Alignment Controls */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
            Alignment
          </h3>
          <div className="grid grid-cols-7 gap-1">
            <Button
              onClick={() => handleAlign("left")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => handleAlign("centerH")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => handleAlign("right")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-center">
              <div className="w-px h-5 bg-white/10" />
            </div>
            <Button
              onClick={() => handleAlign("top")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignStartVertical className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => handleAlign("centerV")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignCenterVertical className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => handleAlign("bottom")}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
            >
              <AlignEndVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Dynamic Contextual Properties */}
        <div className="flex-1">
          {selectedLayer.type === "image" && (
            <ImageProperties selectedObject={selectedObject as any} />
          )}

          {selectedLayer.type === "text" && (
            <TextProperties selectedObject={selectedObject as any} />
          )}

          {selectedLayer.type === "video" && (
            <VideoProperties selectedObject={selectedObject as any} />
          )}

          {(selectedLayer.type === "sticker" ||
            selectedLayer.type === "shape") && (
            <ShapeProperties selectedObject={selectedObject as any} />
          )}
        </div>
      </div>
    </div>
  );
}
