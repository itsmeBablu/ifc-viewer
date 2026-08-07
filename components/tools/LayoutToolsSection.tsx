"use client";

import HoverTip from "@/components/common/HoverTip";
import { t, type UiTextKey } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { LAYOUT_TOOL_ICONS } from "./MarkupIcons";

const TOOLS: {
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

/**
 * Wall / Door / Window tools + draft size fields with remembered presets.
 */
export default function LayoutToolsSection({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const projectId = useLayoutDrawingStore((s) => s.projectId);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const setArmed = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
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
  const setArmedShape = useToolMarkupStore((s) => s.setArmedTool);

  if (!projectId) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="px-0.5 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
        {t(uiLanguage, "layoutDrawing")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TOOLS.map((tool) => {
          const Icon = LAYOUT_TOOL_ICONS[tool.id];
          const active = armed === tool.id;
          const label = t(uiLanguage, tool.labelKey);
          return (
            <HoverTip
              key={tool.id}
              label={label}
              hint={t(uiLanguage, tool.hintKey)}
              placement="below"
              className="min-w-0"
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setArmedShape(null);
                  setArmed(active ? null : tool.id);
                }}
                className={`flex h-[3.35rem] w-full min-w-0 flex-col items-center justify-center gap-px overflow-hidden rounded-xl border px-1 pt-0.5 transition duration-150 ${
                  active
                    ? "border-sky-300/80 bg-gradient-to-br from-sky-200/95 via-sky-300/80 to-sky-400/70 text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                    : "border-[var(--panel-divider)] bg-[var(--surface-muted)]/50 text-[var(--text-body)] hover:border-sky-200/60 hover:bg-sky-50/80"
                }`}
              >
                <span className="shrink-0 [&>svg]:h-6 [&>svg]:w-6">
                  <Icon />
                </span>
                <span className="w-full truncate text-center text-[8px] font-semibold leading-tight tracking-wide">
                  {label}
                </span>
              </button>
            </HoverTip>
          );
        })}
      </div>

      {armed === "wall" && (
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            {t(uiLanguage, "layoutWallThickness")}
          </span>
          <div className="flex gap-1.5">
            <input
              type="number"
              min={50}
              step={10}
              value={draftWallThicknessMm}
              onChange={(e) =>
                setDraftWallThicknessMm(Number(e.target.value) || 200)
              }
              className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
            <select
              aria-label={t(uiLanguage, "layoutPresets")}
              className="max-w-[5.5rem] rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1 text-[10px]"
              value=""
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) setDraftWallThicknessMm(v);
              }}
            >
              <option value="">{t(uiLanguage, "layoutPresets")}</option>
              {presets.wallThicknessMm.map((mm) => (
                <option key={mm} value={mm}>
                  {mm} mm
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            {t(uiLanguage, "layoutWallDrawHint")}
          </p>
          <p className="text-[9px] text-[var(--text-muted)]">
            {t(uiLanguage, "layoutTraceHint")}
          </p>
        </label>
      )}

      {armed === "door" && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
              W mm
            </span>
            <input
              type="number"
              min={300}
              value={draftDoorWidthMm}
              onChange={(e) =>
                setDraftDoorSize(Number(e.target.value) || 900, draftDoorHeightMm)
              }
              className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
              H mm
            </span>
            <input
              type="number"
              min={600}
              value={draftDoorHeightMm}
              onChange={(e) =>
                setDraftDoorSize(draftDoorWidthMm, Number(e.target.value) || 2100)
              }
              className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
          </label>
          <select
            className="col-span-2 rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[10px]"
            value=""
            onChange={(e) => {
              const i = Number(e.target.value);
              const p = presets.doorSizes[i];
              if (p) setDraftDoorSize(p.widthMm, p.heightMm);
            }}
          >
            <option value="">{t(uiLanguage, "layoutPresets")}</option>
            {presets.doorSizes.map((p, i) => (
              <option key={`${p.widthMm}x${p.heightMm}`} value={i}>
                {p.widthMm} × {p.heightMm} mm
              </option>
            ))}
          </select>
          <p className="col-span-2 text-[10px] text-[var(--text-muted)]">
            {t(uiLanguage, "layoutDoorHint")}
          </p>
        </div>
      )}

      {armed === "window" && (
        <div className="grid grid-cols-3 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
              W
            </span>
            <input
              type="number"
              min={200}
              value={draftWindowWidthMm}
              onChange={(e) =>
                setDraftWindowSize(
                  Number(e.target.value) || 1200,
                  draftWindowHeightMm,
                  draftWindowSillMm,
                )
              }
              className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1.5 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
              H
            </span>
            <input
              type="number"
              min={200}
              value={draftWindowHeightMm}
              onChange={(e) =>
                setDraftWindowSize(
                  draftWindowWidthMm,
                  Number(e.target.value) || 1400,
                  draftWindowSillMm,
                )
              }
              className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1.5 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase">
              Offset
            </span>
            <input
              type="number"
              min={0}
              value={draftWindowSillMm}
              onChange={(e) =>
                setDraftWindowSize(
                  draftWindowWidthMm,
                  draftWindowHeightMm,
                  Number(e.target.value) || 900,
                )
              }
              className="rounded-lg border border-[var(--panel-divider)] bg-white/70 px-1.5 py-1.5 text-[11px] outline-none focus:border-sky-300"
            />
          </label>
          <select
            className="col-span-3 rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[10px]"
            value=""
            onChange={(e) => {
              const i = Number(e.target.value);
              const p = presets.windowSizes[i];
              if (p)
                setDraftWindowSize(p.widthMm, p.heightMm, p.sillHeightMm);
            }}
          >
            <option value="">{t(uiLanguage, "layoutPresets")}</option>
            {presets.windowSizes.map((p, i) => (
              <option
                key={`${p.widthMm}x${p.heightMm}@${p.sillHeightMm}`}
                value={i}
              >
                {p.widthMm}×{p.heightMm} @{p.sillHeightMm} mm
              </option>
            ))}
          </select>
          <p className="col-span-3 text-[10px] text-[var(--text-muted)]">
            {t(uiLanguage, "layoutWindowHint")}
          </p>
        </div>
      )}

      {(armed === "floor" || armed === "roof") && (
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            {t(uiLanguage, "layoutSlabThickness")}
          </span>
          <input
            type="number"
            min={50}
            step={10}
            value={draftSlabThicknessMm}
            onChange={(e) =>
              setDraftSlabThicknessMm(Number(e.target.value) || 200)
            }
            className="w-full rounded-lg border border-[var(--panel-divider)] bg-white/70 px-2 py-1.5 text-[11px] outline-none focus:border-sky-300"
          />
          <p className="text-[10px] text-[var(--text-muted)]">
            {t(uiLanguage, "layoutSlabDrawHint")}
          </p>
        </label>
      )}
    </div>
  );
}
