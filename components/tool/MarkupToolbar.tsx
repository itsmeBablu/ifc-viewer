"use client";

import { useEffect, useRef, useState } from "react";
import { listVisibleFloors } from "@/lib/floorFilter";
import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";
import {
  buildFragBlob,
  buildMarkupOnlyIfc,
  downloadBlob,
  getCachedIfcBytes,
} from "@/lib/markupFragSave";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useModelScene } from "../viewer/ModelSceneContext";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

const TRANSFORM_MODES = ["translate", "rotate", "scale"] as const;
const VIEW_PRESETS = ["top", "front", "right", "free"] as const;

const TOOL_HINT: Record<string, string> = {
  cube: "markupHint_cube",
  sphere: "markupHint_sphere",
  cylinder: "markupHint_cylinder",
  cone: "markupHint_cone",
  torus: "markupHint_torus",
  capsule: "markupHint_capsule",
  pyramid: "markupHint_pyramid",
  note: "markupHint_note",
};

/**
 * Compact Werkzeug markup toolbar — one icon expands tools; SAVE opens .ifc/.frag.
 */
export default function MarkupToolbar({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const floors = useAppStore((s) => s.floors);
  const rooms = useAppStore((s) => s.rooms);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const { shellGroup } = useModelScene();

  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const setSnapToFaces = useToolMarkupStore((s) => s.setSnapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const setGridSnap = useToolMarkupStore((s) => s.setGridSnap);
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const modelKey = useToolMarkupStore((s) => s.modelKey);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const markSaved = useToolMarkupStore((s) => s.markSaved);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [hoverTip, setHoverTip] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleFloors = listVisibleFloors(floors, rooms, shellGroup);
  const ActiveIcon = armedTool
    ? MARKUP_TOOL_ICONS[armedTool]
    : MARKUP_TOOL_ICONS.cube;

  useEffect(() => {
    if (!toolsOpen && !saveOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setToolsOpen(false);
        setSaveOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [toolsOpen, saveOpen]);

  const selectFloor = (floorId: string | null) => {
    setMarkupFloorId(floorId);
    setSelectedFloor(floorId);
    if (floorId) setViewPreset("top");
  };

  const saveAs = (kind: "frag" | "ifc") => {
    if (!modelKey) return;
    const base = (activeModelLabel ?? modelKey)
      .replace(/\.ifc$/i, "")
      .replace(/[^\w.-]+/g, "_");
    if (kind === "frag") {
      const ifcBytes = getCachedIfcBytes(modelKey);
      const blob = buildFragBlob({
        modelKey,
        modelLabel: activeModelLabel,
        placements,
        notes,
        ifcBytes,
      });
      downloadBlob(blob, `${base}.frag`);
      markSaved();
    } else {
      // Prefer Python service when configured; else markup-only IFC download.
      const endpoint = process.env.NEXT_PUBLIC_MARKUP_IFC_EXPORT_URL;
      if (endpoint) {
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelKey,
            modelLabel: activeModelLabel,
            placements,
            notes,
          }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            downloadBlob(blob, `${base}_markup.ifc`);
            markSaved();
          })
          .catch(() => {
            const blob = buildMarkupOnlyIfc({
              modelLabel: activeModelLabel,
              placements,
              notes,
            });
            downloadBlob(blob, `${base}_markup.ifc`);
            markSaved();
          });
      } else {
        const blob = buildMarkupOnlyIfc({
          modelLabel: activeModelLabel,
          placements,
          notes,
        });
        downloadBlob(blob, `${base}_markup.ifc`);
        markSaved();
      }
    }
    setSaveOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto relative flex flex-col items-center gap-1 ${className}`}
    >
      {/* Collapsed primary control */}
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.78))] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <button
          type="button"
          title={t(uiLanguage, "markupSaveProject")}
          aria-expanded={saveOpen}
          onClick={() => {
            setSaveOpen((v) => !v);
            setToolsOpen(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-[9px] font-bold tracking-wide text-white transition hover:bg-zinc-700"
        >
          {t(uiLanguage, "markupSaveShort")}
        </button>

        <button
          type="button"
          title={t(uiLanguage, "markupToolbar")}
          aria-expanded={toolsOpen}
          onClick={() => {
            setToolsOpen((v) => !v);
            setSaveOpen(false);
          }}
          className={`flex h-10 w-9 items-center justify-center rounded-xl transition ${
            toolsOpen || armedTool
              ? "bg-zinc-200 text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <ActiveIcon />
        </button>

        {selectedPlacementId && (
          <>
            <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />
            {TRANSFORM_MODES.map((mode) => {
              const active = transformMode === mode;
              const label =
                mode === "translate"
                  ? t(uiLanguage, "markupMove")
                  : mode === "rotate"
                    ? t(uiLanguage, "markupRotate")
                    : t(uiLanguage, "markupScale");
              const glyph =
                mode === "translate" ? "↔" : mode === "rotate" ? "↻" : "⤡";
              return (
                <button
                  key={mode}
                  type="button"
                  title={label}
                  aria-pressed={active}
                  onClick={() => setTransformMode(mode)}
                  className={`flex h-8 w-9 items-center justify-center rounded-xl text-sm transition ${
                    active
                      ? "bg-sky-400/85 text-sky-950"
                      : "text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {glyph}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Save flyout */}
      {saveOpen && (
        <div className="absolute top-0 left-[calc(100%+0.4rem)] z-10 w-44 rounded-2xl border border-[var(--panel-divider)] bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
          <p className="px-2 pb-1 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
            {t(uiLanguage, "markupSaveAs")}
          </p>
          <button
            type="button"
            onClick={() => saveAs("frag")}
            className="w-full rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold text-zinc-800 transition hover:bg-amber-50"
          >
            {t(uiLanguage, "markupSaveFrag")}
          </button>
          <button
            type="button"
            onClick={() => saveAs("ifc")}
            className="w-full rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold text-zinc-800 transition hover:bg-amber-50"
          >
            {t(uiLanguage, "markupSaveIfc")}
          </button>
        </div>
      )}

      {/* Tools flyout */}
      {toolsOpen && (
        <div className="absolute top-12 left-[calc(100%+0.4rem)] z-10 flex w-max flex-col gap-1 rounded-2xl border border-[var(--panel-divider)] bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
          <div className="flex gap-1">
            {MARKUP_TOOL_ORDER.map((id) => {
              const Icon = MARKUP_TOOL_ICONS[id];
              const active = armedTool === id;
              const hintKey = TOOL_HINT[id] as keyof typeof TOOL_HINT;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onMouseEnter={() =>
                    setHoverTip(t(uiLanguage, hintKey as "markupHint_cube"))
                  }
                  onMouseLeave={() => setHoverTip(null)}
                  onClick={() => {
                    setArmedTool(active ? null : id);
                    setToolsOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    active
                      ? "bg-amber-400/90 text-amber-950"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
          {hoverTip && (
            <p className="max-w-[14rem] px-1.5 pb-0.5 text-[10px] leading-snug text-zinc-600">
              {hoverTip}
            </p>
          )}

          <div className="mx-1 h-px bg-zinc-200" />

          <div className="flex flex-wrap items-center gap-1 px-0.5">
            <button
              type="button"
              title={t(uiLanguage, "markupSnap")}
              aria-pressed={snapToFaces}
              onClick={() => setSnapToFaces(!snapToFaces)}
              className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
                snapToFaces
                  ? "bg-emerald-400/85 text-emerald-950"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              SNAP
            </button>
            <button
              type="button"
              title={t(uiLanguage, "markupGridSnap")}
              aria-pressed={gridSnap}
              onClick={() => setGridSnap(!gridSnap)}
              className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
                gridSnap
                  ? "bg-emerald-400/85 text-emerald-950"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              GRID
            </button>
            {VIEW_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                title={t(uiLanguage, `markupView_${preset}`)}
                aria-pressed={viewPreset === preset}
                onClick={() => setViewPreset(preset)}
                className={`rounded-lg px-1.5 py-1 text-[8px] font-bold uppercase ${
                  viewPreset === preset
                    ? "bg-zinc-800 text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {preset === "free" ? "3D" : preset[0]}
              </button>
            ))}
          </div>

          <div className="max-h-28 overflow-y-auto thin-scroll">
            <button
              type="button"
              onClick={() => selectFloor(null)}
              className={`mb-0.5 w-full rounded-lg px-2 py-1 text-left text-[10px] font-semibold ${
                markupFloorId == null
                  ? "bg-amber-100 text-amber-950"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t(uiLanguage, "markupAllFloors")}
            </button>
            {visibleFloors.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => selectFloor(f.id)}
                className={`mb-0.5 w-full truncate rounded-lg px-2 py-1 text-left text-[10px] font-semibold ${
                  markupFloorId === f.id
                    ? "bg-amber-100 text-amber-950"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 px-0.5 pt-0.5">
            {MARKUP_COLOR_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={() => setDefaultColor(hex)}
                className={`h-3.5 w-3.5 rounded-full border ${
                  defaultColor.toLowerCase() === hex.toLowerCase()
                    ? "border-zinc-800 ring-1 ring-amber-400"
                    : "border-black/15"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      )}

      {armedTool && (
        <p className="mt-1 max-w-[4.5rem] text-center text-[8px] font-semibold leading-tight text-amber-800">
          {armedTool === "cube"
            ? t(uiLanguage, "markupDrawCubeHint")
            : isShapeTool(armedTool)
              ? t(uiLanguage, "markupClickToPlace")
              : t(uiLanguage, "markupClickToNote")}
        </p>
      )}
    </div>
  );
}
