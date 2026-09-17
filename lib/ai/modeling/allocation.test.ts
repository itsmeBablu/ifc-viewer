import { expect, it } from "vitest";
import { allocateResidential, residentialCommand, type ResidentialParameters } from "./allocation";
import { defaultResidentialBrief } from "./brief";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";

const context = { projectId: "p", activeLevelId: "l", selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [{ kind: "level" as const, id: "l", properties: {} }] };
it("parses and expands a multi-storey block with repeated 2-bedroom homes",()=>{
  expect(defaultResidentialBrief("4 floors with 6 apartments per floor and 2 bedroom apartments")).toMatchObject({apartmentFloors:4,apartmentsPerFloor:6,bedroomsPerApartment:2});
  const plan=expandModelPlan({summary:"Block",assumptions:[],actions:[{kind:"apartment_block",id:"block",levelId:"l",floors:4,unitsPerFloor:6,bedroomsPerUnit:2,totalAreaM2:3000}]});
  expect(plan.actions.filter(a=>a.kind==="level")).toHaveLength(3);expect(plan.actions.filter(a=>a.kind==="equipment"&&a.familyId==="extras-lift")).toHaveLength(4);expect(plan.actions.filter(a=>a.kind==="wall").length).toBeGreaterThan(20);
});
it.each(["apartment", "villa", "duplex"] as const)("accounts for every square metre of a %s and generates the matching footprint", variant => {
  const parameters = { variant, bedrooms: variant === "duplex" ? 5 : 2, bedroomAreaM2: 22 };
  const allocation = allocateResidential(parameters);
  const sum = allocation.bedroomTotalM2 + allocation.studyAreaM2 + allocation.livingKitchenTotalM2 + allocation.bathroomTotalM2 + allocation.circulationAreaM2 + allocation.stairAreaM2 + allocation.partitionAreaM2;
  expect(sum).toBeCloseTo(allocation.totalAreaM2, 6);
  expect(allocation.partitionAreaM2).toBeGreaterThan(0);
  expect(allocation.familyDiningAreaM2).toBeGreaterThanOrEqual(-1e-8);
  const plan = validatePlan(expandModelPlan({ summary: "Home", assumptions: [], actions: [{ ...(variant === "apartment" ? {} : { variant }), bedrooms: parameters.bedrooms, bedroomAreaM2: parameters.bedroomAreaM2, kind: variant === "apartment" ? "apartment_layout" : "house_layout", id: "h", levelId: "l", totalAreaM2: allocation.totalAreaM2 }] }), context);
  const walls = plan.actions.filter(a => a.kind === "wall").slice(0, 4);
  if (walls[0].kind !== "wall" || walls[1].kind !== "wall") throw new Error("Missing perimeter");
  const clearWidth = walls[0].endXmm - walls[0].startXmm - 200;
  const clearDepth = walls[1].endYmm - walls[1].startYmm - 200;
  expect(clearWidth * clearDepth * allocation.floors / 1e6).toBeCloseTo(allocation.totalAreaM2, 6);
});
it("holds total area fixed as bedrooms grow and adjusts the shared spaces", () => {
  const small = allocateResidential({ variant: "apartment", bedrooms: 2, totalAreaM2: 110, bedroomAreaM2: 16 });
  const large = allocateResidential({ variant: "apartment", bedrooms: 2, totalAreaM2: 110, bedroomAreaM2: 24 });
  expect(small.totalAreaM2).toBe(110); expect(large.totalAreaM2).toBe(110);
  expect(large.bedroomTotalM2).toBe(48);
  expect(large.livingKitchenTotalM2).toBeLessThan(small.livingKitchenTotalM2);
});
it("preserves explicit living, kitchen and bathroom areas", () => {
  const parameters: ResidentialParameters = { variant: "apartment", bedrooms: 2, bedroomAreaM2: 20, totalAreaM2: 120, livingAreaM2: 30, kitchenAreaM2: 12, bathroomAreaM2: 6 };
  const budget = allocateResidential(parameters);
  expect(budget.livingTotalM2).toBe(30); expect(budget.kitchenTotalM2).toBe(12); expect(budget.bathroomTotalM2).toBe(6);
  expect(defaultResidentialBrief(residentialCommand(parameters))).toEqual(parameters);
});
it("round-trips creative layout styles into distinct footprints", () => {
  expect(defaultResidentialBrief(residentialCommand({ variant: "apartment", bedrooms: 2, layoutStyle: "courtyard" }))).toMatchObject({ layoutStyle: "courtyard", footprint: "u" });
  expect(defaultResidentialBrief(residentialCommand({ variant: "apartment", bedrooms: 3, layoutStyle: "corner" }))).toMatchObject({ layoutStyle: "corner", footprint: "l" });
});
it("parses Vastu planning and German roof presets", () => {
  expect(defaultResidentialBrief("3 bedroom Vastu apartment")).toMatchObject({ cultureStyle: "vastu", bedrooms: 3 });
  expect(defaultResidentialBrief("German mansard villa")).toMatchObject({ cultureStyle: "german", roofStyle: "mansard" });
});
it("refresh seeds produce distinct editable bedroom subdivisions", () => {
  const a = expandModelPlan({ summary: "A", assumptions: [], actions: [{ kind: "apartment_layout", id: "a", levelId: "l", bedrooms: 3, layoutSeed: 11 }] }).actions;
  const b = expandModelPlan({ summary: "B", assumptions: [], actions: [{ kind: "apartment_layout", id: "b", levelId: "l", bedrooms: 3, layoutSeed: 982 }] }).actions;
  const wallsA = a.filter(x => x.kind === "wall").map(x => x.kind === "wall" ? `${x.startXmm}:${x.endXmm}` : "").join(",");
  const wallsB = b.filter(x => x.kind === "wall").map(x => x.kind === "wall" ? `${x.startXmm}:${x.endXmm}` : "").join(",");
  expect(wallsA).not.toBe(wallsB);
});
it("supports mixed bedroom counts per apartment floor", () => {
  const plan = expandModelPlan({ summary: "Mixed block", assumptions: [], actions: [{ kind: "apartment_block", id: "mix", levelId: "l", floors: 2, unitsPerFloor: 3, bedroomsPerUnit: 2, bedroomDistribution: [1, 2, 3] }] });
  expect(plan.actions.filter(a => a.kind === "equipment" && a.familyId === "extras-lift")).toHaveLength(2);
  expect(plan.actions.filter(a => a.kind === "wall").length).toBeGreaterThan(20);
});
it.each([
  ["create a 2 bedroom apartment with total area 110 m2 and bedrooms 24 m2 each", { variant: "apartment", bedrooms: 2, totalAreaM2: 110, bedroomAreaM2: 24 }],
  ["create a villa with living room 40 square meters and kitchen 15 sqm", { variant: "villa", bedrooms: 3, livingAreaM2: 40, kitchenAreaM2: 15 }],
  ["a three bedroom apartment 120 m²", { variant: "apartment", bedrooms: 3, totalAreaM2: 120 }],
] as const)("normalizes area constraints: %s", (command, expected) => expect(defaultResidentialBrief(command)).toEqual(expected));
it("rejects impossible or contradictory requests without shrinking rooms", () => {
  expect(() => allocateResidential({ variant: "apartment", bedrooms: 2, totalAreaM2: 50, bedroomAreaM2: 25 })).toThrow(/cannot fit/);
  expect(defaultResidentialBrief("a villa with living room 30 m2 and living room 50 m2")).toBeNull();
});
