import type { Asset } from "./store";
import { supabase } from "./supabase";
import { verifyEditorAssetAvailable } from "./video-loader";

const PRESIGN_TIMEOUT_MS = 30_000;
const MIN_UPLOAD_TIMEOUT_MS = 120_000;
const MAX_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_DIRECT_UPLOAD_ATTEMPTS = 3;

const parseUploadResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const body = await response.text();
  return {
    success: false,
    error:
      response.status === 413
        ? "Upload is too large for the production server. Please use a smaller file."
        : body.trim() || `Upload failed with status ${response.status}`,
  };
};

const computeUploadTimeoutMs = (fileSize: number) => {
  const scaled = Math.ceil(fileSize / (512 * 1024)) * 1000;
  return Math.min(
    MAX_UPLOAD_TIMEOUT_MS,
    Math.max(MIN_UPLOAD_TIMEOUT_MS, scaled),
  );
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Upload request timed out. Please check your connection and try again.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const putFileToPresignedUrl = (
  uploadUrl: string,
  file: File,
  contentType: string,
  timeoutMs: number,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      xhr.abort();
      finish(
        new Error(
          "Video upload timed out. Try a smaller file or a more stable connection.",
        ),
      );
    }, timeoutMs);

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish();
        return;
      }
      finish(
        new Error(
          xhr.responseText?.trim() ||
            `Storage upload failed with status ${xhr.status}`,
        ),
      );
    };
    xhr.onerror = () => {
      finish(
        new Error(
          "Network error while uploading to storage. Check your connection and try again.",
        ),
      );
    };
    xhr.onabort = () => {
      if (!settled) {
        finish(new Error("Video upload was interrupted."));
      }
    };
    xhr.send(file);
  });

const requestPresignedUpload = async (file: File, type: Asset["type"]) => {
  const presignResponse = await fetchWithTimeout(
    "/api/assets/presign",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        type,
      }),
    },
    PRESIGN_TIMEOUT_MS,
  );
  const presignResult = await parseUploadResponse(presignResponse);
  if (!presignResponse.ok || !presignResult?.uploadUrl) {
    throw new Error(presignResult?.error || "Could not prepare upload");
  }

  return presignResult as {
    success: true;
    uploadUrl: string;
    url: string;
    key: string;
    contentType: string;
  };
};

const uploadFileToStorage = async (file: File, type: Asset["type"]) => {
  const uploadTimeoutMs = computeUploadTimeoutMs(file.size);
  let presignResult = await requestPresignedUpload(file, type);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_DIRECT_UPLOAD_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      presignResult = await requestPresignedUpload(file, type);
    }

    const contentType =
      presignResult.contentType || file.type || "application/octet-stream";

    try {
      await putFileToPresignedUrl(
        presignResult.uploadUrl,
        file,
        contentType,
        uploadTimeoutMs,
      );
      lastError = null;
      break;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Storage upload failed");
      if (attempt >= MAX_DIRECT_UPLOAD_ATTEMPTS - 1) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (type === "video") {
    await verifyEditorAssetAvailable(presignResult.url, { fileSize: file.size });
  }

  return presignResult as {
    success: true;
    url: string;
    key: string;
    uploadUrl: string;
    contentType: string;
  };
};

export const uploadEditorAsset = async (
  file: File,
  type: Asset["type"],
  projectId?: string | null,
) => {
  const result = await uploadFileToStorage(file, type);

  let authUser: { id: string } | null = null;
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { user: null } }), 8000),
      ),
    ]);
    authUser = authResult.data.user;
  } catch {
    // Asset upload already succeeded; do not block the editor on auth lookup.
  }

  let asset: unknown = null;
  if (authUser) {
    const { data, error } = await supabase
      .from("assets")
      .insert({
        name: file.name,
        type,
        category: "editor-upload",
        url: result.url,
        file_size: file.size,
        is_public: false,
        user_id: authUser.id,
        project_id: projectId || null,
      })
      .select()
      .maybeSingle();
    if (error) {
      console.warn("[EDITOR_ASSET_DB]", error.message);
    } else {
      asset = data;
    }
  }

  return {
    ...(result as {
      success: true;
      url: string;
      key: string;
    }),
    asset,
  };
};

export const uploadEditorDataUrl = async (
  dataUrl: string,
  type: Asset["type"],
  name = `${type}-${Date.now()}`,
  projectId?: string | null,
) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
  return uploadEditorAsset(
    new File([blob], `${name}.${extension}`, { type: blob.type }),
    type,
    projectId,
  );
};
