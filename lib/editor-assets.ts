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

export const uploadEditorAsset = async (
  file: File,
  type: Asset["type"],
  projectId?: string | null,
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  if (projectId) formData.append("projectId", projectId);

  const response = await fetch("/api/assets/upload", {
    method: "POST",
    body: formData,
  });
  const result = await parseUploadResponse(response);
  if (!response.ok || !result?.url) {
    throw new Error(result?.error || "Asset upload failed");
  }

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
