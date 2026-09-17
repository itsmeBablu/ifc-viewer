import { expect, it } from "vitest";
import { assignTerrainZone, createTerrainGrid, sculptTerrain } from "./terrain";

it("creates a subdivided site grid and smooth mound/depression falloff", () => {
  const grid = createTerrainGrid(-5000, -5000, 5000, 5000, 5, 5);
  const mound = sculptTerrain(grid, { xMm: 0, yMm: 0 }, 1200, 3000);
  const center = mound.points.find(p => p.xMm === 0 && p.yMm === 0)!;
  const edge = mound.points.find(p => p.xMm === 5000 && p.yMm === 5000)!;
  expect(center.heightMm).toBe(1200); expect(edge.heightMm).toBe(grid.points.find(p => p.xMm === 5000 && p.yMm === 5000)!.heightMm);
  expect(sculptTerrain(mound, { xMm: 0, yMm: 0 }, -600, 3000).points.find(p => p.xMm === 0 && p.yMm === 0)?.heightMm).toBe(600);
});

it("stores replaceable grass, earth and road zones", () => {
  const grid = createTerrainGrid(0, 0, 10000, 10000);
  const zone = { boundary: [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }], material: "water" as const };
  expect(assignTerrainZone(grid, zone).zones).toHaveLength(1);
});
