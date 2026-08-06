/**
 * Viewer-wide keyboard-shortcut plumbing: the custom event name used to
 * request the IFC file picker from a global hotkey, and a guard that
 * detects whether a keydown should be left alone for a focused text field.
 */

/** Dispatched by Ctrl+O / Ctrl+N — HeaderActions opens the IFC file picker. */
export const OPEN_IFC_FILE_EVENT = "ifc-viewer:open-ifc-file";

/** True when keyboard input should stay in the focused field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}
