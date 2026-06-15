const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export const resolveMediaContentType = (
  fileName: string,
  suppliedContentType?: string | null,
) => {
  const supplied = suppliedContentType?.trim().toLowerCase();
  if (supplied && supplied !== "application/octet-stream") {
    return suppliedContentType as string;
  }

  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return CONTENT_TYPES[extension] || suppliedContentType || "application/octet-stream";
};
