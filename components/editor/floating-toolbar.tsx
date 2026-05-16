"use client";

import { useEditorStore, EditorTool } from "@/lib/store";
import {
  MousePointer2,
  Hand,
  Type,
  Circle,
  Square,
  Star,
  PenTool,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Rect, Circle as FabricCircle, IText, Path } from "fabric";

export function FloatingToolbar() {
  const {
    activeCanvasTool,
    setActiveCanvasTool,
    canvas: { fabricCanvas },
    addLayer,
  } = useEditorStore();

  const tools = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "hand", icon: Hand, label: "Pan" },
    { id: "text", icon: Type, label: "Text" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "square", icon: Square, label: "Square" },
    { id: "star", icon: Star, label: "Star" },
    { id: "pen", icon: PenTool, label: "Draw" },
    { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
  ];

  const handleToolClick = (toolId: EditorTool) => {
    setActiveCanvasTool(toolId);

    if (!fabricCanvas) return;

    // Bring objects immediately when clicked
    if (toolId === "square") {
      const rect = new Rect({
        left: fabricCanvas.width ? fabricCanvas.width / 2 : 100,
        top: fabricCanvas.height ? fabricCanvas.height / 2 : 100,
        fill: "#8b5cf6",
        width: 100,
        height: 100,
        rx: 8,
        ry: 8,
        name: `rect_${Date.now()}`,
        originX: "center",
        originY: "center",
      } as any);
      addLayer({
        type: "shape",
        name: "Square",
        locked: false,
        visible: true,
        objectId: (rect as any).name,
      });
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
    } else if (toolId === "circle") {
      const circle = new FabricCircle({
        left: fabricCanvas.width ? fabricCanvas.width / 2 : 150,
        top: fabricCanvas.height ? fabricCanvas.height / 2 : 150,
        fill: "#20B486",
        radius: 50,
        name: `circle_${Date.now()}`,
        originX: "center",
        originY: "center",
      } as any);
      addLayer({
        type: "shape",
        name: "Circle",
        locked: false,
        visible: true,
        objectId: (circle as any).name,
      });
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
    } else if (toolId === "text") {
      const text = new IText("Type something...", {
        left: fabricCanvas.width ? fabricCanvas.width / 2 : 200,
        top: fabricCanvas.height ? fabricCanvas.height / 2 : 200,
        fontSize: 40,
        fill: "#000000",
        fontFamily: "Inter",
        name: `text_${Date.now()}`,
        originX: "center",
        originY: "center",
      } as any);
      addLayer({
        type: "text",
        name: "Text",
        locked: false,
        visible: true,
        objectId: (text as any).name,
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);

      text.selectAll();
    } else if (toolId === "arrow") {
      const arrowPath = "M 0 0 L 100 0 M 100 0 L 85 -10 M 100 0 L 85 10";
      const arrow = new Path(arrowPath, {
        left: fabricCanvas.width ? fabricCanvas.width / 2 : 200,
        top: fabricCanvas.height ? fabricCanvas.height / 2 : 200,
        stroke: "#000000",
        strokeWidth: 4,
        fill: "transparent",
        name: `arrow_${Date.now()}`,
        originX: "center",
        originY: "center",
      } as any);
      addLayer({
        type: "shape",
        name: "Arrow",
        locked: false,
        visible: true,
        objectId: (arrow as any).name,
      });
      fabricCanvas.add(arrow);
      fabricCanvas.setActiveObject(arrow);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 transition-transform active:scale-95">
      {tools.map((tool) => {
        const isActive = activeCanvasTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id as EditorTool)}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
              isActive
                ? "bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] text-white shadow-lg shadow-purple-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/5",
            )}
            title={tool.label}
          >
            <tool.icon className={cn("w-5 h-5", isActive && "fill-white/20")} />
          </button>
        );
      })}
    </div>
  );
}
