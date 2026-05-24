"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  Hexagon,
  MoveRight,
  Diamond,
  Pentagon,
  Octagon,
  Heart,
  Plus,
  MessageSquare,
  Zap,
  ChevronDown,
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

export const EDITOR_DRAG_MIME_TYPE = "application/x-pixi-editor-item";

type CanvasPosition = {
  left: number;
  top: number;
};

const getCanvasCenter = (): CanvasPosition => ({
  left: useEditorStore.getState().canvas.width / 2,
  top: useEditorStore.getState().canvas.height / 2,
});

const SHAPE_LABELS: Record<string, string> = {
  rect: "Square",
  circle: "Circle",
  triangle: "Triangle",
  line: "Line",
  star: "Star",
  hexagon: "Hexagon",
  arrow: "Arrow",
  diamond: "Diamond",
  pentagon: "Pentagon",
  octagon: "Octagon",
  heart: "Heart",
  plus: "Plus",
  speech: "Speech Bubble",
  lightning: "Lightning",
};

export function addShapeToCanvas(type: string, position?: CanvasPosition) {
  const store = useEditorStore.getState();
  const fabricCanvas = store.canvas.fabricCanvas;
  if (!fabricCanvas) {
    console.warn("No active canvas found. Click on the canvas first.");
    return;
  }

  let shape: FabricObject | null = null;
  const { width: baseWidth, height: baseHeight } = store.canvas;

  const center = position ?? {
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
    case "star": {
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
    }
    case "hexagon": {
      const hexPoints = [
        { x: 0, y: -50 },
        { x: 43, y: -25 },
        { x: 43, y: 25 },
        { x: 0, y: 50 },
        { x: -43, y: 25 },
        { x: -43, y: -25 },
      ];
      shape = new Polygon(hexPoints, {
        ...commonProps,
        fill: "#e0e0e0",
      });
      break;
    }
    case "diamond": {
      shape = new Polygon(
        [
          { x: 0, y: -60 },
          { x: 60, y: 0 },
          { x: 0, y: 60 },
          { x: -60, y: 0 },
        ],
        commonProps,
      );
      break;
    }
    case "pentagon": {
      shape = new Polygon(
        [
          { x: 0, y: -58 },
          { x: 55, y: -18 },
          { x: 34, y: 50 },
          { x: -34, y: 50 },
          { x: -55, y: -18 },
        ],
        commonProps,
      );
      break;
    }
    case "octagon": {
      shape = new Polygon(
        [
          { x: -24, y: -58 },
          { x: 24, y: -58 },
          { x: 58, y: -24 },
          { x: 58, y: 24 },
          { x: 24, y: 58 },
          { x: -24, y: 58 },
          { x: -58, y: 24 },
          { x: -58, y: -24 },
        ],
        commonProps,
      );
      break;
    }
    case "heart": {
      shape = new Path(
        "M 0 38 C -70 -20 -40 -70 0 -35 C 40 -70 70 -20 0 38 Z",
        {
          ...commonProps,
          fill: "#ef4444",
        },
      );
      break;
    }
    case "plus": {
      shape = new Polygon(
        [
          { x: -18, y: -60 },
          { x: 18, y: -60 },
          { x: 18, y: -18 },
          { x: 60, y: -18 },
          { x: 60, y: 18 },
          { x: 18, y: 18 },
          { x: 18, y: 60 },
          { x: -18, y: 60 },
          { x: -18, y: 18 },
          { x: -60, y: 18 },
          { x: -60, y: -18 },
          { x: -18, y: -18 },
        ],
        commonProps,
      );
      break;
    }
    case "speech": {
      shape = new Path(
        "M -60 -42 Q -60 -60 -42 -60 L 42 -60 Q 60 -60 60 -42 L 60 18 Q 60 36 42 36 L 8 36 L -18 62 L -16 36 L -42 36 Q -60 36 -60 18 Z",
        commonProps,
      );
      break;
    }
    case "lightning": {
      shape = new Polygon(
        [
          { x: 8, y: -64 },
          { x: -42, y: 6 },
          { x: -8, y: 6 },
          { x: -24, y: 64 },
          { x: 42, y: -14 },
          { x: 6, y: -14 },
        ],
        {
          ...commonProps,
          fill: "#facc15",
        },
      );
      break;
    }
    case "arrow": {
      const arrowPath = "M 0 0 L 100 0 M 100 0 L 85 -10 M 100 0 L 85 10";
      shape = new Path(arrowPath, {
        ...commonProps,
        stroke: "#000000",
        strokeWidth: 4,
        fill: "transparent",
      });
      break;
    }
    case "line":
      shape = new Rect({
        width: 200,
        height: 5,
        ...commonProps,
        fill: "#000000",
      });
      break;
  }

  if (!shape) return;

  const id = `${type}_${Date.now()}`;
  const currentDuration = store.videoState.duration;

  (shape as any).name = id;
  fabricCanvas.add(shape);
  fabricCanvas.setActiveObject(shape);
  fabricCanvas.requestRenderAll();

  store.addLayer({
    type: "shape",
    name: SHAPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1),
    locked: false,
    visible: true,
    objectId: id,
    startTime: 0,
    duration: Math.max(currentDuration, 3600),
  });

  requestAnimationFrame(() => fabricCanvas.requestRenderAll());
}

