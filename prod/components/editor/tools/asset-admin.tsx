'use client'

import { useState } from 'react'
import { AssetLibrary, type AssetType } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff, Trash2, Upload, Plus } from 'lucide-react'

export function AssetAdmin() {
  const [assets, setAssets] = useState(AssetLibrary.getAllAssets())
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('backgrounds')
  const [selectedType, setSelectedType] = useState<AssetType>('image')

  const handleUploadAsset = async (file: File) => {
    try {
      const asset = await AssetLibrary.uploadAsset(file, uploadName || file.name, uploadCategory, selectedType)
      setAssets(AssetLibrary.getAllAssets())
      setUploadName('')
      console.log('[v0] Asset uploaded:', asset.name)
    } catch (error) {
      console.error('[v0] Upload error:', error)
    }
  }

  const handleToggleAsset = (assetId: string) => {
    AssetLibrary.toggleAsset(assetId)
    setAssets(AssetLibrary.getAllAssets())
  }

  const handleDeleteAsset = (assetId: string) => {
    AssetLibrary.deleteAsset(assetId)
    setAssets(AssetLibrary.getAllAssets())
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">Asset Library</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-3">
          {assets.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500">
              No assets yet
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">{asset.category}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleToggleAsset(asset.id)}
                      title={asset.enabled ? 'Disable' : 'Enable'}
                    >
                      {asset.enabled ? (
                        <Eye className="w-4 h-4 text-gray-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDeleteAsset(asset.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <Label htmlFor="assetName" className="text-sm font-medium mb-2 block">
              Asset Name
            </Label>
            <Input
              id="assetName"
              placeholder="My awesome asset"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="assetCategory" className="text-sm font-medium mb-2 block">
              Category
            </Label>
            <Input
              id="assetCategory"
              placeholder="backgrounds"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['image', 'video', 'sticker', 'icon'] as AssetType[]).map((type) => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Upload File</Label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUploadAsset(file)
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="text-xs text-gray-500">
            <p>• Supported: PNG, JPG, SVG (images)</p>
            <p>• MP4 (videos)</p>
            <p>• Organize by category</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
