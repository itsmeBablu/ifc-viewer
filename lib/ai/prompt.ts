import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import type { CommandRequest } from "./protocol";

const MAX_HISTORY_CHARS = 12_000;

/** Keep complete recent turns; never cut a dimension or instruction in half. */
export function promptHistory(history: CommandRequest["history"]) {
  let size = 0;
  const recent: CommandRequest["history"] = [];
  for (const turn of history.slice(-12).reverse()) {
    if (size + turn.text.length > MAX_HISTORY_CHARS) break;
    recent.unshift(turn);
    size += turn.text.length;
  }
  return recent;
}

// Column names appear once instead of being repeated for every catalogue row.
export const compactCatalog = {
  columns: ["id", "name", "room", "category", "widthMm", "depthMm", "heightMm", "elevationMm"],
  rows: COMPONENT_CATALOG.map(p => [p.id, p.name, p.room, p.category, p.widthMm, p.depthMm, p.heightMm, p.elevationMm]),
};

export function catalogPrompt(items: typeof COMPONENT_CATALOG) {
  return { columns: compactCatalog.columns, rows: items.map(p => [p.id, p.name, p.room, p.category, p.widthMm, p.depthMm, p.heightMm, p.elevationMm]) };
}

export function promptContext(context: CommandRequest["context"]) {
  return {
    ...context,
    elements: context.elements.map(element => ({
      ...element,
      properties: Object.fromEntries(Object.entries(element.properties).filter(([key, value]) => {
        // Remove only redundant identity fields and persistence timestamps.
        if (key === "projectId") return value !== context.projectId;
        if (key === "id" || key === "levelId" || key === "wallId") return value !== element[key];
        return key !== "createdAt" && key !== "updatedAt";
      })),
    })),
  };
}
