import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "@/lib/storage-s3";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || `pixizen-export-${Date.now()}.bin`;

    if (!key && !url) {
      return new NextResponse("Missing storage key or URL", { status: 400 });
    }

    if (key) {
      const file = await S3Storage.getFile(key);
      if (!file) {
        return new NextResponse("Failed to read file from storage", { status: 502 });
      }

      return new NextResponse(file.body, {
        status: 200,
        headers: {
          "Content-Type": file.contentType || "application/octet-stream",
          ...(file.contentLength !== undefined
            ? { "Content-Length": String(file.contentLength) }
            : {}),
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const response = await fetch(url!);
    if (!response.ok || !response.body) {
      return new NextResponse("Failed to fetch file", { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[DOWNLOAD_ROUTE_ERROR]", error);
    return new NextResponse("Download failed", { status: 500 });
  }
}
