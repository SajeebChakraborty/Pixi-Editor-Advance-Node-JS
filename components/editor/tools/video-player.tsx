'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import {
  resolveVideoPlaybackUrl,
  videoNeedsCrossOrigin,
} from '@/lib/video-playback-url'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'
import { VideoEditor } from '@/lib/video-editor'

interface VideoPlayerProps {
  videoUrl: string
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const resolvedSrc = useMemo(
    () => resolveVideoPlaybackUrl(videoUrl),
    [videoUrl],
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !resolvedSrc) return

    if (videoNeedsCrossOrigin(resolvedSrc)) {
      video.crossOrigin = 'anonymous'
    } else {
      video.removeAttribute('crossorigin')
    }
    video.preload = 'auto'
    video.playsInline = true
    video.src = resolvedSrc
    video.load()

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setEndTime(video.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [resolvedSrc])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }

  const handleMute = () => {
    setIsMuted(!isMuted)
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          startTime,
          endTime,
          speed: playbackSpeed,
          width: 1920,
          height: 1080,
          format: 'mp4',
        }),
      })

      const data = await response.json()
      console.log('[v0] Export response:', data)
      alert('Video export started! (Check console for progress)')
    } catch (error) {
      console.error('[v0] Export failed:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Video Container */}
      <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full" playsInline />
      </div>

      {/* Playback Controls */}
      <div className="space-y-2">
        {/* Timeline */}
        <div>
          <Slider
            value={[currentTime]}
            onValueChange={(val) => handleSeek(val[0])}
            min={0}
            max={duration}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{VideoEditor.formatTime(currentTime)}</span>
            <span>{VideoEditor.formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={togglePlay}>
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleMute}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>

          <Slider
            value={[volume]}
            onValueChange={(val) => handleVolumeChange(val[0])}
            min={0}
            max={1}
            step={0.1}
            className="w-24"
          />

          <Select value={String(playbackSpeed)} onValueChange={(val) => handleSpeedChange(parseFloat(val))}>
            <SelectTrigger className="w-20 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Trim Controls */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-semibold text-sm">Trim Video</h4>

        <div>
          <Label className="text-sm font-medium mb-2 block">
            Start Time: {VideoEditor.formatTime(startTime)}
          </Label>
          <Slider
            value={[startTime]}
            onValueChange={(val) => setStartTime(Math.min(val[0], endTime))}
            min={0}
            max={duration}
            step={0.1}
            className="w-full"
          />
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">
            End Time: {VideoEditor.formatTime(endTime)}
          </Label>
          <Slider
            value={[endTime]}
            onValueChange={(val) => setEndTime(Math.max(val[0], startTime))}
            min={0}
            max={duration}
            step={0.1}
            className="w-full"
          />
        </div>

        <Button onClick={handleExport} className="w-full" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export Video
        </Button>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>• Adjust trim times using the sliders</p>
        <p>• Change playback speed before export</p>
        <p>• FFmpeg will render your video server-side</p>
      </div>
    </div>
  )
}
