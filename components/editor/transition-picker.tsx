"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  SCENE_TRANSITION_DESCRIPTIONS,
  SCENE_TRANSITION_OPTIONS,
  type SceneTransitionType,
} from "@/lib/video-transitions";

function TransitionPreview({
  type,
  playing,
}: {
  type: SceneTransitionType;
  playing: boolean;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!playing || type === "none") {
      setProgress(type === "none" ? 0 : 1);
      return;
    }

    let frame = 0;
    const timer = window.setInterval(() => {
      frame = (frame + 1) % 60;
      setProgress(frame / 60);
    }, 50);

    return () => window.clearInterval(timer);
  }, [playing, type]);

  const outgoingStyle: CSSProperties = { opacity: 1 };
  const incomingStyle: CSSProperties = { opacity: 0 };

  const p = progress;

  switch (type) {
    case "fade":
    case "dissolve":
      outgoingStyle.opacity = 1 - p;
      incomingStyle.opacity = p;
      break;
    case "slide-left":
      outgoingStyle.transform = `translateX(${-p * 100}%)`;
      incomingStyle.transform = `translateX(${(1 - p) * 100}%)`;
      incomingStyle.opacity = 1;
      break;
    case "slide-right":
      outgoingStyle.transform = `translateX(${p * 100}%)`;
      incomingStyle.transform = `translateX(${-(1 - p) * 100}%)`;
      incomingStyle.opacity = 1;
      break;
    case "slide-up":
      outgoingStyle.transform = `translateY(${-p * 100}%)`;
      incomingStyle.transform = `translateY(${(1 - p) * 100}%)`;
      incomingStyle.opacity = 1;
      break;
    case "slide-down":
      outgoingStyle.transform = `translateY(${p * 100}%)`;
      incomingStyle.transform = `translateY(${-(1 - p) * 100}%)`;
      incomingStyle.opacity = 1;
      break;
    case "zoom-in":
      outgoingStyle.opacity = 1 - p * 0.6;
      incomingStyle.transform = `scale(${0.7 + p * 0.3})`;
      incomingStyle.opacity = p;
      break;
    case "zoom-out":
      outgoingStyle.transform = `scale(${1 - p * 0.25})`;
      outgoingStyle.opacity = 1 - p;
      incomingStyle.opacity = p;
      break;
    case "wipe-left":
      incomingStyle.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
      incomingStyle.opacity = 1;
      break;
    default:
      outgoingStyle.opacity = 1;
      incomingStyle.opacity = 0;
  }

  return (
    <div className="relative h-14 w-full overflow-hidden rounded-lg border border-white/10 bg-black">
      <div
        className="absolute inset-0 bg-gradient-to-br from-zinc-600 to-zinc-800"
        style={outgoingStyle}
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-violet-500 to-blue-600"
        style={incomingStyle}
      />
      {type === "none" && (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-widest text-white/40">
          Cut
        </div>
      )}
    </div>
  );
}

export function TransitionPicker({
  value,
  onChange,
  className,
}: {
  value: SceneTransitionType;
  onChange: (type: SceneTransitionType) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<SceneTransitionType | null>(null);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-2">
        {SCENE_TRANSITION_OPTIONS.map((option) => {
          const selected = value === option.value;
          const previewing = hovered === option.value || selected;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              onMouseEnter={() => setHovered(option.value)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "rounded-xl border p-2 text-left transition-all",
                selected
                  ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400/40"
                  : "border-white/10 bg-[#111] hover:border-white/20 hover:bg-white/5",
              )}
            >
              <TransitionPreview type={option.value} playing={previewing} />
              <p className="mt-2 text-[10px] font-bold text-white/90">
                {option.label}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-white/45">
        {SCENE_TRANSITION_DESCRIPTIONS[hovered || value]}
      </p>
    </div>
  );
}
