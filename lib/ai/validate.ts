import { z } from "zod";
import { contextSchema, planSchema, wallFields, type AiAction, type AiContext } from "./schema";

type Point = { xMm: number; yMm: number };
function cross(a: Point, b: Point, c: Point) { return (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm); }
export function validateBoundary(points: Point[]) {
  if (new Set(points.map(p => `${p.xMm},${p.yMm}`)).size !== points.length) throw new Error("Boundary points must be distinct; do not repeat the closing point.");
  const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.xMm * q.yMm - q.xMm * p.yMm; }, 0);
  if (Math.abs(area) < 20_000) throw new Error("The floor or roof boundary has no usable area.");
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm) < 10) throw new Error("Boundary edges must be at least 10 mm.");
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      if (Math.max(a.xMm, b.xMm) < Math.min(c.xMm, d.xMm) || Math.max(c.xMm, d.xMm) < Math.min(a.xMm, b.xMm) || Math.max(a.yMm, b.yMm) < Math.min(c.yMm, d.yMm) || Math.max(c.yMm, d.yMm) < Math.min(a.yMm, b.yMm)) continue;
      if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) throw new Error("The floor or roof boundary intersects itself.");
    }
  }
}

export function describeAction(action: AiAction) {
  if (action.kind === "delete") return `Delete ${action.targetKind} ${action.id}`;
  const verb = action.operation === "create" ? "Create" : "Update";
  if (action.kind === "wall" || action.kind === "beam") return `${verb} ${action.kind} ${action.id}: (${action.startXmm}, ${action.startYmm}) → (${action.endXmm}, ${action.endYmm}) mm, level ${action.levelId}`;
  if (action.kind === "door" || action.kind === "window") return `${verb} ${action.kind} ${action.id}: ${action.widthMm} × ${action.heightMm} mm on wall ${action.wallId}, centre ${action.positionMm} mm`;
  if (action.kind === "level") return `${verb} level ${action.name}: elevation ${action.elevationMm} mm, height ${action.heightMm} mm`;
  if (action.kind === "floor" || action.kind === "roof") return `${verb} ${action.kind} ${action.id}: ${action.boundary.length} boundary points on ${action.levelId}, offset ${action.elevationOffsetMm} mm${action.kind === "roof" ? `, ${action.roofPreset} ${action.pitchDeg}°` : ""}`;
  return `${verb} ${action.kind === "equipment" ? action.familyId : "column"} ${action.id}: (${action.xMm}, ${action.yMm}) mm, level ${action.levelId}`;
}

