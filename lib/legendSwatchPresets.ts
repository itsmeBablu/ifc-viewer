import {
  DEFAULT_TEMPERATURE_RANGE,
  standardTemperatureStopColors,
} from "./colorMapping";

/** Default temperature chip colors (standard palette, default range). */
export const DEFAULT_TEMPERATURE_SWATCH_COLORS = standardTemperatureStopColors(
  DEFAULT_TEMPERATURE_RANGE,
);

/** One-click Adobe-style swatch themes for legend stops. */
export type LegendSwatchPreset = {
  id: string;
  name: string;
  /** Heating load low → high (6 anchors). */
  heatColors: string[];
  /** Cooling load low → high (6 anchors). */
  coolColors: string[];
  /** Temperature low → high (6 anchors). */
  tempColors: string[];
};

/** Six curated palettes — cool design-site inspired gradients. */
export const LEGEND_SWATCH_PRESETS: LegendSwatchPreset[] = [
  {
    id: "thermal-classic",
    name: "Thermal Classic",
    heatColors: ["#0066CC", "#3399FF", "#99CCFF", "#FFFF99", "#FF9933", "#CC0000"],
    coolColors: ["#E0FBFC", "#90E0EF", "#00B4D8", "#0077B6", "#023E8A", "#03045E"],
    tempColors: ["#1B4965", "#5FA8D3", "#CAE9FF", "#FFD166", "#F77F00", "#D62828"],
  },
  {
    id: "sunset-coral",
    name: "Sunset Coral",
    heatColors: ["#264653", "#2A9D8F", "#8AB17D", "#E9C46A", "#F4A261", "#E76F51"],
    coolColors: ["#CAFFBF", "#94D2BD", "#52B69A", "#168AAD", "#1A759F", "#184E77"],
    tempColors: ["#2A6F97", "#61A5C2", "#A9D6E5", "#F4D58D", "#F8961E", "#E63946"],
  },
  {
    id: "viridis-pro",
    name: "Viridis Pro",
    heatColors: ["#440154", "#414487", "#2A788E", "#22A884", "#7AD151", "#FDE725"],
    coolColors: ["#F0F9FF", "#BAE6FD", "#38BDF8", "#0284C7", "#1D4ED8", "#312E81"],
    tempColors: ["#3B0764", "#5B21B6", "#059669", "#84CC16", "#EAB308", "#EA580C"],
  },
  {
    id: "arctic-flame",
    name: "Arctic Flame",
    heatColors: ["#03045E", "#0077B6", "#00B4D8", "#FFD166", "#F77F00", "#D62828"],
    coolColors: ["#F1FAEE", "#A8DADC", "#457B9D", "#1D3557", "#6A4C93", "#4A148C"],
    tempColors: ["#03071E", "#370617", "#6A040F", "#F48C06", "#FFBA08", "#E85D04"],
  },
  {
    id: "sage-ember",
    name: "Sage Ember",
    heatColors: ["#606C38", "#8A9A5B", "#FEFAE0", "#DDA15E", "#BC6C25", "#9B2226"],
    coolColors: ["#EDF6F9", "#83C5BE", "#006D77", "#26547C", "#5C4D7D", "#3D2645"],
    tempColors: ["#344E41", "#588157", "#A3B18A", "#DAD7CD", "#BC6C25", "#9B2226"],
  },
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    heatColors: ["#7209B7", "#3A0CA3", "#4361EE", "#4CC9F0", "#F72585", "#FF006E"],
    coolColors: ["#CFFAFE", "#67E8F9", "#06B6D4", "#0891B2", "#6366F1", "#7C3AED"],
    tempColors: ["#240046", "#5A189A", "#0077B6", "#06D6A0", "#FFD60A", "#FF006E"],
  },
];

export function getLegendSwatchPreset(id: string): LegendSwatchPreset | undefined {
  return LEGEND_SWATCH_PRESETS.find((p) => p.id === id);
}

/** Six temperature-only quick palettes (discrete chips, separate from heat gradients). */
export type TemperatureSwatchPreset = {
  id: string;
  name: string;
  colors: string[];
};

export const LEGEND_TEMPERATURE_SWATCH_PRESETS: TemperatureSwatchPreset[] = [
  {
    id: "temp-standard",
    name: "Standard",
    colors: DEFAULT_TEMPERATURE_SWATCH_COLORS,
  },
  {
    id: "temp-forest",
    name: "Forest Calm",
    colors: ["#081C15", "#1B4332", "#2D6A4F", "#52B788", "#95D5B2", "#D8F3DC"],
  },
  {
    id: "temp-lavender",
    name: "Lavender Haze",
    colors: ["#3C096C", "#5A189A", "#9D4EDD", "#C77DFF", "#E0AAFF", "#FF6D00"],
  },
  {
    id: "temp-sky",
    name: "Sky Bloom",
    colors: ["#03045E", "#0077B6", "#00B4D8", "#90E0EF", "#FFB703", "#E63946"],
  },
  {
    id: "temp-rose",
    name: "Rose Clay",
    colors: ["#4A0404", "#9B2226", "#BB3E03", "#E85D04", "#FAA307", "#FFBD00"],
  },
  {
    id: "temp-mint",
    name: "Mint Slate",
    colors: ["#003049", "#006466", "#0B525B", "#1B9AAA", "#4ECDC4", "#FFE66D"],
  },
];

export function getTemperatureSwatchPreset(
  id: string,
): TemperatureSwatchPreset | undefined {
  return LEGEND_TEMPERATURE_SWATCH_PRESETS.find((p) => p.id === id);
}

export function swatchColorsForMode(
  preset: LegendSwatchPreset,
  mode: "heizlast" | "kuhllast" | "temperature",
): string[] {
  if (mode === "kuhllast") return preset.coolColors;
  if (mode === "temperature") return preset.tempColors;
  return preset.heatColors;
}
