"use client";

import { useState, useEffect, useRef } from "react";
import * as fabric from "fabric";
import { useEditorStore, Layer, EditorPage } from "@/lib/store";
import { Plus, Trash2, Copy, Minus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VideoPlayerCanvas } from "./video-player-canvas";
import { ContextMenu } from "./context-menu";

interface PageCanvasProps {
  pageId: string;
  index: number;
}

function PageCanvas({ pageId, index }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const {
    canvas: { width, height, zoom, activePageId, pages, selectedLayerId },
    activeCanvasTool,
    setFabricCanvas,
    selectLayer,
    setActivePage,
    deletePage,
    addPage,
    duplicatePage,
    renamePage,
    undo,
    redo,
    saveToHistory,
    setZoom,
  } = useEditorStore();

  const page = pages.find((p) => p.id === pageId);
  const pageName = page?.name || `Page ${index + 1}`;

  const isActive = activePageId === pageId;
  const isHandTool = activeCanvasTool === "hand";

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleNameClick = () => {
    setTempName(pageName);
    setIsEditingName(true);
  };

  const handleNameEditComplete = () => {
    if (tempName.trim()) {
      renamePage(pageId, tempName.trim());
    }
    setIsEditingName(false);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if (isCmd && e.key === "z") {
        e.preventDefault();
        if (isShift) {
          redo();
        } else {
          undo();
        }
      } else if (isCmd && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete if editing text or typing in input
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;

        const canvas = useEditorStore.getState().canvas.fabricCanvas;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects() || [];
        const activeObj = canvas.getActiveObject() as any;

        if (activeObjects.length > 0 && (!activeObj || !activeObj.isEditing)) {
          e.preventDefault();
          const state = useEditorStore.getState();
          const { deleteLayer, getLayers } = state;
          const layers = getLayers();

          let selectedId = state.canvas.selectedLayerId;

          activeObjects.forEach((obj: any) => {
            const layerToDelete = layers.find((l) => l.objectId === obj.name);
            if (layerToDelete) {
              deleteLayer(layerToDelete.id);
            } else {
              // For freehand drawings or other objects not linked to our layer store
              canvas.remove(obj);
            }
          });

          // Fallback if selecting directly via a timeline single layer
          if (
            selectedId &&
            activeObjects.length === 1 &&
            !layers.find((l) => l.objectId === (activeObjects[0] as any).name)
          ) {
            deleteLayer(selectedId);
          }

          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, undo, redo]);

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width * zoom,
      height: height * zoom,
      // REMOVED backgroundColor so it doesn't cover objects
      selection: !isHandTool,
      preserveObjectStacking: true,
      hoverCursor: isHandTool ? "grab" : "move",
    });

    fabricCanvasRef.current = canvas;
    if (isActive) setFabricCanvas(canvas);

    // Sync layers FROM state TO new canvas (important for remounting)
    const page = pages.find(p => p.id === pageId);
    if (page?.layers) {
    // CRITICAL: Rebuild canvas from store layers if needed (survives UI remounts)
    const sync = async () => {
       const page = pages.find(p => p.id === pageId);
       if (!page?.layers) return;
       const { addMediaFromUrl, addTextToCanvas } = await import("@/lib/editor-utils");
       
       for(const layer of page.layers) {
         // Prevent double-adding if already on canvas
         if (canvas.getObjects().some((o: any) => o.name === layer.objectId)) continue;

         if ((layer.type === 'image' || layer.type === 'sticker' || layer.type === "video") && layer.data?.url) {
           await addMediaFromUrl(layer.data.url, useEditorStore.getState(), layer.type as any, true, layer.objectId);
         } else if (layer.type === 'text' && layer.objectId) {
           addTextToCanvas(layer.data?.content || layer.name, layer.data || {}, canvas, layer.objectId);
         }
       }
       canvas.renderAll();
    };
    sync();
    }

    // CRITICAL: Ensure this page's canvas is the one in the store when active
    if (isActive && fabricCanvasRef.current) {
        setFabricCanvas(fabricCanvasRef.current);
    }

    // --- PREMIUM STYLE CONFIGURATION ---
    const THEME_COLOR = "#8b5cf6"; 
    const HANDLE_SIZE = 12;

    const applyPremiumStyle = (obj: fabric.FabricObject) => {
      obj.set({
        borderColor: THEME_COLOR,
        borderScaleFactor: 2,
        borderDashArray: [],
        transparentCorners: false,
        cornerColor: "#ffffff",
        cornerStrokeColor: THEME_COLOR,
        cornerSize: HANDLE_SIZE,
        cornerStyle: "circle",
        padding: 0,
        borderOpacityWhenMoving: 1,
        strokeUniform: true,
      });

      // Customize rotation handle position (mtr)
      if (obj.controls && obj.controls.mtr) {
        const mtr = obj.controls.mtr;
        mtr.x = 0;
        mtr.y = 0.5;
        (mtr as any).offsetY = 45;
        mtr.withConnection = false;

        // Circular rotation button
        mtr.render = (ctx, left, top) => {
          ctx.save();
          ctx.translate(left, top);
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.15)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.fill();
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Small rotation icon
          ctx.beginPath();
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 2;
          ctx.arc(0, 0, 7, 0.2, Math.PI * 0.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 7, Math.PI + 0.2, Math.PI * 1.8);
          ctx.stroke();
          ctx.restore();
        };
      }

      // Customize side handles (pills)
      const sideControls = ["ml", "mr", "mt", "mb"];
      sideControls.forEach((ctrl) => {
        const control = (obj.controls as any)[ctrl];
        if (control) {
          control.render = (
            ctx: CanvasRenderingContext2D,
            left: number,
            top: number,
            styleOverride: any,
            fabricObject: fabric.FabricObject,
          ) => {
            const isVertical =
              styleOverride.name === "mt" || styleOverride.name === "mb";
            const sizeX = isVertical ? 24 : 6;
            const sizeY = isVertical ? 6 : 24;

            ctx.save();
            ctx.translate(left, top);
            ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect)
              ctx.roundRect(-sizeX / 2, -sizeY / 2, sizeX, sizeY, 10);
            else ctx.rect(-sizeX / 2, -sizeY / 2, sizeX, sizeY);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.strokeStyle = THEME_COLOR;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          };
        }
      });
    };

    // Apply to prototype FOR NEW OBJECTS
    fabric.Object.prototype.set({
      borderColor: THEME_COLOR,
      cornerColor: "#ffffff",
      cornerStrokeColor: THEME_COLOR,
      cornerStyle: "circle",
      transparentCorners: false,
    });

    // Apply to every object when added (Safety net)
    canvas.on("object:added", (e) => applyPremiumStyle(e.target));
    canvas.on("selection:created", (e) =>
      e.selected.forEach(applyPremiumStyle),
    );

    fabricCanvasRef.current = canvas;
    canvas.setZoom(zoom);

    if (isActive) {
      setFabricCanvas(canvas);
    }

    // Context Menu Listener
    canvas.on("contextmenu", (opt) => {
      const { e, target } = opt;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: (e as any).clientX, y: (e as any).clientY });
      } else {
        setContextMenu(null);
      }
    });

    // Initial state save
    saveToHistory(JSON.stringify(canvas.toJSON()));

    // History listeners
    const triggerSave = () => {
      if ((canvas as any).isHistoryLoading) return;
      saveToHistory(JSON.stringify(canvas.toJSON()));
    };

    canvas.on("object:added", triggerSave);
    canvas.on("object:modified", triggerSave);
    canvas.on("object:removed", triggerSave);

    // Selection sync
    const handleSelection = (e: any) => {
      const selected = e.selected || [];
      if (selected.length === 1) {
        const obj = selected[0];
        const layers = useEditorStore.getState().getLayers();
        const layerId = layers.find((l: Layer) => l.objectId === obj.name)?.id;
        selectLayer(layerId || null);
      } else {
        selectLayer(null);
      }
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => selectLayer(null));

    // Mouse Wheel Zoom
    const handleMouseWheel = (opt: any) => {
      const e = opt.e;
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY;
        let newZoom = useEditorStore.getState().canvas.zoom;
        newZoom *= 0.999 ** delta;
        if (newZoom > 5) newZoom = 5;
        if (newZoom < 0.1) newZoom = 0.1;

        // Use the store to update zoom so all pages stay synced
        setZoom(newZoom);

        e.preventDefault();
        e.stopPropagation();
      }
    };
    canvas.on("mouse:wheel", handleMouseWheel);

    // Hand tool logic & Spacebar panning
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on("mouse:down", (opt) => {
      const store = useEditorStore.getState();
      const isSpacePressed = (window as any).isSpacePressed;

      if (store.activeCanvasTool === "hand" || isSpacePressed) {
        isDragging = true;
        canvas.setCursor("grabbing");
        const e = opt.e as any;
        lastPosX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        lastPosY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      }

      if (store.canvas.activePageId !== pageId) {
        setActivePage(pageId);
        setFabricCanvas(canvas);
      }

      // Deselect all if hand tool or space pressed
      if (store.activeCanvasTool === "hand" || isSpacePressed) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });

    canvas.on("mouse:move", (opt) => {
      const isSpacePressed = (window as any).isSpacePressed;
      if (isDragging) {
        const e = opt.e as any;
        const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        const deltaX = clientX - lastPosX;
        const deltaY = clientY - lastPosY;
        lastPosX = clientX;
        lastPosY = clientY;

        const scrollContainer =
          containerRef.current?.closest(".custom-scrollbar");
        if (scrollContainer) {
          scrollContainer.scrollBy(-deltaX, -deltaY);
        } else {
          const fallback = containerRef.current?.closest(".overflow-auto");
          if (fallback) fallback.scrollBy(-deltaX, -deltaY);
        }
      }
    });

    canvas.on("mouse:up", () => {
      if (isDragging) {
        isDragging = false;
        canvas.setCursor(isHandTool ? "grab" : "default");
      }
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Global spacebar listener for panning
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        (e.target as HTMLElement).tagName !== "INPUT" &&
        (e.target as HTMLElement).tagName !== "TEXTAREA"
      ) {
        (window as any).isSpacePressed = true;
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setCursor("grab");
        }
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        (window as any).isSpacePressed = false;
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setCursor(isHandTool ? "grab" : "default");
        }
      }
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [isHandTool]);

  // Sync active canvas to store
  useEffect(() => {
    if (isActive && fabricCanvasRef.current) {
      setFabricCanvas(fabricCanvasRef.current);
    }
  }, [isActive, setFabricCanvas]);

  // Sync store selection -> canvas (Two-way tracking)
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    if (!selectedLayerId) {
      if (canvas.getActiveObjects().length > 0) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const layer = pages
      .find((p) => p.id === pageId)
      ?.layers.find((l) => l.id === selectedLayerId);
    if (!layer || !layer.objectId) {
      if (canvas.getActiveObjects().length > 0) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const obj = canvas.getObjects().find((o: any) => o.name === layer.objectId);
    if (obj) {
      const activeObj = canvas.getActiveObject();
      if (activeObj !== obj) {
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
      }
    } else {
      if (canvas.getActiveObjects().length > 0) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    }
  }, [selectedLayerId, pageId, pages]);

  // Sync dimensions & Zoom & Tool State
  useEffect(() => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      canvas.setDimensions({ width: width * zoom, height: height * zoom });
      canvas.setZoom(zoom);

      // Update interactive properties based on tool
      canvas.selection = !isHandTool;
      canvas.hoverCursor = isHandTool ? "grab" : "move";
      canvas.defaultCursor = isHandTool ? "grab" : "default";

      // Fix Pen Tool: Enable drawing mode
      canvas.isDrawingMode = activeCanvasTool === "pen";
      if (canvas.isDrawingMode) {
        if (!canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }
        canvas.freeDrawingBrush.width = 3;
        canvas.freeDrawingBrush.color = "#8b5cf6";
      }

      canvas.renderAll();
    }
  }, [width, height, zoom, isHandTool, activeCanvasTool, pageId]);

  // Video Sync Logic
  const {
    videoState: {
      isPlaying,
      currentTime,
      startTime,
      endTime,
      playbackRate,
      duration,
    },
    setVideoState,
  } = useEditorStore();

  const getPageLayers = () => {
    return pages.find((p: EditorPage) => p.id === pageId)?.layers || [];
  };

  // 1. Playback Loop (Master Clock)
  useEffect(() => {
    if (!isActive || !isPlaying) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const nextTime = currentTime + dt * playbackRate;

      if (nextTime >= endTime) {
        setVideoState({ currentTime: startTime });
      } else if (nextTime >= duration) {
        setVideoState({ isPlaying: false, currentTime: duration });
      } else {
        setVideoState({ currentTime: nextTime });
      }

      // Force render fabric canvas for smooth playback
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.requestRenderAll();
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isActive,
    isPlaying,
    currentTime,
    duration,
    startTime,
    endTime,
    playbackRate,
    setVideoState,
  ]);

  // 2. Sync Elements for THIS page (only handle what needs changing)
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const layers = getPageLayers();
    const currTime = currentTime ?? 0;
    let needsRender = false;

    layers.forEach((layer: Layer) => {
      const obj = canvas
        .getObjects()
        .find((o: any) => o.name === layer.objectId) as any;

      if (!obj) return; // Object not yet on canvas (being added) — skip

      // --- VIDEO LAYERS: Full sync (seek + play/pause + visibility) ---
      if (
        layer.type === "video" &&
        (obj.getElement || (obj as any)._videoEl)
      ) {
        const layerStart = layer.startTime ?? 0;
        const layerDuration = layer.duration ?? 300;
        const mediaStart = layer.mediaStart ?? 0;
        const safeStart = isNaN(layerStart) ? 0 : layerStart;
        const element = obj.getElement ? obj.getElement() : null;
        const videoEl = ((obj as any)._videoEl ||
          (element?.tagName === "VIDEO" ? element : null)) as HTMLVideoElement | null;
        const safeDuration =
          isNaN(layerDuration) || layerDuration <= 0
            ? videoEl &&
                Number.isFinite(videoEl.duration) &&
                videoEl.duration > 0
              ? videoEl.duration
              : 300
            : layerDuration;
        const layerEnd = safeStart + safeDuration;
        // Use a generous 0.5s epsilon to prevent hiding objects that are effectively at the start
        const shouldShow = currTime >= (safeStart - 0.5) && currTime < layerEnd;
        const videoFrameCanvas = (obj as any)._videoFrameCanvas as HTMLCanvasElement | undefined;
        const videoFrameCtx = (obj as any)._videoFrameCtx as CanvasRenderingContext2D | null | undefined;
        if (!videoEl) return;

        if (shouldShow) {
          const offset = currTime - safeStart;
          const targetTime = mediaStart + offset;
          if (Math.abs(videoEl.currentTime - targetTime) > 0.3) {
            videoEl.currentTime = targetTime;
            needsRender = true; // Force canvas refresh after manual seek to avoid stale white frame.
          }
          if (isPlaying && videoEl.paused) videoEl.play().catch(() => { });
          else if (!isPlaying && !videoEl.paused) videoEl.pause();

          if (
            videoFrameCanvas &&
            videoFrameCtx &&
            videoEl.readyState >= 2
          ) {
            try {
              videoFrameCtx.clearRect(0, 0, videoFrameCanvas.width, videoFrameCanvas.height);
              videoFrameCtx.drawImage(videoEl, 0, 0, videoFrameCanvas.width, videoFrameCanvas.height);
              obj.dirty = true;
              needsRender = true;
            } catch {
              // Ignore transient frame draw errors while seeking.
            }
          }

          if (!obj.visible) {
            obj.visible = true;
            obj.opacity = 1;
            obj.dirty = true;
            needsRender = true;
          }
        } else {
          if (!videoEl.paused) videoEl.pause();
          if (obj.visible) {
            obj.visible = false;
            obj.opacity = 0;
            obj.dirty = true;
            needsRender = true;
          }
        }
        return;
      }

      // --- NON-VIDEO LAYERS: Only hide if provably out of time range ---
      // Do NOT touch objects that have no time data — they are always visible
      const hasTimeData =
        layer.startTime !== undefined && layer.duration !== undefined;
      if (!hasTimeData) return; // no time metadata — always visible, skip

      const layerStart = layer.startTime!;
      const layerDuration = layer.duration!;
      if (isNaN(layerStart) || isNaN(layerDuration) || layerDuration <= 0)
        return; // invalid — skip

      const layerEnd = layerStart + layerDuration;
      // Use a generous 0.5s epsilon to avoid floating point race conditions hiding layers prematurely
      const shouldShow = (currTime >= layerStart - 0.5) && (currTime < layerEnd);

      if (obj.visible !== shouldShow) {
        console.log(`[SYNC] Visibility for ${obj.name}: ${obj.visible} -> ${shouldShow}`);
        obj.visible = shouldShow;
        obj.opacity = shouldShow ? 1 : 0;
        obj.dirty = true;
        needsRender = true;
      }
    });

    if (needsRender) {
      console.log("[SYNC] Needs render...");
      canvas.requestRenderAll();
    }
  }, [currentTime, isPlaying, pageId, pages]);

  return (
    <div className="flex flex-col items-center gap-6" suppressHydrationWarning>
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={cn(
          "relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 group",
          isActive
            ? "ring-[6px] ring-[#8b5cf6]/10 border-[#8b5cf6]/30"
            : "hover:shadow-2xl border-transparent",
        )}
        style={{
          width: width * zoom,
          height: height * zoom,
          overflow: "visible",
          zIndex: 1,
        }}
        onClick={() => {
          if (!isActive) {
            setActivePage(pageId);
          }
          if (fabricCanvasRef.current) {
            setFabricCanvas(fabricCanvasRef.current);
          }
        }}
      >
        <canvas ref={canvasRef} />

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Floating Page Controls */}
        <div
          className={cn(
            "absolute -right-14 top-0 flex flex-col gap-2 transition-all duration-300",
            isActive
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 bg-white shadow-xl rounded-xl text-gray-500 hover:text-[#8b5cf6] hover:bg-[#8b5cf6]/5 border border-gray-100 active:scale-90 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              duplicatePage(pageId);
            }}
            title="Duplicate Page"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 bg-white shadow-xl rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50/50 border border-gray-100 active:scale-90 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              deletePage(pageId);
            }}
            title="Delete Page"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Art board size label (Now at bottom) */}
      <div className="flex flex-col items-center gap-1 mt-6">
        {isEditingName ? (
          <div className="flex items-center bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 gap-1">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameEditComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameEditComplete();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              autoFocus
              className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] bg-transparent outline-none w-24 text-center border-b border-gray-300"
              spellCheck={false}
            />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">
              • {width}x{height}
            </span>
          </div>
        ) : (
          <span
            className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 cursor-text hover:border-gray-300 transition-colors"
            onClick={handleNameClick}
            title="Click to rename page"
          >
            {pageName} <span className="mx-1">•</span> {width}x{height}
          </span>
        )}
      </div>

      {/* Add Page Button */}
      {isActive && (
        <button
          onClick={addPage}
          className="mt-6 w-12 h-12 flex items-center justify-center bg-white text-gray-400 hover:text-[#8b5cf6] hover:scale-110 border border-gray-200 rounded-2xl transition-all shadow-xl active:scale-95 group"
          title="Add new page"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}

export function ZoomControls() {
  const {
    canvas: { zoom },
    setZoom,
  } = useEditorStore();

  const zoomLevels = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

  const handleZoomIn = () => {
    const nextZoom = zoomLevels.find((v) => v > zoom) || 5;
    setZoom(nextZoom);
  };

  const handleZoomOut = () => {
    const prevZoom = [...zoomLevels].reverse().find((v) => v < zoom) || 0.1;
    setZoom(prevZoom);
  };

  return (
    <div className="absolute bottom-6 right-6 flex items-center gap-1.5 bg-[#111111]/90 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        onClick={handleZoomOut}
      >
        <Minus className="w-4 h-4" />
      </Button>

      <div className="px-3 min-w-[70px] text-center border-x border-white/10">
        <span className="text-[13px] font-black text-white tabular-nums tracking-tight">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        onClick={handleZoomIn}
      >
        <Plus className="w-4 h-4" />
      </Button>

      <div className="w-px h-4 bg-white/10 mx-1" />

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        onClick={() => setZoom(1)}
        title="Reset Zoom"
      >
        <LayoutGrid className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    canvas: { pages, width, height },
    setZoom,
  } = useEditorStore();

  // Auto-zoom to fit container using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const updateZoom = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } =
          entry.contentRect;

        if (containerWidth <= 0 || containerHeight <= 0) return;

        // Gap calculations: Ensure a minimum 40px gap
        const padding = 120;
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        if (availableWidth > 0 && availableHeight > 0) {
          const scaleX = availableWidth / width;
          const scaleY = availableHeight / height;

          // Fit to screen, but don't explode it too much on ultra-wide screens
          const scale = Math.min(scaleX, scaleY, 1.1);
          setZoom(Number(scale.toFixed(2)));
        }
      }
    };

    const observer = new ResizeObserver(updateZoom);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [width, height, setZoom]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const url = e.dataTransfer.getData("text/plain");

    const store = useEditorStore.getState();
    const { addMediaFromUrl } = await import("@/lib/editor-utils");

    if (files.length > 0) {
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            await addMediaFromUrl(
              dataUrl,
              store,
              file.type.startsWith("video/") ? "video" : "image",
            );
          }
        };
        reader.readAsDataURL(file);
      }
    } else if (url && (url.startsWith("http") || url.startsWith("data:"))) {
      await addMediaFromUrl(url.trim(), store);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 overflow-auto bg-[#f1f3f6] custom-scrollbar relative block"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: `radial-gradient(#d1d5db 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Scrollable Content wrapper */}
      <div className="min-h-full min-w-full flex flex-col items-center justify-start py-32 relative z-10">
        <div className="flex flex-col items-center gap-24">
          {pages.map((page: EditorPage, index: number) => (
            <PageCanvas key={page.id} pageId={page.id} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
