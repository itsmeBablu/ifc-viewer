import * as THREE from "three";
import type { SelectedElementRef } from "./layoutDrawing";
import { screenSegmentPoint } from "./measurementSnap";

export type SelectionLevel = "element" | "face" | "edge" | "vertex";
export type GeometryReference = {
  kind: SelectionLevel;
  /** World metres, Y-up. Geometry references are transient and reacquired after edits. */
  point: [number, number, number];
  normal?: [number, number, number];
  points: [number, number, number][];
  meshUuid: string;
  geometryUuid: string;
  faceIndex?: number;
  instanceId?: number;
};
export type GeometrySelection = SelectedElementRef & { geometry: GeometryReference };
const tags: [string, SelectedElementRef["kind"]][] = [
  ["layoutWallId", "wall"], ["layoutDoorId", "door"], ["layoutWindowId", "window"], ["layoutSlabId", "slab"],
  ["layoutColumnId", "column"], ["layoutBeamId", "beam"], ["layoutStairId", "stair"], ["layoutRampId", "ramp"],
  ["layoutSketchLineId", "line"], ["layoutGridId", "grid"], ["layoutDuctId", "duct"], ["layoutPipeId", "pipe"],
  ["layoutCableTrayId", "cabletray"], ["layoutEquipmentId", "equipment"], ["layoutWireId", "wire"], ["markupId", "placement"],
];
export function ownerOf(object: THREE.Object3D): SelectedElementRef | null {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    for (const [tag, kind] of tags) if (typeof o.userData[tag] === "string") return { kind, id: o.userData[tag] };
  }
  return null;
}
export function selectionKey(ref: SelectedElementRef) { return `${ref.kind}:${ref.id}`; }
const cache = new WeakMap<THREE.BufferGeometry, Float32Array>();
export function pickGeometry(ray: THREE.Raycaster, roots: THREE.Object3D[], camera: THREE.Camera, rect: { left: number; top: number; width: number; height: number }, x: number, y: number, mode: SelectionLevel): GeometrySelection | null {
  const hits = ray.intersectObjects(roots, true).filter(hit => {
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false;
    return ownerOf(hit.object) && !hit.object.userData.isLayoutGround &&
      (mode !== "face" || hit.object instanceof THREE.Mesh || ownerOf(hit.object)?.kind === "line");
  });
  const hit = hits[0];
  if (!hit) return null;
  const owner = ownerOf(hit.object)!;
  const mesh = hit.object;
  if (!(mesh instanceof THREE.Mesh) && !(mesh instanceof THREE.Line)) return null;
  const transform = mesh.matrixWorld.clone();
  if (mesh instanceof THREE.InstancedMesh && hit.instanceId != null) {
    const instance = new THREE.Matrix4(); mesh.getMatrixAt(hit.instanceId, instance); transform.multiply(instance);
  }
  const geometry = mesh.geometry;
  const base = { meshUuid: mesh.uuid, geometryUuid: geometry.uuid, instanceId: hit.instanceId, faceIndex: hit.faceIndex ?? undefined };
  if (mode === "element") return { ...owner, geometry: { ...base, kind: mode, point: hit.point.toArray(), points: [] } };
  const pixelDistance = (p: THREE.Vector3) => {
    const q = p.clone().project(camera);
    if (q.z < -1 || q.z > 1) return Infinity;
    return Math.hypot(rect.left + (q.x + 1) * rect.width / 2 - x, rect.top + (1 - q.y) * rect.height / 2 - y);
  };
  if (mode === "edge" || mode === "vertex" || mesh instanceof THREE.Line) {
    let edges = cache.get(geometry);
    if (!edges) {
      if (mesh instanceof THREE.Line) {
        const p = geometry.getAttribute("position"), values: number[] = [];
        for (let i = 0; i + 1 < p.count; i += mesh instanceof THREE.LineSegments ? 2 : 1) values.push(p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
        edges = new Float32Array(values);
      } else {
        const e = new THREE.EdgesGeometry(geometry, 1); edges = new Float32Array(e.getAttribute("position").array); e.dispose();
      }
      cache.set(geometry, edges);
    }
    let best: { point: THREE.Vector3; points: THREE.Vector3[]; distance: number } | null = null;
    for (let i = 0; i < edges.length; i += 6) {
      const a = new THREE.Vector3().fromArray(edges, i).applyMatrix4(transform), b = new THREE.Vector3().fromArray(edges, i + 3).applyMatrix4(transform);
      const candidates = mode === "vertex" ? [a, b] : [screenSegmentPoint(a, b, camera, rect, x, y)].filter((p): p is THREE.Vector3 => Boolean(p));
      for (const point of candidates) {
        const distance = pixelDistance(point);
        if (distance <= 14 && (!best || distance < best.distance)) best = { point, points: mode === "vertex" ? [point] : [a, b], distance };
      }
    }
    if (!best) return null;
    return { ...owner, geometry: { ...base, kind: mode === "vertex" ? "vertex" : "edge", point: best.point.toArray(), points: best.points.map(p => p.toArray()) } };
  }
  if (!hit.face || hit.faceIndex == null) return null;
  const position = geometry.getAttribute("position"), index = geometry.index;
  const localPoint = hit.point.clone().applyMatrix4(transform.clone().invert());
  const normal = hit.face.normal.clone().normalize();
  const triangles: [number, number, number][] = [];
  const candidates = new Map<number, THREE.Vector3[]>();
  const adjacency = new Map<string, number[]>();
  const vertexKey = (p: THREE.Vector3) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)},${Math.round(p.z * 1e6)}`;
  const edgeKeys = (points: THREE.Vector3[]) => points.map((p, i) => [vertexKey(p), vertexKey(points[(i + 1) % 3])].sort().join("/"));
  // A face is the coplanar patch, not a bounding-box side or a triangulation diagonal.
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j));
    const n = new THREE.Vector3().subVectors(vertices[1], vertices[0]).cross(new THREE.Vector3().subVectors(vertices[2], vertices[0])).normalize();
    if (n.dot(normal) < 0.99999 || vertices.some(p => Math.abs(p.clone().sub(localPoint).dot(normal)) > 1e-5)) continue;
    const face = i / 3;
    candidates.set(face, vertices);
    for (const key of edgeKeys(vertices)) adjacency.set(key, [...(adjacency.get(key) ?? []), face]);
  }
  const queue = [hit.faceIndex], visited = new Set<number>();
  while (queue.length) {
    const face = queue.pop()!; if (visited.has(face)) continue; visited.add(face);
    const vertices = candidates.get(face); if (!vertices) continue;
    for (const key of edgeKeys(vertices)) for (const adjacent of adjacency.get(key) ?? []) if (!visited.has(adjacent)) queue.push(adjacent);
    triangles.push(...vertices.map(p => p.clone().applyMatrix4(transform).toArray()));
  }
  return { ...owner, geometry: { ...base, kind: "face", point: hit.point.toArray(), normal: normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform)).toArray(), points: triangles } };
}

/** Rigid transform taking the picked target feature onto the reference feature. */
export function alignmentTransform(reference: GeometryReference, target: GeometryReference): THREE.Matrix4 {
  const r = new THREE.Vector3().fromArray(reference.point), t = new THREE.Vector3().fromArray(target.point);
  const rotation = new THREE.Quaternion();
  let destination = r.clone();
  if (reference.kind === "face" && reference.normal) {
    const n = new THREE.Vector3().fromArray(reference.normal).normalize();
    destination = t.clone().addScaledVector(n, r.clone().sub(t).dot(n));
    if (target.normal) {
      const tn = new THREE.Vector3().fromArray(target.normal).normalize();
      rotation.setFromUnitVectors(tn, n.clone().multiplyScalar(tn.dot(n) < 0 ? -1 : 1));
    }
  } else if (reference.kind === "edge" && reference.points.length === 2) {
    const a = new THREE.Vector3().fromArray(reference.points[0]), direction = new THREE.Vector3().fromArray(reference.points[1]).sub(a).normalize();
    destination = a.addScaledVector(direction, t.clone().sub(a).dot(direction));
    if (target.kind === "edge" && target.points.length === 2) {
      const td = new THREE.Vector3().fromArray(target.points[1]).sub(new THREE.Vector3().fromArray(target.points[0])).normalize();
      rotation.setFromUnitVectors(td, direction.clone().multiplyScalar(td.dot(direction) < 0 ? -1 : 1));
    }
  }
  return new THREE.Matrix4().makeTranslation(destination.x, destination.y, destination.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotation)).multiply(new THREE.Matrix4().makeTranslation(-t.x, -t.y, -t.z));
}
