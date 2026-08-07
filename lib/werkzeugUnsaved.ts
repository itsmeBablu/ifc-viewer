/**
 * Detect unsaved Werkzeug markup / layout work for leave & refresh guards.
 */

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export function hasUnsavedWerkzeugWork(): boolean {
  const m = useToolMarkupStore.getState();
  const l = useLayoutDrawingStore.getState();

  const hasContent =
    m.placements.length > 0 ||
    m.notes.length > 0 ||
    m.measurements.length > 0 ||
    l.walls.length > 0 ||
    l.doors.length > 0 ||
    l.windows.length > 0 ||
    l.wallDraw != null ||
    l.levels.length > 1;

  if (!hasContent) return false;
  if (m.lastSavedAt == null) return true;

  const markupTouch = Math.max(
    0,
    m.contentTouchedAt,
    ...m.placements.map((p) => p.updatedAt),
    ...m.notes.map((n) => n.updatedAt),
  );
  const touch = Math.max(markupTouch, l.lastMutatedAt);
  return touch > m.lastSavedAt;
}

/** Returns true if the caller should proceed (user confirmed or nothing to save). */
export function confirmLeaveWerkzeug(message: string): boolean {
  if (!hasUnsavedWerkzeugWork()) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
