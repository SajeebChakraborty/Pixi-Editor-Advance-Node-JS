import { NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";

export const runtime = "nodejs";

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "mpeg",
  "mpga",
  "ogg",
  "wav",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Missing audio file" },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "mp3";
    if (!file.type.startsWith("audio/") && !AUDIO_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { success: false, error: "Unsupported audio file" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `editor-audio/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const url = await S3Storage.uploadFile(
      buffer,
      key,
      file.type || "audio/mpeg",
    );
    if (!url) {
      return NextResponse.json(
        { success: false, error: "Audio upload failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, url, key });
  } catch (error) {
    console.error("[UPLOAD_AUDIO_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Audio upload failed",
      },
      { status: 500 },
    );
  }
}
