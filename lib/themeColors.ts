/**
 * Light/dark theme color tokens (page + "liquid glass" surfaces) and the
 * hex/rgba interpolation + CSS-variable helpers used to animate theme
 * switches. `applyThemeVars`/`applyThemeBlend` write directly to
 * document.documentElement's custom properties consumed by the app's CSS.
 */
export type ColorTheme = "light" | "dark";

export type ThemePalette = {
  background: string;
  foreground: string;
  sceneBackground: string;
  textStrong: string;
  textBody: string;
  textMuted: string;
  overlayFrom: string;
  overlayTo: string;
};

export type GlassPalette = {
  glassBorder: string;
  glassInsetBg: string;
  glassTint: string;
  glassMenuTint: string;
  glassSpecular: string;
  popoverBg: string;
  surfaceMuted: string;
  chipActiveBg: string;
  chipActiveText: string;
  panelDivider: string;
};

export const THEME_COLORS: Record<ColorTheme, ThemePalette> = {
  light: {
    background: "#cfd5df",
    foreground: "#18181b",
    sceneBackground: "#e8eaed",
    textStrong: "#18181b",
    textBody: "#3f3f46",
    textMuted: "#71717a",
    overlayFrom: "rgba(255, 220, 150, 0)",
    overlayTo: "rgba(255, 220, 150, 0)",
  },
  dark: {
    background: "#0f1419",
    foreground: "#e4e4e7",
    sceneBackground: "#2a3340",
    textStrong: "#f4f4f5",
    textBody: "#d4d4d8",
    textMuted: "#a1a1aa",
    overlayFrom: "rgba(255, 220, 150, 0)",
    overlayTo: "rgba(8, 12, 22, 0.92)",
  },
};

