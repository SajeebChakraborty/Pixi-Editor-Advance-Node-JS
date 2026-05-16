"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Edit,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
  Sticker,
  Type,
  Video,
  Music,
  Layout,
  Upload,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

import { useEffect } from "react";
import { AssetService, Asset } from "@/lib/asset-service";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("icon");
  const [uploadName, setUploadName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const data = await AssetService.getAllAssetsAdmin();
      setAssets(data);
    } catch (e) {
      toast.error("Failed to load assets from server");
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filterType === "all" || asset.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const toggleAsset = async (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    const newStatus = !asset.enabled;
    await AssetService.toggleAsset(id, newStatus);

    // Optimistic update
    setAssets(
      assets.map((a) => (a.id === id ? { ...a, enabled: newStatus } : a)),
    );
    toast.success(`Asset ${newStatus ? "enabled" : "disabled"}`);
  };

  const deleteAsset = async (id: string) => {
    const success = await AssetService.deleteAsset(id);
    if (success) {
      setAssets(assets.filter((a) => a.id !== id));
      toast.error("Asset deleted permanentely");
    } else {
      toast.error("Failed to delete asset");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadName(file.name.split(".")[0]);
    setIsUploadDialogOpen(true);

    // Reset the input
    e.target.value = "";
  };

  const handleUploadAsset = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const toastId = toast.loading("Uploading asset...");

    try {
      const type = selectedFile.type.startsWith("image")
        ? uploadCategory === "icon" || uploadCategory === "sticker"
          ? uploadCategory
          : "image"
        : selectedFile.type.startsWith("audio")
          ? "audio"
          : selectedFile.type.startsWith("video")
            ? "video"
            : uploadCategory; // Use selected category as fallback

      const newAsset = await AssetService.addAsset(
        selectedFile,
        uploadName || selectedFile.name.split(".")[0],
        type as any,
        uploadCategory,
      );

      if (newAsset) {
        setAssets([newAsset, ...assets]);
        toast.success("Asset uploaded successfully", { id: toastId });
        setIsUploadDialogOpen(false);
        setSelectedFile(null);
        setUploadName("");
        setUploadCategory("icon");
      } else {
        toast.error("Upload failed", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error uploading file", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    const input = document.getElementById(
      "asset-upload-input",
    ) as HTMLInputElement;
    if (input) input.click();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sticker":
        return <Sticker className="w-4 h-4" />;
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "shape":
        return <Type className="w-4 h-4" />;
      case "audio":
        return <Music className="w-4 h-4" />;
      case "template":
        return <Layout className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hidden File Input */}
      <input
        id="asset-upload-input"
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/*"
        onChange={handleFileSelect}
      />

      {/* Upload Dialog */}
      {isUploadDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white relative">
              <button
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setSelectedFile(null);
                  setUploadName("");
                }}
                className="absolute top-6 right-6 p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold">Upload Asset</h2>
              <p className="text-indigo-100 mt-1 text-sm">
                Categorize and upload your asset to the library
              </p>
            </div>

            <div className="p-8 space-y-6">
              {/* File Preview */}
              {selectedFile && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Selected File
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      {selectedFile.type.startsWith("image") ? (
                        <ImageIcon className="w-6 h-6 text-indigo-600" />
                      ) : selectedFile.type.startsWith("video") ? (
                        <Video className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <Music className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Asset Name */}
              <div className="space-y-2">
                <label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Asset Name
                </label>
                <Input
                  placeholder="e.g. Summer Icon"
                  className="h-12 border-slate-200 focus:ring-indigo-500 rounded-xl"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "icon", label: "Icon", icon: ImageIcon },
                    { value: "sticker", label: "Sticker", icon: Sticker },
                    { value: "photo", label: "Photo", icon: ImageIcon },
                    { value: "video", label: "Video", icon: Video },
                    { value: "giphy", label: "Giphy", icon: ImageIcon },
                    { value: "audio", label: "Audio", icon: Music },
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setUploadCategory(cat.value)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                        uploadCategory === cat.value
                          ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 hover:border-slate-300 text-slate-600",
                      )}
                    >
                      <cat.icon className="w-5 h-5" />
                      <span className="text-xs font-bold">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 border-t border-slate-100 flex gap-3 justify-end items-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setSelectedFile(null);
                  setUploadName("");
                }}
                className="rounded-xl font-bold"
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadAsset}
                disabled={isUploading || !uploadName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px] h-11 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Asset
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Asset Management
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Manage cross-platform stickers, templates, and libraries.
          </p>
        </div>
        <Button
          onClick={handleUploadClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6 rounded-xl h-11 shadow-lg shadow-indigo-600/20"
        >
          <Upload className="w-4 h-4" /> Upload New Asset
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "Total Assets", value: assets.length, color: "bg-blue-600" },
          {
            label: "Active Stickers",
            value: assets.filter((a) => a.type === "sticker").length,
            color: "bg-purple-600",
          },
          {
            label: "Disabled",
            value: assets.filter((a) => !a.enabled).length,
            color: "bg-slate-600",
          },
          { label: "Cloud Usage", value: "1.2 GB", color: "bg-indigo-600" },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all"
          >
            <div
              className={cn(
                "absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5",
                stat.color,
              )}
            />
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">
              {stat.label}
            </p>
            <p className="text-3xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by asset name, tag, or category..."
            className="pl-11 h-11 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {["all", "sticker", "image", "shape", "template", "audio"].map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  filterType === type
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "text-slate-500 hover:bg-slate-100",
                )}
              >
                {type}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                Asset Preview
              </th>
              <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                Details
              </th>
              <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                Category
              </th>
              <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                Status
              </th>
              <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredAssets.map((asset) => (
              <tr
                key={asset.id}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 group-hover:scale-105 transition-transform">
                    {asset.type === "audio" ? (
                      <Music className="w-6 h-6 text-indigo-500" />
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-900">
                    {asset.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="p-1 bg-slate-100 rounded text-slate-500">
                      {getTypeIcon(asset.type)}
                    </span>
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {asset.type}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tight">
                    {asset.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {asset.enabled ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">
                        Active
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">
                        Disabled
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleAsset(asset.id)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        asset.enabled
                          ? "text-indigo-600 hover:bg-indigo-50"
                          : "text-slate-400 hover:bg-slate-100",
                      )}
                    >
                      {asset.enabled ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-900"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 rounded-xl border-slate-200"
                      >
                        <DropdownMenuItem className="text-xs font-bold gap-2 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">
                          <Edit className="w-3.5 h-3.5" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteAsset(asset.id)}
                          className="text-xs font-bold gap-2 text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
