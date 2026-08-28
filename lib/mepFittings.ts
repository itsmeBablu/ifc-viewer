/**
 * MEP Fittings Engine — Automatically detects junctions, angles, and transitions
 * between connected duct runs and pipe runs, generating clean 3D & 2D fittings.
 */

import type {
  DuctShape,
  DuctSystemType,
  LayoutDuct,
  LayoutPipe,
  PipeSystemType,
} from "./layoutDrawing";

export type MepFittingType = "elbow" | "tee" | "cross" | "reducer" | "cap";

export type MepDuctFitting = {
  id: string;
  fittingType: MepFittingType;
  centerMm: { xMm: number; yMm: number };
  elevationOffsetMm: number;
  shape: DuctShape;
  system: DuctSystemType;
  mainWidthMm: number;
  mainHeightMm: number;
  mainDiameterMm: number;
  branchWidthMm?: number;
  branchHeightMm?: number;
  branchDiameterMm?: number;
  angleDeg: number;
  rotationDeg: number;
  connectedDuctIds: string[];
};

export type MepPipeFitting = {
  id: string;
  fittingType: MepFittingType;
  centerMm: { xMm: number; yMm: number };
  elevationOffsetMm: number;
  system: PipeSystemType;
  mainDiameterMm: number;
  branchDiameterMm?: number;
  angleDeg: number;
  rotationDeg: number;
  connectedPipeIds: string[];
};

const JUNCTION_TOLERANCE_MM = 80;

function distanceSq(p1: { xMm: number; yMm: number }, p2: { xMm: number; yMm: number }): number {
  const dx = p1.xMm - p2.xMm;
  const dy = p1.yMm - p2.yMm;
  return dx * dx + dy * dy;
}

/**
 * Solve all duct fittings (elbows, tees, crosses, transitions) in a level
 */
