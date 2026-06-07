"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  ImageIcon,
  Upload,
  Shapes,
  Video,
  Music,
  MousePointer2,
  Hand,
  PenTool,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// Dynamic imports to prevent SSR issues with Fabric.js
const TopBar = dynamic(
  () => import("@/components/editor/top-bar").then((mod) => mod.TopBar),
  { ssr: false },
);
const ToolsSidebar = dynamic(
  () =>
    import("@/components/editor/tools-sidebar").then((mod) => mod.ToolsSidebar),
  { ssr: false },
);
const LayerPanel = dynamic(
  () => import("@/components/editor/layer-panel").then((mod) => mod.LayerPanel),
  { ssr: false },
);
const PropertiesPanel = dynamic(
  () =>
    import("@/components/editor/properties-panel").then(
      (mod) => mod.PropertiesPanel,
    ),
  { ssr: false },
);
const FloatingToolbar = dynamic(
  () =>
    import("@/components/editor/floating-toolbar").then(
      (mod) => mod.FloatingToolbar,
    ),
  { ssr: false },
);
const Timeline = dynamic(
  () => import("@/components/editor/timeline").then((mod) => mod.Timeline),
  { ssr: false },
);

const Canvas = dynamic(
  () => import("@/components/editor/canvas").then((mod) => mod.Canvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f3f4f6] gap-4">
        <div className="w-12 h-12 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
          Powering Pixizen...
        </p>
      </div>
    ),
  },
);
const ZoomControls = dynamic(
  () => import("@/components/editor/canvas").then((mod) => mod.ZoomControls),
  { ssr: false },
);

import { useEditorStore } from "@/lib/store";
import { addMediaFromUrl } from "@/lib/editor-utils";

