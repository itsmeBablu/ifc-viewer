import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { clearWerkzeugHistory, undoWerkzeug, redoWerkzeug } from "@/lib/werkzeugHistory";
import { idbApplyAiChanges, idbListWalls } from "@/lib/layoutDrawingDb";
import { aiFingerprint, applyAiPlan } from "./execute";
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
