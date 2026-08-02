"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LUFTUNG_RANGE,
  HEIZLAST_RANGE_PRESETS,
  KUHLLAST_RANGE_PRESETS,
  heizlastGradientCss,
  kuhllastGradientCss,
  luftungGradientCss,
  legendStopsForMode,
  resolveColorPalette,
  resolveStopsForRange,
  type LegendColorMode,
} from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore, useLegendColorOverrides } from "@/store/useAppStore";
import LegendRangeInput from "./LegendRangeInput";
import LegendPalettePanel from "./LegendPalettePanel";
import PresentationOptionsMenu from "./PresentationOptionsMenu";
import VentilationZonePanel from "./VentilationZonePanel";

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
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const setHeizlastRange = useAppStore((s) => s.setHeizlastRange);
  const setKuhllastRange = useAppStore((s) => s.setKuhllastRange);
  const setTemperatureRange = useAppStore((s) => s.setTemperatureRange);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
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
  const loadKind: LegendColorMode = cooling ? "kuhllast" : "heizlast";
  const loadRange = ventilation
    ? DEFAULT_LUFTUNG_RANGE
    : cooling
      ? kuhllastRange
      : heizlastRange;
  const loadOverrides = cooling ? kuhllastOverrides : heizlastOverrides;
  const loadGradient = (
    direction = "to right",
    paletteId?: string,
    range?: number[],
    overrides?: typeof loadOverrides,
  ) =>
    ventilation
      ? luftungGradientCss(direction, DEFAULT_LUFTUNG_RANGE)
      : cooling
        ? kuhllastGradientCss(direction, paletteId, range, overrides)
        : heizlastGradientCss(direction, paletteId, range, overrides);
  const setLoadRange = cooling ? setKuhllastRange : setHeizlastRange;
  const loadPresets = cooling ? KUHLLAST_RANGE_PRESETS : HEIZLAST_RANGE_PRESETS;
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
    temperatureRange,
    tempOverrides,
  );
  const loadStops = ventilation
    ? resolveStopsForRange(
        [
          { value: 0, color: "#86EFAC" },
          { value: 50, color: "#FDE047" },
          { value: 100, color: "#FB923C" },
          { value: 200, color: "#EF4444" },
          { value: 300, color: "#DC2626" },
          { value: 400, color: "#991B1B" },
        ],
        DEFAULT_LUFTUNG_RANGE,
      )
    : legendStopsForMode(
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
                      ? "text-[11px] font-semibold tracking-wide text-zinc-800"
                      : heading.panel
                  }
                >
                  {t(uiLanguage, "legend")}
                </p>
              }
            />
          ) : (
            !compact && (
              <>
                <p className={heading.panel}>{t(uiLanguage, "legend")}</p>
                {ventilation ? (
                  <VentilationZonePanel className="-mx-1 border-b border-[var(--panel-divider)] pb-2" />
                ) : null}
              </>
            )
          )
        )}
        {ventilation && isPresentationView && compact && (
          <VentilationZonePanel compact className="-mx-0.5 border-b border-[var(--panel-divider)] pb-1" />
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
              <p className="text-[10px] font-medium tracking-wide text-zinc-500">
                {t(
                  uiLanguage,
                  cooling ? "kuhllastTopLeft" : "heizlastTopLeft",
                )}
              </p>
            )}
            <button
              type="button"
              title={ventilation ? t(uiLanguage, "luftungHeatLoss") : t(uiLanguage, "changePalette")}
              onClick={ventilation ? undefined : openLoadPalette}
              aria-expanded={!ventilation && paletteOpen && paletteContext === "load"}
              disabled={ventilation}
              className={`group relative block w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 ${
                ventilation ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <div
                className={`relative w-full overflow-hidden rounded-full border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-95 ${
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
            <div
              className={`flex items-end justify-between gap-0.5 tabular-nums text-zinc-500 ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {loadRange.map((v) => (
                <span key={v} className="min-w-0 truncate text-center">
                  {v}
                </span>
              ))}
            </div>
            {!compareBothModes && rangeOpen && colorMode === "heizlast" && !ventilation && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={loadRange}
                  onCommit={setLoadRange}
                  unitHint="W/m²"
                  presets={loadPresets}
                />
              </div>
            )}
            {!ventilation && paletteOpen && paletteContext === "load" && (
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
                preview={
                  <div
                    className={`relative w-full overflow-hidden rounded-full border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_4px_rgba(0,0,0,0.1)] ${
                      compact ? "h-2.5" : "h-3"
                    }`}
                    style={{
                      background: loadGradient(
                        "to right",
                        effectiveColorPalette,
                        loadRange,
                        loadOverrides,
                      ),
                    }}
                  />
                }
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
            <button
              type="button"
              title={t(uiLanguage, "changePalette")}
              onClick={openTempPalette}
              aria-expanded={paletteOpen && paletteContext === "temperature"}
              className="flex w-full flex-nowrap items-center justify-between gap-0.5 rounded-xl p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            >
              {tempStops.map((s) => (
                <div
                  key={s.value}
                  className={`flex min-w-0 flex-1 flex-col items-center rounded-lg bg-white/45 ${
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
            {!compareBothModes && rangeOpen && colorMode === "temperature" && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={temperatureRange}
                  onCommit={setTemperatureRange}
                  unitHint="°C"
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
                preview={
                  <div
                    className={`flex w-full overflow-hidden rounded-full border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_4px_rgba(0,0,0,0.1)] ${
                      compact ? "h-2.5" : "h-3"
                    }`}
                  >
                    {tempStops.map((s) => (
                      <span
                        key={s.value}
                        className="min-w-0 flex-1"
                        style={{ backgroundColor: s.color }}
                      />
                    ))}
                  </div>
                }
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
