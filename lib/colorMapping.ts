/**
 * Color mapping engine for the Heizlast/Kühllast/Lüftung/temperature legends.
 *
 * Defines the built-in color palettes (stops per data mode), default and
 * adaptive legend ranges fitted to room-value distributions, and the
 * value→color/gradient functions (heizlastToColor, kuhllastToColor, etc.)
 * used by the 3D room materials, legend UI, and PDF export.
 */
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export type ColorStop = { value: number; color: string };

export type ColorPaletteId =
  | "standard"
  | "softPastel"
  | "warmPastel"
  | "dark";

export type ColorPalette = {
  id: ColorPaletteId;
  name: string;
  heizlastStops: ColorStop[];
  /** Summer cooling load (Kühllast) — cyan → teal → indigo → violet. */
  kuhllastStops: ColorStop[];
  temperatureStops: ColorStop[];
};

/** Thermal Classic standard — mid blue → thick blue → gold → orange → red → brown. */
const STANDARD_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#87CEEB" },
  { value: 0, color: "#3D7EFF" },
  { value: 10, color: "#0050FF" },
  { value: 20, color: "#FFDC00" },
  { value: 30, color: "#FF8C00" },
  { value: 40, color: "#DC0000" },
  { value: 50, color: "#7A3300" },
  { value: Number.POSITIVE_INFINITY, color: "#4A1F00" },
];

/** Summer cooling — vivid sky → cobalt (readable on glass rooms in 3D). */
const STANDARD_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E3B98A" },
  { value: 0, color: "#E3B98A" },
  { value: 25, color: "#A78BFA" },
  { value: 50, color: "#1E40AF" },
  { value: Number.POSITIVE_INFINITY, color: "#1E40AF" },
];

const STANDARD_TEMP: ColorStop[] = [
  { value: 6, color: "#1B3A6B" },
  { value: 15, color: "#1F8A70" },
  { value: 18, color: "#4CAF50" },
  { value: 20, color: "#D9A400" },
  { value: 24, color: "#E8590C" },
];

/** Soft pastels — light blue → soft blue → butter → peach → rose. */
const SOFT_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E4F4FB" },
  { value: 0, color: "#C5E8F5" },
  { value: 10, color: "#8BB8E8" },
  { value: 20, color: "#F5F0C8" },
  { value: 30, color: "#E8D98A" },
  { value: 40, color: "#E8B089" },
  { value: 50, color: "#D98989" },
  { value: Number.POSITIVE_INFINITY, color: "#B07A6A" },
];

const SOFT_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#F5E5D6" },
  { value: 0, color: "#F5E5D6" },
  { value: 25, color: "#DDD6FE" },
  { value: 50, color: "#3B82F6" },
  { value: Number.POSITIVE_INFINITY, color: "#3B82F6" },
];

const SOFT_TEMP: ColorStop[] = [
  { value: 6, color: "#8FA8C8" },
  { value: 15, color: "#8FC4B0" },
  { value: 18, color: "#A8D4A0" },
  { value: 20, color: "#E8D090" },
  { value: 24, color: "#E8A888" },
];

/** Warm pastels — dusty lilac / apricot / coral / terracotta. */
const WARM_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#D4C8E8" },
  { value: 0, color: "#A89AD4" },
  { value: 10, color: "#A89AD4" },
  { value: 20, color: "#F5E4C8" },
  { value: 25, color: "#F0C898" },
  { value: 30, color: "#F0C898" },
  { value: 40, color: "#E8A070" },
  { value: 50, color: "#D87868" },
  { value: Number.POSITIVE_INFINITY, color: "#A86858" },
];

/** Warm-summer cooling — mint → lagoon → periwinkle → soft plum. */
const WARM_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E5C39E" },
  { value: 0, color: "#E5C39E" },
  { value: 25, color: "#C0A7FA" },
  { value: 50, color: "#2563EB" },
  { value: Number.POSITIVE_INFINITY, color: "#2563EB" },
];

const WARM_TEMP: ColorStop[] = [
  { value: 6, color: "#9A8AB8" },
  { value: 15, color: "#A8B890" },
  { value: 18, color: "#C8C080" },
  { value: 20, color: "#E8B878" },
  { value: 24, color: "#E89078" },
];

/** Dark night — soft blue → amber → ember (warm mids early). */
const DARK_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#2A3A55" },
  { value: 0, color: "#3A5F9E" },
  { value: 10, color: "#B8922E" },
  { value: 20, color: "#D4A017" },
  { value: 30, color: "#C45C1A" },
  { value: 40, color: "#A82828" },
  { value: 50, color: "#8B1A1A" },
  { value: Number.POSITIVE_INFINITY, color: "#5C1818" },
];

const DARK_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#8A623A" },
  { value: 0, color: "#8A623A" },
  { value: 25, color: "#58457D" },
  { value: 50, color: "#1E3A8A" },
  { value: Number.POSITIVE_INFINITY, color: "#1E3A8A" },
];

const DARK_TEMP: ColorStop[] = [
  { value: 6, color: "#1E3A5F" },
  { value: 15, color: "#1F5C4A" },
  { value: 18, color: "#2E6B3A" },
  { value: 20, color: "#8A6B14" },
  { value: 24, color: "#A84818" },
];

