"use client";

/**
 * LegendBody — shared legend body rendered by LegendPanel and the
 * presentation dock: heizlast/kuhllast/luftung vs temperature mode toggle,
 * gradient/chip scale, editable range (LegendRangeInput), palette popover
 * (LegendPalettePanel), and the ventilation zone panel when in luftung mode.
 *
 * Reads/writes color mode, per-mode ranges, active palette, and swatch
 * overrides from useAppStore and useLegendColorOverrides.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEIZLAST_RANGE_PRESETS,
  KUHLLAST_RANGE_PRESETS,
  LUFTUNG_RANGE_PRESETS,
  buildCoolingLoadRangePresetsFromLoads,
  buildLoadRangePresetsFromLoads,
  buildLuftungRangePresetsFromLosses,
  buildTemperatureRangePresets,
  heizlastGradientCss,
  kuhllastGradientCss,
  luftungGradientCss,
  legendStopsForMode,
  resolveColorPalette,
  type LegendColorMode,
} from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore, useLegendColorOverrides } from "@/store/useAppStore";
import HoverTip from "../common/HoverTip";
import LegendRangeInput from "./LegendRangeInput";
import LegendPalettePanel from "./LegendPalettePanel";
import PresentationOptionsMenu from "../presentation/PresentationOptionsMenu";
import VentilationZonePanel from "../ventilation/VentilationZonePanel";

type Props = {
  /** Kept for callers; legend uses compact top padding either way. */
  paddedTop?: boolean;
  /** Tighter spacing for mobile presentation dock. */
  compact?: boolean;
  className?: string;
  /** Presentation heating/options menu open — parent can grow the dock. */
  onPresentationMenuOpenChange?: (open: boolean) => void;
};

