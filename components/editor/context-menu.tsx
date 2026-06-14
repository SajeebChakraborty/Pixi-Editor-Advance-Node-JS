"use client";

import { useEditorStore } from "@/lib/store";
import {
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Files,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { commitCanvasHistory } from "@/lib/editor-actions";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const {
    canvas: { fabricCanvas, selectedLayerId },
    deleteLayer,
    duplicateLayer,
  } = useEditorStore();

  if (!fabricCanvas) return null;

  const activeObject = fabricCanvas.getActiveObject();
  if (!activeObject) return null;

  const handleAction = (action: string) => {
    switch (action) {
      case "forward":
        fabricCanvas.bringObjectForward(activeObject);
        break;
      case "backward":
        fabricCanvas.sendObjectBackwards(activeObject);
        break;
      case "front":
        fabricCanvas.bringObjectToFront(activeObject);
        break;
      case "back":
        fabricCanvas.sendObjectToBack(activeObject);
        break;
      case "duplicate":
        if (selectedLayerId) duplicateLayer(selectedLayerId);
        break;
      case "delete":
        if (selectedLayerId) {
          deleteLayer(selectedLayerId);
        } else if (activeObject) {
          fabricCanvas.remove(activeObject);
          fabricCanvas.discardActiveObject();
        }
        break;
    }
    fabricCanvas.renderAll();
    commitCanvasHistory(fabricCanvas);
    onClose();
  };

  const menuItems = [
    { id: "forward", icon: ChevronUp, label: "Bring Forward" },
    { id: "backward", icon: ChevronDown, label: "Send Backward" },
    { id: "front", icon: ArrowUp, label: "Bring to Front" },
    { id: "back", icon: ArrowDown, label: "Send to Back" },
    { type: "divider" },
    { id: "duplicate", icon: Files, label: "Duplicate" },
    { id: "delete", icon: Trash2, label: "Delete", danger: true },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[70] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[180px] backdrop-blur-xl"
        style={{ left: x, top: y }}
      >
        {menuItems.map((item, i) => {
          if (item.type === "divider") {
            return <div key={i} className="h-px bg-white/5 my-1" />;
          }

          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleAction(item.id!)}
              className={cn(
                "w-full px-3 py-2 flex items-center gap-3 text-[13px] transition-colors",
                item.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-gray-300 hover:bg-white/5 hover:text-white",
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
