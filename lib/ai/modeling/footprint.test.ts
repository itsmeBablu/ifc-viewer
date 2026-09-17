import { expect,it } from "vitest";
import { allocateBuilding,insidePolygon,polygonArea,offsetPolygon,FOOTPRINTS } from "./footprint";
import { defaultModelingPlan } from ".";
import { commandRequestSchema } from "../protocol";
const base={variant:"apartment" as const,bedrooms:2,bedroomAreaM2:20};
const context={projectId:"p",activeLevelId:null,elements:[],selection:[],defaults:{wallHeightMm:3000,wallThicknessMm:200}};
it.each(["l","u","drawn"] as const)("creates %s outline with rooms/furniture within it",footprint=>{
  const parameters={...base,footprint,...(footprint==="drawn"?{footprintPoints:FOOTPRINTS.l}:{}),furnished:true,ducts:"ceiling" as const,piping:"underfloor" as const,underfloorHeating:true};
  const building=allocateBuilding(parameters);
  const result=defaultModelingPlan(commandRequestSchema.parse({command:"Create this layout",residential:parameters,context}))!;
  const slab=result.plan.actions.find(a=>a.kind==="floor")!;
  expect(slab.kind==="floor"&&slab.boundary).toEqual(offsetPolygon(building.polygon!,200));
  expect(result.plan.summary).toContain(`${Number((polygonArea(building.polygon!)/1e6).toFixed(1))} m²`);
  const furniture=result.plan.actions.filter(a=>a.kind==="equipment");
  expect(furniture.filter(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toHaveLength(2);
  for(const action of furniture){if(action.kind!=="equipment")continue;expect(insidePolygon({xMm:action.xMm,yMm:action.yMm},building.polygon!)).toBe(true);}
  expect(result.plan.actions.some(a=>a.kind==="duct")).toBe(true);
  expect(result.plan.actions.some(a=>a.kind==="pipe"&&a.elevationOffsetMm<0)).toBe(true);
});
it("holds rectangular width and length while preserving bedroom area",()=>{
  const result=allocateBuilding({...base,widthM:10,lengthM:12});
  expect(result.allocation.totalAreaM2).toBe(120);
  expect(result.allocation.roomWidthMm*result.allocation.roomDepthMm/1e6).toBeCloseTo(20);
});
it("rejects crossed outlines, conflicting dimensions and infeasible small shapes",()=>{
  expect(()=>allocateBuilding({...base,footprint:"drawn",footprintPoints:[{x:0,y:0},{x:1,y:1},{x:1,y:0},{x:0,y:1}]})).toThrow();
  expect(()=>allocateBuilding({...base,widthM:10,lengthM:12,totalAreaM2:100})).toThrow(/Width and length/);
  expect(()=>allocateBuilding({...base,widthM:5,lengthM:5})).toThrow(/Rooms do not fit/);
});
it("builds a diagonal drawn outline without substituting a rectangle",()=>{
  const parameters={...base,footprint:"drawn"as const,footprintPoints:[{x:0,y:0},{x:1,y:0},{x:1,y:.6},{x:.7,y:1},{x:0,y:1}],widthM:16,lengthM:14};
  const result=defaultModelingPlan(commandRequestSchema.parse({command:"Create",residential:parameters,context}))!;
  expect(result.plan.actions.filter(a=>a.kind==="wall"&&a.id.includes(":outline:"))).toHaveLength(5);
  expect(result.plan.actions.filter(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toHaveLength(2);
});
it.each(["villa","duplex"] as const)("furnishes %s with garage/garden and optional services",variant=>{
  const result=defaultModelingPlan(commandRequestSchema.parse({command:"Create this layout",residential:{variant,bedrooms:variant==="villa"?3:5,furnished:true,garage:"enclosed",gardenAreaM2:60,underfloorHeating:true,piping:"ceiling",ducts:"ceiling"},context}))!;
  expect(result.plan.actions.filter(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toHaveLength(variant==="villa"?3:5);
  expect(result.plan.actions.some(a=>a.kind==="door"&&a.style==="garage")).toBe(true);
  expect(result.plan.actions.some(a=>a.kind==="equipment"&&a.familyId==="extras-car-sedan")).toBe(true);
  expect(result.plan.actions.some(a=>a.kind==="equipment"&&a.familyId==="extras-tree")).toBe(true);
  expect(result.plan.actions.length).toBeLessThanOrEqual(400);
});
it.each(["l","u"]as const)("keeps all %s duplex floor wings and the stair opening",footprint=>{
  const parameters={variant:"duplex"as const,bedrooms:5,footprint,garage:"none"as const,gardenAreaM2:0};
  const result=defaultModelingPlan(commandRequestSchema.parse({command:"Create this layout",residential:parameters,context}))!;
  const upper=result.plan.actions.find(a=>a.kind==="level"&&a.id.endsWith(":upper"))!;
  const ground=result.plan.actions.find(a=>a.kind==="floor"&&a.id.endsWith(":ground:floor"))!;
  const slabs=result.plan.actions.filter(a=>a.kind==="floor"&&a.levelId===upper.id);
  const building=allocateBuilding(parameters);
  const expected=ground.kind==="floor"?polygonArea(ground.boundary)-building.allocation.stair.widthMm*(building.allocation.stair.runMm+building.allocation.stair.landingMm):0;
  expect(slabs.reduce((s,a)=>s+(a.kind==="floor"?polygonArea(a.boundary):0),0)).toBeCloseTo(expected,1);
});
