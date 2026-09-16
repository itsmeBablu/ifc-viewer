import { describe, expect, it } from "vitest";
import { expandModelPlan } from "./recipes";
import { validatePlan } from "./validate";
import { parseModelReply } from "./protocol";
import type { AiContext } from "./schema";

const context: AiContext = { projectId: "p", activeLevelId: "l", selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [{ id: "l", kind: "level", properties: { name: "Ground", elevationMm: 0, heightMm: 3000 } }] };
const shell = { kind: "rectangular_shell", id: "shell", levelId: "l", xMm: 1000, yMm: 2000, widthMm: 8000, depthMm: 6000, thicknessMm: 200, heightMm: 3000, floorThicknessMm: 200, roof: { preset: "flat", pitchDeg: 0, thicknessMm: 200 } };
const grid = { kind: "equipment_grid", id: "chairs", familyId: "dining-chair", levelId: "l", xMm: 0, yMm: 0, elevationMm: 0, rotationDeg: 90, columns: 10, rows: 10, stepXmm: 1000, stepYmm: 1500 };
const windows = { kind: "window_row", id: "windows", wallId: "shell:wall:0", positionMm: 1500, spacingMm: 2000, count: 3, widthMm: 1000, heightMm: 1200, sillHeightMm: 900, operationType: "fixed" };
const plan = (actions: unknown[]) => ({ summary: "Preview", assumptions: [], actions });

describe("deterministic modeling recipes", () => {
  it("expands a shell and dependent windows into a fully validated plan", () => {
    const result = validatePlan(expandModelPlan(plan([shell, windows])), context);
    expect(result.actions).toHaveLength(9);
    expect(result.actions[0]).toMatchObject({ id: "shell:wall:0", startXmm: 1000, startYmm: 2000, endXmm: 9000, endYmm: 2000 });
    expect(result.actions[3]).toMatchObject({ startXmm: 1000, startYmm: 8000, endXmm: 1000, endYmm: 2000 });
    expect(result.actions[4]).toMatchObject({ kind: "floor", boundary: [{ xMm: 900, yMm: 1900 }, { xMm: 9100, yMm: 1900 }, { xMm: 9100, yMm: 8100 }, { xMm: 900, yMm: 8100 }] });
    expect(result.actions[5]).toMatchObject({ kind: "roof", elevationOffsetMm: 3000 });
    expect(result.actions.slice(6).map(a => "positionMm" in a ? a.positionMm : null)).toEqual([1500, 3500, 5500]);
  });

  it("creates 100 catalogue items from a small payload without losing rotation or spacing", () => {
    const input = plan([grid]);
    const result = validatePlan(expandModelPlan(input), context);
    expect(result.actions).toHaveLength(100);
    expect(result.actions[99]).toMatchObject({ id: "chairs:item:99", xMm: 9000, yMm: 13500, rotationDeg: 90 });
    expect(JSON.stringify(input).length).toBeLessThan(JSON.stringify(result).length / 20);
  });

  it("uses wall paths for open and closed geometry without duplicate closing points", () => {
    const path = { kind: "wall_path", id: "path", levelId: "l", points: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 4000 }], closed: false, heightMm: 3000, thicknessMm: 200 };
    expect(validatePlan(expandModelPlan(plan([path])), context).actions).toHaveLength(2);
    expect(validatePlan(expandModelPlan(plan([{ ...path, closed: true }])), context).actions).toHaveLength(3);
    expect(() => expandModelPlan(plan([{ ...path, closed: true, points: path.points.slice(0, 2) }]))).toThrow(/three/);
    expect(() => expandModelPlan(plan([{ ...path, points: [...path.points, path.points[0]] }]))).toThrow(/distinct/);
  });

  it("bounds expanded counts and computed coordinates before application", () => {
    expect(expandModelPlan(plan([{ ...grid, columns: 15 }])).actions).toHaveLength(150);
    expect(() => expandModelPlan(plan([{ ...grid, columns: 16 }]))).toThrow(/150/);
    expect(() => expandModelPlan(plan([shell, { ...grid, columns: 15 }]))).toThrow(/150/);
    expect(() => expandModelPlan(plan([{ ...grid, xMm: 999999 }]))).toThrow();
    expect(() => expandModelPlan(plan([{ ...grid, stepXmm: 0 }]))).toThrow(/spacing/);
    expect(() => expandModelPlan(plan([{ ...grid, columns: 1.5 }]))).toThrow();
    expect(() => expandModelPlan(plan([{ ...shell, xMm: 999999 }]))).toThrow();
  });

  it("keeps host, opening overlap, ID and roof validation for recipes", () => {
    for (const actions of [
      [windows, shell],
      [shell, { ...windows, spacingMm: 500 }],
      [shell, { ...windows, count: 10 }],
      [shell, shell],
      [{ ...shell, levelId: "missing" }],
      [{ ...shell, roof: { preset: "gable", pitchDeg: 0, thicknessMm: 200 } }],
    ]) expect(() => validatePlan(expandModelPlan(plan(actions)), context)).toThrow();
  });

  it("expands model function calls before returning a browser preview", () => {
    const result = parseModelReply({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "propose_model", args: plan([shell]) } }] } }] });
    expect(result.kind).toBe("plan");
    if (result.kind === "plan") expect(result.plan.actions.map(a => a.kind)).toEqual(["wall", "wall", "wall", "wall", "floor", "roof"]);
  });
  it("rejects ambiguous recipe kinds and guessed host references rather than silently repairing them", () => {
    expect(() => expandModelPlan(plan([{ ...grid, kind: "equipment" }]))).toThrow();
    expect(() => validatePlan(expandModelPlan(plan([shell, { ...windows, wallId: "wall:0" }])), context)).toThrow(/Host wall/);
  });
});
