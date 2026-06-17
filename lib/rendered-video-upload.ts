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
        ? "Rendered video is too large for the configured upload limit."
        : body.trim() || `Upload failed with status ${response.status}`,
  };
};

export const uploadRenderedVideo = async (
  blob: Blob,
  extension: "mp4" | "webm",
  contentType: string,
) => {
  const presignResponse = await fetch("/api/rendered-video/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      size: blob.size,
      extension,
      contentType,
    }),
  });

  const presignResult = await parseUploadResponse(presignResponse);
  if (!presignResponse.ok || !presignResult?.uploadUrl) {
    throw new Error(presignResult?.error || "Could not prepare video upload");
  }

  const uploadResponse = await fetch(presignResult.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": presignResult.contentType || contentType,
    },
    body: blob,
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
    extension: "mp4" | "webm";
  };
};
