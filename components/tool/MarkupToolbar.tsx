"use client";

import { listVisibleFloors } from "@/lib/floorFilter";
import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";
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

/**
 * Slim vertical markup toolbar — left edge of the Werkzeug viewer.
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
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const saveMarkupFile = useToolMarkupStore((s) => s.saveMarkupFile);
  const lastSavedAt = useToolMarkupStore((s) => s.lastSavedAt);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);

  const visibleFloors = listVisibleFloors(floors, rooms, shellGroup);

  const selectFloor = (floorId: string | null) => {
    setMarkupFloorId(floorId);
    setSelectedFloor(floorId);
    if (floorId) setViewPreset("top");
  };

  return (
    <div
      className={`pointer-events-auto flex max-h-[min(88dvh,40rem)] flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.72))] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-md thin-scroll ${className}`}
      role="toolbar"
      aria-label={t(uiLanguage, "markupToolbar")}
    >
      {/* Save */}
      <button
        type="button"
        title={t(uiLanguage, "markupSaveProject")}
        aria-label={t(uiLanguage, "markupSaveProject")}
        onClick={() => saveMarkupFile(activeModelLabel)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/90 text-[10px] font-bold tracking-wide text-amber-950 shadow-inner transition hover:brightness-105"
      >
        {t(uiLanguage, "markupSaveShort")}
      </button>
      {lastSavedAt != null && (
        <span className="max-w-[3.2rem] text-center text-[7px] font-medium leading-tight text-emerald-700">
          {t(uiLanguage, "markupSaved")}
        </span>
      )}

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      {/* Shapes + note */}
      {MARKUP_TOOL_ORDER.map((id) => {
        const Icon = MARKUP_TOOL_ICONS[id];
        const active = armedTool === id;
        const labelKey =
          id === "note" ? "markupNote" : (`markupShape_${id}` as const);
        return (
          <button
            key={id}
            type="button"
            title={t(uiLanguage, labelKey)}
            aria-label={t(uiLanguage, labelKey)}
            aria-pressed={active}
            onClick={() => setArmedTool(active ? null : id)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              active
                ? "bg-amber-400/90 text-amber-950 shadow-inner"
                : "text-[var(--text-body)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <Icon />
          </button>
        );
      })}

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      {/* Move / rotate / scale */}
      {TRANSFORM_MODES.map((mode) => {
        const active = transformMode === mode && Boolean(selectedPlacementId);
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
            aria-label={label}
            aria-pressed={transformMode === mode}
            disabled={!selectedPlacementId}
            onClick={() => setTransformMode(mode)}
            className={`flex h-8 w-9 items-center justify-center rounded-xl text-sm transition disabled:opacity-35 ${
              active
                ? "bg-sky-400/85 text-sky-950"
                : "text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {glyph}
          </button>
        );
      })}

      <button
        type="button"
        title={t(uiLanguage, "markupSnap")}
        aria-label={t(uiLanguage, "markupSnap")}
        aria-pressed={snapToFaces}
        onClick={() => setSnapToFaces(!snapToFaces)}
        className={`flex h-8 w-9 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide transition ${
          snapToFaces
            ? "bg-emerald-400/85 text-emerald-950"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
        }`}
      >
        SNAP
      </button>

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      {/* Views */}
      {VIEW_PRESETS.map((preset) => {
        const active = viewPreset === preset;
        const label = t(uiLanguage, `markupView_${preset}`);
        return (
          <button
            key={preset}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setViewPreset(preset)}
            className={`flex h-7 w-9 items-center justify-center rounded-lg text-[8px] font-bold uppercase tracking-wide transition ${
              active
                ? "bg-zinc-800 text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {preset === "free" ? "3D" : preset.slice(0, 1).toUpperCase()}
          </button>
        );
      })}

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      {/* Floors */}
      <p className="max-w-[3.2rem] text-center text-[7px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {t(uiLanguage, "floors")}
      </p>
      <button
        type="button"
        title={t(uiLanguage, "markupAllFloors")}
        aria-pressed={markupFloorId == null}
        onClick={() => selectFloor(null)}
        className={`flex h-7 w-9 items-center justify-center rounded-lg text-[8px] font-bold transition ${
          markupFloorId == null
            ? "bg-amber-300/90 text-amber-950"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
        }`}
      >
        ALL
      </button>
      {visibleFloors.map((f) => {
        const active = markupFloorId === f.id;
        return (
          <button
            key={f.id}
            type="button"
            title={f.name}
            aria-label={f.name}
            aria-pressed={active}
            onClick={() => selectFloor(f.id)}
            className={`flex min-h-7 w-9 items-center justify-center rounded-lg px-0.5 text-[7px] font-semibold leading-tight transition ${
              active
                ? "bg-amber-300/90 text-amber-950"
                : "text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <span className="line-clamp-2 break-all text-center">
              {f.name.replace(/^Ifc/i, "").slice(0, 10)}
            </span>
          </button>
        );
      })}

      <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />

      <div className="grid grid-cols-3 gap-0.5 px-0.5 pb-0.5">
        {MARKUP_COLOR_PALETTE.map((hex) => {
          const active = defaultColor.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={hex}
              aria-pressed={active}
              onClick={() => setDefaultColor(hex)}
              className={`h-3.5 w-3.5 rounded-full border transition ${
                active
                  ? "scale-110 border-zinc-800 ring-1 ring-amber-400"
                  : "border-black/15 hover:scale-110"
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>

      <label
        className="relative mt-0.5 flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[var(--panel-divider)]"
        title={t(uiLanguage, "markupCustomColor")}
      >
        <span
          className="absolute inset-0.5 rounded-md"
          style={{ backgroundColor: defaultColor }}
        />
        <input
          type="color"
          value={defaultColor}
          onChange={(e) => setDefaultColor(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={t(uiLanguage, "markupCustomColor")}
        />
      </label>

      {armedTool && (
        <p className="max-w-[3.25rem] pt-0.5 text-center text-[8px] font-semibold leading-tight text-amber-800">
          {isShapeTool(armedTool)
            ? t(uiLanguage, "markupClickToPlace")
            : t(uiLanguage, "markupClickToNote")}
        </p>
      )}
    </div>
  );
}
