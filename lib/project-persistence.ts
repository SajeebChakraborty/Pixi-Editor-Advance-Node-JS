import { supabase } from "./supabase";
import {
  useEditorStore,
  type CanvasState,
  type EditorMode,
  type Layer,
  type PersistedEditorState,
} from "./store";

const DRAFT_KEY = "pixigen-editor-draft-v1";
const PROJECT_ID_KEY = "pixigen-editor-project-id";
const SAVE_DEBOUNCE_MS = 900;

type PersistedProjectEnvelope = {
  savedAt: string;
  projectId: string | null;
  state: PersistedEditorState;
};

const withoutFabricCanvas = (
  canvas: CanvasState,
): Omit<CanvasState, "fabricCanvas"> => {
  const { fabricCanvas: _fabricCanvas, ...serializable } = canvas;
  return serializable;
};

const getObjectState = (object: any) => ({
  left: object.left,
  top: object.top,
  width: object.width,
  height: object.height,
  scaleX: object.scaleX,
  scaleY: object.scaleY,
  angle: object.angle,
  flipX: object.flipX,
  flipY: object.flipY,
  opacity: object.opacity,
  visible: object.visible,
  cropX: object.cropX,
  cropY: object.cropY,
  stroke: object.stroke,
  strokeWidth: object.strokeWidth,
  originX: object.originX,
  originY: object.originY,
});

const withLiveObjectState = (
  canvas: CanvasState,
  liveCanvas: CanvasState["fabricCanvas"],
) => {
  if (!liveCanvas) return withoutFabricCanvas(canvas);
  const objectsByName = new Map<string, any>();
  liveCanvas.getObjects().forEach((object: any) => {
    if (typeof object.name === "string") {
      objectsByName.set(object.name, object);
    }
  });

  return {
    ...withoutFabricCanvas(canvas),
    pages: canvas.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer): Layer => {
        const object = layer.objectId
          ? objectsByName.get(layer.objectId)
          : undefined;
        if (!object) return layer;
        return {
          ...layer,
          data: {
            ...(layer.data || {}),
            fabric: getObjectState(object),
          },
        };
      }),
    })),
  };
};

export const getEditorProjectId = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("projectId") ||
    params.get("project_id") ||
    window.localStorage.getItem(PROJECT_ID_KEY)
  );
};

export const serializeEditorProject = (): PersistedEditorState => {
  const state = useEditorStore.getState();
  const activeMode = state.editorMode;
  const photoCanvas =
    activeMode === "photo" ? state.canvas : state.photoCanvasState;
  const videoCanvas =
    activeMode === "video" ? state.canvas : state.videoCanvasState;

  return {
    version: 1,
    editorMode: activeMode,
    photoCanvasState: withLiveObjectState(
      photoCanvas,
      activeMode === "photo" ? state.canvas.fabricCanvas : null,
    ),
    videoCanvasState: withLiveObjectState(
      videoCanvas,
      state.videoFabricCanvas,
    ),
    videoState: state.videoState,
    photoRecentAssets: state.photoRecentAssets.filter(
      (asset) => !asset.url.startsWith("blob:"),
    ),
    videoRecentAssets: state.videoRecentAssets.filter(
      (asset) => !asset.url.startsWith("blob:"),
    ),
  };
};

const isPersistedState = (value: any): value is PersistedEditorState =>
  value?.version === 1 &&
  (value.editorMode === "photo" || value.editorMode === "video") &&
  Array.isArray(value.photoCanvasState?.pages) &&
  Array.isArray(value.videoCanvasState?.pages);

const readLocalDraft = (): PersistedProjectEnvelope | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    return isPersistedState(parsed?.state) ? parsed : null;
  } catch {
    return null;
  }
};

export const restoreEditorProject = async () => {
  if (typeof window === "undefined") return false;

  const projectId = getEditorProjectId();
  const localDraft = readLocalDraft();
  if (localDraft) {
    useEditorStore.getState().restoreProjectState(localDraft.state);
  }

  const loadRemote = async () => {
    if (!projectId) return false;
    const { data } = await supabase
      .from("projects")
      .select("canvas_data, updated_at")
      .eq("id", projectId)
      .maybeSingle();
    if (!isPersistedState(data?.canvas_data)) return false;

    const remoteUpdatedAt = Date.parse(data.updated_at || "") || 0;
    const localUpdatedAt = Date.parse(localDraft?.savedAt || "") || 0;
    if (!localDraft || remoteUpdatedAt >= localUpdatedAt) {
      useEditorStore.getState().restoreProjectState(data.canvas_data);
    }
    return true;
  };

  if (localDraft) {
    return true;
  }

  return loadRemote();
};

const saveRemoteDraft = async (
  state: PersistedEditorState,
  projectId: string | null,
) => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return projectId;

  if (projectId) {
    const { error } = await supabase
      .from("projects")
      .update({
        name:
          state.editorMode === "video"
            ? state.videoCanvasState.name
            : state.photoCanvasState.name,
        canvas_data: state,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
    if (!error) return projectId;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name:
        state.editorMode === "video"
          ? state.videoCanvasState.name
          : state.photoCanvasState.name,
      canvas_data: state,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[EDITOR_AUTOSAVE]", error.message);
    return projectId;
  }

  window.localStorage.setItem(PROJECT_ID_KEY, data.id);
  return data.id as string;
};

export const startEditorAutosave = () => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let projectId = getEditorProjectId();

  const save = async () => {
    const state = serializeEditorProject();
    const envelope: PersistedProjectEnvelope = {
      savedAt: new Date().toISOString(),
      projectId,
      state,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
    projectId = await saveRemoteDraft(state, projectId);
  };

  const unsubscribe = useEditorStore.subscribe(() => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  });

  const handlePageHide = () => {
    const state = serializeEditorProject();
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        projectId,
        state,
      } satisfies PersistedProjectEnvelope),
    );
  };
  window.addEventListener("pagehide", handlePageHide);

  return () => {
    unsubscribe();
    if (timeoutId) clearTimeout(timeoutId);
    handlePageHide();
    window.removeEventListener("pagehide", handlePageHide);
  };
};

export const getPersistedLayerObjectState = (layer: Layer) =>
  layer.data?.fabric as Record<string, unknown> | undefined;

export const isPermanentEditorUrl = (url: string) =>
  !url.startsWith("blob:") && !url.startsWith("data:");

export const modeForAssetType = (type: "image" | "video" | "audio"): EditorMode =>
  type === "image" ? "photo" : "video";
