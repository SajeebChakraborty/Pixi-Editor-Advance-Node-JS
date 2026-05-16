"use server";

import { S3Storage } from "@/lib/storage-s3";
import { supabase } from "@/lib/supabase";
import { TemplateLayer } from "@/lib/templates";
import sizeOf from "image-size";

export async function uploadTemplateAction(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const tagsString = formData.get("tags") as string;
    const published = formData.get("published") === "true";
    const thumbnailFile = formData.get("thumbnailFile") as File | null;
    const jsonFile = formData.get("jsonFile") as File | null;

    if (!name || !category || !jsonFile) {
      throw new Error("Missing name, category, or template file");
    }

    const tags = JSON.parse(tagsString || "[]");
    let thumbnailUrl: string | undefined;
    let layers: TemplateLayer[] = [];
    let width = 1080;
    let height = 1080;
    let imageUrl: string | undefined;

    // 1. Upload thumbnail to S3
    if (thumbnailFile) {
      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `templates/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
      thumbnailUrl = await S3Storage.uploadFile(buffer, fileName, thumbnailFile.type) || undefined;
    }

    // 2. Handle template file (JSON or Image)
    const isImageFile = jsonFile.type.startsWith('image/');
    if (isImageFile) {
      const fileExt = jsonFile.name.split('.').pop();
      const fileName = `templates/${Date.now()}-image-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const buffer = Buffer.from(await jsonFile.arrayBuffer());
      imageUrl = await S3Storage.uploadFile(buffer, fileName, jsonFile.type) || undefined;

      if (!imageUrl) throw new Error("Template image upload failed");

      // Get image dimensions on server
      const dimensions = sizeOf(buffer);
      width = dimensions.width || 1080;
      height = dimensions.height || 1080;

      layers = [
        {
          id: 'bg-1',
          type: 'shape',
          name: 'Background',
          locked: false,
          properties: {
            fill: '#ffffff',
            width: width,
            height: height,
            left: 0,
            top: 0,
          },
        },
        {
          id: 'img-1',
          type: 'image',
          name: 'Template Image',
          locked: false,
          properties: {
            src: imageUrl,
            left: 0,
            top: 0,
            width: width,
            height: height,
          },
        },
      ];

      if (!thumbnailUrl) thumbnailUrl = imageUrl;
    } else {
      // JSON File
      const jsonText = await jsonFile.text();
      const jsonData = JSON.parse(jsonText);
      layers = jsonData.layers || [];
      width = jsonData.width || 1080;
      height = jsonData.height || 1080;
    }

    // 3. Save to Supabase
    const { data, error } = await supabase
      .from('templates')
      .insert([
        {
          name,
          description,
          category,
          tags,
          thumbnail_url: thumbnailUrl,
          layers,
          width,
          height,
          published,
          is_premium: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Error in uploadTemplateAction:", error);
    return { success: false, error: error.message };
  }
}
