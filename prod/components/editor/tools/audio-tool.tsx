"use client";

import { Search, Play, Pause, Plus, ChevronRight, Music } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";
import { toast } from "sonner";

const AUDIO_CATEGORIES = [
  {
    name: "Winter",
    items: [
      {
        id: 1,
        title: "Radiant Girl",
        duration: "2:07",
        url: "/audio/radiant.mp3",
      },
      { id: 2, title: "Sunny Day", duration: "3:15", url: "/audio/sunny.mp3" },
      {
        id: 3,
        title: "Midnight Dream",
        duration: "4:22",
        url: "/audio/midnight.mp3",
      },
      {
        id: 4,
        title: "Ethereal Waves",
        duration: "5:10",
        url: "/audio/ethereal.mp3",
      },
      {
        id: 5,
        title: "Dancing Lights",
        duration: "2:15",
        url: "/audio/dancing.mp3",
      },
    ],
  },
  {
    name: "Eid",
    items: [
      {
        id: 6,
        title: "Celebration",
        duration: "2:30",
        url: "/audio/celebration.mp3",
      },
      {
        id: 7,
        title: "Joyful Moments",
        duration: "1:45",
        url: "/audio/joy.mp3",
      },
    ],
  },
  {
    name: "Holiday",
    items: [
      {
        id: 8,
        title: "Beach Vibes",
        duration: "3:00",
        url: "/audio/beach.mp3",
      },
      {
        id: 9,
        title: "Mountain Trip",
        duration: "2:50",
        url: "/audio/mountain.mp3",
      },
    ],
  },
];

export function AudioTool() {
  const [playingId, setPlayingId] = useState<number | string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addLayer, recentAssets, addRecentAsset } = useEditorStore();

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const handleUploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        addRecentAsset({ url, name: file.name, type: "audio" });
        toast.success("Audio uploaded to library");
      }
    };
    input.click();
  };

  const togglePlay = (id: number | string, url?: string) => {
    if (playingId === id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      let audioUrl = url;
      if (!audioUrl && typeof id === "number") {
        const allItems = AUDIO_CATEGORIES.flatMap((c) => c.items);
        const targetItem = allItems.find((i) => i.id === id);
        if (targetItem) audioUrl = targetItem.url;
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(console.error);
        audio.onended = () => setPlayingId(null);
        audioRef.current = audio;
        setPlayingId(id);
      }
    }
  };

  const handleAddAudio = (item: any) => {
    addLayer({
      type: "audio",
      name: item.title,
      locked: false,
      visible: true,
      data: { url: item.url, duration: item.duration },
    });
    toast.success(`Added ${item.title} to timeline`);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 space-y-4">
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg p-3 text-center shadow-lg">
          <h2 className="text-white font-bold text-lg tracking-wide flex items-center justify-center gap-2">
            <Music className="w-5 h-5" /> Sound
          </h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="i.e. Indoor, Person, dog"
            className="pl-9 bg-[#27272a] border-white/10 text-xs h-9 focus:ring-violet-500/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
        <div className="space-y-6 pb-4">
          <Button
            onClick={handleUploadAudio}
            className="w-full bg-white/5 hover:bg-white/10 text-white border-white/10 h-10 mb-4 uppercase text-[10px] font-black tracking-widest gap-2"
          >
            <Plus className="w-4 h-4" /> Upload Audio
          </Button>

          {recentAssets.filter((a) => a.type === "audio").length > 0 && (
            <div className="space-y-3 mb-8">
              <h3 className="text-sm font-bold text-white/90 px-1 italic">
                Recent Uploads
              </h3>
              <div className="space-y-2">
                {recentAssets
                  .filter((a) => a.type === "audio")
                  .map((asset) => (
                    <div
                      key={asset.id}
                      className="bg-white/5 rounded-lg p-2 flex items-center justify-between border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            togglePlay(`recent-${asset.id}`, asset.url)
                          }
                          className="hover:scale-110 transition-transform"
                        >
                          {playingId === `recent-${asset.id}` ? (
                            <Pause className="w-4 h-4 text-violet-400 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-violet-400 fill-current" />
                          )}
                        </button>
                        <span className="text-[10px] font-bold text-white/70 truncate w-32">
                          {asset.name}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() =>
                          handleAddAudio({ title: asset.name, url: asset.url })
                        }
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {AUDIO_CATEGORIES.map((category) => (
            <div key={category.name} className="space-y-3">
              <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                <h3 className="text-sm font-bold text-white/90">
                  {category.name}
                </h3>
                <span className="text-[10px] text-gray-500 flex items-center gap-1 group-hover:text-violet-400 transition-colors">
                  See more <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              <div className="space-y-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-[#09090b] hover:bg-[#27272a] rounded-lg p-2 flex items-center gap-3 border border-white/5 transition-all hover:border-violet-500/30"
                  >
                    <button
                      onClick={() => togglePlay(item.id, item.url)}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-colors text-white/70"
                    >
                      {playingId === item.id ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/90 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {item.duration}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleAddAudio(item)}
                      className="w-7 h-7 hover:bg-violet-500/20 hover:text-violet-400 text-gray-500 rounded-md"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
