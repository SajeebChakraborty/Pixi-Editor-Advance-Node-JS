"use client";

import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Upload, Search, Filter, FolderOpen, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import Image from "next/image";
import { AssetLibrary, Asset } from "@/lib/assets";
import { AssetService } from "@/lib/asset-service";
import { FabricImage } from "fabric";
import { toast } from "sonner";

export function AssetTool() {
  const { canvas, addLayer, recentAssets } = useEditorStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">(
    "all",
  );
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = () => {
    const all = AssetLibrary.getAllAssets();
    setAssets(all);
    setLoading(false);
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      selectedCategory === "all" || asset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...AssetLibrary.getCategories()];

  const handleAddToCanvas = async (asset: {
    url: string;
    name: string;
    type: string;
  }) => {
    try {
      const store = useEditorStore.getState();
      const { addMediaFromUrl } = await import("@/lib/editor-utils");
      await addMediaFromUrl(asset.url, store, asset.type as any);
    } catch (err) {
      console.error("Failed to add asset", err);
      toast.error("Failed to add asset");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      <div className="px-5 py-6 space-y-6 flex-1 flex flex-col min-h-0">
        <Button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*,video/*";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const toastId = toast.loading("Uploading to cloud...");
                try {
                  const name = file.name.split(".")[0];
                  const type = file.type.startsWith("video")
                    ? "video"
                    : "image";
                  const category = type; // Default category to type

                  const newAsset = await AssetService.addAsset(
                    file,
                    name,
                    type as any,
                    category,
                  );

                  if (newAsset) {
                    toast.success("Uploaded to cloud successfully", {
                      id: toastId,
                    });
                    handleAddToCanvas({
                      url: newAsset.url,
                      name: newAsset.name,
                      type: newAsset.type,
                    });
                  }
                } catch (err: any) {
                  console.error("Upload failed:", err);
                  toast.error(`Upload failed: ${err.message}`, { id: toastId });
                }
              }
            };
            input.click();
          }}
          className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold h-11 rounded-xl shadow-lg shadow-purple-500/10 gap-2"
        >
          <Upload className="w-4 h-4" /> Upload Media
        </Button>

        {/* Recent Uploads Section */}
        {recentAssets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Recent Uploads
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {recentAssets.slice(0, 6).map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleAddToCanvas(asset)}
                  className="aspect-square bg-[#222] border border-white/5 rounded-lg overflow-hidden cursor-pointer hover:border-[#8b5cf6] transition-all relative group"
                >
                  {asset.type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <Video className="w-4 h-4 text-gray-600" />
                    </div>
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
              Library
            </h3>
            <span className="text-[10px] text-gray-600 font-mono">
              {filteredAssets.length} items
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="h-11 pl-10 bg-[#222] border-transparent text-sm text-white rounded-xl focus:border-[#8b5cf6]"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-white text-black"
                    : "bg-[#222] text-gray-400 hover:text-white"
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">No assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleAddToCanvas(asset)}
                  className="aspect-square bg-[#222] border border-white/5 rounded-xl overflow-hidden group cursor-pointer hover:border-[#8b5cf6] transition-all relative"
                >
                  {asset.type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <span className="text-xs text-gray-500">Video</span>
                    </div>
                  ) : (
                    <Image
                      src={asset.url}
                      alt={asset.name}
                      width={150}
                      height={150}
                      unoptimized
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-[10px] font-bold text-white truncate">
                      {asset.name}
                    </p>
                    <p className="text-[9px] text-gray-400 capitalize">
                      {asset.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
