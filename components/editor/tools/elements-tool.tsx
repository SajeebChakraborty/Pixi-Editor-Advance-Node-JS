"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  ChevronRight,
  Sticker,
  Palette,
  Zap,
  Star,
  LayoutGrid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/lib/store";
import { FabricImage } from "fabric";
import { Asset, AssetService } from "@/lib/asset-service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

export function ElementsTool() {
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeType, setActiveType] = useState<string>("all");
  const { canvas, addLayer } = useEditorStore();

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const data = await AssetService.getAssets();
        setAssets(data.filter((a: Asset) => a.enabled));
      } catch (e) {
        console.error("Failed to load elements", e);
      }
    };
    loadAssets();
  }, []);

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesType = activeType === "all" || asset.type === activeType;
    return matchesSearch && matchesType;
  });

  const addElement = async (asset: Asset) => {
    try {
      const store = useEditorStore.getState();
      const { addMediaFromUrl } = await import("@/lib/editor-utils");

      await addMediaFromUrl(asset.url, store, asset.type as any);
    } catch (err) {
      console.error("Error adding element:", err);
      toast.error("Failed to add element. Verify your S3 CORS settings.");
    }
  };

  const categories = [
    { id: "all", label: "All", icon: LayoutGrid },
    { id: "sticker", label: "Stickers", icon: Sticker },
    { id: "icon", label: "Icons", icon: Zap },
    { id: "shape", label: "Designs", icon: Palette },
  ];

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      <div className="px-5 py-6 space-y-6 flex flex-col h-full">
        {/* Search */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
            Browse Elements
          </h3>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#8b5cf6] transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons, stickers..."
              className="h-11 pl-10 bg-[#222] border-transparent focus:border-[#8b5cf6] text-sm text-white rounded-xl"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveType(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                activeType === cat.id
                  ? "bg-[#8b5cf6] border-transparent text-white shadow-lg shadow-purple-500/20"
                  : "bg-[#222] border-white/5 text-gray-400 hover:text-white hover:bg-[#333]",
              )}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Elements Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
          <div className="grid grid-cols-3 gap-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => addElement(asset)}
                className="aspect-square bg-[#222] rounded-xl flex items-center justify-center p-3 cursor-pointer hover:bg-[#333] border border-white/5 transition-all group relative"
              >
                <div className="w-full h-full relative">
                  <Image
                    src={asset.url}
                    alt={asset.name}
                    fill
                    unoptimized
                    className="object-contain group-hover:scale-110 transition-transform"
                  />
                </div>
                {asset.isPremium && (
                  <div className="absolute top-1 right-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                  <span className="text-[8px] font-bold text-white uppercase truncate px-1">
                    {asset.name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500 text-xs">No elements found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
