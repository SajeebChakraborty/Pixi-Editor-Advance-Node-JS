"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Image as ImageIcon, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();

  const handleStart = () => {
    setIsAnimating(true);

    // Simulate processing
    setTimeout(() => {
      router.push(`/editor`);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-hidden relative selection:bg-violet-500/30">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="relative container mx-auto px-4 h-screen flex flex-col items-center justify-center z-10">
        {/* Hero Badge */}
        <div className="mb-8 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">
            Next Gen AI Editor
          </span>
        </div>

        {/* Hero Text */}
        <div className="text-center max-w-4xl space-y-6 mb-12">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Create{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-white">
              Magic
            </span>{" "}
            with <br />
            Every Pixel.
          </h1>
          <p className="text-lg text-white/40 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            The all-in-one creative suite for modern creators. Edit photos and
            videos seamlessly in your browser with professional-grade tools.
          </p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-xl relative group animate-in fade-in zoom-in-95 duration-700 delay-300">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity duration-500" />
          <div className="relative bg-[#18181b] border border-white/10 rounded-2xl p-2 flex items-center justify-center shadow-2xl">
            <Button
              size="lg"
              onClick={handleStart}
              className="w-full h-14 px-8 rounded-xl bg-white text-black hover:bg-white/90 font-bold transition-all hover:scale-[1.02] text-lg"
            >
              {isAnimating ? (
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Start Editing <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Features / Quick Links — matches app/editor/page.tsx (?type=image | ?type=video) */}
        <div className="grid grid-cols-2 gap-4 mt-16 w-full max-w-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
          <Link
            href="/editor?type=image"
            className="block p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
          >
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center mb-3">
              <ImageIcon className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-bold text-white">Photo Editor</h3>
            <p className="text-xs text-white/40 mt-1">
              Advanced filters, cropping, and AI enhancements.
            </p>
          </Link>
          <Link
            href="/editor?type=video"
            className="block p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/60"
          >
            <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center mb-3">
              <Video className="w-5 h-5 text-fuchsia-400" />
            </div>
            <h3 className="font-bold text-white">Video Editor</h3>
            <p className="text-xs text-white/40 mt-1">
              Multi-track timeline, trimming, and effects.
            </p>
          </Link>
        </div>

        <p className="mt-16 text-xs text-white/20 font-mono">
          POWERED BY PIXIGEN ENGINE V2.0
        </p>
      </div>
    </div>
  );
}
