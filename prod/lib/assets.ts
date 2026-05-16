export type AssetType = 'image' | 'video' | 'sticker' | 'icon'

export interface Asset {
  id: string
  name: string
  type: AssetType
  url: string
  category: string
  enabled: boolean
  createdAt: Date
  tags: string[]
}

// Mock asset library
export const MOCK_ASSETS: Asset[] = [
  // Images
  {
    id: 'img-1',
    name: 'Nature Background 1',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1080&fit=crop',
    category: 'backgrounds',
    enabled: true,
    createdAt: new Date(),
    tags: ['nature', 'landscape', 'background'],
  },
  {
    id: 'img-2',
    name: 'Urban Scene',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1080&h=1080&fit=crop',
    category: 'backgrounds',
    enabled: true,
    createdAt: new Date(),
    tags: ['urban', 'city', 'modern'],
  },
  {
    id: 'img-3',
    name: 'Gradient Blue',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=1080&h=1080&fit=crop',
    category: 'backgrounds',
    enabled: true,
    createdAt: new Date(),
    tags: ['gradient', 'abstract', 'modern'],
  },

  // Stickers
  {
    id: 'sticker-1',
    name: 'Star Icon',
    type: 'sticker',
    url: 'https://via.placeholder.com/200?text=⭐',
    category: 'icons',
    enabled: true,
    createdAt: new Date(),
    tags: ['star', 'icon', 'rating'],
  },
  {
    id: 'sticker-2',
    name: 'Heart Icon',
    type: 'sticker',
    url: 'https://via.placeholder.com/200?text=❤️',
    category: 'icons',
    enabled: true,
    createdAt: new Date(),
    tags: ['heart', 'icon', 'love'],
  },
  {
    id: 'sticker-3',
    name: 'Checkmark Icon',
    type: 'sticker',
    url: 'https://via.placeholder.com/200?text=✓',
    category: 'icons',
    enabled: true,
    createdAt: new Date(),
    tags: ['check', 'icon', 'success'],
  },

  // Videos
  {
    id: 'video-1',
    name: 'Sample Video 1',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
    category: 'video-clips',
    enabled: true,
    createdAt: new Date(),
    tags: ['sample', 'video', 'animation'],
  },
  {
    id: 'video-2',
    name: 'Sample Video 2',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
    category: 'video-clips',
    enabled: true,
    createdAt: new Date(),
    tags: ['sample', 'video', '3d'],
  },
]

export class AssetLibrary {
  /**
   * Get all assets
   */
  static getAllAssets(): Asset[] {
    return MOCK_ASSETS.filter((a) => a.enabled)
  }

  /**
   * Get assets by type
   */
  static getAssetsByType(type: AssetType): Asset[] {
    return MOCK_ASSETS.filter((a) => a.type === type && a.enabled)
  }

  /**
   * Get assets by category
   */
  static getAssetsByCategory(category: string): Asset[] {
    return MOCK_ASSETS.filter((a) => a.category === category && a.enabled)
  }

  /**
   * Search assets
   */
  static searchAssets(query: string): Asset[] {
    const q = query.toLowerCase()
    return MOCK_ASSETS.filter(
      (a) =>
        a.enabled &&
        (a.name.toLowerCase().includes(q) ||
          a.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q))
    )
  }

  /**
   * Get asset by ID
   */
  static getAssetById(id: string): Asset | undefined {
    return MOCK_ASSETS.find((a) => a.id === id)
  }

  /**
   * Get all categories
   */
  static getCategories(): string[] {
    const categories = new Set(MOCK_ASSETS.map((a) => a.category))
    return Array.from(categories).sort()
  }

  /**
   * Upload asset (mocked)
   */
  static async uploadAsset(
    file: File,
    name: string,
    category: string,
    type: AssetType
  ): Promise<Asset> {
    // In real app, this would upload to S3/Cloudinary
    const url = URL.createObjectURL(file)

    const asset: Asset = {
      id: `asset-${Date.now()}`,
      name,
      type,
      url,
      category,
      enabled: true,
      createdAt: new Date(),
      tags: [category],
    }

    MOCK_ASSETS.push(asset)
    return asset
  }

  /**
   * Update asset
   */
  static updateAsset(id: string, updates: Partial<Asset>): Asset | undefined {
    const asset = MOCK_ASSETS.find((a) => a.id === id)
    if (asset) {
      Object.assign(asset, updates)
    }
    return asset
  }

  /**
   * Delete asset
   */
  static deleteAsset(id: string): boolean {
    const index = MOCK_ASSETS.findIndex((a) => a.id === id)
    if (index !== -1) {
      MOCK_ASSETS[index].enabled = false
      return true
    }
    return false
  }

  /**
   * Toggle asset enabled status
   */
  static toggleAsset(id: string): boolean {
    const asset = MOCK_ASSETS.find((a) => a.id === id)
    if (asset) {
      asset.enabled = !asset.enabled
      return true
    }
    return false
  }
}
