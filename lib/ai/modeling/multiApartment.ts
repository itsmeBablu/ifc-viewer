import type { AiAction } from "../schema";
import type { ResidentialParameters } from "./allocation";
import { allocateResidential } from "./allocation";
import { apartmentActions, apartmentSchema } from "./apartment";

/** Deterministic apartment-block compiler: every unit is an ordinary apartment recipe. */
export function multiApartmentActions(input:ResidentialParameters,id:string,groundId:string,baseElevationMm:number,heightMm:number,thicknessMm:number):AiAction[]{
  const floors=input.apartmentFloors??3,units=input.apartmentsPerFloor??4,beds=input.bedroomsPerApartment??2;
  if(floors<1||floors>12||units<2||units>10||beds<1||beds>3)throw new Error("Apartment blocks support 1–12 floors, 2–10 homes per floor and 1–3 bedrooms per home.");
  const distribution=input.bedroomDistribution?.length ? input.bedroomDistribution : Array.from({length:units},()=>beds);
  const unitArea=input.totalAreaM2?input.totalAreaM2/(floors*units):undefined;
  const unitSizes=distribution.slice(0,units).map(b=>allocateResidential({...input,variant:"apartment" as const,bedrooms:b,totalAreaM2:unitArea},heightMm,thicknessMm));
  while(unitSizes.length<units) unitSizes.push(unitSizes[unitSizes.length%unitSizes.length]);
  const gap=300,unitWidth=Math.max(...unitSizes.map(u=>u.widthMm))+gap,totalWidth=units*unitWidth-gap,depth=Math.max(...unitSizes.map(u=>u.depthMm));
  const actions:AiAction[]=[];
  for(let floor=0;floor<floors;floor++){
    const levelId=floor===0?groundId:`${id}:level:${floor}`;
    if(floor>0)actions.push({kind:"level",operation:"create",id:levelId,name:`Apartment floor ${floor+1}`,elevationMm:baseElevationMm+floor*(heightMm+200),heightMm});
    for(let unitIndex=0;unitIndex<units;unitIndex++){
      const x=unitIndex*unitWidth, unit=unitSizes[unitIndex], unitBeds=distribution[unitIndex]??beds;
      const item=apartmentSchema.parse({kind:"apartment_layout",id:`${id}:floor:${floor}:unit:${unitIndex}`,levelId,bedrooms:unitBeds,bedroomAreaM2:unit.bedroomAreaM2,livingAreaM2:input.livingAreaM2,kitchenAreaM2:input.kitchenAreaM2,bathroomAreaM2:input.bathroomAreaM2,heightMm,thicknessMm,xMm:x,yMm:0,furnished:input.furnished!==false,separateKitchen:input.separateKitchen??true,ensuiteBathrooms:input.ensuiteBathrooms??true,underfloorHeating:input.underfloorHeating,piping:input.piping,ducts:input.ducts,layoutSeed:(input.layoutSeed??0)+unitIndex*73+floor*109});
      actions.push(...apartmentActions(item,{allocation:unit,entrance:unitIndex===0}).filter(a=>a.kind!=="floor"&&a.kind!=="roof"));
    }
    actions.push({kind:"floor",operation:"create",id:`${id}:floor:${floor}`,levelId,boundary:[{xMm:0,yMm:0},{xMm:totalWidth,yMm:0},{xMm:totalWidth,yMm:depth},{xMm:0,yMm:depth}],thicknessMm:200,elevationOffsetMm:0,roofPreset:"flat",pitchDeg:0});
    actions.push({kind:"equipment",operation:"create",id:`${id}:floor:${floor}:lift`,levelId,familyId:"extras-lift",xMm:totalWidth+1600,yMm:3000,rotationDeg:0,elevationMm:0,widthMm:1800,depthMm:1800,heightMm:heightMm});
    // A compact common stair is represented by two landing slabs; it aligns vertically.
    if(floor<floors-1)actions.push({kind:"floor",operation:"create",id:`${id}:floor:${floor}:stair-landing`,levelId,boundary:[{xMm:totalWidth+400,yMm:600},{xMm:totalWidth+3000,yMm:600},{xMm:totalWidth+3000,yMm:3600},{xMm:totalWidth+400,yMm:3600}],thicknessMm:180,elevationOffsetMm:0,roofPreset:"flat",pitchDeg:0});
  }
  return actions;
}
