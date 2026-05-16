import { getGlobalAssets, deleteAsset } from './supabase';
import { uploadAssetAction } from '@/app/actions/assets';

export type AssetType = 'image' | 'video' | 'sticker' | 'icon' | 'shape' | 'audio' | 'template';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  category: string;
  url: string;
  enabled: boolean;
  isPremium?: boolean;
}

export const AssetService = {
  getAssets: async (type?: AssetType) => {
    const assets = await getGlobalAssets(type);
    return assets.map((a: any) => ({
      ...a,
      enabled: a.enabled !== false // Default to true if null/missing
    }));
  },
  
  getAllAssetsAdmin: async () => {
    const assets = await getGlobalAssets();
    return assets.map((a: any) => ({
      ...a,
      enabled: a.enabled !== false
    }));
  },
  
  addAsset: async (file: File, name: string, type: AssetType, category: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("type", type);
    formData.append("category", category);

    const result = await uploadAssetAction(formData);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
  
  toggleAsset: async (id: string, enabled: boolean) => {
    const { supabase } = await import('./supabase');
    const { error } = await supabase
      .from('assets')
      .update({ enabled })
      .eq('id', id);
    return !error;
  },
  
  deleteAsset: async (id: string) => {
    return await deleteAsset(id);
  }
};
