/**
 * Calendar-based seasonal looks for the welcome-screen ambient viewport.
 * Color/lighting only — no particles.
 */

import type { ColorTheme } from "@/lib/themeColors";
import {
  encodeGradientLerp,
  getDefaultSceneBackground,
  type SceneBackgroundPreset,
} from "@/lib/sceneSky";

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Northern-hemisphere month buckets (Dec–Feb winter, etc.). */
export function getSeasonFromDate(date = new Date()): Season {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "autumn";
}

type SeasonPresetPair = {
  light: Pick<SceneBackgroundPreset, "hex" | "gradient">;
  dark: Pick<SceneBackgroundPreset, "hex" | "gradient">;
};

const SEASON_PRESETS: Record<Season, SeasonPresetPair> = {
  winter: {
    light: {
      hex: "#b8ddf8",
      gradient: { top: "#f4faff", bottom: "#9ed0f5" },
    },
    dark: {
      hex: "#2a4f6e",
      gradient: { top: "#4a7fa8", bottom: "#1a3348" },
    },
  },
  spring: {
    light: {
      hex: "#b8dcc4",
      gradient: { top: "#eef9f1", bottom: "#8fc9a8" },
    },
    dark: {
      hex: "#2a4034",
      gradient: { top: "#3d5c48", bottom: "#1a2820" },
    },
  },
  summer: {
    light: {
      hex: "#ffd4a0",
      gradient: { top: "#fff9ee", bottom: "#ffbf70" },
    },
    dark: {
      hex: "#7a4a28",
      gradient: { top: "#c87840", bottom: "#3d2214" },
    },
  },
  autumn: {
    light: {
      hex: "#e8c4a0",
      gradient: { top: "#fff4e6", bottom: "#d4956a" },
    },
    dark: {
      hex: "#4a3520",
      gradient: { top: "#8b5a38", bottom: "#2a1810" },
    },
  },
};

export type AmbientLighting = {
  hemisphereSky: number;
  hemisphereGround: number;
  hemisphereIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
};

const SEASON_LIGHTING: Record<Season, AmbientLighting> = {
  winter: {
    hemisphereSky: 0xb8d4f0,
    hemisphereGround: 0x8899aa,
    hemisphereIntensity: 0.55,
    ambientColor: 0xc8d8e8,
    ambientIntensity: 0.35,
  },
  spring: {
    hemisphereSky: 0xc8e8d0,
    hemisphereGround: 0x98b898,
    hemisphereIntensity: 0.58,
    ambientColor: 0xd0e8d8,
    ambientIntensity: 0.38,
  },
  summer: {
    hemisphereSky: 0xffe8c8,
    hemisphereGround: 0xc8a878,
    hemisphereIntensity: 0.62,
    ambientColor: 0xfff0d8,
    ambientIntensity: 0.4,
  },
  autumn: {
    hemisphereSky: 0xffdcc0,
    hemisphereGround: 0xa88868,
    hemisphereIntensity: 0.58,
    ambientColor: 0xf0d0b0,
    ambientIntensity: 0.38,
  },
};

const NEUTRAL_LIGHTING: Record<ColorTheme, AmbientLighting> = {
  light: {
    hemisphereSky: 0xe8eaed,
    hemisphereGround: 0xb0b8c0,
    hemisphereIntensity: 0.5,
    ambientColor: 0xd8dce0,
    ambientIntensity: 0.32,
  },
  dark: {
    hemisphereSky: 0x3d4a58,
    hemisphereGround: 0x1a222c,
    hemisphereIntensity: 0.45,
    ambientColor: 0x2a3340,
    ambientIntensity: 0.28,
  },
};

function presetToBackgroundValue(
  pair: Pick<SceneBackgroundPreset, "hex" | "gradient">,
): string {
  if (pair.gradient) {
    return encodeGradientLerp(pair.gradient.top, pair.gradient.bottom);
  }
  return pair.hex;
}

/** Scene background value for the welcome ambient viewport. */
export function getWelcomeAmbientBackground(
  theme: ColorTheme,
  seasonalOn: boolean,
  date = new Date(),
): string {
  if (!seasonalOn) {
    return getDefaultSceneBackground(theme);
  }
  const season = getSeasonFromDate(date);
  const pair = SEASON_PRESETS[season][theme];
  return presetToBackgroundValue(pair);
}

export function getWelcomeAmbientLighting(
  theme: ColorTheme,
  seasonalOn: boolean,
  date = new Date(),
): AmbientLighting {
  if (!seasonalOn) {
    return NEUTRAL_LIGHTING[theme];
  }
  return SEASON_LIGHTING[getSeasonFromDate(date)];
}
