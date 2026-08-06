/**
 * Camera fly/framing helpers for the 3D viewer.
 *
 * `flyTo` animates camera position + OrbitControls target via GSAP
 * (see gsapMotion.flyToProgress); `frameBoundingBox`/`frameBoundingBoxOrtho`
 * compute a camera pose that frames a world-space box for perspective and
 * orthographic (plan view) cameras respectively.
 */
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { flyToProgress } from "./gsapMotion";

/**
 * Smoothly animate a camera + OrbitControls target over `duration` ms (GSAP).
 */
export function flyTo(
  camera: THREE.Camera,
  controls: OrbitControls,
  targetPosition: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  duration = 800,
): Promise<void> {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();

  return new Promise((resolve) => {
    flyToProgress(
      duration,
      (t) => {
        camera.position.lerpVectors(startPos, targetPosition, t);
        controls.target.lerpVectors(startTarget, targetLookAt, t);
        controls.update();
      },
      resolve,
    );
  });
}

/** Compute a perspective camera pose that frames a world-space bounding box. */
export function frameBoundingBox(
  box: THREE.Box3,
  camera: THREE.PerspectiveCamera,
  padding = 1.35,
  options?: {
    /**
     * Keep this view direction (camera − target). When omitted, uses a fixed
     * isometric direction (presentation / default framing).
     */
    keepDirection?: THREE.Vector3;
  },
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fov = (camera.fov * Math.PI) / 180;
  let distance = (maxDim / (2 * Math.tan(fov / 2))) * padding;
  distance = Math.max(distance, maxDim * 0.8);

  const direction = options?.keepDirection?.clone() ?? new THREE.Vector3(1, 0.75, 1);
  if (direction.lengthSq() < 1e-10) {
    direction.set(1, 0.75, 1);
  }
  direction.normalize();
  const position = center.clone().add(direction.multiplyScalar(distance));

  return { position, target: center };
}

/** Top-down orthographic framing for the plan view. */
export function frameBoundingBoxOrtho(
  box: THREE.Box3,
  camera: THREE.OrthographicCamera,
  padding = 1.2,
): { position: THREE.Vector3; target: THREE.Vector3; zoom: number } {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = camera.top - camera.bottom;
  const width = camera.right - camera.left;
  const zoomX = width / Math.max(size.x * padding, 1);
  const zoomY = height / Math.max(size.z * padding, 1);
  const zoom = Math.min(zoomX, zoomY);

  const position = new THREE.Vector3(center.x, center.y + Math.max(size.y, 10) + 50, center.z);

  return { position, target: center.clone(), zoom };
}
