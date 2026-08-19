import { describe, it, expect } from "vitest";
import {
  wallLengthMm,
  wallAngleDeg,
  wallTranslated,
  wallRotatedAboutCenter,
  computePolygonAreaSqM,
  type LayoutWall,
  type WallLayer,
  type WallType,
} from "../lib/layoutDrawing";

describe("V Studio — Wall Geometry & Math", () => {
  const wall: LayoutWall = {
    id: "w1",
    projectId: "p1",
    levelId: "l1",
    startXmm: 0,
    startYmm: 0,
    endXmm: 4000,
    endYmm: 3000,
    thicknessMm: 200,
    heightMm: 3000,
    createdAt: 1000,
  };

  it("calculates correct wall length via Pythagorean distance", () => {
    const len = wallLengthMm(wall);
    expect(len).toBe(5000);
  });

  it("calculates correct wall angle in degrees", () => {
    const horizontalWall: LayoutWall = { ...wall, endXmm: 5000, endYmm: 0 };
    expect(wallAngleDeg(horizontalWall)).toBe(0);

    const verticalWall: LayoutWall = { ...wall, endXmm: 0, endYmm: 5000 };
    expect(wallAngleDeg(verticalWall)).toBe(90);
  });

  it("translates wall coordinates correctly", () => {
    const translated = wallTranslated(wall, 500, -500);
    expect(translated.startXmm).toBe(500);
    expect(translated.startYmm).toBe(-500);
    expect(translated.endXmm).toBe(4500);
    expect(translated.endYmm).toBe(2500);
  });

  it("rotates wall about center correctly", () => {
    const horiz: LayoutWall = { ...wall, startXmm: 0, startYmm: 0, endXmm: 4000, endYmm: 0 };
    const rotated90 = wallRotatedAboutCenter(horiz, 90);
    expect(rotated90.startXmm).toBeCloseTo(2000, 0);
    expect(rotated90.startYmm).toBeCloseTo(-2000, 0);
    expect(rotated90.endXmm).toBeCloseTo(2000, 0);
    expect(rotated90.endYmm).toBeCloseTo(2000, 0);
  });

  it("computes polygon area in sq meters accurately", () => {
    // 5m x 4m rectangle = 20 m²
    const rect = [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ];
    const area = computePolygonAreaSqM(rect);
    expect(area).toBe(20);
  });
});

describe("V Studio — Layered Wall Assemblies", () => {
  it("sums individual layer thicknesses into total wall thickness", () => {
    const layers: WallLayer[] = [
      { id: "l1", name: "Plaster", function: "finish1", material: "Plaster", thicknessMm: 15 },
      { id: "l2", name: "Concrete Core", function: "structure", material: "Concrete Core", thicknessMm: 170 },
      { id: "l3", name: "Insulation", function: "insulation", material: "Mineral Wool", thicknessMm: 100 },
      { id: "l4", name: "Plaster Exterior", function: "finish2", material: "Stucco", thicknessMm: 15 },
    ];

    const totalThicknessMm = layers.reduce((acc, layer) => acc + layer.thicknessMm, 0);
    const wallType: WallType = {
      id: "wt-ext-300",
      name: "Exterior Insulated 300mm",
      layers,
      totalThicknessMm,
    };

    expect(wallType.totalThicknessMm).toBe(300);
    expect(wallType.layers).toHaveLength(4);
    expect(wallType.layers[1].function).toBe("structure");
  });
});

describe("V Studio — Multi-Selection & Marquee Math", () => {
  it("determines whether 2D projected bounding box contains points for window/crossing selection", () => {
    const box = { minX: 100, minY: 100, maxX: 300, maxY: 300 };
    const insidePoint = { x: 200, y: 200 };
    const outsidePoint = { x: 400, y: 400 };

    const isInside = (pt: { x: number; y: number }) =>
      pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY;

    expect(isInside(insidePoint)).toBe(true);
    expect(isInside(outsidePoint)).toBe(false);

    // Window selection (all must be inside)
    const elementVerticesInside = [
      { x: 150, y: 150 },
      { x: 250, y: 250 },
    ];
    expect(elementVerticesInside.every(isInside)).toBe(true);

    // Crossing selection (any inside)
    const elementVerticesCrossing = [
      { x: 250, y: 250 },
      { x: 450, y: 450 },
    ];
    expect(elementVerticesCrossing.some(isInside)).toBe(true);
    expect(elementVerticesCrossing.every(isInside)).toBe(false);
  });
});