/** Pure dry run. Both server and browser call this before anything may be persisted. */
export function validatePlan(value: unknown, rawContext: AiContext) {
  const plan = planSchema.parse(value);
  const context = contextSchema.parse(rawContext);
  const elements = new Map(context.elements.map(e => [e.id, e]));
  if (elements.size !== context.elements.length) throw new Error("Project context contains duplicate IDs.");
  if (context.activeLevelId && elements.get(context.activeLevelId)?.kind !== "level") throw new Error("The active level no longer exists.");
  const changed = new Set<string>();
  for (const action of plan.actions) {
    if (changed.has(action.id)) throw new Error(`Use one action per element: ${action.id}.`);
    changed.add(action.id);
    const existing = elements.get(action.id);
    if (action.kind === "delete") {
      if (!existing || existing.kind !== action.targetKind) throw new Error(`Cannot delete missing ${action.targetKind} ${action.id}.`);
      if ([...elements.values()].some(e => e.wallId === action.id || e.levelId === action.id || e.properties.kitchenWallId === action.id || e.properties.connectedHostId === action.id)) throw new Error(`Delete dependent elements before ${action.id}.`);
      elements.delete(action.id);
      continue;
    }
    if (action.operation === "create" ? !!existing : !existing || existing.kind !== action.kind) throw new Error(`Invalid ${action.operation} reference: ${action.id}.`);
    if (existing && (existing.properties.curved || existing.properties.topLevelId || existing.properties.attachedTopRoofId || existing.properties.attachedBaseRoofId || existing.properties.roofJoin || existing.properties.kitchenWallId || existing.properties.connectedHostId || existing.properties.wallTypeId || (Array.isArray(existing.properties.holes) && existing.properties.holes.length) || (Array.isArray(existing.properties.connectors) && existing.properties.connectors.length) || existing.properties.furnitureParameters)) throw new Error(`Element ${action.id} has geometry constraints. Edit it manually first.`);
    if ("levelId" in action && elements.get(action.levelId)?.kind !== "level") throw new Error(`Level ${action.levelId} does not exist. Create it before its elements.`);
    if ("wallId" in action && elements.get(action.wallId)?.kind !== "wall") throw new Error(`Host wall ${action.wallId} does not exist. Create it before its openings.`);
    if (action.kind === "wall" || action.kind === "beam") {
      if (Math.hypot(action.endXmm - action.startXmm, action.endYmm - action.startYmm) < 10) throw new Error(`${action.kind} ${action.id} must be at least 10 mm long.`);
    }
    if (action.kind === "floor" || action.kind === "roof") {
      validateBoundary(action.boundary);
      if (action.kind === "floor" && (action.roofPreset !== "flat" || action.pitchDeg !== 0)) throw new Error("Floors must be flat.");
      if ((action.roofPreset === "flat") !== (action.pitchDeg === 0)) throw new Error("Choose zero pitch for flat roofs and positive pitch for sloped roofs.");
      if (action.roofPreset !== "flat" && action.boundary.length !== 4) throw new Error("Pitched roof previews currently require a rectangular four-point boundary.");
      if (action.roofPreset !== "flat") for (let i = 0; i < 4; i++) {
        const a = action.boundary[i], b = action.boundary[(i + 1) % 4], c = action.boundary[(i + 2) % 4];
        if (Math.abs((b.xMm-a.xMm)*(c.xMm-b.xMm)+(b.yMm-a.yMm)*(c.yMm-b.yMm)) > 1) throw new Error("Pitched roofs require a rectangular boundary.");
      }
    }
    elements.set(action.id, { id: action.id, kind: action.kind, ...("levelId" in action ? { levelId: action.levelId } : {}), ...("wallId" in action ? { wallId: action.wallId } : {}), properties: { ...existing?.properties, ...action } });
  }
  // Validate affected hosts after the entire batch, including existing openings on resized walls.
  const openings = [...elements.values()].filter(e => e.kind === "door" || e.kind === "window");
  for (const opening of openings) {
    if (!changed.has(opening.id) && !changed.has(opening.wallId ?? "")) continue;
    const host = elements.get(opening.wallId ?? "");
    if (!host || host.kind !== "wall") throw new Error(`Opening ${opening.id} has no host wall.`);
    if (host.properties.curved) throw new Error("AI opening placement on curved walls is not supported yet.");
    const wall = z.object(wallFields).parse(host.properties);
    const p = z.object({ positionMm: z.number(), widthMm: z.number().positive(), heightMm: z.number().positive(), sillHeightMm: z.number().nonnegative().optional() }).parse(opening.properties);
    const length = Math.hypot(wall.endXmm-wall.startXmm, wall.endYmm-wall.startYmm);
    const sill = opening.kind === "window" ? p.sillHeightMm ?? 0 : 0;
    if (p.positionMm - p.widthMm/2 < 0 || p.positionMm + p.widthMm/2 > length || sill + p.heightMm > wall.heightMm) throw new Error(`Opening ${opening.id} does not fit inside wall ${host.id}.`);
    for (const other of openings) {
      if (other.id === opening.id || other.wallId !== opening.wallId) continue;
      const q = z.object({ positionMm: z.number(), widthMm: z.number().positive(), heightMm: z.number().positive(), sillHeightMm: z.number().optional() }).parse(other.properties);
      const otherSill = other.kind === "window" ? q.sillHeightMm ?? 0 : 0;
      if (Math.abs(p.positionMm-q.positionMm) < (p.widthMm+q.widthMm)/2 && sill < otherSill+q.heightMm && otherSill < sill+p.heightMm) throw new Error(`Openings ${opening.id} and ${other.id} overlap.`);
    }
  }
  return plan;
}
