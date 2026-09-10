import { describe, expect, it } from "vitest";
import { nextOpeningOrientation, type OpeningOrientation } from "./openingOrientation";

describe("opening orientation", () => {
  it("cycles all four facing and hinge combinations without changing the angle", () => {
    const start: OpeningOrientation = { hinge: "start", swing: 1, openingAngleDeg: 45 };
    let current = start;
    const combinations = new Set<string>();
    for (let i = 0; i < 4; i++) {
      combinations.add(`${current.hinge}:${current.swing}`);
      current = nextOpeningOrientation(current);
      expect(current.openingAngleDeg).toBe(45);
    }
    expect(combinations.size).toBe(4);
    expect(current).toEqual(start);
  });
});
