import { componentPreset } from "../../componentCatalog";
import { defaultFurnitureParameters,evaluateFurniture } from "../../parametricFurniture";
export type FurnitureRect={x:number;y:number;w:number;d:number};
export function furnitureBounds(familyId:string,rotation=0){
  const preset=componentPreset(familyId)!,parameters=defaultFurnitureParameters(familyId),evaluated=parameters?evaluateFurniture(parameters):null;
  const width=evaluated?Math.max(evaluated.widthMm,...evaluated.parts.map(p=>Math.abs(p.xMm)*2+(Math.abs(p.rotationDeg??0)%180===90?p.depthMm:p.widthMm))):preset.widthMm;
  const depth=evaluated?Math.max(evaluated.depthMm,...evaluated.parts.map(p=>Math.abs(p.yMm)*2+(Math.abs(p.rotationDeg??0)%180===90?p.widthMm:p.depthMm))):preset.depthMm;
  return {w:rotation%180?depth:width,d:rotation%180?width:depth};
}
export function arrangeRoom(type:import("./allocation").RoomUse,zone:FurnitureRect,reserved:FurnitureRect[],add:(family:string,x:number,y:number,rotation:number)=>void,bathFixture?: "shower" | "bathtub"){
  const occupied=[...reserved];
  const put=(family:string,x:number,y:number,rotation=0,gap=100)=>{
    const size=furnitureBounds(family,rotation),r={x:x-size.w/2,y:y-size.d/2,...size};
    if(r.x<zone.x+30||r.y<zone.y+30||r.x+r.w>zone.x+zone.w-30||r.y+r.d>zone.y+zone.d-30)return false;
    if(occupied.some(o=>r.x<o.x+o.w+gap&&r.x+r.w+gap>o.x&&r.y<o.y+o.d+gap&&r.y+r.d+gap>o.y))return false;
    occupied.push(r);add(family,x,y,rotation);return true;
  };
  const cx=zone.x+zone.w/2,rear=zone.y+zone.d;
  if(type==="bedroom"){
    const bed=zone.w>=2800?"bed-double":"bed-single",side=furnitureBounds(bed,270);
    const sideX=zone.x+side.w/2+50,sideY=zone.y+side.d/2+650;
    if(put(bed,sideX,sideY,270)){
      put("wardrobe",zone.x+zone.w-350,rear-1000,90);
      put("bedside",zone.x+300,sideY-side.d/2-325,270,50);
      put("bedside",zone.x+300,sideY+side.d/2+325,270,50);return;
    }
    const size=furnitureBounds(bed),bedY=zone.y+size.d/2+50;
    let bedX=cx;
    if(!put(bed,bedX,bedY)){bedX=zone.x+size.w/2+50;if(!put(bed,bedX,bedY))return;}
    // Storage faces into the room; the central route to the doorway remains open.
    if(!put("wardrobe",zone.x+350,rear-1000,270))put("wardrobe",zone.x+zone.w-350,rear-1000,90);
    put("bedside",bedX-size.w/2-325,zone.y+300,0,50);
    put("bedside",bedX+size.w/2+325,zone.y+300,0,50);
  }else if(type==="study"){
    put("desk",cx,zone.y+400);put("office-chair",cx,zone.y+1200,180);
  }else if(type==="bathroom"){
    const fixture = bathFixture === "shower" ? "bath-shower" : "bath-tub";
    const size = furnitureBounds(fixture);
    if (!put(fixture,zone.x+size.w/2+50,rear-size.d/2-50) && fixture === "bath-tub") put("bath-shower",zone.x+500,rear-500);
    put("bath-toilet",zone.x+zone.w-300,rear-500);
    put("bath-vanity",zone.x+zone.w-350,zone.y+1500,90);
  }else if(type==="garage"){
    put("extras-car-compact",cx,zone.y+zone.d/2);
  }else if(type!=="corridor"){
    // A continuous kitchen run on the rear wall, fronts facing the shared space.
    const families=["kitchen-fridge","kitchen-base","kitchen-sink","kitchen-hob"],run=families.reduce((sum,f)=>sum+furnitureBounds(f).w+10,0);
    if(type==="living"||type==="kitchen")for(const start of [zone.x+50,zone.x+zone.w-run-50]){
      let cursor=start;
      const placements=families.map(family=>{const size=furnitureBounds(family),r={x:cursor,y:rear-size.d-50,...size};cursor+=size.w+10;return {family,r};});
      if(placements.some(({r})=>r.x<zone.x+30||r.x+r.w>zone.x+zone.w-30||r.y<zone.y+30||occupied.some(o=>r.x<o.x+o.w+100&&r.x+r.w+100>o.x&&r.y<o.y+o.d+100&&r.y+r.d+100>o.y)))continue;
      placements.forEach(({family,r})=>put(family,r.x+r.w/2,r.y+r.d/2,180,0));break;
    }
    // Try coherent lounge groups at several wall positions, never separate random pieces.
    const sofa=furnitureBounds("sofa-2");
    let lounge=false;
    if(type==="living")for(const y of [zone.y+sofa.d/2+1100,zone.y+zone.d*.5]){
      for(const x of [cx,zone.x+zone.w-sofa.w/2-50,zone.x+sofa.w/2+50])if(put("sofa-2",x,y)){put("coffee-table",x,y+sofa.d/2+650);put("tv-cabinet",x,y+sofa.d/2+1700,180);lounge=true;break;}
      if(lounge)break;
    }
    const dining=furnitureBounds("dining-table");
    if(type==="living"||type==="dining")for(const x of [zone.x+dining.w/2+50,zone.x+zone.w-dining.w/2-50])if(put("dining-table",x,rear-dining.d/2-1500,0,350))break;
  }
}
