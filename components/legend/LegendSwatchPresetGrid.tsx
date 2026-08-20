"use client";

/**
 * LegendSwatchPresetGrid — 3-column grid of one-click gradient swatch
 * presets (LEGEND_SWATCH_PRESETS / LEGEND_TEMPERATURE_SWATCH_PRESETS) for
 * the active legend color mode.
 *
 * Purely presentational; the chosen preset id is reported to the parent
 * (LegendPalettePanel) via `onSelect`.
 */

import {
  LEGEND_SWATCH_PRESETS,
  LEGEND_TEMPERATURE_SWATCH_PRESETS,
  swatchColorsForMode,
  type LegendSwatchPreset,
  type TemperatureSwatchPreset,
} from "@/lib/legendSwatchPresets";
import type { LegendColorMode } from "@/lib/colorMapping";

type Props = {
  mode: LegendColorMode;
  activePresetId?: string | null;
  onSelect: (presetId: string) => void;
  compact?: boolean;
};

/** Adobe-style grid of 6 one-click gradient swatch presets. */
export default function LegendSwatchPresetGrid({
  mode,
  activePresetId,
  onSelect,
  compact = false,
}: Props) {
  const presets =
    mode === "temperature"
      ? LEGEND_TEMPERATURE_SWATCH_PRESETS
      : LEGEND_SWATCH_PRESETS;

  return (
    <div className={`grid w-full grid-cols-3 ${compact ? "gap-1" : "gap-1.5"}`}>
      {presets.map((preset, index) => {
        const colors =
          mode === "temperature"
            ? (preset as TemperatureSwatchPreset).colors
            : swatchColorsForMode(preset as LegendSwatchPreset, mode);
        return (
          <SwatchPresetButton
            key={preset.id}
            name={preset.name}
            shortcut={index + 1}
            presetId={preset.id}
            colors={colors}
            active={activePresetId === preset.id}
            compact={compact}
            onSelect={() => onSelect(preset.id)}
          />
        );
      })}
    </div>
  );
}

function SwatchPresetButton({
  name,
  shortcut,
  presetId,
  colors,
  active,
  compact,
  onSelect,
}: {
  name: string;
  shortcut: number;
  presetId: string;
  colors: string[];
  active: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={`${name} (${shortcut})`}
      onClick={onSelect}
      className={`group w-full rounded-xl border text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-px active:scale-[0.98] ${
        compact ? "p-1" : "p-1.5"
      } ${
        active
          ? "border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_4px_14px_rgba(15,23,42,.16)] ring-1 ring-yellow-400/45"
          : "border-white/45 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_2px_8px_rgba(15,23,42,.09)] hover:border-white/70 hover:bg-white/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_16px_rgba(15,23,42,.14)]"
      }`}
    >
      <div
        className={`relative isolate flex w-full overflow-hidden rounded-lg border border-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_2px_8px_rgba(0,0,0,.18)] ${
          compact ? "h-3.5" : "h-4"
        }`}
      >
        {colors.map((color) => (
          <span
            key={`${presetId}-${color}`}
            className="min-w-0 flex-1"
            style={{ backgroundColor: color, boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(0,0,0,.1)" }}
          />
        ))}
        <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[58%] bg-gradient-to-b from-white/65 via-white/20 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-1 ring-inset ring-white/25" aria-hidden />
      </div>
      <p
        className={`mt-0.5 truncate font-medium text-[var(--text-body)] ${
          compact ? "text-[8px]" : "text-[9px]"
        }`}
      >
        {shortcut}. {name}
      </p>
    </button>
  );
}
