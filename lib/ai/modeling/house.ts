import { z } from "zod";
import { apartmentSchema, apartmentActions } from "./apartment";
import type { AiAction } from "../schema";
import { allocateBuilding, applyFootprint,offsetPolygon,polygonAroundOpening } from "./footprint";
import { furnishFloor, outdoorActions } from "./furnishing";

export const houseSchema = apartmentSchema.extend({
  kind: z.literal("house_layout"), variant: z.enum(["villa", "duplex"]).default("villa"),
  bedrooms: z.number().int().min(1).max(6).default(3),
  baseElevationMm: z.number().min(-900000).max(900000).default(0),
  garage: z.enum(["none", "open", "enclosed"]).default("enclosed"), gardenAreaM2:z.number().min(0).max(2000).default(40),
}).strict().describe("Furnished home concept. Villa one storey, duplex one dwelling/two aligned storeys with split bedrooms, bathroom each, slab-built U-stair and upper opening, flat roof. Creates upper id:upper at baseElevationMm+heightMm+200; levelId must exist. 1–6 bedrooms, default 20 m² each. Optional rectangle/l/u/drawn footprints, normalized points, internal widthM/lengthM. Defaults enclosed 3.5×6 m garage/car and 40 m² garden; garage none/open/enclosed, gardenAreaM2 0 omits garden. Garage/garden additional to total. Optional concept underfloorHeating, water piping underfloor/ceiling, ceiling ducts. furnished false omits indoor furniture. Extra sleeping bays studies. No engineered MEP/stair detailing.");

