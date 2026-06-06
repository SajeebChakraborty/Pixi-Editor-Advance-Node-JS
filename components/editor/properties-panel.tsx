"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import { ImageProperties } from "./properties/image-properties";
import { TextProperties } from "./properties/text-properties";
import { ShapeProperties } from "./properties/shape-properties";
import { CanvasProperties } from "./properties/canvas-properties";
import { VideoProperties } from "./properties/video-properties";
import { PenProperties } from "./properties/pen-properties";
import { Button } from "@/components/ui/button";
import { commitCanvasHistory } from "@/lib/editor-actions";
import { setVideoOverlayVisibility } from "@/lib/video-overlay";

export function PropertiesPanel() {
  const {
    canvas: { fabricCanvas, width: canvasWidth, height: canvasHeight },
    activeCanvasTool,
    getSelectedLayer,
    getLayers,
    selectLayer,
    updateLayer,
    duplicateLayer,
    deleteLayer,
  } = useEditorStore();

  const storeSelectedLayer = getSelectedLayer();
  const activeObject = fabricCanvas?.getActiveObject() || null;
  const layers = getLayers();
  const activeObjectLayer =
    activeObject && (activeObject as any).name
      ? layers.find((layer) => layer.objectId === (activeObject as any).name)
      : undefined;
  const storeSelectedObject =
    storeSelectedLayer && fabricCanvas
      ? fabricCanvas
          .getObjects()
          .find((obj) => (obj as any).name === storeSelectedLayer.objectId)
      : null;
  const selectedLayer = activeObject
    ? activeObjectLayer
    : storeSelectedLayer && storeSelectedObject
      ? storeSelectedLayer
      : undefined;
  const selectedObject = activeObject || storeSelectedObject || null;

  useEffect(() => {
    if (
      activeObjectLayer &&
      (!storeSelectedLayer || storeSelectedLayer.id !== activeObjectLayer.id)
    ) {
      selectLayer(activeObjectLayer.id);
      return;
    }

    if (activeObject && !activeObjectLayer && storeSelectedLayer) {
      selectLayer(null);
    }
  }, [storeSelectedLayer, activeObject, activeObjectLayer, selectLayer]);

  if (activeCanvasTool === "pen") {
    return (
      <div className="flex flex-col h-full bg-[#000000] text-white dark">
        <div className="flex flex-col gap-6 p-4">
          <PenProperties />
          <CanvasProperties />
        </div>
      </div>
    );
  }

  const handleToggleVisible = () => {
    if (!selectedLayer || !selectedObject || !fabricCanvas) return;
    const nextVisible = selectedLayer.visible === false;

    updateLayer(selectedLayer.id, { visible: nextVisible });
    selectedObject.set("visible", nextVisible);
    setVideoOverlayVisibility(selectedObject as any, nextVisible);

    if (nextVisible) {
      fabricCanvas.setActiveObject(selectedObject);
    }
    fabricCanvas.requestRenderAll();
    commitCanvasHistory(fabricCanvas);
  };

  const handleToggleLocked = () => {
    if (!selectedLayer || !selectedObject || !fabricCanvas) return;
    const nextLocked = !selectedLayer.locked;
    updateLayer(selectedLayer.id, { locked: nextLocked });
    selectedObject.set({
      selectable: true,
      evented: true,
      lockMovementX: nextLocked,
      lockMovementY: nextLocked,
      lockRotation: nextLocked,
      lockScalingX: nextLocked,
      lockScalingY: nextLocked,
      hasControls: !nextLocked,
      hoverCursor: nextLocked ? "not-allowed" : "move",
    });
    fabricCanvas.setActiveObject(selectedObject);
    fabricCanvas.requestRenderAll();
    commitCanvasHistory(fabricCanvas);
  };

  const handleDelete = () => {
    if (!selectedLayer) return;
    deleteLayer(selectedLayer.id);
    commitCanvasHistory(fabricCanvas);
  };

  const handleDuplicate = () => {
    if (!selectedLayer) return;
    duplicateLayer(selectedLayer.id);
  };

  const alignSelection = (
    alignment:
      | "left"
      | "centerX"
      | "right"
      | "top"
      | "centerY"
      | "bottom",
  ) => {
    if (!selectedObject || !fabricCanvas) return;

    const bounds = selectedObject.getBoundingRect();
    let deltaX = 0;
    let deltaY = 0;

    if (alignment === "left") deltaX = -bounds.left;
    if (alignment === "centerX")
      deltaX = canvasWidth / 2 - (bounds.left + bounds.width / 2);
    if (alignment === "right")
      deltaX = canvasWidth - (bounds.left + bounds.width);
    if (alignment === "top") deltaY = -bounds.top;
    if (alignment === "centerY")
      deltaY = canvasHeight / 2 - (bounds.top + bounds.height / 2);
    if (alignment === "bottom")
      deltaY = canvasHeight - (bounds.top + bounds.height);

    selectedObject.set({
      left: (selectedObject.left || 0) + deltaX,
      top: (selectedObject.top || 0) + deltaY,
    });
    selectedObject.setCoords();

    if ((selectedObject as any)._objects) {
      (selectedObject as any)._objects.forEach((obj: any) => obj.setCoords?.());
    }

    fabricCanvas.requestRenderAll();
    commitCanvasHistory(fabricCanvas);
  };

  if (!selectedObject) {
    return <CanvasProperties />;
  }

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white dark">
      <div className="flex flex-col gap-8">
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
            Align
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => alignSelection("left")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align left"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => alignSelection("centerX")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align horizontal center"
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => alignSelection("right")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align right"
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => alignSelection("top")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align top"
            >
              <AlignJustify className="w-4 h-4 rotate-90" />
            </Button>
            <Button
              onClick={() => alignSelection("centerY")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align vertical center"
            >
              <AlignHorizontalSpaceAround className="w-4 h-4 rotate-90" />
            </Button>
            <Button
              onClick={() => alignSelection("bottom")}
              variant="outline"
              size="icon"
              className="h-9 bg-transparent border-white/10 hover:bg-white/10 text-gray-300"
              title="Align bottom"
            >
              <AlignJustify className="w-4 h-4 -rotate-90" />
            </Button>
          </div>
        </div>

        {/* Arrange Controls */}
        {selectedLayer && (
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-1">
              Arrange
            </h3>
            <div className="grid grid-cols-4 gap-1">
              <Button
                onClick={handleDuplicate}
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleToggleVisible}
                variant="outline"
                size="icon"
                className={
                  selectedLayer.visible === false
                    ? "h-8 w-8 border-amber-400/50 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                    : "h-8 w-8 border-transparent bg-transparent text-gray-400 hover:bg-white/10 hover:text-white"
                }
                title={
                  selectedLayer.visible === false
                    ? "Layer hidden - click to show"
                    : "Layer visible - click to hide"
                }
                aria-label={
                  selectedLayer.visible === false ? "Show layer" : "Hide layer"
                }
              >
                {selectedLayer.visible === false ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
              <Button
                onClick={handleToggleLocked}
                variant="outline"
                size="icon"
                className={
                  selectedLayer.locked
                    ? "h-8 w-8 border-violet-400/60 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                    : "h-8 w-8 border-transparent bg-transparent text-gray-400 hover:bg-white/10 hover:text-white"
                }
                title={
                  selectedLayer.locked
                    ? "Layer locked - click to unlock"
                    : "Layer unlocked - click to lock"
                }
                aria-label={
                  selectedLayer.locked ? "Unlock layer" : "Lock layer"
                }
              >
                {selectedLayer.locked ? (
                  <Lock className="w-4 h-4 fill-current/20" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </Button>
              <Button
                onClick={handleDelete}
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-transparent hover:bg-red-500/10 text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Dynamic Contextual Properties */}
        <div className="flex-1">
          {selectedLayer?.type === "image" && (
            <ImageProperties selectedObject={selectedObject as any} />
          )}

          {selectedLayer?.type === "text" && (
            <TextProperties selectedObject={selectedObject as any} />
          )}

          {selectedLayer?.type === "video" && (
            <VideoProperties
              key={selectedLayer.id}
              selectedObject={selectedObject as any}
            />
          )}

          {(selectedLayer?.type === "sticker" ||
            selectedLayer?.type === "shape") && (
            <ShapeProperties selectedObject={selectedObject as any} />
          )}

          {!selectedLayer && <CanvasProperties />}
        </div>
      </div>
    </div>
  );
}
