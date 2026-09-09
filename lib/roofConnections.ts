import { extendRoofEdge } from "./roofJoinGeometry";
import * as THREE from "three";
import type { LayoutWall } from "./layoutDrawing";
import { slabBoundaryLoops, validateBoundary } from "./boundaryEditing";
import type { GeometrySelection } from "./modifySelection";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

export function roofWallProfile(wall: LayoutWall, elevationMm: number, top?: THREE.Mesh, base?: THREE.Mesh) {
  if (wall.curved) throw new Error("Roof attachment currently requires a straight wall.");
  const start = new THREE.Vector2(wall.startXmm / 1000, wall.startYmm / 1000);
  const end = new THREE.Vector2(wall.endXmm / 1000, wall.endYmm / 1000);
  const delta = end.clone().sub(start), parameters = new Set([0, 1]);
  // Include every roof triangle boundary crossing, including ridges and valleys.
  for (const roof of [top, base]) if (roof) {
    roof.updateMatrixWorld(true);
    const geometry = roof.geometry, position = geometry.getAttribute("position"), index = geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(roof.matrixWorld));
      for (let k = 0; k < 3; k++) {
        const a = new THREE.Vector2(triangle[k].x, triangle[k].z), b = new THREE.Vector2(triangle[(k + 1) % 3].x, triangle[(k + 1) % 3].z);
        const v = b.sub(a), q = a.sub(start), cross = delta.cross(v);
        if (Math.abs(cross) < 1e-9) continue;
        const t = q.cross(v) / cross, u = q.cross(delta) / cross;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) parameters.add(t);
      }
    }
  }
  const ray = new THREE.Raycaster();
  const height = (roof: THREE.Mesh, t: number, underside: boolean) => {
    const p = start.clone().addScaledVector(delta, t);
    const box = new THREE.Box3().setFromObject(roof);
    ray.set(new THREE.Vector3(p.x, underside ? box.min.y - 1 : box.max.y + 1, p.y), new THREE.Vector3(0, underside ? 1 : -1, 0));
    const materials = Array.isArray(roof.material) ? roof.material : [roof.material];
    const sides = materials.map(m => m.side); materials.forEach(m => { m.side = THREE.DoubleSide; });
    const hit = ray.intersectObject(roof, false)[0];
    materials.forEach((m, i) => { m.side = sides[i]; });
    if (!hit) throw new Error("The roof must cover the entire wall; openings cannot cross the attachment.");
    return hit.point.y * 1000 - elevationMm;
  };
  const sorted = [...parameters].sort((a, b) => a - b);
  // Midpoints detect gaps and holes even when all triangle endpoints are covered.
  for (let i = 1; i < sorted.length; i++) parameters.add((sorted[i - 1] + sorted[i]) / 2);
  return [...parameters].sort((a, b) => a - b).map(t => {
    const topMm = top ? height(top, t, true) : wall.heightMm;
    const baseMm = base ? height(base, t, false) : 0;
    if (topMm <= baseMm + 1) throw new Error("Attachment would make the wall height zero or negative.");
    return { t, topMm, baseMm };
  });
}

export async function joinRoof(source: GeometrySelection, target: GeometrySelection, sourceMesh: THREE.Mesh) {
  const store = useLayoutDrawingStore.getState();
  const slab = store.slabs.find(s => s.id === source.id && s.kind === "roof");
  const targetRoof = store.slabs.find(s => s.id === target.id && s.kind === "roof");
  if (!slab || !targetRoof || slab.id === targetRoof.id) throw new Error("Pick a roof boundary edge, then a different roof face.");
  if (store.lockedElementKeys.includes(`slab:${slab.id}`)) throw new Error("Unlock the source roof before joining it.");
  if (slab.overhangMm) throw new Error("Set the source roof overhang to zero before joining its boundary edge.");
  const normal = target.geometry.normal && new THREE.Vector3().fromArray(target.geometry.normal);
  if (!normal || Math.abs(normal.y) < 0.05) throw new Error("Pick the target roof's top face.");
  const loops = slabBoundaryLoops(slab), boundary = loops[0];
  const point = source.geometry.point;
  let edge = 0, distance = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    const line = new THREE.Line3(new THREE.Vector3(a.xMm, 0, a.yMm), new THREE.Vector3(b.xMm, 0, b.yMm));
    const d = line.closestPointToPoint(new THREE.Vector3(point[0] * 1000, 0, point[2] * 1000), true, new THREE.Vector3()).distanceTo(new THREE.Vector3(point[0] * 1000, 0, point[2] * 1000));
    if (d < distance) { edge = i; distance = d; }
  }
  if (distance > 2) throw new Error("Pick an outer roof boundary edge, not an interior ridge.");
  if (slab.edgeSlopes?.some(s => s.edgeIdx === edge && s.isSloped)) throw new Error("Choose a non-slope-defining roof edge for the join.");
  const targetPoint = new THREE.Vector3().fromArray(target.geometry.point);
  sourceMesh.updateMatrixWorld(true);
  const geometry = sourceMesh.geometry.index ? sourceMesh.geometry.toNonIndexed() : sourceMesh.geometry.clone();
  const positions = geometry.getAttribute("position");
  const vertices = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(sourceMesh.matrixWorld));
  geometry.dispose();
  const joined = extendRoofEdge(vertices, boundary, edge, targetPoint, normal, target.geometry.points.map(p => new THREE.Vector3().fromArray(p)));
  loops[0] = joined.boundary;
  const error = validateBoundary(loops); if (error) throw new Error(error);
  const inverse = sourceMesh.matrixWorld.clone().invert();
  const joinedPositions = joined.vertices.flatMap(vertex => vertex.applyMatrix4(inverse).toArray());
  const nextBoundary = joined.boundary;
  await store.updateSlab(slab.id, {
    boundary: nextBoundary,
    edgeSlopes: joined.sourceEdges.map((original, edgeIdx) => ({ ...(slab.edgeSlopes?.find(s => s.edgeIdx === original) ?? { pitchDeg: 30, isSloped: true }), edgeIdx })),
    minXmm: Math.min(...nextBoundary.map(p => p.xMm)), maxXmm: Math.max(...nextBoundary.map(p => p.xMm)),
    minYmm: Math.min(...nextBoundary.map(p => p.yMm)), maxYmm: Math.max(...nextBoundary.map(p => p.yMm)),
    autoBoundaryFromWalls: false,
    roofJoin: { positions: joinedPositions, targetId: targetRoof.id,
      originalBoundary: slab.roofJoin?.originalBoundary ?? boundary,
      originalEdgeSlopes: slab.roofJoin?.originalEdgeSlopes ?? slab.edgeSlopes },
  });
}