export const COLOR_PALETTES: Record<ColorPaletteId, ColorPalette> = {
  standard: {
    id: "standard",
    name: "Standard",
    heizlastStops: STANDARD_HEIZLAST,
    kuhllastStops: STANDARD_KUHLLAST,
    temperatureStops: STANDARD_TEMP,
  },
  softPastel: {
    id: "softPastel",
    name: "Soft Pastel",
    heizlastStops: SOFT_HEIZLAST,
    kuhllastStops: SOFT_KUHLLAST,
    temperatureStops: SOFT_TEMP,
  },
  warmPastel: {
    id: "warmPastel",
    name: "Warm Pastel",
    heizlastStops: WARM_HEIZLAST,
    kuhllastStops: WARM_KUHLLAST,
    temperatureStops: WARM_TEMP,
  },
  dark: {
    id: "dark",
    name: "Dark",
    heizlastStops: DARK_HEIZLAST,
    kuhllastStops: DARK_KUHLLAST,
    temperatureStops: DARK_TEMP,
  },
};

export const COLOR_PALETTE_IDS = Object.keys(
  COLOR_PALETTES,
) as ColorPaletteId[];

export function getPalette(id: ColorPaletteId | string | null | undefined): ColorPalette {
  if (id && id in COLOR_PALETTES) return COLOR_PALETTES[id as ColorPaletteId];
  return COLOR_PALETTES.standard;
}

/** Moon / night theme uses the dark palette; day theme uses the user palette. */
export function resolveColorPalette(
  theme: import("@/lib/themeColors").ColorTheme,
  paletteId: ColorPaletteId,
): ColorPaletteId {
  if (theme === "dark") return "dark";
  return paletteId === "dark" ? "standard" : paletteId;
}

/** Palettes the user can pick — dark is tied to moon theme. */
export const USER_COLOR_PALETTE_IDS = COLOR_PALETTE_IDS.filter(
  (id) => id !== "dark",
);

/** @deprecated use getPalette(id).heizlastStops — kept for callers expecting HEIZLAST_STOPS */
export const HEIZLAST_STOPS = STANDARD_HEIZLAST;
export const TEMPERATURE_STOPS = STANDARD_TEMP;

export function heizlastStopsFor(paletteId?: ColorPaletteId | string): ColorStop[] {
  return getPalette(paletteId).heizlastStops;
}

export function kuhllastStopsFor(paletteId?: ColorPaletteId | string): ColorStop[] {
  return getPalette(paletteId).kuhllastStops;
}

export function temperatureStopsFor(paletteId?: ColorPaletteId | string): ColorStop[] {
  return getPalette(paletteId).temperatureStops;
}

export const DEFAULT_HEIZLAST_RANGE = [0, 10, 20, 30, 40, 50];
/** Solar Computer convention: 0 → more negative = higher cooling. */
export const DEFAULT_KUHLLAST_RANGE = [0, -10, -20, -30, -40, -50];
export const DEFAULT_LUFTUNG_RANGE = [0, 50, 100, 150, 200, 300, 400];
export const DEFAULT_TEMPERATURE_RANGE = [0, 6, 15, 18, 20, 24];
/** Summer / cooling analysis temperatures (Solar Computer MAX / operative). */
export const DEFAULT_COOLING_TEMPERATURE_RANGE = [20, 22, 24, 26, 28, 30];
export const MIN_LEGEND_STOPS = 6;
/** Allow denser temperature legends when IFC rooms introduce extra °C stops. */
export const MAX_LEGEND_STOPS = 12;

export type LegendRangePreset = {
  id: string;
  label: string;
  values: number[];
};

/** Built-in Heizlast / Kühllast range presets (fallback when no model data). */
export const HEIZLAST_RANGE_PRESETS: LegendRangePreset[] = [
  { id: "to-30", label: "0, 6, 12, 18, 24, 30", values: [0, 6, 12, 18, 24, 30] },
  { id: "to-40", label: "0, 8, 16, 24, 32, 40", values: [0, 8, 16, 24, 32, 40] },
  { id: "to-50", label: "0, 10, 20, 30, 40, 50", values: [0, 10, 20, 30, 40, 50] },
  { id: "to-60", label: "0, 12, 24, 36, 48, 60", values: [0, 12, 24, 36, 48, 60] },
  { id: "to-75", label: "0, 15, 30, 45, 60, 75", values: [0, 15, 30, 45, 60, 75] },
  { id: "to-80", label: "0, 16, 32, 48, 64, 80", values: [0, 16, 32, 48, 64, 80] },
  { id: "to-90", label: "0, 18, 36, 54, 72, 90", values: [0, 18, 36, 54, 72, 90] },
  { id: "to-100", label: "0, 20, 40, 60, 80, 100", values: [0, 20, 40, 60, 80, 100] },
];

/** Kühllast presets — same magnitudes as Heizlast, Solar Computer signed. */
export const KUHLLAST_RANGE_PRESETS: LegendRangePreset[] =
  HEIZLAST_RANGE_PRESETS.map((p) => {
    const values = p.values.map((v) => -v);
    return { id: p.id, label: values.join(", "), values };
  });

/** Ventilation heat loss (W) — same color anchors as Heizlast, W-scale range. */
export const LUFTUNG_RANGE_PRESETS: LegendRangePreset[] = [
  { id: "to-150", label: "0, 25, 50, 75, 100, 150", values: [0, 25, 50, 75, 100, 150] },
  { id: "to-200", label: "0, 25, 50, 100, 150, 200", values: [0, 25, 50, 100, 150, 200] },
  { id: "to-300", label: "0, 50, 100, 150, 200, 300", values: [0, 50, 100, 150, 200, 300] },
  { id: "to-400", label: "0, 50, 100, 150, 200, 300, 400", values: [0, 50, 100, 150, 200, 300, 400] },
  { id: "to-500", label: "0, 100, 200, 300, 400, 500", values: [0, 100, 200, 300, 400, 500] },
  { id: "to-600", label: "0, 100, 200, 300, 400, 500, 600", values: [0, 100, 200, 300, 400, 500, 600] },
  { id: "to-800", label: "0, 100, 200, 400, 600, 800", values: [0, 100, 200, 400, 600, 800] },
];

