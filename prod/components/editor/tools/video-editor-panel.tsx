'use client'

import { useState } from 'react'
import { VideoPlayer } from './video-player'
import { VideoOverlays } from './video-overlays'
import { VideoEditor as VideoEditorLib, type VideoSettings } from '@/lib/video-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface VideoEditorPanelProps {
  videoUrl: string
}

export function VideoEditorPanel({ videoUrl }: VideoEditorPanelProps) {
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    url: videoUrl,
    width: 1920,
    height: 1080,
    duration: 0,
    speed: 1,
    muted: false,
    overlays: [],
  })

  return (
    <div className="space-y-4">
      <Tabs defaultValue="playback" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="playback">Playback</TabsTrigger>
          <TabsTrigger value="overlays">Overlays</TabsTrigger>
        </TabsList>

        <TabsContent value="playback">
          <VideoPlayer videoUrl={videoUrl} />
        </TabsContent>

        <TabsContent value="overlays">
          <VideoOverlays
            videoSettings={videoSettings}
            onUpdateSettings={setVideoSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
