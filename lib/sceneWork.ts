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

/**
 * Wrap sync scene rebuild.
 * Defers work by two frames so the spinner can paint before blocking the main thread.
 */
export function runSceneWork(fn: () => void): () => void {
  if (!canTrackSceneWork()) {
    fn();
    return () => {};
  }
  startSceneWork();
  let cancelled = false;
  let paintId = 0;
  let workId = 0;
  let finishId = 0;

  paintId = requestAnimationFrame(() => {
    if (cancelled) {
      finishSceneWork();
      return;
    }
    workId = requestAnimationFrame(() => {
      if (cancelled) {
        finishSceneWork();
        return;
      }
      try {
        fn();
      } finally {
        finishId = requestAnimationFrame(() => {
          if (!cancelled) finishSceneWork();
        });
      }
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(paintId);
    cancelAnimationFrame(workId);
    cancelAnimationFrame(finishId);
    finishSceneWork();
  };
}
