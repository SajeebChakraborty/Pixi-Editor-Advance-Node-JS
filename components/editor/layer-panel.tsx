"use client";

import { useEditorStore, type Layer } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  MoreVertical,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { commitCanvasHistory } from "@/lib/editor-actions";

export function LayerPanel() {
  const {
    getLayers,
    canvas: { selectedLayerId },
    selectLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    reorderLayer,
    moveLayer,
    renameLayer,
  } = useEditorStore();

  const layers = getLayers();

  const handleToggleVisible = (layerId: string, currentVisible: boolean) => {
    const layer = layers.find((l) => l.id === layerId);
    const nextVisible = !currentVisible;
    updateLayer(layerId, { visible: nextVisible });

    const { fabricCanvas } = useEditorStore.getState().canvas;
    if (fabricCanvas && layer?.objectId) {
      const obj = fabricCanvas
        .getObjects()
        .find((o) => (o as any).name === layer.objectId);
      if (obj) {
        obj.set("visible", nextVisible);
        if (nextVisible) fabricCanvas.setActiveObject(obj);
        fabricCanvas.renderAll();
        commitCanvasHistory(fabricCanvas);
      }
    }
  };

  const handleToggleLocked = (layerId: string, currentLocked: boolean) => {
    const layer = layers.find((l) => l.id === layerId);
    const nextLocked = !currentLocked;
    updateLayer(layerId, { locked: nextLocked });

    const { fabricCanvas } = useEditorStore.getState().canvas;
    if (fabricCanvas && layer?.objectId) {
      const obj = fabricCanvas
        .getObjects()
        .find((o) => (o as any).name === layer.objectId);
      if (obj) {
        obj.set({
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
        fabricCanvas.setActiveObject(obj);
        fabricCanvas.renderAll();
        commitCanvasHistory(fabricCanvas);
      }
    }
  };

  const handleSelectLayer = (layerId: string) => {
    selectLayer(layerId);
    const { fabricCanvas } = useEditorStore.getState().canvas;
    if (fabricCanvas) {
      const layer = layers.find((l) => l.id === layerId);
      if (layer) {
        const obj = fabricCanvas
          .getObjects()
          .find((o) => (o as any).name === layer.objectId);
        if (obj) {
          fabricCanvas.setActiveObject(obj);
          fabricCanvas.renderAll();
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161616] text-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Layer Stack
        </h3>
        <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
          {layers.length}
        </span>
      </div>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {layers.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
              <EyeOff className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-xs font-medium leading-relaxed">
              No active layers.
              <br />
              Add elements to begin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col-reverse p-3 gap-2">
            {layers.map((layer, index) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerId === layer.id}
                index={index}
                totalLayers={layers.length}
                onSelect={() => handleSelectLayer(layer.id)}
                onToggleVisible={() =>
                  handleToggleVisible(layer.id, layer.visible)
                }
                onToggleLocked={() =>
                  handleToggleLocked(layer.id, layer.locked)
                }
                onDuplicate={() => duplicateLayer(layer.id)}
                onDelete={() => {
                  deleteLayer(layer.id);
                  commitCanvasHistory(useEditorStore.getState().canvas.fabricCanvas);
                }}
                onMoveUp={() => {
                  reorderLayer(layer.id, "up");
                  commitCanvasHistory(useEditorStore.getState().canvas.fabricCanvas);
                }}
                onMoveDown={() => {
                  reorderLayer(layer.id, "down");
                  commitCanvasHistory(useEditorStore.getState().canvas.fabricCanvas);
                }}
                onRename={(name) => renameLayer(layer.id, name)}
                onReorder={reorderLayer}
                onMove={(draggedId, targetId, position) => {
                  moveLayer(draggedId, targetId, position);
                  commitCanvasHistory(useEditorStore.getState().canvas.fabricCanvas);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LayerItemProps {
  layer: Layer;
  isSelected: boolean;
  index: number;
  totalLayers: number;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (name: string) => void;
  onReorder: (layerId: string, direction: "up" | "down") => void;
  onMove: (
    draggedId: string,
    targetId: string,
    position: "above" | "below",
  ) => void;
}

function LayerItem({
  layer,
  isSelected,
  index,
  totalLayers,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRename,
  onReorder,
  onMove,
}: LayerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(layer.name);
  const [isDragging, setIsDragging] = useState(false);

  const handleRenameSubmit = () => {
    if (tempName.trim()) onRename(tempName.trim());
    setIsEditing(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("layerId", layer.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedLayerId = e.dataTransfer.getData("layerId");
    if (draggedLayerId && draggedLayerId !== layer.id) {
      // Determine drop position relative to this item
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      // In flex-col-reverse, top means higher index (above) visually
      const position = e.clientY < midpoint ? "above" : "below";
      onMove(draggedLayerId, layer.id, position);
    }
  };

  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "group relative flex flex-col p-3 rounded-2xl transition-all duration-300 border cursor-move",
        isSelected
          ? "bg-[#222] border-white/10 shadow-2xl ring-1 ring-[#8b5cf6]/20"
          : "bg-white/5 border-transparent hover:bg-white/10",
        isDragging && "opacity-50 scale-95",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div className="cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        {/* Layer Icon */}
        <div
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-xl bg-[#161616] border border-white/5 text-lg group-hover:scale-105 transition-transform shadow-lg",
            isSelected && "border-[#8b5cf6]/30",
          )}
        >
          {layer.type === "image" && "🖼️"}
          {layer.type === "text" && "📝"}
          {layer.type === "video" && "🎬"}
          {layer.type === "audio" && "🎵"}
          {layer.type === "sticker" && "✨"}
          {layer.type === "shape" && "📐"}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              className="h-7 text-xs py-0 px-2 bg-black/40 border-white/10 text-white"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex flex-col">
              <p
                className={cn(
                  "text-xs font-bold truncate tracking-tight",
                  isSelected ? "text-white" : "text-gray-400",
                  !layer.visible && "opacity-30",
                )}
              >
                {layer.name}
              </p>
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                {layer.type}
              </span>
            </div>
          )}
        </div>

        {/* Visibility & Lock */}
        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible();
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400"
          >
            {layer.visible ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked();
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg"
          >
            {layer.locked ? (
              <Unlock className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[#ec4899]" />
            )}
          </button>
        </div>
      </div>

      {/* Contextual Actions */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex gap-1">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={index === totalLayers - 1}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-10"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={index === 0}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-10"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
            <div className="w-px h-5 bg-white/5 mx-1" />
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
              title="Delete layer"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
