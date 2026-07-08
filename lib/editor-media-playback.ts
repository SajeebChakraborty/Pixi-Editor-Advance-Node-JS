export type MediaPlaybackSyncOptions = {
  playing: boolean;
  isMuted: boolean;
  volume: number;
  fromUserGesture?: boolean;
};

type MediaPlaybackHandler = (options: MediaPlaybackSyncOptions) => void;

let playbackHandler: MediaPlaybackHandler | null = null;
let safariAudioUnlocked = false;

export const isSafariBrowser = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios/i.test(ua);
};

export const registerEditorMediaPlaybackHandler = (
  handler: MediaPlaybackHandler,
) => {
  playbackHandler = handler;
  return () => {
    if (playbackHandler === handler) {
      playbackHandler = null;
    }
  };
};

export const syncEditorMediaPlayback = (options: MediaPlaybackSyncOptions) => {
  playbackHandler?.(options);
};

/** Safari requires play() inside a user gesture; start muted then restore volume. */
export const playMediaElementForGesture = async (
  element: HTMLMediaElement,
  options: MediaPlaybackSyncOptions,
  forceMuted = false,
) => {
  if (!options.playing) {
    element.pause();
    return;
  }

  if (!options.fromUserGesture || !isSafariBrowser()) {
    try {
      await element.play();
    } catch {
      // Effect-driven playback may retry on the next sync tick.
    }
    return;
  }

  const shouldStayMuted = options.isMuted || forceMuted;
  const previousMuted = element.muted;
  element.muted = true;

  try {
    await element.play();
    safariAudioUnlocked = true;
    element.muted = shouldStayMuted;
    if (!element.muted) {
      element.volume = Math.min(1, Math.max(0, options.volume));
    }
  } catch {
    element.muted = previousMuted;
  }
};

export const hasSafariAudioUnlocked = () => safariAudioUnlocked;