export function houseActions(item: z.infer<typeof houseSchema>): AiAction[] {
  const building = allocateBuilding(item, item.heightMm, item.thicknessMm),allocation=building.allocation;
  const original = item;
  if(building.block)item={...item,xMm:item.xMm+building.block.xMm-item.thicknessMm/2,yMm:item.yMm+building.block.yMm-item.thicknessMm/2};
  const { floors, stair } = allocation;
  const groundBedrooms = floors === 1 ? item.bedrooms : Math.floor(item.bedrooms / 2);
  const rise = stair.riseMm;
  const actions: AiAction[] = [];
  const upperId = `${item.id}:upper`;
  if (floors === 2) actions.push({ kind: "level", operation: "create", id: upperId, name: "First floor", elevationMm: item.baseElevationMm + rise, heightMm: item.heightMm });
  const stairX = item.xMm + item.thicknessMm / 2 + allocation.bathroomWidthMm + 300;
  let stairY = item.yMm + allocation.corridorEndMm + 75 + 1200;
  // Avoid sub-centimetre slab edges where an irregular outline meets a stair cut.
  if(building.polygon)for(let i=0;i<4;i++)if(building.polygon.some(p=>[stairY,stairY+stair.runMm+stair.landingMm].some(y=>Math.abs(y-(original.yMm+p.yMm+item.thicknessMm))<20)))stairY-=40;
  const stairEnd = stairY + stair.runMm + stair.landingMm;
  for (let floor = 0; floor < floors; floor++) {
    const levelId = floor ? upperId : item.levelId;
    const prefix = `${item.id}:${floor ? "first" : "ground"}`;
    // All bays keep identical footprints; unused bedroom bays are optional studies.
    const bedrooms=floor?item.bedrooms-groundBedrooms:groundBedrooms;
    let layout = apartmentActions(apartmentSchema.parse({ kind: "apartment_layout", id: prefix, levelId, bedrooms: Math.max(1,bedrooms), bedroomAreaM2: item.bedroomAreaM2, xMm: item.xMm, yMm: item.yMm, heightMm: item.heightMm, thicknessMm: item.thicknessMm,furnished:false }), { allocation, entrance: !floor });
    layout.push(...furnishFloor(item,allocation,prefix,levelId,item.xMm,item.yMm,item.thicknessMm,item.heightMm,bedrooms,Boolean(floor)));
    const slab = layout.find((a): a is Extract<AiAction, { kind: "floor" }> => a.kind === "floor")!;
    if(building.polygon)layout=applyFootprint(layout,building.polygon,original.xMm,original.yMm,item.thicknessMm,item.heightMm,levelId,prefix);
    actions.push(...layout.filter(a => a.kind !== "floor" || !floor));
    if (floor) {
      if(building.polygon){
        const boundary=offsetPolygon(building.polygon,item.thicknessMm).map(p=>({xMm:p.xMm+original.xMm,yMm:p.yMm+original.yMm}));
        polygonAroundOpening(boundary,{x:stairX,y:stairY,w:stair.widthMm,d:stairEnd-stairY}).forEach((boundary,i)=>actions.push({...slab,id:`${prefix}:floor:${i}`,boundary}));
      }else{
      const min = slab.boundary[0], max = slab.boundary[2];
      // Four rectangles surround an interior stairwell without needing slab-hole actions.
      const rectangles = [[min.xMm, min.yMm, max.xMm, stairY], [min.xMm, stairY, stairX, stairEnd], [stairX + stair.widthMm, stairY, max.xMm, stairEnd], [min.xMm, stairEnd, max.xMm, max.yMm]];
      rectangles.forEach(([x1, y1, x2, y2], i) => actions.push({ ...slab, id: `${prefix}:floor:${i}`, boundary: [{ xMm: x1, yMm: y1 }, { xMm: x2, yMm: y1 }, { xMm: x2, yMm: y2 }, { xMm: x1, yMm: y2 }] }));
      }
    }
    if (floor === floors - 1) {
      const roofPreset = item.roofStyle === "modern-flat" ? "flat" : item.roofStyle === "german-gable" ? "gable" : item.roofStyle === "mansard" ? "shed" : item.roofStyle === "german-hip" ? "hip" : "hip";
      actions.push({ ...slab, kind: "roof", id: `${item.id}:roof`, roofPreset, pitchDeg: roofPreset === "flat" ? 0 : roofPreset === "gable" ? 35 : roofPreset === "shed" ? 25 : 30, ...(building.polygon?{boundary:offsetPolygon(building.polygon,item.thicknessMm).map(p=>({xMm:p.xMm+original.xMm,yMm:p.yMm+original.yMm}))}:{}), elevationOffsetMm: item.heightMm });
    }
  }
  if (floors === 2) {
    // Stair solids use existing floor geometry, so Apply/Undo/IFC export work as usual.
    let index = 0;
    const step = (x: number, y: number, width: number, depth: number, top: number) => actions.push({ kind: "floor", operation: "create", id: `${item.id}:stair:${index++}`, levelId: item.levelId, thicknessMm: top, elevationOffsetMm: top, roofPreset: "flat", pitchDeg: 0, boundary: [{ xMm: x, yMm: y }, { xMm: x+width, yMm: y }, { xMm: x+width, yMm: y+depth }, { xMm: x, yMm: y+depth }] });
    for (let i = 0; i < stair.flightSteps - 1; i++) step(stairX, stairY+i*stair.treadMm, 1200, stair.treadMm, (i+1)*stair.riserMm);
    step(stairX, stairY+stair.runMm, stair.widthMm, stair.landingMm, rise/2);
    for (let i = 0; i < stair.flightSteps - 1; i++) step(stairX+1350, stairY+stair.runMm-(i+1)*stair.treadMm, 1200, stair.treadMm, (stair.flightSteps+i+1)*stair.riserMm);
  }
  actions.push(...outdoorActions(item,item.id,item.levelId,original.xMm,original.yMm,building.polygon?Math.max(...building.polygon.map(p=>p.xMm)):allocation.widthMm,building.polygon?Math.max(...building.polygon.map(p=>p.yMm)):allocation.depthMm,item.heightMm));
  return actions;
}