/** Round up to a nice legend ceiling. */
export function niceCeil(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return step;
  return Math.ceil(value / step) * step;
}

/** Round to nearest step (for distribution-based interior stops). */
export function niceRound(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return Math.round(value / step) * step;
}

/** Evenly spaced 0…top stops (6 by default). */
export function buildEvenLegendRange(
  top: number,
  stopCount = 6,
): number[] {
  const n = Math.max(
    MIN_LEGEND_STOPS,
    Math.min(MAX_LEGEND_STOPS, Math.round(stopCount)),
  );
  const safeTop = Math.max(1, top);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round((safeTop * i) / (n - 1)));
  }
  const sorted = [...new Set(out)].sort((a, b) => a - b);
  if (sorted.length < MIN_LEGEND_STOPS) {
    return buildEvenLegendRange(safeTop, MIN_LEGEND_STOPS);
  }
  return sorted;
}

/**
 * Place legend stops where rooms actually sit (quantiles), not only evenly.
 * Always keeps 0 and `top`. Falls back to even spacing when too few samples.
 *
 * When `denseBand` is set, most interior stops sit between the bulk P10–P90
 * so a cluster (e.g. 20–40 W/m²) gets most of the color contrast.
 */
export function buildDistributionLegendRange(
  loads: number[],
  top: number,
  stopCount = 6,
  step = 5,
  opts?: { minStops?: number; denseBand?: boolean },
): number[] {
  const minStops = opts?.minStops ?? MIN_LEGEND_STOPS;
  const n = Math.max(
    minStops,
    Math.min(MAX_LEGEND_STOPS, Math.round(stopCount)),
  );
  const safeTop = Math.max(step, niceCeil(top, step));
  const vals = loads
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= safeTop * 1.001)
    .sort((a, b) => a - b);

  if (vals.length < 3) {
    return buildEvenLegendRange(safeTop, Math.max(n, MIN_LEGEND_STOPS));
  }

  const stops = new Set<number>([0, safeTop]);
  const interior = Math.max(0, n - 2);

  if (opts?.denseBand && interior > 0) {
    // Pack contrast into the band where most rooms sit (central ~80%).
    const loIdx = Math.min(
      vals.length - 1,
      Math.max(0, Math.floor((vals.length - 1) * 0.1)),
    );
    const hiIdx = Math.min(
      vals.length - 1,
      Math.max(loIdx, Math.floor((vals.length - 1) * 0.9)),
    );
    let bandLo = niceRound(vals[loIdx]!, step);
    let bandHi = niceRound(vals[hiIdx]!, step);
    // Keep an interior edge under the bulk ceiling when P90 sits on `top`.
    if (bandHi >= safeTop && safeTop > step) {
      const below = vals
        .map((v) => niceRound(v, step))
        .filter((v) => v < safeTop);
      if (below.length) bandHi = below[below.length - 1]!;
    }
    bandLo = Math.max(0, Math.min(safeTop, bandLo));
    bandHi = Math.max(0, Math.min(safeTop, bandHi));
    if (bandHi > bandLo) {
      stops.add(bandLo);
      stops.add(bandHi);
      const midSlots = Math.max(0, interior - 2);
      for (let i = 1; i <= midSlots; i++) {
        const t = i / (midSlots + 1);
        const idx = Math.min(
          vals.length - 1,
          Math.max(loIdx, Math.round(loIdx + t * (hiIdx - loIdx))),
        );
        const fromRoom = niceRound(vals[idx]!, step);
        const target = niceRound(bandLo + (bandHi - bandLo) * t, step);
        const blended = niceRound(target * 0.35 + fromRoom * 0.65, step);
        stops.add(Math.max(0, Math.min(safeTop, blended)));
      }
    } else {
      for (let i = 1; i <= interior; i++) {
        const t = i / (interior + 1);
        const idx = Math.min(
          vals.length - 1,
          Math.max(0, Math.ceil(vals.length * t) - 1),
        );
        stops.add(
          Math.max(0, Math.min(safeTop, niceRound(vals[idx]!, step))),
        );
      }
    }
  } else {
    for (let i = 1; i <= interior; i++) {
      const t = i / (interior + 1);
      const idx = Math.min(
        vals.length - 1,
        Math.max(0, Math.ceil(vals.length * t) - 1),
      );
      const rounded = niceRound(vals[idx]!, step);
      stops.add(Math.max(0, Math.min(safeTop, rounded)));
    }
  }

  let sorted = [...stops].sort((a, b) => a - b);

  // Fill largest gaps; with denseBand skip the empty 0→first-room stretch.
  while (sorted.length < n) {
    let bestI = -1;
    let bestGap = -1;
    const gapStart = opts?.denseBand && sorted[0] === 0 ? 1 : 0;
    for (let i = gapStart; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > bestGap) {
        bestGap = gap;
        bestI = i;
      }
    }
    if (bestI < 0 || bestGap <= step) break;
    const mid = niceRound((sorted[bestI]! + sorted[bestI + 1]!) / 2, step);
    if (mid <= sorted[bestI]! || mid >= sorted[bestI + 1]!) break;
    stops.add(mid);
    sorted = [...stops].sort((a, b) => a - b);
  }

  if (sorted.length < minStops) {
    return buildEvenLegendRange(safeTop, Math.max(n, MIN_LEGEND_STOPS));
  }
  if (sorted.length <= n) return sorted;
  return thinLegendStops(sorted, n, new Set([0, safeTop]));
}

