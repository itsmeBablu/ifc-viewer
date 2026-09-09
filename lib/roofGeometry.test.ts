import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { LayoutSlab } from "./layoutDrawing";
import { buildPlanarRoof, offsetRoofBoundary } from "./roofGeometry";
import { extendRoofEdge } from "./roofJoinGeometry";

const boundary = [{ xMm: 0, yMm: 0 }, { xMm: 10000, yMm: 0 }, { xMm: 10000, yMm: 6000 }, { xMm: 0, yMm: 6000 }];
const roof = (sloped = [0, 1, 2, 3]): LayoutSlab => ({ id: "roof", projectId: "p", levelId: "l", kind: "roof", minXmm: 0, minYmm: 0, maxXmm: 10000, maxYmm: 6000, thicknessMm: 200, elevationOffsetMm: 0, createdAt: 0, boundary, edgeSlopes: boundary.map((_, edgeIdx) => ({ edgeIdx, isSloped: sloped.includes(edgeIdx), pitchDeg: 30 })) });
function surface(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  const normals = new Set<string>();
  let area = 0;
  for (let i = 0; i < position.count; i += 3) if (normal.getY(i) > 0.01) {
    normals.add([normal.getX(i), normal.getY(i), normal.getZ(i)].map(v => v.toFixed(4).replace("-0.0000", "0.0000")).join(","));
    const a = new THREE.Vector2(position.getX(i), position.getZ(i));
    const b = new THREE.Vector2(position.getX(i + 1), position.getZ(i + 1));
    const c = new THREE.Vector2(position.getX(i + 2), position.getZ(i + 2));
    area += Math.abs(b.sub(a).cross(c.sub(a))) / 2;
    expect(Math.acos(normal.getY(i)) * 180 / Math.PI).toBeCloseTo(30, 3);
  }
  return { normals, area };
}
describe("planar roof geometry", () => {
  it.each([[0, 1, 2, 3], [0, 2], [0]])("builds only the intended planes for sloped edges %j", (...sloped) => {
    const geometry = buildPlanarRoof(roof(sloped), boundary)!;
    const result = surface(geometry);
    expect(result.normals.size).toBe(sloped.length);
    expect(result.area).toBeCloseTo(60, 5);
    geometry.dispose();
  });
  it("keeps openings in the sloped roof and its underside", () => {
    const slab = roof();
    slab.holes = [[{ xMm: 4000, yMm: 2000 }, { xMm: 6000, yMm: 2000 }, { xMm: 6000, yMm: 4000 }, { xMm: 4000, yMm: 4000 }]];
    const geometry = buildPlanarRoof(slab, boundary)!;
    expect(surface(geometry).area).toBeCloseTo(56, 5);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    expect(new THREE.Raycaster(new THREE.Vector3(5, 10, 3), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)).toHaveLength(0);
    geometry.dispose();
  });
  it("supports reversed winding and collinear split eaves without extra hip planes", () => {
    const split = [boundary[0], { xMm: 5000, yMm: 0 }, ...boundary.slice(1)].reverse();
    const slab = { ...roof(), edgeSlopes: undefined };
    expect(surface(buildPlanarRoof(slab, split)!).normals.size).toBe(4);
  });
  it("uses the exact ridge height on a rectangular hip", () => {
    const geometry = buildPlanarRoof(roof(), boundary)!;
    expect(geometry.boundingBox!.max.y).toBeCloseTo(0.2 + 3 * Math.tan(Math.PI / 6), 5);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
  });
  it("offsets eaves by the requested distance in either winding", () => {
    for (const ring of [boundary, [...boundary].reverse()]) {
      const points = offsetRoofBoundary(ring, 300);
      expect(Math.min(...points.map(p => p.xMm))).toBe(-300);
      expect(Math.max(...points.map(p => p.yMm))).toBe(6300);
    }
  });
  it("builds a level, constant-thickness flat roof", () => {
    const geometry = buildPlanarRoof(roof([]), boundary)!;
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(0.2);
  });
});

describe("roof joins", () => {
  it("extends a gable edge including its ridge and underside to another roof plane", () => {
    const geometry = buildPlanarRoof(roof([0, 2]), boundary)!;
    const pos = geometry.getAttribute("position");
    const vertices = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i));
    // Target plane rises with X: y = x - 11. The source meets it beyond X=10.
    const face = [[10, -1, -1], [15, 4, -1], [15, 4, 7], [10, -1, -1], [15, 4, 7], [10, -1, 7]].map(p => new THREE.Vector3(...p as [number, number, number]));
    const result = extendRoofEdge(vertices, boundary, 1, new THREE.Vector3(11, 0, 0), new THREE.Vector3(-1, 1, 0).normalize(), face);
    expect(result.boundary.length).toBeGreaterThan(4);
    let topCount = 0;
    vertices.forEach((v, i) => {
      if (Math.abs(v.x - 10) > 1e-6) return;
      const next = result.vertices[i];
      const difference = next.y - (next.x - 11);
      expect(Math.min(Math.abs(difference), Math.abs(difference + 0.2))).toBeLessThan(1e-5);
      if (Math.abs(difference) < 1e-5) topCount++;
    });
    expect(topCount).toBeGreaterThan(2);
  });
});
