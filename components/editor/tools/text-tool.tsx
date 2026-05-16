"use client";

import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { IText } from "fabric";
import { TEXT_FONT_CATEGORIES } from "@/lib/editor-fonts";

export function TextTool() {
  const { addLayer } = useEditorStore();

  const addText = (text: string, options: any = {}) => {
    // Use getState() to always get the freshest canvas reference
    const store = useEditorStore.getState();
    const fabricCanvas = store.canvas.fabricCanvas;
    if (!fabricCanvas) {
      console.warn("No active canvas. Click on the artboard first.");
      return;
    }

    const textBox = new IText(text, {
      left: fabricCanvas.width! / fabricCanvas.getZoom() / 2,
      top: fabricCanvas.height! / fabricCanvas.getZoom() / 2,
      fill: "#ffffff",
      fontFamily: "Roboto",
      fontSize: 40,
      originX: "center",
      originY: "center",
      ...options,
    });

    const id = `text_${Date.now()}`;
    const currentDuration = store.videoState.duration;

    (textBox as any).name = id;

    // Add to canvas FIRST so object exists when sync effect runs
    fabricCanvas.add(textBox);
    fabricCanvas.setActiveObject(textBox);
    fabricCanvas.requestRenderAll();

    // Register layer AFTER the object is on canvas
    addLayer({
      type: "text",
      name: text,
      locked: false,
      visible: true,
      objectId: id,
      startTime: 0,
      duration: Math.max(currentDuration, 3600),
    });

    // Force a second render pass to catch any batched updates
    requestAnimationFrame(() => fabricCanvas.requestRenderAll());
  };

  const textStyles = [
    {
      category: "Sans Serif",
      items: [
        {
          label: "Inter",
          font: "Inter",
          weight: "bold",
          preview: "Modern & Clean",
        },
        {
          label: "Roboto",
          font: "Roboto",
          weight: "normal",
          preview: "Standard Web",
        },
      ],
    },
    {
      category: "Serif",
      items: [
        {
          label: "Playfair Display",
          font: "Playfair Display",
          weight: "bold",
          preview: "Elegant & Classic",
        },
        {
          label: "Merriweather",
          font: "Merriweather",
          weight: "normal",
          preview: "Editorial",
        },
      ],
    },
    {
      category: "Display",
      items: [
        {
          label: "Oswald",
          font: "Oswald",
          weight: "bold",
          preview: "Strong Impact",
        },
        {
          label: "Lobster",
          font: "Lobster",
          weight: "normal",
          preview: "Playful Script",
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      <div className="px-5 py-6 space-y-6">
        <Button
          onClick={() => addText("Your Text Here")}
          className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] hover:from-[#5558e6] hover:to-[#9333ea] text-white font-bold h-10 shadow-lg shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Add a text box
        </Button>

        <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
          {TEXT_FONT_CATEGORIES.map((group) => (
            <div key={group.category} className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
                {group.category}
              </h3>
              <div className="grid gap-3">
                {group.items.map((style) => (
                  <button
                    key={style.label}
                    onClick={() =>
                      addText(style.label, {
                        fontFamily: style.font,
                        fontWeight: style.weight,
                      })
                    }
                    className="group flex flex-col items-start p-3 rounded-xl bg-[#222] border border-white/5 hover:border-white/20 transition-all hover:bg-[#2a2a2a] text-left"
                  >
                    <span
                      className="text-2xl text-white mb-1"
                      style={{
                        fontFamily: style.font,
                        fontWeight: style.weight,
                      }}
                    >
                      {style.label}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500 group-hover:text-gray-400">
                      {style.preview}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
