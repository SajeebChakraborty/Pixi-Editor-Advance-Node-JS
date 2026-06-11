"use client";

import { ImageIcon, Trash2, Type, Volume2, VolumeX } from "lucide-react";
import { CanvasProperties } from "@/components/editor/properties/canvas-properties";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";

export function VideoPlayerProperties() {
  const {
    videoState,
    setVideoState,
    getLayers,
    deleteLayer,
  } = useEditorStore();
  const {
    volume,
    isMuted,
    playbackRate,
    startTime,
    endTime,
    duration,
    filters,
  } = videoState;

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-8 bg-black text-white">
      <CanvasProperties />

      <section className="space-y-4 px-4">
        <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Properties
        </h3>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase text-white/60">
              Speed Factor
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.5, 1, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setVideoState({ playbackRate: speed })}
                  className={cn(
                    "h-8 rounded-md border text-[10px] font-black transition-all",
                    playbackRate === speed
                      ? "border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "border-white/10 bg-[#18181b] text-white/40 hover:text-white",
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-white/60">
                Audio Level
              </label>
              <span className="text-[10px] font-mono text-white/40">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setVideoState({ isMuted: !isMuted })}
                className="rounded-lg border border-white/5 bg-[#18181b] p-2 text-white/40 hover:text-white"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={(value) =>
                  setVideoState({
                    volume: value[0],
                    isMuted: value[0] === 0,
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 px-4">
        <h3 className="flex justify-between border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          <span>Visual Effects</span>
          <button
            onClick={() =>
              setVideoState({
                filters: { grayscale: 0, blur: 0, brightness: 100 },
              })
            }
            className="text-blue-400 hover:text-blue-300"
          >
            Reset
          </button>
        </h3>
        <div className="space-y-4">
          <EffectSlider
            label="Grayscale"
            value={filters.grayscale}
            max={100}
            onChange={(grayscale) =>
              setVideoState({ filters: { ...filters, grayscale } })
            }
          />
          <EffectSlider
            label="Blur"
            value={filters.blur}
            max={20}
            onChange={(blur) =>
              setVideoState({ filters: { ...filters, blur } })
            }
          />
          <EffectSlider
            label="Brightness"
            value={filters.brightness}
            max={200}
            onChange={(brightness) =>
              setVideoState({ filters: { ...filters, brightness } })
            }
          />
        </div>
      </section>

      <section className="space-y-4 px-4">
        <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Primary Trim
        </h3>
        <div className="space-y-8 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
          <TrimSlider
            label="In Point"
            value={startTime}
            displayValue={formatTime(startTime)}
            max={endTime}
            onChange={(value) => setVideoState({ startTime: value })}
          />
          <TrimSlider
            label="Out Point"
            value={endTime}
            displayValue={formatTime(endTime)}
            min={startTime}
            max={duration}
            tone="text-red-400"
            onChange={(value) => setVideoState({ endTime: value })}
          />
        </div>
      </section>

      <section className="space-y-4 px-4 pb-4">
        <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Layers List
        </h3>
        <div className="space-y-2">
          {getLayers().map((layer) => (
            <div
              key={layer.id}
              className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-2 transition-all hover:border-white/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                {layer.type === "text" ? (
                  <Type className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                )}
                <span className="truncate text-[10px] font-bold text-white/80">
                  {layer.name}
                </span>
              </div>
              <button
                onClick={() => deleteLayer(layer.id)}
                className="text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                aria-label={`Delete ${layer.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EffectSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] uppercase text-white/40">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}</span>
      </div>
      <Slider
        value={[value]}
        max={max}
        step={1}
        onValueChange={(next) => onChange(next[0])}
        className="py-1"
      />
    </div>
  );
}

function TrimSlider({
  label,
  value,
  displayValue,
  min = 0,
  max,
  tone = "text-blue-400",
  onChange,
}: {
  label: string;
  value: number;
  displayValue: string;
  min?: number;
  max: number;
  tone?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-white/40">{label}</span>
        <span className={tone}>{displayValue}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={Math.max(min, max)}
        step={0.1}
        onValueChange={(next) => onChange(next[0])}
      />
    </div>
  );
}
