import { expect, it } from "vitest";
import { defaultModelingPlan } from ".";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";
import type { CommandRequest } from "../protocol";
import { defaultResidentialBrief } from "./brief";

const input: CommandRequest = { command: "create a 2 bed room appartement default sizes", attachments: [], history: [], context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } } };
it.each(["wall", "duct", "pipe", "cable tray"])("compiles basic 4 metre %s geometry locally", kind => {
  const result = defaultModelingPlan({ ...input, command: `create just a ${kind} with 4 meters long` })!;
  expect(result.usage.outputTokens).toBe(0);
  expect(result.plan.actions[1]).toMatchObject({ startXmm: 0, endXmm: 4000 });
});
it("creates a complete validated default apartment without provider tokens", () => {
  const result = defaultModelingPlan(input)!;
  expect(result.usage.inputTokens).toBe(0);
  expect(result.plan.actions.filter(a => a.kind === "door")).toHaveLength(5);
  expect(result.plan.actions.filter(a => a.kind === "window")).toHaveLength(3);
  expect(result.plan.actions.some(a => a.kind === "floor")).toBe(true);
});
it.each([1, 2, 3, 4])("validates %i bedroom layouts and exact bedroom clear areas", bedrooms => {
  const context = { ...input.context, activeLevelId: "l", elements: [{ id: "l", kind: "level" as const, properties: {} }] };
  const plan = validatePlan(expandModelPlan({ summary: "Apartment", assumptions: [], actions: [{ kind: "apartment_layout", id: "a", levelId: "l", bedrooms }] }), context);
  const partition = plan.actions.find(a => a.id === "a:wall:4")!;
  expect(partition.kind === "wall" && (partition.startYmm - 100 - 75) * 4000 / 1e6).toBe(20);
  expect(plan.actions.length).toBeLessThan(150);
});
it.each(["create a 2 bedroom apartment 80 m²", "create a 2 bedroom apartment with no windows", "review a 2 bedroom apartment", "create a 2 bedroom apartment and add pipes"])("does not discard custom intent: %s", command => {
  expect(defaultModelingPlan({ ...input, command })).toBeNull();
});
it("preserves review, attachments and conversation interpretation", () => {
  expect(defaultModelingPlan({ ...input, mode: "review" })).toBeNull();
  expect(defaultModelingPlan({ ...input, history: [{ role: "user", text: "Use 100 m²" }] })).toBeNull();
});
it.each([
  ["three bedroom appartement", "apartment", 3],
  ["2 bedroom apartemtnt", "apartment", 2],
  ["Create an apartment with four bedrooms", "apartment", 4],
  ["a villa", "villa", 3],
  ["please make me a five-bedroom villa", "villa", 5],
  ["a duplex house with 5 bedrooms", "duplex", 5],
  ["create a duplex", "duplex", 5],
  ["build a house", "villa", 3],
] as const)("automatically compiles %s", (command, variant, bedrooms) => {
  expect(defaultResidentialBrief(command)).toEqual({ variant, bedrooms });
  const result = defaultModelingPlan({ ...input, command })!;
  expect(result.kind).toBe("plan");
  expect(result.usage.inputTokens).toBe(0);
  expect(result.plan.summary).toContain(`${bedrooms}-bedroom`);
  expect(result.plan.actions.filter(a => a.kind === "level")).toHaveLength(variant === "duplex" ? 2 : 1);
  expect(result.plan.actions.filter(a => a.kind === "roof")).toHaveLength(variant === "apartment" ? 0 : 1);
});
it.each(["a villa with a pool", "a duplex house with 5 bedrooms and garage", "a villa 12 m by 15 m", "create a 2 unit duplex", "create a seven bedroom apartment", "do not create a villa", "create a villa and remove existing walls"])("keeps custom brief for provider interpretation: %s", command => {
  expect(defaultResidentialBrief(command)).toBeNull();
  expect(defaultModelingPlan({ ...input, command })).toBeNull();
});
it.each([1, 2, 3, 4, 5, 6])("keeps %i-bedroom duplex footprints aligned and the staircase clear of the upper floor", bedrooms => {
  const plan = validatePlan(expandModelPlan({ summary: "Duplex", assumptions: [], actions: [{ kind: "level", operation: "create", id: "l", name: "Ground", elevationMm: 1200, heightMm: 3000 }, { kind: "house_layout", id: "h", levelId: "l", variant: "duplex", bedrooms, baseElevationMm: 1200 }] }), input.context);
  expect(plan.actions.find(a => a.id === "h:upper")).toMatchObject({ elevationMm: 4400 });
  const groundWalls = plan.actions.filter(a => a.kind === "wall" && a.levelId === "l").slice(0, 4);
  const upperWalls = plan.actions.filter(a => a.kind === "wall" && a.levelId === "h:upper").slice(0, 4);
  expect(upperWalls.map(a => a.kind === "wall" && [a.startXmm, a.startYmm, a.endXmm, a.endYmm])).toEqual(groundWalls.map(a => a.kind === "wall" && [a.startXmm, a.startYmm, a.endXmm, a.endYmm]));
  const stairs = plan.actions.filter((a): a is Extract<typeof a, { kind: "floor" }> => a.kind === "floor" && a.id.startsWith("h:stair:"));
  const upperSlabs = plan.actions.filter((a): a is Extract<typeof a, { kind: "floor" }> => a.kind === "floor" && a.levelId === "h:upper");
  expect(upperSlabs).toHaveLength(4);
  expect(stairs.length).toBeGreaterThan(10);
  for (const step of stairs) {
    expect(step.elevationOffsetMm - step.thicknessMm).toBe(0);
    const centreX = (step.boundary[0].xMm + step.boundary[2].xMm) / 2;
    const centreY = (step.boundary[0].yMm + step.boundary[2].yMm) / 2;
    expect(upperSlabs.some(slab => centreX > slab.boundary[0].xMm && centreX < slab.boundary[2].xMm && centreY > slab.boundary[0].yMm && centreY < slab.boundary[2].yMm)).toBe(false);
  }
  expect(plan.actions.length).toBeLessThanOrEqual(150);
});
