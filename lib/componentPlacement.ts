import * as THREE from "three";
import type { LayoutLevel, LayoutMepEquipment, LayoutWall } from "./layoutDrawing";

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
