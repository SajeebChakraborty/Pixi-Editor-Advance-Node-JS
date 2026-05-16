import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || `pixizen-export-${Date.now()}.bin`;

    if (!url) {
      return new NextResponse("Missing url", { status: 400 });
    }

    const response = await fetch(url);
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
