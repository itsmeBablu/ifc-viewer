import { describe, expect, it } from "vitest";
import { wallFaceFinishes } from "./wallFinishes";
import type { LayoutWall } from "./layoutDrawing";
const wall: LayoutWall = { id: "w", projectId: "p", levelId: "l", startXmm: 0, startYmm: 0, endXmm: 4000, endYmm: 0, thicknessMm: 300, heightMm: 3000, createdAt: 0 };
describe("wall face finishes", () => {
  it("keeps the core and total thickness while giving each face a different finish", () => {
    const patch = wallFaceFinishes(wall, [], { id: "plaster", color: "#ffffff" }, { id: "brick", color: "#aa5533" });
    expect(patch.layers![0].material).toBe("plaster");
    expect(patch.layers!.at(-1)!.material).toBe("brick");
    expect(patch.layers!.reduce((sum, layer) => sum + layer.thicknessMm, 0)).toBe(300);
    const interiorOnly = wallFaceFinishes({ ...wall, ...patch }, [], { id: "tile", color: "#dddddd" });
    expect(interiorOnly.layers!.at(-1)!.material).toBe("brick");
  });
  it("adds independent finishes to a monolithic custom type without thickening it", () => {
    const patch = wallFaceFinishes({ ...wall, wallTypeId: "custom" }, [{ id: "custom", layers: [{ id: "core", name: "Core", function: "structure", material: "concrete", thicknessMm: 300 }] }], { id: "inside", color: "#ffffff" }, { id: "outside", color: "#333333" });
    expect(patch.layers).toHaveLength(3);
    expect(patch.layers![1].material).toBe("concrete");
    expect(patch.layers!.reduce((sum, layer) => sum + layer.thicknessMm, 0)).toBe(300);
  });
});
