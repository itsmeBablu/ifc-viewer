import { z } from "zod";
import type { AiAction } from "../schema";

export const apartmentSchema = z.object({
  kind: z.literal("apartment_layout"), id: z.string().min(1).max(100), levelId: z.string().min(1),
  bedrooms: z.number().int().min(1).max(4).default(2),
  bedroomAreaM2: z.number().min(12).max(40).default(20),
  xMm: z.number().min(-900000).max(900000).default(0), yMm: z.number().min(-900000).max(900000).default(0),
  heightMm: z.number().min(2400).max(6000).default(3000),
  thicknessMm: z.number().min(100).max(500).default(200),
}).strict().describe("Complete unfurnished concept apartment: 1–4 bedrooms (default 20 m² clear each), 1.2 m corridor, living/open kitchen, 8 m² bathroom, slab, doors and windows. Code computes geometry. No roof or MEP. IDs id:wall:0 onwards. Use for routine apartment briefs without a bespoke footprint.");

export function apartmentActions(item: z.infer<typeof apartmentSchema>): AiAction[] {
  const actions: AiAction[] = [];
  const t = item.thicknessMm, p = 150, roomW = 4000, roomD = item.bedroomAreaM2 * 1e6 / roomW;
  const w = item.bedrooms * roomW + (item.bedrooms - 1) * p + t;
  const bedroomEnd = t / 2 + roomD + p / 2;
  const corridorEnd = bedroomEnd + p + 1200;
  const d = corridorEnd + p / 2 + 4000 + t / 2;
  let wallIndex = 0, openingIndex = 0;
  const wall = (x1: number, y1: number, x2: number, y2: number, thickness = p) => {
    const id = `${item.id}:wall:${wallIndex++}`;
    actions.push({ kind: "wall", operation: "create", id, levelId: item.levelId, startXmm: item.xMm + x1, startYmm: item.yMm + y1, endXmm: item.xMm + x2, endYmm: item.yMm + y2, thicknessMm: thickness, heightMm: item.heightMm });
    return id;
  };
  const door = (wallId: string, positionMm: number) => actions.push({ kind: "door", operation: "create", id: `${item.id}:door:${openingIndex++}`, wallId, positionMm, widthMm: 900, heightMm: 2100, hinge: "start", swing: 1, style: "wood" });
  const window = (wallId: string, positionMm: number) => actions.push({ kind: "window", operation: "create", id: `${item.id}:window:${openingIndex++}`, wallId, positionMm, widthMm: 1200, heightMm: 1200, sillHeightMm: 900, operationType: "casement" });
  const front = wall(0, 0, w, 0, t);
  wall(w, 0, w, d, t);
  const rear = wall(w, d, 0, d, t);
  const entry = wall(0, d, 0, 0, t);
  const bedrooms = wall(0, bedroomEnd, w, bedroomEnd);
  const living = wall(0, corridorEnd, w, corridorEnd);
  for (let i = 0; i < item.bedrooms; i++) {
    const start = t / 2 + i * (roomW + p);
    door(bedrooms, start + roomW / 2);
    window(front, start + roomW / 2);
    if (i) wall(start - p / 2, 0, start - p / 2, bedroomEnd);
  }
  // Bathroom clear dimensions 2 × 4 m, accessed directly from the corridor.
  wall(t / 2 + 2000 + p / 2, corridorEnd, t / 2 + 2000 + p / 2, d);
  door(living, t / 2 + 1000);
  door(living, w - t / 2 - 1000);
  door(entry, d - (bedroomEnd + corridorEnd) / 2);
  window(rear, 1000);
  actions.push({ kind: "floor", operation: "create", id: `${item.id}:floor`, levelId: item.levelId, boundary: [{ xMm: item.xMm-t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm+d+t/2 }, { xMm: item.xMm-t/2, yMm: item.yMm+d+t/2 }], thicknessMm: 200, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0 });
  return actions;
}
