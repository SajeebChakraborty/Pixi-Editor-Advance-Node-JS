"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  Trash2,
  Edit3,
  Copy,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Target,
  Upload,
  FileJson,
  ImageIcon,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Template, TemplateManager } from "@/lib/templates";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function TemplatesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Template Form State
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "Social Media",
    description: "",
    width: 1080,
    height: 1080,
  });

  // Upload Template Form State
  const [uploadTemplate, setUploadTemplate] = useState({
    name: "",
    category: "Social Media",
    description: "",
    tags: "" as string,
    published: false,
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const data = await TemplateManager.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplate.name) {
      toast.error("Please provide a template name");
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await TemplateManager.saveTemplate({
        name: newTemplate.name,
        category: newTemplate.category,
        description: newTemplate.description,
        width: newTemplate.width,
        height: newTemplate.height,
        layers: [
          {
            id: "bg-1",
            type: "shape",
            name: "Background",
            locked: false,
            properties: {
              fill: "#ffffff",
              width: newTemplate.width,
              height: newTemplate.height,
              left: 0,
              top: 0,
            },
          },
        ],
      });

      if (created) {
        toast.success("Template created successfully!");
        setIsCreateDialogOpen(false);
        fetchTemplates();

        // Redirect to editor in admin mode to design the template
        window.open(`/?admin=true&templateId=${created.id}`, "_blank");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadTemplate = async () => {
    if (!uploadTemplate.name) {
      toast.error("Please provide a template name");
      return;
    }

    if (!thumbnailFile) {
      toast.error("Please upload a thumbnail image");
      return;
    }

    if (!jsonFile) {
      toast.error("Please upload a template file (JSON or image)");
      return;
    }

    try {
      setIsSubmitting(true);
      const tags = uploadTemplate.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const created = await TemplateManager.uploadTemplate(
        uploadTemplate.name,
        uploadTemplate.description,
        uploadTemplate.category,
        tags,
        thumbnailFile,
        jsonFile,
        uploadTemplate.published,
      );

      if (created) {
        toast.success("Template uploaded successfully!");
        setIsUploadDialogOpen(false);
        // Reset form
        setUploadTemplate({
          name: "",
          category: "Social Media",
          description: "",
          tags: "",
          published: false,
        });
        setThumbnailFile(null);
        setJsonFile(null);
        setThumbnailPreview(null);
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error uploading template:", error);
      toast.error("Failed to upload template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isJson = file.name.endsWith(".json");
      const isImage = file.type.startsWith("image/");

      if (isJson || isImage) {
        setJsonFile(file);
      } else {
        toast.error("Please select a valid JSON or image file");
      }
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const success = await TemplateManager.deleteTemplate(id);
      if (success) {
        toast.success("Template deleted");
        fetchTemplates();
      }
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Templates Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and create templates for your editor panel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 border-slate-200">
            <Filter className="w-4 h-4" />
            Filters
          </Button>

          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            variant="outline"
            className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Upload className="w-4 h-4" />
            Upload Template
          </Button>

          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2 shadow-lg shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Upload Template Dialog */}
      {isUploadDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white relative sticky top-0 z-10">
              <button
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadTemplate({
                    name: "",
                    category: "Social Media",
                    description: "",
                    tags: "",
                    published: false,
                  });
                  setThumbnailFile(null);
                  setJsonFile(null);
                  setThumbnailPreview(null);
                }}
                className="absolute top-6 right-6 p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold">Upload Template</h2>
              <p className="text-indigo-100 mt-1 text-sm">
                Upload a complete template with thumbnail and JSON layout
              </p>
            </div>

            <div className="p-8 space-y-6">
              {/* Template Name */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Template Name *
                </Label>
                <Input
                  placeholder="e.g. Summer Sale Instagram Post"
                  className="h-12 border-slate-200 focus:ring-indigo-500 rounded-xl"
                  value={uploadTemplate.name}
                  onChange={(e) =>
                    setUploadTemplate({
                      ...uploadTemplate,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              {/* Thumbnail Upload */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Thumbnail Image *
                </Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-indigo-400 transition-colors">
                  {thumbnailPreview ? (
                    <div className="space-y-3">
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-100">
                        <Image
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setThumbnailFile(null);
                          setThumbnailPreview(null);
                        }}
                        className="w-full"
                      >
                        Remove Thumbnail
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-medium text-slate-600">
                        Click to upload thumbnail
                      </p>
                      <p className="text-xs text-slate-400">
                        PNG, JPG up to 5MB
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleThumbnailChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* JSON Layout or Image Upload */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Template File (JSON or Image) *
                </Label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-indigo-400 transition-colors">
                  {jsonFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          {jsonFile.type.startsWith("image/") ? (
                            <ImageIcon className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <FileJson className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {jsonFile.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(jsonFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setJsonFile(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <FileJson className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-medium text-slate-600">
                        Click to upload template file
                      </p>
                      <p className="text-xs text-slate-400">
                        JSON layout or PNG/JPG image
                      </p>
                      <input
                        type="file"
                        accept=".json,image/*"
                        className="hidden"
                        onChange={handleJsonChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Category
                </Label>
                <Select
                  value={uploadTemplate.category}
                  onValueChange={(val) =>
                    setUploadTemplate({ ...uploadTemplate, category: val })
                  }
                >
                  <SelectTrigger className="h-12 border-slate-200 rounded-xl">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Tags (comma separated)
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="e.g. instagram, sale, summer"
                    className="h-12 pl-10 border-slate-200 focus:ring-indigo-500 rounded-xl"
                    value={uploadTemplate.tags}
                    onChange={(e) =>
                      setUploadTemplate({
                        ...uploadTemplate,
                        tags: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  Description (Optional)
                </Label>
                <textarea
                  className="w-full min-h-[100px] border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                  placeholder="Describe this template..."
                  value={uploadTemplate.description}
                  onChange={(e) =>
                    setUploadTemplate({
                      ...uploadTemplate,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              {/* Publish Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Publish Template
                  </p>
                  <p className="text-xs text-slate-500">
                    Make this template available to users
                  </p>
                </div>
                <button
                  onClick={() =>
                    setUploadTemplate({
                      ...uploadTemplate,
                      published: !uploadTemplate.published,
                    })
                  }
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors",
                    uploadTemplate.published ? "bg-indigo-600" : "bg-slate-300",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                      uploadTemplate.published ? "left-6" : "left-0.5",
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-6 border-t border-slate-100 flex gap-3 justify-end items-center sticky bottom-0">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setUploadTemplate({
                    name: "",
                    category: "Social Media",
                    description: "",
                    tags: "",
                    published: false,
                  });
                  setThumbnailFile(null);
                  setJsonFile(null);
                  setThumbnailPreview(null);
                }}
                className="rounded-xl font-bold"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadTemplate}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px] h-11 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Template
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white relative">
              <button
                onClick={() => setIsCreateDialogOpen(false)}
                className="absolute top-6 right-6 p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold">New Template</h2>
              <p className="text-indigo-100 mt-1 text-sm">
                Define the basic properties of your template. You can design it
                later.
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-slate-700 font-bold uppercase tracking-wider text-[10px]"
                >
                  Template Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Summer Sale Instagram"
                  className="h-12 border-slate-200 focus:ring-indigo-500 rounded-xl"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Category
                  </Label>
                  <Select
                    value={newTemplate.category}
                    onValueChange={(val) =>
                      setNewTemplate({ ...newTemplate, category: val })
                    }
                  >
                    <SelectTrigger className="h-12 border-slate-200 rounded-xl">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Social Media">Social Media</SelectItem>
                      <SelectItem value="E-commerce">E-commerce</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Size Preset
                  </Label>
                  <Select
                    onValueChange={(val) => {
                      if (val === "square")
                        setNewTemplate({
                          ...newTemplate,
                          width: 1080,
                          height: 1080,
                        });
                      else if (val === "hd")
                        setNewTemplate({
                          ...newTemplate,
                          width: 1920,
                          height: 1080,
                        });
                      else if (val === "story")
                        setNewTemplate({
                          ...newTemplate,
                          width: 1080,
                          height: 1920,
                        });
                    }}
                  >
                    <SelectTrigger className="h-12 border-slate-200 rounded-xl">
                      <SelectValue placeholder="Custom (1080x1080)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square (1080x1080)</SelectItem>
                      <SelectItem value="hd">Full HD (1920x1080)</SelectItem>
                      <SelectItem value="story">Story (1080x1920)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="desc"
                  className="text-slate-700 font-bold uppercase tracking-wider text-[10px]"
                >
                  Description (Optional)
                </Label>
                <textarea
                  id="desc"
                  className="w-full min-h-[100px] border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                  placeholder="What is this template for?"
                  value={newTemplate.description}
                  onChange={(e) =>
                    setNewTemplate({
                      ...newTemplate,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="bg-slate-50 p-6 border-t border-slate-100 flex gap-3 justify-end items-center">
              <Button
                variant="ghost"
                onClick={() => setIsCreateDialogOpen(false)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px] h-11 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Templates",
            value: templates.length,
            icon: LayoutGrid,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Active",
            value: templates.filter((t) => t.layers.length > 0).length,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Categories",
            value: new Set(templates.map((t) => t.category)).size,
            icon: List,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Recently Added",
            value: templates.length,
            icon: Clock,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4"
          >
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                stat.bg,
              )}
            >
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            className="pl-10 h-10 bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("grid")}
            className={cn(
              viewMode === "grid" && "bg-indigo-50 text-indigo-600",
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("list")}
            className={cn(
              viewMode === "list" && "bg-indigo-50 text-indigo-600",
            )}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Templates Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Fetching templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4 bg-white rounded-3xl border border-slate-200 text-center px-6">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
            <LayoutGrid className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            No Templates Found
          </h3>
          <p className="text-slate-500 max-w-xs mx-auto">
            Try adjusting your search or create a new template to get started.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              fetchTemplates();
            }}
            className="mt-2"
          >
            Clear Filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:border-indigo-400"
            >
              <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                {template.thumbnail ? (
                  <Image
                    src={template.thumbnail}
                    alt={template.name}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                    <span className="text-slate-300 font-bold uppercase tracking-widest text-xs">
                      {template.width}x{template.height}
                    </span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md",
                      "bg-white/80 text-indigo-600 border border-white",
                    )}
                  >
                    {template.category}
                  </span>
                </div>
                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                  <Button
                    size="sm"
                    className="bg-white text-indigo-600 hover:bg-slate-100 border-none shadow-xl"
                    onClick={() =>
                      window.open(
                        `/?admin=true&templateId=${template.id}`,
                        "_blank",
                      )
                    }
                  >
                    <Edit3 className="w-4 h-4 mr-2" /> Design
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="w-9 h-9 bg-white/20 hover:bg-red-500 text-white border-white/20 backdrop-blur-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">
                      {template.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      {template.width}px × {template.height}px
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:bg-slate-50"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    Recently Updated
                  </div>
                  <div className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                    FREE
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Dimensions
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-12 bg-slate-100 rounded-md overflow-hidden flex-shrink-0 border border-slate-100">
                        {template.thumbnail && (
                          <Image
                            src={template.thumbnail}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        )}
                      </div>
                      <span className="font-bold text-slate-700 uppercase tracking-tight text-sm">
                        {template.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase">
                      {template.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600">
                      {template.width} × {template.height}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                        "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 border border-slate-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200"
                        onClick={() =>
                          window.open(
                            `/?admin=true&templateId=${template.id}`,
                            "_blank",
                          )
                        }
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="h-8 w-8 text-slate-400 border border-slate-200 hover:bg-white hover:text-red-600 hover:border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 border border-slate-200 hover:bg-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
