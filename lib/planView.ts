import type { LayoutLevel } from "./layoutDrawing";

export function planViewSettings(level: LayoutLevel): NonNullable<LayoutLevel["planView"]> {
  return level.planView ?? {
    topMm: level.heightMm,
    cutMm: Math.min(1200, level.heightMm),
    bottomMm: 0,
    hiddenCategories: [],
    hiddenUnderlayIds: [],
  };
}

/** The same owner tags used for raycasting; no separate category registry. */
export function objectCategory(data: Record<string, unknown>): string | null {
  if (typeof data.ifcTypeName === "string") return data.ifcTypeName;
  const tags: Record<string, string> = {
    layoutWallId: "Walls", layoutDoorId: "Doors", layoutWindowId: "Windows",
    layoutSlabId: "Floors / Roofs", layoutColumnId: "Columns", layoutBeamId: "Beams",
    layoutStairId: "Stairs", layoutRampId: "Ramps", layoutDuctId: "Ducts",
    layoutPipeId: "Pipes", layoutCableTrayId: "Cable trays", layoutEquipmentId: "Equipment / Furniture",
    layoutWireId: "Wires", layoutSketchLineId: "Lines", markupId: "Markup",
  };
  for (const [tag, category] of Object.entries(tags)) if (data[tag]) return category;
  return null;
}
