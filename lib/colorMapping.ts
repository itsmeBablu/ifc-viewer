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

/** Summer cooling — ice cyan (low) → aqua → sky → indigo → violet (high). */
const STANDARD_KUHLLAST: ColorStop[] = [
  { value: Number.NEGATIVE_INFINITY, color: "#E0F7FA" },
  { value: 0, color: "#B2EBF2" },
  { value: 10, color: "#4DD0E1" },
  { value: 20, color: "#00ACC1" },
  { value: 25, color: "#0288D1" },
  { value: 30, color: "#1565C0" },
  { value: 40, color: "#5C6BC0" },
  { value: 50, color: "#7B1FA2" },
  { value: Number.POSITIVE_INFINITY, color: "#4A148C" },
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
  { value: Number.NEGATIVE_INFINITY, color: "#E8F6F8" },
  { value: 0, color: "#C5E8EE" },
  { value: 10, color: "#9AD4DE" },
  { value: 20, color: "#7BB8D4" },
  { value: 25, color: "#7AA8C8" },
  { value: 30, color: "#8A9EC8" },
  { value: 40, color: "#A090C0" },
  { value: 50, color: "#B888B8" },
  { value: Number.POSITIVE_INFINITY, color: "#9A7098" },
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
export const DEFAULT_KUHLLAST_RANGE = [0, 10, 20, 30, 40, 50];
export const DEFAULT_LUFTUNG_RANGE = [0, 50, 100, 150, 200, 300, 400];
export const DEFAULT_TEMPERATURE_RANGE = [0, 6, 15, 18, 20, 24];
export const MIN_LEGEND_STOPS = 6;
export const MAX_LEGEND_STOPS = 8;

/** Built-in Heizlast / Kühllast range presets for the legend dropdown. */
export const HEIZLAST_RANGE_PRESETS: { id: string; label: string; values: number[] }[] = [
  { id: "std", label: "0, 10, 20, 30, 40, 50", values: [0, 10, 20, 30, 40, 50] },
  { id: "fine", label: "0, 5, 15, 20, 25, 30", values: [0, 5, 15, 20, 25, 30] },
  { id: "wide", label: "0, 15, 25, 35, 45, 55", values: [0, 15, 25, 35, 45, 55] },
];

export const KUHLLAST_RANGE_PRESETS = HEIZLAST_RANGE_PRESETS;

/** Ventilation heat loss (W) — same color anchors as Heizlast, W-scale range. */
export const LUFTUNG_RANGE_PRESETS: { id: string; label: string; values: number[] }[] = [
  { id: "compact", label: "0, 25, 50, 100, 150, 200", values: [0, 25, 50, 100, 150, 200] },
  { id: "std", label: "0, 50, 100, 150, 200, 300, 400", values: [0, 50, 100, 150, 200, 300, 400] },
  { id: "wide", label: "0, 100, 200, 300, 400, 500, 600", values: [0, 100, 200, 300, 400, 500, 600] },
];

/**
 * Pick the tightest load preset that covers the model's W/m² values.
 * Uses ~95th percentile so a few outliers don't force the widest scale.
 */
export function pickHeizlastRangeFromLoads(heatLoads: number[]): number[] {
  const vals = heatLoads.filter((v) => Number.isFinite(v) && v >= 0);
  if (!vals.length) return [...DEFAULT_HEIZLAST_RANGE];

  const sorted = [...vals].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  // Cover typical rooms; still respect absolute max with a little headroom
  const target = Math.max(p95, max * 0.9);

  const covering = HEIZLAST_RANGE_PRESETS.map((p) => ({
    p,
    max: p.values[p.values.length - 1]!,
  }))
    .filter((x) => x.max >= target)
    .sort((a, b) => a.max - b.max);

  if (covering.length) return [...covering[0]!.p.values];

  const widest = HEIZLAST_RANGE_PRESETS.reduce((best, p) =>
    p.values[p.values.length - 1]! > best.values[best.values.length - 1]!
      ? p
      : best,
  );
  return [...widest.values];
}

export const pickKuhllastRangeFromLoads = pickHeizlastRangeFromLoads;

/** Parse "0, 10, 20, 30, 40, 50" → sorted unique numbers (6–8). */
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
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  if (
    sorted.length < MIN_LEGEND_STOPS ||
    sorted.length > MAX_LEGEND_STOPS
  ) {
    return null;
  }
  return sorted;
}

export function formatLegendRange(values: number[]): string {
  return values.join(", ");
}

export type LegendColorMode = "temperature" | "heizlast" | "kuhllast";

export type CustomLegendColorMap = Record<string, string>;

export type CustomLegendColors = Record<
  LegendColorMode,
  CustomLegendColorMap
>;

export const EMPTY_CUSTOM_LEGEND_COLORS: CustomLegendColors = {
  temperature: {},
  heizlast: {},
  kuhllast: {},
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
  const stops = legendStopsForMode("heizlast", paletteId, range, overrides);
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
  if (!Number.isFinite(value) || value < stops[0].value) {
    return stops[0].color;
  }
  if (value >= stops[stops.length - 1].value) {
    return stops[stops.length - 1].color;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (value >= a.value && value <= b.value) {
      const span = b.value - a.value;
      const t = span === 0 ? 0 : (value - a.value) / span;
      return rgbToHex(lerpRgb(hexToRgb(a.color), hexToRgb(b.color), t));
    }
  }

  return stops[stops.length - 1].color;
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
