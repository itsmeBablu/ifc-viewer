import { z } from "zod";
import type { AiAction } from "../schema";
import { allocateResidential } from "./allocation";
import { residentialOptions } from "./brief";
import { allocateBuilding, applyFootprint } from "./footprint";
import { furnishFloor } from "./furnishing";

export const apartmentSchema = z.object({
  kind: z.literal("apartment_layout"), id: z.string().min(1).max(100), levelId: z.string().min(1),
  bedrooms: z.number().int().min(1).max(6).default(2),
  bedroomAreaM2: z.number().min(7.5).max(100).default(20),
  livingAreaM2: z.number().min(10).max(300).optional(), kitchenAreaM2: z.number().min(6).max(300).optional(), bathroomAreaM2: z.number().min(4).max(300).optional(),
  totalAreaM2: z.number().min(30).max(2000).optional().describe("Total gross internal area measured inside perimeter walls, including partitions. Code holds bedroom area fixed and balances shared spaces; rejects infeasible totals."),
  xMm: z.number().min(-900000).max(900000).default(0), yMm: z.number().min(-900000).max(900000).default(0),
  heightMm: z.number().min(2400).max(6000).default(3000),
  thicknessMm: z.number().min(100).max(500).default(200),
  ...residentialOptions,
}).strict().describe("Furnished concept apartment: 1–6 bedrooms (default 20 m² clear each), 1.2 m corridor, living/open kitchen, 8 m² bathroom, slab, doors/windows. Code computes geometry. Optional footprint rectangle/l/u/drawn, widthM/lengthM (internal spans), normalized footprintPoints for drawn. Fixed room areas preserved; extra wings are open living. Optional underfloorHeating, piping none/underfloor/ceiling, ducts none/ceiling. furnished false omits furniture. No roof. IDs id:wall:0 onwards for automatic rectangle only.");

export function apartmentActions(item: z.infer<typeof apartmentSchema>, options: { allocation?: ReturnType<typeof allocateResidential>; entrance?: boolean } = {}): AiAction[] {
  const building = options.allocation ? null : allocateBuilding({ ...item, variant: "apartment" }, item.heightMm, item.thicknessMm);
  const original = item;
  if (building?.block) item = { ...item, xMm:item.xMm+building.block.xMm-item.thicknessMm/2,yMm:item.yMm+building.block.yMm-item.thicknessMm/2 };
  const actions: AiAction[] = [];
  const allocation = options.allocation ?? building!.allocation;
  const t = item.thicknessMm, p = 150, roomW = allocation.roomWidthMm;
  const { bays, widthMm: w, depthMm: d, bedroomEndMm: bedroomEnd, corridorEndMm: corridorEnd, bathroomWidthMm } = allocation;
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
  for (let i = 0; i < bays; i++) {
    const start = t / 2 + i * (roomW + p);
    door(bedrooms, start + roomW / 2);
    window(front, start + roomW / 2);
    if (i) wall(start - p / 2, 0, start - p / 2, bedroomEnd);
  }
  // Group the bathroom beside the open kitchen/living zone, accessed from the corridor.
  const bathroomEnd = corridorEnd + p / 2 + allocation.bathroomDepthMm + p / 2;
  wall(t / 2 + bathroomWidthMm + p / 2, corridorEnd, t / 2 + bathroomWidthMm + p / 2, allocation.bathroomEnclosed ? bathroomEnd : d);
  if (allocation.bathroomEnclosed) wall(0, bathroomEnd, t / 2 + bathroomWidthMm + p / 2, bathroomEnd);
  door(living, t / 2 + bathroomWidthMm / 2);
  door(living, w - t / 2 - 1000);
  if (options.entrance !== false) door(entry, d - (bedroomEnd + corridorEnd) / 2);
  window(entry, d - (corridorEnd + p / 2 + allocation.bathroomDepthMm / 2));
  window(rear, (w - t - bathroomWidthMm - p) / 2 + t / 2);
  actions.push({ kind: "floor", operation: "create", id: `${item.id}:floor`, levelId: item.levelId, boundary: [{ xMm: item.xMm-t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm+d+t/2 }, { xMm: item.xMm-t/2, yMm: item.yMm+d+t/2 }], thicknessMm: 200, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0 });
  actions.push(...furnishFloor({ ...item, variant: "apartment" },allocation,item.id,item.levelId,item.xMm,item.yMm,t,item.heightMm,item.bedrooms));
  return building?.polygon ? applyFootprint(actions,building.polygon,original.xMm,original.yMm,t,item.heightMm,item.levelId,item.id) : actions;
}
