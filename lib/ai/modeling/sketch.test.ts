import { expect,it } from "vitest";
import { sketchRooms,sketchActions,validateSketches } from "./sketch";
import { resizeSketchLine } from "./sketchEditing";
import { polygonArea } from "./footprint";
import { validatePlan } from "../validate";
import { arrangeRoom,furnitureBounds } from "./roomFurniture";
import type { FloorSketch } from "./allocation";
const points=[{xMm:0,yMm:0},{xMm:14000,yMm:0},{xMm:14000,yMm:14000},{xMm:0,yMm:14000}];
const manual:FloorSketch={points,lines:[{start:{xMm:0,yMm:5000},end:{xMm:14000,yMm:5000}},{start:{xMm:7000,yMm:0},end:{xMm:7000,yMm:5000}}]};
it("length edits keep rectangular corners aligned and move attached interior endpoints",()=>{
  const edited=resizeSketchLine(manual,0,false,16000);
  expect(edited.points[1].xMm).toBe(16000);expect(edited.points[2].xMm).toBe(16000);
  expect(edited.lines[0].end.xMm).toBe(16000);
  expect(()=>resizeSketchLine(manual,0,false,0)).toThrow();
});
it("recovers rooms at T-junctions without losing the drawn partitions",()=>{
  const rooms=sketchRooms(manual);expect(rooms).toHaveLength(3);
  expect(rooms.reduce((s,p)=>s+polygonArea(p),0)).toBeCloseTo(196e6);
  const actions=sketchActions({variant:"villa",bedrooms:2,sketches:[manual],garage:"none",gardenAreaM2:0},"h","l",0,3000,200);
  expect(actions.filter(a=>a.kind==="wall")).toHaveLength(6);
  expect(actions.filter(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toHaveLength(2);
  expect(actions.filter(a=>a.kind==="window"&&a.wallId==="h:floor:0:wall:0").map(a=>a.kind==="window"&&a.positionMm)).toEqual([3500,10500]);
  validatePlan({summary:"Sketch",assumptions:[],actions:[{kind:"level",operation:"create",id:"l",name:"Ground",heightMm:3000,elevationMm:0},...actions]},{projectId:"p",activeLevelId:null,elements:[],selection:[],defaults:{wallHeightMm:3000,wallThicknessMm:200}});
});
it("creates three outside-only floors with aligned stair openings",()=>{
  const actions=sketchActions({variant:"duplex",bedrooms:5,sketches:[{points,lines:[]},{points,lines:[]},{points,lines:[]}],garage:"none",gardenAreaM2:0},"h","l",0,3000,200);
  expect(actions.filter(a=>a.kind==="level")).toHaveLength(2);
  expect(actions.filter(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toHaveLength(5);
  expect(actions.some(a=>a.kind==="floor"&&a.id.includes(":stair:"))).toBe(true);
});
it("rejects interior walls that leave a concave exterior",()=>{
  expect(()=>validateSketches([{points:[{xMm:0,yMm:0},{xMm:8000,yMm:0},{xMm:8000,yMm:4000},{xMm:4000,yMm:4000},{xMm:4000,yMm:8000},{xMm:0,yMm:8000}],lines:[{start:{xMm:0,yMm:8000},end:{xMm:8000,yMm:0}}]}])).not.toThrow();
  expect(()=>validateSketches([{...manual,lines:[{start:{xMm:0,yMm:0},end:{xMm:15000,yMm:5000}}]}])).toThrow(/outside/);
});
it("places a coherent lounge and kitchen without overlaps or door intrusion",()=>{
  const pieces:{family:string;x:number;y:number;rotation:number}[]=[];
  arrangeRoom("living",{x:0,y:0,w:8000,d:6500},[{x:6400,y:0,w:1300,d:1000}],(family,x,y,rotation)=>pieces.push({family,x,y,rotation}));
  const sofa=pieces.find(p=>p.family==="sofa-2")!,table=pieces.find(p=>p.family==="coffee-table")!;
  expect(table.x).toBe(sofa.x);expect(table.y).toBeGreaterThan(sofa.y);
  const cabinets=pieces.filter(p=>p.family.startsWith("kitchen-"));expect(cabinets).toHaveLength(4);expect(cabinets.every(p=>p.rotation===180)).toBe(true);
  for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){const a=pieces[i],b=pieces[j],as=furnitureBounds(a.family,a.rotation),bs=furnitureBounds(b.family,b.rotation);expect(Math.abs(a.x-b.x)>=(as.w+bs.w)/2||Math.abs(a.y-b.y)>=(as.d+bs.d)/2).toBe(true);}
});
