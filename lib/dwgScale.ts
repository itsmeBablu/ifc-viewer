export type DwgBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** INSUNITS describes model coordinates; paper/annotation scales do not. */
export function dwgMillimetersPerUnit(insunits: unknown): number | undefined {
  if (typeof insunits !== "number" || !Number.isInteger(insunits)) return undefined;
  const units = [0, 25.4, 304.8, 1609344, 1, 10, 1000, 1e6, 0.0000254, 0.0254, 914.4, 1e-7, 1e-6, 0.001, 100, 10000, 100000, 1e12, 149597870700000, 9.4607304725808e18, 3.085677581491367e19, 1200000 / 3937, 100000 / 3937, 3600000 / 3937, 6336000000 / 3937];
  return units[insunits] || undefined;
}

/** Fit to integer raster dimensions without changing either axis's scale. */
export function dwgViewport(bounds: DwgBounds, maxEdge = 4096) {
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const width = bw >= bh ? maxEdge : Math.max(1, Math.round(maxEdge * bw / bh));
  const height = bh >= bw ? maxEdge : Math.max(1, Math.round(maxEdge * bh / bw));
  const unitsPerPixel = Math.max(bw / width, bh / height) * 1.04;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const halfX = width * unitsPerPixel / 1.04 / 2;
  const halfY = height * unitsPerPixel / 1.04 / 2;
  return { width, height, unitsPerPixel, bounds: { minX: cx - halfX, maxX: cx + halfX, minY: cy - halfY, maxY: cy + halfY } };
}
