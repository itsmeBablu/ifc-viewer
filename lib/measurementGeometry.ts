import { Vector3 } from "three";

export type MeasurementKind = "distance" | "angle" | "arc";
export type MeasurePoint = { x: number; y: number; z: number };

/** Geometry stays in the plane defined by the picked points, including in 3D. */
export function measurementGeometry(kind: MeasurementKind, points: MeasurePoint[]) {
  const [a, b, c] = points.map((p) => new Vector3(p.x, p.y, p.z));
  if (!a || !b || a.distanceTo(b) < 1e-6) return null;
  if (kind === "distance") {
    return { paths: [[a, b]], labelAt: a.clone().lerp(b, 0.5), length: a.distanceTo(b), angle: null, radius: null };
  }
  if (!c || b.distanceTo(c) < 1e-6 || a.distanceTo(c) < 1e-6) return null;
  if (kind === "angle") {
    const u = a.clone().sub(b).normalize();
    const v = c.clone().sub(b).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, u.dot(v))));
    const normal = new Vector3().crossVectors(u, v);
    if (normal.lengthSq() < 1e-12) {
      normal.crossVectors(u, Math.abs(u.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
    }
    normal.normalize();
    const radius = Math.min(a.distanceTo(b), c.distanceTo(b)) * 0.3;
    const arc = Array.from({ length: 49 }, (_, i) => u.clone().applyAxisAngle(normal, angle * i / 48).multiplyScalar(radius).add(b));
    return { paths: [[a, b, c], arc], labelAt: arc[24], length: null, angle: angle * 180 / Math.PI, radius: null };
  }
  const ab = b.clone().sub(a), ac = c.clone().sub(a);
  const normal = new Vector3().crossVectors(ab, ac);
  if (normal.lengthSq() < 1e-12 * ab.lengthSq() * ac.lengthSq()) return null;
  const center = new Vector3().crossVectors(ac, normal).multiplyScalar(ab.lengthSq())
    .add(new Vector3().crossVectors(normal, ab).multiplyScalar(ac.lengthSq()))
    .divideScalar(2 * normal.lengthSq()).add(a);
  normal.normalize();
  const u = a.clone().sub(center), radius = u.length();
  const angleTo = (p: Vector3) => {
    const v = p.clone().sub(center);
    const angle = Math.atan2(normal.dot(new Vector3().crossVectors(u, v)), u.dot(v));
    return (angle + Math.PI * 2) % (Math.PI * 2);
  };
  let sweep = angleTo(c);
  if (angleTo(b) > sweep) sweep -= Math.PI * 2;
  const arc = Array.from({ length: 97 }, (_, i) => u.clone().applyAxisAngle(normal, sweep * i / 96).add(center));
  return { paths: [arc], labelAt: arc[48], length: Math.abs(sweep) * radius, angle: Math.abs(sweep) * 180 / Math.PI, radius };
}

export function measurementLabel(result: NonNullable<ReturnType<typeof measurementGeometry>>) {
  if (result.length === null) return `${result.angle!.toFixed(1)}°`;
  const distance = `${(result.length * 1000).toFixed(1)} mm`;
  return result.radius === null ? distance : `${distance} · ${result.angle!.toFixed(1)}° · R ${(result.radius * 1000).toFixed(1)} mm`;
}