/** Thin a sorted stop list to `n` while keeping required anchors. */
function thinLegendStops(
  sorted: number[],
  n: number,
  keep: Set<number>,
): number[] {
  if (sorted.length <= n) return sorted;
  const required = sorted.filter((v) => keep.has(v));
  const optional = sorted.filter((v) => !keep.has(v));
  const slots = Math.max(0, n - required.length);
  if (slots <= 0) {
    return [...new Set([sorted[0]!, ...required, sorted[sorted.length - 1]!])]
      .sort((a, b) => a - b)
      .slice(0, n);
  }
  const picked: number[] = [];
  for (let i = 0; i < slots && optional.length; i++) {
    const idx = Math.round((i * (optional.length - 1)) / Math.max(1, slots - 1));
    picked.push(optional[Math.min(optional.length - 1, idx)]!);
  }
  return [...new Set([...required, ...picked])].sort((a, b) => a - b);
}

/**
 * Heizlast / Lüftung auto range from room samples.
 *
 * Always packs color stops into where most rooms sit (dense band).
 * When ≤~10% of rooms spike above the bulk, reserves the last stop/color
 * for those outliers (e.g. …, 50, 80).
 */
export function pickAdaptivePositiveLoadRange(
  loads: number[],
  opts: { minTop: number; step: number; stopCount: number },
  emptyDefault: number[],
): number[] {
  const vals = loads.filter((v) => Number.isFinite(v) && v >= 0);
  if (!vals.length) return [...emptyDefault];

  const scale = analyzeLoadScale(vals, {
    minTop: opts.minTop,
    step: opts.step,
  });
  const n = Math.max(
    MIN_LEGEND_STOPS,
    Math.min(MAX_LEGEND_STOPS, opts.stopCount),
  );

  // Adaptive end-stop when a small share of rooms spike (~≤10%).
  const maxSparse = Math.max(1, Math.ceil(vals.length * 0.1));
  const fewOutliers =
    scale.absoluteTop > scale.typicalTop &&
    scale.outlierCount >= 1 &&
    scale.outlierCount <= maxSparse;

  if (fewOutliers) {
    const bulkCount = n - 1;
    const bulk = buildDistributionLegendRange(
      vals,
      scale.typicalTop,
      bulkCount,
      opts.step,
      { minStops: Math.max(3, bulkCount), denseBand: true },
    );
    const merged = [
      ...new Set([
        ...bulk.filter((v) => v < scale.absoluteTop),
        scale.typicalTop,
        scale.absoluteTop,
      ]),
    ].sort((a, b) => a - b);
    return thinLegendStops(
      merged,
      n,
      new Set([0, scale.typicalTop, scale.absoluteTop]),
    );
  }

  // Always fit stops to where rooms sit (e.g. denser colors in 20–40 W/m²).
  return buildDistributionLegendRange(vals, scale.typicalTop, n, opts.step, {
    denseBand: true,
  });
}

const HEAT_TOP_LADDER = [
  30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 120, 150, 200,
];
const LUFT_TOP_LADDER = [
  150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200,
];

function buildPresetsForTops(
  tops: number[],
  stopCount = 6,
): LegendRangePreset[] {
  const unique = [...new Set(tops.filter((t) => t > 0))].sort((a, b) => a - b);
  return unique.map((top) => {
    const values = buildEvenLegendRange(top, stopCount);
    return {
      id: `to-${top}`,
      label: values.join(", "),
      values,
    };
  });
}

/**
 * Presets for Heizlast / Kühllast from room loads — ladder around the
 * recommended (bulk) scale plus a full-max option when outliers exist.
 */
export function buildLoadRangePresetsFromMax(
  maxLoad: number,
): LegendRangePreset[] {
  return buildLoadRangePresetsFromLoads(
    Number.isFinite(maxLoad) && maxLoad > 0 ? [maxLoad] : [],
  );
}

/** Prefer this when room samples are available (outlier-aware). */
export function buildLoadRangePresetsFromLoads(
  loads: number[],
): LegendRangePreset[] {
  const scale = analyzeLoadScale(loads, { minTop: 50, step: 5 });
  const tops = HEAT_TOP_LADDER.filter(
    (t) => t <= Math.max(100, scale.absoluteTop + 25),
  );
  for (const t of [scale.typicalTop, scale.absoluteTop]) {
    if (t > 0 && !tops.includes(t)) tops.push(t);
  }
  const presets = buildPresetsForTops(tops.sort((a, b) => a - b));
  const typical = pickAdaptivePositiveLoadRange(
    loads,
    { minTop: 50, step: 5, stopCount: 6 },
    DEFAULT_HEIZLAST_RANGE,
  );
  const withoutDup = presets.filter(
    (p) => p.values.join(",") !== typical.join(","),
  );
  return [
    {
      id: "typical",
      label: `${typical.join(", ")} · auto`,
      values: typical,
    },
    ...withoutDup,
  ].slice(0, 12);
}

/** Cooling presets — magnitudes from |loads|, values signed like Solar Computer. */
export function buildCoolingLoadRangePresetsFromLoads(
  loads: number[],
): LegendRangePreset[] {
  const mags = loads.filter((v) => Number.isFinite(v)).map((v) => Math.abs(v));
  return buildLoadRangePresetsFromLoads(mags).map((p) => {
    const values = p.values.map((v) => -v);
    return {
      id: p.id,
      label: p.label.includes("· auto")
        ? `${values.join(", ")} · auto`
        : values.join(", "),
      values,
    };
  });
}

