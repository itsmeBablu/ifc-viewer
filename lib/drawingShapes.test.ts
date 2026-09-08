import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { drawingSegments, sampleDrawingSegment } from "./drawingShapes";
import { meshDrawingEdges, projectDrawingEdges } from "./drawingReferences";

describe("drawing shapes", () => {
  it("extends a chain from its most recent endpoint", () => {
    expect(drawingSegments("line", [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 2000 }])).toEqual([{ startXmm: 1000, startYmm: 0, endXmm: 1000, endYmm: 2000 }]);
  });
  it("creates a closed rectangle in either drag direction", () => {
    for (const [a, b] of [[{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 3000 }], [{ xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 0 }]]) {
      const segments = drawingSegments("rectangle", [a, b]);
      expect(segments).toHaveLength(4);
      segments.forEach((s, i) => { const next = segments[(i + 1) % 4]; expect([s.endXmm, s.endYmm]).toEqual([next.startXmm, next.startYmm]); });
      expect(segments.reduce((sum, s) => sum + Math.hypot(s.endXmm - s.startXmm, s.endYmm - s.startYmm), 0)).toBe(14000);
    }
  });
  it("keeps circles analytic and closed", () => {
    const circle = drawingSegments("circle", [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 4000 }]);
    expect(circle).toHaveLength(4);
    circle.forEach(s => expect(s.arcRadiusMm).toBe(5000));
    expect(sampleDrawingSegment(circle[3]).at(-1)!.xMm).toBeCloseTo(circle[0].startXmm);
    expect(sampleDrawingSegment(circle[3]).at(-1)!.yMm).toBeCloseTo(circle[0].startYmm);
  });
  it("chooses the arc passing through the third point on either side", () => {
    for (const yMm of [-1000, 1000]) {
      const arc = drawingSegments("arc", [{ xMm: -1000, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 0, yMm }])[0];
      const points = sampleDrawingSegment(arc);
      expect(points[Math.floor(points.length / 2)].yMm).toBeCloseTo(yMm);
      expect(points[0].xMm).toBeCloseTo(-1000);
      expect(points.at(-1)!.xMm).toBeCloseTo(1000);
    }
  });
  it("rejects degenerate shapes", () => {
    expect(drawingSegments("rectangle", [{ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 100 }])).toEqual([]);
    expect(drawingSegments("circle", [{ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 0 }])).toEqual([]);
    expect(drawingSegments("arc", [{ xMm: 0, yMm: 0 }, { xMm: 100, yMm: 0 }, { xMm: 50, yMm: 0 }])).toEqual([]);
  });
});

describe("pick face outline", () => {
  it("extracts the box top perimeter without triangulation diagonals", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5)); mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    const edges = meshDrawingEdges(hit, true);
    expect(edges).toHaveLength(4);
    const projected = projectDrawingEdges(edges);
    expect(projected).toHaveLength(4);
    expect(projected.reduce((sum, s) => sum + Math.hypot(s.endXmm - s.startXmm, s.endYmm - s.startYmm), 0)).toBe(18000);
  });
  it("collapses a vertical face to one plan line", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5)); mesh.updateMatrixWorld();
    const hit = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)[0];
    expect(projectDrawingEdges(meshDrawingEdges(hit, true))).toHaveLength(1);
  });
});
