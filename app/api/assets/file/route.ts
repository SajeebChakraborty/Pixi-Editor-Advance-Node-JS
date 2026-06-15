import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";
import { resolveMediaContentType } from "@/lib/media-content-type";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key || !key.startsWith("editor-assets/")) {
    return NextResponse.json(
      { error: "Invalid editor asset key" },
      { status: 400 },
    );
  }

  const range = request.headers.get("range");
  const file = await S3Storage.getFile(key, range);
  if (!file) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return new NextResponse(file.body, {
    status: range && file.contentRange ? 206 : 200,
    headers: {
      "Content-Type": resolveMediaContentType(key, file.contentType),
      ...(file.contentLength
        ? { "Content-Length": String(file.contentLength) }
        : {}),
      ...(file.contentRange ? { "Content-Range": file.contentRange } : {}),
      "Accept-Ranges": file.acceptRanges || "bytes",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
