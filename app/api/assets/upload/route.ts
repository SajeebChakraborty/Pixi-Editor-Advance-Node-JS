import { NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image", "video", "audio"]);

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

    const extension =
      file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "bin";
    const key = `editor-assets/${requestedType}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${sanitizeFileName(file.name)}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageUrl = await S3Storage.uploadFile(
      buffer,
      key,
      file.type || "application/octet-stream",
    );

    if (!storageUrl) {
      return NextResponse.json(
        { success: false, error: "Persistent asset upload failed" },
        { status: 500 },
      );
    }

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
