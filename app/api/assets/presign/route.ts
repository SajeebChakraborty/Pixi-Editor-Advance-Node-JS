import { NextResponse } from "next/server";
import { resolveMediaContentType } from "@/lib/media-content-type";
import { S3Storage } from "@/lib/storage-s3";

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
    const body = await request.json();
    const type = String(body?.type || "");
    const fileName = String(body?.fileName || "");
    const suppliedContentType = String(body?.contentType || "");
    const size = Number(body?.size || 0);

    if (!ALLOWED_TYPES.has(type) || !fileName || !Number.isFinite(size)) {
      return NextResponse.json(
        { success: false, error: "Missing or unsupported editor asset" },
        { status: 400 },
      );
    }

    const maxBytes = MAX_UPLOAD_BYTES[type];
    if (size <= 0 || size > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File is too large. Maximum ${type} upload is ${Math.floor(
            maxBytes / 1024 / 1024,
          )}MB.`,
        },
        { status: 413 },
      );
    }

    const extension =
      fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "bin";
    const key = `editor-assets/${type}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${sanitizeFileName(fileName)}.${extension}`;
    const contentType = resolveMediaContentType(fileName, suppliedContentType);
    const uploadUrl = await S3Storage.createPresignedUploadUrl(key, contentType);

    if (!uploadUrl) {
      return NextResponse.json(
        { success: false, error: "Could not prepare asset upload" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      url: `/api/assets/file?key=${encodeURIComponent(key)}`,
      contentType,
    });
  } catch (error) {
    console.error("[EDITOR_ASSET_PRESIGN]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not prepare upload",
      },
      { status: 500 },
    );
  }
}
