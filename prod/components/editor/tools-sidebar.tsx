"use client";

import { ImageTool } from "./tools/image-tool";
import { TextTool } from "./tools/text-tool";
import { ShapesTool } from "./tools/shapes-tool";
import { AssetTool } from "./tools/asset-tool";
import { TemplateTool } from "./tools/template-tool";
import { VideoTool } from "./tools/video-tool";
import { AudioTool } from "./tools/audio-tool";

import { ElementsTool } from "./tools/elements-tool";

interface ToolsSidebarProps {
  activeTab: string;
}

export function ToolsSidebar({ activeTab }: ToolsSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-[#161616] text-white dark">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === "templates" && <TemplateTool />}
        {activeTab === "photos" && <ImageTool />}
        {activeTab === "elements" && <ElementsTool />}
        {activeTab === "upload" && <AssetTool />}
        {activeTab === "objects" && <ShapesTool />}
        {activeTab === "text" && <TextTool />}
        {activeTab === "video" && <VideoTool />}
        {activeTab === "audio" && <AudioTool />}
      </div>
    </div>
  );
}
