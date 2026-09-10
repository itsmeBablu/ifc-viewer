import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/layoutDrawingDb");
vi.mock("@/lib/werkzeugHistory", () => ({ pushWerkzeugHistory: vi.fn() }));
import { idbPutDoor, idbPutWindow } from "@/lib/layoutDrawingDb";
import { useLayoutDrawingStore } from "./useLayoutDrawingStore";

const initial = useLayoutDrawingStore.getState();
beforeEach(() => {
  vi.clearAllMocks();
  useLayoutDrawingStore.setState({ ...initial, projectId: "p" }, true);
});

describe("opening placement orientation", () => {
  it.each(["door", "window"] as const)("persists the %s preview orientation and supports flipping the placed instance", async kind => {
    useLayoutDrawingStore.setState({ armedLayoutTool: kind });
    const store = useLayoutDrawingStore.getState();
    store.setDraftOpeningOrientation(kind, { hinge: "end", swing: -1, openingAngleDeg: 45 });
    const item = kind === "door" ? await store.placeDoorOnWall("wall", 2000) : await store.placeWindowOnWall("wall", 2000);
    expect(item).toMatchObject({ hinge: "end", swing: -1, openingAngleDeg: 45 });
    expect(kind === "door" ? idbPutDoor : idbPutWindow).toHaveBeenCalledWith(expect.objectContaining({ hinge: "end", swing: -1, openingAngleDeg: 45 }));
    useLayoutDrawingStore.setState({ armedLayoutTool: null });
    if (kind === "door") store.selectDoor(item!.id); else store.selectWindow(item!.id);
    store.cycleOpeningOrientation();
    await vi.waitFor(() => {
      const state = useLayoutDrawingStore.getState();
      const updated = (kind === "door" ? state.doors : state.windows).find(row => row.id === item!.id);
      expect(updated).toMatchObject({ hinge: "start", swing: 1, openingAngleDeg: 45 });
    });
  });
});
