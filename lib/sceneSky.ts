import * as THREE from "three";
import { lerpHex, type ColorTheme } from "@/lib/themeColors";
import type { DataViewMode } from "@/lib/dataViewMode";

const GRADIENT_LERP_PREFIX = "gradient:";

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

/** Bottom stop of the mode sky — used for page chrome behind the viewport. */
export function getModeSkyBottomHex(mode: DataViewMode, theme: ColorTheme): string {
  const preset = findScenePreset(getModeSkyPreset(mode, theme));
  if (!preset) return DEFAULT_SCENE_BG;
  return preset.gradient?.bottom ?? preset.hex;
}

export function encodeGradientLerp(top: string, bottom: string): string {
  return `${GRADIENT_LERP_PREFIX}${top}:${bottom}`;
}

export function parseGradientLerp(value: string): SkyGradient | null {
  if (!value.startsWith(GRADIENT_LERP_PREFIX)) return null;
  const rest = value.slice(GRADIENT_LERP_PREFIX.length);
  const match = rest.match(/^(#[0-9a-fA-F]{6}):(#[0-9a-fA-F]{6})$/);
  if (!match) return null;
  return { top: match[1], bottom: match[2] };
}

function presetGradient(preset: SceneBackgroundPreset): SkyGradient {
  return preset.gradient ?? { top: preset.hex, bottom: preset.hex };
}

function resolvePresetGradient(value: string): SkyGradient {
  const preset = findScenePreset(value);
  if (preset) return presetGradient(preset);
  if (value.startsWith("#")) return { top: value, bottom: value };
  return { top: DEFAULT_SCENE_BG, bottom: DEFAULT_SCENE_BG };
}

/** Interpolate two scene presets (ids or hex) — keeps gradient stops in sync with the 3D sky. */
export function lerpSceneBackgroundValue(
  from: string,
  to: string,
  t: number,
): string {
  if (t <= 0) return from;
  if (t >= 1) return to;

  const fromGrad = resolvePresetGradient(from);
  const toGrad = resolvePresetGradient(to);
  const fromPreset = findScenePreset(from);
  const toPreset = findScenePreset(to);

  if (fromPreset?.gradient || toPreset?.gradient) {
    return encodeGradientLerp(
      lerpHex(fromGrad.top, toGrad.top, t),
      lerpHex(fromGrad.bottom, toGrad.bottom, t),
    );
  }

  return lerpHex(fromPreset?.hex ?? from, toPreset?.hex ?? to, t);
}

/** Representative CSS color for a scene value (preset id, hex, or animated gradient). */
export function getSceneCssHex(value: string): string {
  const lerp = parseGradientLerp(value);
  if (lerp) return lerp.bottom;
  const preset = findScenePreset(value);
  return preset?.hex ?? value;
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

export function updateSkyGradientTexture(
  tex: THREE.CanvasTexture,
  top: string,
  bottom: string,
  height = 512,
): void {
  let canvas = tex.image as HTMLCanvasElement | undefined;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = height;
    tex.image = canvas;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  tex.needsUpdate = true;
}

export function resolveSceneBackground(
  value: string,
): THREE.Color | THREE.CanvasTexture {
  const lerpGrad = parseGradientLerp(value);
  if (lerpGrad) {
    return createSkyGradientTexture(lerpGrad.top, lerpGrad.bottom);
  }
  const preset = findScenePreset(value);
  if (preset?.gradient) {
    return createSkyGradientTexture(preset.gradient.top, preset.gradient.bottom);
  }
  return new THREE.Color(preset?.hex ?? value);
}

export function sceneBackgroundMatches(
  a: string,
  b: string,
): boolean {
  if (a === b) return true;
  const gradA = parseGradientLerp(a) ?? findScenePreset(a)?.gradient;
  const gradB = parseGradientLerp(b) ?? findScenePreset(b)?.gradient;
  if (gradA && gradB) {
    return (
      gradA.top.toLowerCase() === gradB.top.toLowerCase() &&
      gradA.bottom.toLowerCase() === gradB.bottom.toLowerCase()
    );
  }
  return getSceneCssHex(a).toLowerCase() === getSceneCssHex(b).toLowerCase();
}
