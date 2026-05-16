import { FabricImage, FabricObject, filters, Shadow, Rect } from 'fabric'

export interface ImageAdjustments {
  brightness?: number // -1 to 1
  contrast?: number // -1 to 1
  saturation?: number // -1 to 1
  blur?: number // 0-50px
  grayscale?: boolean
  sepia?: boolean
}

export interface ImageEffects {
  shadow?: {
    color: string
    blur: number
    offsetX: number
    offsetY: number
    opacity: number
  }
  border?: {
    color: string
    width: number
    radius: number
  }
  opacity?: number
}

export class ImageEditor {
  static applyFilters(image: FabricImage, adjustments: ImageAdjustments) {
    const filterList: any[] = []

    if (adjustments.brightness !== undefined && adjustments.brightness !== 0) {
      filterList.push(new filters.Brightness({ brightness: adjustments.brightness }))
    }

    if (adjustments.contrast !== undefined && adjustments.contrast !== 0) {
      filterList.push(new filters.Contrast({ contrast: adjustments.contrast }))
    }

    if (adjustments.saturation !== undefined && adjustments.saturation !== 0) {
      filterList.push(new filters.Saturation({ saturation: adjustments.saturation }))
    }

    if (adjustments.blur !== undefined && adjustments.blur > 0) {
      filterList.push(new filters.Blur({ blur: adjustments.blur / 50 }))
    }

    if (adjustments.grayscale) {
      filterList.push(new filters.Grayscale())
    }

    if (adjustments.sepia) {
      filterList.push(new filters.Sepia())
    }

    image.filters = filterList
    image.applyFilters()
  }

  static applyShadow(obj: FabricObject, shadow: ImageEffects['shadow']) {
    if (!shadow) {
        obj.shadow = null;
        return;
    }

    obj.shadow = new Shadow({
      color: shadow.color,
      blur: shadow.blur,
      offsetX: shadow.offsetX,
      offsetY: shadow.offsetY,
      affectStroke: false,
      nonScaling: true
    })
  }

  static applyBorderAndRadius(obj: FabricObject, border: ImageEffects['border']) {
    if (!border) return

    obj.set({
      stroke: border.width > 0 ? border.color : 'transparent',
      strokeWidth: border.width,
    })

    // For border radius on images, we use clipPath
    if (border.radius > 0) {
        const radius = border.radius;
        const clipPath = new Rect({
            left: -obj.width! / 2,
            top: -obj.height! / 2,
            width: obj.width!,
            height: obj.height!,
            rx: radius,
            ry: radius,
        });
        obj.clipPath = clipPath;
    } else {
        obj.clipPath = undefined;
    }
  }

  static flip(image: FabricImage, direction: 'horizontal' | 'vertical') {
    if (direction === 'horizontal') {
      image.set('flipX', !image.flipX)
    } else {
      image.set('flipY', !image.flipY)
    }
  }

  static rotate(obj: FabricObject, degrees: number) {
    obj.rotate(degrees % 360)
  }

  static async cropImage(
    image: FabricImage,
    cropBox: {
      x: number
      y: number
      width: number
      height: number
    }
  ) {
    const clipPath = new Rect({
      left: cropBox.x,
      top: cropBox.y,
      width: cropBox.width,
      height: cropBox.height,
      absolutePositioned: true,
    })

    image.clipPath = clipPath
  }

  static setOpacity(obj: FabricObject, opacity: number) {
    obj.set('opacity', Math.max(0, Math.min(1, opacity)))
  }
}
