import { expect, it } from "vitest";
import { renderGroundElevation } from "./renderEnvironment";
it("places the ground relative to the selected level plus its height offset", () => {
  const levels = [{ id: "ground", elevationMm: 0 }, { id: "upper", elevationMm: 3200 }];
  expect(renderGroundElevation(levels, "upper", -200)).toBe(3);
  expect(renderGroundElevation(levels, "ground", -10)).toBe(-0.01);
  expect(renderGroundElevation(levels, null, 100)).toBe(0.1);
});
