import * as THREE from "three";
import type { LayoutLevel, LayoutMepEquipment, LayoutWall } from "./layoutDrawing";
import { alignmentTransform, type GeometryReference } from "./modifySelection";

/** Orient the cabinet front away from the nearest straight wall, then use Align's
 * face-plane transform on the back face. Abutment is measured along that wall,
 * never in world-axis bounding boxes (which fail for rotated kitchen runs).
 */
export function alignKitchenPlacement(item: Partial<LayoutMepEquipment> & { xMm: number; yMm: number; levelId: string }, walls: LayoutWall[], neighbours: LayoutMepEquipment[], toleranceMm = 300) {
  if (!item.familyId?.startsWith("kitchen-") || item.familyId === "kitchen-island" || item.familyId === "kitchen-l") return null;
  const width = item.widthMm ?? 600, depth = item.depthMm ?? 600;
  let best: { xMm: number; yMm: number; rotationDeg: number; kitchenWallId: string; distance: number } | null = null;
  for (const wall of walls) {
    if (wall.levelId !== item.levelId || wall.curved) continue;
    const dx = wall.endXmm - wall.startXmm, dz = wall.endYmm - wall.startYmm, length = Math.hypot(dx, dz);
    if (length < width) continue;
    const tx = dx / length, tz = dz / length;
    const signed = (item.xMm - wall.startXmm) * -tz + (item.yMm - wall.startYmm) * tx;
    const side = Math.sign(signed) || 1, nx = -tz * side, nz = tx * side;
    const distance = Math.abs(Math.abs(signed) - wall.thicknessMm / 2 - depth / 2);
    if (distance > toleranceMm || (best && distance >= best.distance)) continue;
    let along = (item.xMm - wall.startXmm) * tx + (item.yMm - wall.startYmm) * tz;
    const aligned = neighbours.filter(n => n.id !== item.id && n.levelId === item.levelId && n.kitchenWallId === wall.id && Math.abs(((n.xMm - wall.startXmm) * nx + (n.yMm - wall.startYmm) * nz) - wall.thicknessMm / 2 - (n.depthMm ?? 600) / 2) < 2 && Math.abs((n.elevationMm ?? 0) - (item.elevationMm ?? 0)) < 100);
    const occupied = aligned.map(n => ({ center: (n.xMm - wall.startXmm) * tx + (n.yMm - wall.startYmm) * tz, width: n.widthMm ?? 600 }));
    const candidates = occupied.flatMap(n => [n.center - (n.width + width) / 2, n.center + (n.width + width) / 2]).filter(c => Math.abs(c - along) <= toleranceMm).sort((a, b) => Math.abs(a - along) - Math.abs(b - along));
    const available = (c: number) => c >= width / 2 && c <= length - width / 2 && occupied.every(n => Math.abs(n.center - c) >= (n.width + width) / 2 - 1);
    const abut = candidates.find(available);
    if (abut != null) along = abut;
    if (!available(along)) continue;
    const center = new THREE.Vector3((wall.startXmm + along * tx + nx * Math.abs(signed)) / 1000, 0, (wall.startYmm + along * tz + nz * Math.abs(signed)) / 1000);
    const back = center.clone().add(new THREE.Vector3(-nx * depth / 2000, 0, -nz * depth / 2000));
    const face = (point: THREE.Vector3, normal: [number, number, number]): GeometryReference => ({ kind: "face", point: point.toArray(), normal, points: [], meshUuid: "", geometryUuid: "" });
    const reference = new THREE.Vector3((wall.startXmm + nx * wall.thicknessMm / 2) / 1000, 0, (wall.startYmm + nz * wall.thicknessMm / 2) / 1000);
    center.applyMatrix4(alignmentTransform(face(reference, [nx, 0, nz]), face(back, [-nx, 0, -nz])));
    best = { xMm: center.x * 1000, yMm: center.z * 1000, rotationDeg: Math.atan2(tz, tx) * 180 / Math.PI + (side < 0 ? 180 : 0), kitchenWallId: wall.id, distance };
  }
  return best;
}

export function componentBaseLevel(levels: LayoutLevel[], isPlan: boolean, currentLevelId: string | null, explicitLevelId: string | null) {
  if (explicitLevelId) {
    const explicit = levels.find((l) => l.id === explicitLevelId);
    if (explicit) return explicit;
  }
  if (currentLevelId) {
    const current = levels.find((l) => l.id === currentLevelId);
    if (current) return current;
  }
  return levels[0] ?? null;
}

