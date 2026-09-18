import type { AiContext, AiAction } from "../schema";
import { polygonArea, offsetPolygon, insidePolygon, inscribedRectangle } from "./footprint";
import { clipSketchLines, ensureSketchBoundary, sketchRooms } from "./sketch";
import type { FloorSketch } from "./allocation";

/** Bring actual project wall geometry into the same line editor as generated homes. */
export function projectHomeSketches(context: AiContext): FloorSketch[] {
  const levels = [...new Set(context.elements.filter(e => e.kind === "wall").map(e => e.levelId))];
  const allWalls = context.elements.filter(e => e.kind === "wall");
  if (!allWalls.length) return [];
  const originX = Math.min(...allWalls.map(w => Number(w.properties.startXmm)), ...allWalls.map(w => Number(w.properties.endXmm)));
  const originY = Math.min(...allWalls.map(w => Number(w.properties.startYmm)), ...allWalls.map(w => Number(w.properties.endYmm)));
  const point = (x: unknown, y: unknown) => ({ xMm: Number(x) - originX, yMm: Number(y) - originY });
  return levels.sort((a, b) => Number(context.elements.find(e => e.id === a)?.properties.elevationMm ?? 0) - Number(context.elements.find(e => e.id === b)?.properties.elevationMm ?? 0)).map(levelId => {
    const walls = allWalls.filter(e => e.levelId === levelId);
    const slabs = context.elements.filter(e => e.kind === "floor" && e.levelId === levelId && Array.isArray(e.properties.boundary));
    const boundaries = slabs.map(e => (e.properties.boundary as Array<{ xMm: number; yMm: number }>)).sort((a, b) => polygonArea(b) - polygonArea(a));
    const exterior = walls.filter(w => w.properties.wallType === "exterior");
    const remaining = exterior.map(w => ({ start: point(w.properties.startXmm, w.properties.startYmm), end: point(w.properties.endXmm, w.properties.endYmm) }));
    const loop = remaining.length ? [remaining.shift()!] : [];
    while (remaining.length && loop.length) {
      const end = loop[loop.length - 1].end;
      const next = remaining.findIndex(l => Math.hypot(l.start.xMm - end.xMm, l.start.yMm - end.yMm) < 1 || Math.hypot(l.end.xMm - end.xMm, l.end.yMm - end.yMm) < 1);
      if (next < 0) break;
      const [l] = remaining.splice(next, 1);
      loop.push(Math.hypot(l.start.xMm - end.xMm, l.start.yMm - end.yMm) < 1 ? l : { start: l.end, end: l.start });
    }
    const closed = loop.length >= 3 && Math.hypot(loop[0].start.xMm - loop[loop.length - 1].end.xMm, loop[0].start.yMm - loop[loop.length - 1].end.yMm) < 1;
    let outline = closed ? loop.map(l => l.start) : boundaries[0] ? offsetPolygon(boundaries[0], -context.defaults.wallThicknessMm / 2).map(p => point(p.xMm, p.yMm)) : [];
    if (outline.some(p => p.xMm < -1 || p.yMm < -1) || !closed && boundaries.length > 1) outline = [];
    const sketch = ensureSketchBoundary({ points: outline, lines: walls.map(w => ({ start: point(w.properties.startXmm, w.properties.startYmm), end: point(w.properties.endXmm, w.properties.endYmm) })) });
    const clipped = clipSketchLines(sketch);
    const equipment = context.elements.filter(e => e.kind === "equipment" && e.levelId === levelId);
    clipped.labels = sketchRooms(clipped).map((room, i) => {
      const families = equipment.filter(e => insidePolygon(point(e.properties.xMm, e.properties.yMm), room)).map(e => String(e.properties.familyId));
      const rect = inscribedRectangle(room);
      const use = families.some(f => /^bath-|^mep-toilet/.test(f)) ? "bathroom" : families.some(f => /^bed-/.test(f)) ? "bedroom" : families.some(f => /^kitchen-/.test(f)) ? "kitchen" : families.some(f => /^sofa/.test(f)) ? "living" : Math.min(rect.widthMm, rect.depthMm) <= 1600 ? "corridor" : "living";
      return { point: { xMm: rect.xMm + rect.widthMm / 2, yMm: rect.yMm + rect.depthMm / 2 }, use, name: use === "bedroom" ? `Bedroom ${i + 1}` : use === "bathroom" ? "Bathroom" : use === "corridor" ? "Hall" : use === "kitchen" ? "Kitchen" : "Living" };
    });
    return clipped;
  }).slice(0, 8);
}

export function homeReplacementActions(context: AiContext): AiAction[] {
  const visited = new Set<string>();
  const actions: AiAction[] = [];
  const visit = (e: AiContext["elements"][number]) => {
    if (visited.has(e.id) || e.kind === "level") return;
    visited.add(e.id);
    for (const dependent of context.elements) if (dependent.wallId === e.id || dependent.properties.kitchenWallId === e.id || dependent.properties.connectedHostId === e.id) visit(dependent);
    actions.push({ kind: "delete", id: e.id, targetKind: e.kind });
  };
  context.elements.forEach(visit);
  return actions;
}
