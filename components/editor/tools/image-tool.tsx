"use client";

import React, { useRef, useState, useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Upload, X } from "lucide-react";
import Image from "next/image";

import { AssetService } from "@/lib/asset-service";
import { addMediaFromUrl, PHOTO_DRAG_MIME_TYPE } from "@/lib/editor-utils";
import { getActiveFabricCanvas } from "@/lib/editor-actions";
import { applyFabricTransformControls } from "@/lib/fabric-transform-controls";
import { toast } from "sonner";
import { uploadEditorAsset } from "@/lib/editor-assets";
import { getEditorProjectId } from "@/lib/project-persistence";

type ImageAsset = {
  id: string;
  name: string;
  type: string;
  category?: string | null;
  url: string;
};

export function ImageTool() {
  const [search, setSearch] = useState("");
  const {
    photoRecentAssets,
    deleteLayer,
    getLayers,
    removeRecentAsset,
    addRecentAsset,
  } = useEditorStore();
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const waitForFabricCanvas = async (timeoutMs = 5000): Promise<boolean> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const fabricCanvas = getActiveFabricCanvas();
      if (
        fabricCanvas &&
        !fabricCanvas.disposed &&
        !fabricCanvas.destroyed &&
        fabricCanvas.lowerCanvasEl?.isConnected
      ) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  };

  const getRenderedImageLayers = () => {
    const state = useEditorStore.getState();
    const fabricCanvas = getActiveFabricCanvas();
    if (!fabricCanvas) return [];

    return state.getLayers().filter((layer) => {
      if (layer.type !== "image" || !layer.objectId) return false;
      const object = fabricCanvas
        .getObjects()
        .find((candidate: any) => candidate.name === layer.objectId);

      return Boolean(
        object &&
          object.canvas === fabricCanvas &&
          object.visible !== false &&
          Number(object.opacity ?? 1) > 0 &&
          object.getScaledWidth() > 0 &&
          object.getScaledHeight() > 0,
      );
    });
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const limitedFiles = files.slice(0, 5);
    const ignoredCount = files.length - limitedFiles.length;

    if (ignoredCount > 0) {
      toast.error("You can upload a maximum of 5 images at a time.");
    }

    const validFiles = limitedFiles.filter((file) => file.type.startsWith("image/"));
    const invalidCount = limitedFiles.length - validFiles.length;
    if (invalidCount > 0) {
      toast.error("Some files were skipped because they are not valid images.");
    }

    if (validFiles.length === 0) return;

    setLoading(true);
    const toastId = toast.loading(
      validFiles.length > 1 ? "Uploading images..." : "Adding image to canvas...",
    );

    try {
      const uploads = await Promise.all(
        validFiles.map((file) =>
          uploadEditorAsset(file, "image", getEditorProjectId()),
        ),
      );
      const urls = uploads.map((upload) => upload.url);
      const hasVideoLayer = useEditorStore
        .getState()
        .getLayers()
        .some((layer) => layer.type === "video");
      const hasRenderedImageOnCanvas = getRenderedImageLayers().length > 0;
      const shouldAutoAddToCanvas =
        hasVideoLayer || !hasRenderedImageOnCanvas;

      if (shouldAutoAddToCanvas) {
        const addedToCanvas = await addImage(urls[0], validFiles[0].name);
        if (!addedToCanvas) {
          throw new Error("The first uploaded image was not rendered.");
        }
      }

      for (let i = shouldAutoAddToCanvas ? 1 : 0; i < validFiles.length; i += 1) {
        addRecentAsset({
          type: "image",
          url: urls[i],
          name: validFiles[i].name,
        }, "photo");
      }

      if (shouldAutoAddToCanvas) {
        // Ensure the first uploaded image (auto-added to canvas) is also
        // present and prioritized in recent uploads.
        addRecentAsset({
          type: "image",
          url: urls[0],
          name: validFiles[0].name,
        }, "photo");
      }

      toast.dismiss(toastId);
      if (!shouldAutoAddToCanvas) {
        toast.success(
          validFiles.length > 1
            ? `${validFiles.length} images uploaded to recent uploads.`
            : "Image uploaded to recent uploads.",
        );
      } else if (validFiles.length > 1) {
        toast.success(
          `${validFiles.length} images uploaded. First image added to canvas; ${
            validFiles.length - 1
          } saved to recent uploads.`,
        );
      }
    } catch (error) {
      console.error("Error processing image uploads:", error);
      toast.error("Failed to process uploaded images.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    await processFiles(droppedFiles);
  };

  const loadImages = async () => {
    try {
      const imageAssets = await AssetService.getAssets("image");
      setAssets(imageAssets.filter((asset) => asset.enabled !== false));
    } catch (e) {
      console.error("Failed to load images", e);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  const assetMatchesSearch = (asset: ImageAsset) => {
    if (!hasSearch) return true;

    return [asset.name, asset.category]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch));
  };

  const recentImageMatchesSearch = (asset: { name: string; url: string }) => {
    if (!hasSearch) return true;

    return [asset.name, asset.url]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  };

  const recentImages = photoRecentAssets
    .filter((asset) => asset.type === "image")
    .filter(recentImageMatchesSearch)
    .slice(0, 6);

  const groupedAssets = assets.reduce<Record<string, ImageAsset[]>>(
    (acc, asset) => {
      const category = asset.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(asset);
      return acc;
    },
    {},
  );

  const filteredCategories = Object.keys(groupedAssets)
    .map((cat) => ({
      name: cat,
      items: groupedAssets[cat].filter(assetMatchesSearch),
    }))
    .filter((cat) => cat.items.length > 0);

  const hasLibraryAssets = assets.length > 0;
  const hasSearchResults =
    recentImages.length > 0 || filteredCategories.length > 0;

  const addImage = async (
    url: string,
    name: string = "Image",
    placement?: { left: number; top: number },
  ): Promise<boolean> => {
    try {
      // First-time upload can race with initial canvas registration.
      // Wait for a live fabric canvas and retry a few times before giving up.
      const canvasReady = await waitForFabricCanvas();
      if (!canvasReady) {
        throw new Error("Canvas did not become ready.");
      }

      const imageCountBefore = useEditorStore
        .getState()
        .getLayers()
        .filter((layer) => layer.type === "image").length;

      let added = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const objectId = await addMediaFromUrl(
          url,
          useEditorStore.getState(),
          "image",
          false,
          undefined,
          name,
          getActiveFabricCanvas(),
          placement,
        );
        const currentState = useEditorStore.getState();
        const activeCanvas = getActiveFabricCanvas();
        const renderedObject = objectId
          ? activeCanvas
              ?.getObjects()
              .find((object: any) => object.name === objectId)
          : null;
        const imageCountAfter = currentState
          .getLayers()
          .filter((layer) => layer.type === "image").length;

        if (
          imageCountAfter > imageCountBefore &&
          renderedObject &&
          renderedObject.canvas === activeCanvas
        ) {
          renderedObject.setCoords();
          activeCanvas?.setActiveObject(renderedObject);
          if (useEditorStore.getState().editorMode === "video") {
            applyFabricTransformControls(renderedObject);
          }
          activeCanvas?.requestRenderAll();
          added = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (!added) {
        throw new Error("Image could not be attached to canvas.");
      }
      return true;
    } catch (err) {
      console.error("Error adding image:", err);
      toast.error("Failed to add image.");
      return false;
    }
  };

  const startPhotoDrag = (
    event: React.DragEvent<HTMLDivElement>,
    item: { url: string; name: string },
  ) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      PHOTO_DRAG_MIME_TYPE,
      JSON.stringify({ url: item.url, name: item.name }),
    );
  };

  const removeRecentImageFromCanvas = (
    e: React.MouseEvent<HTMLButtonElement>,
    url: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const matchingLayer = [...getLayers()]
      .reverse()
      .find((layer) => layer.type === "image" && layer.data?.url === url);

    if (!matchingLayer) {
      removeRecentAsset(url, "photo");
      toast.success("Photo removed from recent uploads.");
      return;
    }

    deleteLayer(matchingLayer.id);
    toast.success("Photo removed from canvas.");
  };

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      {/* Header with Search */}
      <div className="px-5 py-6 space-y-4">
        <Button className="w-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-bold h-10 shadow-lg shadow-purple-500/20 pointer-events-none">
          Photos Library
        </Button>
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Upload Image
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-24 border-2 border-dashed transition-all flex flex-col gap-2 ${
              isDragging
                ? "border-[#8b5cf6] bg-[#8b5cf6]/10 text-white"
                : "border-white/10 bg-[#222] hover:bg-[#2a2a2a] text-gray-400 hover:text-white hover:border-[#8b5cf6]/50"
            }`}
            variant="ghost"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center pointer-events-none">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold pointer-events-none">
              {loading
                ? "Uploading..."
                : isDragging
                  ? "Drop Image Here"
                  : "Click or Drag Image Here"}
            </span>
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
            Search images
          </h3>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#8b5cf6] transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or category"
              className="h-11 pl-10 bg-[#222] border-transparent focus:border-[#8b5cf6] text-sm text-white rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-8 no-scrollbar">
        {/* Recent Uploads Section */}
        {recentImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Recent Uploads
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {recentImages.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => startPhotoDrag(event, item)}
                  onClick={() => addImage(item.url, item.name)}
                  className="group relative h-24 rounded-lg overflow-hidden cursor-pointer ring-1 ring-white/5 hover:ring-[#8b5cf6] transition-all"
                >
                  <button
                    type="button"
                    onClick={(e) => removeRecentImageFromCanvas(e, item.url)}
                    title="Remove from canvas"
                    aria-label="Remove photo from canvas"
                    className="absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow-lg shadow-black/40 transition-all hover:bg-red-500 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4 stroke-[3]" />
                  </button>
                  <Image
                    src={item.url}
                    alt={item.name}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-110 transition-transform duration-500 opacity-60 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter truncate">
                      {item.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {!hasSearchResults ? (
          <div className="text-center text-gray-500 py-10">
            <p>
              {hasSearch
                ? `No images found matching "${search}"`
                : hasLibraryAssets
                  ? "No recent uploads yet"
                  : "No library photos yet"}
            </p>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {cat.name}
                </h4>
                {cat.items.length > 4 && (
                  <button className="text-[10px] font-bold text-gray-400 flex items-center hover:text-white transition-colors uppercase">
                    See more <ChevronRight className="w-3 h-3 ml-1" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(event) => startPhotoDrag(event, item)}
                    onClick={() => addImage(item.url, item.name)}
                    className="group relative h-24 rounded-lg overflow-hidden cursor-pointer ring-1 ring-white/5 hover:ring-[#8b5cf6] transition-all"
                  >
                    <Image
                      src={item.url}
                      alt={item.name}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-110 transition-transform duration-500 opacity-60 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[10px] font-bold text-white uppercase tracking-tighter truncate">
                        {item.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
