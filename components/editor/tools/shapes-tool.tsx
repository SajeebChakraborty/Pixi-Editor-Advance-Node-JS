"use client";

import { useEditorStore } from "@/lib/store";
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  Hexagon,
  Search,
  ChevronRight,
  ArrowRight,
  MoveRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Rect,
  Circle as FabricCircle,
  Triangle as FabricTriangle,
  IText,
  Path,
  PencilBrush,
  FabricObject,
  Canvas,
  Line,
  Polygon,
} from "fabric"; // Import necessary fabric classes
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function ShapesTool() {
  const { addLayer } = useEditorStore();

  const addShape = (type: string) => {
    // Always use getState() for fabricCanvas to avoid stale closure
    const store = useEditorStore.getState();
    const fabricCanvas = store.canvas.fabricCanvas;
    if (!fabricCanvas) {
      console.warn("No active canvas found. Click on the canvas first.");
      return;
    }

    let shape: FabricObject | null = null;
    const { width: baseWidth, height: baseHeight } =
      useEditorStore.getState().canvas;

    const center = {
      left: baseWidth / 2,
      top: baseHeight / 2,
    };
    const commonProps = {
      fill: "#C4C4C4",
      stroke: "#000000",
      strokeWidth: 2,
      originX: "center" as const,
      originY: "center" as const,
      ...center,
    };

    switch (type) {
      case "rect":
        shape = new Rect({
          width: 100,
          height: 100,
          rx: 10,
          ry: 10,
          ...commonProps,
        });
        break;
      case "circle":
        shape = new FabricCircle({ radius: 50, ...commonProps });
        break;
      case "triangle":
        shape = new FabricTriangle({ width: 100, height: 100, ...commonProps });
        break;
      case "star":
        // Create a simple star polygon
        const starPoints = [
          { x: 0, y: -50 },
          { x: 14, y: -20 },
          { x: 47, y: -20 },
          { x: 20, y: 5 },
          { x: 30, y: 40 },
          { x: 0, y: 20 },
          { x: -30, y: 40 },
          { x: -20, y: 5 },
          { x: -47, y: -20 },
          { x: -14, y: -20 },
        ];
        shape = new Polygon(starPoints, {
          ...commonProps,
          scaleX: 1.5,
          scaleY: 1.5,
        });
        break;
      case "hexagon":
        const hexPoints = [
          { x: 30, y: 0 },
          { x: 60, y: 17 },
          { x: 60, y: 52 },
          { x: 30, y: 70 },
          { x: 0, y: 52 },
          { x: 0, y: 17 },
        ];
        shape = new Polygon(hexPoints, {
          ...commonProps,
          scaleX: 1.5,
          scaleY: 1.5,
          fill: "#e0e0e0",
        });
        break;
      case "arrow":
        // Arrow implementation using Path
        const arrowPath = "M 0 0 L 100 0 M 100 0 L 85 -10 M 100 0 L 85 10";
        shape = new Path(arrowPath, {
          ...commonProps,
          stroke: "#000000",
          strokeWidth: 4,
          fill: "transparent",
        });
        break;
      case "line":
        shape = new Rect({
          width: 200,
          height: 5,
          ...commonProps,
          fill: "#000000",
        });
        break;
    }

    if (shape) {
      const id = `${type}_${Date.now()}`;
      const currentDuration = store.videoState.duration;

      (shape as any).name = id;

      // Add to canvas FIRST — object must exist before the sync effect runs
      fabricCanvas.add(shape);
      fabricCanvas.setActiveObject(shape);
      fabricCanvas.requestRenderAll();

      // Register with store AFTER fabric object is on canvas
      addLayer({
        type: "shape",
        name: type.charAt(0).toUpperCase() + type.slice(1),
        locked: false,
        visible: true,
        objectId: id,
        startTime: 0,
        duration: Math.max(currentDuration, 3600),
      });

      // Force a second render pass to catch any batched state updates
      requestAnimationFrame(() => fabricCanvas.requestRenderAll());
    }
  };

  const shapes = [
    { id: "rect", icon: Square, label: "Square" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "triangle", icon: Triangle, label: "Triangle" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "star", icon: Star, label: "Star" },
    { id: "hexagon", icon: Hexagon, label: "Hexagon" },
    { id: "arrow", icon: MoveRight, label: "Arrow" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      <div className="px-5 py-6 space-y-6">
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Shapes
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {shapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => addShape(shape.id)}
                className="aspect-square flex flex-col items-center justify-center bg-[#222] hover:bg-[#333] rounded-xl border border-white/5 hover:border-white/20 transition-all gap-2 group"
              >
                <shape.icon className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-gray-300">
                  {shape.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