function toColorInputValue(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return `#${h
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  if (h.length === 6) return `#${h}`;
  return "#888888";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${
        open ? "rotate-180" : "rotate-0"
      }`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Shared legend body: mode toggle, scale, editable range, palette picker.
 */
export default function LegendBody({
  paddedTop = false,
  compact = false,
  className = "",
  onPresentationMenuOpenChange,
}: Props) {
  const colorMode = useAppStore((s) => s.colorMode);
  const setColorMode = useAppStore((s) => s.setColorMode);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const setLegendStopColor = useAppStore((s) => s.setLegendStopColor);
  const resetLegendColors = useAppStore((s) => s.resetLegendColors);
  const applyLegendSwatchPreset = useAppStore((s) => s.applyLegendSwatchPreset);
  const legendSwatchPresetId = useAppStore((s) => s.legendSwatchPresetId);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const effectiveColorPalette = resolveColorPalette(colorTheme, activeColorPalette);
  const tempOverrides = useLegendColorOverrides("temperature");
  const heizlastOverrides = useLegendColorOverrides("heizlast");
  const kuhllastOverrides = useLegendColorOverrides("kuhllast");
  const luftungOverrides = useLegendColorOverrides("luftung");
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const luftungRange = useAppStore((s) => s.luftungRange);
  const rooms = useAppStore((s) => s.rooms);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const coolingTemperatureRange = useAppStore((s) => s.coolingTemperatureRange);
  const setTemperatureRange = useAppStore((s) => s.setTemperatureRange);
  const setCoolingTemperatureRange = useAppStore(
    (s) => s.setCoolingTemperatureRange,
  );
  const setHeizlastRange = useAppStore((s) => s.setHeizlastRange);
  const setKuhllastRange = useAppStore((s) => s.setKuhllastRange);
  const setLuftungRange = useAppStore((s) => s.setLuftungRange);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const autoFocusSelection = useAppStore((s) => s.autoFocusSelection);
  const setAutoFocusSelection = useAppStore((s) => s.setAutoFocusSelection);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteContext, setPaletteContext] = useState<"load" | "temperature">(
    "load",
  );
  const [rangeOpen, setRangeOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const rangeBlockRef = useRef<HTMLDivElement>(null);
  const modeBarRef = useRef<HTMLDivElement>(null);

  const cooling = dataViewMode === "kuhllast";
  const ventilation = dataViewMode === "luftung";
  const activeTemperatureRange = cooling
    ? coolingTemperatureRange
    : temperatureRange;
  const setActiveTemperatureRange = cooling
    ? setCoolingTemperatureRange
    : setTemperatureRange;
  const loadKind: LegendColorMode = cooling
    ? "kuhllast"
    : ventilation
      ? "luftung"
      : "heizlast";
  const loadRange = ventilation
    ? luftungRange
    : cooling
      ? kuhllastRange
      : heizlastRange;
  const loadOverrides = cooling
    ? kuhllastOverrides
    : ventilation
      ? luftungOverrides
      : heizlastOverrides;
  const loadGradient = (
    direction = "to right",
    paletteId?: string,
    range?: number[],
    overrides?: typeof loadOverrides,
  ) =>
    ventilation
      ? luftungGradientCss(direction, paletteId, range, overrides)
      : cooling
        ? kuhllastGradientCss(direction, paletteId, range, overrides)
        : heizlastGradientCss(direction, paletteId, range, overrides);
  const setLoadRange = ventilation
    ? setLuftungRange
    : cooling
      ? setKuhllastRange
      : setHeizlastRange;
  const loadPresets = useMemo(() => {
    if (!rooms.length) {
      return ventilation
        ? LUFTUNG_RANGE_PRESETS
        : cooling
          ? KUHLLAST_RANGE_PRESETS
          : HEIZLAST_RANGE_PRESETS;
    }
    if (ventilation) {
      return buildLuftungRangePresetsFromLosses(
        rooms.map((r) => r.ventilation.ventilationHeatLoss || 0),
      );
    }
    if (cooling) {
      return buildCoolingLoadRangePresetsFromLoads(
        rooms.map((r) => r.coolLoad || 0),
      );
    }
    return buildLoadRangePresetsFromLoads(
      rooms.map((r) => r.heatLoad || 0),
    );
  }, [rooms, ventilation, cooling]);
  const tempPresets = useMemo(() => {
    const temps = cooling
      ? rooms
          .map((r) => r.coolTemperature)
          .filter((t): t is number => t != null && t > 0)
      : rooms.map((r) => r.temperature);
    return buildTemperatureRangePresets(temps);
  }, [rooms, cooling]);
  const loadUnitHint = ventilation ? "W" : "W/m²";
  const loadLabelKey = ventilation
    ? "luftungHeatLoss"
    : cooling
      ? "kuhllastWm2"
      : "heizlastWm2";
  const hasLoadOverrides = Object.keys(loadOverrides).length > 0;
  const hasTempOverrides = Object.keys(tempOverrides).length > 0;

  const tempStops = legendStopsForMode(
    "temperature",
    effectiveColorPalette,
    activeTemperatureRange,
    tempOverrides,
  );
  const loadStops = legendStopsForMode(
    loadKind,
    effectiveColorPalette,
    loadRange,
    loadOverrides,
  );

  const openLoadPalette = () => {
    setPaletteContext("load");
    setPaletteOpen((v) => (paletteContext === "load" ? !v : true));
  };

  const openTempPalette = () => {
    setPaletteContext("temperature");
    setPaletteOpen((v) => (paletteContext === "temperature" ? !v : true));
  };

  const toggleRange = (mode: "heizlast" | "temperature") => {
    if (colorMode !== mode) {
      setColorMode(mode);
      setRangeOpen(true);
      return;
    }
    setRangeOpen((v) => !v);
  };

  useEffect(() => {
    setPaletteContext(colorMode === "heizlast" ? "load" : "temperature");
  }, [colorMode]);

  useEffect(() => {
    if (!paletteOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [paletteOpen]);

  useEffect(() => {
    if (!rangeOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rangeBlockRef.current?.contains(t)) return;
      if (modeBarRef.current?.contains(t)) return;
      setRangeOpen(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [rangeOpen]);

  return (
    <div
      className={`w-full min-w-0 overflow-visible text-[var(--text-body)] ${className}`}
      ref={pickerRef}
    >
      <section
        className={
          compact
            ? "relative space-y-1 overflow-visible px-2 pb-1.5 pt-1"
            : `relative space-y-2.5 px-3 pb-3 ${paddedTop ? "pt-3" : "pt-2.5"}`
        }
      >
        {(isPresentationView || !compact) && (
          isPresentationView ? (
            <PresentationOptionsMenu
              compact={compact}
              onMenuOpenChange={onPresentationMenuOpenChange}
              title={
                <p
                  className={
                    compact
                      ? "text-[11px] font-semibold tracking-wide text-[var(--text-strong)]"
                      : heading.panel
                  }
                >
                  {t(uiLanguage, "legend")}
                </p>
              }
            />
          ) : (
            !compact && (
              <div className="flex items-center justify-between gap-2">
                <p className={heading.panel}>{t(uiLanguage, "legend")}</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFocusSelection}
                  title={t(uiLanguage, "autoFocusHint")}
                  aria-label={t(uiLanguage, "autoFocus")}
                  onClick={() => setAutoFocusSelection(!autoFocusSelection)}
                  className={`pdf-capture-hide flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 transition-colors ${
                    autoFocusSelection
                      ? "border-amber-300/80 bg-amber-200/70 text-amber-950"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                  }`}
                >
                  <span
                    className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                      autoFocusSelection ? "bg-amber-500" : "bg-zinc-300/80"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
                        autoFocusSelection ? "translate-x-2.5" : "translate-x-0"
                      }`}
                    />
                  </span>
                  <span className="text-[9px] font-semibold tracking-wide whitespace-nowrap">
                    {t(uiLanguage, "autoFocus")}
                  </span>
                </button>
              </div>
            )
          )
        )}
        {!compareBothModes && (
        <div
          ref={modeBarRef}
          className={`legend-mode-bar flex rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] ${
            compact ? "p-0.5" : "p-0.5"
          }`}
        >
          <div
            className={`flex flex-1 items-center rounded-lg transition-colors ${
              colorMode === "heizlast"
                ? "legend-segment-active bg-[var(--chip-active-bg)] text-[var(--chip-active-text)] shadow-sm"
                : "legend-segment-idle text-[var(--text-muted)]"
            }`}
          >
            <button
              type="button"
              onClick={() => setColorMode("heizlast")}
              title={t(uiLanguage, loadLabelKey)}
              className={`min-w-0 flex-1 truncate text-left font-medium ${
                compact
                  ? "px-1 py-1 text-[10px]"
                  : "px-1.5 py-1.5 text-[11px]"
              }`}
            >
              {t(uiLanguage, loadLabelKey)}
            </button>
            <button
              type="button"
              aria-label={
                rangeOpen && colorMode === "heizlast"
                  ? t(
                      uiLanguage,
                      cooling ? "hideKuhllastRange" : "hideHeizlastRange",
                    )
                  : t(
                      uiLanguage,
                      cooling ? "editKuhllastRange" : "editHeizlastRange",
                    )
              }
              aria-expanded={rangeOpen && colorMode === "heizlast"}
              onClick={() => toggleRange("heizlast")}
              className={`flex h-full items-center text-[var(--text-muted)] hover:text-[var(--text-strong)] ${
                compact ? "px-1 py-1" : "px-1.5 py-1.5"
              }`}
            >
              <Chevron open={rangeOpen && colorMode === "heizlast"} />
            </button>
          </div>
          <div
            className={`flex flex-1 items-center rounded-lg transition-colors ${
              colorMode === "temperature"
                ? "legend-segment-active bg-[var(--chip-active-bg)] text-[var(--chip-active-text)] shadow-sm"
                : "legend-segment-idle text-[var(--text-muted)]"
            }`}
          >
            <button
              type="button"
              onClick={() => setColorMode("temperature")}
              className={`min-w-0 flex-1 whitespace-nowrap text-left font-medium ${
                compact
                  ? "px-1 py-1 text-[10px]"
                  : "px-1.5 py-1.5 text-[11px]"
              }`}
            >
              {t(uiLanguage, "temperature")}
            </button>
            <button
              type="button"
              aria-label={
                rangeOpen && colorMode === "temperature"
                  ? t(uiLanguage, "hideTempRange")
                  : t(uiLanguage, "editTempRange")
              }
              aria-expanded={rangeOpen && colorMode === "temperature"}
              onClick={() => toggleRange("temperature")}
              className={`flex h-full items-center text-[var(--text-muted)] hover:text-[var(--text-strong)] ${
                compact ? "px-1 py-1" : "px-1.5 py-1.5"
              }`}
            >
              <Chevron open={rangeOpen && colorMode === "temperature"} />
            </button>
          </div>
        </div>
        )}

        {(compareBothModes || colorMode === "heizlast") && (
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {compareBothModes && (
              <p className="text-[10px] font-medium tracking-wide text-[var(--text-muted)]">
                {t(
                  uiLanguage,
                  cooling ? "kuhllastTopLeft" : "heizlastTopLeft",
                )}
              </p>
            )}
            <HoverTip
              label={t(uiLanguage, "changePalette")}
              hint={t(uiLanguage, "changePaletteHint")}
              placement="below"
              className="block w-full"
            >
              <button
                type="button"
                onClick={openLoadPalette}
                aria-expanded={paletteOpen && paletteContext === "load"}
                aria-label={t(uiLanguage, "changePalette")}
                className="group relative block w-full cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--panel-divider)]"
              >
              <div
                className={`relative w-full overflow-hidden rounded-full border border-[var(--glass-border)] shadow-[inset_0_1px_0_var(--glass-specular),0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-95 ${
                  compact ? "h-3" : "h-4"
                }`}
                style={{
                  background: loadGradient(
                    "to right",
                    effectiveColorPalette,
                    loadRange,
                    loadOverrides,
                  ),
                }}
              >
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/55 to-transparent"
                  aria-hidden
                />
              </div>
              </button>
            </HoverTip>
            <div
              className={`grid w-full gap-0.5 tabular-nums text-[var(--text-muted)] ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
              style={{ gridTemplateColumns: `repeat(${loadRange.length}, minmax(0, 1fr))` }}
            >
              {loadRange.map((v) => (
                <span key={v} className="min-w-0 truncate text-center">
                  {v}
                </span>
              ))}
            </div>
            {!compareBothModes && rangeOpen && colorMode === "heizlast" && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={loadRange}
                  onCommit={setLoadRange}
                  unitHint={loadUnitHint}
                  presets={loadPresets}
                />
              </div>
            )}
            {paletteOpen && paletteContext === "load" && (
              <LegendPalettePanel
                mode={loadKind}
                uiLanguage={uiLanguage}
                compact={compact}
                stops={loadStops}
                unitSuffix=""
                activePresetId={legendSwatchPresetId[loadKind]}
                hasOverrides={hasLoadOverrides}
                onSelectPreset={(id) => applyLegendSwatchPreset(loadKind, id)}
                onStopColor={(value, color) =>
                  setLegendStopColor(loadKind, value, color)
                }
                onReset={() => resetLegendColors(loadKind)}
                toColorInputValue={toColorInputValue}
              />
            )}
          </div>
        )}

        {(compareBothModes || colorMode === "temperature") && (
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {compareBothModes && (
              <p className="text-[10px] font-medium tracking-wide text-zinc-500">
                {t(uiLanguage, "tempBottomRight")}
              </p>
            )}
            <HoverTip
              label={t(uiLanguage, "changePalette")}
              hint={t(uiLanguage, "changePaletteHint")}
              placement="below"
              className="block w-full"
            >
              <button
                type="button"
                onClick={openTempPalette}
                aria-expanded={paletteOpen && paletteContext === "temperature"}
                aria-label={t(uiLanguage, "changePalette")}
                className="grid w-full gap-0.5 rounded-xl p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
                style={{ gridTemplateColumns: `repeat(${tempStops.length}, minmax(0, 1fr))` }}
              >
              {tempStops.map((s) => (
                <div
                  key={s.value}
                  className={`flex min-w-0 flex-col items-center rounded-lg bg-white/45 ${
                    compact
                      ? "gap-0.5 px-0.5 py-0.5"
                      : "gap-1 px-0.5 py-1.5 rounded-xl"
                  }`}
                >
                  <span
                    className={`relative inline-block shrink-0 overflow-hidden rounded-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_6px_rgba(0,0,0,0.14)] ${
                      compact ? "h-3 w-3" : "h-4 w-4"
                    }`}
                    style={{ backgroundColor: s.color }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent"
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`truncate font-medium tabular-nums text-zinc-700 ${
                      compact ? "text-[9px]" : "text-[10px]"
                    }`}
                  >
                    {s.value}°
                  </span>
                </div>
              ))}
              </button>
            </HoverTip>
            {!compareBothModes && rangeOpen && colorMode === "temperature" && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={activeTemperatureRange}
                  onCommit={setActiveTemperatureRange}
                  unitHint="°C"
                  presets={tempPresets}
                />
              </div>
            )}
            {paletteOpen && paletteContext === "temperature" && (
              <LegendPalettePanel
                mode="temperature"
                uiLanguage={uiLanguage}
                compact={compact}
                stops={tempStops}
                unitSuffix="°"
                activePresetId={legendSwatchPresetId.temperature}
                hasOverrides={hasTempOverrides}
                onSelectPreset={(id) => applyLegendSwatchPreset("temperature", id)}
                onStopColor={(value, color) =>
                  setLegendStopColor("temperature", value, color)
                }
                onReset={() => resetLegendColors("temperature")}
                toColorInputValue={toColorInputValue}
              />
            )}
          </div>
        )}

        {ventilation && !(isPresentationView && presentationIsolate) ? (
          <VentilationZonePanel
            compact={compact}
            className="border-t border-[var(--panel-divider)] pt-1.5"
          />
        ) : null}
      </section>
    </div>
  );
}
