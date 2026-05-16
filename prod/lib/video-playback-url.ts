/**
 * Normalize video src for <video> elements.
 * External http(s) URLs go through same-origin proxy so Range requests + canvas paint work reliably.
 * Do not set crossOrigin="anonymous" for blob:, data:, or same-origin (/...) URLs — it breaks many MP4 loads.
 */
export function resolveVideoPlaybackUrl(url: string | null | undefined): string {
  if (url == null) return "";
  const t = String(url).trim();
  if (!t) return "";
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (t.startsWith("/")) return t;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    return `/api/proxy?url=${encodeURIComponent(t)}`;
  }
  return t;
}

/** Only use when loading a remote URL directly (no proxy). */
export function videoNeedsCrossOrigin(resolvedSrc: string): boolean {
  return /^https?:\/\//i.test(resolvedSrc);
}
