/**
 * Cooling (Kühllast) — intentionally empty barrel; no cooling-only
 * components exist. The mode reuses shared UI instead:
 * - ../common — glass, theme, tips
 * - ../viewer — 3D / 2D / toolbar
 * - ../legend — scale / palette (switches by dataViewMode)
 * - ../floors — floor list / rooms
 *
 * Pair with `dataViewMode === "kuhllast"`.
 */
export {};
