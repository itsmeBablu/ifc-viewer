import { expect, it } from "vitest";
import { defaultModelingPlan } from ".";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";
import type { CommandRequest } from "../protocol";

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
