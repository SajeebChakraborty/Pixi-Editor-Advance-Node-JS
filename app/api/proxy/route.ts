import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("URL is required", { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for larger video files

    let fetchUrl = url;
    let referer = "";

    try {
      if (url.startsWith("http")) {
        referer = new URL(url).origin;
      } else if (url.startsWith("/")) {
        // Construct the full internal URL if it's a relative path
        const host = req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        fetchUrl = `${protocol}://${host}${url}`;
      }
    } catch { }

    const requestRange = req.headers.get("range");

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "video/*,image/*,*/*;q=0.8",
        "Referer": referer,
        ...(requestRange ? { "Range": requestRange } : {}),
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");
    const body = response.body;

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        ...(acceptRanges ? { "Accept-Ranges": acceptRanges } : { "Accept-Ranges": "bytes" }),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(`[PROXY ERROR] URL: ${url}`, error);
    return new NextResponse(`Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
