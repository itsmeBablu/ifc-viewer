import * as THREE from "three";
import { debugLog } from "./debugLog";

/**
 * Element outlines for the Werkzeug view.
 *
 * Thin crease lines etched on the shaded mesh (depth-tested) so the colorful
 * IFC fill stays primary — BIMvision-style, not wireframe-only.
 */

export type EdgeOverlayOptions = {
  /** Soft cap — still draws, but logs if the model is huge. */
  maxMeshes?: number;
  color?: number;
  /** Only crease angles above this (degrees) become lines. Lower = denser. */
  thresholdAngle?: number;
  /** Meshes processed per frame while building. */
  chunkSize?: number;
};

const EDGE_FLAG = "isEdgeOverlay";

export function isEdgeOverlay(obj: THREE.Object3D): boolean {
  return obj.userData?.[EDGE_FLAG] === true;
}

export type EdgeOverlayHandle = {
  dispose: () => void;
};

export function buildElementEdges(
  root: THREE.Object3D | null | undefined,
  options: EdgeOverlayOptions = {},
): EdgeOverlayHandle {
  const {
    maxMeshes = 12000,
    color = 0x000000,
    thresholdAngle = 12,
    chunkSize = 180,
  } = options;

  // Sit on the mesh surface (not floating on top) so fills stay visible.
  // polygonOffset pulls lines slightly forward without hiding the colors.
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 1,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const created: THREE.LineSegments[] = [];
  let frame = 0;
  let disposed = false;

  const targets: THREE.Mesh[] = [];
  root?.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (isEdgeOverlay(obj)) return;
    if (obj.userData.isClipStencil || obj.userData.isClipCap) return;
    if (obj.userData.isSelectionOutline) return;
    if (!obj.geometry?.attributes?.position) return;
    if (!obj.visible) return;
    targets.push(obj);
  });

  const dispose = () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    for (const line of created) {
      line.parent?.remove(line);
      line.geometry.dispose();
    }
    created.length = 0;
    material.dispose();
  };

  if (!targets.length) {
    material.dispose();
    return { dispose: () => {} };
  }

  const work = targets.length > maxMeshes ? targets.slice(0, maxMeshes) : targets;
  if (targets.length > maxMeshes) {
    debugLog(
      "ifcEdges",
      `model has ${targets.length} meshes — drawing edges on first ${maxMeshes}`,
      "warn",
    );
  } else {
    debugLog("ifcEdges", `building edges for ${work.length} mesh(es)`, "ok");
  }

  let index = 0;
  const step = () => {
    if (disposed) return;
    const end = Math.min(index + chunkSize, work.length);
    for (; index < end; index++) {
      const mesh = work[index];
      let edges: THREE.EdgesGeometry;
      try {
        edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
      } catch {
        continue;
      }
      if (!edges.attributes.position?.count) {
        edges.dispose();
        continue;
      }
      const line = new THREE.LineSegments(edges, material);
      line.userData[EDGE_FLAG] = true;
      line.renderOrder = 2;
      // Outlines must never win a pick or steal the element's selection.
      line.raycast = () => {};
      mesh.add(line);
      created.push(line);
    }

    if (index < work.length) {
      frame = requestAnimationFrame(step);
    } else {
      frame = 0;
      debugLog("ifcEdges", `edge overlay ready (${created.length} sets)`, "ok");
    }
  };

  frame = requestAnimationFrame(step);

  return { dispose };
}
