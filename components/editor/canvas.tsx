"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as fabric from "fabric";
import { useEditorStore, Layer, EditorPage } from "@/lib/store";
import { Plus, Trash2, Minus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContextMenu } from "./context-menu";
import {
  attachVideoOverlay,
  setVideoOverlayVisibility,
  syncVideoOverlays,
} from "@/lib/video-overlay";
import {
  EDITOR_DRAG_MIME_TYPE,
  addEmojiToCanvas,
  addShapeToCanvas,
} from "./tools/shapes-tool";
import {
  addMediaFromUrl,
  applyPersistedLayerState,
  PHOTO_DRAG_MIME_TYPE,
} from "@/lib/editor-utils";

interface PageCanvasProps {
  pageId: string;
  index: number;
}

const MIN_PASTEBOARD_MARGIN = 360;
const MAX_PASTEBOARD_MARGIN = 900;

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
    penSettings,
    setFabricCanvas,
    selectLayer,
    setActivePage,
    deletePage,
    addPage,
    renamePage,
    setPageArtboardPosition,
    undo,
    redo,
    saveToHistory,
    setZoom,
  } = useEditorStore();

  const page = pages.find((p) => p.id === pageId);
  const pageName = page?.name || `Page ${index + 1}`;
  const pageWidth = page?.width ?? width;
  const pageHeight = page?.height ?? height;
  const artboardX = page?.artboardX ?? 0;
  const artboardY = page?.artboardY ?? 0;
  const pasteboardMargin = Math.max(
    MIN_PASTEBOARD_MARGIN,
    Math.min(MAX_PASTEBOARD_MARGIN, Math.max(pageWidth, pageHeight) * 0.5),
  );
  const pasteboardWidth = pageWidth + pasteboardMargin * 2;
  const pasteboardHeight = pageHeight + pasteboardMargin * 2;

  const isActive = activePageId === pageId;
  const isHandTool = activeCanvasTool === "hand";

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const drawingRedoStackRef = useRef<fabric.FabricObject[]>([]);

  const registerActiveCanvas = useCallback(
    (canvas: fabric.Canvas) => {
      const state = useEditorStore.getState();
      if (
        state.canvas.activePageId === pageId &&
        !canvas.disposed &&
        !canvas.destroyed &&
        canvas.lowerCanvasEl?.isConnected
      ) {
        setFabricCanvas(canvas);
      }
    },
    [pageId, setFabricCanvas],
  );

  const handleToolDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    const payloadText = event.dataTransfer.getData(EDITOR_DRAG_MIME_TYPE);
    const photoPayloadText = event.dataTransfer.getData(PHOTO_DRAG_MIME_TYPE);
    if ((!payloadText && !photoPayloadText) || !fabricCanvasRef.current) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    let payload:
      | { kind: "shape"; type: string }
      | { kind: "emoji"; emoji: string }
      | null = null;
    let photoPayload: { url: string; name: string } | null = null;

    try {
      if (payloadText) payload = JSON.parse(payloadText);
      if (photoPayloadText) photoPayload = JSON.parse(photoPayloadText);
    } catch {
      return true;
    }

    const canvas = fabricCanvasRef.current;
    if (!isActive) {
      setActivePage(pageId);
      setFabricCanvas(canvas);
    } else {
      setFabricCanvas(canvas);
    }

    const pointer = canvas.getPointer(event.nativeEvent as any);
    const position = { left: pointer.x, top: pointer.y };

    if (photoPayload) {
      await addMediaFromUrl(
        photoPayload.url,
        useEditorStore.getState(),
        "image",
        false,
        undefined,
        photoPayload.name,
        canvas,
        position,
      );
    } else if (payload?.kind === "shape") {
      addShapeToCanvas(payload.type, position);
    } else if (payload?.kind === "emoji") {
      addEmojiToCanvas(payload.emoji, position);
    }

    return true;
  };

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
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping) return;

      if (isCmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (isShift) {
          redo();
        } else {
          undo();
        }
      } else if (isCmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const canvas = useEditorStore.getState().canvas.fabricCanvas;
        const activeObjects = canvas?.getActiveObjects() || [];
        if (!canvas || activeObjects.length === 0) return;

        e.preventDefault();
        const layers = useEditorStore.getState().getLayers();
        const step = isShift ? 10 : 1;
        const delta = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        }[e.key]!;

        activeObjects.forEach((obj) => {
          const layer = layers.find((item) => item.objectId === (obj as any).name);
          if (layer?.locked) return;

          obj.set({
            left: (obj.left || 0) + delta.x,
            top: (obj.top || 0) + delta.y,
          });
          obj.setCoords();
        });
        canvas.requestRenderAll();
        saveToHistory(JSON.stringify(canvas.toJSON()));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete if editing text or typing in input
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
      width: pasteboardWidth * zoom,
      height: pasteboardHeight * zoom,
      // REMOVED backgroundColor so it doesn't cover objects
      selection: !isHandTool,
      selectionKey: ["ctrlKey", "metaKey"] as any,
      preserveObjectStacking: true,
      hoverCursor: isHandTool ? "grab" : "move",
    });
    (canvas as any).artboardExportBounds = {
      left: (pasteboardMargin + artboardX) * zoom,
      top: (pasteboardMargin + artboardY) * zoom,
      width: pageWidth * zoom,
      height: pageHeight * zoom,
    };

    fabricCanvasRef.current = canvas;
    const currentEditorState = useEditorStore.getState();
    const shouldRegisterCanvas =
      currentEditorState.canvas.activePageId === pageId ||
      (!currentEditorState.canvas.fabricCanvas && index === 0);

    if (shouldRegisterCanvas) {
      if (currentEditorState.canvas.activePageId !== pageId) {
        setActivePage(pageId);
      }
      registerActiveCanvas(canvas);
    }

    // Sync layers FROM state TO new canvas (important for remounting)
    const page = pages.find(p => p.id === pageId);
    if (page?.layers) {
      // CRITICAL: Rebuild canvas from store layers if needed (survives UI remounts)
      const sync = async () => {
        const page = pages.find(p => p.id === pageId);
        if (!page?.layers) return;
        const { addMediaFromUrl, addTextToCanvas } = await import("@/lib/editor-utils");

        for (const layer of page.layers) {
          // Prevent double-adding if already on canvas
          if (canvas.getObjects().some((o: any) => o.name === layer.objectId)) continue;

          if ((layer.type === 'image' || layer.type === 'sticker' || layer.type === "video") && layer.data?.url) {
            const objectId = await addMediaFromUrl(
              layer.data.url,
              useEditorStore.getState(),
              layer.type as any,
              true,
              layer.objectId,
              layer.data?.name || layer.name,
              canvas,
            );
            const object = canvas
              .getObjects()
              .find((candidate: any) => candidate.name === objectId);
            if (object) applyPersistedLayerState(object, layer);
          } else if (layer.type === 'text' && layer.objectId) {
            const object = addTextToCanvas(
              layer.data?.content || layer.name,
              layer.data || {},
              canvas,
              layer.objectId,
            );
            applyPersistedLayerState(object, layer);
          }
        }
        canvas.renderAll();
      };
      sync();
    }

    // CRITICAL: Ensure this page's canvas is the one in the store when active
    if (shouldRegisterCanvas && fabricCanvasRef.current) {
      registerActiveCanvas(fabricCanvasRef.current);
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
    const syncNativeVideoLayers = () => syncVideoOverlays(canvas);
    canvas.on("after:render", syncNativeVideoLayers);

    fabricCanvasRef.current = canvas;
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (pasteboardMargin + artboardX) * zoom,
      (pasteboardMargin + artboardY) * zoom,
    ]);

    if (isActive) registerActiveCanvas(canvas);

    const registrationFrame = requestAnimationFrame(() => {
      registerActiveCanvas(canvas);
    });

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
    const isTransientCropObject = (target?: any) =>
      target?.excludeFromExport ||
      (typeof target?.name === "string" && target.name.startsWith("crop_overlay_"));
    const isTransientGuideObject = (target?: any) =>
      typeof target?.name === "string" && target.name.startsWith("smart_guide_");

    const runTransientCanvasMutation = (mutator: () => void) => {
      const previousHistoryState = (canvas as any).isHistoryLoading;
      (canvas as any).isHistoryLoading = true;
      try {
        mutator();
        canvas.requestRenderAll();
      } finally {
        (canvas as any).isHistoryLoading = previousHistoryState;
      }
    };

    const triggerSave = (event?: any) => {
      if ((canvas as any).isHistoryLoading) return;
      if (isTransientCropObject(event?.target) || isTransientGuideObject(event?.target)) return;
      saveToHistory(JSON.stringify(canvas.toJSON()));
    };

    let resizingImage: fabric.FabricObject | null = null;
    let movingImage: fabric.FabricObject | null = null;
    const triggerModifiedSave = (event?: any) => {
      if (
        (resizingImage && event?.target === resizingImage) ||
        (movingImage && event?.target === movingImage)
      ) {
        return;
      }
      triggerSave(event);
    };

    canvas.on("object:added", triggerSave);
    canvas.on("object:modified", triggerModifiedSave);
    canvas.on("object:removed", triggerSave);

    let artboardResizeFrame: number | null = null;
    let moveStartArtboard = { x: artboardX, y: artboardY };
    const clampArtboardPosition = (value: number) =>
      Math.max(-pasteboardMargin, Math.min(pasteboardMargin, value));
    const syncPhotoArtboardToImage = (
      target: fabric.FabricObject | undefined,
      alignImage = false,
    ) => {
      if (!target || useEditorStore.getState().editorMode !== "photo") return;

      const state = useEditorStore.getState();
      const imageLayers = state
        .getLayers()
        .filter((item) => item.type === "image");
      if (imageLayers[0]?.objectId !== (target as any).name) return;

      const nextWidth = Math.max(1, Math.round(target.getScaledWidth()));
      const nextHeight = Math.max(1, Math.round(target.getScaledHeight()));

      if (alignImage) {
        target.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
        });
        target.setCoords();
      }

      const activePage = state.canvas.pages.find(
        (candidate) => candidate.id === state.canvas.activePageId,
      );
      if (
        activePage?.width !== nextWidth ||
        activePage?.height !== nextHeight
      ) {
        state.setCanvas({ width: nextWidth, height: nextHeight });
      }
    };

    const handlePhotoImageScaling = (event: any) => {
      resizingImage = event?.target || null;
      (canvas as any).isArtboardResizing = Boolean(resizingImage);
      if (artboardResizeFrame !== null) {
        cancelAnimationFrame(artboardResizeFrame);
      }
      artboardResizeFrame = requestAnimationFrame(() => {
        artboardResizeFrame = null;
        syncPhotoArtboardToImage(event?.target);
      });
    };

    const handlePhotoImageResizeComplete = (event: any) => {
      if (!resizingImage || event?.target !== resizingImage) return;
      if (artboardResizeFrame !== null) {
        cancelAnimationFrame(artboardResizeFrame);
        artboardResizeFrame = null;
      }
      syncPhotoArtboardToImage(event?.target, true);
      resizingImage = null;
      (canvas as any).isArtboardResizing = false;
      canvas.requestRenderAll();
      triggerSave(event);
    };

    canvas.on("object:scaling", handlePhotoImageScaling);
    canvas.on("object:modified", handlePhotoImageResizeComplete);

    const getPhotoImageLayer = (target?: fabric.FabricObject) => {
      if (!target || useEditorStore.getState().editorMode !== "photo") {
        return null;
      }
      return (
        useEditorStore
          .getState()
          .getLayers()
          .find((item) => item.objectId === (target as any).name) || null
      );
    };

    const isPrimaryPhotoImage = (target?: fabric.FabricObject) => {
      if (getPhotoImageLayer(target)?.type !== "image" || !target) return false;
      return (
        useEditorStore
          .getState()
          .getLayers()
          .filter((item) => item.type === "image")[0]?.objectId ===
        (target as any).name
      );
    };

    const handlePhotoImageMoving = (event: any) => {
      const target = event?.target as fabric.FabricObject | undefined;
      if (!isPrimaryPhotoImage(target) || !target) return;

      if (movingImage !== target) {
        movingImage = target;
        const currentPage = useEditorStore
          .getState()
          .canvas.pages.find((candidate) => candidate.id === pageId);
        moveStartArtboard = {
          x: currentPage?.artboardX ?? 0,
          y: currentPage?.artboardY ?? 0,
        };
      }

      const nextX = clampArtboardPosition(
        moveStartArtboard.x + Number(target.left || 0),
      );
      const nextY = clampArtboardPosition(
        moveStartArtboard.y + Number(target.top || 0),
      );
      const liveZoom = canvas.getZoom() || 1;
      const artboard = containerRef.current?.querySelector<HTMLElement>(
        `[data-artboard-for="${pageId}"]`,
      );
      if (artboard) {
        artboard.style.left = `${(pasteboardMargin + nextX) * liveZoom}px`;
        artboard.style.top = `${(pasteboardMargin + nextY) * liveZoom}px`;
      }
      const controls = containerRef.current?.querySelector<HTMLElement>(
        `[data-artboard-controls-for="${pageId}"]`,
      );
      if (controls) {
        controls.style.left = `${
          (pasteboardMargin + nextX + pageWidth) * liveZoom + 14
        }px`;
        controls.style.top = `${(pasteboardMargin + nextY) * liveZoom}px`;
      }
      const label = containerRef.current?.parentElement?.querySelector<HTMLElement>(
        `[data-artboard-label-for="${pageId}"]`,
      );
      if (label) {
        label.style.marginTop = `${
          -pasteboardMargin * liveZoom + 24 + nextY * liveZoom
        }px`;
        label.style.transform = `translateX(${nextX * liveZoom}px)`;
      }
    };

    const handlePhotoImageMoveComplete = (event: any) => {
      const target = event?.target as fabric.FabricObject | undefined;
      if (!target || movingImage !== target) return;

      const nextX = clampArtboardPosition(
        moveStartArtboard.x + Number(target.left || 0),
      );
      const nextY = clampArtboardPosition(
        moveStartArtboard.y + Number(target.top || 0),
      );
      const liveZoom = canvas.getZoom() || 1;
      const currentPage = useEditorStore
        .getState()
        .canvas.pages.find((candidate) => candidate.id === pageId);
      target.set({ left: 0, top: 0, originX: "left", originY: "top" });
      target.setCoords();
      canvas.setViewportTransform([
        liveZoom,
        0,
        0,
        liveZoom,
        (pasteboardMargin + nextX) * liveZoom,
        (pasteboardMargin + nextY) * liveZoom,
      ]);
      (canvas as any).artboardExportBounds = {
        left: (pasteboardMargin + nextX) * liveZoom,
        top: (pasteboardMargin + nextY) * liveZoom,
        width: Number(currentPage?.width || pageWidth) * liveZoom,
        height: Number(currentPage?.height || pageHeight) * liveZoom,
      };
      setPageArtboardPosition(pageId, nextX, nextY);
      movingImage = null;
      canvas.requestRenderAll();
      triggerSave(event);
    };

    canvas.on("object:moving", handlePhotoImageMoving);
    canvas.on("object:modified", handlePhotoImageMoveComplete);

    canvas.on("path:created", (event: any) => {
      const path = event?.path as any;
      if (!path) return;
      path.set({
        name: path.name || `markup_${Date.now()}`,
        data: {
          ...(path.data || {}),
          isMarkup: true,
        },
      });
      drawingRedoStackRef.current = [];
    });

    // Smart guides (Canva-like center + object alignment while moving)
    const SMART_GUIDE_THRESHOLD = 6;
    let guideAnimationFrame: number | null = null;
    let pendingGuide: { x: number | null; y: number | null } | null = null;
    let isGuideVisible = false;
    let guideCandidates:
      | {
        target: fabric.FabricObject;
        xs: number[];
        ys: number[];
      }
      | null = null;

    const clearSmartGuides = () => {
      if (!pendingGuide && guideAnimationFrame === null && !isGuideVisible) {
        return;
      }

      pendingGuide = null;
      if (guideAnimationFrame !== null) {
        cancelAnimationFrame(guideAnimationFrame);
        guideAnimationFrame = null;
      }
      if (canvas.contextTop) {
        canvas.clearContext(canvas.contextTop);
      }
      isGuideVisible = false;
    };

    const getCanvasLogicalSize = () => ({
      width: pageWidth,
      height: pageHeight,
      zoom: canvas.getZoom() || 1,
    });

    const drawSmartGuides = (x: number | null, y: number | null) => {
      pendingGuide = { x, y };
      if (guideAnimationFrame !== null) return;

      guideAnimationFrame = requestAnimationFrame(() => {
        guideAnimationFrame = null;
        const guide = pendingGuide;
        const ctx = canvas.contextTop;
        if (!guide || !ctx) return;

        const { width: logicalWidth, height: logicalHeight, zoom } =
          getCanvasLogicalSize();
        const transform = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

        canvas.clearContext(ctx);
        isGuideVisible = true;
        ctx.save();
        ctx.transform(
          transform[0],
          transform[1],
          transform[2],
          transform[3],
          transform[4],
          transform[5],
        );
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.beginPath();

        if (guide.x !== null) {
          ctx.moveTo(guide.x, 0);
          ctx.lineTo(guide.x, logicalHeight);
        }
        if (guide.y !== null) {
          ctx.moveTo(0, guide.y);
          ctx.lineTo(logicalWidth, guide.y);
        }

        ctx.stroke();
        ctx.restore();
      });
    };

    const getBoundsAxes = (obj: fabric.FabricObject) => {
      const bounds = obj.getBoundingRect();
      const left = bounds.left;
      const top = bounds.top;
      const right = bounds.left + bounds.width;
      const bottom = bounds.top + bounds.height;
      const centerX = left + bounds.width / 2;
      const centerY = top + bounds.height / 2;

      return { left, right, centerX, top, bottom, centerY };
    };

    const resetGuideCandidates = () => {
      guideCandidates = null;
    };

    const getGuideCandidates = (movingObject: fabric.FabricObject) => {
      if (guideCandidates?.target === movingObject) {
        return guideCandidates;
      }

      const { width: logicalWidth, height: logicalHeight } =
        getCanvasLogicalSize();
      const xs: number[] = [logicalWidth / 2];
      const ys: number[] = [logicalHeight / 2];

      canvas.getObjects().forEach((obj) => {
        if (
          obj === movingObject ||
          isTransientCropObject(obj) ||
          isTransientGuideObject(obj)
        ) {
          return;
        }
        const axes = getBoundsAxes(obj);
        xs.push(axes.left, axes.centerX, axes.right);
        ys.push(axes.top, axes.centerY, axes.bottom);
      });

      guideCandidates = { target: movingObject, xs, ys };
      return guideCandidates;
    };

    canvas.on("object:moving", (evt) => {
      const movingObject = evt.target as fabric.FabricObject | undefined;
      if (!movingObject || isTransientCropObject(movingObject) || isTransientGuideObject(movingObject)) {
        return;
      }

      const { xs: candidateXs, ys: candidateYs } =
        getGuideCandidates(movingObject);

      const movingAxes = getBoundsAxes(movingObject);
      const movingXPoints = [movingAxes.left, movingAxes.centerX, movingAxes.right];
      const movingYPoints = [movingAxes.top, movingAxes.centerY, movingAxes.bottom];

      let snapDx = 0;
      let snapDy = 0;
      let snappedX: number | null = null;
      let snappedY: number | null = null;
      let minDx = Number.POSITIVE_INFINITY;
      let minDy = Number.POSITIVE_INFINITY;

      for (const movingX of movingXPoints) {
        for (const candidateX of candidateXs) {
          const dx = candidateX - movingX;
          const absDx = Math.abs(dx);
          if (absDx < minDx && absDx <= SMART_GUIDE_THRESHOLD) {
            minDx = absDx;
            snapDx = dx;
            snappedX = candidateX;
          }
        }
      }

      for (const movingY of movingYPoints) {
        for (const candidateY of candidateYs) {
          const dy = candidateY - movingY;
          const absDy = Math.abs(dy);
          if (absDy < minDy && absDy <= SMART_GUIDE_THRESHOLD) {
            minDy = absDy;
            snapDy = dy;
            snappedY = candidateY;
          }
        }
      }

      if (snapDx !== 0 || snapDy !== 0) {
        movingObject.set({
          left: (movingObject.left || 0) + snapDx,
          top: (movingObject.top || 0) + snapDy,
        });
        movingObject.setCoords();
      }

      if (snappedX !== null || snappedY !== null) {
        drawSmartGuides(snappedX, snappedY);
      } else {
        clearSmartGuides();
      }
    });

    canvas.on("object:modified", () => {
      resetGuideCandidates();
      clearSmartGuides();
    });

    // Selection sync
    const syncObjectSelectionToLayer = (obj: any) => {
      if (!obj || isTransientCropObject(obj)) return;
      const layers = useEditorStore.getState().getLayers();
      const layerId = layers.find((l: Layer) => l.objectId === obj.name)?.id;
      selectLayer(layerId || null);
    };

    const handleSelection = () => {
      const activeObjects = canvas.getActiveObjects() || [];
      if (activeObjects.length === 1) {
        syncObjectSelectionToLayer(activeObjects[0]);
      } else {
        selectLayer(null);
      }
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => {
      resetGuideCandidates();
      clearSmartGuides();
      selectLayer(null);
    });

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
    let isErasing = false;
    let lastPosX = 0;
    let lastPosY = 0;
    const eraseMarkupAtPointer = (opt: any) => {
      const target = canvas.findTarget(opt.e);
      if (!target) return;
      const isMarkup = Boolean((target as any).data?.isMarkup);
      if (!isMarkup) return;
      drawingRedoStackRef.current.push(target);
      runTransientCanvasMutation(() => {
        canvas.remove(target);
      });
      triggerSave({ target });
    };

    const handleDrawingUndo = () => {
      const markupObjects = canvas
        .getObjects()
        .filter((obj: any) => Boolean(obj?.data?.isMarkup));
      const lastMarkup = markupObjects[markupObjects.length - 1];
      if (!lastMarkup) return;

      drawingRedoStackRef.current.push(lastMarkup);
      runTransientCanvasMutation(() => {
        canvas.remove(lastMarkup);
      });
      triggerSave({ target: lastMarkup });
    };

    const handleDrawingRedo = () => {
      const redoTarget = drawingRedoStackRef.current.pop();
      if (!redoTarget) return;

      runTransientCanvasMutation(() => {
        canvas.add(redoTarget);
        canvas.bringObjectToFront(redoTarget);
      });
      triggerSave({ target: redoTarget });
    };

    window.addEventListener("editor:drawing-undo", handleDrawingUndo);
    window.addEventListener("editor:drawing-redo", handleDrawingRedo);

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

      if (store.activeCanvasTool === "pen" && store.penSettings.mode === "eraser") {
        isErasing = true;
        eraseMarkupAtPointer(opt);
      }

      const isMultiSelectModifier =
        Boolean((opt.e as any)?.ctrlKey) || Boolean((opt.e as any)?.metaKey);
      if (
        opt.target &&
        store.activeCanvasTool !== "hand" &&
        !isSpacePressed &&
        !isMultiSelectModifier
      ) {
        syncObjectSelectionToLayer(opt.target);
      }

      // Deselect all if hand tool or space pressed
      if (store.activeCanvasTool === "hand" || isSpacePressed) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });

    canvas.on("mouse:move", (opt) => {
      const store = useEditorStore.getState();
      const isSpacePressed = (window as any).isSpacePressed;
      if (store.activeCanvasTool === "pen" && store.penSettings.mode === "eraser" && isErasing) {
        eraseMarkupAtPointer(opt);
      }
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
      resetGuideCandidates();
      clearSmartGuides();
      isErasing = false;
      if (isDragging) {
        isDragging = false;
        const currentTool = useEditorStore.getState().activeCanvasTool;
        canvas.setCursor(currentTool === "hand" ? "grab" : "default");
      }
    });

    return () => {
      cancelAnimationFrame(registrationFrame);
      if (artboardResizeFrame !== null) {
        cancelAnimationFrame(artboardResizeFrame);
      }
      window.removeEventListener("editor:drawing-undo", handleDrawingUndo);
      window.removeEventListener("editor:drawing-redo", handleDrawingRedo);
      canvas.off("object:scaling", handlePhotoImageScaling);
      canvas.off("object:modified", handlePhotoImageResizeComplete);
      canvas.off("object:moving", handlePhotoImageMoving);
      canvas.off("object:modified", handlePhotoImageMoveComplete);
      canvas.off("after:render", syncNativeVideoLayers);
      clearSmartGuides();
      if (useEditorStore.getState().canvas.fabricCanvas === canvas) {
        setFabricCanvas(null);
      }
      canvas.getObjects().forEach((object: any) => {
        object._disposeVideo?.();
      });
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
      registerActiveCanvas(fabricCanvasRef.current);
    }
  }, [isActive, registerActiveCanvas]);

  // Sync store selection -> canvas (Two-way tracking)
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    if (!selectedLayerId) {
      // Preserve multi-selection (ActiveSelection) when no single layer is selected.
      // We intentionally set selectedLayerId to null for multi-select.
      if (canvas.getActiveObjects().length === 1) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const layer = pages
      .find((p) => p.id === pageId)
      ?.layers.find((l) => l.id === selectedLayerId);
    if (!layer || !layer.objectId) {
      if (canvas.getActiveObjects().length === 1) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const obj = canvas.getObjects().find((o: any) => o.name === layer.objectId);
    if (obj) {
      if (layer.visible === false) {
        return;
      }

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
      canvas.setDimensions({
        width: pasteboardWidth * zoom,
        height: pasteboardHeight * zoom,
      });
      canvas.setViewportTransform([
        zoom,
        0,
        0,
        zoom,
        (pasteboardMargin + artboardX) * zoom,
        (pasteboardMargin + artboardY) * zoom,
      ]);
      (canvas as any).artboardExportBounds = {
        left: (pasteboardMargin + artboardX) * zoom,
        top: (pasteboardMargin + artboardY) * zoom,
        width: pageWidth * zoom,
        height: pageHeight * zoom,
      };
      syncVideoOverlays(canvas);

      // Update interactive properties based on tool
      canvas.selection = !isHandTool;
      (canvas as any).selectionKey = ["ctrlKey", "metaKey"];
      canvas.hoverCursor = isHandTool ? "grab" : "move";
      canvas.defaultCursor = isHandTool ? "grab" : "default";

      // Fix Pen Tool: Enable drawing mode
      canvas.isDrawingMode = activeCanvasTool === "pen" && penSettings.mode === "brush";
      if (canvas.isDrawingMode) {
        if (!canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }
        canvas.freeDrawingBrush.width = penSettings.width;
        canvas.freeDrawingBrush.color = penSettings.color;
      }
      if (activeCanvasTool === "pen" && penSettings.mode === "eraser") {
        canvas.defaultCursor = "cell";
        canvas.hoverCursor = "cell";
      }

      canvas.renderAll();
    }
  }, [pageWidth, pageHeight, pasteboardWidth, pasteboardHeight, pasteboardMargin, artboardX, artboardY, zoom, isHandTool, activeCanvasTool, pageId, penSettings]);

  // Video Sync Logic
  const {
    videoState: {
      isPlaying,
      currentTime,
      startTime,
      endTime,
      playbackRate,
      duration,
      isMuted,
      volume,
    },
    setVideoState,
  } = useEditorStore();

  const playbackTimeRef = useRef(currentTime ?? 0);
  const lastCommittedPlaybackTimeRef = useRef(currentTime ?? 0);
  const wasPlayingRef = useRef(false);
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    const audioLayers =
      pages
        .find((page: EditorPage) => page.id === pageId)
        ?.layers.filter((layer: Layer) => layer.type === "audio") || [];
    const activeIds = new Set(audioLayers.map((layer) => layer.id));

    audioLayers.forEach((layer) => {
      const url = layer.data?.url;
      if (!url || audioElementsRef.current.has(layer.id)) return;

      const audio = new Audio(url);
      audio.preload = "auto";
      audioElementsRef.current.set(layer.id, audio);
    });

    audioElementsRef.current.forEach((audio, layerId) => {
      if (activeIds.has(layerId)) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioElementsRef.current.delete(layerId);
    });

    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
      });
    };
  }, [pages, pageId]);

  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });
      audioElementsRef.current.clear();
    };
  }, []);

  const syncTimedObjects = useCallback(
    (
      timelineTime: number,
      options: { forceSeek?: boolean; allowPlayback?: boolean; drawFrame?: boolean } = {},
    ) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return false;

      const layers = pages.find((p: EditorPage) => p.id === pageId)?.layers || [];
      const currTime = Number.isFinite(timelineTime) ? timelineTime : 0;
      let needsRender = false;
      const processedVideoObjects = new Set<string>();
      const videoLayers = layers.filter(
        (candidate: Layer) => candidate.type === "video",
      );
      const activeTimelineVideo = videoLayers.find((candidate: Layer) => {
        const candidateStart = Number(candidate.startTime || 0);
        const candidateEnd =
          candidateStart + Number(candidate.duration || 0);
        return currTime >= candidateStart - 0.1 && currTime < candidateEnd;
      });
      const retainedTimelineVideo = activeTimelineVideo
        ? null
        : videoLayers
            .filter(
              (candidate: Layer) =>
                currTime >=
                Number(candidate.startTime || 0) +
                  Number(candidate.duration || 0),
            )
            .sort(
              (left: Layer, right: Layer) =>
                Number(right.startTime || 0) - Number(left.startTime || 0),
            )[0];

      layers.forEach((layer: Layer) => {
        if (layer.type === "audio") {
          const audio = audioElementsRef.current.get(layer.id);
          if (!audio) return;

          const layerStart = Number(layer.startTime || 0);
          const layerDuration = Number(layer.duration || 0);
          const mediaStart = Number(layer.mediaStart || 0);
          const sourceDuration = Number(layer.data?.sourceDuration || 0);
          const shouldLoop = Boolean(layer.data?.loop && sourceDuration > 0);
          const shouldPlay =
            currTime >= layerStart && currTime < layerStart + layerDuration;
          const rawTargetTime = Math.max(
            0,
            mediaStart + currTime - layerStart,
          );
          const targetTime = shouldLoop
            ? rawTargetTime % sourceDuration
            : rawTargetTime;
          const layerVolume = Math.min(
            1,
            Math.max(0, Number(layer.data?.volume ?? 1)),
          );

          audio.volume = layerVolume;
          audio.playbackRate = playbackRate || 1;
          audio.loop = shouldLoop;

          if (shouldPlay) {
            const shouldSeek =
              options.forceSeek ||
              !isPlaying ||
              audio.ended ||
              Math.abs(audio.currentTime - targetTime) > 0.2;
            if (shouldSeek && Number.isFinite(targetTime)) {
              try {
                audio.currentTime = targetTime;
              } catch {
                // Metadata may still be loading; the next sync will retry.
              }
            }
            if (
              isActive &&
              options.allowPlayback !== false &&
              isPlaying &&
              audio.paused
            ) {
              audio.play().catch(() => { });
            } else if (
              (!isActive || !isPlaying || options.allowPlayback === false) &&
              !audio.paused
            ) {
              audio.pause();
            }
          } else if (!audio.paused) {
            audio.pause();
          }
          return;
        }

        const obj = canvas
          .getObjects()
          .find((o: any) => o.name === layer.objectId) as any;

        if (!obj) return;

        if (
          layer.type === "video" &&
          (obj.getElement || (obj as any)._videoEl)
        ) {
          const objectId = layer.objectId || layer.id;
          if (processedVideoObjects.has(objectId)) return;
          processedVideoObjects.add(objectId);

          const sourceSegments = layers.filter(
            (candidate: Layer) =>
              candidate.type === "video" &&
              candidate.objectId === layer.objectId,
          );
          const epsilon = 0.1;
          const activeSegment = sourceSegments.find((candidate: Layer) => {
            const candidateStart = Number(candidate.startTime || 0);
            const candidateEnd =
              candidateStart + Number(candidate.duration || 0);
            return (
              currTime >= candidateStart - epsilon &&
              currTime < candidateEnd + epsilon
            );
          });
          const retainedSegment =
            retainedTimelineVideo?.objectId === layer.objectId
              ? retainedTimelineVideo
              : null;
          const playbackSegment = activeSegment || retainedSegment || layer;
          const layerStart = playbackSegment.startTime ?? 0;
          const layerDuration = playbackSegment.duration ?? 300;
          const mediaStart = playbackSegment.mediaStart ?? 0;
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
          const shouldShow =
            Boolean(activeSegment || retainedSegment) &&
            playbackSegment.visible !== false;

          if (!videoEl) return;
          attachVideoOverlay(canvas, obj, videoEl);

          videoEl.muted = isMuted;
          videoEl.volume = isMuted ? 0 : Math.min(1, Math.max(0, volume ?? 1));
          videoEl.playbackRate = playbackRate || 1;

          if (shouldShow) {
            const targetTime = activeSegment
              ? mediaStart + (currTime - safeStart)
              : mediaStart + Math.max(0, safeDuration - 0.001);
            const shouldSeek =
              options.forceSeek ||
              (!isPlaying &&
                (!Number.isFinite(videoEl.currentTime) ||
                  Math.abs(videoEl.currentTime - targetTime) > 0.04));
            const canPlayback =
              Boolean(activeSegment) &&
              isActive &&
              options.allowPlayback !== false &&
              isPlaying;

            if (!obj.visible) {
              obj.visible = true;
              obj.opacity = 1;
              obj.dirty = true;
              needsRender = true;
            }
            setVideoOverlayVisibility(obj, true);

            if (shouldSeek || videoEl.ended) {
              const durationLimit = Number.isFinite(videoEl.duration)
                ? Math.max(0, videoEl.duration - 0.001)
                : Number.POSITIVE_INFINITY;
              const seekTarget = Math.min(
                Math.max(0, targetTime),
                durationLimit,
              );
              if (
                !Number.isFinite(videoEl.currentTime) ||
                Math.abs(videoEl.currentTime - seekTarget) > 0.01 ||
                videoEl.ended
              ) {
                try {
                  videoEl.currentTime = seekTarget;
                } catch {
                  // Metadata can briefly be unavailable during a remount.
                }
              }
            }

            if (canPlayback) {
              if (videoEl.paused) {
                void videoEl.play().catch(() => {
                  // A later user-initiated playback pass retries automatically.
                });
              }
            } else if (!videoEl.paused) {
              videoEl.pause();
            }
          } else {
            if (!videoEl.paused) videoEl.pause();
            setVideoOverlayVisibility(obj, false);
            if (obj.visible) {
              obj.visible = false;
              obj.opacity = 1;
              obj.dirty = true;
              needsRender = true;
            }
          }
          return;
        }

        const hasTimeData =
          layer.startTime !== undefined && layer.duration !== undefined;
        if (!hasTimeData) return;

        const layerStart = layer.startTime!;
        const layerDuration = layer.duration!;
        if (isNaN(layerStart) || isNaN(layerDuration) || layerDuration <= 0)
          return;

        const layerEnd = layerStart + layerDuration;
        const shouldShow =
          layer.visible !== false &&
          currTime >= layerStart - 0.5 &&
          currTime < layerEnd;

        if (obj.visible !== shouldShow) {
          obj.visible = shouldShow;
          obj.opacity = shouldShow ? 1 : 0;
          obj.dirty = true;
          needsRender = true;
        }
      });

      if (needsRender) {
        canvas.requestRenderAll();
      }

      return needsRender;
    },
    [
      pages,
      pageId,
      isPlaying,
      isMuted,
      volume,
      playbackRate,
      isActive,
    ],
  );

  useEffect(() => {
    const incomingTime = currentTime ?? 0;
    const playbackJustStarted = isPlaying && !wasPlayingRef.current;
    const isPlaybackCommit =
      isPlaying &&
      !playbackJustStarted &&
      Math.abs(incomingTime - lastCommittedPlaybackTimeRef.current) < 0.02;

    if (!isPlaybackCommit) {
      playbackTimeRef.current = incomingTime;
    }

    syncTimedObjects(incomingTime, {
      forceSeek: playbackJustStarted || !isPlaybackCommit,
      drawFrame: !isPlaybackCommit || !isPlaying,
    });
    wasPlayingRef.current = isPlaying;
  }, [currentTime, isPlaying, syncTimedObjects]);

  // 1. Playback Loop (Master Clock)
  useEffect(() => {
    if (!isActive || !isPlaying) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let lastUiCommit = 0;
    playbackTimeRef.current =
      useEditorStore.getState().videoState.currentTime ?? playbackTimeRef.current;

    const getMediaClockTime = (timelineTime: number) => {
      const canvas = fabricCanvasRef.current;
      const layers =
        pages.find((page: EditorPage) => page.id === pageId)?.layers || [];
      const activeVideoLayer = layers.find((layer: Layer) => {
        if (layer.type !== "video") return false;
        const layerStart = Number(layer.startTime || 0);
        const layerEnd = layerStart + Number(layer.duration || 0);
        return timelineTime >= layerStart && timelineTime < layerEnd;
      });
      if (!canvas || !activeVideoLayer) return null;

      const object = canvas
        .getObjects()
        .find((candidate: any) => candidate.name === activeVideoLayer.objectId) as any;
      const videoEl = object?._videoEl as HTMLVideoElement | undefined;
      if (
        !videoEl ||
        videoEl.seeking ||
        !Number.isFinite(videoEl.currentTime)
      ) {
        return videoEl ? timelineTime : null;
      }

      return (
        Number(activeVideoLayer.startTime || 0) +
        Math.max(
          0,
          videoEl.currentTime - Number(activeVideoLayer.mediaStart || 0),
        )
      );
    };

    const loop = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const mediaClockTime = getMediaClockTime(playbackTimeRef.current);
      const nextTime =
        mediaClockTime ?? playbackTimeRef.current + dt * playbackRate;
      const playbackEnd = Math.min(
        Number.isFinite(endTime) && endTime > 0 ? endTime : duration,
        duration,
      );

      if (nextTime >= playbackEnd) {
        const firstVideoStart =
          pages
            .find((page: EditorPage) => page.id === pageId)
            ?.layers.filter((layer: Layer) => layer.type === "video")
            .reduce(
              (earliest: number, layer: Layer) =>
                Math.min(earliest, Number(layer.startTime || 0)),
              Number.POSITIVE_INFINITY,
            ) ?? Number.POSITIVE_INFINITY;
        const previewTime = Number.isFinite(firstVideoStart)
          ? firstVideoStart
          : startTime;

        playbackTimeRef.current = previewTime;
        lastCommittedPlaybackTimeRef.current = previewTime;
        wasPlayingRef.current = false;
        setVideoState({ isPlaying: false, currentTime: previewTime });
        syncTimedObjects(previewTime, {
          forceSeek: true,
          allowPlayback: false,
          drawFrame: true,
        });
        return;
      } else {
        playbackTimeRef.current = nextTime;

        if (now - lastUiCommit >= 100) {
          lastUiCommit = now;
          lastCommittedPlaybackTimeRef.current = nextTime;
          setVideoState({ currentTime: nextTime });
          syncTimedObjects(nextTime, { drawFrame: false });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isActive,
    isPlaying,
    duration,
    startTime,
    endTime,
    playbackRate,
    setVideoState,
    syncTimedObjects,
    pages,
    pageId,
  ]);

  return (
    <div className="flex flex-col items-center gap-6" suppressHydrationWarning>
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={cn(
          "relative group",
          isActive
            ? "border-[#8b5cf6]/30"
            : "hover:shadow-2xl border-transparent",
        )}
        style={{
          width: pasteboardWidth * zoom,
          height: pasteboardHeight * zoom,
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
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes(EDITOR_DRAG_MIME_TYPE) ||
            event.dataTransfer.types.includes(PHOTO_DRAG_MIME_TYPE)
          ) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          void handleToolDrop(event);
        }}
      >
        <div
          data-artboard-for={pageId}
          className={cn(
            "absolute z-0 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-shadow duration-300",
            isActive
              ? "ring-[6px] ring-[#8b5cf6]/10"
              : "group-hover:shadow-2xl",
          )}
          style={{
            left: (pasteboardMargin + artboardX) * zoom,
            top: (pasteboardMargin + artboardY) * zoom,
            width: pageWidth * zoom,
            height: pageHeight * zoom,
          }}
        />
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
          data-artboard-controls-for={pageId}
          className={cn(
            "absolute flex flex-col gap-2 transition-all duration-300",
            isActive
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0",
          )}
          style={{
            left: (pasteboardMargin + artboardX + pageWidth) * zoom + 14,
            top: (pasteboardMargin + artboardY) * zoom,
          }}
        >
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
      <div
        data-artboard-label-for={pageId}
        className="flex flex-col items-center gap-1"
        style={{
          marginTop: -pasteboardMargin * zoom + 24 + artboardY * zoom,
          transform: `translateX(${artboardX * zoom}px)`,
        }}
      >
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
              • {pageWidth}x{pageHeight}
            </span>
          </div>
        ) : (
          <span
            className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 cursor-text hover:border-gray-300 transition-colors"
            onClick={handleNameClick}
            title="Click to rename page"
          >
            {pageName} <span className="mx-1">•</span> {pageWidth}x{pageHeight}
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
    canvas: { pages, width, height, activePageId },
    setZoom,
  } = useEditorStore();
  const activePage = pages.find((page) => page.id === activePageId);
  const activePageWidth = activePage?.width ?? width;
  const activePageHeight = activePage?.height ?? height;

  const focusActiveArtboard = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const artboard = container.querySelector<HTMLElement>(
      `[data-artboard-for="${activePageId}"]`,
    );
    if (!artboard) return;

    const containerRect = container.getBoundingClientRect();
    const artboardRect = artboard.getBoundingClientRect();
    const centeredLeft = Math.max(
      32,
      (container.clientWidth - artboardRect.width) / 2,
    );
    const centeredTop = Math.max(
      32,
      (container.clientHeight - artboardRect.height) / 2,
    );

    container.scrollTo({
      left:
        container.scrollLeft +
        artboardRect.left -
        containerRect.left -
        centeredLeft,
      top:
        container.scrollTop +
        artboardRect.top -
        containerRect.top -
        centeredTop,
      behavior: "auto",
    });
  }, [activePageId]);

  // Auto-zoom to fit container using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    let focusFrame = 0;

    const updateZoom = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } =
          entry.contentRect;

        if (containerWidth <= 0 || containerHeight <= 0) return;
        const activeCanvas = useEditorStore.getState().canvas.fabricCanvas;
        if ((activeCanvas as any)?.isArtboardResizing) return;

        // Gap calculations: Ensure a minimum 40px gap
        const padding = 120;
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        if (availableWidth > 0 && availableHeight > 0) {
          const scaleX = availableWidth / activePageWidth;
          const scaleY = availableHeight / activePageHeight;

          // Fit to screen, but don't explode it too much on ultra-wide screens
          const scale = Math.min(scaleX, scaleY, 1.1);
          const nextZoom = Number(scale.toFixed(2));
          if (useEditorStore.getState().canvas.zoom !== nextZoom) {
            setZoom(nextZoom);
          }

          cancelAnimationFrame(focusFrame);
          focusFrame = requestAnimationFrame(() => {
            focusFrame = requestAnimationFrame(focusActiveArtboard);
          });
        }
      }
    };

    const observer = new ResizeObserver(updateZoom);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(focusFrame);
    };
  }, [
    activePageWidth,
    activePageHeight,
    focusActiveArtboard,
    setZoom,
  ]);

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
              false,
              undefined,
              file.name,
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
