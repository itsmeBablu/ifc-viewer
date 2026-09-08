import * as THREE from "three";
import { screenSegmentPoint } from "./measurementSnap";
import type { DrawingSegment } from "./drawingShapes";

const edgeCache = new WeakMap<THREE.BufferGeometry, Float32Array>();
export function meshDrawingEdges(hit: THREE.Intersection, faceOnly = false): [THREE.Vector3, THREE.Vector3][] {
  if (!(hit.object instanceof THREE.Mesh)) return [];
  const mesh = hit.object, transform = mesh.matrixWorld.clone();
  if (mesh instanceof THREE.InstancedMesh) {
    if (hit.instanceId == null) return [];
    const instance = new THREE.Matrix4(); mesh.getMatrixAt(hit.instanceId, instance); transform.multiply(instance);
  }
  if (!faceOnly) {
    let edges = edgeCache.get(mesh.geometry);
    if (!edges) {
      const geometry = new THREE.EdgesGeometry(mesh.geometry, 20);
      edges = new Float32Array(geometry.attributes.position.array); geometry.dispose(); edgeCache.set(mesh.geometry, edges);
    }
    const result: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < edges.length; i += 6) result.push([new THREE.Vector3().fromArray(edges, i).applyMatrix4(transform), new THREE.Vector3().fromArray(edges, i + 3).applyMatrix4(transform)]);
    return result;
  }
  if (!hit.face) return [];
  const position = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
  const normal = hit.face.normal.clone().normalize();
  const origin = new THREE.Vector3().fromBufferAttribute(position, hit.face.a);
  const counts = new Map<string, { count: number; a: THREE.Vector3; b: THREE.Vector3 }>();
  const key = (p: THREE.Vector3) => [p.x, p.y, p.z].map(v => Math.round(v * 1e6)).join(",");
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j));
    if (points.some(p => Math.abs(p.clone().sub(origin).dot(normal)) > 1e-5)) continue;
    for (let j = 0; j < 3; j++) {
      const a = points[j], b = points[(j + 1) % 3], id = [key(a), key(b)].sort().join("|");
      const old = counts.get(id); counts.set(id, { count: (old?.count ?? 0) + 1, a, b });
    }
  }
  return [...counts.values()].filter(e => e.count === 1).map(e => [e.a.applyMatrix4(transform), e.b.applyMatrix4(transform)]);
}

export function nearestDrawingEdge(edges: [THREE.Vector3, THREE.Vector3][], camera: THREE.Camera, rect: { left: number; top: number; width: number; height: number }, x: number, y: number, tolerance = 18) {
  let best: [THREE.Vector3, THREE.Vector3] | null = null, distance = tolerance;
  for (const edge of edges) {
    const point = screenSegmentPoint(...edge, camera, rect, x, y);
    if (!point) continue;
    const ndc = point.project(camera);
    if (ndc.z < -1 || ndc.z > 1) continue;
    const d = Math.hypot(rect.left + (ndc.x + 1) * rect.width / 2 - x, rect.top + (1 - ndc.y) * rect.height / 2 - y);
    if (d < distance) { best = edge; distance = d; }
  }
  return best;
}

/** Collapse duplicate vertical-face projections and omit edges with no plan length. */
export function projectDrawingEdges(edges: [THREE.Vector3, THREE.Vector3][]): DrawingSegment[] {
  const unique = new Map<string, DrawingSegment>();
  for (const [a, b] of edges) {
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.001) continue;
    const key = [a, b].map(p => `${Math.round(p.x * 1000)},${Math.round(p.z * 1000)}`).sort().join("|");
    unique.set(key, { startXmm: a.x * 1000, startYmm: a.z * 1000, endXmm: b.x * 1000, endYmm: b.z * 1000 });
  }
  return [...unique.values()];
}
