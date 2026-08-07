"use client";

import { t, type UiTextKey } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

const LABEL: Record<string, UiTextKey> = {
  wall: "layoutWall",
  door: "layoutDoor",
  window: "layoutWindow",
  floor: "layoutFloor",
  roof: "layoutRoof",
  cube: "markupShape_cube",
  sphere: "markupShape_sphere",
  cylinder: "markupShape_cylinder",
  cone: "markupShape_cone",
  torus: "markupShape_torus",
  capsule: "markupShape_capsule",
  pyramid: "markupShape_pyramid",
  note: "markupShape_note",
  measure: "markupMeasure",
};

/**
 * Floating mode pill that follows the pointer while a placement tool is armed.
 */
export default function ToolModeCursorHud({
  x,
  y,
}: {
  x: number;
  y: number;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const armedLayout = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const setArmedLayout = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const finishWallDraw = useLayoutDrawingStore((s) => s.finishWallDraw);
  const cancelSlabDraw = useLayoutDrawingStore((s) => s.cancelSlabDraw);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const slabDraw = useLayoutDrawingStore((s) => s.slabDraw);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const measureMode = useToolMarkupStore((s) => s.measureMode);
  const setMeasureMode = useToolMarkupStore((s) => s.setMeasureMode);
  const setCubeDraw = useToolMarkupStore((s) => s.setCubeDraw);

  const mode =
    measureMode
      ? "measure"
      : armedLayout ?? armedTool ?? null;
  if (!mode) return null;

  const label = t(uiLanguage, LABEL[mode] ?? "tool");

  const exit = () => {
    if (wallDraw) finishWallDraw();
    if (slabDraw) cancelSlabDraw();
    useLayoutDrawingStore.getState().clearTracePreview();
    setArmedLayout(null);
    setArmedTool(null);
    setCubeDraw(null);
    setMeasureMode(false);
  };

  return (
    <div
      className="pointer-events-none fixed z-[39] flex -translate-y-1/2 items-center gap-1"
      style={{ left: x + 18, top: y }}
    >
      <span className="tool-glass rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-[var(--text-strong)]">
        {label}
      </span>
      <button
        type="button"
        onClick={exit}
        className="pointer-events-auto rounded-full border border-white/40 bg-zinc-900/80 px-2 py-1 text-[9px] font-semibold text-white shadow-md backdrop-blur-md hover:bg-zinc-800"
      >
        {t(uiLanguage, "markupExitTool")}
      </button>
    </div>
  );
}
