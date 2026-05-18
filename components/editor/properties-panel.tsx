"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import {
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

export function PropertiesPanel() {
  const {
    canvas: { fabricCanvas },
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
  const selectedLayer =
    storeSelectedLayer && storeSelectedObject
      ? storeSelectedLayer
      : activeObjectLayer;
  const selectedObject =
    storeSelectedLayer && storeSelectedObject
      ? storeSelectedObject
      : activeObjectLayer
        ? activeObject
        : null;

  useEffect(() => {
    if (
      activeObjectLayer &&
      (!storeSelectedLayer || storeSelectedLayer.id !== activeObjectLayer.id)
    ) {
      selectLayer(activeObjectLayer.id);
    }
  }, [storeSelectedLayer, activeObjectLayer, selectLayer]);

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
    const nextVisible = !selectedLayer.visible;
    updateLayer(selectedLayer.id, { visible: nextVisible });
    selectedObject.set("visible", nextVisible);
    if (nextVisible) fabricCanvas.setActiveObject(selectedObject);
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

  if (!selectedLayer || !selectedObject) {
    return <CanvasProperties />;
  }

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white dark">
      <div className="flex flex-col gap-8">
        {/* Arrange Controls */}
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
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
              title={selectedLayer.visible ? "Hide" : "Show"}
            >
              {selectedLayer.visible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={handleToggleLocked}
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent border-transparent hover:bg-white/10 text-gray-400"
              title={selectedLayer.locked ? "Unlock" : "Lock"}
            >
              {selectedLayer.locked ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
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
