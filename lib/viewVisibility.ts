import type { Object3D } from "three";
import { objectCategory } from "./planView";
import type { ViewVisibility } from "../store/useViewDisplayStore";

export function objectElementId(data: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(data)) {
    if ((/^layout.*Id$/.test(key) || key === "markupId") && typeof value === "string") return value;
  }
  return typeof data.expressID === "number" ? `ifc:${data.expressID}`
    : typeof data.expressId === "number" ? `ifc:${data.expressId}` : null;
}

/** Apply for one draw call, then restore so filters cannot leak across quad panes. */
export function applyViewVisibility(roots: (Object3D | null | undefined)[], visibility: ViewVisibility | undefined) {
  if (!visibility) return () => {};
  const hidden = new Set(visibility.hiddenIds);
  const categories = new Set(visibility.hiddenCategories);
  const isolated = visibility.isolatedIds ? new Set(visibility.isolatedIds) : null;
  const restore: Object3D[] = [];
  for (const root of roots) root?.traverse(obj => {
    if (!obj.visible) return;
    const id = objectElementId(obj.userData);
    const category = objectCategory(obj.userData);
    if ((category && categories.has(category)) || (id && (hidden.has(id) || (isolated && !isolated.has(id))))) {
      obj.visible = false;
      restore.push(obj);
    }
  });
  return () => { for (const obj of restore) obj.visible = true; };
}

export function isObjectVisibleInView(object: Object3D, visibility: ViewVisibility | undefined): boolean {
  for (let obj: Object3D | null = object; obj; obj = obj.parent) {
    if (!obj.visible) return false;
    if (!visibility) continue;
    const id = objectElementId(obj.userData);
    const category = objectCategory(obj.userData);
    if (category && visibility.hiddenCategories.includes(category)) return false;
    if (id && (visibility.hiddenIds.includes(id) || (visibility.isolatedIds && !visibility.isolatedIds.includes(id)))) return false;
  }
  return true;
}

export function applyRenderPresentation(roots: (Object3D | null | undefined)[], enabled: boolean) {
  if (!enabled) return () => {};
  const restore: Object3D[] = [];
  for (const root of roots) root?.traverse(obj => {
    if (obj.visible && (obj.name === "3d-grid" || obj.name === "3d-axes" ||
      /^layout-(.*preview|sketch-lines|wall-endpoints|workplane-group|section-group|selection-outline)$/.test(obj.name) ||
      obj.userData.isLayoutGround || obj.userData.isLayoutLevelSlab || obj.userData.layoutGridLineId ||
      obj.userData.isSelectionOutline || obj.type === "TransformControlsRoot")) {
      obj.visible = false; restore.push(obj);
    }
  });
  return () => { for (const obj of restore) obj.visible = true; };
}
