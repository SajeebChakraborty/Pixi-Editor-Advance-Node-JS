"use client";

import { useState } from "react";
import { useEditorStore } from "@/lib/store";
import {
  Undo2,
  Redo2,
  Crown,
  ChevronDown,
  Save,
  FileImage,
  Video,
  Download,
} from "lucide-react";
import Image from "next/image";
import { TemplateManager } from "@/lib/templates";
import { exportArtboardDataUrl } from "@/lib/image-export";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const [exporting, setExporting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get("admin") === "true";
  const isFromFrontend = searchParams.get("from") === "frontend";

  const name = useEditorStore((state) => state.canvas.name);
  const width = useEditorStore((state) => state.canvas.width);
  const height = useEditorStore((state) => state.canvas.height);
  const fabricCanvas = useEditorStore((state) => state.canvas.fabricCanvas);
  const renameProject = useEditorStore((state) => state.renameProject);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleNameClick = () => {
    setTempName(name || "Instagram Post");
    setIsEditingName(true);
  };

  const handleNameEditComplete = () => {
    if (tempName.trim()) {
      renameProject(tempName.trim());
    }
    setIsEditingName(false);
  };

  const exportFileName = (extension: "png" | "jpg") => {
    const safeName = (name || "pixizen-export")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${safeName || "pixizen-export"}-${width}x${height}.${extension}`;
  };

  const getArtboardDataUrl = async (
    format: "png" | "jpeg",
    multiplier = 1,
    quality = 0.92,
  ) => {
    if (!fabricCanvas) return "";
    return exportArtboardDataUrl(fabricCanvas, format, multiplier, quality);
  };

  const handleExportImage = async (
    format: "png" | "jpeg",
    multiplier = 1,
    quality = 0.92,
  ) => {
    if (!fabricCanvas) return;
    setExporting(true);
    try {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      const dataUrl = await getArtboardDataUrl(format, multiplier, quality);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = exportFileName(format === "png" ? "png" : "jpg");
      link.click();
      toast.success(`${format === "png" ? "PNG" : "JPG"} download started.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export image.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportVideo = async (preferredFormat: "mp4" | "webm" = "mp4") => {
    setExporting(true);
    const toastId = toast.loading("Recording timeline… uploading, then download.");

    try {
      const { exportVideo } = await import("@/lib/video-renderer");
      const { blob, mimeType, extension } = await exportVideo(preferredFormat);
      if (!blob || blob.size < 1024) {
        throw new Error("Rendered video is empty. Please ensure timeline has a valid video segment.");
      }

      const { uploadRenderedVideo } = await import("@/lib/rendered-video-upload");
      const uploadResult = await uploadRenderedVideo(
        blob,
        extension,
        mimeType || blob.type || (extension === "mp4" ? "video/mp4" : "video/webm"),
      );
      const fileExt = uploadResult.extension || extension;
      const fileName = `pixizen-video-${Date.now()}.${fileExt}`;
      const downloadUrl = `/api/download?key=${encodeURIComponent(uploadResult.key)}&filename=${encodeURIComponent(fileName)}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.click();

      toast.success(
        fileExt === "mp4"
          ? "MP4 ready — download started."
          : "WebM ready — download started.",
        { id: toastId },
      );
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      toast.error("Failed to export video", {
        id: toastId,
        description: detail,
        duration: 12_000,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveToFrontend = async () => {
    if (!fabricCanvas) return;
    const type = searchParams.get("type");
    const isVideo = type === "video";
    
    const toastId = toast.loading(isVideo ? "Rendering and saving to Cloud..." : "Uploading to Cloud...");
    
    try {
      let finalUrl = "";
      const { uploadToDashboardAction } = await import("@/app/actions/save-to-dashboard");

      if (isVideo) {
        // For video, we need to export the video first
        const { exportVideo } = await import("@/lib/video-renderer");
        const { blob } = await exportVideo("webm");
        
        // Convert blob to data URL for transport to server action
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const uploadResult = await uploadToDashboardAction(dataUrl, 'video');
        if (!uploadResult.success) throw new Error(uploadResult.error);
        finalUrl = uploadResult.url!;
      } else {
        const dataUrl = await getArtboardDataUrl("png", 1);
        const uploadResult = await uploadToDashboardAction(dataUrl, 'image');
        if (!uploadResult.success) throw new Error(uploadResult.error);
        finalUrl = uploadResult.url!;
      }

      const dashboardOrigin = window.location.origin.includes('localhost') 
        ? 'http://localhost:3000' 
        : 'https://pixizen.io';
      
      const targetPath = isVideo ? "video-generate" : "image-generate";
      const paramName = isVideo ? "video" : "image";
      
      toast.success("Saved to Cloud! Redirecting...", { id: toastId });
      
      // Delay slightly for toast visibility
      setTimeout(() => {
        window.location.href = `${dashboardOrigin}/dashboard/${targetPath}?${paramName}=${encodeURIComponent(finalUrl)}`;
      }, 500);
      
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save to dashboard", { id: toastId });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!fabricCanvas) return;
    setSavingTemplate(true);
    try {
      const name = prompt("Enter template name:", "My Template");
      if (!name) return;

      const category = prompt("Enter category:", "General") || "General";

      const thumb = await getArtboardDataUrl("png", 0.2);

      const template = TemplateManager.createTemplateFromCanvas(
        fabricCanvas,
        name,
        category,
      );

      const saved = await TemplateManager.saveTemplate({
        ...template,
        thumbnail: thumb,
      });

      if (saved) {
        toast.success("Template saved to library!");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const ExportDropdown = ({ align = "end" as const, compact = false }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={exporting}
          className={
            compact
              ? "flex items-center gap-1.5 bg-white text-black font-black text-xs h-9 rounded-xl px-4 shadow-lg active:scale-95 transition-all"
              : "bg-white text-black hover:bg-gray-100 font-black text-[11px] h-9 rounded-xl px-4 lg:px-6 shadow-xl transition-all active:scale-95 flex items-center gap-2 uppercase tracking-tight"
          }
        >
          {compact ? (
            <>
              {exporting ? "..." : "Download"}
              <Download className="w-3.5 h-3.5 opacity-60" />
            </>
          ) : (
            <>
              {exporting ? "Exporting..." : "Export"}
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-56 bg-[#161616] border-white/10 text-white"
      >
        <DropdownMenuLabel className="text-xs text-gray-500 uppercase tracking-widest">
          Image Formats
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => handleExportImage("png", 1)}
          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 gap-2"
        >
          <FileImage className="w-4 h-4 text-blue-400" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">PNG Image</span>
            <span className="text-[10px] text-gray-500">
              Current size, transparent
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExportImage("png", 2)}
          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 gap-2"
        >
          <FileImage className="w-4 h-4 text-cyan-400" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">PNG Image 2x</span>
            <span className="text-[10px] text-gray-500">
              Larger high-resolution export
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExportImage("jpeg", 1, 0.92)}
          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 gap-2"
        >
          <FileImage className="w-4 h-4 text-orange-400" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">JPG Image</span>
            <span className="text-[10px] text-gray-500">
              High quality, smaller file
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuLabel className="text-xs text-gray-500 uppercase tracking-widest">
          Video Formats
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => handleExportVideo("mp4")}
          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 gap-2"
        >
          <Video className="w-4 h-4 text-purple-400" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">MP4 Video</span>
            <span className="text-[10px] text-gray-500">
              Render -&gt; Direct Upload -&gt; Download
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExportVideo("webm")}
          className="cursor-pointer hover:bg-white/10 focus:bg-white/10 gap-2"
        >
          <Video className="w-4 h-4 text-indigo-400" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">WEBM Video</span>
            <span className="text-[10px] text-gray-500">
              Fast export, high compatibility
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="w-full z-50">
      {/* ─── MOBILE TOP BAR ─── */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 bg-[#1a0a2e] border-b border-white/10">
        {/* Back */}
        <button
          onClick={() => (window.location.href = "/")}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white border border-white/15 active:scale-90 transition-all"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Credits chip */}
        <div className="flex items-center gap-2 bg-[#2a1050] border border-white/10 rounded-xl px-3 py-1.5">
          <span className="text-base leading-none">🔥</span>
          <span className="text-white font-black text-xs tracking-tight">
            250 Credits
          </span>
        </div>

        {/* Save to Dashboard for Mobile */}
        {isFromFrontend && (
          <button
            onClick={handleSaveToFrontend}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-600 text-white border border-white/15 active:scale-90 transition-all"
          >
            <Save className="w-5 h-5" />
          </button>
        )}

        {/* Download */}
        <ExportDropdown compact />
      </div>

      {/* ─── DESKTOP TOP BAR ─── */}
      <div className="hidden md:block">
        <div className="h-[64px] bg-gradient-to-r from-[#2e1065] via-[#1e1b4b] to-[#2e1065] border-b border-white/10 flex items-center justify-between px-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

          {/* Left */}
          <div className="flex items-center gap-4 lg:gap-8 z-10">
            <div
              className="flex items-center gap-3 group cursor-pointer"
              onClick={() => (window.location.href = "/editor")}
            >
                <Image
                  src="/logo_update.png"
                  alt="Pixizen Logo"
                  width={150}
                  height={150}
                  className="object-contain"
                />
             
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={undo}
                disabled={!canUndo()}
                title="Undo (Cmd+Z)"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-all border border-white/20"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                title="Redo (Cmd+Shift+Z)"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-all border border-white/20"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => (window.location.href = "https://pixizen.io/dashboard")}
                //BACKGROUND COLOR #1e1b4b
                className="bg-[#1e1b4b] text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:text-white/80 transition-colors"
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #8b5cf6",
                  cursor: "pointer",
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>

          {/* Center */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center">
            {isEditingName ? (
              <div className="flex items-center">
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
                  className="text-[11px] font-bold text-white uppercase tracking-[0.2em] bg-transparent border-b border-white/30 outline-none text-center w-48"
                  spellCheck={false}
                />
                <span className="text-white/40 mx-2 text-[11px] font-bold">
                  •
                </span>
                <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.2em]">
                  {width}x{height}
                </span>
              </div>
            ) : (
              <p
                className="text-[11px] font-bold text-white/70 uppercase tracking-[0.2em] cursor-text hover:text-white transition-colors"
                onClick={handleNameClick}
                title="Click to rename project"
              >
                {name || "Instagram Post"}{" "}
                <span className="text-white/40 mx-2">•</span> {width}x{height}
              </p>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 lg:gap-5 z-10">
            {isAdmin && (
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate}
                className="hidden lg:flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold text-[10px] h-9 rounded-xl px-4 border border-white/10 shadow-lg transition-all active:scale-95 uppercase tracking-widest"
              >
                <Save className="w-3.5 h-3.5" />
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            )}

            {isFromFrontend && (
              <button
                onClick={handleSaveToFrontend}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] h-9 rounded-xl px-4 border border-white/10 shadow-lg transition-all active:scale-95 uppercase tracking-widest"
              >
                <Save className="w-3.5 h-3.5" />
                Save to Dashboard
              </button>
            )}
            <ExportDropdown />
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#8b5cf6]/50 p-0.5 cursor-pointer hover:border-white transition-all shadow-lg hidden sm:block">
              <div className="w-full h-full rounded-full overflow-hidden relative">
                <Image
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                  alt="User"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
