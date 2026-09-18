import { z } from "zod";
import type { AiAction } from "../schema";
import { allocateResidential } from "./allocation";
import { residentialOptions } from "./brief";
import { allocateBuilding, applyFootprint } from "./footprint";
import { furnishFloor, outdoorActions } from "./furnishing";
import { homeDetails, varyHomeLayout } from "./details";
import { bedroomBayWidths, bathroomZones } from "./rooms";

const apartmentRecipeSchema = z.object({
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

export const apartmentSchema = apartmentRecipeSchema.omit({sketches:true});

export function apartmentActions(item: z.infer<typeof apartmentSchema>, options: { allocation?: ReturnType<typeof allocateResidential>; entrance?: boolean } = {}): AiAction[] {
  const building = options.allocation ? null : allocateBuilding({ ...item, variant: "apartment" }, item.heightMm, item.thicknessMm);
  const original = item;
  if (building?.block) item = { ...item, xMm:item.xMm+building.block.xMm-item.thicknessMm/2,yMm:item.yMm+building.block.yMm-item.thicknessMm/2 };
  const actions: AiAction[] = [];
  const allocation = options.allocation ?? building!.allocation;
  const t = item.thicknessMm, p = 150, roomW = allocation.roomWidthMm;
  const { bays, widthMm: w, depthMm: d, bedroomEndMm: bedroomEnd, corridorEndMm: corridorEnd, bathroomWidthMm } = allocation;
  // Seeded subdivision: vary bay proportions while preserving the overall footprint.
  const seed = item.layoutSeed ?? 0;
  const bayWidths = bedroomBayWidths({ ...item, variant: "apartment" }, bays, roomW);
  let wallIndex = 0, openingIndex = 0;
  const wall = (x1: number, y1: number, x2: number, y2: number, thickness = p) => {
    const id = `${item.id}:wall:${wallIndex++}`;
    actions.push({ kind: "wall", operation: "create", id, levelId: item.levelId, startXmm: item.xMm + x1, startYmm: item.yMm + y1, endXmm: item.xMm + x2, endYmm: item.yMm + y2, thicknessMm: thickness, heightMm: item.heightMm });
    return id;
  };
  const door = (wallId: string, positionMm: number, style: "wood" | "metal" | "glass" | "double" | "sliding" | "garage" = "wood", widthMm = 900) => actions.push({ kind: "door", operation: "create", id: `${item.id}:door:${openingIndex++}`, wallId, positionMm, widthMm, heightMm: 2100, hinge: "start", swing: 1, style });
  const window = (wallId: string, positionMm: number) => actions.push({ kind: "window", operation: "create", id: `${item.id}:window:${openingIndex++}`, wallId, positionMm, widthMm: 1200, heightMm: 1200, sillHeightMm: 900, operationType: "casement" });
  const front = wall(0, 0, w, 0, t);
  wall(w, 0, w, d, t);
  const rear = wall(w, d, 0, d, t);
  const entry = wall(0, d, 0, 0, t);
  const bedrooms = wall(0, bedroomEnd, w, bedroomEnd);
  const living = wall(0, corridorEnd, w, corridorEnd);
  for (let i = 0; i < bays; i++) {
    const start = t / 2 + bayWidths.slice(0, i).reduce((sum, value) => sum + value + p, 0);
    const bayWidth = bayWidths[i];
    door(bedrooms, start + bayWidth / 2);
    window(front, start + bayWidth / 2);
    if (i) wall(start - p / 2, 0, start - p / 2, bedroomEnd);
  }
  // Layout arrangement varies with layoutSeed: flip bathroom & kitchen sides for genuine variety
  const flipSide = (seed % 2 === 1);
  const bathLeft = flipSide ? (w - t / 2 - bathroomWidthMm - p / 2) : (t / 2);
  const bathRight = bathLeft + bathroomWidthMm + p / 2;
  const bathroomEnd = corridorEnd + p / 2 + allocation.bathroomDepthMm + p / 2;

  // Modern plans can isolate the kitchen and give each sleeping bay a compact ensuite.
  if (item.separateKitchen) {
    const kitchenStart = flipSide ? Math.min(bathLeft - 600, 4200) : Math.max(bathRight + 600, w - 4200);
    const kitchenWall = wall(kitchenStart, corridorEnd, kitchenStart, d);
    door(kitchenWall, Math.min(1100, d - corridorEnd - 700));
  }
  if (item.ensuiteBathrooms) {
    for (let i = 0; i < bays; i++) {
      const start = t / 2 + bayWidths.slice(0, i).reduce((sum, value) => sum + value + p, 0);
      const bayWidth = bayWidths[i];
      const ensuiteW = Math.min(1800, Math.max(1400, bayWidth * .38));
      const ensuiteD = Math.min(2200, Math.max(1800, bedroomEnd - 500));
      const left = start + bayWidth - ensuiteW;
      const top = Math.max(300, bedroomEnd - ensuiteD);
      const ensuiteDoorWall = wall(left, top, start + bayWidth + (i < bays - 1 ? p / 2 : t / 2), top);
      wall(left, top, left, bedroomEnd);
      door(ensuiteDoorWall, ensuiteW / 2);
    }
  }
  // Group the bathroom beside the open kitchen/living zone, accessed from the corridor.
  wall(bathRight, corridorEnd, bathRight, allocation.bathroomEnclosed ? bathroomEnd : d);
  if (flipSide) {
    wall(bathLeft, corridorEnd, bathLeft, allocation.bathroomEnclosed ? bathroomEnd : d);
  }
  if (allocation.bathroomEnclosed) wall(bathLeft, bathroomEnd, bathRight, bathroomEnd);
  door(living, bathLeft + bathroomWidthMm / 2);
  const baths = bathroomZones({ ...item, variant: "apartment" }, bathLeft, corridorEnd + p / 2, bathroomWidthMm, allocation.bathroomDepthMm);
  for (let i = 1; i < baths.length; i++) {
    wall(bathLeft, baths[i].y - p / 2, bathRight, baths[i].y - p / 2);
    // The inner-side wall remains accessible to all bathrooms without crossing another room.
    const accessX = flipSide ? bathLeft : bathRight;
    const access = actions.find(a => a.kind === "wall" && Math.abs(a.startXmm - item.xMm - accessX) < 1 && a.startYmm === item.yMm + corridorEnd);
    if (access?.kind === "wall") door(access.id, baths[i].y - corridorEnd + baths[i].d / 2, "wood", Math.min(800, baths[i].d - 100));
  }
  door(living, flipSide ? (t / 2 + 1000) : (w - t / 2 - 1000));
  // Double door at main entry by default (1600mm wide)
  if (options.entrance !== false) door(entry, d - (bedroomEnd + corridorEnd) / 2, "double", 1600);
  window(entry, d - (corridorEnd + p / 2 + allocation.bathroomDepthMm / 2));
  window(rear, flipSide ? ((bathLeft - t) / 2 + t / 2) : ((w - bathRight) / 2 + bathRight));
  actions.push({ kind: "floor", operation: "create", id: `${item.id}:floor`, levelId: item.levelId, boundary: [{ xMm: item.xMm-t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm-t/2 }, { xMm: item.xMm+w+t/2, yMm: item.yMm+d+t/2 }, { xMm: item.xMm-t/2, yMm: item.yMm+d+t/2 }], thicknessMm: 200, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0 });
  // A usable front balcony makes the generated plan read as a complete residential project.
  // It is a separate slab with low parapet walls, so it remains editable like native CAD geometry.
  if (item.balcony !== "none") {
  const balconyDepth = 1500, balconyWidth = Math.min(7000, Math.max(4200, w * .62));
  const balconyLeft = item.xMm + (w - balconyWidth) / 2;
  const facadeY = item.balcony === "terrace" ? item.yMm + d + t / 2 : item.yMm - t / 2;
  const balconyY = facadeY + (item.balcony === "terrace" ? balconyDepth : -balconyDepth);
  actions.push({ kind: "floor", operation: "create", id: `${item.id}:balcony:floor`, levelId: item.levelId, boundary: [{ xMm: balconyLeft, yMm: Math.min(balconyY, facadeY) }, { xMm: balconyLeft + balconyWidth, yMm: Math.min(balconyY, facadeY) }, { xMm: balconyLeft + balconyWidth, yMm: Math.max(balconyY, facadeY) }, { xMm: balconyLeft, yMm: Math.max(balconyY, facadeY) }], thicknessMm: 180, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0 });
  const railHeight = 1100;
  [[balconyLeft, balconyY, balconyLeft + balconyWidth, balconyY], [balconyLeft, balconyY, balconyLeft, facadeY], [balconyLeft + balconyWidth, balconyY, balconyLeft + balconyWidth, facadeY]].forEach(([x1,y1,x2,y2], i) => actions.push({ kind: "wall", operation: "create", id: `${item.id}:balcony:rail:${i}`, levelId: item.levelId, startXmm: x1, startYmm: y1, endXmm: x2, endYmm: y2, thicknessMm: 80, heightMm: railHeight, wallType: "curtain" }));
  }
  actions.push(...furnishFloor({ ...item, variant: "apartment" },allocation,item.id,item.levelId,item.xMm,item.yMm,t,item.heightMm,item.bedrooms));
  if (item.roofStyle) {
    const slab = actions.find(a => a.kind === "floor" && a.id === `${item.id}:floor`);
    if (slab?.kind === "floor") {
      const roofPreset = item.roofStyle === "modern-flat" || building?.polygon && building.polygon.length !== 4 ? "flat" : item.roofStyle === "german-gable" ? "gable" : item.roofStyle === "german-hip" ? "hip" : "shed";
      actions.push({ ...slab, kind: "roof", id: `${item.id}:roof`, elevationOffsetMm: item.heightMm, roofPreset, pitchDeg: roofPreset === "flat" ? 0 : roofPreset === "gable" ? 35 : 25 });
    }
  }
  const compiled = building?.polygon ? applyFootprint(actions,building.polygon,original.xMm,original.yMm,t,item.heightMm,item.levelId,item.id) : actions;
  if (!options.allocation && (item.garage && item.garage !== "none" || item.gardenAreaM2)) compiled.push(...outdoorActions({ ...item, variant: "apartment" }, item.id, item.levelId, original.xMm, original.yMm, building?.polygon ? Math.max(...building.polygon.map(p => p.xMm)) : w, building?.polygon ? Math.max(...building.polygon.map(p => p.yMm)) : d, item.heightMm));
  const parameters = { ...item, variant: "apartment" as const };
  return options.allocation ? compiled : homeDetails(varyHomeLayout(compiled, parameters), parameters);
}
