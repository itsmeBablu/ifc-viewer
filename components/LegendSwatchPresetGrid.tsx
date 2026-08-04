"use client";

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
    <div className={`grid grid-cols-3 ${compact ? "gap-1" : "gap-1.5"}`}>
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
      className={`rounded-lg border text-left transition-all hover:brightness-105 active:scale-[0.98] ${
        compact ? "p-1" : "p-1.5"
      } ${
        active
          ? "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] ring-1 ring-zinc-400/35"
          : "border-transparent bg-[var(--glass-inset-bg)]/60 hover:bg-[var(--glass-inset-bg)]"
      }`}
    >
      <div
        className={`flex w-full overflow-hidden rounded-md border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_4px_rgba(0,0,0,0.12)] ${
          compact ? "h-4" : "h-5"
        }`}
      >
        {colors.map((color) => (
          <span
            key={`${presetId}-${color}`}
            className="min-w-0 flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
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
