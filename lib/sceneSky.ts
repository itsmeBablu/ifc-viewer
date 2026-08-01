import * as THREE from "three";
import type { ColorTheme } from "@/lib/themeColors";
import type { DataViewMode } from "@/lib/dataViewMode";

export type SkyGradient = {
  top: string;
  bottom: string;
};

export type SceneBackgroundPreset = {
  id: string;
  label: string;
  /** Representative color for theme lerp + solid fallback */
  hex: string;
  gradient?: SkyGradient;
};

export const SCENE_BACKGROUND_PRESETS: SceneBackgroundPreset[] = [
  { id: "softGray", label: "Soft gray", hex: "#e8eaed" },
  { id: "coolGray", label: "Cool gray", hex: "#cfd5df" },
  { id: "lightBlue", label: "Light blue", hex: "#c8d9ea" },
  {
    id: "sky",
    label: "Sky",
    hex: "#b4cce0",
    gradient: { top: "#dceefb", bottom: "#8eb8d4" },
  },
  { id: "mist", label: "Mist", hex: "#dce6ef" },
  { id: "warmGray", label: "Warm gray", hex: "#e4e0da" },
  {
    id: "winterSky",
    label: "Winter sky",
    hex: "#b8ddf8",
    gradient: { top: "#f4faff", bottom: "#9ed0f5" },
  },
  {
    id: "summerSky",
    label: "Summer sky",
    hex: "#ffd4a0",
    gradient: { top: "#fff9ee", bottom: "#ffbf70" },
  },
  {
    id: "winterSkyDark",
    label: "Winter night",
    hex: "#2a4f6e",
    gradient: { top: "#4a7fa8", bottom: "#1a3348" },
  },
  {
    id: "summerSkyDark",
    label: "Summer dusk",
    hex: "#7a4a28",
    gradient: { top: "#c87840", bottom: "#3d2214" },
  },
  {
    id: "mistDark",
    label: "Night mist",
    hex: "#2a3340",
    gradient: { top: "#3d4a58", bottom: "#1a222c" },
  },
];

export const DEFAULT_SCENE_BG = SCENE_BACKGROUND_PRESETS[0].hex;

/** Default lighting swatch when Auto is off — soft gray (day) / night mist (moon). */
export function getDefaultSceneBackground(
  theme: import("@/lib/themeColors").ColorTheme,
): string {
  return theme === "dark" ? "mistDark" : "softGray";
}

export function isDefaultSceneBackground(
  value: string,
  theme: import("@/lib/themeColors").ColorTheme,
): boolean {
  const defId = getDefaultSceneBackground(theme);
  const preset = findScenePreset(value);
  if (preset?.id === defId) return true;
  const defPreset = findScenePreset(defId);
  if (!defPreset) return false;
  return value.trim().toLowerCase() === defPreset.hex.toLowerCase();
}

export function findScenePreset(value: string): SceneBackgroundPreset | undefined {
  const v = value.trim();
  return SCENE_BACKGROUND_PRESETS.find(
    (p) => p.id === v || p.hex.toLowerCase() === v.toLowerCase(),
  );
}

/** Sky preset for heating / cooling / ventilation + day / night. */
export function getModeSkyPreset(
  mode: DataViewMode,
  theme: ColorTheme,
): string {
  if (mode === "heizlast") {
    return theme === "dark" ? "winterSkyDark" : "winterSky";
  }
  if (mode === "kuhllast") {
    return theme === "dark" ? "summerSkyDark" : "summerSky";
  }
  return "softGray";
}

export function getModeSkyHex(mode: DataViewMode, theme: ColorTheme): string {
  const preset = findScenePreset(getModeSkyPreset(mode, theme));
  return preset?.hex ?? DEFAULT_SCENE_BG;
}

export function createSkyGradientTexture(
  top: string,
  bottom: string,
  height = 512,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function resolveSceneBackground(
  value: string,
): THREE.Color | THREE.CanvasTexture {
  const preset = findScenePreset(value);
  if (preset?.gradient) {
    return createSkyGradientTexture(preset.gradient.top, preset.gradient.bottom);
  }
  return new THREE.Color(preset?.hex ?? value);
}
