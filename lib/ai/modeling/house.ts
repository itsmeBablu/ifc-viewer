import { z } from "zod";
import { apartmentSchema, apartmentActions } from "./apartment";
import type { AiAction } from "../schema";

export const houseSchema = apartmentSchema.extend({
  kind: z.literal("house_layout"), variant: z.enum(["villa", "duplex"]).default("villa"),
  bedrooms: z.number().int().min(1).max(6).default(3),
  baseElevationMm: z.number().min(-900000).max(900000).default(0),
}).strict().describe("Unfurnished home concept. Villa: one storey, bedrooms, bathroom, corridor, spacious living/kitchen and flat roof. Duplex: one dwelling on two aligned storeys, bedrooms split across floors, bathroom each, slab-built stair and upper-floor opening, flat roof. Creates upper level id:upper at baseElevationMm+heightMm+200; levelId must already exist. 1–6 bedrooms; default bedroom 20 m². Extra sleeping-zone bays are studies, not bedrooms. No engineered MEP or stair detailing.");

export function houseActions(item: z.infer<typeof houseSchema>): AiAction[] {
  const floors = item.variant === "duplex" ? 2 : 1;
  const bays = Math.max(2, Math.ceil(item.bedrooms / floors));
  const groundBedrooms = floors === 1 ? item.bedrooms : Math.floor(item.bedrooms / 2);
  const rise = item.heightMm + 200;
  const actions: AiAction[] = [];
  const upperId = `${item.id}:upper`;
  if (floors === 2) actions.push({ kind: "level", operation: "create", id: upperId, name: "First floor", elevationMm: item.baseElevationMm + rise, heightMm: item.heightMm });
  const steps = Math.ceil(rise / 180), tread = 280;
  const serviceDepthMm = Math.max(6000, steps * tread + 1600);
  const stairX = item.xMm + item.thicknessMm / 2 + 2400;
  const stairY = item.yMm + item.thicknessMm / 2 + item.bedroomAreaM2 * 1e6 / 4000 + 150 + 1200 + 150 + 600;
  const stairEnd = stairY + (steps - 1) * tread;
  for (let floor = 0; floor < floors; floor++) {
    const levelId = floor ? upperId : item.levelId;
    const prefix = `${item.id}:${floor ? "first" : "ground"}`;
    // All bays keep identical footprints; unused bedroom bays are optional studies.
    const layout = apartmentActions(apartmentSchema.parse({ kind: "apartment_layout", id: prefix, levelId, bedrooms: Math.max(1, floor ? item.bedrooms - groundBedrooms : groundBedrooms), bedroomAreaM2: item.bedroomAreaM2, xMm: item.xMm, yMm: item.yMm, heightMm: item.heightMm, thicknessMm: item.thicknessMm }), { bays, serviceDepthMm, entrance: !floor });
    const slab = layout.find((a): a is Extract<AiAction, { kind: "floor" }> => a.kind === "floor")!;
    actions.push(...layout.filter(a => a.kind !== "floor" || !floor));
    if (floor) {
      const min = slab.boundary[0], max = slab.boundary[2];
      // Four rectangles surround an interior stairwell without needing slab-hole actions.
      const rectangles = [[min.xMm, min.yMm, max.xMm, stairY], [min.xMm, stairY, stairX, stairEnd], [stairX + 1200, stairY, max.xMm, stairEnd], [min.xMm, stairEnd, max.xMm, max.yMm]];
      rectangles.forEach(([x1, y1, x2, y2], i) => actions.push({ ...slab, id: `${prefix}:floor:${i}`, boundary: [{ xMm: x1, yMm: y1 }, { xMm: x2, yMm: y1 }, { xMm: x2, yMm: y2 }, { xMm: x1, yMm: y2 }] }));
    }
    if (floor === floors - 1) actions.push({ ...slab, kind: "roof", id: `${item.id}:roof`, elevationOffsetMm: item.heightMm });
  }
  if (floors === 2) {
    // Stair solids use existing floor geometry, so Apply/Undo/IFC export work as usual.
    for (let i = 0; i < steps - 1; i++) actions.push({ kind: "floor", operation: "create", id: `${item.id}:stair:${i}`, levelId: item.levelId, thicknessMm: (i + 1) * rise / steps, elevationOffsetMm: (i + 1) * rise / steps, roofPreset: "flat", pitchDeg: 0, boundary: [{ xMm: stairX, yMm: stairY+i*tread }, { xMm: stairX+1200, yMm: stairY+i*tread }, { xMm: stairX+1200, yMm: stairY+(i+1)*tread }, { xMm: stairX, yMm: stairY+(i+1)*tread }] });
  }
  return actions;
}
