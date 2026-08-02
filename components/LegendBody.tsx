"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_PALETTES,
  HEIZLAST_RANGE_PRESETS,
  KUHLLAST_RANGE_PRESETS,
  USER_COLOR_PALETTE_IDS,
  heizlastGradientCss,
  kuhllastGradientCss,
  resolveColorPalette,
  temperatureLegendStops,
  type ColorPaletteId,
} from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import LegendRangeInput from "./LegendRangeInput";
import PresentationOptionsMenu from "./PresentationOptionsMenu";

type Props = {
  /** Kept for callers; legend uses compact top padding either way. */
  paddedTop?: boolean;
  /** Tighter spacing for mobile presentation dock. */
  compact?: boolean;
  className?: string;
  /** Presentation heating/options menu open — parent can grow the dock. */
  onPresentationMenuOpenChange?: (open: boolean) => void;
};

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
  const setActiveColorPalette = useAppStore((s) => s.setActiveColorPalette);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const isDarkTheme = colorTheme === "dark";
  const effectiveColorPalette = resolveColorPalette(colorTheme, activeColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const setHeizlastRange = useAppStore((s) => s.setHeizlastRange);
  const setKuhllastRange = useAppStore((s) => s.setKuhllastRange);
  const setTemperatureRange = useAppStore((s) => s.setTemperatureRange);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const rangeBlockRef = useRef<HTMLDivElement>(null);
  const modeBarRef = useRef<HTMLDivElement>(null);

  const tempStops = temperatureLegendStops(
    effectiveColorPalette,
    temperatureRange,
  );
  const cooling = dataViewMode === "kuhllast";
  const loadRange = cooling ? kuhllastRange : heizlastRange;
  const loadGradient = cooling ? kuhllastGradientCss : heizlastGradientCss;
  const setLoadRange = cooling ? setKuhllastRange : setHeizlastRange;
  const loadPresets = cooling ? KUHLLAST_RANGE_PRESETS : HEIZLAST_RANGE_PRESETS;

  const toggleRange = (mode: "heizlast" | "temperature") => {
    if (colorMode !== mode) {
      setColorMode(mode);
      setRangeOpen(true);
      return;
    }
    setRangeOpen((v) => !v);
  };

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
              <p className={heading.panel}>{t(uiLanguage, "legend")}</p>
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
              title={t(
                uiLanguage,
                dataViewMode === "luftung"
                  ? "luftungLegend"
                  : dataViewMode === "kuhllast"
                    ? "kuhllastWm2"
                    : "heizlastWm2",
              )}
              className={`min-w-0 flex-1 truncate text-left font-medium ${
                compact
                  ? "px-1 py-1 text-[10px]"
                  : "px-1.5 py-1.5 text-[11px]"
              }`}
            >
              {t(
                uiLanguage,
                dataViewMode === "luftung"
                  ? "luftungLegend"
                  : dataViewMode === "kuhllast"
                    ? "kuhllastWm2"
                    : "heizlastWm2",
              )}
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
              title={t(uiLanguage, "changePalette")}
              onClick={() => setPaletteOpen((v) => !v)}
              className="group relative block w-full cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
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
              {loadRange.map((t) => (
                <span key={t} className="min-w-0 truncate text-center">
                  {t}
                </span>
              ))}
            </div>
            {!compareBothModes && rangeOpen && colorMode === "heizlast" && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={loadRange}
                  onCommit={setLoadRange}
                  unitHint="W/m²"
                  presets={loadPresets}
                />
              </div>
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
              onClick={() => setPaletteOpen((v) => !v)}
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
          </div>
        )}

        {paletteOpen && (
          <div
            className={`rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] shadow-md backdrop-blur-md ${
              compact ? "space-y-1 p-1.5" : "space-y-1.5 p-2"
            }`}
          >
            {isDarkTheme && (
              <p className="px-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
                {t(uiLanguage, "paletteNightHint")}
              </p>
            )}
            <p className="px-0.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              {t(uiLanguage, "palette")}
            </p>
            {USER_COLOR_PALETTE_IDS.map((id) => {
              const pal = COLOR_PALETTES[id];
              const active = activeColorPalette === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveColorPalette(id as ColorPaletteId);
                    setPaletteOpen(false);
                  }}
                  className={`w-full rounded-lg border px-2 text-left transition-colors ${
                    compact ? "py-1" : "py-1.5"
                  } ${
                    active
                      ? "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]"
                      : "border-transparent hover:bg-[var(--glass-inset-bg)]"
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold text-[var(--text-strong)]">
                    {pal.name}
                  </p>
                  <div
                    className="h-1.5 w-full rounded-full"
                    style={{
                      background: loadGradient(
                        "to right",
                        id,
                        loadRange,
                      ),
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
