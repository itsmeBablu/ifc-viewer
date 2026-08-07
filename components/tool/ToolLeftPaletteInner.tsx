"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HoverTip from "@/components/common/HoverTip";
import { t, type UiTextKey } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  IconMarkupCube,
  IconMarkupNote,
  IconMarkupWall,
  LAYOUT_TOOL_ICONS,
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

type FlyoutId = "layout" | "shapes" | "pin" | null;

const SHAPE_IDS = MARKUP_TOOL_ORDER.filter(isShapeTool);

const LAYOUT_TOOLS: {
  id: "wall" | "door" | "window" | "floor" | "roof";
  labelKey: UiTextKey;
  hintKey: UiTextKey;
}[] = [
  { id: "wall", labelKey: "layoutWall", hintKey: "layoutHint_wall" },
  { id: "door", labelKey: "layoutDoor", hintKey: "layoutHint_door" },
  { id: "window", labelKey: "layoutWindow", hintKey: "layoutHint_window" },
  { id: "floor", labelKey: "layoutFloor", hintKey: "layoutHint_floor" },
  { id: "roof", labelKey: "layoutRoof", hintKey: "layoutHint_roof" },
];

const TOOL_LABEL: Record<string, UiTextKey> = {
  cube: "markupShape_cube",
  sphere: "markupShape_sphere",
  cylinder: "markupShape_cylinder",
  cone: "markupShape_cone",
  torus: "markupShape_torus",
  capsule: "markupShape_capsule",
  pyramid: "markupShape_pyramid",
  note: "markupShape_note",
};

const TOOL_HINT: Record<string, UiTextKey> = {
  cube: "markupHint_cube",
  sphere: "markupHint_sphere",
  cylinder: "markupHint_cylinder",
  cone: "markupHint_cone",
  torus: "markupHint_torus",
  capsule: "markupHint_capsule",
  pyramid: "markupHint_pyramid",
  note: "markupHint_note",
};

const stripBtn =
  "flex h-10 w-10 items-center justify-center rounded-xl border transition duration-150";
const stripIdle =
  "border-[var(--panel-divider)] bg-[var(--surface-muted)]/60 text-[var(--text-body)] hover:border-amber-200/70 hover:bg-amber-50/80";
const stripOn =
  "border-amber-300/80 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const stripSkyOn =
  "border-sky-300/80 bg-gradient-to-br from-sky-200/95 via-sky-300/80 to-sky-400/70 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";

/**
 * Thin left icon strip ÔÇö category icons open a flyout grid (like the color swatch).
 */
