import type { Floor } from "./types";

export type PresentationLayoutMode = "auto" | "stack" | "grid";

export type PageFormat = "a0" | "a1" | "a2" | "a3" | "a4";

export const PAGE_FORMATS: { id: PageFormat; label: string }[] = [
  { id: "a4", label: "A4" },
  { id: "a3", label: "A3" },
  { id: "a2", label: "A2" },
  { id: "a1", label: "A1" },
  { id: "a0", label: "A0" },
];

/** Auto: stack ≤4 floors, grid when ≥5. */
export function resolvePresentationLayout(
  floorCount: number,
  mode: PresentationLayoutMode,
): "stack" | "grid" {
  if (mode === "stack") return "stack";
  if (mode === "grid") return "grid";
  return floorCount >= 5 ? "grid" : "stack";
}

/**
 * Row sizes bottom→top (elevation order fills rows left→right, bottom→top).
 * 5→[3,2]  6→[3,3]  7→[4,3]  8→[4,4]  10→[4,4,2]
 */
export function gridRowSizes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 4) return [n];

  const known: Record<number, number[]> = {
    5: [3, 2],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
    9: [3, 3, 3],
    10: [4, 4, 2],
    11: [4, 4, 3],
    12: [4, 4, 4],
  };
  if (known[n]) return known[n];

  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    rows.push(Math.min(4, left));
    left -= Math.min(4, left);
  }
  // Avoid a lonely last floor: 4+1 → 3+2
  if (rows.length >= 2 && rows[rows.length - 1] === 1) {
    rows[rows.length - 2] -= 1;
    rows[rows.length - 1] = 2;
  }
  return rows;
}

export type FloorGridSlot = {
  col: number;
  row: number;
  colsInRow: number;
  maxCols: number;
};

/** One slot per floor index (0 = lowest elevation). */
export function floorGridSlots(floorCount: number): FloorGridSlot[] {
  const rows = gridRowSizes(floorCount);
  const maxCols = rows.reduce((m, c) => Math.max(m, c), 1);
  const out: FloorGridSlot[] = [];
  for (let r = 0; r < rows.length; r++) {
    const colsInRow = rows[r];
    for (let c = 0; c < colsInRow; c++) {
      out.push({ col: c, row: r, colsInRow, maxCols });
    }
  }
  return out;
}

/** Equal cell pitch between floor centers (fraction of max plan width / height). */
export const PRESENTATION_GAP_Y = 0.45;
/** Extra vertical air gap when stacking few floors (< 5). */
export const PRESENTATION_GAP_Y_STACK = 1.55;
/** Even larger gap when fewer than 4 floors (2× stack gap). */
export const PRESENTATION_GAP_Y_STACK_FEW = PRESENTATION_GAP_Y_STACK * 2;
export const PRESENTATION_GAP_X = 0.35;

export function sortFloorsByElevation(floors: Floor[]): Floor[] {
  return [...floors].sort((a, b) => a.elevation - b.elevation);
}
