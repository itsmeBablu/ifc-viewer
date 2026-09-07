import * as THREE from "three";
import type { PlanSnapModes } from "./layoutDrawing";

const edgeCache = new WeakMap<THREE.BufferGeometry, Float32Array>();

/** Perspective-correct point on a segment nearest the cursor in screen space. */
export function screenSegmentPoint(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera, rect: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const ca = new THREE.Vector4(a.x, a.y, a.z, 1).applyMatrix4(matrix);
  const cb = new THREE.Vector4(b.x, b.y, b.z, 1).applyMatrix4(matrix);
  if (ca.w <= 0 || cb.w <= 0) return null;
  const ax = rect.left + (ca.x / ca.w + 1) * rect.width / 2;
  const ay = rect.top + (1 - ca.y / ca.w) * rect.height / 2;
  const bx = rect.left + (cb.x / cb.w + 1) * rect.width / 2;
  const by = rect.top + (1 - cb.y / cb.w) * rect.height / 2;
  const dx = bx - ax, dy = by - ay;
  const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const worldT = (t / cb.w) / ((1 - t) / ca.w + t / cb.w);
  return a.clone().lerp(b, worldT);
}

/** Snap to actual mesh feature edges, excluding triangulation diagonals. */
export function snapMeshMeasurement(object: THREE.Object3D, camera: THREE.Camera, canvas: HTMLCanvasElement, x: number, y: number, modes: PlanSnapModes, from?: THREE.Vector3 | null, instanceId?: number) {
  const rect = canvas.getBoundingClientRect();
  const candidates: { point: THREE.Vector3; label: string; score: number }[] = [];
  const add = (point: THREE.Vector3, label: string, priority: number) => {
    const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
    if (view.z >= 0) return;
    const p = point.clone().project(camera);
    if (p.z < -1 || p.z > 1) return;
    const distance = Math.hypot(rect.left + (p.x + 1) * rect.width / 2 - x, rect.top + (1 - p.y) * rect.height / 2 - y);
    if (distance <= 12) candidates.push({ point, label, score: distance + priority * 2 });
  };
  object.traverse((mesh) => {
    if (!(mesh instanceof THREE.Mesh) || !mesh.visible) return;
    const transform = mesh.matrixWorld.clone();
    if (mesh instanceof THREE.InstancedMesh) {
      if (instanceId === undefined) return;
      const instance = new THREE.Matrix4();
      mesh.getMatrixAt(instanceId, instance);
      transform.multiply(instance);
    }
    const geometry = mesh.geometry;
    let edges = edgeCache.get(geometry);
    if (!edges) {
      const edgeGeometry = new THREE.EdgesGeometry(geometry, 20);
      edges = new Float32Array(edgeGeometry.attributes.position.array);
      edgeGeometry.dispose();
      edgeCache.set(geometry, edges);
    }
    for (let i = 0; i < edges.length; i += 6) {
      const a = new THREE.Vector3().fromArray(edges, i).applyMatrix4(transform);
      const b = new THREE.Vector3().fromArray(edges, i + 3).applyMatrix4(transform);
      if (modes.endpoint) { add(a, "Endpoint", 0); add(b, "Endpoint", 0); }
      if (modes.midpoint) add(a.clone().lerp(b, 0.5), "Midpoint", 1);
      if (modes.perpendicular && from) {
        const edge = b.clone().sub(a);
        const t = from.clone().sub(a).dot(edge) / edge.lengthSq();
        if (t > 0 && t < 1) add(a.clone().addScaledVector(edge, t), "Perpendicular", 2);
      }
      if (modes.nearest) {
        const point = screenSegmentPoint(a, b, camera, rect, x, y);
        if (point) add(point, "Edge", 3);
      }
    }
  });
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] ?? null;
}
