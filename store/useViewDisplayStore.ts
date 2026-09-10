"use client";

import { create } from "zustand";

export interface ViewVisibility {
  hiddenCategories: string[];
  hiddenIds: string[];
  isolatedIds: string[] | null;
}
export const EMPTY_VIEW_VISIBILITY: ViewVisibility = { hiddenCategories: [], hiddenIds: [], isolatedIds: null };

export type RenderPreset = "architectural" | "golden" | "overcast" | "dusk" | "interior";

export interface RenderSceneSettings {
  renderSceneMode: "exterior" | "interior";
  skyEnabled: boolean;
  groundEnabled: boolean;
  groundLevelId: string | null;
  groundOffsetMm: number;
  groundSizeM: number;
  groundMaterialId: string;
  renderHiddenCategories: string[];
  cameraFov: number;
}
export const DEFAULT_RENDER_SCENE: RenderSceneSettings = {
  renderSceneMode: "exterior", skyEnabled: true, groundEnabled: true,
  groundLevelId: null, groundOffsetMm: -10, groundSizeM: 200,
  groundMaterialId: "", renderHiddenCategories: [], cameraFov: 45,
};
export interface RenderSettings extends RenderSceneSettings {
  sunAzimuth: number; // 0–360 deg
  sunElevation: number; // 10–85 deg
  sunIntensity: number; // 0.2–3.0
  ambientIntensity: number; // 0.1–2.0
  shadowsEnabled: boolean;
  shadowSoftness: "soft" | "crisp";
  exposure: number; // 0.6–2.0
  sunColor: string;
  skyColor: string;
  groundColor: string;
  renderPreset: RenderPreset;
}

export const RENDER_PRESET_CONFIGS: Record<RenderPreset, Omit<RenderSettings, "renderPreset" | keyof RenderSceneSettings>> = {
  architectural: {
    sunAzimuth: 45,
    sunElevation: 48,
    sunIntensity: 1.45,
    ambientIntensity: 0.55,
    shadowsEnabled: true,
    shadowSoftness: "soft",
    exposure: 1.05,
    sunColor: "#fff8ec",
    skyColor: "#e0f2fe",
    groundColor: "#334155",
  },
  golden: {
    sunAzimuth: 65,
    sunElevation: 20,
    sunIntensity: 1.6,
    ambientIntensity: 0.45,
    shadowsEnabled: true,
    shadowSoftness: "soft",
    exposure: 1.15,
    sunColor: "#fed7aa",
    skyColor: "#fdba74",
    groundColor: "#431407",
  },
  overcast: {
    sunAzimuth: 180,
    sunElevation: 65,
    sunIntensity: 0.7,
    ambientIntensity: 0.95,
    shadowsEnabled: true,
    shadowSoftness: "soft",
    exposure: 1.1,
    sunColor: "#f8fafc",
    skyColor: "#cbd5e1",
    groundColor: "#475569",
  },
  dusk: {
    sunAzimuth: 280,
    sunElevation: 12,
    sunIntensity: 0.9,
    ambientIntensity: 0.4,
    shadowsEnabled: true,
    shadowSoftness: "soft",
    exposure: 0.95,
    sunColor: "#f472b6",
    skyColor: "#1e1b4b",
    groundColor: "#0f172a",
  },
  interior: {
    sunAzimuth: 135,
    sunElevation: 35,
    sunIntensity: 1.1,
    ambientIntensity: 0.85,
    shadowsEnabled: true,
    shadowSoftness: "soft",
    exposure: 1.25,
    sunColor: "#fffbeb",
    skyColor: "#fef3c7",
    groundColor: "#334155",
  },
};

/** View filters are separate from the model and never delete building elements. */
export const useViewDisplayStore = create<RenderSceneSettings & {
  views: Record<string, ViewVisibility>;
  renderPreview: boolean;
  setRenderPreview: (on: boolean) => void;
  // Render lighting & camera properties
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  ambientIntensity: number;
  shadowsEnabled: boolean;
  shadowSoftness: "soft" | "crisp";
  exposure: number;
  sunColor: string;
  skyColor: string;
  groundColor: string;
  renderPreset: RenderPreset;
  setRenderSetting: <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => void;
  applyRenderPreset: (preset: RenderPreset) => void;
  toggleCategory: (view: string, category: string) => void;
  hide: (view: string, ids: string[]) => void;
  isolate: (view: string, ids: string[]) => void;
  reset: (view: string) => void;
}>((set) => ({
  ...DEFAULT_RENDER_SCENE,
  views: {},
  renderPreview: false,
  setRenderPreview: (renderPreview) => set({ renderPreview }),
  // Initial render lighting values from architectural preset
  sunAzimuth: 45,
  sunElevation: 48,
  sunIntensity: 1.45,
  ambientIntensity: 0.55,
  shadowsEnabled: true,
  shadowSoftness: "soft",
  exposure: 1.05,
  sunColor: "#fff8ec",
  skyColor: "#e0f2fe",
  groundColor: "#334155",
  renderPreset: "architectural",
  setRenderSetting: (key, value) => set({ [key]: value }),
  applyRenderPreset: (preset) => {
    const config = RENDER_PRESET_CONFIGS[preset];
    if (config) {
      set({ ...config, renderPreset: preset });
    }
  },
  toggleCategory: (view, category) => set(s => {
    const current = s.views[view] ?? EMPTY_VIEW_VISIBILITY;
    const hiddenCategories = current.hiddenCategories.includes(category)
      ? current.hiddenCategories.filter(c => c !== category) : [...current.hiddenCategories, category];
    return { views: { ...s.views, [view]: { ...current, hiddenCategories } } };
  }),
  hide: (view, ids) => set(s => {
    const current = s.views[view] ?? EMPTY_VIEW_VISIBILITY;
    return { views: { ...s.views, [view]: { ...current, hiddenIds: [...new Set([...current.hiddenIds, ...ids])] } } };
  }),
  isolate: (view, ids) => set(s => ids.length ? {
    views: { ...s.views, [view]: { ...(s.views[view] ?? EMPTY_VIEW_VISIBILITY), isolatedIds: ids, hiddenIds: [] } },
  } : s),
  reset: (view) => set(s => ({ views: { ...s.views, [view]: EMPTY_VIEW_VISIBILITY } })),
}));

export function viewDisplayKey(preset: string, levelId: string | null, sectionId?: string | null) {
  return preset === "top" ? `top:${levelId ?? "all"}` : preset === "section" ? `section:${sectionId ?? "all"}` : preset;
}
