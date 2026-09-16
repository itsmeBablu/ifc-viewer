import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const state = vi.hoisted(() => ({
  mepModeActive: false, armedLayoutTool: "component", draftComponentId: "mep-air_terminal",
  chooseComponent: vi.fn(), levels: [], draftComponentWidthMm: 600, draftComponentDepthMm: 600,
  draftComponentHeightMm: 120, draftEquipmentElevationMm: 0, draftEquipmentRotationDeg: 0,
}));
vi.mock("@/store/useLayoutDrawingStore", () => ({ useLayoutDrawingStore: () => state }));
vi.mock("@/store/useToolMarkupStore", () => ({ useToolMarkupStore: () => ({ viewPreset: "free", quadView: false }) }));
import ComponentProperties from "./ComponentProperties";

beforeEach(() => state.chooseComponent.mockClear());
describe("component properties render", () => {
  it.each([
    { mepModeActive: false, armedLayoutTool: "component", draftComponentId: "mep-air_terminal" },
    { mepModeActive: true, armedLayoutTool: "equipment", draftComponentId: "sofa-3" },
  ])("does not update the store while rendering an incompatible draft $draftComponentId", patch => {
    Object.assign(state, patch);
    expect(renderToString(createElement(ComponentProperties))).toContain("Component base level");
    expect(state.chooseComponent).not.toHaveBeenCalled();
  });
});