export const GLASS_THEME: Record<ColorTheme, GlassPalette> = {
  light: {
    glassBorder: "rgba(255, 255, 255, 0.62)",
    glassInsetBg: "rgba(255, 255, 255, 0.32)",
    glassTint: "rgba(255, 255, 255, 0.72)",
    glassMenuTint: "rgba(255, 255, 255, 0.88)",
    glassSpecular: "rgba(255, 255, 255, 0.78)",
    popoverBg: "rgba(255, 255, 255, 0.96)",
    surfaceMuted: "#f4f4f5",
    chipActiveBg: "rgba(255, 255, 255, 0.92)",
    chipActiveText: "#18181b",
    panelDivider: "rgba(113, 113, 122, 0.35)",
  },
  dark: {
    glassBorder: "rgba(255, 255, 255, 0.24)",
    glassInsetBg: "rgba(255, 255, 255, 0.14)",
    glassTint: "rgba(22, 28, 38, 0.88)",
    glassMenuTint: "rgba(26, 32, 44, 0.94)",
    glassSpecular: "rgba(255, 255, 255, 0.38)",
    popoverBg: "rgba(18, 24, 34, 0.97)",
    surfaceMuted: "rgba(255, 255, 255, 0.06)",
    chipActiveBg: "rgba(255, 255, 255, 0.16)",
    chipActiveText: "#fafafa",
    panelDivider: "rgba(255, 255, 255, 0.12)",
  },
};

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function lerpHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = A.r + (B.r - A.r) * t;
  const g = A.g + (B.g - A.g) * t;
  const bl = A.b + (B.b - A.b) * t;
  return `#${[r, g, bl]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function parseColor(input: string): { r: number; g: number; b: number; a: number } {
  if (input.startsWith("#")) {
    const { r, g, b } = hexToRgb(input);
    return { r, g, b, a: 1 };
  }
  const match = input.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  const parts = match[1].split(",").map((s) => parseFloat(s.trim()));
  return {
    r: parts[0] ?? 255,
    g: parts[1] ?? 255,
    b: parts[2] ?? 255,
    a: parts[3] ?? 1,
  };
}

export function lerpColor(a: string, b: string, t: number): string {
  const A = parseColor(a);
  const B = parseColor(b);
  const r = A.r + (B.r - A.r) * t;
  const g = A.g + (B.g - A.g) * t;
  const bl = A.b + (B.b - A.b) * t;
  const alpha = A.a + (B.a - A.a) * t;
  const ri = Math.round(Math.min(255, Math.max(0, r)));
  const gi = Math.round(Math.min(255, Math.max(0, g)));
  const bi = Math.round(Math.min(255, Math.max(0, bl)));
  const ai = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  return alpha < 1 ? `rgba(${ri}, ${gi}, ${bi}, ${ai})` : `rgb(${ri}, ${gi}, ${bi})`;
}

function applyGlassVars(theme: ColorTheme) {
  if (typeof document === "undefined") return;
  const g = GLASS_THEME[theme];
  const root = document.documentElement;
  root.style.setProperty("--glass-border", g.glassBorder);
  root.style.setProperty("--glass-inset-bg", g.glassInsetBg);
  root.style.setProperty("--glass-tint", g.glassTint);
  root.style.setProperty("--glass-menu-tint", g.glassMenuTint);
  root.style.setProperty("--glass-specular", g.glassSpecular);
  root.style.setProperty("--popover-bg", g.popoverBg);
  root.style.setProperty("--surface-muted", g.surfaceMuted);
  root.style.setProperty("--chip-active-bg", g.chipActiveBg);
  root.style.setProperty("--chip-active-text", g.chipActiveText);
  root.style.setProperty("--panel-divider", g.panelDivider);
}

function applyGlassBlend(from: ColorTheme, to: ColorTheme, t: number) {
  if (typeof document === "undefined") return;
  const a = GLASS_THEME[from];
  const b = GLASS_THEME[to];
  const root = document.documentElement;
  root.style.setProperty("--glass-border", lerpColor(a.glassBorder, b.glassBorder, t));
  root.style.setProperty("--glass-inset-bg", lerpColor(a.glassInsetBg, b.glassInsetBg, t));
  root.style.setProperty("--glass-tint", lerpColor(a.glassTint, b.glassTint, t));
  root.style.setProperty(
    "--glass-menu-tint",
    lerpColor(a.glassMenuTint, b.glassMenuTint, t),
  );
  root.style.setProperty(
    "--glass-specular",
    lerpColor(a.glassSpecular, b.glassSpecular, t),
  );
  root.style.setProperty("--popover-bg", lerpColor(a.popoverBg, b.popoverBg, t));
  root.style.setProperty(
    "--surface-muted",
    lerpColor(a.surfaceMuted, b.surfaceMuted, t),
  );
  root.style.setProperty(
    "--chip-active-bg",
    lerpColor(a.chipActiveBg, b.chipActiveBg, t),
  );
  root.style.setProperty(
    "--chip-active-text",
    lerpColor(a.chipActiveText, b.chipActiveText, t),
  );
  root.style.setProperty(
    "--panel-divider",
    lerpColor(a.panelDivider, b.panelDivider, t),
  );
}

export type ThemeSurfaceOverrides = {
  sceneBackground?: string;
  pageBackground?: string;
};

export function applyThemeVars(
  theme: ColorTheme,
  surfaces?: ThemeSurfaceOverrides,
) {
  if (typeof document === "undefined") return;
  const p = THEME_COLORS[theme];
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty(
    "--background",
    surfaces?.pageBackground ?? p.background,
  );
  root.style.setProperty("--foreground", p.foreground);
  root.style.setProperty(
    "--scene-bg",
    surfaces?.sceneBackground ?? p.sceneBackground,
  );
  root.style.setProperty("--text-strong", p.textStrong);
  root.style.setProperty("--text-body", p.textBody);
  root.style.setProperty("--text-muted", p.textMuted);
  applyGlassVars(theme);
}

export function applyThemeBlend(
  from: ColorTheme,
  to: ColorTheme,
  t: number,
  surfaces?: {
    from?: ThemeSurfaceOverrides;
    to?: ThemeSurfaceOverrides;
  },
) {
  if (typeof document === "undefined") return;
  const a = THEME_COLORS[from];
  const b = THEME_COLORS[to];
  const root = document.documentElement;
  const fromPage = surfaces?.from?.pageBackground ?? a.background;
  const toPage = surfaces?.to?.pageBackground ?? b.background;
  const fromScene = surfaces?.from?.sceneBackground ?? a.sceneBackground;
  const toScene = surfaces?.to?.sceneBackground ?? b.sceneBackground;
  root.style.setProperty("--background", lerpHex(fromPage, toPage, t));
  root.style.setProperty("--foreground", lerpHex(a.foreground, b.foreground, t));
  root.style.setProperty("--scene-bg", lerpHex(fromScene, toScene, t));
  root.style.setProperty("--text-strong", lerpHex(a.textStrong, b.textStrong, t));
  root.style.setProperty("--text-body", lerpHex(a.textBody, b.textBody, t));
  root.style.setProperty("--text-muted", lerpHex(a.textMuted, b.textMuted, t));
  applyGlassBlend(from, to, t);
  return lerpHex(fromScene, toScene, t);
}
