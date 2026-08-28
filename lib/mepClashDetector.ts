/**
 * MEP Clash Detector — Lightweight structural clash detection
 * Identifies spatial intersections between MEP distribution runs (ducts/pipes/cable trays)
 * and structural/architectural elements (walls, columns, beams).
 */

import type {
  LayoutBeam,
  LayoutColumn,
  LayoutDuct,
  LayoutPipe,
  LayoutWall,
} from "./layoutDrawing";

export type MepClash = {
  id: string;
  mepId: string;
  mepKind: "duct" | "pipe" | "cabletray";
  structuralId: string;
  structuralKind: "wall" | "column" | "beam";
  pointMm: { xMm: number; yMm: number };
  elevationMm: number;
  severity: "hard_clash" | "clearance_warning";
  description: string;
};

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return null;

  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    return {
      x: p1.x + u * (p2.x - p1.x),
      y: p1.y + u * (p2.y - p1.y),
    };
  }
  return null;
}

export function detectMepClashes(
  ducts: LayoutDuct[],
  pipes: LayoutPipe[],
  walls: LayoutWall[],
  columns: LayoutColumn[],
  beams: LayoutBeam[],
  levelElevationMm = 0
): MepClash[] {
  const clashes: MepClash[] = [];

  // Check Ducts vs Walls
  for (const d of ducts) {
    const ductSystem = d.systemType ?? (d as LayoutDuct & { system?: LayoutDuct["systemType"] }).system ?? "supply";
    const dp1 = { x: d.startXmm, y: d.startYmm };
    const dp2 = { x: d.endXmm, y: d.endYmm };
    const dElev = levelElevationMm + (d.elevationMm ?? d.elevationOffsetMm ?? 0);

    for (const w of walls) {
      if (w.levelId !== d.levelId) continue;
      const wp1 = { x: w.startXmm, y: w.startYmm };
      const wp2 = { x: w.endXmm, y: w.endYmm };

      const hit = segmentsIntersect(dp1, dp2, wp1, wp2);
      if (hit) {
        // Wall height range
        const wallBottom = levelElevationMm;
        const wallTop = levelElevationMm + w.heightMm;
        if (dElev >= wallBottom && dElev <= wallTop) {
          clashes.push({
            id: `clash-duct-${d.id}-wall-${w.id}`,
            mepId: d.id,
            mepKind: "duct",
            structuralId: w.id,
            structuralKind: "wall",
            pointMm: { xMm: Math.round(hit.x), yMm: Math.round(hit.y) },
            elevationMm: dElev,
            severity: "hard_clash",
            description: `Duct (${ductSystem}) penetrates Wall without dedicated sleeve opening`,
          });
        }
      }
    }

    // Check Ducts vs Columns
    for (const c of columns) {
      if (c.levelId !== d.levelId) continue;
      const halfW = c.widthMm / 2;
      const halfD = c.depthMm / 2;
      const colMinX = c.xMm - halfW;
      const colMaxX = c.xMm + halfW;
      const colMinY = c.yMm - halfD;
      const colMaxY = c.yMm + halfD;

      const midX = (d.startXmm + d.endXmm) / 2;
      const midY = (d.startYmm + d.endYmm) / 2;
      if (midX >= colMinX && midX <= colMaxX && midY >= colMinY && midY <= colMaxY) {
        clashes.push({
          id: `clash-duct-${d.id}-col-${c.id}`,
          mepId: d.id,
          mepKind: "duct",
          structuralId: c.id,
          structuralKind: "column",
          pointMm: { xMm: c.xMm, yMm: c.yMm },
          elevationMm: dElev,
          severity: "hard_clash",
          description: `Duct directly intersects Structural Column`,
        });
      }
    }
  }

  // Check Pipes vs Walls
  for (const p of pipes) {
    const pipeSystem = p.systemType ?? (p as LayoutPipe & { system?: LayoutPipe["systemType"] }).system ?? "hydronic_supply";
    const pp1 = { x: p.startXmm, y: p.startYmm };
    const pp2 = { x: p.endXmm, y: p.endYmm };
    const pElev = levelElevationMm + (p.elevationMm ?? p.elevationOffsetMm ?? 0);

    for (const w of walls) {
      if (w.levelId !== p.levelId) continue;
      const wp1 = { x: w.startXmm, y: w.startYmm };
      const wp2 = { x: w.endXmm, y: w.endYmm };

      const hit = segmentsIntersect(pp1, pp2, wp1, wp2);
      if (hit) {
        const wallBottom = levelElevationMm;
        const wallTop = levelElevationMm + w.heightMm;
        if (pElev >= wallBottom && pElev <= wallTop) {
          clashes.push({
            id: `clash-pipe-${p.id}-wall-${w.id}`,
            mepId: p.id,
            mepKind: "pipe",
            structuralId: w.id,
            structuralKind: "wall",
            pointMm: { xMm: Math.round(hit.x), yMm: Math.round(hit.y) },
            elevationMm: pElev,
            severity: "hard_clash",
            description: `Pipe (${pipeSystem}) penetrates Wall without sleeve`,
          });
        }
      }
    }
  }

  return clashes;
}
