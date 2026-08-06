/**
 * Small input/viewport helpers for hover-capable UI: detecting a true
 * hover-capable pointer (vs. touch) and clamping a popover's horizontal
 * position so it stays within the viewport.
 */

/** True when the primary input supports hover (desktop mouse/trackpad). */
export function canHover(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Clamp a popover center-x so a panel of `width` px stays inside the viewport. */
export function clampPopoverCenterX(centerX: number, width: number, pad = 10): number {
  const half = width / 2;
  const min = pad + half;
  const max = window.innerWidth - pad - half;
  if (max <= min) return window.innerWidth / 2;
  return Math.min(max, Math.max(min, centerX));
}
