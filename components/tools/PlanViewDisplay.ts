import * as THREE from "three";
import type { LayoutLevel } from "@/lib/layoutDrawing";
import { objectCategory, planViewSettings } from "@/lib/planView";

/** Scoped to one render, so plan filters cannot leak into other quad viewports. */
export function applyPlanViewDisplay(roots: (THREE.Object3D | null | undefined)[], level: LayoutLevel | undefined) {
  if (!level) return () => {};
  const settings = planViewSettings(level);
  const bottom = (level.elevationMm + settings.bottomMm) / 1000;
  const top = (level.elevationMm + settings.topMm) / 1000;
  const cut = (level.elevationMm + settings.cutMm) / 1000;
  const bottomPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -bottom);
  const topPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), top);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), cut);
  const restore: (() => void)[] = [];
  const seenMaterials = new Set<THREE.Material>();
  for (const root of roots) root?.traverse(obj => {
    const category = objectCategory(obj.userData);
    if (category && settings.hiddenCategories.includes(category)) {
      const visible = obj.visible; obj.visible = false; restore.push(() => { obj.visible = visible; });
    }
    if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Line)) return;
    let owner: THREE.Object3D | null = obj;
    let ownedCategory: string | null = category;
    while (owner && !ownedCategory) { ownedCategory = objectCategory(owner.userData); owner = owner.parent; }
    if (!ownedCategory) return;
    for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      if (seenMaterials.has(material)) continue;
      seenMaterials.add(material);
      const previous = material.clippingPlanes;
      material.clippingPlanes = [...previous ?? [], bottomPlane, topPlane, ...(ownedCategory === "Walls" || /IfcWall/i.test(ownedCategory) ? [cutPlane] : [])];
      restore.push(() => { material.clippingPlanes = previous; });
    }
  });
  return () => { for (const undo of restore.reverse()) undo(); };
}
