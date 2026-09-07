import { describe, expect, it } from "vitest";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { measurementGeometry } from "./measurementGeometry";
import { screenSegmentPoint } from "./measurementSnap";
import { findGlobalSnap } from "./globalSnapping";

describe("measurement geometry", () => {
  it("measures true 3D distance", () => {
    expect(measurementGeometry("distance", [{ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 }])?.length).toBe(7);
  });
  it("uses the second point as angle vertex in a vertical plane", () => {
    expect(measurementGeometry("angle", [{ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 4 }])?.angle).toBeCloseTo(90);
  });
  it("measures an arc through its middle point", () => {
    const result = measurementGeometry("arc", [{ x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: -2, y: 0, z: 0 }]);
    expect(result?.length).toBeCloseTo(Math.PI * 2);
    expect(result?.radius).toBeCloseTo(2);
    expect(result?.angle).toBeCloseTo(180);
  });
  it("retains the major arc selected by the middle point", () => {
    const result = measurementGeometry("arc", [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }]);
    expect(result?.angle).toBeCloseTo(270);
  });
  it("rejects coincident and collinear arc points", () => {
    expect(measurementGeometry("arc", [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }])).toBeNull();
  });
});

describe("screen-space snapping", () => {
  const rect = { left: 0, top: 0, width: 1000, height: 1000 };
  it("corrects perspective interpolation along an edge", () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.updateMatrixWorld();
    const a = new Vector3(-1, 0, -2), b = new Vector3(1, 0, -8);
    const pa = a.clone().project(camera), pb = b.clone().project(camera);
    const x = ((pa.x + pb.x) / 2 + 1) * 500;
    const point = screenSegmentPoint(a, b, camera, rect, x, 500)!;
    expect((point.clone().project(camera).x + 1) * 500).toBeCloseTo(x);
    expect(point.y).toBe(0);
  });
  it("snaps continuously rather than to sampled eighths", () => {
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const snap = findGlobalSnap({ camera, canvas: { getBoundingClientRect: () => rect } as HTMLCanvasElement,
      clientPos: { x: 637, y: 500 }, activeModes: { endpoint: false, midpoint: false, intersection: false, center: false },
      sketchLines: [{ id: "line", levelId: "L", startXmm: -4000, startYmm: 0, endXmm: 4000, endYmm: 0 } as never],
    });
    expect(snap.type).toBe("nearest");
    expect(snap.worldMm.xMm).toBeCloseTo(1370);
  });
});