export function buildLuftungRangePresetsFromMax(
  maxLoss: number,
): LegendRangePreset[] {
  return buildLuftungRangePresetsFromLosses(
    Number.isFinite(maxLoss) && maxLoss > 0 ? [maxLoss] : [],
  );
}

export function buildLuftungRangePresetsFromLosses(
  losses: number[],
): LegendRangePreset[] {
  const scale = analyzeLoadScale(losses, { minTop: 200, step: 50 });
  const stopCount = scale.typicalTop >= 400 ? 7 : 6;
  const tops = LUFT_TOP_LADDER.filter(
    (t) => t <= Math.max(600, scale.absoluteTop + 100),
  );
  for (const t of [scale.typicalTop, scale.absoluteTop]) {
    if (t > 0 && !tops.includes(t)) tops.push(t);
  }
  const presets = buildPresetsForTops(
    tops.sort((a, b) => a - b),
    stopCount,
  );
  const typical = pickAdaptivePositiveLoadRange(
    losses,
    { minTop: 200, step: 50, stopCount },
    DEFAULT_LUFTUNG_RANGE,
  );
  const withoutDup = presets.filter(
    (p) => p.values.join(",") !== typical.join(","),
  );
  return [
    {
      id: "typical",
      label: `${typical.join(", ")} · auto`,
      values: typical,
    },
    ...withoutDup,
  ].slice(0, 12);
}

/**
 * Choose a legend ceiling from room counts, not only the absolute max.
 *
 * If a small share of rooms spike (≤10%, e.g. 1 of ~15 at 80 W/m² while most
 * stay ≤50), typicalTop stays on the bulk so mid-band rooms keep color contrast,
 * and absoluteTop holds the peak for a reserved end color. Otherwise stretch to max.
 */
export function analyzeLoadScale(
  loads: number[],
  opts: { minTop: number; step: number; percentile?: number },
): {
  typicalTop: number;
  absoluteTop: number;
  outlierCount: number;
} {
  const vals = loads
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const minTop = opts.minTop;
  const step = opts.step;
  const percentile = opts.percentile ?? 0.9;

  if (!vals.length) {
    return {
      typicalTop: minTop,
      absoluteTop: minTop,
      outlierCount: 0,
    };
  }

  const n = vals.length;
  const absoluteMax = vals[n - 1]!;
  const absoluteTop = Math.max(minTop, niceCeil(absoluteMax, step));

  // Peel a high cluster when it is a small share of rooms and clearly above the rest.
  let peakStart = n - 1;
  const peak = absoluteMax;
  while (peakStart > 0 && vals[peakStart - 1]! >= peak * 0.92) {
    peakStart -= 1;
  }
  const peakCount = n - peakStart;
  const belowPeak = peakStart > 0 ? vals[peakStart - 1]! : 0;
  // ~≤10% of rooms (ceil so small IFCs still allow 1–2 hot rooms).
  const maxSparse = Math.max(1, Math.ceil(n * 0.1));
  const sparsePeak =
    peakCount >= 1 &&
    peakCount <= maxSparse &&
    peakStart > 0 &&
    peak > belowPeak * 1.15 &&
    peak - belowPeak >= step * 0.5;

  const bulkVals = sparsePeak ? vals.slice(0, peakStart) : vals;
  const outlierCount = sparsePeak ? peakCount : 0;
  const bN = bulkVals.length;
  const pIdx = Math.min(bN - 1, Math.max(0, Math.floor((bN - 1) * percentile)));
  const bulkRaw = bulkVals[pIdx] ?? absoluteMax;

  let typicalRaw: number;
  if (!sparsePeak || absoluteMax <= bulkRaw * 1.15) {
    typicalRaw = absoluteMax;
  } else {
    typicalRaw = bulkRaw;
  }

  const typicalTop = Math.max(minTop, niceCeil(typicalRaw, step));
  return { typicalTop, absoluteTop, outlierCount };
}

/**
 * Pick Heizlast range from room W/m² values.
 * Even scale by default; if ≤10% of rooms are outliers, densify colors in the
 * bulk band and reserve the last stop for those rooms.
 */
export function pickHeizlastRangeFromLoads(heatLoads: number[]): number[] {
  return pickAdaptivePositiveLoadRange(
    heatLoads,
    { minTop: 50, step: 5, stopCount: 6 },
    DEFAULT_HEIZLAST_RANGE,
  );
}

/** Solar Computer: keep signed cooling range 0 → −top. */
export function pickKuhllastRangeFromLoads(coolLoads: number[]): number[] {
  const mags = coolLoads
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.abs(v));
  if (!mags.length || Math.max(...mags) <= 0) {
    return [...DEFAULT_KUHLLAST_RANGE];
  }
  const { typicalTop } = analyzeLoadScale(mags, { minTop: 50, step: 5 });
  return buildEvenLegendRange(typicalTop, 6).map((v) => -v);
}

/** Pick Lüftung Wärmeverlust (W) range — same even/adaptive rules as Heizlast. */
export function pickLuftungRangeFromLosses(losses: number[]): number[] {
  const vals = losses.filter((v) => Number.isFinite(v) && v >= 0);
  const scale = analyzeLoadScale(vals, { minTop: 200, step: 50 });
  const stopCount = scale.typicalTop >= 400 || scale.absoluteTop >= 400 ? 7 : 6;
  return pickAdaptivePositiveLoadRange(
    losses,
    { minTop: 200, step: 50, stopCount },
    DEFAULT_LUFTUNG_RANGE,
  );
}

