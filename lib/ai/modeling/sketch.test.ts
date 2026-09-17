import { expect,it } from "vitest";
import { sketchRooms,sketchActions,validateSketches } from "./sketch";
import { resizeSketchLine,circularOutline,arcSegments } from "./sketchEditing";
import { residentialParametersSchema } from "./brief";
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
it("preserves room metadata and prevents coupled edits from changing locked lengths",()=>{
  const labeled:FloorSketch={...manual,labels:[{point:{xMm:3500,yMm:2000},name:"Bedroom",use:"bedroom"}],locks:[{index:0,interior:false,lengthMm:14000}]};
  expect(()=>resizeSketchLine(labeled,0,false,16000)).toThrow(/locked/);
  const resized=resizeSketchLine(labeled,1,false,15000);
  expect(resized.labels).toEqual(labeled.labels);expect(resized.locks).toEqual(labeled.locks);
  expect(()=>validateSketches([{...labeled,points:resizeSketchLine(manual,0,false,16000).points}])).toThrow(/locked/);
});
it("creates bounded circular outlines and three-point arcs through the chosen bend",()=>{
  const circle=circularOutline({xMm:12000,yMm:12000},10000);
  validateSketches([{points:circle,lines:[]}]);expect(circle).toHaveLength(24);
  const arc=arcSegments({xMm:2000,yMm:2000},{xMm:8000,yMm:2000},{xMm:5000,yMm:5000});
  expect(arc[0].start).toEqual({xMm:2000,yMm:2000});expect(arc.at(-1)!.end).toEqual({xMm:8000,yMm:2000});
  expect(Math.max(...arc.flatMap(l=>[l.start.yMm,l.end.yMm]))).toBeCloseTo(5000);
  expect(()=>arcSegments({xMm:0,yMm:0},{xMm:1000,yMm:0},{xMm:500,yMm:0})).toThrow(/bend/);
});
it("uses room names for furniture and wet-room ventilation, retaining drawn gardens",()=>{
  const labeled:FloorSketch={...manual,labels:[{point:{xMm:3500,yMm:2000},name:"Office",use:"study"},{point:{xMm:10500,yMm:2000},name:"Kitchen",use:"kitchen"},{point:{xMm:7000,yMm:10000},name:"Living",use:"living"}],gardens:[[{xMm:0,yMm:16000},{xMm:8000,yMm:16000},{xMm:8000,yMm:20000},{xMm:0,yMm:20000}]]};
  const input=residentialParametersSchema.parse({variant:"villa",bedrooms:2,sketches:[labeled],garage:"none",piping:"ceiling",ducts:"ceiling"});
  const actions=sketchActions(input,"named","l",0,3000,200);
  expect(actions.some(a=>a.kind==="equipment"&&a.familyId==="desk")).toBe(true);
  expect(actions.some(a=>a.kind==="equipment"&&a.familyId.startsWith("bed-"))).toBe(false);
  expect(actions.filter(a=>a.kind==="pipe")).toHaveLength(4);
  expect(actions.filter(a=>a.kind==="duct"&&a.systemType==="exhaust")).toHaveLength(1);
  const lawn=actions.find(a=>a.kind==="equipment"&&a.familyId==="extras-lawn")!;
  expect(lawn).toMatchObject({xMm:4000,yMm:18000,widthMm:8000,depthMm:4000});
  expect(actions.some(a=>a.kind==="equipment"&&a.familyId==="extras-tree-flowering")).toBe(true);
  expect(()=>validateSketches([{...labeled,labels:[{point:{xMm:16000,yMm:16000},name:"Outside",use:"study"}]}])).toThrow(/inside a closed/);
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
