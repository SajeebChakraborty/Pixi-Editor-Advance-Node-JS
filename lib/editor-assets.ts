import type { Asset } from "./store";
import { supabase } from "./supabase";

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

const uploadFileToStorage = async (file: File, type: Asset["type"]) => {
  const presignResponse = await fetch("/api/assets/presign", {
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
  });
  const presignResult = await parseUploadResponse(presignResponse);
  if (!presignResponse.ok || !presignResult?.uploadUrl) {
    throw new Error(presignResult?.error || "Could not prepare upload");
  }

  const uploadResponse = await fetch(presignResult.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": presignResult.contentType || file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      errorText.trim() ||
        `Storage upload failed with status ${uploadResponse.status}`,
    );
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

  const { data: authData } = await supabase.auth.getUser();
  let asset: unknown = null;
  if (authData.user) {
    const { data, error } = await supabase
      .from("assets")
      .insert({
        name: file.name,
        type,
        category: "editor-upload",
        url: result.url,
        file_size: file.size,
        is_public: false,
        user_id: authData.user.id,
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
