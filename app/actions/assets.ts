"use server";

import { S3Storage } from "@/lib/storage-s3";
import { supabase } from "@/lib/supabase";
import { AssetType } from "@/lib/asset-service";

export async function uploadAssetAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const type = formData.get("type") as AssetType;
    const category = formData.get("category") as string;

    if (!file || !name || !type || !category) {
      throw new Error("Missing required fields");
    }

    // 1. Upload to S3 (Server-side has access to S3 env vars)
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}s/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Convert File to Buffer for S3 upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await S3Storage.uploadFile(buffer, fileName, file.type);

    if (!publicUrl) {
      throw new Error("S3 Upload failed");
    }

    // 2. Insert record into Supabase
    const { data, error } = await supabase
      .from('assets')
      .insert([
        {
          name,
          type,
          category,
          url: publicUrl,
          file_size: file.size,
          is_public: true,
          // user_id will be handled by RLS or we could get it via auth.getUser()
          // for global assets project_id is null
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      // Optional: cleanup S3 if DB insert fails
      // await S3Storage.deleteFile(fileName);
      throw error;
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("error in uploadAssetAction:", error);
    return { success: false, error: error.message };
  }
}
