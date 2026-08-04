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

const STANDARD_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#87CEEB" },
  { value: 0, color: "#0050FF" },
  { value: 10, color: "#0050FF" },
  { value: 20, color: "#FFFFB4" },
  { value: 25, color: "#FFDC00" },
  { value: 30, color: "#FFDC00" },
  { value: 40, color: "#FF8C00" },
  { value: 50, color: "#DC0000" },
  { value: Number.POSITIVE_INFINITY, color: "#7A3300" },
];

/** Summer cooling — vivid sky → cobalt (readable on glass rooms in 3D). */
const STANDARD_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E3F2FD" },
  { value: 0, color: "#90CAF9" },
  { value: 10, color: "#42A5F5" },
  { value: 20, color: "#1E88E5" },
  { value: 25, color: "#1565C0" },
  { value: 30, color: "#0D47A1" },
  { value: 40, color: "#0A3D91" },
  { value: 50, color: "#082E6B" },
  { value: Number.POSITIVE_INFINITY, color: "#041E42" },
];

const STANDARD_TEMP: ColorStop[] = [
  { value: 6, color: "#1B3A6B" },
  { value: 15, color: "#1F8A70" },
  { value: 18, color: "#4CAF50" },
  { value: 20, color: "#D9A400" },
  { value: 24, color: "#E8590C" },
];

/** Soft cool pastels — muted blues / mint / butter / peach / rose. */
const SOFT_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#C5E8F5" },
  { value: 0, color: "#8BB8E8" },
  { value: 10, color: "#8BB8E8" },
  { value: 20, color: "#F5F0C8" },
  { value: 25, color: "#E8D98A" },
  { value: 30, color: "#E8D98A" },
  { value: 40, color: "#E8B089" },
  { value: 50, color: "#D98989" },
  { value: Number.POSITIVE_INFINITY, color: "#B07A6A" },
];

const SOFT_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E3F2FD" },
  { value: 0, color: "#90CAF9" },
  { value: 10, color: "#64B5F6" },
  { value: 20, color: "#42A5F5" },
  { value: 25, color: "#1E88E5" },
  { value: 30, color: "#1565C0" },
  { value: 40, color: "#0D47A1" },
  { value: 50, color: "#0A3D91" },
  { value: Number.POSITIVE_INFINITY, color: "#062A66" },
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
  { value: Number.NEGATIVE_INFINITY, color: "#E4F2E8" },
  { value: 0, color: "#B8DCC8" },
  { value: 10, color: "#88C8B8" },
  { value: 20, color: "#70B0C8" },
  { value: 25, color: "#8890C8" },
  { value: 30, color: "#A088C8" },
  { value: 40, color: "#B878B0" },
  { value: 50, color: "#C07098" },
  { value: Number.POSITIVE_INFINITY, color: "#A05878" },
];

const WARM_TEMP: ColorStop[] = [
  { value: 6, color: "#9A8AB8" },
  { value: 15, color: "#A8B890" },
  { value: 18, color: "#C8C080" },
  { value: 20, color: "#E8B878" },
  { value: 24, color: "#E89078" },
];

/** Dark night palette — deep blues / amber / ember. */
const DARK_HEIZLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#1A2740" },
  { value: 0, color: "#2E4A7A" },
  { value: 10, color: "#3A5F9E" },
  { value: 20, color: "#6B7A4A" },
  { value: 25, color: "#B8922E" },
  { value: 30, color: "#D4A017" },
  { value: 40, color: "#C45C1A" },
  { value: 50, color: "#A82828" },
  { value: Number.POSITIVE_INFINITY, color: "#5C1818" },
];