function EditorContent() {
  const searchParams = useSearchParams();
  
  // Robust param extraction for malformed URLs (e.g. hasPendingImg=1?url=...)
  const getParam = (key: string) => {
    // 1. Try raw search string splitting (most robust for malformed separators)
    if (typeof window !== "undefined") {
      const search = window.location.search || "";
      // Split by & or ? to find individual key=value pairs
      const parts = search.substring(1).split(/[&?]/);
      for (const part of parts) {
        const eqIndex = part.indexOf('=');
        if (eqIndex === -1) continue;
        
        const k = part.substring(0, eqIndex);
        const v = part.substring(eqIndex + 1);
        
        if (k === key && v) {
          return decodeURIComponent(v);
        }
      }
    }
    
    // 2. Fallback to standard next.js search params
    return searchParams.get(key);
  };

  const videoUrlParam = getParam("video_url");
  const rawType = getParam("type") as "image" | "video" | null;
  const initialType: "image" | "video" | null = rawType || (videoUrlParam ? "video" : null);
  let initialUrl = getParam("url") || videoUrlParam;

  // Clean URL if it's wrapped in quotes
  if (initialUrl && initialUrl.trim().length > 0) {
    initialUrl = initialUrl.trim().replace(/^["']|["']$/g, '');
  }

  const hasPendingImg = getParam("hasPendingImg") === "1";
  const hasPendingVideo = getParam("hasPendingVideo") === "1";

  const [activeTool, setActiveTool] = useState<
    "templates" | "photos" | "upload" | "objects" | "video" | "audio"
  >("photos"); // Default to photos for generation redirects
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const store = useEditorStore();

  // Initialize tool selection based on URL and inferred type
  useEffect(() => {
    const lowerUrl = (initialUrl || "").toLowerCase();
    const isVid = initialType === "video" || lowerUrl.match(/\.(mp4|webm|mov)$/);
    const isImg = initialType === "image" || lowerUrl.match(/\.(png|jpg|jpeg|gif|webp)$/);

    if (isVid) {
      setActiveTool("video");
      setIsLeftPanelOpen(true);
    } else if (isImg || initialUrl) {
      setActiveTool("photos");
      setIsLeftPanelOpen(true);
    }
  }, [initialType, initialUrl]);

  const fabricCanvas = store.canvas.fabricCanvas;
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Handle initial background/asset from URL
  useEffect(() => {
    // Only run if we have a URL, a canvas is ready, and we haven't loaded it yet
    if (initialUrl && fabricCanvas && !hasLoadedInitial) {
      setHasLoadedInitial(true);
      
      const processInitial = async () => {
        const state = useEditorStore.getState();
        
        // 1. Force Page 1 selection first
        if (state.canvas.pages.length > 0) {
          const firstPageId = state.canvas.pages[0].id;
          console.log("[EDITOR-INIT] Forcing Page 1 selection:", firstPageId);
          state.setActivePage(firstPageId);
        }

        // 2. Wait for state to settle and for possible re-renders
        await new Promise(r => setTimeout(r, 1000));
        
        // 3. Re-grab live state and load media
        const freshState = useEditorStore.getState();
        const lowerUrl = initialUrl!.toLowerCase();
        const inferredType = lowerUrl.match(/\.(mp4|webm|mov)$/) ? "video" : "image";
        
        console.log("[EDITOR-INIT] Adding media to Page 1...");
        await addMediaFromUrl(
          initialUrl!,
          freshState,
          initialType || inferredType as any
        );

        // 4. Force Deselect to show Canvas Settings on the right by default
        const resultState = useEditorStore.getState();
        if (resultState.canvas.fabricCanvas) {
          resultState.canvas.fabricCanvas.discardActiveObject();
          resultState.canvas.fabricCanvas.requestRenderAll();
        }
        resultState.selectLayer(null);
      };
      
      processInitial();
    }
  }, [initialUrl, fabricCanvas, hasLoadedInitial, initialType]);

  // Handle image/video sent via postMessage from the frontend app (opener window)
  // This is used when the generated media is a base64 data URI that's too large for a URL param
  useEffect(() => {
    if (!hasPendingImg && getParam("hasPendingVideo") !== "1") return;

    let received = false;

    const handleMessage = async (event: MessageEvent) => {
      // Validate origin — only accept messages from known frontend origins
      const allowedOrigins = ['http://localhost:3000', 'http://103.119.101.183', window.location.origin];
      const isAllowed = allowedOrigins.includes(event.origin) || event.origin.startsWith('http://localhost:3000');
      
      if (!isAllowed) return;
      
      const msgType = event.data?.type;
      if (msgType !== 'PIXIZEN_IMG' && msgType !== 'PIXIZEN_VIDEO') return;
      if (!event.data?.dataUrl) return;
      if (received) return; 
      
      received = true;

      // Confirm receipt back to sender
      event.source?.postMessage({ type: 'PIXIZEN_IMG_ACK' }, { targetOrigin: event.origin });

      const dataUrl = event.data.dataUrl as string;
      const mediaType = msgType === 'PIXIZEN_VIDEO' ? 'video' : 'image';
      
      if (mediaType === 'video') setActiveTool("video");

      const waitAndAdd = async () => {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const currentState = useEditorStore.getState();
          if (currentState.canvas.fabricCanvas) {
            clearInterval(interval);
            await addMediaFromUrl(dataUrl, currentState, mediaType);
          }
          if (attempts > 20) clearInterval(interval);
        }, 500);
      };
      waitAndAdd();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [hasPendingImg, searchParams]);

  // Global Paste Listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const pastedText = e.clipboardData?.getData("text");
      if (
        pastedText &&
        (pastedText.startsWith("http://") || pastedText.startsWith("https://"))
      ) {
        const currentState = useEditorStore.getState();
        if (currentState.canvas.fabricCanvas) {
          await addMediaFromUrl(pastedText, currentState);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const leftNavItems = [
    { id: "select", icon: MousePointer2, label: "Select", type: "canvas" },
    { id: "hand", icon: Hand, label: "Pan", type: "canvas" },
    { id: "pen", icon: PenTool, label: "Draw", type: "canvas" },
    { id: "text", icon: Type, label: "Text", type: "mixed" },
    // { id: "templates", icon: LayoutGrid, label: "Templates", type: "tab" },
    { id: "video", icon: Video, label: "Video", type: "tab" },
    { id: "photos", icon: ImageIcon, label: "Photos", type: "tab" },
    { id: "audio", icon: Music, label: "Audio", type: "tab" },
    // { id: "upload", icon: Upload, label: "Upload", type: "tab" },
    { id: "objects", icon: Shapes, label: "Objects", type: "tab" },
  ];

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const bottomNavItems = [
    { id: "video", icon: Video, label: "Video" },
    { id: "photos", icon: ImageIcon, label: "Photos" },
    { id: "audio", icon: Music, label: "Audio" },
    { id: "upload", icon: Upload, label: "Upload" },
    { id: "objects", icon: Shapes, label: "Objects" },
    { id: "elements", icon: LayoutGrid, label: "Elements" },
  ];

  const showTimeline =
    store.canvas.pages.some((p) =>
      p.layers.some((l) => l.type === "video" || l.type === "audio"),
    ) ||
    activeTool === "video" ||
    activeTool === "audio" ||
    store.videoEditorOpen;

  return (
    <div className="h-screen flex flex-col bg-[#ffffff] text-white overflow-hidden font-sans">
      <TopBar />

      {/* ─── DESKTOP LAYOUT (md and up) ─── */}
      <div className="hidden md:flex flex-1 overflow-hidden bg-[#000000]">
        {/* Left Side: combined Rail and Sidebar */}
        <div
          className={cn(
            "flex-shrink-0 bg-[#000000] flex overflow-hidden transition-all duration-300 ease-in-out border-r border-white/10",
            isLeftPanelOpen ? "w-[380px]" : "w-[80px]",
          )}
        >
          {/* Rail */}
          <nav className="w-[80px] flex-shrink-0 flex flex-col items-center py-6 gap-2 border-r border-white/5 bg-[#000000] z-10">
            {leftNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === "canvas") {
                    store.setActiveCanvasTool(item.id as any);
                    setIsLeftPanelOpen(false); // Close sidebar for interaction tools
                  } else if (item.type === "mixed") {
                    store.setActiveCanvasTool(item.id as any);
                    setActiveTool(item.id as any);
                    setIsLeftPanelOpen(true);
                  } else {
                    if (activeTool === item.id) {
                      setIsLeftPanelOpen(!isLeftPanelOpen);
                    } else {
                      setActiveTool(item.id as any);
                      setIsLeftPanelOpen(true);
                    }
                    // Reset to select tool when opening tabs unless it's mixed
                    if (store.activeCanvasTool !== "select") {
                      store.setActiveCanvasTool("select");
                    }
                  }
                }}
                className={cn(
                  "w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-all",
                  (activeTool === item.id && isLeftPanelOpen) ||
                    (item.type === "canvas" &&
                      store.activeCanvasTool === item.id)
                    ? "bg-white text-black"
                    : "text-gray-500 hover:text-white hover:bg-white/5",
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase tracking-tighter">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* Tools Secondary Panel */}
          <div
            className={cn(
              "flex-1 overflow-hidden flex flex-col min-w-[300px] transition-opacity duration-300",
              isLeftPanelOpen ? "opacity-100" : "opacity-0",
            )}
          >
            <ToolsSidebar activeTab={activeTool} />
          </div>
        </div>

        {/* Center - Canvas Area */}
        <div className="flex-1 overflow-hidden bg-[#f3f4f6]">
          <ResizablePanelGroup orientation="vertical" className="h-full w-full" id="main-editor-group">
            <ResizablePanel
              defaultSize={70}
              minSize={30}
              id="canvas-panel"
              className="relative flex flex-col bg-transparent"
            >
              <Canvas />
              <ZoomControls />
            </ResizablePanel>

            {showTimeline && (
              <>
                <ResizableHandle withHandle className="bg-gray-200 h-1" />
                <ResizablePanel
                  defaultSize={30}
                  minSize={10}
                  id="timeline-panel"
                  className="bg-white flex flex-col overflow-hidden border-t border-gray-200"
                >
                  <Timeline />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* Right Sidebar */}
        <aside className="w-[320px] flex-shrink-0 bg-[#000000] flex flex-col overflow-hidden border-l border-white/10">
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-5 pb-12">
            <PropertiesPanel />
          </div>
        </aside>
      </div>

      {/* ─── MOBILE LAYOUT (below md) ─── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden bg-[#0a0a0a] relative">
        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-[#f1f3f6]">
          <Canvas />
        </div>

        {/* Timeline strip (if needed) */}
        {showTimeline && (
          <div className="h-[130px] bg-[#111] border-t border-white/10 flex-shrink-0 overflow-hidden">
            <Timeline />
          </div>
        )}

        {/* Bottom Sheet Overlay */}
        {mobileSheetOpen && (
          <>
            {/* Scrim */}
            <div
              className="absolute inset-0 bg-black/50 z-30"
              onClick={() => setMobileSheetOpen(false)}
            />
            {/* Sheet */}
            <div
              className="absolute bottom-[72px] left-0 right-0 z-40 bg-[#1a0a2e] rounded-t-3xl shadow-2xl border-t border-white/10 flex flex-col"
              style={{ maxHeight: "65vh" }}
            >
              {/* Drag Handle */}
              <div className="flex items-center justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {/* Tab header */}
              <div className="px-5 pb-3">
                <div className="bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] rounded-2xl py-2.5 text-center">
                  <span className="text-white font-black text-sm tracking-wide uppercase">
                    {bottomNavItems.find((i) => i.id === activeTool)?.label ||
                      activeTool}
                  </span>
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <ToolsSidebar activeTab={activeTool} />
              </div>
            </div>
          </>
        )}

        {/* Bottom Nav Bar */}
        <nav className="flex-shrink-0 h-[72px] bg-[#0a0a0a] border-t border-white/10 flex items-center justify-around px-2 z-50 relative">
          {/* Edit / Control toggle */}
          <div className="absolute bottom-full left-0 right-0 flex gap-0 px-0 pb-0 pointer-events-none">
            {/* handled inside the sheet */}
          </div>

          {/* Edit & Control buttons at bottom — like the reference image */}
          <div className="w-full flex items-center">
            {/* Left: tool icons (scrollable) */}
            <div className="flex-1 flex items-center justify-around">
              {bottomNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (activeTool === item.id && mobileSheetOpen) {
                      setMobileSheetOpen(false);
                    } else {
                      setActiveTool(item.id as any);
                      setMobileSheetOpen(true);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-2xl transition-all",
                    activeTool === item.id && mobileSheetOpen
                      ? "bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] text-white shadow-lg shadow-purple-500/40"
                      : "text-gray-500",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase tracking-tight">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile Edit / Control bottom call-to-action (like the reference) */}
        <div className="flex-shrink-0 flex bg-[#0a0a0a] border-t border-white/5">
          <button
            onClick={() => setMobileSheetOpen(false)}
            className="flex-1 h-12 flex items-center justify-center gap-2 text-white font-bold text-sm border-r border-white/10"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => setMobileSheetOpen(true)}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white font-bold text-sm"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Control
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest text-white/50">
              Loading Editor...
            </p>
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
