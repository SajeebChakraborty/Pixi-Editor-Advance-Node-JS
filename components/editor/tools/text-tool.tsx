"use client";

import { Button } from "@/components/ui/button";
import { commitCanvasHistory, getActiveFabricCanvas } from "@/lib/editor-actions";
import { applyFabricTransformControls, applyVideoOverlayControls } from "@/lib/fabric-transform-controls";
import { getNextOverlayTrack } from "@/lib/timeline-tracks";
import { syncFabricLayerStack } from "@/lib/layer-stack";
import { attachMediaOverlay } from "@/lib/media-overlay";
import { TEXT_FONT_CATEGORIES, type TextFontPreset } from "@/lib/editor-fonts";
import { useEditorStore, type Layer } from "@/lib/store";
import { IText } from "fabric";
import { Plus } from "lucide-react";

const isTextObject = (object: unknown): object is IText => {
  const type = String((object as any)?.type || "").toLowerCase();
  return type === "i-text" || type === "textbox" || type === "text";
};

const findLayerForObject = (layers: Layer[], object: any) => {
  if (!object?.name) return undefined;
  return layers.find(
    (layer) => layer.type === "text" && layer.objectId === object.name,
  );
};

export function TextTool() {
  const addLayer = useEditorStore((state) => state.addLayer);

  const applyFontToSelectedText = (style: TextFontPreset) => {
    const store = useEditorStore.getState();
    const fabricCanvas = getActiveFabricCanvas();
    if (!fabricCanvas) return false;

    const layers = store.getLayers();
    const activeObject = fabricCanvas.getActiveObject() as any;
    const selectedLayer = store.getSelectedLayer();

    let targetObject: any = isTextObject(activeObject) ? activeObject : null;
    let targetLayer = targetObject
      ? findLayerForObject(layers, targetObject)
      : undefined;

    if (
      !targetObject &&
      selectedLayer?.type === "text" &&
      selectedLayer.objectId
    ) {
      targetObject =
        fabricCanvas
          .getObjects()
          .find((object: any) => object.name === selectedLayer.objectId) ||
        null;
      targetLayer = selectedLayer;
    }

    if (!isTextObject(targetObject)) return false;

    // Font preset cards should only change the selected text's family.
    // Do not overwrite content, size, color, position, or weight here.
    targetObject.set({ fontFamily: style.font });
    (targetObject as any).dirty = true;
    (targetObject as any).initDimensions?.();
    targetObject.setCoords();

    fabricCanvas.setActiveObject(targetObject);
    fabricCanvas.requestRenderAll();

    if (!targetLayer) {
      targetLayer = findLayerForObject(layers, targetObject);
    }

    if (targetLayer) {
      store.selectLayer(targetLayer.id);
      store.updateLayerData(targetLayer.id, {
        fontFamily: style.font,
      });
    }

    // Keep properties panel local state in sync when it is already mounted.
    targetObject.fire("modified");
    commitCanvasHistory(fabricCanvas);

    return true;
  };

  const handleFontPresetClick = (style: TextFontPreset) => {
    const didApplyToSelection = applyFontToSelectedText(style);

    if (!didApplyToSelection) {
      addText(style.label, {
        fontFamily: style.font,
        fontWeight: style.weight,
      });
    }
  };

  const addText = (text: string, options: any = {}) => {
    // Use getState() to always get the freshest canvas reference.
    const store = useEditorStore.getState();
    const fabricCanvas = getActiveFabricCanvas();

    if (!fabricCanvas) {
      console.warn("No active canvas. Click on the artboard first.");
      return;
    }

    const id = `text_${Date.now()}`;
    const isVideoMode = store.editorMode === "video";
    const currentDuration = store.videoState.duration;
    const currentTime = store.videoState.currentTime;
    const startTime = isVideoMode ? currentTime : 0;
    const duration = isVideoMode
      ? Math.max(1, currentDuration - currentTime)
      : Math.max(currentDuration, 3600);
    const fontFamily = options.fontFamily || "Roboto";
    const fontWeight = options.fontWeight || "normal";
    const fill = options.fill || "#ffffff";
    const fontSize = options.fontSize || 40;
    const { width, height } = store.canvas;

    const textBox = new IText(text, {
      left: width / 2,
      top: height / 2,
      fill,
      fontFamily,
      fontWeight,
      fontSize,
      originX: "center",
      originY: "center",
      editable: store.editorMode === "video" ? false : true,
      splitByGrapheme: false,
      ...options,
    });

    (textBox as any).name = id;
    (textBox as any).objectId = id;
    (textBox as any).data = {
      content: text,
      fontFamily,
      fontWeight,
      fill,
      fontSize,
    };
    (textBox as any).startTime = startTime;
    (textBox as any).duration = duration;

    // Add to canvas FIRST so object exists when sync effect runs.
    fabricCanvas.add(textBox);
    fabricCanvas.setActiveObject(textBox);
    if (store.editorMode === "video") {
      applyVideoOverlayControls(textBox);
    } else {
      applyFabricTransformControls(textBox);
    }
    syncFabricLayerStack(fabricCanvas, store.getLayers());
    attachMediaOverlay(fabricCanvas, textBox as any);

    // Register layer AFTER the object is on canvas.
    addLayer({
      type: "text",
      name: text,
      locked: false,
      visible: true,
      objectId: id,
      track: getNextOverlayTrack(store.getLayers()),
      data: {
        content: text,
        fontFamily,
        fontWeight,
        fill,
        fontSize,
      },
      startTime,
      duration,
    });

    requestAnimationFrame(() => {
      const canvas = getActiveFabricCanvas();
      syncFabricLayerStack(canvas, useEditorStore.getState().getLayers());
    });
    commitCanvasHistory(fabricCanvas);
  };

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
                    onClick={() => handleFontPresetClick(style)}
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
