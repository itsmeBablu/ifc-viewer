import { describe, expect, it } from "vitest";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import { compactCatalog, promptContext, promptHistory } from "./prompt";
import type { AiContext } from "./schema";

describe("compact AI prompts", () => {
  it("preserves the entire catalogue while removing repeated field names", () => {
    const restored = compactCatalog.rows.map(row => Object.fromEntries(compactCatalog.columns.map((key, i) => [key, row[i]])));
    expect(restored).toEqual(COMPONENT_CATALOG);
    expect(JSON.stringify(compactCatalog).length).toBeLessThan(JSON.stringify(COMPONENT_CATALOG).length * 0.7);
  });

  it("preserves geometry and relations without mutating the validation context", () => {
    const properties = { id: "wall", projectId: "project", levelId: "level", startXmm: 125.5, heightMm: 3000, constraints: { targetId: "other" }, createdAt: 1 };
    const context: AiContext = { projectId: "project", activeLevelId: "level", selection: [{ kind: "wall", id: "wall" }], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [{ id: "wall", kind: "wall", levelId: "level", properties }] };
    const compact = promptContext(context);
    expect(compact.elements[0]).toEqual({ id: "wall", kind: "wall", levelId: "level", properties: { startXmm: 125.5, heightMm: 3000, constraints: { targetId: "other" } } });
    expect(context.elements[0].properties).toEqual(properties);
    expect(compact.selection).toEqual(context.selection);
  });

  it("keeps whole recent turns within the character budget", () => {
    const history = [
      { role: "user" as const, text: "old ".repeat(2000) },
      { role: "assistant" as const, text: "question ".repeat(500) },
      { role: "user" as const, text: "Use a 6200 mm wall." },
    ];
    expect(promptHistory(history)).toEqual(history.slice(1));
    expect(promptHistory(history.slice(1))).toEqual(history.slice(1));
  });
});
