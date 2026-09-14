import { describe, expect, it } from "vitest";
import { validatePlan } from "./validate";
import type { AiAction, AiContext } from "./schema";

const context: AiContext = { projectId: "p", activeLevelId: "l", selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [{ kind: "level", id: "l", properties: { name: "Ground", elevationMm: 0, heightMm: 3000 } }] };
const wall: AiAction = { kind: "wall", operation: "create", id: "w", levelId: "l", startXmm: 0, startYmm: 0, endXmm: 5000, endYmm: 0, heightMm: 3000, thicknessMm: 200 };
const door: AiAction = { kind: "door", operation: "create", id: "d", wallId: "w", positionMm: 1000, widthMm: 900, heightMm: 2100, hinge: "start", swing: 1, style: "wood" };
const plan = (actions: AiAction[]) => ({ summary: "Test", assumptions: [], actions });
describe("AI dry-run validation", () => {
  it("supports same-batch hosts without mutating context", () => {
    expect(validatePlan(plan([wall, door]), context).actions).toHaveLength(2);
    expect(context.elements).toHaveLength(1);
  });
  it("rejects missing levels, hosts, duplicate IDs and zero-length walls", () => {
    for (const actions of [[{ ...wall, levelId: "missing" }], [door, wall], [wall, wall], [{ ...wall, endXmm: 0 }]]) expect(() => validatePlan(plan(actions), context)).toThrow();
  });
  it("rejects openings outside or overlapping on a wall", () => {
    expect(() => validatePlan(plan([wall, { ...door, positionMm: 100 }]), context)).toThrow(/fit/);
    expect(() => validatePlan(plan([wall, door, { ...door, id: "d2" }]), context)).toThrow(/overlap/);
    expect(() => validatePlan(plan([wall, { ...door, heightMm: 4000 }]), context)).toThrow(/fit/);
  });
  it("rejects a wall resize that invalidates an existing opening", () => {
    const populated: AiContext = { ...context, elements: [...context.elements, { id: "w", kind: "wall", levelId: "l", properties: wall }, { id: "d", kind: "door", wallId: "w", properties: door }] };
    expect(() => validatePlan(plan([{ ...wall, operation: "update", endXmm: 1100 }]), populated)).toThrow(/fit/);
    expect(() => validatePlan(plan([{ kind: "delete", id: "w", targetKind: "wall" }]), populated)).toThrow(/dependent/);
    expect(validatePlan(plan([{ kind: "delete", id: "d", targetKind: "door" }, { kind: "delete", id: "w", targetKind: "wall" }]), populated).actions).toHaveLength(2);
  });
  it("rejects self-intersecting boundaries", () => {
    expect(() => validatePlan(plan([{ kind: "floor", operation: "create", id: "s", levelId: "l", thicknessMm: 200, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0, boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 4000 }, { xMm: 0, yMm: 4000 }, { xMm: 4000, yMm: 0 }] }]), context)).toThrow();
  });
});
