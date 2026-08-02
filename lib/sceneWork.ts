import { useAppStore } from "@/store/useAppStore";

function canTrackSceneWork(): boolean {
  return !useAppStore.getState().isLoadingModel;
}

/** Mark start of synchronous or async 3D work (ref-counted). */
export function startSceneWork(): void {
  if (!canTrackSceneWork()) return;
  useAppStore.getState().beginSceneBusy();
}

/** Mark end of one 3D work unit; hides spinner when all units finish. */
export function finishSceneWork(): void {
  useAppStore.getState().endSceneBusy();
}

/** Wrap sync scene rebuild — ends after the next frame is painted. Returns cleanup. */
export function runSceneWork(fn: () => void): () => void {
  if (!canTrackSceneWork()) {
    fn();
    return () => {};
  }
  startSceneWork();
  let cancelled = false;
  try {
    fn();
  } finally {
    requestAnimationFrame(() => {
      if (!cancelled) finishSceneWork();
    });
  }
  return () => {
    cancelled = true;
    finishSceneWork();
  };
}
