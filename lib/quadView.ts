/**
 * Quad-view (2×2) helpers for Werkzeug — scissor layout, poses, pick NDC.
 * Default CAD layout: Top | 3D / Front(N) | Side(O).
 */

import * as THREE from "three";
import type { MarkupViewPreset } from "@/lib/toolMarkup";

export const QUAD_COUNT = 4;

/** Top-left, Top-right, Bottom-left, Bottom-right */
export type QuadIndex = 0 | 1 | 2 | 3;

export const DEFAULT_QUAD_PRESETS: [
  MarkupViewPreset,
  MarkupViewPreset,
  MarkupViewPreset,
  MarkupViewPreset,
] = ["top", "free", "north", "east"];

export type QuadSlotPose = {
  preset: MarkupViewPreset;
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  /** Ortho half-height (world units) — frustum top = this when zoom=1 conceptually */
  frustum: number;
};

export function createDefaultQuadSlots(
  presets: MarkupViewPreset[] = DEFAULT_QUAD_PRESETS,
): QuadSlotPose[] {
  return presets.map((preset) => ({
    preset,
    position: new THREE.Vector3(20, 20, 20),
    target: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    frustum: 20,
  }));
}

/** CSS/client space: TL=0, TR=1, BL=2, BR=3 */
export function quadIndexFromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): QuadIndex {
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;
  const right = clientX >= midX;
  const bottom = clientY >= midY;
  if (!right && !bottom) return 0;
  if (right && !bottom) return 1;
  if (!right && bottom) return 2;
  return 3;
}

/** Pixel rect in WebGL coords (origin bottom-left) for a quadrant. */
export function quadWebGLRect(
  index: QuadIndex,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const w = Math.floor(width / 2);
  const h = Math.floor(height / 2);
  const x = index === 1 || index === 3 ? width - w : 0;
  const y = index === 0 || index === 1 ? height - h : 0;
  return { x, y, w, h };
}

/** CSS pixel rect (origin top-left) for overlay positioning. */
export function quadCssRect(
  index: QuadIndex,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const w = width / 2;
  const h = height / 2;
  const left = index === 1 || index === 3 ? w : 0;
  const top = index === 2 || index === 3 ? h : 0;
  return { left, top, width: w, height: h };
}

/** NDC relative to a CSS quadrant rect (not the full canvas). */
export function ndcInQuad(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  index: QuadIndex,
  out = new THREE.Vector2(),
): THREE.Vector2 {
  const css = quadCssRect(index, canvasRect.width, canvasRect.height);
  const left = canvasRect.left + css.left;
  const top = canvasRect.top + css.top;
  out.x = ((clientX - left) / Math.max(1, css.width)) * 2 - 1;
  out.y = -((clientY - top) / Math.max(1, css.height)) * 2 + 1;
  return out;
}

/**
 * Pose a slot from a world bounding box (same logic as Viewer3D applyPreset).
 * `fill` ~0.65 → element fills ~65% of frame when used with fit padding.
 */
export function poseSlotFromBox(
  slot: QuadSlotPose,
  box: THREE.Box3,
  preset: MarkupViewPreset,
  padding = 1.35,
): void {
  slot.preset = preset;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 8);
  const dist = span * padding;
  const eyeY = center.y + size.y * 0.2;
  slot.target.copy(center);
  slot.frustum = Math.max(span * 1.15, 8);

  if (preset === "free") {
    slot.up.set(0, 1, 0);
    slot.position.set(
      center.x + dist * 0.7,
      center.y + dist * 0.55,
      center.z + dist * 0.7,
    );
    return;
  }
  if (preset === "top") {
    slot.up.set(0, 0, -1);
    slot.position.set(center.x, center.y + dist, center.z + 0.001);
    return;
  }
  slot.up.set(0, 1, 0);
  if (preset === "north") {
    slot.position.set(center.x, eyeY, center.z + dist);
  } else if (preset === "south") {
    slot.position.set(center.x, eyeY, center.z - dist);
  } else if (preset === "east") {
    slot.position.set(center.x + dist, eyeY, center.z);
  } else {
    slot.position.set(center.x - dist, eyeY, center.z);
  }
}

/**
 * Keep Top / N / S / O / W as true CAD absolute views: camera stays on a fixed
 * world axis looking at target (pan moves target; zoom changes frustum).
 */
