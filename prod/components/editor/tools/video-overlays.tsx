'use client'

import { useState } from 'react'
import { VideoEditor, type VideoOverlay, type VideoSettings } from '@/lib/video-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Plus, Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VideoOverlaysProps {
  videoSettings: VideoSettings
  onUpdateSettings: (settings: VideoSettings) => void
}

export function VideoOverlays({ videoSettings, onUpdateSettings }: VideoOverlaysProps) {
  const [newOverlayType, setNewOverlayType] = useState<'text' | 'image' | 'sticker'>('text')
  const [overlayContent, setOverlayContent] = useState('Add text')

  const handleAddOverlay = () => {
    const newSettings = { ...videoSettings }
    VideoEditor.addTextOverlay(newSettings, {
      type: newOverlayType,
      content: overlayContent,
      x: 50,
      y: 50,
      width: 300,
      height: 100,
      opacity: 1,
      startTime: 0,
      endTime: videoSettings.duration,
      color: '#ffffff',
      fontSize: 20,
    })
    onUpdateSettings(newSettings)
  }

  const handleRemoveOverlay = (overlayId: string) => {
    const newSettings = { ...videoSettings }
    VideoEditor.removeOverlay(newSettings, overlayId)
    onUpdateSettings(newSettings)
  }

  const handleUpdateOverlay = (overlayId: string, updates: Partial<VideoOverlay>) => {
    const newSettings = { ...videoSettings }
    VideoEditor.updateOverlay(newSettings, overlayId, updates)
    onUpdateSettings(newSettings)
  }

  return (
    <div className="space-y-4">
      {/* Add New Overlay */}
      <div className="border-b pb-4 space-y-3">
        <h4 className="font-semibold text-sm">Add Overlay</h4>

        <div>
          <Label className="text-sm font-medium mb-2 block">Type</Label>
          <Select value={newOverlayType} onValueChange={(val: any) => setNewOverlayType(val)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="sticker">Sticker</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="overlayContent" className="text-sm font-medium mb-2 block">
            Content
          </Label>
          <Input
            id="overlayContent"
            placeholder={newOverlayType === 'text' ? 'Enter text' : 'Enter URL'}
            value={overlayContent}
            onChange={(e) => setOverlayContent(e.target.value)}
          />
        </div>

        <Button onClick={handleAddOverlay} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Overlay
        </Button>
      </div>

      {/* Existing Overlays */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Overlays ({videoSettings.overlays.length})</h4>

        {videoSettings.overlays.length === 0 ? (
          <p className="text-sm text-gray-500">No overlays yet</p>
        ) : (
          <div className="space-y-3">
            {videoSettings.overlays.map((overlay) => (
              <div key={overlay.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{overlay.type.toUpperCase()}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOverlay(overlay.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>

                <div className="text-xs text-gray-600 truncate">{overlay.content}</div>

                {/* Position */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs mb-1 block">X: {overlay.x}</Label>
                    <Slider
                      value={[overlay.x]}
                      onValueChange={(val) =>
                        handleUpdateOverlay(overlay.id, { x: val[0] })
                      }
                      min={0}
                      max={videoSettings.width}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Y: {overlay.y}</Label>
                    <Slider
                      value={[overlay.y]}
                      onValueChange={(val) =>
                        handleUpdateOverlay(overlay.id, { y: val[0] })
                      }
                      min={0}
                      max={videoSettings.height}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <Label className="text-xs mb-1 block">Opacity: {Math.round(overlay.opacity * 100)}%</Label>
                  <Slider
                    value={[overlay.opacity]}
                    onValueChange={(val) =>
                      handleUpdateOverlay(overlay.id, { opacity: val[0] })
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs mb-1 block">Start: {overlay.startTime.toFixed(1)}s</Label>
                    <Slider
                      value={[overlay.startTime]}
                      onValueChange={(val) =>
                        handleUpdateOverlay(overlay.id, { startTime: val[0] })
                      }
                      min={0}
                      max={videoSettings.duration}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">End: {overlay.endTime.toFixed(1)}s</Label>
                    <Slider
                      value={[overlay.endTime]}
                      onValueChange={(val) =>
                        handleUpdateOverlay(overlay.id, { endTime: val[0] })
                      }
                      min={0}
                      max={videoSettings.duration}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
