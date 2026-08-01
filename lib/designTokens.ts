/**
 * Design tokens — radius scale + liquid glass presets.
 * All floating UI goes through components/GlassPanel.tsx using these values.
 */
export const radius = {
  /** Panels / cards / header / sidebar (px) */
  panelPx: 24,
  /** Buttons, chips, inputs (px) */
  controlPx: 16,
  /** Tiny chips e.g. temperature swatches (px) */
  chipPx: 12,
  /** Tailwind mirrors */
  panel: "rounded-3xl",
  control: "rounded-2xl",
} as const;

export const motion = {
  base: "transition-all duration-300 ease-out",
  sidebar: "transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
  /** Complex panel / overlay / 3D motion is handled via GSAP — see lib/gsapMotion.ts */
} as const;

/**
 * Shared @liquidglass/react props — iOS 26 Liquid Glass tuning.
 * Strong blur + lensing; CSS vars handle frosted tint/specular on `.glass-surface`.
 */
export const liquidGlass = {
  panel: {
    borderRadius: radius.panelPx,
    blur: 48,
    contrast: 1.24,
    brightness: 1.09,
    saturation: 1.45,
    shadowIntensity: 0,
    elasticity: 0.42,
    displacementScale: 0.48,
  },
  control: {
    borderRadius: radius.controlPx,
    blur: 40,
    contrast: 1.2,
    brightness: 1.08,
    saturation: 1.38,
    shadowIntensity: 0,
    elasticity: 0.38,
    displacementScale: 0.42,
  },
  menu: {
    borderRadius: radius.controlPx,
    blur: 44,
    contrast: 1.22,
    brightness: 1.08,
    saturation: 1.42,
    shadowIntensity: 0,
    elasticity: 0.4,
    displacementScale: 0.44,
  },
  chip: {
    borderRadius: radius.chipPx,
    blur: 32,
    contrast: 1.14,
    brightness: 1.06,
    saturation: 1.32,
    shadowIntensity: 0,
    elasticity: 0.34,
    displacementScale: 0.38,
  },
} as const;

export type GlassVariant = keyof typeof liquidGlass;

/** Nested surface inside a glass panel — lighter frosted inset. */
export const glassInset = [
  radius.control,
  "glass-inset",
].join(" ");

export const heading = {
  app: "text-base font-semibold tracking-wide text-[var(--text-strong)] md:text-lg",
  panel: "text-sm font-semibold tracking-wide text-[var(--text-strong)]",
  muted: "text-xs font-medium tracking-wide text-[var(--text-muted)]",
} as const;
