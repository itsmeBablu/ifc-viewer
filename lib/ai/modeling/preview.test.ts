import { expect, it } from "vitest";
import { residentialSketches } from "./preview";
import { clipSketchLines, validateSketches, sketchRooms, sketchActions } from "./sketch";
import { FOOTPRINTS, insidePolygon } from "./footprint";
import { validatePlan } from "../validate";
import { normalizeSketchJunctions } from "./sketch";

it("previews the wizard's default furnished home and outdoor requirements", () => {
  const sketches = residentialSketches({ variant: "villa", bedrooms: 3, bedroomAreaM2: 18, furnished: true, layoutStyle: "linear", cultureStyle: "standard", roofStyle: "modern-flat", separateKitchen: true, ensuiteBathrooms: true, garage: "enclosed", garageWidthM: 3.5, garageDepthM: 6, gardenAreaM2: 50, layoutSeed: 12345, plotAreaM2: 180 });
  expect(sketches[0].lines.length).toBeGreaterThan(0);
  expect(() => validateSketches(sketches)).not.toThrow();
  expect(() => sketchActions({ variant: "villa", bedrooms: 3, furnished: true, garage: "none", sketches }, "default-edited", "ground", 0, 3000, 200)).not.toThrow();
});

it("round-trips an expanded duplex drawing with aligned stairs and bedroom labels", () => {
  const parameters = { variant: "duplex" as const, bedrooms: 4, bedroomAreaM2: 18, garage: "none" as const, gardenAreaM2: 0 };
  const sketches = residentialSketches(parameters).map(s => clipSketchLines(normalizeSketchJunctions(s)));
  expect(sketches).toHaveLength(2);
  expect(() => validateSketches(sketches)).not.toThrow();
  expect(() => sketchActions({ ...parameters, sketches }, "edited-duplex", "ground", 0, 3000, 200)).not.toThrow();
});

it("previews every floor of a buildable small apartment building", () => {
  const p = { variant: "apartment" as const, bedrooms: 2, bedroomAreaM2: 18, apartmentFloors: 3, apartmentsPerFloor: 2, bedroomsPerApartment: 2 as const };
  const sketches = residentialSketches(p);
  expect(sketches).toHaveLength(3);
  expect(sketches.every(s => s.lines.length > 0)).toBe(true);
});

it.each(["rectangle", "l", "u"] as const)("opens the generated %s plan with editable rooms and compiles to 3D", footprint => {
  const parameters = { variant: "villa" as const, bedrooms: 3, bedroomAreaM2: 18, footprint, garage: "none" as const, gardenAreaM2: 0, plotAreaM2: 180 };
  const sketches = residentialSketches(parameters);
  expect(sketches[0].points).toHaveLength(FOOTPRINTS[footprint].length);
  expect(sketches[0].lines.length).toBeGreaterThan(0);
  expect(sketchRooms(sketches[0]).length).toBeGreaterThanOrEqual(4);
  expect(() => validateSketches(sketches)).not.toThrow();
  const actions = sketchActions({ ...parameters, sketches }, "editable", "ground", 0, 3000, 200);
  expect(() => validatePlan({ summary: "Edited home", assumptions: [], actions }, { projectId: "p", activeLevelId: "ground", defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, selection: [], elements: [{ id: "ground", kind: "level", properties: { elevationMm: 0, heightMm: 3000 } }] })).not.toThrow();
});

it("clips courtyard crossings into separate wings and discards external draft lines", () => {
  const points = FOOTPRINTS.u.map(p => ({ xMm: p.x * 10000, yMm: p.y * 10000 }));
  const s = clipSketchLines({ points, lines: [
    { start: { xMm: -1000, yMm: 8500 }, end: { xMm: 11000, yMm: 8500 } },
    { start: { xMm: 12000, yMm: 0 }, end: { xMm: 12000, yMm: 10000 } },
  ] });
  expect(s.lines).toHaveLength(2);
  expect(s.lines[0].end.xMm).toBeCloseTo(2500);
  expect(s.lines[1].start.xMm).toBeCloseTo(7500);
  for (const l of s.lines) expect(insidePolygon({ xMm: (l.start.xMm + l.end.xMm) / 2, yMm: (l.start.yMm + l.end.yMm) / 2 }, points)).toBe(true);
  expect(() => validateSketches([s])).not.toThrow();
});


it("builds the displayed plan before expanding and preserves master and kids concepts", async () => {
  const { homeBuildParameters } = await import("./preview");
  const p = {variant:"villa" as const,bedrooms:2,bedroomAreasM2:[22,12],bedroomAreaM2:17,bedroomTypes:["master","kids"] as ("master"|"kids")[],bedroomEnsuites:[true,false],bathroomCount:1,guestBathroom:true,guestBathroomShower:true,garage:"none" as const,gardenAreaM2:0,curtainFacade:true,roofWindow:true,roofStyle:"modern-flat" as const};
  const prepared = homeBuildParameters(p);
  expect(prepared.sketches?.[0].labels?.filter(l=>l.use==="bedroom").map(l=>l.name)).toEqual(["Master bedroom","Kids room"]);
  const actions = sketchActions(prepared,"home","ground",0,3000,200);
  const curtainIds = new Set(actions.filter(a=>a.kind==="wall"&&a.wallType==="curtain").map(a=>a.id));
  expect(actions.filter(a=>a.kind==="window").every(a=>a.kind==="window"&&!curtainIds.has(a.wallId))).toBe(true);
  expect(actions.find(a=>a.kind==="equipment"&&a.familyId==="extras-roof-window")).toMatchObject({connectedHostId:"home:roof"});
  expect(()=>validatePlan({summary:"Home",assumptions:[],actions},{projectId:"p",activeLevelId:"ground",defaults:{wallHeightMm:3000,wallThicknessMm:200},selection:[],elements:[{id:"ground",kind:"level",properties:{elevationMm:0,heightMm:3000}}]})).not.toThrow();
});


it("subtracts overlapping draft spans instead of creating duplicate walls",()=>{
 const points=[{xMm:0,yMm:0},{xMm:10000,yMm:0},{xMm:10000,yMm:10000},{xMm:0,yMm:10000}];
 const s=clipSketchLines({points,lines:[{start:{xMm:1000,yMm:5000},end:{xMm:6000,yMm:5000}},{start:{xMm:3000,yMm:5000},end:{xMm:9000,yMm:5000}},{start:{xMm:6000,yMm:5000},end:{xMm:1000,yMm:5000}}]});
 expect(s.lines).toHaveLength(2);
 expect(s.lines.reduce((n,l)=>n+Math.hypot(l.end.xMm-l.start.xMm,l.end.yMm-l.start.yMm),0)).toBe(8000);
 expect(()=>validateSketches([s])).not.toThrow();
});


it("compiles each recommended 120 m² home without expanding",async()=>{
 const {suggestHomes}=await import("./home"); const {homeBuildParameters}=await import("./preview"); const {defaultModelingPlan}=await import("./index"); const {residentialParametersSchema}=await import("./brief");
 for(const thickness of [150,200]) for(const s of suggestHomes({areaM2:120},3000,thickness)) expect(()=>defaultModelingPlan({command:"Build home",model:"gemini-3.1-flash-lite",mode:"build",residential:residentialParametersSchema.parse(homeBuildParameters(s.parameters,3000,thickness)),context:{projectId:"p",activeLevelId:null,defaults:{wallHeightMm:3000,wallThicknessMm:thickness},selection:[],elements:[]},attachments:[],history:[]})).not.toThrow();
});
