import { create } from 'zustand'
import type { Canvas } from 'fabric'

// Canvas presets
export const CANVAS_PRESETS = {
  square: { width: 1080, height: 1080, name: 'Square (1080x1080)' },
  landscape: { width: 1920, height: 1080, name: 'Landscape (1920x1080)' },
}

export type CanvasPreset = keyof typeof CANVAS_PRESETS

// Types
export interface Layer {
  id: string
  type: 'image' | 'text' | 'video' | 'sticker' | 'shape' | 'audio'
  name: string
  locked: boolean
  visible: boolean
  objectId?: string // Reference to fabric object
  data?: any // Additional data (URL, content, etc.)
  startTime?: number // Start time in seconds
  duration?: number // Duration in seconds
  mediaStart?: number // Start time within the source media (for trimmed/split clips)
  track?: number // Track number in the timeline
}

export interface EditorPage {
  id: string
  name: string
  width: number
  height: number
  layers: Layer[]
}

export interface CanvasState {
  name: string
  width: number
  height: number
  preset: CanvasPreset
  zoom: number
  pages: EditorPage[]
  activePageId: string
  selectedLayerId: string | null
  fabricCanvas: Canvas | null
  history: string[] // JSON snapshots for undo/redo
  historyIndex: number
}

type CanvasHistorySnapshot = {
  fabric: any
  pages: EditorPage[]
  activePageId: string
  selectedLayerId: string | null
  width: number
  height: number
}

export interface Asset {
  id: string
  url: string
  name: string
  type: 'image' | 'video' | 'audio'
  timestamp: number
}

export interface VideoState {
  videoUrl: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  isMuted: boolean
  volume: number
  playbackRate: number
  startTime: number
  endTime: number
}

export type EditorTool = 'select' | 'hand' | 'text' | 'circle' | 'square' | 'star' | 'pen' | 'arrow'
export interface PenSettings {
  color: string
  width: number
  mode: 'brush' | 'eraser'
}

export interface EditorState {
  // Canvas state
  canvas: CanvasState
  setCanvas: (canvas: Partial<Omit<CanvasState, 'pages'>>) => void
  setCanvasPreset: (preset: CanvasPreset) => void
  setZoom: (zoom: number) => void
  setFabricCanvas: (fabricCanvas: Canvas | null) => void

  // Tool state
  activeCanvasTool: EditorTool
  setActiveCanvasTool: (tool: EditorTool) => void
  penSettings: PenSettings
  setPenSettings: (settings: Partial<PenSettings>) => void

  // Page management
  addPage: () => void
  deletePage: (id: string) => void
  setActivePage: (id: string) => void
  duplicatePage: (id: string) => void
  reorderPage: (id: string, direction: 'up' | 'down') => void
  renamePage: (pageId: string, name: string) => void
  renameProject: (name: string) => void

  // Layer management
  addLayer: (layer: Omit<Layer, 'id'>) => void
  deleteLayer: (layerId: string) => void
  updateLayer: (layerId: string, updates: Partial<Layer>) => void
  updateLayerData: (layerId: string, data: Record<string, any>) => void
  selectLayer: (layerId: string | null) => void
  duplicateLayer: (layerId: string) => void
  reorderLayer: (layerId: string, direction: 'up' | 'down') => void
  moveLayer: (draggedId: string, targetId: string, position: 'above' | 'below') => void
  renameLayer: (layerId: string, newName: string) => void
  splitLayer: (layerId: string, time: number) => void
  getLayers: () => Layer[]
  getSelectedLayer: () => Layer | undefined

  // History/Undo-Redo
  saveToHistory: (snapshot: string) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Reset
  resetCanvas: () => void
  clearAllLayers: () => void

  // Video Editor State
  videoEditorOpen: boolean
  videoState: VideoState
  setVideoEditorOpen: (open: boolean) => void
  setVideoState: (state: Partial<VideoState>) => void
  recalculateTotalDuration: () => void

  // Assets tracking
  recentAssets: Asset[]
  addRecentAsset: (asset: Omit<Asset, 'id' | 'timestamp'>) => void
  removeRecentAsset: (url: string) => void
}

