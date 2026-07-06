import { NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";
import { resolveMediaContentType } from "@/lib/media-content-type";
import { markUploadedAsset } from "@/lib/uploaded-asset-cache";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_TYPES = new Set(["image", "video", "audio"]);
const MAX_UPLOAD_BYTES: Record<string, number> = {
  image: 15 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
};

const sanitizeFileName = (name: string) =>
  name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedType = String(formData.get("type") || "");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(requestedType)) {
      return NextResponse.json(
        { success: false, error: "Missing or unsupported editor asset" },
        { status: 400 },
      );
    }

    const maxBytes = MAX_UPLOAD_BYTES[requestedType];
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File is too large. Maximum ${requestedType} upload is ${Math.floor(
            maxBytes / 1024 / 1024,
          )}MB.`,
        },
        { status: 413 },
      );
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "bin";
    const key = `editor-assets/${requestedType}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${sanitizeFileName(file.name)}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = resolveMediaContentType(file.name, file.type);
    const storageUrl = await S3Storage.uploadFile(
      buffer,
      key,
      contentType,
    );

    if (!storageUrl) {
      return NextResponse.json(
        { success: false, error: "Persistent asset upload failed" },
        { status: 500 },
      );
    }

    markUploadedAsset(key, {
      contentType,
      contentLength: buffer.byteLength,
    });

    return NextResponse.json({
      success: true,
      url: `/api/assets/file?key=${encodeURIComponent(key)}`,
      key,
    });
  } catch (error) {
    console.error("[EDITOR_ASSET_UPLOAD]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Asset upload failed",
      },
      { status: 500 },
    );
  }
}
