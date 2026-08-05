import * as THREE from "three";

/**
 * Element outlines for the Werkzeug view.
 *
 * Desktop IFC viewers draw a thin dark line on every element silhouette — it is
 * what makes a model read as building geometry rather than coloured blobs.
 * Lines are attached as children of their element so they inherit `visible`
 * from the structure-tree toggles for free.
 */

export type EdgeOverlayOptions = {
  /** Skip the overlay entirely past this many meshes (perf guard). */
  maxMeshes?: number;
  color?: number;
  /** Only crease angles above this (degrees) become lines. */
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
    maxMeshes = 3500,
    color = 0x39404a,
    thresholdAngle = 24,
    chunkSize = 220,
  } = options;

  // Opaque so the lines stay out of the transparency sort, with a polygon
  // offset pulling them off the surface they trace instead of z-fighting it.
  const material = new THREE.LineBasicMaterial({
    color,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const created: THREE.LineSegments[] = [];
  let frame = 0;
  let disposed = false;

  const targets: THREE.Mesh[] = [];
  root?.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (isEdgeOverlay(obj)) return;
    if (obj.userData.isClipStencil || obj.userData.isClipCap) return;
    if (!obj.geometry?.attributes?.position) return;
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

  if (!targets.length || targets.length > maxMeshes) {
    // Nothing to do, or too heavy to be worth the draw calls.
    material.dispose();
    return { dispose: () => {} };
  }

  let index = 0;
  const step = () => {
    if (disposed) return;
    const end = Math.min(index + chunkSize, targets.length);
    for (; index < end; index++) {
      const mesh = targets[index];
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
      // Outlines must never win a pick or steal the element's selection.
      line.raycast = () => {};
      mesh.add(line);
      created.push(line);
    }

    if (index < targets.length) {
      frame = requestAnimationFrame(step);
    } else {
      frame = 0;
    }
  };

  frame = requestAnimationFrame(step);

  return { dispose };
}
