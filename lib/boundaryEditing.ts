import type { LayoutSlab } from "./layoutDrawing";

export type BoundaryPoint = { xMm: number; yMm: number };
export type BoundaryLoops = BoundaryPoint[][];
const EPS = 0.001; // millimetres
const cross = (a: BoundaryPoint, b: BoundaryPoint, c: BoundaryPoint) =>
  (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm);
const distance = (a: BoundaryPoint, b: BoundaryPoint) => Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
const on = (a: BoundaryPoint, b: BoundaryPoint, p: BoundaryPoint) =>
  Math.abs(cross(a, b, p)) <= EPS * distance(a, b) &&
  p.xMm >= Math.min(a.xMm, b.xMm) - EPS && p.xMm <= Math.max(a.xMm, b.xMm) + EPS &&
  p.yMm >= Math.min(a.yMm, b.yMm) - EPS && p.yMm <= Math.max(a.yMm, b.yMm) + EPS;
function intersects(a: BoundaryPoint, b: BoundaryPoint, c: BoundaryPoint, d: BoundaryPoint) {
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b) ||
    ((cross(a, b, c) > 0) !== (cross(a, b, d) > 0) && (cross(c, d, a) > 0) !== (cross(c, d, b) > 0));
}
function inside(p: BoundaryPoint, loop: BoundaryPoint[]) {
  let result = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if (on(a, b, p)) return false;
    if ((a.yMm > p.yMm) !== (b.yMm > p.yMm) && p.xMm < (b.xMm - a.xMm) * (p.yMm - a.yMm) / (b.yMm - a.yMm) + a.xMm) result = !result;
  }
  return result;
}

/** Implicitly closed, non-repeated rings: the input contract of THREE.Shape/Earcut. */
export function validateBoundary(loops: BoundaryLoops): string | null {
  if (!loops.length) return "A boundary is required.";
  for (const loop of loops) {
    if (loop.length < 3 || loop.some(p => !Number.isFinite(p.xMm) || !Number.isFinite(p.yMm))) return "A loop needs three finite vertices.";
    let area = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length], c = loop[(i + 2) % loop.length];
      if (distance(a, b) <= EPS) return "An edge cannot collapse.";
      if (on(a, b, c) || on(b, c, a)) return "Adjacent edges cannot overlap.";
      area += cross(loop[0], a, b);
      for (let j = i + 1; j < loop.length; j++) {
        if (j === i + 1 || (i === 0 && j === loop.length - 1)) continue;
        if (intersects(a, b, loop[j], loop[(j + 1) % loop.length])) return "Boundary edges cannot cross or touch.";
      }
    }
    if (Math.abs(area) <= EPS) return "The boundary must enclose an area.";
  }
  for (let h = 1; h < loops.length; h++) {
    if (!inside(loops[h][0], loops[0])) return "Holes must stay inside the outer boundary.";
    for (let k = 0; k < h; k++) {
      for (let i = 0; i < loops[h].length; i++) for (let j = 0; j < loops[k].length; j++) {
        if (intersects(loops[h][i], loops[h][(i + 1) % loops[h].length], loops[k][j], loops[k][(j + 1) % loops[k].length])) return "Holes cannot touch or cross another boundary.";
      }
      if (k > 0 && (inside(loops[h][0], loops[k]) || inside(loops[k][0], loops[h]))) return "Holes cannot overlap or contain one another.";
    }
  }
  return null;
}
export function slabBoundaryLoops(slab: LayoutSlab): BoundaryLoops {
  return [slab.boundary?.length ? slab.boundary : [
    { xMm: slab.minXmm, yMm: slab.minYmm }, { xMm: slab.maxXmm, yMm: slab.minYmm },
    { xMm: slab.maxXmm, yMm: slab.maxYmm }, { xMm: slab.minXmm, yMm: slab.maxYmm },
  ], ...(slab.holes ?? [])].map(loop => loop.map(p => ({ ...p })));
}
export function projectToEdge(p: BoundaryPoint, a: BoundaryPoint, b: BoundaryPoint): BoundaryPoint {
  const dx = b.xMm - a.xMm, dy = b.yMm - a.yMm;
  const t = ((p.xMm - a.xMm) * dx + (p.yMm - a.yMm) * dy) / (dx * dx + dy * dy);
  return { xMm: a.xMm + t * dx, yMm: a.yMm + t * dy };
}
export function moveBoundaryEdge(loops: BoundaryLoops, ring: number, edge: number, from: BoundaryPoint, to: BoundaryPoint): BoundaryLoops {
  const result = loops.map(loop => loop.map(p => ({ ...p })));
  const loop = result[ring], a = loop[edge], b = loop[(edge + 1) % loop.length];
  const dx = b.xMm - a.xMm, dy = b.yMm - a.yMm;
  const scale = ((to.xMm - from.xMm) * -dy + (to.yMm - from.yMm) * dx) / (dx * dx + dy * dy);
  for (const p of [a, b]) { p.xMm -= dy * scale; p.yMm += dx * scale; }
  return result;
}

/** Join two supporting lines, retaining the chain indicated by both clicked portions. */
export function trimBoundaryCorner(loop: BoundaryPoint[], first: number, firstPick: BoundaryPoint, second: number, secondPick: BoundaryPoint): BoundaryPoint[] | null {
  if (first === second) return null;
  const a = loop[first], b = loop[(first + 1) % loop.length], c = loop[second], d = loop[(second + 1) % loop.length];
  const rx = b.xMm - a.xMm, ry = b.yMm - a.yMm, sx = d.xMm - c.xMm, sy = d.yMm - c.yMm;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) <= 1e-9 * Math.hypot(rx, ry) * Math.hypot(sx, sy)) return null;
  const t = ((c.xMm - a.xMm) * sy - (c.yMm - a.yMm) * sx) / den;
  const p = { xMm: a.xMm + t * rx, yMm: a.yMm + t * ry };
  const sameSide = (endpoint: BoundaryPoint, pick: BoundaryPoint) =>
    (endpoint.xMm - p.xMm) * (pick.xMm - p.xMm) + (endpoint.yMm - p.yMm) * (pick.yMm - p.yMm) > EPS;
  for (const [start, end, keepStart, pickStart, keepEnd, pickEnd] of [
    [first, second, b, firstPick, c, secondPick], [second, first, d, secondPick, a, firstPick],
  ] as const) {
    if (!sameSide(keepStart, pickStart) || !sameSide(keepEnd, pickEnd) ||
      !on(p, keepStart, projectToEdge(pickStart, p, keepStart)) ||
      !on(p, keepEnd, projectToEdge(pickEnd, p, keepEnd))) continue;
    const result = [{ ...p }];
    for (let i = (start + 1) % loop.length; ; i = (i + 1) % loop.length) {
      if (distance(loop[i], p) > EPS) result.push({ ...loop[i] });
      if (i === end) break;
    }
    if (!validateBoundary([result])) {
      // Joining an already closed adjacent corner must not rotate the vertex
      // indices: roof slope settings are keyed by their boundary edge index.
      if (result.length === loop.length) {
        const origin = result.findIndex(vertex => distance(vertex, loop[0]) <= EPS);
        if (origin > 0) return [...result.slice(origin), ...result.slice(0, origin)];
      }
      return result;
    }
  }
  return null;
}
