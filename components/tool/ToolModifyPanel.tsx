"use client";

import { useEffect, useRef, useState } from "react";
import { listVisibleFloors } from "@/lib/floorFilter";
import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";
import {
  buildFragBlob,
  downloadBlob,
  getCachedIfcBytes,
  mergeMarkupIntoIfc,
  buildMarkupOnlyIfc,
} from "@/lib/markupFragSave";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useModelScene } from "../viewer/ModelSceneContext";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
  isShapeTool,
} from "./MarkupIcons";

const TRANSFORM_MODES = ["translate", "rotate", "scale"] as const;
const SIDE_VIEWS = [
  { id: "north" as const, label: "N" },
  { id: "south" as const, label: "S" },
  { id: "east" as const, label: "O" },
  { id: "west" as const, label: "W" },
];

const TOOL_HINT: Record<string, "markupHint_cube" | "markupHint_sphere" | "markupHint_cylinder" | "markupHint_cone" | "markupHint_torus" | "markupHint_capsule" | "markupHint_pyramid" | "markupHint_note"> = {
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
 * Werkzeug "Modify" tab — place shapes/notes, views, snap, save, properties.
 */
export default function ToolModifyPanel({
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
  const updatePlacement = useToolMarkupStore((s) => s.updatePlacement);
  const modelKey = useToolMarkupStore((s) => s.modelKey);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const markSaved = useToolMarkupStore((s) => s.markSaved);
  const lastSavedAt = useToolMarkupStore((s) => s.lastSavedAt);

  const selectedPlacement =
    placements.find((p) => p.id === selectedPlacementId) ?? null;
  const swatchColor = selectedPlacement?.color ?? defaultColor;

  const applyColor = (hex: string) => {
    setDefaultColor(hex);
    if (selectedPlacementId) {
      void updatePlacement(selectedPlacementId, { color: hex });
    }
  };

  const [hoverTip, setHoverTip] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleFloors = listVisibleFloors(floors, rooms, shellGroup);

  useEffect(() => {
    return () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, []);

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
      const layout = useLayoutDrawingStore.getState();
      const ifcBytes = getCachedIfcBytes(modelKey);
      const blob = buildFragBlob({
        modelKey,
        modelLabel: activeModelLabel,
        placements,
        notes,
        ifcBytes,
        layout: layout.projectId
          ? {
              levels: layout.levels,
              walls: layout.walls,
              doors: layout.doors,
              windows: layout.windows,
              slabs: layout.slabs,
              underlays: layout.underlays,
            }
          : undefined,
      });
      downloadBlob(blob, `${base}.frag`);
      markSaved();
      setSaveMsg(t(uiLanguage, "markupSavedFrag"));
    } else {
      const endpoint = process.env.NEXT_PUBLIC_MARKUP_IFC_EXPORT_URL;
      const finish = (blob: Blob) => {
        downloadBlob(blob, `${base}_marked.ifc`);
        markSaved();
        setSaveMsg(t(uiLanguage, "markupSavedIfc"));
      };
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
            finish(await res.blob());
          })
          .catch(() => {
            const cached = getCachedIfcBytes(modelKey);
            finish(
              cached
                ? mergeMarkupIntoIfc({
                    baseIfc: cached,
                    placements,
                    notes,
                  })
                : buildMarkupOnlyIfc({
                    modelLabel: activeModelLabel,
                    placements,
                    notes,
                  }),
            );
          });
      } else {
        const cached = getCachedIfcBytes(modelKey);
        finish(
          cached
            ? mergeMarkupIntoIfc({
                baseIfc: cached,
                placements,
                notes,
              })
            : buildMarkupOnlyIfc({
                modelLabel: activeModelLabel,
                placements,
                notes,
              }),
        );
      }
    }
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setSaveMsg(null), 3200);
  };

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      {/* Tools */}
      <section className="shrink-0 rounded-xl border border-[var(--panel-divider)] bg-white/50 p-2">
        <p className="mb-1.5 px-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
          {t(uiLanguage, "markupToolbar")}
        </p>
        <div className="flex flex-wrap gap-1">
          {MARKUP_TOOL_ORDER.map((id) => {
            const Icon = MARKUP_TOOL_ICONS[id];
            const active = armedTool === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                title={t(uiLanguage, TOOL_HINT[id])}
                onMouseEnter={() => setHoverTip(t(uiLanguage, TOOL_HINT[id]))}
                onMouseLeave={() => setHoverTip(null)}
                onClick={() => setArmedTool(active ? null : id)}
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
        <p className="mt-1 min-h-[1.1rem] px-0.5 text-[10px] leading-snug text-zinc-500">
          {hoverTip ??
            (armedTool === "cube"
              ? t(uiLanguage, "markupDrawCubeHint")
              : armedTool && isShapeTool(armedTool)
                ? t(uiLanguage, "markupClickToPlace")
                : armedTool === "note"
                  ? t(uiLanguage, "markupClickToNote")
                  : t(uiLanguage, "markupSelectIfcHint"))}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {MARKUP_COLOR_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              onClick={() => applyColor(hex)}
              className={`h-3.5 w-3.5 rounded-full border ${
                swatchColor.toLowerCase() === hex.toLowerCase()
                  ? "border-zinc-800 ring-1 ring-amber-400"
                  : "border-black/15"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </section>

      {/* Views + snap */}
      <section className="shrink-0 rounded-xl border border-[var(--panel-divider)] bg-white/50 p-2">
        <p className="mb-1.5 px-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
          {t(uiLanguage, "markupViews")}
        </p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            title={t(uiLanguage, "markupView_top")}
            aria-pressed={viewPreset === "top"}
            onClick={() => setViewPreset("top")}
            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
              viewPreset === "top"
                ? "bg-zinc-800 text-white"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            Top
          </button>
          {SIDE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              title={t(uiLanguage, `markupView_${v.id}`)}
              aria-pressed={viewPreset === v.id}
              onClick={() => setViewPreset(v.id)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                viewPreset === v.id
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {v.label}
            </button>
          ))}
          <button
            type="button"
            title={t(uiLanguage, "markupView_free")}
            aria-pressed={viewPreset === "free"}
            onClick={() => setViewPreset("free")}
            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
              viewPreset === "free"
                ? "bg-zinc-800 text-white"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            3D
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
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
          {selectedPlacementId &&
            TRANSFORM_MODES.map((mode) => {
              const active = transformMode === mode;
              const label =
                mode === "translate"
                  ? t(uiLanguage, "markupMove")
                  : mode === "rotate"
                    ? t(uiLanguage, "markupRotate")
                    : t(uiLanguage, "markupScale");
              return (
                <button
                  key={mode}
                  type="button"
                  title={label}
                  aria-pressed={active}
                  onClick={() => setTransformMode(mode)}
                  className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
                    active
                      ? "bg-sky-400/85 text-sky-950"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
        </div>
        <div className="mt-1.5 max-h-24 overflow-y-auto thin-scroll">
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
      </section>

      {/* Save */}
      <section className="shrink-0 rounded-xl border border-[var(--panel-divider)] bg-white/50 p-2">
        <p className="mb-1.5 px-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
          {t(uiLanguage, "markupSaveAs")}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!modelKey}
            onClick={() => saveAs("frag")}
            className="flex-1 rounded-xl bg-zinc-800 px-2 py-2 text-[11px] font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            .frag
          </button>
          <button
            type="button"
            disabled={!modelKey}
            onClick={() => saveAs("ifc")}
            className="flex-1 rounded-xl bg-amber-400/90 px-2 py-2 text-[11px] font-semibold text-amber-950 transition hover:bg-amber-400 disabled:opacity-40"
          >
            .ifc
          </button>
        </div>
        <p className="mt-1 px-0.5 text-[9px] leading-snug text-zinc-500">
          {saveMsg ??
            (lastSavedAt
              ? `${t(uiLanguage, "markupLastSaved")}: ${new Date(lastSavedAt).toLocaleTimeString()}`
              : t(uiLanguage, "markupSaveHint"))}
        </p>
        <p className="mt-0.5 px-0.5 text-[9px] text-zinc-400">
          {placements.length} {t(uiLanguage, "markupShapesCount")} ·{" "}
          {notes.length} {t(uiLanguage, "markupNotesCount")}
        </p>
      </section>

      {/* Properties / notes */}
      <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
        <MarkupPropertiesPanel className="!shadow-none border-0 bg-transparent p-0" />
      </div>
    </div>
  );
}