const firstPageId = `page-${Date.now()}`

const clampLayerToVideoBounds = (
  layer: Omit<Layer, "id"> | Layer,
  maxVideoEnd: number
) => {
  if (layer.type === "video" || maxVideoEnd <= 0) return layer

  const start = Math.max(0, Number(layer.startTime ?? 0))
  const requestedDuration = Math.max(0.1, Number(layer.duration ?? 10))
  const safeStart = Math.min(start, Math.max(0, maxVideoEnd - 0.1))
  const maxDurationFromStart = Math.max(0.1, maxVideoEnd - safeStart)
  const safeDuration = Math.min(requestedDuration, maxDurationFromStart)

  return {
    ...layer,
    startTime: safeStart,
    duration: safeDuration,
  }
}

const valuesEqual = (left: unknown, right: unknown) => {
  if (Object.is(left, right)) return true
  return typeof left === "number" && typeof right === "number"
    ? Math.abs(left - right) < 0.0001
    : false
}

const clonePages = (pages: EditorPage[]) =>
  pages.map((page) => ({
    ...page,
    layers: page.layers.map((layer) => ({
      ...layer,
      data:
        layer.data && typeof layer.data === "object"
          ? { ...layer.data }
          : layer.data,
    })),
  }))

const getFabricObjectNames = (fabricSnapshot: any) =>
  new Set(
    ((fabricSnapshot?.objects || []) as any[])
      .map((object) => object?.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0)
  )

const isLayerManagedObjectName = (name: string) =>
  /^(img|vid|text|emoji|circle|square|star|heart|triangle|line|arrow|bolt)_/.test(name)

const shouldSkipLayerIntermediateHistory = (
  fabricSnapshot: any,
  layers: Layer[]
) => {
  const objectNames = getFabricObjectNames(fabricSnapshot)
  const layerObjectIds = new Set(
    layers
      .map((layer) => layer.objectId)
      .filter((objectId): objectId is string => Boolean(objectId))
  )

  for (const objectName of objectNames) {
    if (isLayerManagedObjectName(objectName) && !layerObjectIds.has(objectName)) {
      return true
    }
  }

  for (const objectId of layerObjectIds) {
    if (isLayerManagedObjectName(objectId) && !objectNames.has(objectId)) {
      return true
    }
  }

  return false
}

const parseHistorySnapshot = (snapshot: string): CanvasHistorySnapshot | null => {
  try {
    const parsed = JSON.parse(snapshot)
    if (parsed?.fabric && Array.isArray(parsed?.pages)) {
      return parsed as CanvasHistorySnapshot
    }

    return {
      fabric: parsed,
      pages: [],
      activePageId: "",
      selectedLayerId: null,
      width: 0,
      height: 0,
    }
  } catch {
    return null
  }
}

const disposeVideoObjects = (fabricCanvas: Canvas) => {
  fabricCanvas.getObjects().forEach((object: any) => {
    object?._disposeVideo?.()
    object?._cleanupVideoOverlay?.()
  })
}

// Initial canvas state
const initialCanvasState: CanvasState = {
  name: 'Our Masterpiece',
  width: 1280,
  height: 720,
  preset: 'landscape',
  zoom: 1,
  pages: [{ id: firstPageId, name: 'Page 1', width: 1280, height: 720, layers: [] }],
  activePageId: firstPageId,
  selectedLayerId: null,
  fabricCanvas: null,
  history: [],
  historyIndex: -1,
}

const initialVideoState: VideoState = {
  videoUrl: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isMuted: false,
  volume: 1,
  playbackRate: 1,
  startTime: 0,
  endTime: 0,
}

