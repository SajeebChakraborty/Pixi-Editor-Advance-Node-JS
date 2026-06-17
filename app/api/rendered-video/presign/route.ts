import { NextResponse } from "next/server";
import { resolveMediaContentType } from "@/lib/media-content-type";
import { S3Storage } from "@/lib/storage-s3";

export const runtime = "nodejs";

const MAX_RENDERED_VIDEO_BYTES = 500 * 1024 * 1024;

const sanitizeExtension = (extension: string) =>
  extension.toLowerCase() === "mp4" ? "mp4" : "webm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const size = Number(body?.size || 0);
    const extension = sanitizeExtension(String(body?.extension || "webm"));
    const suppliedContentType = String(body?.contentType || "");

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { success: false, error: "Missing rendered video size" },
        { status: 400 },
      );
    }

    if (size > MAX_RENDERED_VIDEO_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Rendered video is too large. Maximum export upload is ${Math.floor(
            MAX_RENDERED_VIDEO_BYTES / 1024 / 1024,
          )}MB.`,
        },
        { status: 413 },
      );
    }

    const fileName = `editor-results/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const contentType = resolveMediaContentType(fileName, suppliedContentType);
    const uploadUrl = await S3Storage.createPresignedUploadUrl(fileName, contentType);

    if (!uploadUrl) {
      return NextResponse.json(
        { success: false, error: "Could not prepare rendered video upload" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      key: fileName,
      url: S3Storage.getPublicUrl(fileName),
      contentType,
      extension,
    });
  } catch (error) {
    console.error("[RENDERED_VIDEO_PRESIGN]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare rendered video upload",
      },
      { status: 500 },
    );
  }
}