export function addEmojiToCanvas(emoji: string, position?: CanvasPosition) {
  const store = useEditorStore.getState();
  const fabricCanvas = store.canvas.fabricCanvas;
  if (!fabricCanvas) {
    console.warn("No active canvas found. Click on the canvas first.");
    return;
  }

  const id = `emoji_${Date.now()}`;
  const currentDuration = store.videoState.duration;
  const center = position ?? getCanvasCenter();
  const codepoint = Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("-");
  const emojiUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoint}.png`;

  FabricImage.fromURL(emojiUrl, { crossOrigin: "anonymous" })
    .then((emojiImage) => {
      emojiImage.set({
        ...center,
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

      store.addLayer({
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
        ...center,
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

      store.addLayer({
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
}

export function ShapesTool() {
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState({
    shapes: true,
    emoji: true,
  });

  const toggleSection = (section: "shapes" | "emoji") => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const setDragPayload = (
    event: React.DragEvent<HTMLElement>,
    payload: { kind: "shape"; type: string } | { kind: "emoji"; emoji: string },
  ) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(EDITOR_DRAG_MIME_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData(
      "text/plain",
      payload.kind === "shape" ? payload.type : payload.emoji,
    );
  };

  const shapes = [
    { id: "rect", icon: Square, label: "Square" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "triangle", icon: Triangle, label: "Triangle" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "star", icon: Star, label: "Star" },
    { id: "hexagon", icon: Hexagon, label: "Hexagon" },
    { id: "arrow", icon: MoveRight, label: "Arrow" },
    { id: "diamond", icon: Diamond, label: "Diamond" },
    { id: "pentagon", icon: Pentagon, label: "Pentagon" },
    { id: "octagon", icon: Octagon, label: "Octagon" },
    { id: "heart", icon: Heart, label: "Heart" },
    { id: "plus", icon: Plus, label: "Plus" },
    { id: "speech", icon: MessageSquare, label: "Speech" },
    { id: "lightning", icon: Zap, label: "Bolt" },
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

  useEffect(() => {
    const picker = emojiPickerRef.current;
    if (!picker) return;

    const updateDraggableEmojiButtons = () => {
      picker.querySelectorAll("button").forEach((button) => {
        const emoji =
          button.querySelector("img")?.getAttribute("alt") ||
          button
            .getAttribute("aria-label")
            ?.match(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu)?.[0] ||
          button.textContent?.trim();
        if (!emoji) return;

        button.setAttribute("draggable", "true");
        button.setAttribute("data-pixi-emoji", emoji);
      });
    };

    updateDraggableEmojiButtons();
    const observer = new MutationObserver(updateDraggableEmojiButtons);
    observer.observe(picker, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      <div className="px-5 py-6 space-y-6">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection("shapes")}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] font-black uppercase tracking-[0.22em] text-gray-200 transition-colors hover:text-white"
            aria-expanded={openSections.shapes}
          >
            <span>Shapes</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-300 transition-transform",
                !openSections.shapes && "-rotate-90",
              )}
            />
          </button>
          {openSections.shapes && (
            <div className="grid grid-cols-3 gap-3">
              {shapes.map((shape) => (
                <button
                  key={shape.id}
                  draggable
                  onClick={() => addShapeToCanvas(shape.id)}
                  onDragStart={(event) =>
                    setDragPayload(event, { kind: "shape", type: shape.id })
                  }
                  className="aspect-square flex flex-col items-center justify-center bg-[#222] hover:bg-[#333] rounded-xl border border-white/5 hover:border-white/20 transition-all gap-2 group"
                >
                  <shape.icon className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                  <span className="text-[10px] font-medium text-gray-500 group-hover:text-gray-300">
                    {shape.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection("emoji")}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] font-black uppercase tracking-[0.22em] text-gray-200 transition-colors hover:text-white"
            aria-expanded={openSections.emoji}
          >
            <span>Emoji</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-300 transition-transform",
                !openSections.emoji && "-rotate-90",
              )}
            />
          </button>
          {openSections.emoji && (
            <>
              <div className="grid grid-cols-6 gap-2">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    draggable
                    onClick={() => addEmojiToCanvas(emoji)}
                    onDragStart={(event) =>
                      setDragPayload(event, { kind: "emoji", emoji })
                    }
                    className="h-11 rounded-lg border border-white/10 bg-[#222] text-2xl transition-colors hover:bg-[#333] hover:border-white/20"
                    title={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div
                ref={emojiPickerRef}
                className="overflow-hidden rounded-xl border border-white/10"
                onDragStartCapture={(event) => {
                  const button = (event.target as HTMLElement).closest(
                    "[data-pixi-emoji]",
                  ) as HTMLElement | null;
                  const emoji = button?.dataset.pixiEmoji;
                  if (emoji) {
                    setDragPayload(event as React.DragEvent<HTMLElement>, {
                      kind: "emoji",
                      emoji,
                    });
                  }
                }}
              >
                <EmojiPicker
                  lazyLoadEmojis
                  searchDisabled={false}
                  skinTonesDisabled={false}
                  previewConfig={{ showPreview: false }}
                  onEmojiClick={(emojiData: any) =>
                    addEmojiToCanvas(emojiData.emoji)
                  }
                  width="100%"
                  height={360}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
