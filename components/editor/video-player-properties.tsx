"use client";

import { useState } from "react";
import { ChevronDown, ImageIcon, SlidersHorizontal, Trash2, Type, Volume2, VolumeX } from "lucide-react";
import { CanvasProperties } from "@/components/editor/properties/canvas-properties";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";
import { DEFAULT_VIDEO_FILTERS } from "@/lib/video-filters";
import type { SceneTransitionType } from "@/lib/video-composition";
import { SCENE_TRANSITION_OPTIONS } from "@/lib/video-transitions";
import {
  buildVideoFiltersFromPreset,
  IMAGE_PRESETS,
  type ImagePresetId,
} from "@/lib/video-presets";

export function VideoPlayerProperties() {
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(true);
  const volume = useEditorStore((state) => state.videoState.volume);
  const isMuted = useEditorStore((state) => state.videoState.isMuted);
  const playbackRate = useEditorStore(
    (state) => state.videoState.playbackRate,
  );
  const startTime = useEditorStore((state) => state.videoState.startTime);
  const endTime = useEditorStore((state) => state.videoState.endTime);
  const duration = useEditorStore((state) => state.videoState.duration);
  const filters = {
    ...DEFAULT_VIDEO_FILTERS,
    ...useEditorStore((state) => state.videoState.filters),
  };
  const filterPreset = useEditorStore(
    (state) => state.videoState.filterPreset || "none",
  );
  const filterPresetIntensity = useEditorStore(
    (state) => state.videoState.filterPresetIntensity ?? 100,
  );
  const pages = useEditorStore((state) => state.canvas.pages);
  const activePageId = useEditorStore((state) => state.canvas.activePageId);
  const setVideoState = useEditorStore((state) => state.setVideoState);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const selectedLayerId = useEditorStore(
    (state) => state.canvas.selectedLayerId,
  );
  const setVideoSceneTransition = useEditorStore(
    (state) => state.setVideoSceneTransition,
  );
  const layers =
    pages.find((page) => page.id === activePageId)?.layers || [];
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const selectedVideoLayer =
    selectedLayer?.type === "video" ? selectedLayer : undefined;

  const setTransition = (side: "before" | "after", type: SceneTransitionType) => {
    if (!selectedVideoLayer) return;
    setVideoSceneTransition(selectedVideoLayer.id, side, {
      type,
      duration: type === "none" ? 0 : 0.5,
    });
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePreset = (presetId: ImagePresetId) => {
    setVideoState({
      filterPreset: presetId,
      filterPresetIntensity: 100,
      filters: buildVideoFiltersFromPreset(presetId, 100),
    });
  };

  const handlePresetIntensity = (value: number) => {
    setVideoState({
      filterPresetIntensity: value,
      filters: buildVideoFiltersFromPreset(filterPreset, value),
    });
  };

  const handleFilterChange = (partial: Partial<typeof filters>) => {
    setVideoState({
      filterPreset: "none",
      filters: { ...filters, ...partial },
    });
  };

  const resetFilters = () => {
    setVideoState({
      filterPreset: "none",
      filterPresetIntensity: 100,
      filters: { ...DEFAULT_VIDEO_FILTERS },
    });
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

      <section className="space-y-3 px-4">
        <button
          type="button"
          onClick={() => setPresetsOpen((open) => !open)}
          className="group flex w-full items-center justify-between border-b border-white/10 pb-2 text-left"
        >
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Presets
          </h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-500 transition-transform group-hover:text-white",
              presetsOpen && "rotate-180",
            )}
          />
        </button>

        {presetsOpen && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#111] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 ring-1 ring-white/10">
              <span>{IMAGE_PRESETS.length} effects</span>
              <span className="text-violet-300">
                {IMAGE_PRESETS.find((item) => item.id === filterPreset)?.label ||
                  "None"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {IMAGE_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.category}
                  onClick={() => handlePreset(item.id)}
                  className={cn(
                    "h-9 rounded-lg px-2 text-[11px] font-bold transition-colors",
                    filterPreset === item.id
                      ? "bg-white text-black"
                      : "bg-[#222] text-gray-400 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filterPreset !== "none" && (
              <div className="rounded-xl bg-[#111] p-3 ring-1 ring-white/10">
                <EffectSlider
                  label="Preset Intensity"
                  value={filterPresetIntensity}
                  max={100}
                  onChange={handlePresetIntensity}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 px-4">
        <button
          type="button"
          onClick={() => setAdjustOpen((open) => !open)}
          className="group flex w-full items-center justify-between border-b border-white/10 pb-2 text-left"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-violet-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Adjust
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                resetFilters();
              }}
              className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-500 transition-transform group-hover:text-white",
                adjustOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {adjustOpen && (
          <div className="space-y-4">
            <EffectSlider
              label="Grayscale"
              value={filters.grayscale}
              max={100}
              onChange={(grayscale) => handleFilterChange({ grayscale })}
            />
            <EffectSlider
              label="Blur"
              value={filters.blur}
              max={20}
              onChange={(blur) => handleFilterChange({ blur })}
            />
            <EffectSlider
              label="Brightness"
              value={filters.brightness}
              max={200}
              onChange={(brightness) => handleFilterChange({ brightness })}
            />
            <EffectSlider
              label="Contrast"
              value={filters.contrast}
              max={200}
              onChange={(contrast) => handleFilterChange({ contrast })}
            />
            <EffectSlider
              label="Saturation"
              value={filters.saturation}
              max={200}
              onChange={(saturation) => handleFilterChange({ saturation })}
            />
            <EffectSlider
              label="Sepia"
              value={filters.sepia}
              max={100}
              onChange={(sepia) => handleFilterChange({ sepia })}
            />
            <EffectSlider
              label="Hue Rotate"
              value={filters.hueRotate}
              max={360}
              onChange={(hueRotate) => handleFilterChange({ hueRotate })}
            />
            <EffectSlider
              label="Invert"
              value={filters.invert}
              max={100}
              onChange={(invert) => handleFilterChange({ invert })}
            />
          </div>
        )}
      </section>

      <section className="space-y-4 px-4">
        <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Transitions
        </h3>
        {selectedVideoLayer ? (
          <div className="space-y-4 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
            <TransitionSelect
              label="Before Clip"
              value={selectedVideoLayer.data?.transitionBefore?.type || "none"}
              onChange={(type) => setTransition("before", type)}
            />
            <TransitionSelect
              label="After Clip"
              value={selectedVideoLayer.data?.transitionAfter?.type || "none"}
              onChange={(type) => setTransition("after", type)}
            />
            <p className="text-[9px] leading-relaxed text-white/35">
              Applies when this clip meets the previous or next video on the
              timeline. Use two or more clips to preview the effect.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 bg-[#18181b]/30 px-4 py-6 text-center text-[10px] leading-relaxed text-white/40">
            Select a video clip on the timeline to choose transitions.
          </p>
        )}
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
          {layers.map((layer) => (
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

function TransitionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SceneTransitionType;
  onChange: (type: SceneTransitionType) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-bold uppercase text-white/60">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as SceneTransitionType)
        }
        className="h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-[11px] font-medium text-white outline-none focus:border-[#8b5cf6]"
      >
        {SCENE_TRANSITION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
