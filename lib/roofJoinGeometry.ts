import * as THREE from "three";

type Point = { xMm: number; yMm: number };

/** Extend every vertex on the chosen edge, including gable ridge intersections. */
export function extendRoofEdge(vertices: THREE.Vector3[], boundary: Point[], edge: number, targetPoint: THREE.Vector3, normal: THREE.Vector3, face: THREE.Vector3[]) {
  const n = boundary.length;
  const plan = boundary.map(p => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000));
  const a = plan[edge], b = plan[(edge + 1) % n], span = b.clone().sub(a);
  const startDirection = a.clone().sub(plan[(edge - 1 + n) % n]).normalize();
  const endDirection = b.clone().sub(plan[(edge + 2) % n]).normalize();
  const edgeParameter = (p: THREE.Vector3) => {
    const delta = new THREE.Vector2(p.x, p.z).sub(a);
    const t = delta.dot(span) / span.lengthSq();
    return Math.abs(delta.cross(span)) / span.length() < 0.001 && t >= -1e-6 && t <= 1 + 1e-6 ? Math.max(0, Math.min(1, t)) : null;
  };
  const faces: { triangle: THREE.Triangle; plane: THREE.Plane }[] = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const triangle = new THREE.Triangle(vertices[i], vertices[i + 1], vertices[i + 2]);
    const plane = triangle.getPlane(new THREE.Plane());
    if (Math.abs(plane.normal.y) > 0.05) faces.push({ triangle, plane });
  }
  const height = (p: THREE.Plane, x: number, z: number) => -(p.normal.x * x + p.normal.z * z + p.constant) / p.normal.y;
  const moves = new Map<string, { t: number; dx: number; dy: number; dz: number; point: Point }>();
  const moved = vertices.map(vertex => {
    const t = edgeParameter(vertex);
    if (t == null) return vertex.clone();
    const key = t.toFixed(7);
    let move = moves.get(key);
    if (!move) {
      const candidates = faces.filter(({ triangle, plane }) => {
        const projected = new THREE.Vector3(vertex.x, height(plane, vertex.x, vertex.z), vertex.z);
        return triangle.closestPointToPoint(projected, new THREE.Vector3()).distanceTo(projected) < 0.001;
      }).sort((one, two) => height(two.plane, vertex.x, vertex.z) - height(one.plane, vertex.x, vertex.z));
      const plane = candidates[0]?.plane;
      if (!plane) throw new Error("The selected edge must adjoin a roof surface.");
      const direction2 = startDirection.clone().lerp(endDirection, t).normalize();
      const direction = new THREE.Vector3(direction2.x, -(plane.normal.x * direction2.x + plane.normal.z * direction2.y) / plane.normal.y, direction2.y);
      const top = new THREE.Vector3(vertex.x, height(plane, vertex.x, vertex.z), vertex.z);
      const denominator = normal.dot(direction);
      if (Math.abs(denominator) < 1e-8) throw new Error("These roof faces do not have a unique intersection.");
      const hit = top.clone().addScaledVector(direction, normal.dot(targetPoint.clone().sub(top)) / denominator);
      let inside = false;
      for (let i = 0; i + 2 < face.length; i += 3) {
        if (new THREE.Triangle(face[i], face[i + 1], face[i + 2]).closestPointToPoint(hit, new THREE.Vector3()).distanceTo(hit) < 0.002) inside = true;
      }
      if (!inside) throw new Error("The roof edge must meet the selected roof face within its bounds.");
      move = { t, dx: hit.x - top.x, dy: hit.y - top.y, dz: hit.z - top.z, point: { xMm: hit.x * 1000, yMm: hit.z * 1000 } };
      moves.set(key, move);
    }
    return vertex.clone().add(new THREE.Vector3(move.dx, move.dy, move.dz));
  });
  const edgePoints = [...moves.values()].sort((x, y) => x.t - y.t).map(m => m.point);
  if (edgePoints.length < 2) throw new Error("Pick an outer roof boundary edge.");
  // Remove collinear tessellation points but retain a bend at a gable ridge.
  for (let i = edgePoints.length - 2; i > 0; i--) {
    const p = edgePoints[i - 1], q = edgePoints[i], r = edgePoints[i + 1];
    if (Math.abs((q.xMm - p.xMm) * (r.yMm - q.yMm) - (q.yMm - p.yMm) * (r.xMm - q.xMm)) < 1) edgePoints.splice(i, 1);
  }
  const result: Point[] = [];
  const sourceEdges: number[] = [];
  boundary.forEach((point, i) => {
    if (i === edge) {
      for (const p of edgePoints.slice(0, -1)) { result.push(p); sourceEdges.push(edge); }
    } else { result.push(i === (edge + 1) % n ? edgePoints[edgePoints.length - 1] : { ...point }); sourceEdges.push(i); }
  });
  // For the closing edge its endpoint is vertex zero, already emitted above.
  if (edge === n - 1) result[0] = edgePoints[edgePoints.length - 1];
  return { vertices: moved, boundary: result, sourceEdges };
}