export function constrainAbsoluteOrthoSlot(slot: QuadSlotPose): void {
  if (slot.preset === "free") return;
  const t = slot.target;
  const dist = Math.max(slot.position.distanceTo(t), 1);
  if (slot.preset === "top") {
    slot.up.set(0, 0, -1);
    slot.position.set(t.x, t.y + dist, t.z + 0.001);
    return;
  }
  slot.up.set(0, 1, 0);
  if (slot.preset === "north") {
    slot.position.set(t.x, t.y, t.z + dist);
  } else if (slot.preset === "south") {
    slot.position.set(t.x, t.y, t.z - dist);
  } else if (slot.preset === "east") {
    slot.position.set(t.x + dist, t.y, t.z);
  } else {
    slot.position.set(t.x - dist, t.y, t.z);
  }
}

export function isAbsoluteOrthoPreset(preset: MarkupViewPreset): boolean {
  return preset !== "free";
}

/** Reframe slot on box while keeping view direction / preset. */
export function fitSlotToBox(
  slot: QuadSlotPose,
  box: THREE.Box3,
  fill = 0.65,
): void {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.5);
  const padding = 1 / Math.max(0.35, Math.min(0.95, fill));

  if (slot.preset === "free") {
    const dir = slot.position.clone().sub(slot.target);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0.75, 1);
    dir.normalize();
    const maxDim = span;
    const distance = Math.max(maxDim * padding * 1.2, maxDim * 0.8);
    slot.target.copy(center);
    slot.position.copy(center).add(dir.multiplyScalar(distance));
    slot.up.set(0, 1, 0);
    return;
  }

  // Absolute ortho: re-center on box and snap to fixed axis.
  slot.target.copy(center);
  if (slot.preset === "top") {
    slot.frustum = Math.max(size.x, size.z, 1) * padding;
  } else if (slot.preset === "north" || slot.preset === "south") {
    slot.frustum = Math.max(size.x, size.y, 1) * padding;
  } else {
    slot.frustum = Math.max(size.z, size.y, 1) * padding;
  }
  const dist = Math.max(span * 1.35, 4);
  slot.position.copy(center); // constrainAbsolute sets axis offset
  if (slot.preset === "top") {
    slot.position.set(center.x, center.y + dist, center.z + 0.001);
  } else if (slot.preset === "north") {
    slot.position.set(center.x, center.y, center.z + dist);
  } else if (slot.preset === "south") {
    slot.position.set(center.x, center.y, center.z - dist);
  } else if (slot.preset === "east") {
    slot.position.set(center.x + dist, center.y, center.z);
  } else {
    slot.position.set(center.x - dist, center.y, center.z);
  }
  constrainAbsoluteOrthoSlot(slot);
}

/** Apply slot pose onto shared persp/ortho cameras; returns the camera to render. */
export function applySlotToCameras(
  slot: QuadSlotPose,
  aspect: number,
  persp: THREE.PerspectiveCamera,
  ortho: THREE.OrthographicCamera,
): THREE.Camera {
  if (slot.preset === "free") {
    persp.position.copy(slot.position);
    persp.up.copy(slot.up);
    persp.lookAt(slot.target);
    persp.aspect = Math.max(0.05, aspect);
    persp.near = 0.1;
    persp.far = 5000;
    persp.updateProjectionMatrix();
    return persp;
  }
  const frustum = Math.max(slot.frustum, 1);
  ortho.zoom = 1;
  ortho.left = (-frustum * aspect) / 2;
  ortho.right = (frustum * aspect) / 2;
  ortho.top = frustum / 2;
  ortho.bottom = -frustum / 2;
  ortho.near = 0.1;
  ortho.far = 5000;
  ortho.position.copy(slot.position);
  ortho.up.copy(slot.up);
  ortho.lookAt(slot.target);
  ortho.updateProjectionMatrix();
  return ortho;
}

/** Write live camera + controls target back into a slot. */
export function captureSlotFromCamera(
  slot: QuadSlotPose,
  camera: THREE.Camera,
  target: THREE.Vector3,
): void {
  slot.position.copy(camera.position);
  slot.target.copy(target);
  slot.up.copy(camera.up);
  if (camera instanceof THREE.OrthographicCamera) {
    const zoom = Math.max(camera.zoom, 1e-6);
    // Visible world height = (top-bottom)/zoom; we store that as frustum.
    slot.frustum = Math.max((camera.top - camera.bottom) / zoom, 1);
  }
  constrainAbsoluteOrthoSlot(slot);
}
