/**
 * Design tokens — radius scale + LiquidGlass presets.
 * All floating UI goes through components/GlassPanel.tsx using these values.
 */
export const radius = {
  /** Panels / cards / header / sidebar (px for LiquidGlass) */
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
  sidebar: "transition-transform duration-[350ms] ease-out",
} as const;

/**
 * Shared @liquidglass/react props.
 * IMPORTANT: `blur` is CSS pixels (not 0–1). ~15px ≈ light-medium frosted glass.
 */
export const liquidGlass = {
  panel: {
    borderRadius: radius.panelPx,
    blur: 15,
    contrast: 1.12,
    brightness: 1.06,
    saturation: 1.2,
    shadowIntensity: 0,
    elasticity: 0.35,
    displacementScale: 0.4,
  },
  control: {
    borderRadius: radius.controlPx,
    blur: 12,
    contrast: 1.1,
    brightness: 1.05,
    saturation: 1.15,
    shadowIntensity: 0,
    elasticity: 0.3,
    displacementScale: 0.3,
  },
  chip: {
    borderRadius: radius.chipPx,
    blur: 10,
    contrast: 1.08,
    brightness: 1.04,
    saturation: 1.12,
    shadowIntensity: 0,
    elasticity: 0.25,
    displacementScale: 0.25,
  },
} as const;

export type GlassVariant = keyof typeof liquidGlass;

/** Soft inset surface inside a glass panel (not a separate LiquidGlass). */
export const glassInset = [
  radius.control,
  "border border-white/25",
  "bg-white/25",
].join(" ");

export const heading = {
  app: "text-base font-semibold tracking-wide text-zinc-900 md:text-lg",
  panel: "text-sm font-semibold tracking-wide text-zinc-800",
  muted: "text-xs font-medium tracking-wide text-zinc-500",
} as const;