export function solveDuctFittings(ducts: LayoutDuct[]): MepDuctFitting[] {
  const fittings: MepDuctFitting[] = [];
  if (ducts.length < 2) return fittings;

  // Group duct endpoints into junction nodes
  type Endpoint = {
    ductId: string;
    pt: { xMm: number; yMm: number };
    isStart: boolean;
    otherPt: { xMm: number; yMm: number };
    duct: LayoutDuct;
  };

  const endpoints: Endpoint[] = [];
  for (const d of ducts) {
    endpoints.push({
      ductId: d.id,
      pt: { xMm: d.startXmm, yMm: d.startYmm },
      isStart: true,
      otherPt: { xMm: d.endXmm, yMm: d.endYmm },
      duct: d,
    });
    endpoints.push({
      ductId: d.id,
      pt: { xMm: d.endXmm, yMm: d.endYmm },
      isStart: false,
      otherPt: { xMm: d.startXmm, yMm: d.startYmm },
      duct: d,
    });
  }

  // Cluster endpoints by proximity
  const clusters: Endpoint[][] = [];
  const visited = new Set<Endpoint>();

  for (const ep of endpoints) {
    if (visited.has(ep)) continue;
    const cluster: Endpoint[] = [ep];
    visited.add(ep);

    for (const other of endpoints) {
      if (visited.has(other)) continue;
      if (ep.ductId === other.ductId) continue;
      if (Math.abs(ep.duct.elevationOffsetMm - other.duct.elevationOffsetMm) > 50) continue;
      if (distanceSq(ep.pt, other.pt) <= JUNCTION_TOLERANCE_MM * JUNCTION_TOLERANCE_MM) {
        cluster.push(other);
        visited.add(other);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  // Generate fittings for each junction cluster
  for (const cluster of clusters) {
    const avgX = cluster.reduce((sum, e) => sum + e.pt.xMm, 0) / cluster.length;
    const avgY = cluster.reduce((sum, e) => sum + e.pt.yMm, 0) / cluster.length;
    const baseDuct = cluster[0].duct;
    const connectedDuctIds = [...new Set(cluster.map((c) => c.ductId))];

    if (cluster.length === 2) {
      // 2 connected segments -> Elbow or Reducer
      const e1 = cluster[0];
      const e2 = cluster[1];
      const dir1 = { x: e1.otherPt.xMm - e1.pt.xMm, y: e1.otherPt.yMm - e1.pt.yMm };
      const dir2 = { x: e2.otherPt.xMm - e2.pt.xMm, y: e2.otherPt.yMm - e2.pt.yMm };
      const angle1 = Math.atan2(dir1.y, dir1.x);
      const angle2 = Math.atan2(dir2.y, dir2.x);
      let angleDiff = Math.abs(angle1 - angle2) * (180 / Math.PI);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      const isStraight = Math.abs(angleDiff - 180) < 15;
      const isReduc =
        isStraight &&
        (e1.duct.widthMm !== e2.duct.widthMm ||
          e1.duct.heightMm !== e2.duct.heightMm ||
          e1.duct.diameterMm !== e2.duct.diameterMm);

      fittings.push({
        id: `fitting-duct-${cluster[0].ductId}-${cluster[1].ductId}`,
        fittingType: isReduc ? "reducer" : "elbow",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: baseDuct.elevationOffsetMm,
        shape: baseDuct.shape,
        system: baseDuct.system,
        mainWidthMm: Math.max(e1.duct.widthMm, e2.duct.widthMm),
        mainHeightMm: Math.max(e1.duct.heightMm, e2.duct.heightMm),
        mainDiameterMm: Math.max(e1.duct.diameterMm, e2.duct.diameterMm),
        branchWidthMm: Math.min(e1.duct.widthMm, e2.duct.widthMm),
        branchHeightMm: Math.min(e1.duct.heightMm, e2.duct.heightMm),
        branchDiameterMm: Math.min(e1.duct.diameterMm, e2.duct.diameterMm),
        angleDeg: Math.round(angleDiff),
        rotationDeg: Math.round(angle1 * (180 / Math.PI)),
        connectedDuctIds,
      });
    } else if (cluster.length === 3) {
      // Tee junction
      fittings.push({
        id: `fitting-duct-tee-${cluster.map((c) => c.ductId).join("-")}`,
        fittingType: "tee",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: baseDuct.elevationOffsetMm,
        shape: baseDuct.shape,
        system: baseDuct.system,
        mainWidthMm: baseDuct.widthMm,
        mainHeightMm: baseDuct.heightMm,
        mainDiameterMm: baseDuct.diameterMm,
        angleDeg: 90,
        rotationDeg: 0,
        connectedDuctIds,
      });
    } else if (cluster.length >= 4) {
      // Cross junction
      fittings.push({
        id: `fitting-duct-cross-${cluster.map((c) => c.ductId).join("-")}`,
        fittingType: "cross",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: baseDuct.elevationOffsetMm,
        shape: baseDuct.shape,
        system: baseDuct.system,
        mainWidthMm: baseDuct.widthMm,
        mainHeightMm: baseDuct.heightMm,
        mainDiameterMm: baseDuct.diameterMm,
        angleDeg: 90,
        rotationDeg: 0,
        connectedDuctIds,
      });
    }
  }

  return fittings;
}

/**
 * Solve all pipe fittings (elbows, tees, crosses) in a level
 */
export function solvePipeFittings(pipes: LayoutPipe[]): MepPipeFitting[] {
  const fittings: MepPipeFitting[] = [];
  if (pipes.length < 2) return fittings;

  type Endpoint = {
    pipeId: string;
    pt: { xMm: number; yMm: number };
    otherPt: { xMm: number; yMm: number };
    pipe: LayoutPipe;
  };

  const endpoints: Endpoint[] = [];
  for (const p of pipes) {
    endpoints.push({
      pipeId: p.id,
      pt: { xMm: p.startXmm, yMm: p.startYmm },
      otherPt: { xMm: p.endXmm, yMm: p.endYmm },
      pipe: p,
    });
    endpoints.push({
      pipeId: p.id,
      pt: { xMm: p.endXmm, yMm: p.endYmm },
      otherPt: { xMm: p.startXmm, yMm: p.startYmm },
      pipe: p,
    });
  }

  const clusters: Endpoint[][] = [];
  const visited = new Set<Endpoint>();

  for (const ep of endpoints) {
    if (visited.has(ep)) continue;
    const cluster: Endpoint[] = [ep];
    visited.add(ep);

    for (const other of endpoints) {
      if (visited.has(other)) continue;
      if (ep.pipeId === other.pipeId) continue;
      if (Math.abs(ep.pipe.elevationOffsetMm - other.pipe.elevationOffsetMm) > 30) continue;
      if (distanceSq(ep.pt, other.pt) <= JUNCTION_TOLERANCE_MM * JUNCTION_TOLERANCE_MM) {
        cluster.push(other);
        visited.add(other);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  for (const cluster of clusters) {
    const avgX = cluster.reduce((sum, e) => sum + e.pt.xMm, 0) / cluster.length;
    const avgY = cluster.reduce((sum, e) => sum + e.pt.yMm, 0) / cluster.length;
    const basePipe = cluster[0].pipe;
    const connectedPipeIds = [...new Set(cluster.map((c) => c.pipeId))];

    if (cluster.length === 2) {
      const e1 = cluster[0];
      const e2 = cluster[1];
      const dir1 = { x: e1.otherPt.xMm - e1.pt.xMm, y: e1.otherPt.yMm - e1.pt.yMm };
      const dir2 = { x: e2.otherPt.xMm - e2.pt.xMm, y: e2.otherPt.yMm - e2.pt.yMm };
      const angle1 = Math.atan2(dir1.y, dir1.x);
      const angle2 = Math.atan2(dir2.y, dir2.x);
      let angleDiff = Math.abs(angle1 - angle2) * (180 / Math.PI);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      fittings.push({
        id: `fitting-pipe-${cluster[0].pipeId}-${cluster[1].pipeId}`,
        fittingType: "elbow",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: basePipe.elevationOffsetMm,
        system: basePipe.system,
        mainDiameterMm: Math.max(e1.pipe.diameterMm, e2.pipe.diameterMm),
        branchDiameterMm: Math.min(e1.pipe.diameterMm, e2.pipe.diameterMm),
        angleDeg: Math.round(angleDiff),
        rotationDeg: Math.round(angle1 * (180 / Math.PI)),
        connectedPipeIds,
      });
    } else if (cluster.length === 3) {
      fittings.push({
        id: `fitting-pipe-tee-${cluster.map((c) => c.pipeId).join("-")}`,
        fittingType: "tee",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: basePipe.elevationOffsetMm,
        system: basePipe.system,
        mainDiameterMm: basePipe.diameterMm,
        angleDeg: 90,
        rotationDeg: 0,
        connectedPipeIds,
      });
    } else if (cluster.length >= 4) {
      fittings.push({
        id: `fitting-pipe-cross-${cluster.map((c) => c.pipeId).join("-")}`,
        fittingType: "cross",
        centerMm: { xMm: avgX, yMm: avgY },
        elevationOffsetMm: basePipe.elevationOffsetMm,
        system: basePipe.system,
        mainDiameterMm: basePipe.diameterMm,
        angleDeg: 90,
        rotationDeg: 0,
        connectedPipeIds,
      });
    }
  }

  return fittings;
}