const DARK_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#0D2137" },
  { value: 0, color: "#123A4A" },
  { value: 10, color: "#0E5C6B" },
  { value: 20, color: "#0A7A8C" },
  { value: 25, color: "#1565A0" },
  { value: 30, color: "#2A4A9E" },
  { value: 40, color: "#4A3A8C" },
  { value: 50, color: "#6A2080" },
  { value: Number.POSITIVE_INFINITY, color: "#3A1058" },
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
  // Put recommended scale first and tag it.
  const typical = buildEvenLegendRange(scale.typicalTop, 6);
  const withoutDup = presets.filter(
    (p) => p.values[p.values.length - 1] !== scale.typicalTop,
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
  const typical = buildEvenLegendRange(scale.typicalTop, stopCount);
  const withoutDup = presets.filter(
    (p) => p.values[p.values.length - 1] !== scale.typicalTop,
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
 * If a few rooms spike (e.g. 2× 100 W/m² while most stay ≤60), scale to the
 * bulk (~P90) so mid-range rooms keep color contrast. Sparse outliers still
 * map to the top legend color. When many rooms sit near the max, stretch to max.
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

  // Value that covers ~90% of rooms (count-based, not just index guess).
  const coverIdx = Math.min(n - 1, Math.max(0, Math.ceil(n * percentile) - 1));
  const pIdx = Math.min(n - 1, Math.floor((n - 1) * percentile));
  const bulkRaw = Math.max(vals[coverIdx]!, vals[pIdx]!);

  // Rooms clearly above the bulk band.
  const bulkGate = bulkRaw * 1.08;
  const outlierCount = vals.filter((v) => v > bulkGate).length;
  const outlierShare = outlierCount / n;
  const sparseOutliers =
    outlierCount > 0 && (outlierCount <= 2 || outlierShare <= 0.08);

  let typicalRaw: number;
  if (absoluteMax <= bulkRaw * 1.15) {
    // Peak is close to bulk — use full max.
    typicalRaw = absoluteMax;
  } else if (sparseOutliers) {
    // A few hot rooms: keep mid-band contrast (20–60 stays readable).
    typicalRaw = bulkRaw;
  } else {
    // Many high rooms: stretch toward absolute max.
    typicalRaw = absoluteMax;
  }

  const typicalTop = Math.max(minTop, niceCeil(typicalRaw, step));
  return { typicalTop, absoluteTop, outlierCount };
}

/**
 * Pick Heizlast / Kühllast range from room W/m² values (outlier-aware).
 * Example: most ≤60, two rooms at 100 → [0, 12, 24, 36, 48, 60].
 */
export function pickHeizlastRangeFromLoads(heatLoads: number[]): number[] {
  const vals = heatLoads.filter((v) => Number.isFinite(v) && v >= 0);
  if (!vals.length) return [...DEFAULT_HEIZLAST_RANGE];
  const { typicalTop } = analyzeLoadScale(vals, { minTop: 50, step: 5 });
  return buildEvenLegendRange(typicalTop, 6);
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

/** Pick Lüftung Wärmeverlust (W) range from room losses (outlier-aware). */
export function pickLuftungRangeFromLosses(losses: number[]): number[] {
  const vals = losses.filter((v) => Number.isFinite(v) && v >= 0);
  if (!vals.length) return [...DEFAULT_LUFTUNG_RANGE];
  const { typicalTop } = analyzeLoadScale(vals, { minTop: 200, step: 50 });
  return buildEvenLegendRange(typicalTop, typicalTop >= 400 ? 7 : 6);
}

/**
 * Merge room temperatures into the legend in sorted order
 * (e.g. 12°C sits between 6° and 15°).
 */
export function mergeTemperatureRangeFromRooms(
  roomTemps: number[],
  base: number[] = DEFAULT_TEMPERATURE_RANGE,
): number[] {
  const roomStops = roomTemps
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.round(t));
  const merged = [...new Set([...base, ...roomStops])].sort((a, b) => a - b);
  if (merged.length === 0) return [...DEFAULT_TEMPERATURE_RANGE];

  if (merged.length <= MAX_LEGEND_STOPS) {
    if (merged.length >= MIN_LEGEND_STOPS) return merged;
    // Pad with default base stops until minimum.
    const padded = [...merged];
    for (const b of base) {
      if (padded.length >= MIN_LEGEND_STOPS) break;
      if (!padded.includes(b)) {
        padded.push(b);
        padded.sort((a, c) => a - c);
      }
    }
    return padded.length >= MIN_LEGEND_STOPS
      ? padded
      : buildEvenLegendRange(Math.max(24, ...padded), MIN_LEGEND_STOPS);
  }

  // Too many stops: keep every unique room temp + 0 + extremes, then fill.
  const roomSet = new Set(roomStops);
  const must = merged.filter(
    (v, i, arr) =>
      v === 0 ||
      roomSet.has(v) ||
      i === 0 ||
      i === arr.length - 1,
  );
  const uniqMust = [...new Set(must)].sort((a, b) => a - b);
  if (uniqMust.length <= MAX_LEGEND_STOPS) {
    const filled = [...uniqMust];
    for (const b of base) {
      if (filled.length >= MAX_LEGEND_STOPS) break;
      if (!filled.includes(b)) {
        filled.push(b);
        filled.sort((a, c) => a - c);
      }
    }
    return filled;
  }

  // Sample room temps evenly while keeping min/max.
  const first = uniqMust[0]!;
  const last = uniqMust[uniqMust.length - 1]!;
  const mid = uniqMust.slice(1, -1);
  const keep = MAX_LEGEND_STOPS - 2;
  const sampled: number[] = [first];
  if (keep > 0 && mid.length) {
    for (let i = 0; i < keep; i++) {
      const idx = Math.round((i * (mid.length - 1)) / Math.max(1, keep - 1));
      sampled.push(mid[Math.min(mid.length - 1, idx)]!);
    }
  }
  sampled.push(last);
  return [...new Set(sampled)].sort((a, b) => a - b);
}

/** Temperature presets: standard + project-merged (when different). */
export function buildTemperatureRangePresets(
  roomTemps: number[],
): LegendRangePreset[] {
  const project = mergeTemperatureRangeFromRooms(roomTemps);
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
    presets.push({
      id: "project",
      label: project.join(", "),
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

/** Derive all legend ranges from loaded IFC rooms. */
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
    temperature: mergeTemperatureRangeFromRooms(
      rooms.map((r) => r.temperature),
    ),
    coolingTemperature: mergeTemperatureRangeFromRooms(
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
      : ["#0050FF", "#FFFFB4", "#DC0000"];
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
  const src = unique.length ? unique : ["#0050FF", "#FFFFB4", "#DC0000"];
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