export default function ToolLeftPaletteInner({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const projectId = useLayoutDrawingStore((s) => s.projectId);
  const armedLayout = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const setArmedLayout = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const presets = useLayoutDrawingStore((s) => s.presets);
  const draftWallThicknessMm = useLayoutDrawingStore(
    (s) => s.draftWallThicknessMm,
  );
  const setDraftWallThicknessMm = useLayoutDrawingStore(
    (s) => s.setDraftWallThicknessMm,
  );
  const draftDoorWidthMm = useLayoutDrawingStore((s) => s.draftDoorWidthMm);
  const draftDoorHeightMm = useLayoutDrawingStore((s) => s.draftDoorHeightMm);
  const setDraftDoorSize = useLayoutDrawingStore((s) => s.setDraftDoorSize);
  const draftWindowWidthMm = useLayoutDrawingStore((s) => s.draftWindowWidthMm);
  const draftWindowHeightMm = useLayoutDrawingStore(
    (s) => s.draftWindowHeightMm,
  );
  const draftWindowSillMm = useLayoutDrawingStore((s) => s.draftWindowSillMm);
  const setDraftWindowSize = useLayoutDrawingStore((s) => s.setDraftWindowSize);
  const draftSlabThicknessMm = useLayoutDrawingStore(
    (s) => s.draftSlabThicknessMm,
  );
  const setDraftSlabThicknessMm = useLayoutDrawingStore(
    (s) => s.setDraftSlabThicknessMm,
  );

  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const requestNotePin = useToolMarkupStore((s) => s.requestNotePin);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const notePlaceHint = useToolMarkupStore((s) => s.notePlaceHint);
  const setMeasureMode = useToolMarkupStore((s) => s.setMeasureMode);

  const [flyout, setFlyout] = useState<FlyoutId>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const stripRef = useRef<HTMLDivElement>(null);
  const layoutBtnRef = useRef<HTMLButtonElement>(null);
  const shapesBtnRef = useRef<HTMLButtonElement>(null);
  const pinBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const layoutActive = armedLayout != null;
  const shapesActive = armedTool != null && isShapeTool(armedTool);
  const pinActive = armedTool === "note";

  const armOrPinNote = () => {
    setMeasureMode(false);
    setArmedLayout(null);
    if (armedTool === "note") {
      setArmedTool(null);
      return;
    }
    if (selectedPlacementId || toolSelectedExpressId != null) {
      requestNotePin();
      return;
    }
    setArmedTool("note");
  };

  const updatePos = (which: FlyoutId) => {
    const btn =
      which === "layout"
        ? layoutBtnRef.current
        : which === "shapes"
          ? shapesBtnRef.current
          : pinBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({ top: r.top, left: r.right + 8 });
  };

  const openFlyout = (id: FlyoutId) => {
    if (flyout === id) {
      setFlyout(null);
      return;
    }
    updatePos(id);
    setFlyout(id);
  };

  useEffect(() => {
    if (!flyout) return;
    updatePos(flyout);
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (stripRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setFlyout(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyout(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", () => updatePos(flyout));
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  return (
    <div
      ref={stripRef}
      className={`tool-glass flex flex-col items-center gap-1.5 rounded-2xl p-1.5 ${className}`}
    >
      {projectId && (
        <HoverTip
          label={t(uiLanguage, "layoutDrawing")}
          hint={t(uiLanguage, "layoutToolsFlyout")}
          placement="below"
          disabled={flyout === "layout"}
        >
          <button
            ref={layoutBtnRef}
            type="button"
            aria-expanded={flyout === "layout"}
            aria-pressed={layoutActive}
            onClick={() => openFlyout("layout")}
            className={`${stripBtn} ${layoutActive || flyout === "layout" ? stripSkyOn : stripIdle}`}
          >
            <IconMarkupWall className="h-5 w-5" />
          </button>
        </HoverTip>
      )}

      <HoverTip
        label={t(uiLanguage, "markupShapesMenu")}
        hint={t(uiLanguage, "markupShapesFlyout")}
        placement="below"
        disabled={flyout === "shapes"}
      >
        <button
          ref={shapesBtnRef}
          type="button"
          aria-expanded={flyout === "shapes"}
          aria-pressed={shapesActive}
          onClick={() => openFlyout("shapes")}
          className={`${stripBtn} ${shapesActive || flyout === "shapes" ? stripOn : stripIdle}`}
        >
          <IconMarkupCube className="h-5 w-5" />
        </button>
      </HoverTip>

      <HoverTip
        label={t(uiLanguage, "markupShape_note")}
        hint={t(uiLanguage, "markupHint_note")}
        placement="below"
        disabled={flyout === "pin"}
      >
        <button
          ref={pinBtnRef}
          type="button"
          aria-expanded={flyout === "pin"}
          aria-pressed={pinActive}
          onClick={() => {
            armOrPinNote();
            setFlyout(null);
          }}
          className={`${stripBtn} ${pinActive ? stripOn : stripIdle}`}
        >
          <IconMarkupNote className="h-5 w-5" />
        </button>
      </HoverTip>

      {notePlaceHint && (
        <p className="max-w-[2.75rem] px-0.5 text-center text-[8px] leading-tight text-amber-700">
          {t(uiLanguage, notePlaceHint as UiTextKey)}
        </p>
      )}

      {flyout &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            className="tool-glass fixed z-[220] w-[13.5rem] rounded-2xl p-2.5"
            style={{ top: pos.top, left: pos.left }}
          >
            {flyout === "layout" && (
              <div className="flex flex-col gap-2">
                <p className="px-0.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  {t(uiLanguage, "layoutDrawing")}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {LAYOUT_TOOLS.map((tool) => {
                    const Icon = LAYOUT_TOOL_ICONS[tool.id];
                    const active = armedLayout === tool.id;
                    const label = t(uiLanguage, tool.labelKey);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        aria-pressed={active}
                        title={t(uiLanguage, tool.hintKey)}
                        onClick={() => {
                          setMeasureMode(false);
                          setArmedTool(null);
                          setArmedLayout(active ? null : tool.id);
                          // Keep flyout open so thickness / size drafts stay editable.
                        }}
                        className={`flex h-[3.1rem] flex-col items-center justify-center gap-px rounded-xl border px-1 transition duration-150 ${
                          active
                            ? stripSkyOn
                            : "border-[var(--panel-divider)] bg-[var(--surface-muted)]/50 hover:bg-sky-50/80"
                        }`}
                      >
                        <Icon />
                        <span className="truncate text-[8px] font-semibold">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {armedLayout === "wall" && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
                      {t(uiLanguage, "layoutWallThickness")}
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={50}
                        step={10}
                        value={draftWallThicknessMm}
                        onChange={(e) =>
                          setDraftWallThicknessMm(
                            Number(e.target.value) || 200,
                          )
                        }
                        className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1 text-[11px] outline-none focus:border-sky-300"
                      />
                      <select
                        className="max-w-[4.5rem] rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1 text-[10px]"
                        value=""
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v) setDraftWallThicknessMm(v);
                        }}
                      >
                        <option value="">ÔÇª</option>
                        {presets.wallThicknessMm.map((mm) => (
                          <option key={mm} value={mm}>
                            {mm}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                )}
                {armedLayout === "door" && (
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      aria-label="W"
                      value={draftDoorWidthMm}
                      onChange={(e) =>
                        setDraftDoorSize(
                          Number(e.target.value) || 900,
                          draftDoorHeightMm,
                        )
                      }
                      className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1 text-[11px]"
                    />
                    <input
                      type="number"
                      aria-label="H"
                      value={draftDoorHeightMm}
                      onChange={(e) =>
                        setDraftDoorSize(
                          draftDoorWidthMm,
                          Number(e.target.value) || 2100,
                        )
                      }
                      className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1 text-[11px]"
                    />
                  </div>
                )}
                {armedLayout === "window" && (
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="number"
                      aria-label="W"
                      value={draftWindowWidthMm}
                      onChange={(e) =>
                        setDraftWindowSize(
                          Number(e.target.value) || 1200,
                          draftWindowHeightMm,
                          draftWindowSillMm,
                        )
                      }
                      className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1 py-1 text-[11px]"
                    />
                    <input
                      type="number"
                      aria-label="H"
                      value={draftWindowHeightMm}
                      onChange={(e) =>
                        setDraftWindowSize(
                          draftWindowWidthMm,
                          Number(e.target.value) || 1400,
                          draftWindowSillMm,
                        )
                      }
                      className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1 py-1 text-[11px]"
                    />
                    <input
                      type="number"
                      aria-label="Offset"
                      value={draftWindowSillMm}
                      onChange={(e) =>
                        setDraftWindowSize(
                          draftWindowWidthMm,
                          draftWindowHeightMm,
                          Number(e.target.value) || 900,
                        )
                      }
                      className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1 py-1 text-[11px]"
                    />
                  </div>
                )}
                {(armedLayout === "floor" || armedLayout === "roof") && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
                      {t(uiLanguage, "layoutSlabThickness")}
                    </span>
                    <input
                      type="number"
                      min={50}
                      step={10}
                      value={draftSlabThicknessMm}
                      onChange={(e) =>
                        setDraftSlabThicknessMm(
                          Number(e.target.value) || 200,
                        )
                      }
                      className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1 text-[11px] outline-none focus:border-sky-300"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {t(uiLanguage, "layoutSlabDrawHint")}
                    </p>
                  </label>
                )}
              </div>
            )}

            {flyout === "shapes" && (
              <div className="flex flex-col gap-2">
                <p className="px-0.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  {t(uiLanguage, "markupShapesMenu")}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {SHAPE_IDS.map((id) => {
                    const Icon = MARKUP_TOOL_ICONS[id];
                    const active = armedTool === id;
                    const label = t(uiLanguage, TOOL_LABEL[id]);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        aria-label={label}
                        title={t(uiLanguage, TOOL_HINT[id])}
                        onClick={() => {
                          setMeasureMode(false);
                          setArmedLayout(null);
                          setArmedTool(active ? null : id);
                          setFlyout(null);
                        }}
                        className={`flex h-[3.1rem] flex-col items-center justify-center gap-px rounded-xl border px-0.5 transition duration-150 ${
                          active
                            ? stripOn
                            : "border-[var(--panel-divider)] bg-[var(--surface-muted)]/50 hover:bg-amber-50/80"
                        }`}
                      >
                        <Icon />
                        <span className="w-full truncate text-center text-[7px] font-semibold">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}
