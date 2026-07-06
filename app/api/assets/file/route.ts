import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";
import { resolveMediaContentType } from "@/lib/media-content-type";
import { getUploadedAssetCache } from "@/lib/uploaded-asset-cache";

export const runtime = "nodejs";

const assetKeyFromRequest = (request: NextRequest) => {
  const key = request.nextUrl.searchParams.get("key");
  if (!key || !key.startsWith("editor-assets/")) {
    return null;
  }
  return key;
};

const assetResponseHeaders = (
  key: string,
  file: {
    contentType?: string;
    contentLength?: number;
    contentRange?: string;
    acceptRanges?: string;
  },
  status: number,
) => ({
  "Content-Type": resolveMediaContentType(key, file.contentType),
  ...(file.contentLength ? { "Content-Length": String(file.contentLength) } : {}),
  ...(file.contentRange ? { "Content-Range": file.contentRange } : {}),
  "Accept-Ranges": file.acceptRanges || "bytes",
  "Content-Disposition": "inline",
  "Cache-Control": "public, max-age=31536000, immutable",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  ...(status === 206 ? {} : {}),
});

export async function HEAD(request: NextRequest) {
  const key = assetKeyFromRequest(request);
  if (!key) {
    return NextResponse.json(
      { error: "Invalid editor asset key" },
      { status: 400 },
    );
  }

  const cached = getUploadedAssetCache(key);
  if (cached) {
    return new NextResponse(null, {
      status: 200,
      headers: assetResponseHeaders(
        key,
        {
          contentType: cached.contentType,
          contentLength: cached.contentLength,
          acceptRanges: "bytes",
        },
        200,
      ),
    });
  }

  const file = await S3Storage.headObject(key);
  if (!file) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: assetResponseHeaders(key, file, 200),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request: NextRequest) {
  const key = assetKeyFromRequest(request);
  if (!key) {
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

  const status = range && file.contentRange ? 206 : 200;

  return new NextResponse(file.body, {
    status,
    headers: assetResponseHeaders(key, file, status),
  });
}
