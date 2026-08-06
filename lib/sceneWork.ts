/**
 * Ref-counted "scene busy" tracking for expensive 3D rebuilds.
 *
 * Wraps synchronous or async viewer work so the busy overlay (in
 * useAppStore) can paint before the main thread blocks, and clears once all
 * in-flight units finish. No-ops while a model is already loading.
 */
import { useAppStore } from "@/store/useAppStore";

function canTrackSceneWork(): boolean {
  return !useAppStore.getState().isLoadingModel;
}

function showSceneBusyNow(): void {
  useAppStore.getState().showSceneBusyNow();
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

type PaintedWorkHandle = {
  cancel: () => void;
};

/** Let React paint the busy overlay, then run work on a later task. */
function schedulePaintedSceneWork(
  run: () => void,
  onCleanup: () => void,
): PaintedWorkHandle {
  let cancelled = false;
  let frameId = 0;
  let timeoutId = 0;

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frameId);
    clearTimeout(timeoutId);
    onCleanup();
  };

  frameId = requestAnimationFrame(() => {
    if (cancelled) return;
    showSceneBusyNow();
    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      run();
    }, 0);
  });

  return { cancel };
}

/**
 * Defer scene work until the busy overlay can paint (for paired start/finish).
 * Caller must call finishSceneWork when async work completes.
 */
export function deferPaintedSceneWork(run: () => void): () => void {
  if (!canTrackSceneWork()) {
    run();
    return () => {};
  }
  startSceneWork();
  const handle = schedulePaintedSceneWork(run, finishSceneWork);
  return handle.cancel;
}

/** Wrap sync scene rebuild — shows spinner first, ends after the next frame. */
export function runSceneWork(fn: () => void): () => void {
  if (!canTrackSceneWork()) {
    fn();
    return () => {};
  }
  startSceneWork();
  let finishId = 0;
  const handle = schedulePaintedSceneWork(
    () => {
      try {
        fn();
      } finally {
        finishId = requestAnimationFrame(() => finishSceneWork());
      }
    },
    () => {
      cancelAnimationFrame(finishId);
      finishSceneWork();
    },
  );
  return handle.cancel;
}
