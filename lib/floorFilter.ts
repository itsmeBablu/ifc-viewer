import type * as THREE from "three";
import type { Floor, Room } from "./types";

/**
 * Reference / plan storeys (e.g. Unterkante Rohdecke, Oberkante Decke, roof plan).
 * UKRD is listed before OKD so names ending in UKRD are not mis-matched as OKD.
 */
const IGNORED_FLOOR_NAME_SUFFIX = /(UKRD|OKD|Dachaufsicht)\s*$/i;

export function isIgnoredFloorName(name: string): boolean {
  return IGNORED_FLOOR_NAME_SUFFIX.test(name.trim());
}

export function floorHasElements(
  floorId: string,
  rooms: Room[],
  shellGroup?: THREE.Object3D | null,
): boolean {
  if (rooms.some((r) => r.floorId === floorId)) return true;
  if (!shellGroup) return false;
  let found = false;
  shellGroup.traverse((obj) => {
    if (found) return;
    if (obj.userData?.floorId === floorId) found = true;
  });
  return found;
}

/** Floors shown in the model left panel (and other floor pickers). */
export function listVisibleFloors(
  floors: Floor[],
  rooms: Room[],
  shellGroup?: THREE.Object3D | null,
): Floor[] {
  return [...floors]
    .sort((a, b) => a.elevation - b.elevation)
    .filter(
      (f) =>
        !isIgnoredFloorName(f.name) &&
        floorHasElements(f.id, rooms, shellGroup),
    );
}
