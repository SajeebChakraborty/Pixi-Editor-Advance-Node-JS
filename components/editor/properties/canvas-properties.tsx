import { useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function CanvasProperties() {
  const {
    canvas: { width, height },
    setCanvas,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Dimensions */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          Canvas Size
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Width</Label>
              <DraftNumberInput
                value={width}
                onCommit={(value) => setCanvas({ width: value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Height</Label>
              <DraftNumberInput
                value={height}
                onCommit={(value) => setCanvas({ height: value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftNumberInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value || 0)));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
    }
  }, [isFocused, value]);

  const commitDraft = () => {
    const trimmed = draft.trim();
    const next = Number(trimmed);

    if (trimmed === "" || !Number.isFinite(next) || next <= 0) {
      setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
      return;
    }

    onCommit(Math.round(next));
  };

  return (
    <Input
      type="number"
      value={draft}
      onFocus={() => setIsFocused(true)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        commitDraft();
        setIsFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(String(Math.round(Number.isFinite(value) ? value : 0)));
          event.currentTarget.blur();
        }
      }}
      className="bg-white/5 border-white/10 text-white h-8 text-xs focus-visible:ring-indigo-500"
    />
  );
}
