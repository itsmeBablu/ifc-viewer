/**
 * Heating (Heizlast) — intentionally empty barrel; no heating-only
 * components exist. The mode reuses shared UI instead:
 * - ../common — glass, theme, tips
 * - ../viewer — 3D / 2D / toolbar (ViewerApp composes modes)
 * - ../legend — scale / palette (switches by dataViewMode)
 * - ../floors — floor list / rooms
 *
 * Pair with `dataViewMode === "heizlast"`.
 */
export {};
