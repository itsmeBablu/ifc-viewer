/** Werkzeug dock layout — isolated from the main viewer store. */

export const TOOL_RIGHT_PANEL_MIN_PX = 280;
export const TOOL_RIGHT_PANEL_MAX_PX = 560;
export const TOOL_RIGHT_PANEL_DEFAULT_PX = 360;
export const TOOL_RIGHT_PANEL_PEEK_PX = 20;

const TOOL_RIGHT_WIDTH_KEY = "ifc-viewer:werkzeugRightPanelWidthPx";

export function clampToolRightPanelWidth(px: number, vw = 1024): number {
  const max = Math.min(
    TOOL_RIGHT_PANEL_MAX_PX,
    Math.max(TOOL_RIGHT_PANEL_MIN_PX, Math.floor(vw * 0.48)),
  );
  return Math.round(Math.min(max, Math.max(TOOL_RIGHT_PANEL_MIN_PX, px)));
}

export function readToolRightPanelWidthPx(): number {
  if (typeof window === "undefined") return TOOL_RIGHT_PANEL_DEFAULT_PX;
  try {
    const raw = localStorage.getItem(TOOL_RIGHT_WIDTH_KEY);
    const n = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(n)) return clampToolRightPanelWidth(n);
  } catch {
    // ignore
  }
  return TOOL_RIGHT_PANEL_DEFAULT_PX;
}

export function persistToolRightPanelWidthPx(px: number): void {
  try {
    localStorage.setItem(TOOL_RIGHT_WIDTH_KEY, String(px));
  } catch {
    // ignore
  }
}
