"use client";

/**
 * SliceHeightSlider — slider that scrubs the horizontal slice plane's
 * height within the currently selected floor's vertical span.
 *
 * Computes the floor's [elevation, next-floor elevation] range from
 * `floors`/`selectedFloor`, maps 0–100 slider ticks to `sliceProgress` in
 * useAppStore, and displays the resulting height in meters.
 */

import { useMemo } from "react";
import Slider from "./ui/Slider";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/lib/i18n";
import type { Floor } from "@/lib/types";

export default function SliceHeightSlider({
  floors,
  selectedFloor,
  disabled,
}: {
  floors: Floor[];
  selectedFloor: string | null;
  disabled?: boolean;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const sliceProgress = useAppStore((s) => s.sliceProgress);
  const setSliceProgress = useAppStore((s) => s.setSliceProgress);

  const isDisabled = Boolean(disabled) || !selectedFloor || floors.length === 0;

  const { yMin, yMax, heightLabel } = useMemo(() => {
    if (isDisabled) {
      return {
        yMin: null,
        yMax: null,
        heightLabel: "—",
      };
    }
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    const idx = sorted.findIndex((f) => f.id === selectedFloor);
    const floor = sorted[idx];
    const next = sorted[idx + 1];
    const yMin = floor?.elevation ?? 0;
    const yMax = next?.elevation ?? yMin + 3;
    const y = yMin + sliceProgress * Math.max(0.05, yMax - yMin);
    const toM = (v: number) => (Math.abs(v) > 100 ? v / 1000 : v);
    return {
      yMin: toM(yMin),
      yMax: toM(yMax),
      heightLabel: `${toM(y).toFixed(2)} m`,
    };
  }, [floors, selectedFloor, sliceProgress, isDisabled]);

  return (
    <div className="glass-inset rounded-xl px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-600">
          {t(uiLanguage, "sliceHeight")}
        </p>
        <p className="tabular-nums text-[11px] font-medium text-zinc-800">
          {heightLabel}
        </p>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={Math.round(sliceProgress * 100)}
        onChange={(v) => setSliceProgress(v / 100)}
        disabled={isDisabled}
        aria-label={t(uiLanguage, "sliceHeight")}
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>
          {t(uiLanguage, "floor")} {yMin == null ? "—" : `${yMin.toFixed(1)} m`}
        </span>
        <span>{isDisabled ? "—" : t(uiLanguage, "middle")}</span>
        <span>
          {t(uiLanguage, "ceiling")} {yMax == null ? "—" : `${yMax.toFixed(1)} m`}
        </span>
      </div>
    </div>
  );
}

