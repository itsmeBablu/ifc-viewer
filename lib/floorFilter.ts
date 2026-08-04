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

/** Normalize storey labels for duplicate matching (EG / Erdgeschoss, 1. OG, …). */
export function normalizeFloorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/obergeschoss(es)?/g, "og")
    .replace(/untergeschoss(es)?/g, "ug")
    .replace(/erdgeschoss(es)?|parterre|ground\s*floor/g, "eg")
    .replace(/dachgeschoss|attic/g, "dg")
    .replace(/geschoss|storey|story|level|ebene/g, "")
    .replace(/[._\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge IFC storeys that are the same logical floor (rooms on Aggregates storey,
 * walls/doors/windows on ContainedIn storey). Remaps room + shell floorIds.
 */
export function mergeDuplicateFloors<
  TShell extends { floorId: string },
>(
  floors: Floor[],
  rooms: Room[],
  shellPieces: TShell[],
  elevTol = 0.65,
): Floor[] {
  if (floors.length <= 1) return floors;

  const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
  const clusters: Floor[][] = [];

  for (const f of sorted) {
    if (isIgnoredFloorName(f.name)) {
      clusters.push([f]);
      continue;
    }
    let placed = false;
    for (const cluster of clusters) {
      const head = cluster[0]!;
      if (isIgnoredFloorName(head.name)) continue;
      const elevClose = Math.abs(head.elevation - f.elevation) <= elevTol;
      const nameClose =
        normalizeFloorName(head.name) === normalizeFloorName(f.name) &&
        normalizeFloorName(head.name).length > 0;
      const headHasRooms = rooms.some((r) => r.floorId === head.id);
      const fHasRooms = rooms.some((r) => r.floorId === f.id);
      const headHasShell = shellPieces.some((p) => p.floorId === head.id);
      const fHasShell = shellPieces.some((p) => p.floorId === f.id);
      // Rooms storey + shell-only storey at nearly the same height → one floor.
      const complementary =
        Math.abs(head.elevation - f.elevation) <= elevTol * 2.5 &&
        ((headHasRooms && !fHasRooms && fHasShell) ||
          (fHasRooms && !headHasRooms && headHasShell));
      if (
        elevClose ||
        (nameClose && Math.abs(head.elevation - f.elevation) <= elevTol * 2) ||
        complementary
      ) {
        cluster.push(f);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([f]);
  }

  const remap = new Map<string, string>();
  const kept: Floor[] = [];

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      kept.push(cluster[0]!);
      remap.set(cluster[0]!.id, cluster[0]!.id);
      continue;
    }
    // Prefer the storey that already has rooms; else lowest elevation; else first.
    const withRooms = cluster.find((f) =>
      rooms.some((r) => r.floorId === f.id),
    );
    const canonical =
      withRooms ??
      [...cluster].sort((a, b) => a.elevation - b.elevation)[0]!;
    // Prefer a human storey name that isn't a GUID-looking id.
    const named =
      cluster.find(
        (f) =>
          f === canonical ||
          (/[a-zäöü]/i.test(f.name) && f.name.length > 2),
      ) ?? canonical;
    const merged: Floor = {
      ...canonical,
      name: named.name || canonical.name,
      elevation: Math.min(...cluster.map((f) => f.elevation)),
    };
    kept.push(merged);
    for (const f of cluster) remap.set(f.id, merged.id);
  }

  for (const room of rooms) {
    room.floorId = remap.get(room.floorId) ?? room.floorId;
  }
  for (const piece of shellPieces) {
    piece.floorId = remap.get(piece.floorId) ?? piece.floorId;
  }

  return kept.sort((a, b) => a.elevation - b.elevation);
}

/**
 * Keep walls/doors/windows on their storey; move ceiling / upper slabs to the
 * next storey so each floor shows bottom slab + enclosure together.
 */
export function reassignUpperSlabsToNextFloor<
  TShell extends { floorId: string; geom: { boundingBox?: { min: { y: number }; max: { y: number } } | null }; computeBoundingBox?: () => void },
>(
  floors: Floor[],
  shellPieces: TShell[],
  isSlabLike: (piece: TShell) => boolean,
): void {
  const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
  if (sorted.length < 2) return;

  const byId = new Map(sorted.map((f) => [f.id, f]));

  for (const piece of shellPieces) {
    if (!isSlabLike(piece)) continue;

    const geom = piece.geom as {
      computeBoundingBox?: () => void;
      boundingBox?: { min: { y: number }; max: { y: number } } | null;
    };
    geom.computeBoundingBox?.();
    const box = geom.boundingBox;
    if (!box) continue;

    const yBottom = box.min.y;
    const yMid = (box.min.y + box.max.y) * 0.5;
    const cur = byId.get(piece.floorId);
    if (!cur) continue;
    const idx = sorted.findIndex((f) => f.id === cur.id);
    if (idx < 0 || idx >= sorted.length - 1) {
      // Still snap orphan slabs to nearest storey elevation.
      let best = sorted[0]!;
      let bestDist = Math.abs(best.elevation - yBottom);
      for (const f of sorted) {
        const d = Math.abs(f.elevation - yBottom);
        if (d < bestDist) {
          bestDist = d;
          best = f;
        }
      }
      if (bestDist < 1.25) piece.floorId = best.id;
      continue;
    }

    const next = sorted[idx + 1]!;
    const storeyH =
      cur.typicalHeight && cur.typicalHeight > 0.5
        ? cur.typicalHeight
        : Math.max(2.2, next.elevation - cur.elevation);
    const upperBand = cur.elevation + storeyH * 0.55;

    // Ceiling / top slab sits in the upper band → next floor (as its bottom).
    if (yBottom >= upperBand || yMid >= upperBand) {
      piece.floorId = next.id;
      continue;
    }

    // Walking surface: nearest elevation at or below slab bottom.
    let best = cur;
    let bestDist = Math.abs(cur.elevation - yBottom);
    for (const f of sorted) {
      const d = Math.abs(f.elevation - yBottom);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    if (bestDist < 1.25) piece.floorId = best.id;
  }
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
    .filter((f) => {
      if (isIgnoredFloorName(f.name)) return false;
      const roomCount = rooms.filter((r) => r.floorId === f.id).length;
      if (roomCount > 0) return true;
      if (!shellGroup) return false;
      let shellCount = 0;
      shellGroup.traverse((obj) => {
        if (obj.userData?.floorId === f.id) shellCount += 1;
      });
      return shellCount > 0;
    });
}

/** Drop storeys with no rooms and no shell pieces after load/merge. */
export function pruneEmptyFloors<TShell extends { floorId: string }>(
  floors: Floor[],
  rooms: Room[],
  shellPieces: TShell[],
): Floor[] {
  return floors.filter((f) => {
    if (isIgnoredFloorName(f.name)) return false;
    if (rooms.some((r) => r.floorId === f.id)) return true;
    return shellPieces.some((p) => p.floorId === f.id);
  });
}