export const useEditorStore = create<EditorState>((set, get) => ({
  canvas: initialCanvasState,

  setCanvas: (updates) =>
    set((state) => {
      const nextCanvas = { ...state.canvas, ...updates }
      const hasDimensionUpdate =
        typeof updates.width === 'number' || typeof updates.height === 'number'

      if (!hasDimensionUpdate) {
        return { canvas: nextCanvas }
      }

      const newPages = state.canvas.pages.map((page) =>
        page.id === state.canvas.activePageId
          ? {
              ...page,
              width: updates.width ?? page.width,
              height: updates.height ?? page.height,
            }
          : page
      )

      return {
        canvas: {
          ...nextCanvas,
          pages: newPages,
        },
      }
    }),

  renameProject: (name) =>
    set((state) => ({
      canvas: { ...state.canvas, name },
    })),

  setCanvasPreset: (preset) => {
    const presetData = CANVAS_PRESETS[preset]
    set((state) => ({
      canvas: {
        ...state.canvas,
        preset,
        width: presetData.width,
        height: presetData.height,
      },
    }))
  },

  setZoom: (zoom) =>
    set((state) => ({
      canvas: { ...state.canvas, zoom: Math.min(5, Math.max(0.1, zoom)) },
    })),

  setFabricCanvas: (fabricCanvas) =>
    set((state) => ({
      canvas: { ...state.canvas, fabricCanvas },
    })),

  activeCanvasTool: 'select',
  setActiveCanvasTool: (tool) => set({ activeCanvasTool: tool }),
  penSettings: {
    color: '#8b5cf6',
    width: 3,
    mode: 'brush',
  },
  setPenSettings: (settings) =>
    set((state) => ({
      penSettings: {
        ...state.penSettings,
        ...settings,
        width: Math.max(1, Math.min(80, Math.round(settings.width ?? state.penSettings.width))),
      },
    })),

  // Page management
  addPage: () => {
    const newPageId = `page-${Date.now()}`
    set((state) => {
      const newPages = [
        ...state.canvas.pages,
        {
          id: newPageId,
          name: `Page ${state.canvas.pages.length + 1}`,
          width: state.canvas.width,
          height: state.canvas.height,
          layers: [],
        },
      ]
      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          activePageId: newPageId,
          selectedLayerId: null,
        },
      }
    })
  },

  deletePage: (id) => {
    set((state) => {
      if (state.canvas.pages.length <= 1) return state
      const newPages = state.canvas.pages.filter((p) => p.id !== id)
      const newActiveId =
        state.canvas.activePageId === id ? newPages[0].id : state.canvas.activePageId
      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          activePageId: newActiveId,
          selectedLayerId: null,
        },
      }
    })
  },

  setActivePage: (id) => {
    set((state) => {
      const targetPage = state.canvas.pages.find((page) => page.id === id)
      if (!targetPage) return state

      return {
        canvas: {
          ...state.canvas,
          activePageId: id,
          selectedLayerId: null,
          width: targetPage.width,
          height: targetPage.height,
        },
      }
    })
  },

  duplicatePage: (id) => {
    set((state) => {
      const pageToDuplicate = state.canvas.pages.find((p) => p.id === id)
      if (!pageToDuplicate) return state
      const newPageId = `page-${Date.now()}`
      const newPages = [...state.canvas.pages]
      const index = newPages.findIndex((p) => p.id === id)
      newPages.splice(index + 1, 0, {
        ...pageToDuplicate,
        id: newPageId,
        name: `${pageToDuplicate.name} copy`,
        layers: pageToDuplicate.layers.map((l) => ({ ...l, id: `layer-${Date.now()}-${Math.random()}` })),
      })
      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          activePageId: newPageId,
          width: pageToDuplicate.width,
          height: pageToDuplicate.height,
        },
      }
    })
  },

  reorderPage: (id, direction) => {
    set((state) => {
      const index = state.canvas.pages.findIndex((p) => p.id === id)
      if (index === -1) return state

      const newPages = [...state.canvas.pages]
      if (direction === 'up' && index > 0) {
        ;[newPages[index], newPages[index - 1]] = [newPages[index - 1], newPages[index]]
      } else if (direction === 'down' && index < newPages.length - 1) {
        ;[newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]]
      }

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    })
  },

  renamePage: (pageId, name) =>
    set((state) => {
      const newPages = state.canvas.pages.map((p) =>
        p.id === pageId ? { ...p, name } : p
      )
      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    }),

  // Layer management
  addLayer: (layer) => {
    const id = `layer-${Date.now()}-${Math.random()}`
    set((state) => {
      const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
      if (!activePage) return state

      const maxTrack = activePage.layers.reduce((max, l) => Math.max(max, l.track ?? 0), -1)
      const maxVideoEnd = activePage.layers
        .filter((l) => l.type === "video")
        .reduce((max, l) => Math.max(max, (l.startTime || 0) + (l.duration || 0)), 0)
      const normalizedLayer = clampLayerToVideoBounds(
        {
          ...layer,
          startTime: layer.startTime ?? 0,
          duration: layer.duration ?? 10, // Default to 10s for static elements
        },
        maxVideoEnd
      )
      const layerWithTrack = {
        ...normalizedLayer,
        id,
        track: maxTrack + 1,
      }

      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId
          ? { ...p, layers: [...p.layers, layerWithTrack] }
          : p
      )

      setTimeout(() => {
        get().recalculateTotalDuration()
        const fabricCanvas = get().canvas.fabricCanvas
        if (fabricCanvas) {
          get().saveToHistory(JSON.stringify(fabricCanvas.toJSON()))
        }
      }, 0)

      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          selectedLayerId: id,
        },
      }
    })
  },

  deleteLayer: (layerId) =>
    set((state) => {
      // 1. Remove from Fabric Canvas
      const { fabricCanvas } = state.canvas
      if (fabricCanvas) {
        const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
        const layer = activePage?.layers.find((l) => l.id === layerId)
        if (layer && layer.objectId) {
          const objectStillUsed = activePage?.layers.some(
            (candidate) =>
              candidate.id !== layerId &&
              candidate.objectId === layer.objectId,
          )
          const obj = fabricCanvas.getObjects().find((o: any) => o.name === layer.objectId)
          if (obj && !objectStillUsed) {
            ;(obj as any)._disposeVideo?.()
            fabricCanvas.remove(obj)
            fabricCanvas.requestRenderAll()
          }
        }
      }

      // 2. Remove from Store
      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId
          ? { ...p, layers: p.layers.filter((l) => l.id !== layerId) }
          : p
      )
      
      setTimeout(() => {
        get().recalculateTotalDuration()
        const fabricCanvas = get().canvas.fabricCanvas
        if (fabricCanvas) {
          get().saveToHistory(JSON.stringify(fabricCanvas.toJSON()))
        }
      }, 0)

      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          selectedLayerId: state.canvas.selectedLayerId === layerId ? null : state.canvas.selectedLayerId,
        },
      }
    }),

  updateLayer: (layerId, updates) =>
    set((state) => {
      const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
      const currentLayer = activePage?.layers.find((layer) => layer.id === layerId)
      if (
        !currentLayer ||
        Object.entries(updates).every(([key, value]) =>
          valuesEqual(currentLayer[key as keyof Layer], value)
        )
      ) {
        return state
      }

      const maxVideoEnd = activePage
        ? activePage.layers
            .filter((l) => l.type === "video")
            .reduce((max, l) => Math.max(max, (l.startTime || 0) + (l.duration || 0)), 0)
        : 0

      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId
          ? {
              ...p,
              layers: p.layers.map((l) => {
                if (l.id !== layerId) return l
                const merged = { ...l, ...updates }
                return clampLayerToVideoBounds(merged, maxVideoEnd) as Layer
              }),
            }
          : p
      )

      if (updates.startTime !== undefined || updates.duration !== undefined) {
        setTimeout(() => get().recalculateTotalDuration(), 0)
      }

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    }),

  updateLayerData: (layerId, data) =>
    set((state) => {
      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId
          ? {
              ...p,
              layers: p.layers.map((l) =>
                l.id === layerId
                  ? { ...l, data: { ...(l.data || {}), ...data } }
                  : l,
              ),
            }
          : p
      )

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    }),

  selectLayer: (layerId) =>
    set((state) => ({
      canvas: { ...state.canvas, selectedLayerId: layerId },
    })),

  duplicateLayer: (layerId) => {
    const state = get()
    const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
    if (!activePage) return

    const layerToDuplicate = activePage.layers.find((l) => l.id === layerId)
    if (!layerToDuplicate) return

    const sourceObject = state.canvas.fabricCanvas
      ?.getObjects()
      .find((object) => (object as any).name === layerToDuplicate.objectId)

    if (layerToDuplicate.objectId && !sourceObject) return

    const newId = `layer-${Date.now()}-${Math.random()}`
    const newObjectId = layerToDuplicate.objectId
      ? `${layerToDuplicate.objectId}_copy_${Date.now()}`
      : undefined
    const duplicated = {
      ...layerToDuplicate,
      id: newId,
      objectId: newObjectId,
      name: `${layerToDuplicate.name} copy`,
    }

    if (sourceObject && state.canvas.fabricCanvas && newObjectId) {
      const fabricCanvas = state.canvas.fabricCanvas
      Promise.resolve((sourceObject as any).clone()).then((cloned: any) => {
        cloned.set({
          left: (sourceObject.left || 0) + 24,
          top: (sourceObject.top || 0) + 24,
          name: newObjectId,
        })
        fabricCanvas.add(cloned)
        fabricCanvas.setActiveObject(cloned)
        cloned.setCoords()
        fabricCanvas.requestRenderAll()
        get().saveToHistory(JSON.stringify(fabricCanvas.toJSON()))
      })
    }

    const newPages = state.canvas.pages.map((p) =>
      p.id === state.canvas.activePageId ? { ...p, layers: [...p.layers, duplicated] } : p
    )

    set((prevState) => ({
      canvas: {
        ...prevState.canvas,
        pages: newPages,
        selectedLayerId: newId,
      },
    }))
  },

  reorderLayer: (layerId: string, direction: 'up' | 'down') => {
    set((state) => {
      const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
      if (!activePage) return state

      const index = activePage.layers.findIndex((l) => l.id === layerId)
      if (index === -1) return state

      const newLayers = [...activePage.layers]
      if (direction === 'up' && index < newLayers.length - 1) {
        ;[newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]]
      } else if (direction === 'down' && index > 0) {
        ;[newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]]
      }

      // Sync with fabric canvas stack
      const { fabricCanvas } = state.canvas
      if (fabricCanvas) {
        const layer = newLayers.find((l) => l.id === layerId)
        if (layer) {
          const obj = fabricCanvas.getObjects().find((o) => (o as any).name === layer.objectId)
          if (obj) {
            if (direction === 'up') fabricCanvas.bringObjectForward(obj)
            else fabricCanvas.sendObjectBackwards(obj)
            fabricCanvas.renderAll()
          }
        }
      }

      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId ? { ...p, layers: newLayers } : p
      )

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    })
  },

  moveLayer: (draggedId: string, targetId: string, position: 'above' | 'below') => {
    set((state) => {
      const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
      if (!activePage) return state

      const fromIndex = activePage.layers.findIndex((l) => l.id === draggedId)
      const targetIndex = activePage.layers.findIndex((l) => l.id === targetId)

      if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return state

      const newLayers = [...activePage.layers]
      const [movedLayer] = newLayers.splice(fromIndex, 1)

      let insertIndex = newLayers.findIndex((l) => l.id === targetId)
      if (position === 'above') {
        insertIndex += 1
      }

      newLayers.splice(insertIndex, 0, movedLayer)

      // Sync with fabric canvas stack
      const { fabricCanvas } = state.canvas
      if (fabricCanvas) {
        const obj = fabricCanvas.getObjects().find((o) => (o as any).name === movedLayer.objectId)
        if (obj) {
          const diff = insertIndex - fromIndex;
          if (diff > 0) {
            for (let i = 0; i < diff; i++) fabricCanvas.bringObjectForward(obj)
          } else if (diff < 0) {
            for (let i = 0; i < -diff; i++) fabricCanvas.sendObjectBackwards(obj)
          }
          fabricCanvas.renderAll()
        }
      }

      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId ? { ...p, layers: newLayers } : p
      )

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    })
  },

  renameLayer: (layerId, newName) => {
    set((state) => {
      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId
          ? {
              ...p,
              layers: p.layers.map((l) => (l.id === layerId ? { ...l, name: newName } : l)),
            }
          : p
      )
      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    })
  },

  splitLayer: (layerId, time) => {
    set((state) => {
      const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
      if (!activePage) return state

      const layerIndex = activePage.layers.findIndex((l) => l.id === layerId)
      if (layerIndex === -1) return state

      const layer = activePage.layers[layerIndex]
      const start = layer.startTime || 0
      const dur = layer.duration || 30 // Fallback
      
      // Can only split if time is within layer bounds
      if (time <= start || time >= start + dur) return state

      const part1Duration = time - start
      const part2Duration = (start + dur) - time
      const originalMediaStart = layer.mediaStart || 0

      const part1 = { ...layer, duration: part1Duration }
      const part2 = { 
        ...layer, 
        id: `layer-${Date.now()}-${Math.random()}`,
        name: `${layer.name} (Part 2)`, 
        startTime: time, 
        duration: part2Duration,
        mediaStart: originalMediaStart + part1Duration 
      }

      const newLayers = [...activePage.layers]
      newLayers[layerIndex] = part1
      newLayers.splice(layerIndex + 1, 0, part2)

      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId ? { ...p, layers: newLayers } : p
      )

      return {
        canvas: { ...state.canvas, pages: newPages },
      }
    })
  },

  getLayers: () => {
    const state = get()
    const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
    return activePage ? activePage.layers : []
  },

  getSelectedLayer: () => {
    const state = get()
    const activePage = state.canvas.pages.find((p) => p.id === state.canvas.activePageId)
    if (!activePage) return undefined
    return activePage.layers.find((l) => l.id === state.canvas.selectedLayerId)
  },

  saveToHistory: (snapshot) => {
    set((state) => {
      const parsed = parseHistorySnapshot(snapshot)
      if (!parsed) return state

      const activePage =
        state.canvas.pages.find((page) => page.id === state.canvas.activePageId) ||
        state.canvas.pages[0]
      const activeLayers = activePage?.layers || []
      const fabricSnapshot = parsed.fabric

      if (shouldSkipLayerIntermediateHistory(fabricSnapshot, activeLayers)) {
        return state
      }

      const historySnapshot: CanvasHistorySnapshot = {
        fabric: fabricSnapshot,
        pages: clonePages(state.canvas.pages),
        activePageId: state.canvas.activePageId,
        selectedLayerId: state.canvas.selectedLayerId,
        width: state.canvas.width,
        height: state.canvas.height,
      }
      const serializedSnapshot = JSON.stringify(historySnapshot)

      // Don't save if it's the same as the current head
      if (
        state.canvas.historyIndex >= 0 &&
        state.canvas.history[state.canvas.historyIndex] === serializedSnapshot
      ) {
        return state
      }

      const newHistory = state.canvas.history.slice(0, state.canvas.historyIndex + 1)
      newHistory.push(serializedSnapshot)
      
      // Limit history to 50 steps
      if (newHistory.length > 50) {
        newHistory.shift()
      }

      return {
        canvas: {
          ...state.canvas,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        },
      }
    })
  },

  undo: () => {
    const { historyIndex, history, fabricCanvas } = get().canvas
    if (historyIndex > 0) {
      const prevSnapshot = parseHistorySnapshot(history[historyIndex - 1])
      if (fabricCanvas && prevSnapshot) {
        // We use a flag to prevent saving back to history while loading
        ;(fabricCanvas as any).isHistoryLoading = true
        disposeVideoObjects(fabricCanvas)
        fabricCanvas.loadFromJSON(prevSnapshot.fabric).then(() => {
          fabricCanvas.discardActiveObject()
          fabricCanvas.renderAll()
          ;(fabricCanvas as any).isHistoryLoading = false
        })
      }
      set((state) => ({
        canvas: {
          ...state.canvas,
          pages: prevSnapshot?.pages.length ? clonePages(prevSnapshot.pages) : state.canvas.pages,
          activePageId: prevSnapshot?.activePageId || state.canvas.activePageId,
          selectedLayerId: prevSnapshot?.selectedLayerId || null,
          width: prevSnapshot?.width || state.canvas.width,
          height: prevSnapshot?.height || state.canvas.height,
          historyIndex: state.canvas.historyIndex - 1,
        },
      }))
      setTimeout(() => get().recalculateTotalDuration(), 0)
    }
  },

  redo: () => {
    const { historyIndex, history, fabricCanvas } = get().canvas
    if (historyIndex < history.length - 1) {
      const nextSnapshot = parseHistorySnapshot(history[historyIndex + 1])
      if (fabricCanvas && nextSnapshot) {
        ;(fabricCanvas as any).isHistoryLoading = true
        disposeVideoObjects(fabricCanvas)
        fabricCanvas.loadFromJSON(nextSnapshot.fabric).then(() => {
          fabricCanvas.discardActiveObject()
          fabricCanvas.renderAll()
          ;(fabricCanvas as any).isHistoryLoading = false
        })
      }
      set((state) => ({
        canvas: {
          ...state.canvas,
          pages: nextSnapshot?.pages.length ? clonePages(nextSnapshot.pages) : state.canvas.pages,
          activePageId: nextSnapshot?.activePageId || state.canvas.activePageId,
          selectedLayerId: nextSnapshot?.selectedLayerId || null,
          width: nextSnapshot?.width || state.canvas.width,
          height: nextSnapshot?.height || state.canvas.height,
          historyIndex: state.canvas.historyIndex + 1,
        },
      }))
      setTimeout(() => get().recalculateTotalDuration(), 0)
    }
  },

  canUndo: () => get().canvas.historyIndex > 0,
  canRedo: () => get().canvas.historyIndex < get().canvas.history.length - 1,

  resetCanvas: () => set({ canvas: initialCanvasState }),

  clearAllLayers: () =>
    set((state) => {
      const newPages = state.canvas.pages.map((p) =>
        p.id === state.canvas.activePageId ? { ...p, layers: [] } : p
      )
      return {
        canvas: {
          ...state.canvas,
          pages: newPages,
          selectedLayerId: null,
        },
      }
    }),

  videoEditorOpen: false,
  videoState: initialVideoState,
  setVideoEditorOpen: (open) => set({ videoEditorOpen: open }),
  setVideoState: (updates) =>
    set((state) => {
      const changed = Object.entries(updates).some(([key, value]) =>
        !valuesEqual(state.videoState[key as keyof VideoState], value)
      )
      if (!changed) return state

      return {
        videoState: { ...state.videoState, ...updates },
      }
    }),

  recentAssets: [],
  addRecentAsset: (asset) => set((state) => {
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `asset-${crypto.randomUUID()}`
        : `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAsset = {
      ...asset,
      id: uniqueId,
      timestamp: Date.now()
    }
    // Limit to 20 recent assets
    const newAssets = [newAsset, ...state.recentAssets.filter(a => a.url !== asset.url)].slice(0, 20)
    return { recentAssets: newAssets }
  }),
  removeRecentAsset: (url) => set((state) => ({
    recentAssets: state.recentAssets.filter((asset) => asset.url !== url),
  })),

  recalculateTotalDuration: () => {
    const state = get()
    const layers = state.getLayers()
    if (layers.length === 0) {
      if (
        valuesEqual(state.videoState.duration, 30) &&
        valuesEqual(state.videoState.endTime, 30)
      ) {
        return
      }
      set({ videoState: { ...state.videoState, duration: 30, endTime: 30 } })
      return
    }

    let maxEndTime = 0
    let maxVideoEnd = 0
    layers.forEach(layer => {
      const end = (layer.startTime || 0) + (layer.duration || 0)
      if (end > maxEndTime) maxEndTime = end
      if (layer.type === "video" && end > maxVideoEnd) maxVideoEnd = end
    })

    // If video exists, timeline should not exceed video bounds for overlays/text.
    const boundedEnd = maxVideoEnd > 0 ? Math.min(maxEndTime, maxVideoEnd) : maxEndTime
    // Minimum duration of 5 seconds
    const finalDuration = Math.max(5, boundedEnd)

    if (
      valuesEqual(state.videoState.duration, finalDuration) &&
      valuesEqual(state.videoState.endTime, finalDuration)
    ) {
      return
    }

    set((state) => ({
      videoState: {
        ...state.videoState,
        duration: finalDuration,
        endTime: finalDuration
      }
    }))
  }
}))