/** Keep the wall-start end fixed and shift the contiguous downstream run on resize. */
export function reflowKitchenRun(previous: LayoutMepEquipment, updated: LayoutMepEquipment, walls: LayoutWall[], components: LayoutMepEquipment[]) {
  const delta = (updated.widthMm ?? 600) - (previous.widthMm ?? 600);
  if (!previous.kitchenWallId || Math.abs(delta) < 0.01) return [updated];
  const wall = walls.find(w => w.id === previous.kitchenWallId && w.levelId === updated.levelId && !w.curved);
  if (!wall) return [{ ...updated, kitchenWallId: undefined }];
  const length = Math.hypot(wall.endXmm - wall.startXmm, wall.endYmm - wall.startYmm);
  const tx = (wall.endXmm - wall.startXmm) / length, tz = (wall.endYmm - wall.startYmm) / length;
  const along = (e: LayoutMepEquipment) => (e.xMm - wall.startXmm) * tx + (e.yMm - wall.startYmm) * tz;
  const across = (e: LayoutMepEquipment) => -(e.xMm - wall.startXmm) * tz + (e.yMm - wall.startYmm) * tx;
  const next = { ...updated, xMm: updated.xMm + tx * delta / 2, yMm: updated.yMm + tz * delta / 2 };
  const changes = [next];
  let end = along(previous) + (previous.widthMm ?? 600) / 2;
  const candidates = components.filter(e => e.id !== previous.id && e.kitchenWallId === wall.id && Math.abs(across(e) - across(previous)) < 2 && Math.abs((e.elevationMm ?? 0) - (previous.elevationMm ?? 0)) < 100).sort((a, b) => along(a) - along(b));
  for (const candidate of candidates) {
    const left = along(candidate) - (candidate.widthMm ?? 600) / 2;
    if (Math.abs(left - end) > 2) continue;
    changes.push({ ...candidate, xMm: candidate.xMm + tx * delta, yMm: candidate.yMm + tz * delta });
    end = along(candidate) + (candidate.widthMm ?? 600) / 2;
  }
  if (changes.some(e => along(e) - (e.widthMm ?? 600) / 2 < -1 || along(e) + (e.widthMm ?? 600) / 2 > length + 1)) throw new Error("The resized kitchen run would extend beyond the wall. Reduce its cabinet count or module width.");
  const moved = new Set(changes.map(e => e.id));
  for (const e of changes) for (const other of candidates) if (!moved.has(other.id) && Math.abs(along(e) - along(other)) < ((e.widthMm ?? 600) + (other.widthMm ?? 600)) / 2 - 1) throw new Error("The resized kitchen run would overlap another unit.");
  return changes;
}

/** Align footprints, including rotation, without placing their centres inside walls. */
export function snapComponentFootprint(point: { xMm: number; yMm: number }, widthMm: number, depthMm: number, rotationDeg: number, walls: LayoutWall[], components: LayoutMepEquipment[], levelId: string, withinAperture: (candidate: { xMm: number; yMm: number }) => number) {
  const angle = rotationDeg * Math.PI / 180;
  const hx = (Math.abs(Math.cos(angle)) * widthMm + Math.abs(Math.sin(angle)) * depthMm) / 2;
  const hz = (Math.abs(Math.sin(angle)) * widthMm + Math.abs(Math.cos(angle)) * depthMm) / 2;
  const candidates: { point: { xMm: number; yMm: number }; label: string; distance: number }[] = [];
  const add = (p: typeof point, label: string) => { const distance = withinAperture(p); if (distance <= 12) candidates.push({ point: p, label, distance }); };
  for (const wall of walls) {
    if (wall.levelId !== levelId || wall.curved) continue;
    const dx = wall.endXmm - wall.startXmm, dz = wall.endYmm - wall.startYmm;
    const len = Math.hypot(dx, dz); if (len < 1) continue;
    const nx = -dz / len, nz = dx / len;
    const along = ((point.xMm - wall.startXmm) * dx + (point.yMm - wall.startYmm) * dz) / (len * len);
    if (along < 0 || along > 1) continue;
    const signed = (point.xMm - wall.startXmm) * nx + (point.yMm - wall.startYmm) * nz;
    const extent = Math.abs(nx * Math.cos(angle) + nz * Math.sin(angle)) * widthMm / 2 + Math.abs(-nx * Math.sin(angle) + nz * Math.cos(angle)) * depthMm / 2;
    const offset = (Math.sign(signed) || 1) * (wall.thicknessMm / 2 + extent) - signed;
    add({ xMm: point.xMm + offset * nx, yMm: point.yMm + offset * nz }, "Wall face");
  }
  for (const item of components) {
    if (item.levelId !== levelId) continue;
    const a = item.rotationDeg * Math.PI / 180;
    const ex = (Math.abs(Math.cos(a)) * (item.widthMm ?? 400) + Math.abs(Math.sin(a)) * (item.depthMm ?? 400)) / 2;
    const ez = (Math.abs(Math.sin(a)) * (item.widthMm ?? 400) + Math.abs(Math.cos(a)) * (item.depthMm ?? 400)) / 2;
    if (Math.abs(point.xMm - item.xMm) > hx + ex + 2000 || Math.abs(point.yMm - item.yMm) > hz + ez + 2000) continue;
    const xs = [item.xMm, item.xMm - ex - hx, item.xMm + ex + hx, item.xMm - ex + hx, item.xMm + ex - hx];
    const zs = [item.yMm, item.yMm - ez - hz, item.yMm + ez + hz, item.yMm - ez + hz, item.yMm + ez - hz];
    for (const xMm of xs) add({ xMm, yMm: point.yMm }, "Component alignment");
    for (const yMm of zs) add({ xMm: point.xMm, yMm }, "Component alignment");
    for (const xMm of xs) for (const yMm of zs) add({ xMm, yMm }, "Component corner");
  }
  candidates.sort((a, b) => (a.distance + (a.label === "Component corner" ? -2 : 0)) - (b.distance + (b.label === "Component corner" ? -2 : 0)));
  return candidates[0] ?? { point, label: "Free placement", distance: Infinity };
}

export function projectedMoveDistance(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera, width: number, height: number) {
  const pa = a.clone().project(camera), pb = b.clone().project(camera);
  return Math.hypot((pa.x - pb.x) * width / 2, (pa.y - pb.y) * height / 2);
}
