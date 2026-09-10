import { isArchitecturalComponent } from "./componentCatalog";
import type { LayoutMepEquipment, SelectedElementRef } from "./layoutDrawing";

export function isMepSelectionLocked(state: {
  mepModeActive: boolean;
  mepArchitectureLocked: boolean;
  mepEquipment: LayoutMepEquipment[];
}, ref: SelectedElementRef): boolean {
  if (!state.mepModeActive) return false;
  if (ref.kind === "equipment") {
    const item = state.mepEquipment.find((item) => item.id === ref.id);
    return Boolean(item && (item.category === "furniture" || isArchitecturalComponent(item.familyId)));
  }
  return state.mepArchitectureLocked && ["wall", "door", "window", "slab", "column", "beam", "stair", "ramp"].includes(ref.kind);
}
