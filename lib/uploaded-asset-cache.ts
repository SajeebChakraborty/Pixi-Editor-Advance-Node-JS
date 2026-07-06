type CachedAsset = {
  contentType: string;
  contentLength: number;
  uploadedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const recentlyUploaded = new Map<string, CachedAsset>();

const pruneExpired = () => {
  const now = Date.now();
  for (const [key, entry] of recentlyUploaded) {
    if (now - entry.uploadedAt > CACHE_TTL_MS) {
      recentlyUploaded.delete(key);
    }
  }
};

/** Mark an object as uploaded so HEAD/GET can respond without a slow S3 round-trip. */
export const markUploadedAsset = (
  key: string,
  meta: { contentType: string; contentLength: number },
) => {
  pruneExpired();
  recentlyUploaded.set(key, {
    contentType: meta.contentType,
    contentLength: meta.contentLength,
    uploadedAt: Date.now(),
  });
};

export const getUploadedAssetCache = (key: string): CachedAsset | null => {
  const entry = recentlyUploaded.get(key);
  if (!entry) return null;
  if (Date.now() - entry.uploadedAt > CACHE_TTL_MS) {
    recentlyUploaded.delete(key);
    return null;
  }
  return entry;
};
