"use client";

import { create } from "zustand";

export type StudioAccent = "vyellow" | "vblue" | "vgreen" | "vorange" | "vpurple" | "vrose";
export type StudioFont = "inter" | "jakarta" | "mono";
export type StudioFontScale = "compact" | "default" | "spacious";

export interface StudioAccentConfig {
  id: StudioAccent;
  name: string;
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  glowRgba: string;
}

export const STUDIO_ACCENTS: Record<StudioAccent, StudioAccentConfig> = {
  vyellow: {
    id: "vyellow",
    name: "Studio Gold",
    hex: "#facc15",
    textClass: "text-yellow-400",
    bgClass: "bg-yellow-400",
    borderClass: "border-yellow-400/40",
    glowRgba: "rgba(250, 204, 21, 0.4)",
  },
  vblue: {
    id: "vblue",
    name: "Cyan / MEP Sky",
    hex: "#38bdf8",
    textClass: "text-sky-400",
    bgClass: "bg-sky-400",
    borderClass: "border-sky-400/40",
    glowRgba: "rgba(56, 189, 248, 0.4)",
  },
  vgreen: {
    id: "vgreen",
    name: "Emerald Green",
    hex: "#4ade80",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-400",
    borderClass: "border-emerald-400/40",
    glowRgba: "rgba(74, 222, 128, 0.4)",
  },
  vorange: {
    id: "vorange",
    name: "Amber Orange",
    hex: "#fb923c",
    textClass: "text-orange-400",
    bgClass: "bg-orange-400",
    borderClass: "border-orange-400/40",
    glowRgba: "rgba(251, 146, 60, 0.4)",
  },
  vpurple: {
    id: "vpurple",
    name: "Violet Purple",
    hex: "#c084fc",
    textClass: "text-purple-400",
    bgClass: "bg-purple-400",
    borderClass: "border-purple-400/40",
    glowRgba: "rgba(192, 132, 252, 0.4)",
  },
  vrose: {
    id: "vrose",
    name: "Rose Pink",
    hex: "#fb7185",
    textClass: "text-rose-400",
    bgClass: "bg-rose-400",
    borderClass: "border-rose-400/40",
    glowRgba: "rgba(251, 113, 133, 0.4)",
  },
};

const ACCENT_KEY = "vstudio:accent";
const SYNC_ACCENTS_KEY = "vstudio:sync_accents";
const FONT_KEY = "vstudio:font";
const FONT_SCALE_KEY = "vstudio:font_scale";

interface StudioSettingsState {
  accent: StudioAccent;
  syncArchMep: boolean;
  font: StudioFont;
  fontScale: StudioFontScale;
  settingsModalOpen: boolean;
  setAccent: (accent: StudioAccent) => void;
  setSyncArchMep: (sync: boolean) => void;
  setFont: (font: StudioFont) => void;
  setFontScale: (scale: StudioFontScale) => void;
  setSettingsModalOpen: (open: boolean) => void;
}

export const useStudioSettingsStore = create<StudioSettingsState>((set) => {
  const getInitial = <T>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback;
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const initialAccent = getInitial<StudioAccent>(ACCENT_KEY, "vyellow");
  const initialSync = getInitial<boolean>(SYNC_ACCENTS_KEY, false);
  const initialFont = getInitial<StudioFont>(FONT_KEY, "inter");
  const initialScale = getInitial<StudioFontScale>(FONT_SCALE_KEY, "default");

  return {
    accent: initialAccent,
    syncArchMep: initialSync,
    font: initialFont,
    fontScale: initialScale,
    settingsModalOpen: false,

    setAccent: (accent: StudioAccent) => {
      set({ accent });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ACCENT_KEY, JSON.stringify(accent));
          const config = STUDIO_ACCENTS[accent];
          if (config) {
            document.documentElement.style.setProperty("--accent-custom-hex", config.hex);
            document.documentElement.style.setProperty("--accent-custom-glow", config.glowRgba);
          }
        } catch {}
      }
    },

    setSyncArchMep: (sync: boolean) => {
      set({ syncArchMep: sync });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SYNC_ACCENTS_KEY, JSON.stringify(sync));
        } catch {}
      }
    },

    setFont: (font: StudioFont) => {
      set({ font });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(FONT_KEY, JSON.stringify(font));
          document.documentElement.dataset.studioFont = font;
        } catch {}
      }
    },

    setFontScale: (fontScale: StudioFontScale) => {
      set({ fontScale });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(FONT_SCALE_KEY, JSON.stringify(fontScale));
          document.documentElement.dataset.studioFontScale = fontScale;
        } catch {}
      }
    },

    setSettingsModalOpen: (open: boolean) => {
      set({ settingsModalOpen: open });
    },
  };
});
