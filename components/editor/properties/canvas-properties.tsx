import { useEditorStore } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function CanvasProperties() {
  const {
    canvas: { width, height },
    setCanvas,
  } = useEditorStore();

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setCanvas({ width: val });
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setCanvas({ height: val });
    }
  };

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
              <Input
                type="number"
                value={width}
                onChange={handleWidthChange}
                className="bg-white/5 border-white/10 text-white h-8 text-xs focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Height</Label>
              <Input
                type="number"
                value={height}
                onChange={handleHeightChange}
                className="bg-white/5 border-white/10 text-white h-8 text-xs focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
