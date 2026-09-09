import * as THREE from "three";
import type { LayoutSlab } from "./layoutDrawing";

type Point = { xMm: number; yMm: number };
type Plane = { x: number; y: number; c: number };
const EPS = 1e-8;
const value = (plane: Plane, point: THREE.Vector2) => plane.x * point.x + plane.y * point.y + plane.c;

/** Offset supporting edge lines, so a 300 mm overhang is 300 mm on every edge. */
export function offsetRoofBoundary(boundary: Point[], offsetMm: number): Point[] {
  if (offsetMm <= 0 || boundary.length < 3) return boundary;
  const points = boundary.map(p => new THREE.Vector2(p.xMm, p.yMm));
  const sign = THREE.ShapeUtils.isClockWise(points) ? -1 : 1;
  return points.map((point, i) => {
    const before = point.clone().sub(points[(i - 1 + points.length) % points.length]).normalize();
    const after = points[(i + 1) % points.length].clone().sub(point).normalize();
    const n1 = new THREE.Vector2(before.y * sign, -before.x * sign);
    const n2 = new THREE.Vector2(after.y * sign, -after.x * sign);
    const denominator = 1 + n1.dot(n2);
    const offset = denominator > 1e-6 ? n1.add(n2).multiplyScalar(offsetMm / denominator) : n2.multiplyScalar(offsetMm);
    return { xMm: point.x + offset.x, yMm: point.y + offset.y };
  });
}

/** Exact planar envelope for convex footprints, including openings. No sampled ridges. */
export function buildPlanarRoof(slab: LayoutSlab, boundary: Point[]): THREE.BufferGeometry | null {
  const points = boundary.map(p => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000));
  if (points.length < 3) return null;
  const direction = THREE.ShapeUtils.isClockWise(points) ? -1 : 1;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    if (b.clone().sub(a).cross(c.clone().sub(b)) * direction < -EPS) return null;
  }
  const planes: Plane[] = [];
  points.forEach((a, i) => {
    const slope = slab.edgeSlopes?.find(s => s.edgeIdx === i) ?? { isSloped: true, pitchDeg: 30 };
    if (!slope.isSloped || slope.pitchDeg <= 0) return;
    const b = points[(i + 1) % points.length], edge = b.clone().sub(a);
    if (edge.length() < EPS) return;
    const pitch = Math.tan(Math.min(85, Math.max(0, slope.pitchDeg)) * Math.PI / 180);
    const x = -edge.y / edge.length() * direction * pitch;
    const y = edge.x / edge.length() * direction * pitch;
    const plane = { x, y, c: -x * a.x - y * a.y };
    if (!planes.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.c - plane.c) < EPS)) planes.push(plane);
  });
  if (!planes.length) planes.push({ x: 0, y: 0, c: 0 });
  const outer = direction < 0 ? [...points].reverse() : [...points];
  const holes = (slab.holes ?? []).map(ring => {
    const loop = ring.map(p => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000));
    return THREE.ShapeUtils.isClockWise(loop) ? loop : loop.reverse();
  });
  const flat = [...outer, ...holes.flat()];
  const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
  const thickness = Math.max(50, slab.thicknessMm) / 1000;
  const positions: number[] = [];
  const push = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  const clip = (polygon: THREE.Vector2[], plane: Plane) => {
    const result: THREE.Vector2[] = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length], va = value(plane, a), vb = value(plane, b);
      if (va <= EPS) result.push(a);
      if ((va < -EPS && vb > EPS) || (va > EPS && vb < -EPS)) result.push(a.clone().lerp(b, va / (va - vb)));
    });
    return result;
  };
  const patches = holes.length ? triangles.map(triangle => triangle.map(i => flat[i])) : [outer];
  for (const plane of planes) for (const patch of patches) {
    let polygon = patch;
    for (const other of planes) {
      if (other === plane) continue;
      polygon = clip(polygon, { x: plane.x - other.x, y: plane.y - other.y, c: plane.c - other.c });
      if (polygon.length < 3) break;
    }
    for (let i = 1; i + 1 < polygon.length; i++) {
      const a = polygon[0], b = polygon[i], c = polygon[i + 1];
      if (Math.abs(b.clone().sub(a).cross(c.clone().sub(a))) < EPS) continue;
      const top = [a, b, c].map(p => [p.x, thickness + value(plane, p), p.y]);
      const bottom = top.map(p => [p[0], p[1] - thickness, p[2]]);
      // A CCW plan polygon points downward in world X/Z.
      push(top[0], top[2], top[1]);
      push(bottom[0], bottom[1], bottom[2]);
    }
  }
  const height = (p: THREE.Vector2) => Math.min(...planes.map(plane => value(plane, p)));
  // Fascias follow the actual underside, including gable ends and opening walls.
  for (const loop of [outer, ...holes]) loop.forEach((a, i) => {
    const b = loop[(i + 1) % loop.length], cuts = [0, 1];
    for (let j = 0; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
      const da = value(planes[j], a) - value(planes[k], a);
      const db = value(planes[j], b) - value(planes[k], b);
      const t = da / (da - db);
      if (Number.isFinite(t) && t > EPS && t < 1 - EPS) {
        const point = a.clone().lerp(b, t);
        if (Math.abs(value(planes[j], point) - height(point)) < EPS) cuts.push(t);
      }
    }
    const sorted = [...new Set(cuts)].sort((x, y) => x - y);
    for (let j = 1; j < sorted.length; j++) {
      const p = a.clone().lerp(b, sorted[j - 1]), q = a.clone().lerp(b, sorted[j]);
      const tp = [p.x, thickness + height(p), p.y], tq = [q.x, thickness + height(q), q.y];
      const bp = [p.x, tp[1] - thickness, p.y], bq = [q.x, tq[1] - thickness, q.y];
      push(bp, tq, tp); push(bp, bq, tq);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i], positions[i + 2]);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.isComplexRoof = true;
  return geometry;
}
