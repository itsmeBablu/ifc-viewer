import type { CommandRequest } from "../protocol";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";
import { defaultResidentialBrief } from "./brief";
import { allocateBuilding } from "./footprint";
import { sketchActions,validateSketches } from "./sketch";
import { polygonArea } from "./footprint";
import { multiApartmentActions } from "./multiApartment";

/** Only standalone, explicitly default briefs bypass language-model interpretation. */
export function defaultModelingPlan(input: CommandRequest) {
  if ((input.mode ?? "build") !== "build" || input.attachments.length || (!input.residential && (input.history.length || input.context.selection.length))) return null;
  const linear = input.command.trim().toLowerCase().match(/^(?:please\s+)?(?:create|build|make|model|add)\s+(?:a|an|just a|just one)?\s*(wall|duct|pipe|cable tray)\s+(?:with\s+)?(\d+(?:\.\d+)?)\s*(mm|m|meters?|metres?)\s*(?:long|length)?[.!]?$/);
  if (linear) {
    const length = Number(linear[2]) * (linear[3] === "mm" ? 1 : 1000);
    if (length < 10 || length > 100000) return null;
    const id = `basic-${crypto.randomUUID()}`, levelId = input.context.activeLevelId ?? `${id}:level`;
    // Preserve occupied projects for provider interpretation of a suitable placement.
    if (input.context.elements.some(e => e.kind !== "level")) return null;
    const kind = linear[1] === "cable tray" ? "cabletray" : linear[1];
    const sizes = kind === "wall" ? { thicknessMm: input.context.defaults.wallThicknessMm, heightMm: input.context.defaults.wallHeightMm }
      : kind === "duct" ? { shape: "rectangular", widthMm: 300, heightMm: 200, elevationOffsetMm: 2600, systemType: "supply" }
      : kind === "pipe" ? { diameterMm: 28, elevationOffsetMm: 2500, systemType: "hydronic_supply", slopePercent: 0 }
      : { widthMm: 200, heightMm: 50, elevationOffsetMm: 2500, trayType: "perforated" };
    const plan = expandModelPlan({ summary: `${length / 1000} m ${linear[1]}.`, assumptions: ["Straight run along +X from 0,0 on the active or new ground level.", "Omitted sizes and service properties use concept/project defaults."], actions: [
      ...(input.context.activeLevelId ? [] : [{ kind: "level", operation: "create", id: levelId, name: "Ground", elevationMm: 0, heightMm: input.context.defaults.wallHeightMm }]),
      { kind, operation: "create", id, levelId, startXmm: 0, startYmm: 0, endXmm: length, endYmm: 0, ...sizes },
    ] });
    return { kind: "plan" as const, plan: validatePlan(plan, input.context), model: input.model ?? "gemini-3.1-flash-lite", mode: "build" as const, usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 } };
  }
  const brief = input.residential ?? defaultResidentialBrief(input.command);
  if (!brief) return null;
  if(brief.variant === "apartment" && (brief.apartmentsPerFloor !== undefined || brief.apartmentFloors !== undefined || brief.bedroomsPerApartment !== undefined)){
    const id=`apartment-block-${crypto.randomUUID()}`,levelId=input.context.activeLevelId??`${id}:ground`,height=input.context.defaults.wallHeightMm;
    const base=Number(input.context.elements.find(e=>e.id===levelId)?.properties.elevationMm??0);
    const actions=multiApartmentActions(brief,id,levelId,base,height,input.context.defaults.wallThicknessMm);
    const floors=brief.apartmentFloors??3,units=brief.apartmentsPerFloor??4,beds=brief.bedroomsPerApartment??2;
    const plan=validatePlan({summary:`Multi-storey apartment building: ${floors} floors × ${units} homes, ${beds} bedrooms each.`,assumptions:["Each home is compiled with standard apartment rooms, furniture and optional MEP.","A shared lift and aligned stair landing are included on every floor.","Total area is divided evenly between homes; unspecified values use standard concept sizes."],actions:[...(input.context.activeLevelId?[]:[{kind:"level",operation:"create",id:levelId,name:"Ground",elevationMm:0,heightMm:height}]),...actions]},input.context);
    return {kind:"plan"as const,plan,model:input.model??"gemini-3.1-flash-lite",mode:"build"as const,usage:{inputTokens:0,outputTokens:0,thinkingTokens:0}};
  }
  if(brief.sketches){
    validateSketches(brief.sketches);
    const id=`sketch-${crypto.randomUUID()}`,levelId=input.context.activeLevelId??`${id}:ground`,height=input.context.defaults.wallHeightMm;
    const base=Number(input.context.elements.find(e=>e.id===levelId)?.properties.elevationMm??0);
    const extents=input.context.elements.filter(e=>e.kind==="wall"&&e.levelId===levelId).flatMap(e=>[e.properties.startXmm,e.properties.endXmm]).filter((n):n is number=>typeof n==="number");
    const area=brief.sketches.reduce((sum,s)=>sum+polygonArea(s.points)/1e6,0);
    if(brief.totalAreaM2!==undefined&&Math.abs(area-brief.totalAreaM2)>.1)throw new Error(`Drawn floors give ${area.toFixed(1)} m². Update the total area or adjust the drawn lines.`);
    const actions=sketchActions(brief,id,levelId,base,height,input.context.defaults.wallThicknessMm,extents.length?Math.max(...extents)+2000:0);
    const plan=validatePlan({summary:`Sketch-based ${brief.variant}: ${brief.sketches.length} floor(s), ${area.toFixed(1)} m² internal area.`,assumptions:["Drawn outside and inside lines determine each floor; explicit drawing dimensions take precedence over automatic room areas.","Outside-only floors receive automatic rooms; interior partitions determine enclosed rooms and furniture placement.","Furniture follows walls and room groups with circulation and stair clearances.","Multi-storey homes include concept U-stairs and aligned floor openings; garage and garden are additional."],actions:[...(input.context.activeLevelId?[]:[{kind:"level",operation:"create",id:levelId,name:"Ground",elevationMm:0,heightMm:height}]),...actions]},input.context);
    return {kind:"plan"as const,plan,model:input.model??"gemini-3.1-flash-lite",mode:"build"as const,usage:{inputTokens:0,outputTokens:0,thinkingTokens:0}};
  }
  const { bedrooms, variant, ...parameters } = brief;
  const building=allocateBuilding(brief,input.context.defaults.wallHeightMm,input.context.defaults.wallThicknessMm),allocation=building.allocation;
  const id = `${variant}-${crypto.randomUUID()}`;
  const levelId = input.context.activeLevelId ?? `${id}:level`;
  const existingWalls = input.context.elements.filter(e => e.kind === "wall" && e.levelId === levelId);
  const ends = existingWalls.flatMap(e => [e.properties.startXmm, e.properties.endXmm]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const xMm = ends.length ? Math.max(...ends) + 2000 : 0;
  const baseElevationMm = Number(input.context.elements.find(e => e.id === levelId && e.kind === "level")?.properties.elevationMm ?? 0);
  const format = (value: number) => Number(value.toFixed(1));
  const plan = expandModelPlan({ summary: `${bedrooms}-bedroom concept ${variant}: ${format(allocation.totalAreaM2+building.extraAreaM2)} m² total internal area; ${allocation.bedroomAreaM2} m² per bedroom.`,
    rationale: `Area allocation: bedrooms ${format(allocation.bedroomTotalM2)} m²; main living/dining ${format(allocation.livingTotalM2)} m²; open kitchen ${format(allocation.kitchenTotalM2)} m²; bathrooms ${format(allocation.bathroomTotalM2)} m²; corridor ${format(allocation.circulationAreaM2)} m²; partitions ${format(allocation.partitionAreaM2)} m²${allocation.studyAreaM2 ? `; studies ${format(allocation.studyAreaM2)} m²` : ""}${allocation.stairAreaM2 ? `; stairs/voids ${format(allocation.stairAreaM2)} m²` : ""}${allocation.familyDiningAreaM2 > .1 ? `; additional dining/family space ${format(allocation.familyDiningAreaM2)} m²` : ""}. Bedrooms face the exterior; bathroom and open kitchen/living share a service zone.`,
    assumptions: [`Internal area includes partitions and stairs across ${allocation.floors} floor(s), excludes exterior walls; garage/garden are additional.`, `Bedrooms ${format(allocation.roomWidthMm/1000)} × ${format(allocation.roomDepthMm/1000)} m clear; corridor 1.2 m clear.`, brief.furnished===false?"Unfurnished open living/kitchen zones.":"Basic catalogue furniture placed with door and stair clearances; fit varies with custom sizes.", "Selected MEP is concept routing, not engineered system sizing or completed connections.", ...(building.polygon?[`${brief.footprint??"rectangle"} footprint; rooms occupy an inscribed block and additional wings are open shared space.`]:[]), "Project wall height and exterior thickness; 150 mm partitions; 200 mm floor.", ...(allocation.studyAreaM2 ? ["Unused sleeping-zone bays are studies, not extra bedrooms."] : []), ...(variant !== "apartment" ? [variant === "villa" ? "Single-storey villa with flat roof." : "Duplex means one two-storey dwelling with flat roof."] : []), ...(variant === "duplex" ? [`${Math.floor(bedrooms / 2)} bedrooms downstairs and ${Math.ceil(bedrooms / 2)} upstairs.`, "Concept U-shaped stair uses slab solids with an upper-floor opening; railings and stair detailing remain."] : []), ...(ends.length ? ["Placed 2 m to the right of existing wall extents."] : ["Origin at 0,0 on the active or new ground level."])],
    actions: [...(input.context.activeLevelId ? [] : [{ kind: "level", operation: "create", id: levelId, name: "Ground", elevationMm: 0, heightMm: input.context.defaults.wallHeightMm }]),
      { ...parameters, kind: variant === "apartment" ? "apartment_layout" : "house_layout", ...(variant === "apartment" ? {} : { variant, baseElevationMm }), id, levelId, bedrooms, bedroomAreaM2: allocation.bedroomAreaM2, totalAreaM2: building.polygon ? brief.totalAreaM2 : allocation.totalAreaM2, xMm, heightMm: input.context.defaults.wallHeightMm, thicknessMm: input.context.defaults.wallThicknessMm }] });
  return { kind: "plan" as const, plan: validatePlan(plan, input.context), model: input.model ?? "gemini-3.1-flash-lite", mode: "build" as const, usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 } };
}

