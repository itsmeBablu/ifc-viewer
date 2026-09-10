import { describe, expect, it } from "vitest";
import { dwgMillimetersPerUnit, dwgViewport } from "./dwgScale";
import { strokesToSnapSegmentsUv } from "./underlaySnap";
import { createUnderlayRecord, underlayUvToWorld } from "./referenceUnderlay";

describe("DWG model-space dimensions", () => {
  it.each([[4, 1], [5, 10], [6, 1000], [1, 25.4], [2, 304.8]])("converts INSUNITS %i into millimeters", (unit, mm) => {
    expect(dwgMillimetersPerUnit(unit)).toBe(mm);
  });
  it.each([0, undefined, -1, 99, NaN, "4"])("does not guess missing/invalid units: %s", unit => {
    expect(dwgMillimetersPerUnit(unit)).toBeUndefined();
  });
  it.each([[30, 0], [0, 30], [18, 24]])("keeps a 30 mm stroke at 30 mm through raster padding and snapping (%i, %i)", (x, y) => {
    const viewport = dwgViewport({ minX: 0, minY: 0, maxX: x, maxY: y });
    const segments = strokesToSnapSegmentsUv([{ points: [{ x: 0, y: 0 }, { x, y }] }], viewport.bounds);
    const record = createUnderlayRecord({ projectId: "p", levelId: "l", sourceName: "30mm.dwg", image: { dataUrl: "", byteLength: 0, width: viewport.width, height: viewport.height, snapSegments: segments, mmPerPixel: viewport.unitsPerPixel * dwgMillimetersPerUnit(4)! } });
    const segment = segments[0];
    const a = underlayUvToWorld(record, segment.u0, segment.v0);
    const b = underlayUvToWorld(record, segment.u1, segment.v1);
    expect(Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm)).toBeCloseTo(30, 8);
  });
  it("preserves vertical scale when the image aspect ratio rounds to pixels", () => {
    const viewport = dwgViewport({ minX: -33, minY: 20, maxX: 100, maxY: 37 });
    expect((viewport.bounds.maxX - viewport.bounds.minX) / viewport.width).toBeCloseTo((viewport.bounds.maxY - viewport.bounds.minY) / viewport.height, 12);
  });
});
