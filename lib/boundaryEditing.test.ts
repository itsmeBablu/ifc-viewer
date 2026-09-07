import { describe, expect, it } from "vitest";
import { ShapeUtils, Vector2 } from "three";
import { moveBoundaryEdge, projectToEdge, trimBoundaryCorner, validateBoundary, type BoundaryPoint } from "./boundaryEditing";

const points = (values: number[][]): BoundaryPoint[] => values.map(([xMm, yMm]) => ({ xMm, yMm }));
const square = points([[0, 0], [100, 0], [100, 100], [0, 100]]);
const hole = points([[20, 20], [40, 20], [40, 40], [20, 40]]);

describe("boundary validity", () => {
  it("accepts concave rings, holes, either winding, and straight split edges", () => {
    expect(validateBoundary([square, hole])).toBeNull();
    expect(validateBoundary([[...square].reverse(), hole])).toBeNull();
    expect(validateBoundary([points([[0, 0], [50, 0], [100, 0], [100, 100], [50, 50], [0, 100]])])).toBeNull();
  });
  it.each([
    [[0, 0], [100, 100], [100, 0], [0, 100]],
    [[0, 0], [100, 0], [50, 0], [100, 100], [0, 100]],
    [[0, 0], [100, 0], [100, 0], [0, 100]],
    [[0, 0], [100, 0], [100, 100], [50, 0], [0, 100]],
    [[0, 0], [100, 0], [NaN, 100]],
  ])("rejects crossing, overlapping, touching, collapsed and nonfinite rings (%j)", (...coords) => {
    expect(validateBoundary([points(coords)])).not.toBeNull();
  });
  it("rejects escaped, touching, overlapping, nested and crossing holes", () => {
    const shift = (dx: number, dy: number) => hole.map(p => ({ xMm: p.xMm + dx, yMm: p.yMm + dy }));
    for (const loops of [[square, shift(100, 0)], [square, shift(-20, 0)], [square, hole, shift(10, 0)], [square, hole, points([[25, 25], [30, 25], [30, 30], [25, 30]])]]) {
      expect(validateBoundary(loops)).not.toBeNull();
    }
    const concave = points([[0, 0], [100, 0], [100, 100], [60, 100], [60, 40], [40, 40], [40, 100], [0, 100]]);
    expect(validateBoundary([concave, points([[20, 60], [80, 60], [80, 80], [20, 80]])])).not.toBeNull();
  });
});

describe("edge editing", () => {
  it("translates only the selected edge, keeps its direction and ignores tangential movement", () => {
    const result = moveBoundaryEdge([square, hole], 0, 0, { xMm: 50, yMm: 0 }, { xMm: 70, yMm: -20 });
    expect(result[0]).toEqual(points([[0, -20], [100, -20], [100, 100], [0, 100]]));
    expect(result[1]).toEqual(hole);
    expect(square[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(validateBoundary(result)).toBeNull();
  });
  it("extends an endpoint along its supporting line", () => {
    expect(projectToEdge({ xMm: 120, yMm: 50 }, square[0], square[1])).toEqual({ xMm: 120, yMm: 0 });
  });
  it("extends across a bevel, retaining the clicked portions", () => {
    const bevel = points([[0, 0], [80, 0], [100, 20], [100, 100], [0, 100]]);
    const result = trimBoundaryCorner(bevel, 0, { xMm: 40, yMm: 0 }, 2, { xMm: 100, yMm: 60 });
    expect(result).toEqual(points([[100, 0], [100, 100], [0, 100], [0, 0]]));
    expect(trimBoundaryCorner(bevel, 2, { xMm: 100, yMm: 60 }, 0, { xMm: 40, yMm: 0 })).toEqual(result);
    expect(trimBoundaryCorner(square, 0, square[0], 2, square[2])).toBeNull();
    expect(trimBoundaryCorner(square, 0, square[0], 0, square[1])).toBeNull();
  });
  it("produces Earcut triangles with the exact net area after trim, including holes", () => {
    const bevel = points([[0, 0], [80, 0], [100, 20], [100, 100], [0, 100]]);
    const result = trimBoundaryCorner(bevel, 0, { xMm: 40, yMm: 0 }, 2, { xMm: 100, yMm: 60 })!;
    expect(validateBoundary([result, hole])).toBeNull();
    const outer = result.map(p => new Vector2(p.xMm, p.yMm));
    const inner = hole.map(p => new Vector2(p.xMm, p.yMm));
    const vertices = [...outer, ...inner];
    const triangles = ShapeUtils.triangulateShape(outer, [inner]);
    const area = triangles.reduce((sum, [i, j, k]) => sum + Math.abs(ShapeUtils.area([vertices[i], vertices[j], vertices[k]])), 0);
    expect(area).toBeCloseTo(9600);
  });
});
