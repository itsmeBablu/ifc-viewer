"use client";

import type { ReactNode } from "react";
import LegendSwatchPresetGrid from "./LegendSwatchPresetGrid";
import HoverTip from "../common/HoverTip";
import { t, type UiLanguage } from "@/lib/i18n";
import type { ColorStop } from "@/lib/colorMapping";
import type { LegendColorMode } from "@/lib/colorMapping";

type Props = {
  mode: LegendColorMode;
  uiLanguage: UiLanguage;
  compact?: boolean;
  /** Mini preview above presets — gradient bar or chip row. */
  preview?: ReactNode;
  stops: ColorStop[];
  unitSuffix: string;
  activePresetId?: string | null;
  hasOverrides: boolean;
  onSelectPreset: (id: string) => void;
  onStopColor: (value: number, color: string) => void;
  onReset: () => void;
  toColorInputValue: (hex: string) => string;
};

/** Shared popup: 6 quick palettes + per-stop color editors. */
export default function LegendPalettePanel({
  mode,
  uiLanguage,
  compact = false,
  preview,
  stops,
  unitSuffix,
  activePresetId,
  hasOverrides,
  onSelectPreset,
  onStopColor,
  onReset,
  toColorInputValue,
}: Props) {
  return (
    <div
      className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] shadow-md backdrop-blur-md ${
        compact ? "space-y-1 p-1.5" : "space-y-1.5 p-2"
      }`}
    >
      {preview ? preview : null}
      <HoverTip
        label={t(uiLanguage, "swatchPresets")}
        hint={t(uiLanguage, "swatchPresetHint")}
        placement="below"
        className="block w-full"
      >
        <div>
          <p className="px-0.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
            {t(uiLanguage, "swatchPresets")}
          </p>
          <LegendSwatchPresetGrid
            mode={mode}
            compact={compact}
            activePresetId={activePresetId}
            onSelect={onSelectPreset}
          />
        </div>
      </HoverTip>
      <p className="px-0.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
        {t(uiLanguage, "editSwatchColors")}
      </p>
      <div className="flex flex-nowrap items-end justify-between gap-0.5">
        {stops.map((s) => (
          <label
            key={s.value}
            title={`${s.value}${unitSuffix}`}
            className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center ${
              compact ? "gap-0.5" : "gap-1"
            }`}
          >
            <span
              className={`relative inline-flex shrink-0 overflow-hidden rounded-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_6px_rgba(0,0,0,0.14)] ${
                compact ? "h-5 w-5" : "h-6 w-6"
              }`}
              style={{ backgroundColor: s.color }}
            >
              <input
                type="color"
                value={toColorInputValue(s.color)}
                onChange={(e) => onStopColor(s.value, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`${s.value}${unitSuffix}`}
              />
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent"
                aria-hidden
              />
            </span>
            <span
              className={`w-full truncate text-center font-medium tabular-nums text-[var(--text-body)] ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {s.value}
              {unitSuffix}
            </span>
          </label>
        ))}
      </div>
      {hasOverrides && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-medium text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-strong)] hover:underline"
        >
          {t(uiLanguage, "resetSwatchColors")}
        </button>
      )}
    </div>
  );
}
