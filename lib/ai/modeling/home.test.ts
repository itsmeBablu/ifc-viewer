import { expect, it } from "vitest";
import { suggestHomes, homeSiteFit } from "./home";
import { residentialSketches } from "./preview";
import { sketchActions } from "./sketch";
import { moveSketchEndpoint, moveSketchLine } from "./sketchEditing";
import type { FloorSketch } from "./allocation";
import { validatePlan } from "../validate";
import { defaultModelingPlan } from "./index";
import { apartmentActions, apartmentSchema } from "./apartment";
import { projectHomeSketches } from "./project";

it("offers only fitting small homes for a 120 m² plot", () => {
  const site = { areaM2: 120 };
  const suggestions = suggestHomes(site);
  expect(suggestions.length).toBeGreaterThan(0);
  for (const s of suggestions) {
    expect(s.parameters.bedrooms).toBeLessThanOrEqual(2);
    expect(homeSiteFit(s.parameters, site).fits).toBe(true);
    expect(() => residentialSketches(s.parameters)).not.toThrow();
  }
});

it("checks length and width, including a narrow plot", () => {
  for (const site of [{ areaM2: 120, widthM: 10, lengthM: 12 }, { areaM2: 120, widthM: 4, lengthM: 30 }]) {
    for (const suggestion of suggestHomes(site)) expect(homeSiteFit(suggestion.parameters, site).fits).toBe(true);
  }
});

it("refreshes actual partitions while retaining the envelope and bedroom count", () => {
  const p = suggestHomes({ areaM2: 120 })[0].parameters;
  const original = residentialSketches(p)[0];
  const refreshed = residentialSketches({ ...p, layoutRevision: 1 })[0];
  expect(refreshed.points).toEqual(original.points);
  expect(refreshed.lines).not.toEqual(original.lines);
  expect(refreshed.labels?.filter(l => l.use === "bedroom")).toHaveLength(p.bedrooms);
});

it("builds edited open partitions with automatic chosen openings and electrical equipment", () => {
  const p = { ...suggestHomes({ areaM2: 120 })[0].parameters, doorStyle: "metal" as const, doorHeightMm: 2300, windowStyle: "sliding" as const, windowHeightMm: 1000, electrical: true };
  const sketches = residentialSketches(p);
  const actions = sketchActions({ ...p, sketches }, "home", "ground", 0, 3000, 200);
  expect(actions.filter(a => a.kind === "door").every(a => a.kind === "door" && a.style === "metal" && a.heightMm === 2300)).toBe(true);
  expect(actions.filter(a => a.kind === "window").every(a => a.kind === "window" && a.operationType === "sliding" && a.heightMm === 1000)).toBe(true);
  expect(actions.some(a => a.kind === "equipment" && a.familyId === "mep-lighting_fixture")).toBe(true);
  expect(() => validatePlan({ summary: "Home", assumptions: [], actions }, { projectId: "p", activeLevelId: "ground", defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, selection: [], elements: [{ id: "ground", kind: "level", properties: { elevationMm: 0, heightMm: 3000 } }] })).not.toThrow();
});

const draft: FloorSketch = { points: [{ xMm: 1000, yMm: 1000 }, { xMm: 9000, yMm: 1000 }, { xMm: 9000, yMm: 9000 }, { xMm: 1000, yMm: 9000 }], lines: [{ start: { xMm: 1000, yMm: 5000 }, end: { xMm: 6000, yMm: 5000 } }] };

it("moves an open partition smoothly and carries its attached outer corner", () => {
  const next = moveSketchLine(draft, 0, true, 0, 321);
  expect(next.lines[0].start.yMm).toBe(5321);
  expect(next.lines[0].end.yMm).toBe(5321);
  expect(draft.lines[0].start.yMm).toBe(5000);
});

it("moves the correct outer endpoint and respects connected length locks", () => {
  const next = moveSketchEndpoint(draft, 0, false, "end", { xMm: 9500, yMm: 1000 });
  expect(next.points[0]).toEqual(draft.points[0]);
  expect(next.points[1].xMm).toBe(9500);
  expect(() => moveSketchEndpoint({ ...draft, locks: [{ index: 0, interior: false, lengthMm: 8000 }] }, 0, false, "end", { xMm: 9500, yMm: 1000 })).toThrow(/Unlock/);
});

it("creates requested bathrooms and a separate guest WC with automatic openings", () => {
  const p = { variant: "apartment" as const, bedrooms: 3, bedroomAreasM2: [11, 14, 18], bedroomAreaM2: 14.33, bathroomCount: 2, guestBathroom: true, doubleEntranceDoor: true, furnished: true, balcony: "none" as const };
  const { variant: _variant, ...options } = p;
  void _variant;
  const actions = apartmentActions(apartmentSchema.parse({ ...options, kind: "apartment_layout", id: "bathrooms", levelId: "ground" }));
  expect(actions.filter(a => a.kind === "equipment" && a.familyId === "bath-toilet")).toHaveLength(3);
  const context = { projectId: "p", activeLevelId: "ground", defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, selection: [], elements: [{ id: "ground", kind: "level" as const, properties: { elevationMm: 0, heightMm: 3000 } }] };
  expect(() => validatePlan({ summary: "Bathrooms", assumptions: [], actions }, context)).not.toThrow();
  expect(() => defaultModelingPlan({ command: "Build", model: "gemini-3.1-flash-lite", mode: "build", residential: p, context, attachments: [], history: [] })).not.toThrow();
});

it("imports an existing project as editable line geometry", () => {
  const sketches = projectHomeSketches({ projectId: "p", activeLevelId: "ground", defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, selection: [], elements: [
    { id: "ground", kind: "level", properties: { elevationMm: 0 } },
    ...draft.points.map((p, i) => ({ id: `wall${i}`, kind: "wall" as const, levelId: "ground", properties: { startXmm: p.xMm, startYmm: p.yMm, endXmm: draft.points[(i + 1) % 4].xMm, endYmm: draft.points[(i + 1) % 4].yMm } })),
  ] });
  expect(sketches).toHaveLength(1);
  expect(sketches[0].points.length).toBeGreaterThanOrEqual(3);
});

it("includes the compact home's chosen roof, garden and carport in 3D", () => {
  const p = { ...suggestHomes({ areaM2: 180 })[0].parameters, roofStyle: "german-gable" as const, garage: "open" as const, gardenAreaM2: 10 };
  const context = { projectId: "p", activeLevelId: "ground", defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, selection: [], elements: [{ id: "ground", kind: "level" as const, properties: { elevationMm: 0, heightMm: 3000 } }] };
  const result = defaultModelingPlan({ command: "Build", residential: p, context, mode: "build", attachments: [], history: [] });
  expect(result?.plan.actions.some(a => a.kind === "roof" && a.roofPreset === "gable")).toBe(true);
  expect(result?.plan.actions.some(a => a.kind === "equipment" && a.familyId === "extras-lawn")).toBe(true);
  expect(result?.plan.actions.some(a => a.kind === "equipment" && a.familyId === "extras-car-sedan")).toBe(true);
});
