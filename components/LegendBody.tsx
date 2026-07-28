"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_PALETTE_IDS,
  COLOR_PALETTES,
  HEIZLAST_RANGE_PRESETS,
  heizlastGradientCss,
  temperatureLegendStops,
  type ColorPaletteId,
} from "@/lib/colorMapping";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import LegendRangeInput from "./LegendRangeInput";

type Props = {
  /** Kept for callers; legend uses compact top padding either way. */
  paddedTop?: boolean;
  className?: string;
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
  className = "",
}: Props) {
  const colorMode = useAppStore((s) => s.colorMode);
  const setColorMode = useAppStore((s) => s.setColorMode);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const setCompareBothModes = useAppStore((s) => s.setCompareBothModes);
  const activeColorPalette = useAppStore((s) => s.activeColorPalette);
  const setActiveColorPalette = useAppStore((s) => s.setActiveColorPalette);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const setHeizlastRange = useAppStore((s) => s.setHeizlastRange);
  const setTemperatureRange = useAppStore((s) => s.setTemperatureRange);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const rangeBlockRef = useRef<HTMLDivElement>(null);
  const modeBarRef = useRef<HTMLDivElement>(null);

  const tempStops = temperatureLegendStops(
    activeColorPalette,
    temperatureRange,
  );

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
    <div className={`text-zinc-800 ${className}`} ref={pickerRef}>
      <section
        className={`space-y-2.5 px-3 pb-3 ${paddedTop ? "pt-3" : "pt-2.5"}`}
      >
        <p className={heading.panel}>{t(uiLanguage, "legend")}</p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-300/50 bg-white/40 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800">
              {t(uiLanguage, "heizlastPlusTemp")}
            </p>
            <p className="text-[10px] text-zinc-500">
              {t(uiLanguage, "bothModesOneView")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compareBothModes}
            onClick={() => setCompareBothModes(!compareBothModes)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
              compareBothModes ? "bg-sky-600" : "bg-zinc-300/80"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                compareBothModes ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {!compareBothModes && (
        <div
          ref={modeBarRef}
          className="flex rounded-xl border border-zinc-300/50 bg-white/40 p-0.5"
        >
          <div
            className={`flex flex-1 items-center rounded-lg transition-colors ${
              colorMode === "heizlast"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            <button
              type="button"
              onClick={() => setColorMode("heizlast")}
              className="min-w-0 flex-1 whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium"
            >
              {t(uiLanguage, "heizlastWm2")}
            </button>
            <button
              type="button"
              aria-label={
                rangeOpen && colorMode === "heizlast"
                  ? t(uiLanguage, "hideHeizlastRange")
                  : t(uiLanguage, "editHeizlastRange")
              }
              aria-expanded={rangeOpen && colorMode === "heizlast"}
              onClick={() => toggleRange("heizlast")}
              className="flex h-full items-center px-1.5 py-1.5 text-zinc-500 hover:text-zinc-800"
            >
              <Chevron open={rangeOpen && colorMode === "heizlast"} />
            </button>
          </div>
          <div
            className={`flex flex-1 items-center rounded-lg transition-colors ${
              colorMode === "temperature"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            <button
              type="button"
              onClick={() => setColorMode("temperature")}
              className="min-w-0 flex-1 px-2 py-1.5 text-left text-xs font-medium"
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
              className="flex h-full items-center px-1.5 py-1.5 text-zinc-500 hover:text-zinc-800"
            >
              <Chevron open={rangeOpen && colorMode === "temperature"} />
            </button>
          </div>
        </div>
        )}

        {(compareBothModes || colorMode === "heizlast") && (
          <div className="space-y-2">
            {compareBothModes && (
              <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                {t(uiLanguage, "heizlastTopLeft")}
              </p>
            )}
            <button
              type="button"
              title={t(uiLanguage, "changePalette")}
              onClick={() => setPaletteOpen((v) => !v)}
              className="group relative block w-full cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            >
              <div
                className="relative h-4 w-full overflow-hidden rounded-full border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-95"
                style={{
                  background: heizlastGradientCss(
                    "to right",
                    activeColorPalette,
                    heizlastRange,
                  ),
                }}
              >
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/55 to-transparent"
                  aria-hidden
                />
              </div>
            </button>
            <div className="flex items-end justify-between gap-0.5 text-[10px] tabular-nums text-zinc-500">
              {heizlastRange.map((t) => (
                <span key={t} className="min-w-0 truncate text-center">
                  {t}
                </span>
              ))}
            </div>
            {!compareBothModes && rangeOpen && colorMode === "heizlast" && (
              <div ref={rangeBlockRef}>
                <LegendRangeInput
                  values={heizlastRange}
                  onCommit={setHeizlastRange}
                  unitHint="W/m²"
                  presets={HEIZLAST_RANGE_PRESETS}
                />
              </div>
            )}
          </div>
        )}

        {(compareBothModes || colorMode === "temperature") && (
          <div className="space-y-2">
            {compareBothModes && (
              <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                {t(uiLanguage, "tempBottomRight")}
              </p>
            )}
            <button
              type="button"
              title={t(uiLanguage, "changePalette")}
              onClick={() => setPaletteOpen((v) => !v)}
              className="flex w-full flex-nowrap items-center justify-between gap-1 rounded-xl p-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            >
              {tempStops.map((s) => (
                <div
                  key={s.value}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl bg-white/45 px-0.5 py-1.5"
                >
                  <span
                    className="relative inline-block h-4 w-4 shrink-0 overflow-hidden rounded-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_2px_6px_rgba(0,0,0,0.14)]"
                    style={{ backgroundColor: s.color }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent"
                      aria-hidden
                    />
                  </span>
                  <span className="truncate text-[10px] font-medium tabular-nums text-zinc-700">
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
          <div className="space-y-1.5 rounded-xl border border-white/50 bg-white/90 p-2 shadow-md backdrop-blur-md">
            <p className="px-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              {t(uiLanguage, "palette")}
            </p>
            {COLOR_PALETTE_IDS.map((id) => {
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
                  className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    active
                      ? "border-zinc-500/40 bg-zinc-900/5"
                      : "border-transparent hover:bg-zinc-900/5"
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold text-zinc-800">
                    {pal.name}
                  </p>
                  <div
                    className="h-1.5 w-full rounded-full"
                    style={{
                      background: heizlastGradientCss(
                        "to right",
                        id,
                        heizlastRange,
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