/**
 * Auto °C legend from room temperatures (upload / project fit).
 * Packs stops where temps cluster; reserves the top stop when ≤~10% of rooms
 * are clearly hotter than the bulk. Does not force default 0/6/15 anchors.
 */
export function pickTemperatureRangeFromRooms(
  roomTemps: number[],
  emptyDefault: number[] = DEFAULT_TEMPERATURE_RANGE,
): number[] {
  const vals = roomTemps
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.round(t))
    .sort((a, b) => a - b);
  if (!vals.length) return [...emptyDefault];

  const n = MIN_LEGEND_STOPS;
  const total = vals.length;
  const peak = vals[total - 1]!;
  let peakStart = total - 1;
  while (peakStart > 0 && vals[peakStart - 1]! >= peak - 1) {
    peakStart -= 1;
  }
  const peakCount = total - peakStart;
  const maxSparse = Math.max(1, Math.ceil(total * 0.1));
  const belowPeak = peakStart > 0 ? vals[peakStart - 1]! : peak;
  const sparseHot =
    peakCount >= 1 &&
    peakCount <= maxSparse &&
    peakStart > 0 &&
    peak - belowPeak >= 2;

  const bulk = sparseHot ? vals.slice(0, peakStart) : vals;
  const bulkSlots = sparseHot ? n - 1 : n;
  const stops = new Set<number>();

  if (bulk.length === 1) {
    const t = bulk[0]!;
    const half = Math.floor((bulkSlots - 1) / 2);
    for (let i = 0; i < bulkSlots; i++) stops.add(t - half + i);
  } else {
    for (let i = 0; i < bulkSlots; i++) {
      const t = bulkSlots === 1 ? 0 : i / (bulkSlots - 1);
      // Bias interior samples toward the dense central band (P10–P90).
      const lo = 0.1;
      const hi = 0.9;
      const u = lo + (hi - lo) * t;
      const idx = Math.min(
        bulk.length - 1,
        Math.max(0, Math.round(u * (bulk.length - 1))),
      );
      // Always pin first/last bulk slots to true bulk min/max.
      if (i === 0) stops.add(bulk[0]!);
      else if (i === bulkSlots - 1) stops.add(bulk[bulk.length - 1]!);
      else stops.add(bulk[idx]!);
    }
  }

  if (sparseHot) stops.add(peak);

  let sorted = [...stops].sort((a, b) => a - b);

  while (sorted.length < n) {
    let bestI = 0;
    let bestGap = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap > bestGap) {
        bestGap = gap;
        bestI = i;
      }
    }
    if (bestGap <= 1) {
      sorted = [sorted[0]! - 1, ...sorted, sorted[sorted.length - 1]! + 1];
      sorted = [...new Set(sorted)].sort((a, b) => a - b);
      if (sorted.length >= n) break;
      continue;
    }
    const mid = Math.round((sorted[bestI]! + sorted[bestI + 1]!) / 2);
    if (mid <= sorted[bestI]! || mid >= sorted[bestI + 1]!) break;
    sorted = [...new Set([...sorted, mid])].sort((a, b) => a - b);
  }

  if (sorted.length > n) {
    const keep = new Set<number>([
      sorted[0]!,
      sorted[sorted.length - 1]!,
      ...(sparseHot ? [peak, bulk[bulk.length - 1]!] : []),
    ]);
    return thinLegendStops(sorted, n, keep);
  }
  return sorted;
}

/**
 * Project-fitted °C legend from room temperatures (same as pickTemperatureRangeFromRooms).
 * `base` is only used when there are no valid room samples.
 */
export function mergeTemperatureRangeFromRooms(
  roomTemps: number[],
  base: number[] = DEFAULT_TEMPERATURE_RANGE,
): number[] {
  return pickTemperatureRangeFromRooms(roomTemps, base);
}

/** Temperature presets: standard + project-fitted auto (when different). */
export function buildTemperatureRangePresets(
  roomTemps: number[],
): LegendRangePreset[] {
  const project = pickTemperatureRangeFromRooms(roomTemps);
  const presets: LegendRangePreset[] = [
    {
      id: "std",
      label: DEFAULT_TEMPERATURE_RANGE.join(", "),
      values: [...DEFAULT_TEMPERATURE_RANGE],
    },
  ];
  const same =
    project.length === DEFAULT_TEMPERATURE_RANGE.length &&
    project.every((v, i) => v === DEFAULT_TEMPERATURE_RANGE[i]);
  if (!same) {
    presets.unshift({
      id: "typical",
      label: `${project.join(", ")} · auto`,
      values: project,
    });
  }
  // Extra common climate bands
  presets.push(
    {
      id: "cold",
      label: "0, 6, 12, 15, 18, 20",
      values: [0, 6, 12, 15, 18, 20],
    },
    {
      id: "warm",
      label: "0, 15, 18, 20, 22, 24, 26",
      values: [0, 15, 18, 20, 22, 24, 26],
    },
    {
      id: "wide-temp",
      label: "0, 6, 12, 15, 18, 20, 22, 24",
      values: [0, 6, 12, 15, 18, 20, 22, 24],
    },
  );
  return presets;
}

