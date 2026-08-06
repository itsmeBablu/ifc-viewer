/**
 * Markup length units — scene uses metres; UI shows millimetres (IFC/European).
 * If a future loader exposes IfcProject length scale, setSceneMetresPerUnit().
 */

import * as THREE from "three";

let sceneMetresPerUnit = 1;

export function setSceneMetresPerUnit(metres: number): void {
  if (metres > 0 && Number.isFinite(metres)) sceneMetresPerUnit = metres;
}

export function getSceneMetresPerUnit(): number {
  return sceneMetresPerUnit;
}

/** Scene units → millimetres for display/input. */
export function toMm(scene: number): number {
  return scene * sceneMetresPerUnit * 1000;
}

/** Millimetres → scene units. */
export function fromMm(mm: number): number {
  return mm / (sceneMetresPerUnit * 1000);
}

export function formatMm(scene: number, digits = 0): string {
  const mm = toMm(scene);
  return `${mm.toFixed(digits)} mm`;
}

/** Round distance (scene metres) to nearest CAD-friendly mm step. */
export const DISTANCE_SNAP_MM = [50, 100, 150, 200, 250, 300, 500, 1000] as const;

export function snapDistanceScene(
  distanceScene: number,
  thresholdMm = 25,
): number | null {
  const distMm = toMm(distanceScene);
  let best: number | null = null;
  let bestDelta = thresholdMm;
  for (const step of DISTANCE_SNAP_MM) {
    const d = Math.abs(distMm - step);
    if (d < bestDelta) {
      bestDelta = d;
      best = step;
    }
  }
  return best != null ? fromMm(best) : null;
}

/**
 * Align dragged AABB to nearby target AABB edges/centers (X/Z plan axes).
 * Returns adjusted center position or null.
 */
export function snapToNearbyAabb(
  moving: THREE.Box3,
  targets: THREE.Box3[],
  thresholdScene = 0.08,
): THREE.Vector3 | null {
  const c = moving.getCenter(new THREE.Vector3());
  const size = moving.getSize(new THREE.Vector3());
  let bestDx = 0;
  let bestDz = 0;
  let bestScore = thresholdScene;
  let hit = false;

  const movingEdgesX = [
    moving.min.x,
    c.x,
    moving.max.x,
  ];
  const movingEdgesZ = [
    moving.min.z,
    c.z,
    moving.max.z,
  ];

  for (const t of targets) {
    if (t.isEmpty()) continue;
    const tc = t.getCenter(new THREE.Vector3());
    const tEdgesX = [t.min.x, tc.x, t.max.x];
    const tEdgesZ = [t.min.z, tc.z, t.max.z];
    for (const mx of movingEdgesX) {
      for (const tx of tEdgesX) {
        const d = Math.abs(mx - tx);
        if (d < bestScore) {
          bestScore = d;
          bestDx = tx - mx;
          hit = true;
        }
      }
    }
    for (const mz of movingEdgesZ) {
      for (const tz of tEdgesZ) {
        const d = Math.abs(mz - tz);
        if (d < bestScore) {
          bestScore = d;
          bestDz = tz - mz;
          hit = true;
        }
      }
    }
    // Distance snap along X between facing faces
    const gapX = Math.min(
      Math.abs(moving.min.x - t.max.x),
      Math.abs(moving.max.x - t.min.x),
    );
    const snappedGap = snapDistanceScene(gapX, 30);
    if (snappedGap != null) {
      const towardRight = c.x >= tc.x;
      const desired =
        towardRight
          ? t.max.x + snappedGap + size.x / 2
          : t.min.x - snappedGap - size.x / 2;
      const d = Math.abs(desired - c.x);
      if (d < Math.max(thresholdScene * 2, 0.12)) {
        bestDx = desired - c.x;
        hit = true;
      }
    }
  }

  if (!hit) return null;
  return new THREE.Vector3(c.x + bestDx, c.y, c.z + bestDz);
}

