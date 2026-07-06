import type { Asset } from "./store";
import { supabase } from "./supabase";
import { enqueueEditorUpload } from "./editor-upload-queue";
import { resolveMediaContentType } from "./media-content-type";

const PRESIGN_TIMEOUT_MS = 90_000;
const SERVER_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_VIDEO_UPLOAD_TIMEOUT_MS = 120_000;
const MAX_VIDEO_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_STRATEGY = 3;
const RETRY_DELAY_MS = 1_200;

const MAX_UPLOAD_BYTES: Record<"image" | "video" | "audio", number> = {
  image: 15 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
};

type UploadResult = {
  success: true;
  url: string;
  key: string;
  uploadUrl?: string;
  contentType?: string;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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
    MAX_VIDEO_UPLOAD_TIMEOUT_MS,
    Math.max(MIN_VIDEO_UPLOAD_TIMEOUT_MS, scaled),
  );
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
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
        `${label} timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const uploadWithXhr = (
  url: string,
  init: {
    method: "PUT" | "POST";
    body: BodyInit;
    contentType?: string;
    timeoutMs: number;
    label: string;
  },
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
          `${init.label} timed out after ${Math.round(init.timeoutMs / 1000)}s.`,
        ),
      );
    }, init.timeoutMs);

    xhr.open(init.method, url);
    if (init.contentType) {
      xhr.setRequestHeader("Content-Type", init.contentType);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish();
        return;
      }
      finish(
        new Error(
          xhr.responseText?.trim() ||
            `${init.label} failed with status ${xhr.status}`,
        ),
      );
    };
    xhr.onerror = () => {
      finish(new Error(`${init.label} failed due to a network error.`));
    };
    xhr.onabort = () => {
      if (!settled) {
        finish(new Error(`${init.label} was interrupted.`));
      }
    };
    xhr.send(init.body as XMLHttpRequestBodyInit);
  });

const withRetries = async <T>(
  label: string,
  task: () => Promise<T>,
  attempts = MAX_ATTEMPTS_PER_STRATEGY,
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }

    try {
      return await task();
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(`${label} failed`);
      console.warn(`[UPLOAD] ${label} attempt ${attempt + 1}/${attempts} failed`, lastError);
    }
  }

  throw lastError || new Error(`${label} failed`);
};

const uploadViaServerApi = async (
  file: File,
  type: Asset["type"],
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const timeoutMs = Math.min(
    SERVER_UPLOAD_TIMEOUT_MS,
    Math.max(90_000, Math.ceil(file.size / (384 * 1024)) * 1000),
  );

  const responseText = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (error?: Error, text = "") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (error) {
        reject(error);
        return;
      }
      resolve(text);
    };

    const timeoutId = window.setTimeout(() => {
      xhr.abort();
      finish(
        new Error(
          `Server upload timed out after ${Math.round(timeoutMs / 1000)}s.`,
        ),
      );
    }, timeoutMs);

    xhr.open("POST", "/api/assets/upload");
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(undefined, xhr.responseText);
        return;
      }
      finish(
        new Error(
          xhr.responseText?.trim() ||
            `Server upload failed with status ${xhr.status}`,
        ),
      );
    };
    xhr.onerror = () => {
      finish(new Error("Server upload failed due to a network error."));
    };
    xhr.onabort = () => {
      if (!settled) {
        finish(new Error("Server upload was interrupted."));
      }
    };
    xhr.send(formData);
  });

  let result: { success?: boolean; url?: string; key?: string; error?: string };
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error("Upload server returned an invalid response.");
  }

  if (!result?.url || !result?.key) {
    throw new Error(result?.error || "Server upload failed");
  }

  return {
    success: true,
    url: result.url,
    key: result.key,
  };
};

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
    "Preparing upload",
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

const uploadViaPresignedUrl = async (
  file: File,
  type: Asset["type"],
): Promise<UploadResult> => {
  const presignResult = await requestPresignedUpload(file, type);
  const contentType =
    presignResult.contentType ||
    resolveMediaContentType(file.name, file.type) ||
    file.type ||
    "application/octet-stream";

  await uploadWithXhr(presignResult.uploadUrl, {
    method: "PUT",
    body: file,
    contentType,
    timeoutMs: computeUploadTimeoutMs(file.size),
    label: "Cloud storage upload",
  });

  return {
    success: true,
    url: presignResult.url,
    key: presignResult.key,
    uploadUrl: presignResult.uploadUrl,
    contentType,
  };
};

const assertUploadable = (file: File, type: Asset["type"]) => {
  const maxBytes = MAX_UPLOAD_BYTES[type as keyof typeof MAX_UPLOAD_BYTES];
  if (!maxBytes) {
    throw new Error(`Unsupported upload type: ${type}`);
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("Selected file is empty.");
  }
  if (file.size > maxBytes) {
    throw new Error(
      `File is too large. Maximum ${type} upload is ${Math.floor(maxBytes / 1024 / 1024)}MB.`,
    );
  }
};

const uploadFileToStorage = async (
  file: File,
  type: Asset["type"],
): Promise<UploadResult> => {
  assertUploadable(file, type);

  // Server upload is primary for every type: one hop through our API avoids
  // presign timeouts, browser connection limits, and S3 CORS issues in dev.
  const strategies: Array<{
    name: string;
    run: () => Promise<UploadResult>;
  }> = [
    {
      name: "server upload",
      run: () => uploadViaServerApi(file, type),
    },
    {
      name: "direct cloud upload",
      run: () => uploadViaPresignedUrl(file, type),
    },
  ];

  const errors: string[] = [];

  for (const strategy of strategies) {
    try {
      return await withRetries(
        strategy.name,
        strategy.run,
        MAX_ATTEMPTS_PER_STRATEGY,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `${strategy.name} failed`;
      errors.push(message);
    }
  }

  throw new Error(
    errors.length > 0
      ? errors[errors.length - 1]
      : "Upload failed. Please try again.",
  );
};

const saveAssetMetadata = async (
  file: File,
  type: Asset["type"],
  result: UploadResult,
  projectId?: string | null,
) => {
  let authUser: { id: string } | null = null;
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        window.setTimeout(() => resolve({ data: { user: null } }), 5000),
      ),
    ]);
    authUser = authResult.data.user;
  } catch {
    // Storage upload already succeeded.
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

  return asset;
};

export const uploadEditorAsset = (
  file: File,
  type: Asset["type"],
  projectId?: string | null,
) =>
  enqueueEditorUpload(async () => {
    const result = await uploadFileToStorage(file, type);
    const asset = await saveAssetMetadata(file, type, result, projectId);

    return {
      url: result.url,
      key: result.key,
      asset,
    };
  });

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
