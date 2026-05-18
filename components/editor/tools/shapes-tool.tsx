"use client";

import dynamic from "next/dynamic";
import { useEditorStore } from "@/lib/store";
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  Hexagon,
  MoveRight,
} from "lucide-react";
import {
  Rect,
  Circle as FabricCircle,
  Triangle as FabricTriangle,
  IText,
  Path,
  FabricImage,
  FabricObject,
  Polygon,
} from "fabric"; // Import necessary fabric classes

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

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

  const emojis = [
    "😀",
    "😂",
    "😍",
    "😎",
    "🤩",
    "🥳",
    "🔥",
    "✨",
    "💯",
    "🎉",
    "❤️",
    "👍",
    "👏",
    "🙌",
    "🤝",
    "🚀",
    "⭐",
    "🌈",
    "📌",
    "✅",
    "❌",
    "💡",
    "📣",
    "🎯",
  ];

  const addEmoji = (emoji: string) => {
    const store = useEditorStore.getState();
    const fabricCanvas = store.canvas.fabricCanvas;
    if (!fabricCanvas) {
      console.warn("No active canvas found. Click on the canvas first.");
      return;
    }

    const id = `emoji_${Date.now()}`;
    const currentDuration = store.videoState.duration;
    const centerLeft = fabricCanvas.getWidth() / fabricCanvas.getZoom() / 2;
    const centerTop = fabricCanvas.getHeight() / fabricCanvas.getZoom() / 2;
    const codepoint = Array.from(emoji)
      .map((char) => char.codePointAt(0)?.toString(16))
      .filter(Boolean)
      .join("-");
    const emojiUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`;

    FabricImage.fromURL(emojiUrl, { crossOrigin: "anonymous" })
      .then((emojiImage) => {
        emojiImage.set({
          left: centerLeft,
          top: centerTop,
          originX: "center",
          originY: "center",
          scaleX: 1.2,
          scaleY: 1.2,
          name: id,
        } as any);

        fabricCanvas.add(emojiImage);
        fabricCanvas.bringObjectToFront(emojiImage);
        fabricCanvas.setActiveObject(emojiImage);
        fabricCanvas.requestRenderAll();

        addLayer({
          type: "sticker",
          name: `Emoji ${emoji}`,
          locked: false,
          visible: true,
          objectId: id,
          data: { emoji, url: emojiUrl, isEmoji: true },
          startTime: 0,
          duration: Math.max(currentDuration, 3600),
        });

        requestAnimationFrame(() => fabricCanvas.requestRenderAll());
      })
      .catch(() => {
        const fallbackEmojiText = new IText(emoji, {
          left: centerLeft,
          top: centerTop,
          fontSize: 72,
          originX: "center",
          originY: "center",
          fontFamily:
            "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
          editable: false,
        });

        (fallbackEmojiText as any).name = id;
        fabricCanvas.add(fallbackEmojiText);
        fabricCanvas.bringObjectToFront(fallbackEmojiText);
        fabricCanvas.setActiveObject(fallbackEmojiText);
        fabricCanvas.requestRenderAll();

        addLayer({
          type: "sticker",
          name: `Emoji ${emoji}`,
          locked: false,
          visible: true,
          objectId: id,
          data: { emoji, isEmoji: true },
          startTime: 0,
          duration: Math.max(currentDuration, 3600),
        });
      });
  };

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

        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Emoji
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="h-11 rounded-lg border border-white/10 bg-[#222] text-2xl transition-colors hover:bg-[#333] hover:border-white/20"
                title={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <EmojiPicker
              lazyLoadEmojis
              searchDisabled={false}
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData: any) => addEmoji(emojiData.emoji)}
              width="100%"
              height={360}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
