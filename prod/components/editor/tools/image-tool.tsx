"use client";

import React, { useRef, useState, useEffect } from "react";
import { FabricImage } from "fabric";
import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Upload, X } from "lucide-react";
import Image from "next/image";

import { AssetService } from "@/lib/asset-service";
import { addMediaFromUrl } from "@/lib/editor-utils";
import { toast } from "sonner";

export function ImageTool() {
  const [search, setSearch] = useState("");
  const { recentAssets, deleteLayer, getLayers } = useEditorStore();
  const [categories, setCategories] = useState<
    { name: string; items: any[] }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Adding image to canvas...");
    const reader = new FileReader();

    reader.onload = async (event) => {
      const url = event.target?.result as string;
      if (url) {
        // Dismiss the loading toast; addImage will show its own success/error toast
        toast.dismiss(toastId);
        await addImage(url, file.name);
      } else {
        toast.error("Failed to read image file", { id: toastId });
      }
      setLoading(false);
    };

    reader.onerror = () => {
      toast.error("Error reading file", { id: toastId });
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
      e.target.value = "";
    }
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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const loadImages = async () => {
    try {
      const assets = await AssetService.getAssets("image");

      // Group by category
      const grouped = assets.reduce((acc: any, asset: any) => {
        const cat = asset.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(asset);
        return acc;
      }, {});

      const catList = Object.keys(grouped).map((name) => ({
        name,
        items: grouped[name],
      }));

      setCategories(catList);
    } catch (e) {
      console.error("Failed to load images", e);
    }
  };

  // Filtering categories based on search
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const addImage = async (url: string, name: string = "Image") => {
    try {
      // Get the store FRESH at call time — not from a closure captured before
      // any async operations, which could give a stale fabricCanvas reference.
      const store = useEditorStore.getState();
      await addMediaFromUrl(url, store, "image");
    } catch (err) {
      console.error("Error adding image:", err);
      toast.error("Failed to add image.");
    }
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
      toast.info("This image is not on the active canvas.");
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
              placeholder="i.e. indoor, Person, dog"
              className="h-11 pl-10 bg-[#222] border-transparent focus:border-[#8b5cf6] text-sm text-white rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-8 no-scrollbar">
        {/* Recent Uploads Section */}
        {recentAssets.filter((a) => a.type === "image").length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Recent Uploads
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {recentAssets
                .filter((a) => a.type === "image")
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={item.url + Math.random()}
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
        {filteredCategories.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <p>No images found matching &quot;{search}&quot;</p>
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
