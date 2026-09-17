export type TerrainPoint = { xMm: number; yMm: number; heightMm: number };
export type TerrainZone = { boundary: { xMm: number; yMm: number }[]; material: "earth" | "grass" | "road" };

export function createTerrainGrid(minXmm: number, minYmm: number, maxXmm: number, maxYmm: number, rows = 17, cols = 17, baseHeightMm = 0) {
  const points: TerrainPoint[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) points.push({ xMm: minXmm + (maxXmm - minXmm) * col / (cols - 1), yMm: minYmm + (maxYmm - minYmm) * row / (rows - 1), heightMm: baseHeightMm });
  return { rows, cols, points };
}

/** Smooth sculpt brush: cosine falloff moves nearby vertices with the selected point. */
export function sculptTerrain(grid: { rows: number; cols: number; points: TerrainPoint[] }, center: { xMm: number; yMm: number }, deltaMm: number, radiusMm: number) {
  if (radiusMm <= 0) return grid;
  return { ...grid, points: grid.points.map(p => { const distance = Math.hypot(p.xMm - center.xMm, p.yMm - center.yMm); if (distance >= radiusMm) return p; const t = distance / radiusMm; const falloff = .5 * (1 + Math.cos(Math.PI * t)); return { ...p, heightMm: p.heightMm + deltaMm * falloff }; }) };
}

export function assignTerrainZone(grid: { rows: number; cols: number; points: TerrainPoint[]; zones?: TerrainZone[] }, zone: TerrainZone) {
  return { ...grid, zones: [...(grid.zones ?? []).filter(existing => JSON.stringify(existing.boundary) !== JSON.stringify(zone.boundary)), zone] };
}
