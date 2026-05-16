"use client";

import { useState, useEffect } from "react";
import { Search, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import { Template, TemplateManager } from "@/lib/templates";
import { useEditorStore } from "@/lib/store";
import { toast } from "sonner";

export function TemplateTool() {
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const { canvas } = useEditorStore();
  const fabricCanvas = canvas.fabricCanvas;

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const data = await TemplateManager.getTemplates();
        setTemplates(data);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleApplyTemplate = async (template: Template) => {
    if (!fabricCanvas) {
      toast.error("Canvas not initialized");
      return;
    }

    try {
      toast.loading("Applying template...", { id: "apply-template" });
      await TemplateManager.applyTemplate(fabricCanvas, template);
      toast.success("Template applied!", { id: "apply-template" });
    } catch (error) {
      console.error("Error applying template:", error);
      toast.error("Failed to apply template", { id: "apply-template" });
    }
  };

  // Group templates by category
  const categories = templates.reduce(
    (acc, template) => {
      const category = template.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>,
  );

  const filteredCategories = Object.entries(categories)
    .map(([name, items]) => ({
      name,
      items: items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const handleResetTemplate = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
    toast.info("Canvas reset");
  };

  return (
    <div className="flex flex-col h-full bg-[#161616]">
      {/* Header with Search */}
      <div className="px-5 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button className="flex-1 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-bold h-10 shadow-lg shadow-purple-500/20">
            Templates
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-10 px-0 border-white/10 hover:bg-white/5 text-gray-400"
                title="Reset Canvas"
              >
                <span className="text-xs">↻</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#1e1e1e] border-white/10 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Reset canvas to blank state?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  This action cannot be undone. All current edits and layers
                  will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetTemplate}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
            Search Templates
          </h3>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#8b5cf6] transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="i.e. Indoor, Person, Dog"
              className="h-11 pl-10 bg-[#222] border-transparent focus:border-[#8b5cf6] text-sm text-white rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-8 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-[#8b5cf6] animate-spin" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">
              Loading Library...
            </p>
          </div>
        ) : filteredCategories.length > 0 ? (
          filteredCategories.map((cat) => (
            <div key={cat.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {cat.name}
                </h4>
                <button className="text-[10px] font-bold text-gray-400 flex items-center hover:text-white transition-colors uppercase">
                  See more <ChevronRight className="w-3 h-3 ml-1" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleApplyTemplate(item)}
                    className="group relative h-24 rounded-lg overflow-hidden cursor-pointer ring-1 ring-white/5 hover:ring-[#8b5cf6] transition-all"
                  >
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-110 transition-transform duration-500 opacity-60 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#333] flex items-center justify-center">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                          {item.name}
                        </span>
                      </div>
                    )}
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
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm">No templates found</p>
          </div>
        )}
      </div>
    </div>
  );
}