export const MODELING_DEFAULT_GUIDE = "Automatically create routine homes with apartment_layout (1â€“6 beds, default 2), apartment_block (1â€“12 floors, 2â€“10 homes per floor, 1â€“3 bedrooms per home), house_layout villa (houses/bungalows, default 3, one storey) or duplex (one dwelling/two storeys, default 5). Prefer modern BIM room zoning: separate kitchen rooms, ensuite bathrooms when requested, a shared lift/stair core for apartment blocks, aligned wet walls and compact service risers. Code computes geometry and basic furniture; never duplicate recipe output. Normalize any wording into totalAreaM2, bedroomAreaM2 each, livingAreaM2 main living/dining, kitchenAreaM2 main open kitchen, bathroomAreaM2 each. Explicit areas stay fixed; balance remaining shared space or report infeasible dimensions. Total internal area covers all floors, partitions/stairs/voids, excludes exterior walls, garage and garden. Defaults beds20 m², baths8, corridor1.2 m, project wall sizes. Flag beds below11 m², suggest11â€“14 minimum concept range and18 recommended; this is guidance, not a universal code minimum. WidthM/lengthM are clear internal overall spans; both or neither. footprint rectangle/l/u/drawn; drawn needs normalized 0..1 footprintPoints,3â€“16 corners. Rooms occupy an inscribed block, extra wings open living; code rejects invalid/non-fitting outlines. Default furnished true; false omits indoor furniture. Optional underfloorHeating true, piping underfloor/ceiling, ducts ceiling; omit services unless requested. Houses default enclosed3.5×6 m garage/car and40 m² garden; garage none/open/enclosed, gardenAreaM2 0 omits garden. Other garage sizes garageWidthM/garageDepthM. Code creates native catalogue extras; cars editable color, garage door overhead opening. House baseElevationMm from ground; generates upper level/U-stair/void. Extra sleeping bays studies. Uploaded drawings, twin-unit duplexes, bespoke storeys/individual room dimensions need explicit matching geometry. Columns300×300 at wall height, beams200×400 at ceiling, trays200×50 at2500, water22 mm,waste108 at1%,heating28,ducts300×200 below ceiling. Catalogue sizes; existing MEP connections require evidence. Disclose concept assumptions and proceed without routine questions. Ask only for ambiguous references/conflicting constraints; no engineering/compliance claims. Vastu mode places pooja/meditation NE, kitchen SE and primary bedroom SW when orientation is available; German mode supports gable, hip and mansard roofs with a compact thermal/service core. These are concept preferences, not compliance claims.";
