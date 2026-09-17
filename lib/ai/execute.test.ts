import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { clearWerkzeugHistory, undoWerkzeug, redoWerkzeug } from "@/lib/werkzeugHistory";
import { idbApplyAiChanges, idbListWalls } from "@/lib/layoutDrawingDb";
import { aiFingerprint, applyAiPlan, prepareAiChanges } from "./execute";
import { expandModelPlan } from "./recipes";
import { sketchActions } from "./modeling/sketch";
import type { AiPlan } from "./schema";

const plan: AiPlan = { summary: "Wall and door", assumptions: [], actions: [
  { kind: "wall", operation: "create", id: "w", levelId: "l", startXmm: 0, startYmm: 0, endXmm: 5000, endYmm: 0, thicknessMm: 200, heightMm: 3000 },
  { kind: "door", operation: "create", id: "d", wallId: "w", positionMm: 1000, widthMm: 900, heightMm: 2100, hinge: "start", swing: 1, style: "wood" },
] };
beforeEach(() => {
  useLayoutDrawingStore.setState({ projectId: `test-${crypto.randomUUID()}`, levels: [{ id: "l", projectId: "p", name: "Ground", elevationMm: 0, heightMm: 3000, createdAt: 0 }], walls: [], doors: [], windows: [], slabs: [], columns: [], beams: [], mepEquipment: [], groups: [], lockedElementKeys: [], selectedElements: [] });
  useToolMarkupStore.setState({ modelKey: null, markupFloorId: "l" });
  clearWerkzeugHistory();
});
describe("AI batch persistence", () => {
  it("applies custom floor drawings and undoes their furniture and stair geometry together",async()=>{
    const points=[{xMm:0,yMm:0},{xMm:14000,yMm:0},{xMm:14000,yMm:14000},{xMm:0,yMm:14000}];
    const actions=sketchActions({variant:"duplex",bedrooms:5,sketches:[{points,lines:[]},{points,lines:[]},{points,lines:[]}],garage:"none",gardenAreaM2:0},"sketch","l",0,3000,200);
    await applyAiPlan({summary:"Drawn home",assumptions:[],actions},aiFingerprint(),true);
    expect(useLayoutDrawingStore.getState().levels).toHaveLength(3);
    expect(useLayoutDrawingStore.getState().mepEquipment.filter(e=>e.familyId?.startsWith("bed-"))).toHaveLength(5);
    await undoWerkzeug();expect(useLayoutDrawingStore.getState().levels).toHaveLength(1);expect(useLayoutDrawingStore.getState().mepEquipment).toHaveLength(0);expect(useLayoutDrawingStore.getState().slabs).toHaveLength(0);
  });
  it("applies a duplex with hosted openings and stair slabs and undoes both floors together", async () => {
    const duplex = expandModelPlan({ summary: "Five-bedroom duplex", assumptions: [], actions: [{ kind: "house_layout", id: "home", levelId: "l", variant: "duplex", bedrooms: 5 }] });
    await applyAiPlan(duplex, aiFingerprint(), true);
    const state = useLayoutDrawingStore.getState();
    expect(state.levels).toHaveLength(2);
    const levelIds = new Set(state.levels.map(l => l.id));
    expect(state.walls.every(w => levelIds.has(w.levelId))).toBe(true);
    expect(state.doors.every(d => state.walls.some(w => w.id === d.wallId))).toBe(true);
    expect(state.slabs.length).toBeGreaterThan(20);
    expect(state.mepEquipment.filter(e=>e.familyId?.startsWith("bed-"))).toHaveLength(5);
    expect(state.mepEquipment.find(e=>e.familyId==="extras-car-sedan")?.color).toBe("#2563eb");
    const lawn=state.mepEquipment.find(e=>e.familyId==="extras-lawn")!;
    expect(lawn.widthMm!*lawn.depthMm!/1e6).toBeCloseTo(40);
    await undoWerkzeug();
    expect(useLayoutDrawingStore.getState().levels).toHaveLength(1);
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(0);
    expect(useLayoutDrawingStore.getState().slabs).toHaveLength(0);
    expect(useLayoutDrawingStore.getState().mepEquipment).toHaveLength(0);
  });
  it("reveals a committed live batch and undoes it as one operation", async () => {
    await applyAiPlan(plan, aiFingerprint(), true);
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(1);
    expect(useLayoutDrawingStore.getState().doors).toHaveLength(1);
    await undoWerkzeug();
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(0);
    expect(useLayoutDrawingStore.getState().doors).toHaveLength(0);
  });
  it("preserves MEP elevation, fresh-air mapping and drainage slope", () => {
    const expanded = expandModelPlan({ summary: "Services", assumptions: [], actions: [
      { kind: "duct_run", id: "air", levelId: "l", points: [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }], shape: "round", diameterMm: 250, elevationOffsetMm: 2800, systemType: "fresh_air" },
      { kind: "pipe_run", id: "waste", levelId: "l", points: [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }], diameterMm: 108, elevationOffsetMm: 200, systemType: "sanitary_waste", slopePercent: 1 },
    ] });
    const prepared = prepareAiChanges(expanded, useLayoutDrawingStore.getState());
    expect(prepared.next.ducts.at(-1)).toMatchObject({ elevationMm: 2800, systemType: "outdoor" });
    expect(prepared.next.pipes.at(-1)).toMatchObject({ elevationMm: 200, slopePercent: 1 });
  });
  it("copies only changed collections and never mutates the original state", () => {
    const state = useLayoutDrawingStore.getState();
    const prepared = prepareAiChanges(plan, state);
    expect(prepared.next.walls).not.toBe(state.walls);
    expect(prepared.next.doors).not.toBe(state.doors);
    expect(prepared.next.levels).toBe(state.levels);
    expect(prepared.next.slabs).toBe(state.slabs);
    expect(prepared.next.mepEquipment).toBe(state.mepEquipment);
    expect(state.walls).toHaveLength(0);
    expect(state.doors).toHaveLength(0);
  });
  it("applies a recipe as one atomic model update and one undo step", async () => {
    const recipe = expandModelPlan({ summary: "Shell", assumptions: [], actions: [{ kind: "rectangular_shell", id: "shell", levelId: "l", xMm: 0, yMm: 0, widthMm: 8000, depthMm: 6000, heightMm: 3000, thicknessMm: 200, floorThicknessMm: 200 }] });
    const originalLevels = useLayoutDrawingStore.getState().levels;
    let updates = 0;
    const unsubscribe = useLayoutDrawingStore.subscribe(() => updates++);
    try { await applyAiPlan(recipe, aiFingerprint()); } finally { unsubscribe(); }
    expect(updates).toBe(1);
    expect(useLayoutDrawingStore.getState().levels).toBe(originalLevels);
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(4);
    expect(useLayoutDrawingStore.getState().slabs).toHaveLength(1);
    await undoWerkzeug();
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(0);
    expect(useLayoutDrawingStore.getState().slabs).toHaveLength(0);
  });
  it("applies a 100-item grid with unique IDs and preserves the untouched model", async () => {
    const recipe = expandModelPlan({ summary: "Chairs", assumptions: [], actions: [{ kind: "equipment_grid", id: "chairs", levelId: "l", familyId: "dining-chair", xMm: 0, yMm: 0, elevationMm: 0, rotationDeg: 0, columns: 10, rows: 10, stepXmm: 1000, stepYmm: 1500 }] });
    const original = useLayoutDrawingStore.getState();
    await applyAiPlan(recipe, aiFingerprint());
    const built = useLayoutDrawingStore.getState();
    expect(built.mepEquipment).toHaveLength(100);
    expect(new Set(built.mepEquipment.map(item => item.id)).size).toBe(100);
    expect(built.mepEquipment[99]).toMatchObject({ xMm: 9000, yMm: 13500 });
    expect(built.walls).toBe(original.walls);
    expect(built.slabs).toBe(original.slabs);
    expect(original.mepEquipment).toHaveLength(0);
    await undoWerkzeug();
    expect(useLayoutDrawingStore.getState().mepEquipment).toHaveLength(0);
    await redoWerkzeug();
    expect(useLayoutDrawingStore.getState().mepEquipment).toHaveLength(100);
  });
  it("does not mutate earlier wall snapshots when updating or deleting", async () => {
    await applyAiPlan(plan, aiFingerprint());
    const before = useLayoutDrawingStore.getState();
    const wall = before.walls[0];
    const door = before.doors[0];
    await applyAiPlan({ summary: "Extend wall", assumptions: [], actions: [{ ...plan.actions[0], id: wall.id, operation: "update", endXmm: 6000 } as AiPlan["actions"][number]] }, aiFingerprint());
    expect(before.walls[0].endXmm).toBe(5000);
    const extended = useLayoutDrawingStore.getState();
    await applyAiPlan({ summary: "Remove door", assumptions: [], actions: [{ kind: "delete", id: door.id, targetKind: "door" }] }, aiFingerprint());
    expect(extended.doors).toHaveLength(1);
    expect(useLayoutDrawingStore.getState().doors).toHaveLength(0);
    expect(useLayoutDrawingStore.getState().walls).toBe(extended.walls);
  });
  it("applies related elements atomically and undoes/redoes as one operation", async () => {
    await applyAiPlan(plan, aiFingerprint());
    const s = useLayoutDrawingStore.getState();
    expect(s.walls).toHaveLength(1); expect(s.doors[0].wallId).toBe(s.walls[0].id);
    expect(s.walls[0].id).not.toBe("w");
    expect(await idbListWalls(s.projectId!)).toHaveLength(1);
    expect(await undoWerkzeug()).toBe(true);
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(0);
    expect(await idbListWalls(s.projectId!)).toHaveLength(0);
    expect(await redoWerkzeug()).toBe(true);
    expect(useLayoutDrawingStore.getState().doors).toHaveLength(1);
  });
  it("leaves state unchanged on malformed or stale batches", async () => {
    const fingerprint = aiFingerprint();
    useLayoutDrawingStore.setState({ selectedElements: [{ kind: "wall", id: "different" }] });
    await expect(applyAiPlan(plan, fingerprint)).rejects.toThrow(/changed/);
    await expect(applyAiPlan({ ...plan, actions: [plan.actions[1]] }, aiFingerprint())).rejects.toThrow(/Host/);
    expect(useLayoutDrawingStore.getState().walls).toHaveLength(0);
  });
  it("rolls back all IndexedDB writes when one operation fails", async () => {
    const projectId = useLayoutDrawingStore.getState().projectId!;
    await expect(idbApplyAiChanges([
      { store: "walls", id: "valid", value: { id: "valid", projectId } },
      { store: "doors", id: "bad", value: { projectId } as { id: string; projectId: string } },
    ], () => () => {})).rejects.toBeDefined();
    expect(await idbListWalls(projectId)).toHaveLength(0);
  });
});
