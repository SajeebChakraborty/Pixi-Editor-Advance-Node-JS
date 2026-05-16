import { Canvas, FabricObject, FabricImage, IText, util, type ImageProps, type ITextProps } from 'fabric'

export class CanvasEngine {
  private canvas: Canvas
  private gridSize = 20

  constructor(canvasElement: HTMLCanvasElement, width: number, height: number) {
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    })

    this.setupCanvasDefaults()
  }

  private setupCanvasDefaults() {
    // Configure default object properties
    FabricObject.prototype.set({
      transparentCorners: false,
      borderColor: '#3b82f6',
      cornerColor: '#3b82f6',
      cornerSize: 8,
      borderDashArray: [5, 5],
    })
  }

  getCanvas(): Canvas {
    return this.canvas
  }

  // Resize canvas
  resizeCanvas(width: number, height: number) {
    this.canvas.setDimensions({ width, height })
    this.canvas.renderAll()
  }

  // Zoom controls
  zoomTo(zoom: number) {
    const limit = Math.min(5, Math.max(0.1, zoom))
    this.canvas.setZoom(limit)
    this.canvas.renderAll()
  }

  // Pan canvas
  panCanvas(deltaX: number, deltaY: number) {
    const vpt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
    vpt[4] += deltaX
    vpt[5] += deltaY
    this.canvas.setViewportTransform(vpt)
    this.canvas.renderAll()
  }

  // Add image to canvas
  async addImage(imageUrl: string, options?: Partial<ImageProps>) {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
      if (!img) {
        throw new Error('Failed to load image')
      }

      // Auto-center and scale to fit canvas
      const width = this.canvas.width || 800
      const height = this.canvas.height || 600
      const maxWidth = width * 0.8
      const maxHeight = height * 0.8
      const scale = Math.min(maxWidth / (img.width || 100), maxHeight / (img.height || 100))

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (width - (img.width || 100) * scale) / 2,
        top: (height - (img.height || 100) * scale) / 2,
        ...options,
      })

      this.canvas.add(img)
      this.canvas.setActiveObject(img)
      this.canvas.renderAll()
      return img
    } catch (error) {
      throw error
    }
  }

  // Add text to canvas
  addText(text: string = 'Click to edit', options?: Partial<ITextProps>) {
    const fabricText = new IText(text, {
      left: 100,
      top: 100,
      fontSize: 20,
      fontFamily: 'Arial',
      fill: '#000000',
      ...options,
    })

    this.canvas.add(fabricText)
    this.canvas.setActiveObject(fabricText)
    this.canvas.renderAll()
    return fabricText
  }

  // Update object properties
  updateObject(obj: FabricObject, properties: Record<string, any>) {
    obj.set(properties)
    this.canvas.renderAll()
  }

  // Delete object
  deleteObject(obj: FabricObject) {
    this.canvas.remove(obj)
    this.canvas.renderAll()
  }

  // Duplicate object
  async duplicateObject(obj: FabricObject): Promise<FabricObject> {
    const cloned = await obj.clone();
    cloned.set({
      left: (obj.left || 0) + 10,
      top: (obj.top || 0) + 10,
    });
    this.canvas.add(cloned);
    this.canvas.setActiveObject(cloned);
    this.canvas.renderAll();
    return cloned;
  }

  // Layer controls
  bringToFront(obj: FabricObject) {
    this.canvas.bringObjectToFront(obj);
    this.canvas.renderAll();
  }

  sendToBack(obj: FabricObject) {
    this.canvas.sendObjectToBack(obj);
    this.canvas.renderAll();
  }

  // Lock/unlock
  lockObject(obj: FabricObject) {
    obj.set({ evented: false, selectable: false })
    this.canvas.renderAll()
  }

  unlockObject(obj: FabricObject) {
    obj.set({ evented: true, selectable: true })
    this.canvas.renderAll()
  }

  // Export canvas
  exportAsJSON(): string {
    return JSON.stringify(this.canvas.toJSON())
  }

  loadFromJSON(json: string): Promise<void> {
    return this.canvas.loadFromJSON(json).then(() => {
        this.canvas.renderAll()
    })
  }

  exportAsImage(format: 'png' | 'jpeg' = 'png'): string {
    const multiplier = 2 // Export at 2x resolution
    return this.canvas.toDataURL({
      format,
      quality: 0.95,
      multiplier,
    })
  }

  exportAsVideo(): Promise<Blob> {
    // Placeholder: actual video export handled by API route
    return Promise.resolve(new Blob())
  }

  // Get canvas state for serialization
  getCanvasState() {
    return {
      json: this.exportAsJSON(),
      objects: this.canvas.getObjects().map((obj) => ({
        id: (obj as any).name,
        type: obj.type,
        properties: obj.toJSON(),
      })),
    }
  }

  // Cleanup
  dispose() {
    this.canvas.dispose()
  }
}
