import * as THREE from "three";

export type MarkupSurfaceHit = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  object: THREE.Object3D;
  distance: number;
  /** Nearest vertex used for note snap (if any). */
  snappedVertex: THREE.Vector3 | null;
};

const _inverse = new THREE.Matrix4();
const _localNormal = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();

/** Raycast shell + placed markup meshes for a true surface hit. */
export function pickMarkupSurface(
  raycaster: THREE.Raycaster,
  roots: THREE.Object3D[],
): MarkupSurfaceHit | null {
  const targets: THREE.Object3D[] = [];
  for (const root of roots) {
    if (!root) continue;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.visible) return;
      if (o.userData.isClipStencil || o.userData.isClipCap) return;
      if (o.userData.isSelectionOutline) return;
      if (o.userData.isMarkupPreview) return;
      targets.push(o);
    });
  }
  if (!targets.length) return null;

  const hits = raycaster.intersectObjects(targets, false);
  const hit = hits[0];
  if (!hit?.point) return null;

  let normal = new THREE.Vector3(0, 1, 0);
  if (hit.face) {
    _localNormal.copy(hit.face.normal);
    _worldNormal
      .copy(_localNormal)
      .transformDirection(hit.object.matrixWorld)
      .normalize();
    normal = _worldNormal.clone();
  } else if (hit.normal) {
    normal = hit.normal.clone().normalize();
  }

  return {
    point: hit.point.clone(),
    normal,
    object: hit.object,
    distance: hit.distance,
    snappedVertex: null,
  };
}

/** Snap X/Z (and optionally Y) to a metric grid. */
export function applyGridSnap(
  point: THREE.Vector3,
  gridSize: number,
  axes: ("x" | "y" | "z")[] = ["x", "z"],
): THREE.Vector3 {
  if (gridSize <= 0) return point.clone();
  const out = point.clone();
  for (const axis of axes) {
    out[axis] = Math.round(out[axis] / gridSize) * gridSize;
  }
  return out;
}

/**
 * Find nearest vertex on a mesh (local→world) within maxDist of `point`.
 * Used for sticky-note CAD-style vertex snap.
 */
export function findNearestVertex(
  object: THREE.Object3D,
  point: THREE.Vector3,
  maxDist: number,
): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null;
  let bestD = maxDist;

  object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geom = o.geometry as THREE.BufferGeometry;
    const pos = geom?.attributes?.position;
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++) {
      _vA.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const d = _vA.distanceTo(point);
      if (d < bestD) {
        bestD = d;
        best = _vA.clone();
      }
    }
  });

  return best;
}

/** Prefer face center when closer than any vertex (good for notes on flat faces). */
export function findFaceCenterSnap(
  hit: THREE.Intersection,
  maxDist: number,
): THREE.Vector3 | null {
  if (!hit.face || !(hit.object instanceof THREE.Mesh)) return null;
  const geom = hit.object.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position;
  if (!pos) return null;
  const a = hit.face.a;
  const b = hit.face.b;
  const c = hit.face.c;
  _vA.fromBufferAttribute(pos, a);
  _vB.fromBufferAttribute(pos, b);
  _vC.fromBufferAttribute(pos, c);
  const center = new THREE.Vector3()
    .addVectors(_vA, _vB)
    .add(_vC)
    .multiplyScalar(1 / 3)
    .applyMatrix4(hit.object.matrixWorld);
  if (center.distanceTo(hit.point) <= maxDist) return center;
  return null;
}

export function enhanceHitWithVertexSnap(
  surface: MarkupSurfaceHit,
  raycaster: THREE.Raycaster,
  noteSnapRadius = 0.3,
): MarkupSurfaceHit {
  // Re-intersect this object alone to get face indices for center snap.
  const hits = raycaster.intersectObject(surface.object, true);
  const hit = hits[0];
  let snapped: THREE.Vector3 | null = null;
  if (hit) {
    snapped = findFaceCenterSnap(hit, noteSnapRadius);
  }
  if (!snapped) {
    snapped = findNearestVertex(
      surface.object,
      surface.point,
      noteSnapRadius,
    );
  }
  if (!snapped) return surface;
  return {
    ...surface,
    point: snapped,
    snappedVertex: snapped,
  };
}

void _inverse;