/** Derive all legend ranges from loaded IFC rooms (auto-fit on upload). */
export function legendRangesFromRooms(
  rooms: {
    heatLoad: number;
    coolLoad: number;
    temperature: number;
    coolTemperature?: number | null;
    ventilation?: { ventilationHeatLoss?: number };
  }[],
): {
  heizlast: number[];
  kuhllast: number[];
  luftung: number[];
  temperature: number[];
  coolingTemperature: number[];
} {
  const coolTemps = rooms
    .map((r) => r.coolTemperature)
    .filter((t): t is number => t != null && Number.isFinite(t) && t > 0);
  return {
    heizlast: pickHeizlastRangeFromLoads(rooms.map((r) => r.heatLoad)),
    kuhllast: pickKuhllastRangeFromLoads(rooms.map((r) => r.coolLoad)),
    luftung: pickLuftungRangeFromLosses(
      rooms.map((r) => r.ventilation?.ventilationHeatLoss ?? 0),
    ),
    temperature: pickTemperatureRangeFromRooms(
      rooms.map((r) => r.temperature),
      DEFAULT_TEMPERATURE_RANGE,
    ),
    coolingTemperature: pickTemperatureRangeFromRooms(
      coolTemps,
      DEFAULT_COOLING_TEMPERATURE_RANGE,
    ),
  };
}

/** Parse "0, 10, 20…" or cooling "0, -10, -20…" — preserve asc/desc order. */
export function parseLegendRange(input: string): number[] | null {
  const parts = input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < MIN_LEGEND_STOPS || parts.length > MAX_LEGEND_STOPS) {
    return null;
  }
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;

  const unique: number[] = [];
  for (const n of nums) {
    if (!unique.includes(n)) unique.push(n);
  }
  if (
    unique.length < MIN_LEGEND_STOPS ||
    unique.length > MAX_LEGEND_STOPS
  ) {
    return null;
  }

  let ascending = true;
  let descending = true;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i]! < unique[i - 1]!) ascending = false;
    if (unique[i]! > unique[i - 1]!) descending = false;
  }
  if (ascending || descending) return unique;
  return [...unique].sort((a, b) => a - b);
}

export function formatLegendRange(values: number[]): string {
  return values.join(", ");
}

export type LegendColorMode =
  | "temperature"
  | "heizlast"
  | "kuhllast"
  | "luftung";

export type CustomLegendColorMap = Record<string, string>;

export type CustomLegendColors = Record<
  LegendColorMode,
  CustomLegendColorMap
>;

export const EMPTY_CUSTOM_LEGEND_COLORS: CustomLegendColors = {
  temperature: {},
  heizlast: {},
  kuhllast: {},
  luftung: {},
};

/** Apply per-value hex overrides (keys are stop values as strings). */
export function applyLegendColorOverrides(
  stops: ColorStop[],
  overrides?: CustomLegendColorMap,
): ColorStop[] {
  if (!overrides || !Object.keys(overrides).length) return stops;
  return stops.map((s) => ({
    ...s,
    color: overrides[String(s.value)] ?? s.color,
  }));
}

function loadStopsForKind(
  kind: LegendColorMode,
  paletteId?: ColorPaletteId | string,
): ColorStop[] {
  if (kind === "temperature") return temperatureStopsFor(paletteId);
  if (kind === "kuhllast") return kuhllastStopsFor(paletteId);
  // Heizlast + Lüftung share the heat-load palette stop shapes.
  return heizlastStopsFor(paletteId);
}

export function legendStopsForMode(
  kind: LegendColorMode,
  paletteId?: ColorPaletteId | string,
  range?: number[],
  overrides?: CustomLegendColorMap,
): ColorStop[] {
  const defaultRange =
    kind === "temperature"
      ? DEFAULT_TEMPERATURE_RANGE
      : kind === "kuhllast"
        ? DEFAULT_KUHLLAST_RANGE
        : kind === "luftung"
          ? DEFAULT_LUFTUNG_RANGE
          : DEFAULT_HEIZLAST_RANGE;
  const resolved = resolveStopsForRange(
    loadStopsForKind(kind, paletteId),
    range ?? defaultRange,
  );
  return applyLegendColorOverrides(resolved, overrides);
}

/** Map stop colors onto range values (1:1 when counts match, else interpolate). */
export function mapAnchorColorsToRange(
  anchorColors: string[],
  range: number[],
): CustomLegendColorMap {
  const src =
    anchorColors.length > 0
      ? anchorColors
      : ["#3D7EFF", "#0050FF", "#FFDC00", "#FF8C00", "#DC0000", "#7A3300"];
  const overrides: CustomLegendColorMap = {};
  if (src.length === range.length) {
    range.forEach((value, i) => {
      overrides[String(value)] = src[i]!;
    });
    return overrides;
  }
  range.forEach((value, i) => {
    overrides[String(value)] = sampleColors(
      src,
      i / Math.max(1, range.length - 1),
    );
  });
  return overrides;
}

/**
 * Heizlast / Lüftung color mapping — Thermal Classic / heat ramp.
 */
export function mapHeatAnchorColorsToRange(
  anchorColors: string[],
  range: number[],
): CustomLegendColorMap {
  const src =
    anchorColors.length > 0
      ? anchorColors
      : ["#3D7EFF", "#0050FF", "#FFDC00", "#FF8C00", "#DC0000", "#7A3300"];
  const overrides: CustomLegendColorMap = {};
  if (src.length === range.length) {
    range.forEach((value, i) => {
      overrides[String(value)] = src[i]!;
    });
    return overrides;
  }
  const ease = (t: number) => Math.pow(Math.max(0, Math.min(1, t)), 1.0);
  range.forEach((value, i) => {
    overrides[String(value)] = sampleColors(
      src,
      ease(i / Math.max(1, range.length - 1)),
    );
  });
  return overrides;
}

/** Build override map from resolved legend stops. */
export function legendStopsToOverrides(
  stops: ColorStop[],
): CustomLegendColorMap {
  return Object.fromEntries(stops.map((s) => [String(s.value), s.color]));
}

