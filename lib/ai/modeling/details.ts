import type { AiAction } from "../schema";
import type { ResidentialParameters } from "./allocation";

/** Apply chosen opening styles consistently to native, irregular and edited plans. */
export function homeDetails(actions: AiAction[], p: ResidentialParameters): AiAction[] {
  const walls = new Map(actions.flatMap(a => a.kind === "wall" ? [[a.id, a] as const] : []));
  const result = actions.map(a => {
    if (a.kind === "wall" && p.curtainFacade && /:wall:2$|:outline:2$/.test(a.id) && !a.id.includes("garage")) return { ...a, wallType: "curtain" as const };
    if (a.kind === "door" && a.style !== "garage") {
      const wall = walls.get(a.wallId);
      const exterior = /:wall:[0-3]$|:outline:/.test(a.wallId) || wall?.wallType === "exterior";
      const double = exterior ? p.doubleEntranceDoor ?? a.style === "double" : false;
      const length = wall ? Math.hypot(wall.endXmm - wall.startXmm, wall.endYmm - wall.startYmm) : Infinity;
      const available = Math.min(a.positionMm, length - a.positionMm) * 2 - 100;
      const widthMm = Math.min(double ? 1600 : 900, available);
      return { ...a, style: double ? "double" as const : p.doorStyle ?? a.style, widthMm: Math.max(600, widthMm), heightMm: Math.min(p.doorHeightMm ?? a.heightMm, (wall?.heightMm ?? 3000) - 100) };
    }
    if (a.kind === "window") {
      const wall = walls.get(a.wallId);
      return { ...a, operationType: p.windowStyle ?? a.operationType, heightMm: Math.min(p.windowHeightMm ?? a.heightMm, (wall?.heightMm ?? 3000) - a.sillHeightMm - 100) };
    }
    return a;
  });
  if (p.electrical) {
    for (const a of actions) {
      if (a.kind !== "equipment" || !/^(bed-|sofa|kitchen-sink|bath-vanity)/.test(a.familyId)) continue;
      if (result.some(b => b.kind === "equipment" && b.familyId === "mep-lighting_fixture" && b.levelId === a.levelId && Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm) < 1500)) continue;
      const height = [...walls.values()].find(w => w.levelId === a.levelId)?.heightMm ?? 3000;
      const nearest = [...walls.values()].filter(w => w.levelId === a.levelId).map(w => {
        const dx = w.endXmm - w.startXmm, dy = w.endYmm - w.startYmm;
        const t = Math.max(.05, Math.min(.95, ((a.xMm - w.startXmm) * dx + (a.yMm - w.startYmm) * dy) / (dx * dx + dy * dy || 1)));
        const xMm = w.startXmm + t * dx, yMm = w.startYmm + t * dy;
        return { xMm, yMm, distance: Math.hypot(a.xMm - xMm, a.yMm - yMm), rotationDeg: Math.atan2(dy, dx) * 180 / Math.PI };
      }).sort((a, b) => a.distance - b.distance)[0];
      result.push({ kind: "equipment", operation: "create", id: `${a.id}:light`, levelId: a.levelId, familyId: "mep-lighting_fixture", xMm: a.xMm, yMm: a.yMm, rotationDeg: 0, elevationMm: height - 150 },
        { kind: "equipment", operation: "create", id: `${a.id}:socket`, levelId: a.levelId, familyId: "mep-socket", xMm: nearest?.xMm ?? a.xMm, yMm: nearest?.yMm ?? a.yMm, rotationDeg: nearest?.rotationDeg ?? 0, elevationMm: 300 });
    }
  }
  return result;
}

/** Alternate front/rear and left/right zoning without changing the requested envelope. */
export function varyHomeLayout(actions: AiAction[], p: ResidentialParameters): AiAction[] {
  const revision = (p.layoutRevision ?? 0) % 4;
  if (!revision || (p.footprint && p.footprint !== "rectangle")) return actions;
  const core = actions.filter(a => a.kind === "wall" && /:wall:[0-3]$/.test(a.id) && !a.id.includes("garage"));
  const xs = core.flatMap(a => a.kind === "wall" ? [a.startXmm, a.endXmm] : []), ys = core.flatMap(a => a.kind === "wall" ? [a.startYmm, a.endYmm] : []);
  if (!xs.length) return actions;
  const sumX = Math.min(...xs) + Math.max(...xs), sumY = Math.min(...ys) + Math.max(...ys);
  const flipX = revision === 2 || revision === 3, flipY = revision === 1 || revision === 3;
  const point = (x: number, y: number) => ({ xMm: flipX ? sumX - x : x, yMm: flipY ? sumY - y : y });
  return actions.map(a => {
    if (/garage|garden|balcony|car/.test(a.id)) return a;
    if (a.kind === "wall" || a.kind === "duct" || a.kind === "pipe") {
      const start = point(a.startXmm, a.startYmm), end = point(a.endXmm, a.endYmm);
      return { ...a, startXmm: start.xMm, startYmm: start.yMm, endXmm: end.xMm, endYmm: end.yMm };
    }
    if (a.kind === "floor" || a.kind === "roof") return { ...a, boundary: a.boundary.map(p => point(p.xMm, p.yMm)) };
    if (a.kind === "equipment") return { ...a, ...point(a.xMm, a.yMm), rotationDeg: ((flipX ? 180 - a.rotationDeg : a.rotationDeg) * (flipY ? -1 : 1) + 360) % 360 };
    if (a.kind === "door" && flipX !== flipY) return { ...a, swing: a.swing === 1 ? -1 as const : 1 as const };
    return a;
  });
}
