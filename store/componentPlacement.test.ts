import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/layoutDrawingDb");
vi.mock("@/lib/werkzeugHistory", () => ({ pushWerkzeugHistory: vi.fn() }));
import { useLayoutDrawingStore } from "./useLayoutDrawingStore";

const initial = useLayoutDrawingStore.getState();
beforeEach(() => useLayoutDrawingStore.setState({ ...initial, projectId: "p" }, true));

describe("continuous component placement", () => {
  it.each(["component", "equipment"] as const)("keeps %s choices separate from placed instances", async tool => {
    useLayoutDrawingStore.setState({ armedLayoutTool: tool });
    const placed = await useLayoutDrawingStore.getState().placeEquipment({ levelId: "l", familyId: "sofa-2", category: "furniture", rotationDeg: 0, xMm: 0, yMm: 0, widthMm: 1800, depthMm: 850, heightMm: 800 });
    const snapshot = structuredClone(placed);
    useLayoutDrawingStore.getState().chooseComponent("armchair");
    const state = useLayoutDrawingStore.getState();
    expect(state.mepEquipment[0]).toEqual(snapshot);
    expect(state.selectedEquipmentId).toBeNull();
    expect(state.selectedElements).toEqual([]);
    expect(state.draftComponentId).toBe("armchair");
    expect(state.armedLayoutTool).toBe(tool);
  });
  it("still selects items placed outside continuous placement", async () => {
    const item = await useLayoutDrawingStore.getState().placeEquipment({ levelId: "l", familyId: "sofa-2", category: "furniture", rotationDeg: 0, xMm: 0, yMm: 0 });
    expect(useLayoutDrawingStore.getState().selectedEquipmentId).toBe(item?.id);
  });
});