/** Default temperature colors — matches standard palette with no custom overrides. */
export function standardTemperatureStopColors(
  range: number[] = DEFAULT_TEMPERATURE_RANGE,
): string[] {
  return legendStopsForMode("temperature", "standard", range).map((s) => s.color);
}

export function standardTemperatureOverrides(
  range: number[] = DEFAULT_TEMPERATURE_RANGE,
): CustomLegendColorMap {
  return legendStopsToOverrides(
    legendStopsForMode("temperature", "standard", range),
  );
}

function sampleColors(colors: string[], t: number): string {
  if (!colors.length) return "#888888";
  if (colors.length === 1) return colors[0];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (colors.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  if (i >= colors.length - 1) return colors[colors.length - 1];
  return rgbToHex(lerpRgb(hexToRgb(colors[i]), hexToRgb(colors[i + 1]), f));
}

/** Map a custom value range onto palette colors (6–8 stops). */
export function resolveStopsForRange(
  paletteStops: ColorStop[],
  range: number[],
): ColorStop[] {
  const values =
    range.length >= MIN_LEGEND_STOPS
      ? range
      : DEFAULT_HEIZLAST_RANGE;
  const colors = paletteStops
    .filter((s) => Number.isFinite(s.value))
    .map((s) => s.color);
  const unique: string[] = [];
  for (const c of colors) {
    if (unique[unique.length - 1] !== c) unique.push(c);
  }
  const src = unique.length
    ? unique
    : ["#3D7EFF", "#0050FF", "#FFDC00", "#FF8C00", "#DC0000", "#7A3300"];
  return values.map((value, i) => ({
    value,
    color: sampleColors(src, i / Math.max(1, values.length - 1)),
  }));
}

export const HEIZLAST_GRADIENT_STOPS = STANDARD_HEIZLAST.filter((s) =>
  Number.isFinite(s.value),
);

/**
 * Multi-stop linear RGB gradient for Heizlast (W/m²).
 */
export function heizlastToColor(
  value: number,
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_HEIZLAST_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  return loadToColor(value, heizlastStopsFor(paletteId), range, overrides);
}

/**
 * Multi-stop linear RGB gradient for Kühllast / summer cooling (W/m²).
 */
export function kuhllastToColor(
  value: number,
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_KUHLLAST_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  return loadToColor(value, kuhllastStopsFor(paletteId), range, overrides);
}

/**
 * Ventilation heat loss (Lüftungswärmeverlust W) — uses Heizlast palette / presets.
 */
export function luftungToColor(
  value: number,
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_LUFTUNG_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  return loadToColor(value, heizlastStopsFor(paletteId), range, overrides);
}

export function luftungGradientCss(
  direction = "to right",
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_LUFTUNG_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  const stops = legendStopsForMode("luftung", paletteId, range, overrides);
  return `linear-gradient(${direction}, ${stops.map((s) => s.color).join(", ")})`;
}

function loadToColor(
  value: number,
  paletteStops: ColorStop[],
  range: number[],
  overrides?: CustomLegendColorMap,
): string {
  const stops = applyLegendColorOverrides(
    resolveStopsForRange(paletteStops, range),
    overrides,
  );
  if (!stops.length) return "#888888";
  if (!Number.isFinite(value)) return stops[0]!.color;

  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  const descending = last.value < first.value;

  // Outside the legend span (works for heating ↑ and cooling ↓).
  if (descending) {
    if (value >= first.value) return first.color;
    if (value <= last.value) return last.color;
  } else {
    if (value <= first.value) return first.color;
    if (value >= last.value) return last.color;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const lo = Math.min(a.value, b.value);
    const hi = Math.max(a.value, b.value);
    if (value >= lo && value <= hi) {
      const span = b.value - a.value;
      const t = span === 0 ? 0 : (value - a.value) / span;
      return rgbToHex(lerpRgb(hexToRgb(a.color), hexToRgb(b.color), t));
    }
  }

  return last.color;
}

/** CSS linear-gradient matching heizlast anchors for the active palette/range. */
export function heizlastGradientCss(
  direction = "to right",
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_HEIZLAST_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  const stops = legendStopsForMode("heizlast", paletteId, range, overrides);
  return `linear-gradient(${direction}, ${stops.map((s) => s.color).join(", ")})`;
}

export function kuhllastGradientCss(
  direction = "to right",
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_KUHLLAST_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  const stops = legendStopsForMode("kuhllast", paletteId, range, overrides);
  return `linear-gradient(${direction}, ${stops.map((s) => s.color).join(", ")})`;
}

/**
 * Discrete nearest-match color for required room temperature (°C).
 */
export function temperatureToColor(
  value: number,
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_TEMPERATURE_RANGE,
  overrides?: CustomLegendColorMap,
): string {
  const stops = legendStopsForMode("temperature", paletteId, range, overrides);
  if (!Number.isFinite(value)) {
    return stops[2]?.color ?? stops[0].color;
  }

  let best = stops[0];
  let bestDist = Math.abs(value - best.value);

  for (let i = 1; i < stops.length; i++) {
    const stop = stops[i];
    const dist = Math.abs(value - stop.value);
    if (dist < bestDist) {
      best = stop;
      bestDist = dist;
    }
  }

  return best.color;
}

/** Temperature chip stops for the legend (custom range + palette colors). */
export function temperatureLegendStops(
  paletteId?: ColorPaletteId | string,
  range: number[] = DEFAULT_TEMPERATURE_RANGE,
  overrides?: CustomLegendColorMap,
): ColorStop[] {
  return legendStopsForMode("temperature", paletteId, range, overrides);
}
