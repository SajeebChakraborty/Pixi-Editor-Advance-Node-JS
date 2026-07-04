"use client";

import { useState } from "react";
import { ChevronDown, ImageIcon, SlidersHorizontal, Trash2, Type, Volume2, VolumeX } from "lucide-react";
import { CanvasProperties } from "@/components/editor/properties/canvas-properties";
import { TextProperties } from "@/components/editor/properties/text-properties";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";
import { DEFAULT_VIDEO_FILTERS } from "@/lib/video-filters";
import { buildVideoComposition, getMidClipTransitions } from "@/lib/video-composition";
import { TransitionPicker } from "@/components/editor/transition-picker";
import type { MidClipTransition, SceneTransitionType } from "@/lib/video-composition";
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
  const currentTime = useEditorStore((state) => state.videoState.currentTime);
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
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const selectedLayerId = useEditorStore(
    (state) => state.canvas.selectedLayerId,
  );
  const videoFabricCanvas = useEditorStore((state) => state.videoFabricCanvas);
  const setJunctionTransition = useEditorStore(
    (state) => state.setJunctionTransition,
  );
  const addMidClipTransition = useEditorStore(
    (state) => state.addMidClipTransition,
  );
  const updateMidClipTransition = useEditorStore(
    (state) => state.updateMidClipTransition,
  );
  const removeMidClipTransition = useEditorStore(
    (state) => state.removeMidClipTransition,
  );
  const setVideoSceneTransition = useEditorStore(
    (state) => state.setVideoSceneTransition,
  );
  const layers =
    pages.find((page) => page.id === activePageId)?.layers || [];
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const selectedTextObject =
    selectedLayer?.type === "text" && selectedLayer.objectId
      ? (videoFabricCanvas
          ?.getObjects()
          .find((object: any) => object.name === selectedLayer.objectId) as any)
      : null;
  const selectedVideoLayer =
    selectedLayer?.type === "video" ? selectedLayer : undefined;
  const videoComposition = buildVideoComposition(layers);
  const selectedSceneIndex = selectedVideoLayer
    ? videoComposition.scenes.findIndex(
        (scene) => scene.layer.id === selectedVideoLayer.id,
      )
    : -1;
  const nextVideoScene =
    selectedSceneIndex >= 0
      ? videoComposition.scenes[selectedSceneIndex + 1]
      : undefined;
  const isFirstVideoScene = selectedSceneIndex === 0;
  const isLastVideoScene = selectedSceneIndex >= 0 && !nextVideoScene;
  const startTransition =
    selectedVideoLayer?.data?.transitionBefore?.type || "none";
  const startDuration = Number(
    selectedVideoLayer?.data?.transitionBefore?.duration || 0,
  );
  const endTransition =
    selectedVideoLayer?.data?.transitionAfter?.type || "none";
  const endDuration = Number(
    selectedVideoLayer?.data?.transitionAfter?.duration || 0,
  );
  const selectedClipStart = Number(selectedLayer?.startTime || 0);
  const selectedClipDuration = Math.max(
    0.1,
    Number(selectedLayer?.duration || 0.1),
  );
  const selectedClipEnd = selectedClipStart + selectedClipDuration;
  const selectedSourceDuration = Math.max(
    0.1,
    Number(
      selectedLayer?.data?.sourceDuration ||
        (selectedLayer?.type === "video" ? duration : 0) ||
        duration,
    ),
  );
  const selectedMediaStart = Math.max(0, Number(selectedLayer?.mediaStart || 0));
  const selectedMediaEnd = Math.min(
    selectedSourceDuration,
    selectedMediaStart + selectedClipDuration,
  );
  const selectedScene =
    selectedSceneIndex >= 0
      ? videoComposition.scenes[selectedSceneIndex]
      : undefined;
  const maxStartDuration = Math.max(
    0.1,
    (selectedScene?.duration || selectedClipDuration) / 2,
  );
  const maxEndDuration = nextVideoScene
    ? Math.max(
        0.1,
        Math.min(
          (selectedScene?.duration || selectedClipDuration) / 2,
          nextVideoScene.duration / 2,
        ),
      )
    : maxStartDuration;
  const playheadInSelectedClip = Boolean(
    selectedScene &&
      currentTime >= selectedScene.timelineStart &&
      currentTime < selectedScene.timelineEnd,
  );
  const playheadClipOffset = selectedScene
    ? Math.max(0, currentTime - selectedScene.timelineStart)
    : 0;
  const midClipTransitions: MidClipTransition[] = selectedVideoLayer
    ? getMidClipTransitions(selectedVideoLayer)
    : [];
  const maxMidDuration = Math.max(
    0.1,
    (selectedScene?.duration || selectedClipDuration) / 2,
  );
  const hasTimelineLayer =
    Boolean(selectedLayer) &&
    selectedLayer?.startTime !== undefined &&
    selectedLayer?.duration !== undefined;

  const setStartType = (type: SceneTransitionType) => {
    if (!selectedVideoLayer) return;
    setVideoSceneTransition(selectedVideoLayer.id, "before", {
      type,
      duration: type === "none" ? 0 : startDuration > 0 ? startDuration : 0.5,
    });
  };

  const setStartDuration = (duration: number) => {
    if (!selectedVideoLayer) return;
    const type = (selectedVideoLayer.data?.transitionBefore?.type ||
      "dissolve") as SceneTransitionType;
    if (type === "none") return;
    setVideoSceneTransition(selectedVideoLayer.id, "before", {
      type,
      duration: Math.max(0.1, duration),
    });
  };

  const setJunctionType = (type: SceneTransitionType) => {
    if (!selectedVideoLayer || !nextVideoScene) return;
    setJunctionTransition(selectedVideoLayer.id, {
      type,
      duration: type === "none" ? 0 : endDuration > 0 ? endDuration : 0.5,
    });
  };

  const setJunctionDuration = (duration: number) => {
    if (!selectedVideoLayer || !nextVideoScene) return;
    const type = (selectedVideoLayer.data?.transitionAfter?.type ||
      "dissolve") as SceneTransitionType;
    if (type === "none") return;
    setJunctionTransition(selectedVideoLayer.id, {
      type,
      duration: Math.max(0.1, duration),
    });
  };

  const setEndType = (type: SceneTransitionType) => {
    if (!selectedVideoLayer || !isLastVideoScene) return;
    setJunctionTransition(selectedVideoLayer.id, {
      type,
      duration: type === "none" ? 0 : endDuration > 0 ? endDuration : 0.5,
    });
  };

  const setEndDuration = (duration: number) => {
    if (!selectedVideoLayer || !isLastVideoScene) return;
    const type = (selectedVideoLayer.data?.transitionAfter?.type ||
      "dissolve") as SceneTransitionType;
    if (type === "none") return;
    setJunctionTransition(selectedVideoLayer.id, {
      type,
      duration: Math.max(0.1, duration),
    });
  };

  const addTransitionAtPlayhead = (type: SceneTransitionType) => {
    if (!selectedVideoLayer || !selectedScene || type === "none") return;
    addMidClipTransition(selectedVideoLayer.id, {
      offset: playheadClipOffset,
      duration: 0.5,
      type,
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
      effectStartTime: 0,
      effectEndTime: 0,
    });
  };

  return (
    <div className="flex flex-col gap-8 bg-black text-white">
      <CanvasProperties />

      {selectedLayer?.type === "text" && selectedTextObject && (
        <section className="space-y-4 px-4">
          <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Text Layer
          </h3>
          <TextProperties selectedObject={selectedTextObject} />
        </section>
      )}

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
          Clip Transitions
        </h3>
        {!selectedVideoLayer ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-[#18181b]/30 px-4 py-6 text-center text-[10px] leading-relaxed text-white/40">
            Select a video clip, or click a transition block on the timeline.
          </p>
        ) : (
          <div className="space-y-4">
            {playheadInSelectedClip && (
              <div className="space-y-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-[10px] font-bold text-white/70">
                  At playhead{" "}
                  <span className="font-mono text-violet-300">
                    {formatTime(playheadClipOffset)}
                  </span>{" "}
                  in{" "}
                  <span className="text-violet-300">
                    {selectedVideoLayer.name}
                  </span>
                </p>
                <TransitionPicker
                  value="none"
                  onChange={addTransitionAtPlayhead}
                />
                <p className="text-[9px] leading-relaxed text-white/35">
                  Pick a transition to place it at the current playhead. Drag
                  the block on the Transitions row to move or resize it.
                </p>
              </div>
            )}

            {midClipTransitions.length > 0 && (
              <div className="space-y-3">
                {midClipTransitions.map((midTransition) => (
                  <div
                    key={midTransition.id}
                    className="space-y-4 rounded-xl border border-white/5 bg-[#18181b]/50 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-white/70">
                        At{" "}
                        <span className="font-mono text-violet-300">
                          {formatTime(midTransition.offset)}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          removeMidClipTransition(
                            selectedVideoLayer.id,
                            midTransition.id,
                          )
                        }
                        className="text-white/30 hover:text-red-400"
                        aria-label="Remove transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <TransitionPicker
                      value={midTransition.type}
                      onChange={(type) =>
                        updateMidClipTransition(
                          selectedVideoLayer.id,
                          midTransition.id,
                          { type },
                        )
                      }
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/50">
                        <span>Start</span>
                        <span className="font-mono text-violet-300">
                          {formatTime(midTransition.offset)}
                        </span>
                      </div>
                      <Slider
                        value={[midTransition.offset]}
                        min={0}
                        max={Math.max(
                          0,
                          selectedClipDuration - midTransition.duration,
                        )}
                        step={0.1}
                        onValueChange={(value) =>
                          updateMidClipTransition(
                            selectedVideoLayer.id,
                            midTransition.id,
                            { offset: value[0] },
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/50">
                        <span>Duration</span>
                        <span className="font-mono text-violet-300">
                          {midTransition.duration.toFixed(1)}s
                        </span>
                      </div>
                      <Slider
                        value={[midTransition.duration]}
                        min={0.1}
                        max={maxMidDuration}
                        step={0.1}
                        onValueChange={(value) =>
                          updateMidClipTransition(
                            selectedVideoLayer.id,
                            midTransition.id,
                            { duration: value[0] },
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
              <p className="text-[10px] font-bold text-white/70">
                Start of{" "}
                <span className="text-violet-300">
                  {selectedVideoLayer.name}
                </span>
                {!isFirstVideoScene && (
                  <span className="ml-1 font-normal text-white/35">
                    (also set on previous clip&apos;s end transition)
                  </span>
                )}
              </p>
              <TransitionPicker
                value={(startTransition as SceneTransitionType) || "none"}
                onChange={setStartType}
              />
              {startTransition !== "none" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/50">
                    <span>Duration</span>
                    <span className="font-mono text-violet-300">
                      {startDuration.toFixed(1)}s
                    </span>
                  </div>
                  <Slider
                    value={[startDuration]}
                    min={0.1}
                    max={maxStartDuration}
                    step={0.1}
                    onValueChange={(value) => setStartDuration(value[0])}
                  />
                </div>
              )}
            </div>

            {nextVideoScene ? (
              <div className="space-y-4 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
                <p className="text-[10px] font-bold text-white/70">
                  End of{" "}
                  <span className="text-violet-300">
                    {selectedVideoLayer.name}
                  </span>{" "}
                  →{" "}
                  <span className="text-violet-300">
                    {nextVideoScene.layer.name}
                  </span>
                </p>
                <TransitionPicker
                  value={(endTransition as SceneTransitionType) || "none"}
                  onChange={setJunctionType}
                />
                {endTransition !== "none" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/50">
                      <span>Duration</span>
                      <span className="font-mono text-violet-300">
                        {endDuration.toFixed(1)}s
                      </span>
                    </div>
                    <Slider
                      value={[endDuration]}
                      min={0.1}
                      max={maxEndDuration}
                      step={0.1}
                      onValueChange={(value) => setJunctionDuration(value[0])}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
                <p className="text-[10px] font-bold text-white/70">
                  End of{" "}
                  <span className="text-violet-300">
                    {selectedVideoLayer.name}
                  </span>
                </p>
                <TransitionPicker
                  value={(endTransition as SceneTransitionType) || "none"}
                  onChange={setEndType}
                />
                {endTransition !== "none" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-white/50">
                      <span>Duration</span>
                      <span className="font-mono text-violet-300">
                        {endDuration.toFixed(1)}s
                      </span>
                    </div>
                    <Slider
                      value={[endDuration]}
                      min={0.1}
                      max={maxEndDuration}
                      step={0.1}
                      onValueChange={(value) => setEndDuration(value[0])}
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-[9px] leading-relaxed text-white/35">
              Hover a preview to see how each transition looks, then click to
              apply. Use the playhead section for any point in the clip; start
              and end transitions still work at clip boundaries.
            </p>
          </div>
        )}
      </section>

      {hasTimelineLayer && selectedLayer && (
        <section className="space-y-4 px-4">
          <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            Clip Trim — {selectedLayer.name}
          </h3>
          <div className="space-y-6 rounded-xl border border-white/5 bg-[#18181b]/50 p-4">
            <TrimSlider
              label="Timeline Start"
              value={selectedClipStart}
              displayValue={formatTime(selectedClipStart)}
              max={Math.max(0.1, selectedClipEnd - 0.1)}
              onChange={(startTime) => {
                updateLayer(selectedLayer.id, {
                  startTime,
                  duration: Math.max(0.1, selectedClipEnd - startTime),
                });
              }}
            />
            <TrimSlider
              label="Timeline End"
              value={selectedClipEnd}
              displayValue={formatTime(selectedClipEnd)}
              min={selectedClipStart + 0.1}
              max={Math.max(selectedClipStart + 0.1, duration)}
              tone="text-red-400"
              onChange={(endTime) => {
                updateLayer(selectedLayer.id, {
                  duration: Math.max(0.1, endTime - selectedClipStart),
                });
              }}
            />
            {(selectedLayer.type === "video" ||
              selectedLayer.type === "audio") && (
              <>
                <TrimSlider
                  label="Source In"
                  value={selectedMediaStart}
                  displayValue={formatTime(selectedMediaStart)}
                  max={Math.max(0, selectedMediaEnd - 0.1)}
                  onChange={(mediaStart) => {
                    const shift = mediaStart - selectedMediaStart;
                    updateLayer(selectedLayer.id, {
                      mediaStart: Math.max(0, mediaStart),
                      startTime: selectedClipStart + shift,
                      duration: Math.max(
                        0.1,
                        selectedClipDuration - shift,
                      ),
                    });
                  }}
                />
                <TrimSlider
                  label="Source Out"
                  value={selectedMediaEnd}
                  displayValue={formatTime(selectedMediaEnd)}
                  min={selectedMediaStart + 0.1}
                  max={selectedSourceDuration}
                  tone="text-emerald-400"
                  onChange={(mediaEnd) => {
                    updateLayer(selectedLayer.id, {
                      duration: Math.max(0.1, mediaEnd - selectedMediaStart),
                    });
                  }}
                />
              </>
            )}
            <p className="text-[9px] leading-relaxed text-white/35">
              Drag the white handles on the timeline clip, or use these sliders
              to trim this layer.
            </p>
          </div>
        </section>
      )}

      <section className="space-y-4 px-4">
        <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Export Range
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
