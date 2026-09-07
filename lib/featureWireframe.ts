import * as THREE from "three";

// Suppress coplanar seams and small tessellation creases without losing roof folds.
export const FEATURE_EDGE_ANGLE = 12;
export function createFeatureEdges(geometry: THREE.BufferGeometry) {
  return new THREE.EdgesGeometry(geometry, FEATURE_EDGE_ANGLE);
}

const caches = new WeakMap<THREE.Mesh, { key: string; lines: THREE.LineSegments[] }>();
const featureFlag = "isFeatureWireframe";

/** Surface suppression is scoped to a render: picking and shaded materials stay intact. */
export function applyFeatureWireframe(roots: (THREE.Object3D | null | undefined)[], enabled: boolean) {
  if (!enabled) return () => {};
  const restore: (() => void)[] = [];
  const materials = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];
  for (const root of roots) root?.traverse(obj => {
    if (obj.userData[featureFlag]) return;
    if (obj.userData.isEdgeOverlay || obj.name === "quad-edges" || obj.name === "wall-plan-cut") {
      const visible = obj.visible; obj.visible = false;
      restore.push(() => { obj.visible = visible; });
    }
    if (!(obj instanceof THREE.Mesh) || !obj.geometry.getAttribute("position")) return;
    for (let parent: THREE.Object3D | null = obj; parent; parent = parent.parent) {
      const data = parent.userData;
      if (!parent.visible && !data.isWireframeEnvelope) return;
      if (data.isClipStencil || data.isClipCap || data.isSelectionOutline || data.isLayoutUnderlay || data.isLayoutGround || data.isLayoutLevelSlab || parent.name === "wall-plan-cut" || parent.name === "plan-symbol") return;
    }
    if (obj.userData.isWallLayer) {
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (materials.has(material)) continue;
        materials.add(material);
        const visible = material.visible; material.visible = false;
        restore.push(() => { material.visible = visible; });
      }
      return;
    }
    meshes.push(obj);
  });
  for (const mesh of meshes) {
    if (mesh.userData.isWireframeEnvelope) {
      const visible = mesh.visible; mesh.visible = true;
      restore.push(() => { mesh.visible = visible; });
    }
    const position = mesh.geometry.getAttribute("position");
    const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    const key = `${mesh.geometry.uuid}:${(position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position.version)}:${mesh.geometry.index?.version ?? 0}:${instances}`;
    let cached = caches.get(mesh);
    if (!cached || cached.key !== key) {
      for (const line of cached?.lines ?? []) {
        mesh.remove(line); line.geometry.dispose(); (line.material as THREE.Material).dispose();
      }
      const geometry = createFeatureEdges(mesh.geometry);
      const lines: THREE.LineSegments[] = [];
      for (let i = 0; i < instances; i++) {
        const material = new THREE.LineBasicMaterial({ color: 0x334155, depthTest: false, depthWrite: false });
        const line = new THREE.LineSegments(geometry, material);
        line.userData[featureFlag] = true;
        line.name = "feature-wireframe";
        line.visible = false;
        line.raycast = () => {};
        mesh.add(line); lines.push(line);
      }
      if (!instances) geometry.dispose();
      cached = { key, lines }; caches.set(mesh, cached);
    }
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    for (let i = 0; i < cached.lines.length; i++) {
      const line = cached.lines[i];
      if (mesh instanceof THREE.InstancedMesh) {
        mesh.getMatrixAt(i, line.matrix); line.matrixAutoUpdate = false; line.matrixWorldNeedsUpdate = true;
      }
      const material = line.material as THREE.LineBasicMaterial;
      material.clippingPlanes = source.clippingPlanes;
      material.clipIntersection = source.clipIntersection;
      const visible = line.visible; line.visible = true;
      restore.push(() => { line.visible = visible; });
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (materials.has(material)) continue;
      materials.add(material);
      const visible = material.visible;
      material.visible = false;
      restore.push(() => { material.visible = visible; });
    }
  }
  return () => { for (const undo of restore.reverse()) undo(); };
}
