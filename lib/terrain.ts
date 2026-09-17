export type TerrainPoint = { xMm: number; yMm: number; heightMm: number };
export type TerrainMaterial = "earth" | "grass" | "mud" | "road" | "water";
export const TERRAIN_MATERIALS: { id: TerrainMaterial; label: string; color: string }[] = [
  { id: "grass", label: "Grass", color: "#6f9d4f" },
  { id: "earth", label: "Earth", color: "#8b6b4a" },
  { id: "mud", label: "Mud", color: "#5f4635" },
  { id: "road", label: "Road / paving", color: "#4b5563" },
  { id: "water", label: "Water", color: "#3b82f6" },
];
export type TerrainZone = { boundary: { xMm: number; yMm: number }[]; material: TerrainMaterial };

export function createTerrainGrid(minXmm: number, minYmm: number, maxXmm: number, maxYmm: number, rows = 17, cols = 17, baseHeightMm = 0, building?: { minXmm: number; minYmm: number; maxXmm: number; maxYmm: number }) {
  const points: TerrainPoint[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const xMm = minXmm + (maxXmm - minXmm) * col / (cols - 1), yMm = minYmm + (maxYmm - minYmm) * row / (rows - 1);
    const nx = (xMm - (minXmm + maxXmm) / 2) / Math.max(1, maxXmm - minXmm), ny = (yMm - (minYmm + maxYmm) / 2) / Math.max(1, maxYmm - minYmm);
    const gentleContour = 220 * (nx * .7 + ny * .45) + 90 * Math.sin(nx * Math.PI * 2) * Math.cos(ny * Math.PI * 2);
    const nearBuilding = building && xMm >= building.minXmm - 1200 && xMm <= building.maxXmm + 1200 && yMm >= building.minYmm - 1200 && yMm <= building.maxYmm + 1200;
    points.push({ xMm, yMm, heightMm: baseHeightMm + (nearBuilding ? 0 : gentleContour) });
  }
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
