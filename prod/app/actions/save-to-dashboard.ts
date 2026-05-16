"use server";

import { S3Storage } from "@/lib/storage-s3";

/**
 * Uploads a base64 data URL to S3 and returns the public URL.
 * Used for saving edited canvas items back to the main dashboard.
 */
export async function uploadToDashboardAction(dataUrl: string, type: 'image' | 'video' = 'image') {
  try {
    if (!dataUrl) throw new Error("No data URL provided");

    // 1. Extract base64 part
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 2. Generate filename
    const ext = type === 'video' ? 'webm' : 'png';
    const contentType = type === 'video' ? 'video/webm' : 'image/png';
    // Store in a dedicated folder for editor results
    const fileName = `editor-results/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    
    // 3. Upload to S3
    console.log(`[UPLOAD] Starting S3 upload for ${type}: ${fileName}`);
    const publicUrl = await S3Storage.uploadFile(buffer, fileName, contentType);
    
    if (!publicUrl) {
      throw new Error("S3 upload failed - check server logs for details");
    }
    
    console.log(`[UPLOAD] Success! Public URL: ${publicUrl}`);
    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error("[UPLOAD ERROR]", error);
    return { success: false, error: error.message || "Unknown upload error" };
  }
}

export async function uploadRenderedVideoAction(
  dataUrl: string,
  extension: "mp4" | "webm" = "webm",
  contentType?: string
) {
  try {
    if (!dataUrl) throw new Error("No video data provided");
    const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const buffer = Buffer.from(base64Data, "base64");

    const ext = extension === "mp4" ? "mp4" : "webm";
    const mime = contentType || (ext === "mp4" ? "video/mp4" : "video/webm");
    const fileName = `editor-results/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const publicUrl = await S3Storage.uploadFile(buffer, fileName, mime);
    if (!publicUrl) throw new Error("S3 upload failed");
    return { success: true, url: publicUrl, extension: ext };
  } catch (error: any) {
    console.error("[VIDEO UPLOAD ERROR]", error);
    return { success: false, error: error.message || "Unknown video upload error" };
  }
}
