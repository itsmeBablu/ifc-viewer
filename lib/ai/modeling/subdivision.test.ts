import { describe, it, expect } from "vitest";
import { generateSubdividedLayout } from "./subdivision";

describe("Subdivision Engine & Real Reference Rules", () => {
  it("generates valid rooms conforming to architectural standards", () => {
    const layout = generateSubdividedLayout(14000, 10000, {
      variant: "villa",
      bedrooms: 3,
      layoutSeed: 42,
    });
    expect(layout.rooms.length).toBeGreaterThanOrEqual(4);
    const living = layout.rooms.find((r) => r.use === "living");
    expect(living).toBeDefined();
    expect(living!.areaM2).toBeGreaterThanOrEqual(18);

    const bedrooms = layout.rooms.filter((r) => r.use === "bedroom");
    expect(bedrooms).toHaveLength(3);
    for (const bed of bedrooms) {
      expect(bed.areaM2).toBeGreaterThanOrEqual(9);
    }
  });

  it("produces visibly different room arrangements with different seeds", () => {
    const layoutA = generateSubdividedLayout(14000, 10000, {
      variant: "villa",
      bedrooms: 3,
      layoutSeed: 101,
    });
    const layoutB = generateSubdividedLayout(14000, 10000, {
      variant: "villa",
      bedrooms: 3,
      layoutSeed: 8092,
    });

    // Positions of living room and bedrooms should differ
    const livingA = layoutA.rooms.find((r) => r.use === "living")!;
    const livingB = layoutB.rooms.find((r) => r.use === "living")!;
    const diff = Math.abs(livingA.xMm - livingB.xMm) + Math.abs(livingA.yMm - livingB.yMm);
    expect(diff).toBeGreaterThan(500);

    // Wall counts or positions should differ
    const wallsA = JSON.stringify(layoutA.interiorWalls);
    const wallsB = JSON.stringify(layoutB.interiorWalls);
    expect(wallsA).not.toBe(wallsB);
  });

  it("handles 1 to 6 bedrooms smoothly", () => {
    for (let beds = 1; beds <= 6; beds++) {
      const layout = generateSubdividedLayout(16000, 12000, {
        variant: "apartment",
        bedrooms: beds,
        layoutSeed: beds * 100,
      });
      const bedroomRooms = layout.rooms.filter((r) => r.use === "bedroom");
      expect(bedroomRooms).toHaveLength(beds);
    }
  });
});
