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
    blur: 0.3,
    contrast: 1.22,
    brightness: 1.06,
    saturation: 1.2,
    shadowIntensity: 0.25,
    elasticity: 0.55,
    displacementScale: 0.85,
  },
  control: {
    borderRadius: radius.controlPx,
    blur: 0.25,
    contrast: 1.2,
    brightness: 1.05,
    saturation: 1.15,
    shadowIntensity: 0.2,
    elasticity: 0.5,
    displacementScale: 0.75,
  },
  menu: {
    borderRadius: radius.controlPx,
    blur: 0.28,
    contrast: 1.22,
    brightness: 1.06,
    saturation: 1.2,
    shadowIntensity: 0.25,
    elasticity: 0.5,
    displacementScale: 0.8,
  },
  chip: {
    borderRadius: radius.chipPx,
    blur: 0.22,
    contrast: 1.18,
    brightness: 1.05,
    saturation: 1.15,
    shadowIntensity: 0.18,
    elasticity: 0.45,
    displacementScale: 0.65,
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
