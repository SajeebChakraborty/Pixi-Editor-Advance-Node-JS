import { NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";

export const runtime = "nodejs";

/** Top-level MP4 / ISO BMFF — browser MediaRecorder may send MP4 while user chose MP4 export; do not run WebM→MP4 on that. */
const bufferLooksLikeMp4 = (buf: Buffer): boolean =>
  buf.length >= 12 &&
  buf[4] === 0x66 &&
  buf[5] === 0x74 &&
  buf[6] === 0x79 &&
  buf[7] === 0x70;

const transcodeWebmToMp4 = async (inputBuffer: Buffer): Promise<Buffer> => {
  if (!ffmpegStatic) {
    throw new Error("FFmpeg binary not available");
  }

  ffmpeg.setFfmpegPath(ffmpegStatic);

  const workDir = join(tmpdir(), "pixizen-video-transcode");
  await fs.mkdir(workDir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = join(workDir, `${id}.webm`);
  const outputPath = join(workDir, `${id}.mp4`);

  await fs.writeFile(inputPath, inputBuffer);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
        "-preset veryfast",
        "-crf 23",
        "-an",
      ])
      .format("mp4")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });

  const out = await fs.readFile(outputPath);
  await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
  return out;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const extensionRaw = String(formData.get("extension") || "webm").toLowerCase();
    const extension = extensionRaw === "mp4" ? "mp4" : "webm";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing file" }, { status: 400 });
    }

    const uploadedBuffer = Buffer.from(await file.arrayBuffer());
    const typeLower = (file.type || "").toLowerCase();
    const nameLower = (file.name || "").toLowerCase();
    const alreadyMp4 =
      typeLower.includes("mp4") ||
      nameLower.endsWith(".mp4") ||
      bufferLooksLikeMp4(uploadedBuffer);

    const buffer =
      extension === "mp4" && !alreadyMp4
        ? await transcodeWebmToMp4(uploadedBuffer)
        : uploadedBuffer;
    const mime = extension === "mp4" ? "video/mp4" : (file.type || "video/webm");
    const fileName = `editor-results/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const publicUrl = await S3Storage.uploadFile(buffer, fileName, mime);
    if (!publicUrl) {
      return NextResponse.json({ success: false, error: "S3 upload failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: publicUrl, extension });
  } catch (error: any) {
    console.error("[UPLOAD_RENDERED_VIDEO_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Upload failed" },
      { status: 500 },
    );
  }
}
