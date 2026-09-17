export type ResidentialVariant = "apartment" | "villa" | "duplex";
export type SketchPoint = { xMm: number; yMm: number };
export type RoomUse = "bedroom" | "living" | "kitchen" | "dining" | "study" | "bathroom" | "corridor" | "garage";
export type SketchSegment = { start: SketchPoint; end: SketchPoint };
export type FloorSketch = { points: SketchPoint[]; lines: SketchSegment[]; furnitureLines?: SketchSegment[]; mepLines?: SketchSegment[]; labels?: { point:SketchPoint; name:string; use:RoomUse }[]; locks?: { index:number; interior:boolean; lengthMm:number }[]; wallTypes?: { index:number; interior:boolean; type:"exterior"|"partition"|"fire"|"curtain" }[]; openings?: { point:SketchPoint; kind:"door"|"doubleDoor"|"window"; widthMm:number }[]; gardens?: SketchPoint[][] };
export type ResidentialParameters = { variant: ResidentialVariant; bedrooms: number; bedroomDistribution?: (1|2|3)[]; layoutSeed?: number; cultureStyle?: "standard" | "vastu" | "german"; roofStyle?: "german-gable" | "german-hip" | "mansard" | "modern-flat"; bedroomAreaM2?: number; totalAreaM2?: number; livingAreaM2?: number; kitchenAreaM2?: number; bathroomAreaM2?: number; apartmentFloors?: number; apartmentsPerFloor?: number; bedroomsPerApartment?: 1|2|3; layoutStyle?: "linear" | "courtyard" | "corner" | "split" | "central"; separateKitchen?: boolean; ensuiteBathrooms?: boolean; furnished?: boolean; underfloorHeating?: boolean; piping?: "none" | "underfloor" | "ceiling"; ducts?: "none" | "ceiling"; garage?: "none" | "open" | "enclosed"; garageWidthM?: number; garageDepthM?: number; gardenAreaM2?: number; footprint?: "rectangle" | "l" | "u" | "drawn"; widthM?: number; lengthM?: number; footprintPoints?: { x: number; y: number }[]; sketches?: FloorSketch[] };
export const RESIDENTIAL_PRESETS = [
  { label: "Multi-storey apartments", variant: "apartment", bedrooms: 2, apartmentFloors: 4, apartmentsPerFloor: 4, bedroomsPerApartment: 2, layoutStyle: "central", cultureStyle: "standard" },
  { label: "India Vastu 3BHK", variant: "apartment", bedrooms: 3, layoutStyle: "central", cultureStyle: "vastu", separateKitchen: true, ensuiteBathrooms: true },
  { label: "1-bedroom starter apartment", variant: "apartment", bedrooms: 1, layoutStyle: "linear", separateKitchen: true, ensuiteBathrooms: true },
  { label: "2-bedroom courtyard apartment", variant: "apartment", bedrooms: 2, layoutStyle: "courtyard", separateKitchen: true, ensuiteBathrooms: true },
  { label: "3-bedroom corner apartment", variant: "apartment", bedrooms: 3, layoutStyle: "corner", separateKitchen: true, ensuiteBathrooms: true },
  { label: "4-bedroom split apartment", variant: "apartment", bedrooms: 4, layoutStyle: "split", separateKitchen: true, ensuiteBathrooms: true },
  { label: "Villa", variant: "villa", bedrooms: 3, layoutStyle: "linear", roofStyle: "german-gable", cultureStyle: "german" },
  { label: "German Mansard villa", variant: "villa", bedrooms: 3, layoutStyle: "corner", roofStyle: "mansard", cultureStyle: "german" },
  { label: "Courtyard villa", variant: "villa", bedrooms: 4, layoutStyle: "courtyard" },
  { label: "5-bedroom duplex", variant: "duplex", bedrooms: 5, layoutStyle: "split" },
  { label: "6-bedroom duplex", variant: "duplex", bedrooms: 6, layoutStyle: "central" },
  { label: "Scandinavian courtyard home", variant: "villa", bedrooms: 3, layoutStyle: "courtyard", roofStyle: "german-gable", cultureStyle: "standard", separateKitchen: true, ensuiteBathrooms: true, garage: "enclosed", gardenAreaM2: 80 },
  { label: "Mediterranean patio villa", variant: "villa", bedrooms: 4, layoutStyle: "courtyard", roofStyle: "german-hip", cultureStyle: "standard", separateKitchen: true, ensuiteBathrooms: true, garage: "enclosed", gardenAreaM2: 120 },
  { label: "Modern split-level villa", variant: "duplex", bedrooms: 5, layoutStyle: "split", roofStyle: "modern-flat", cultureStyle: "standard", separateKitchen: true, ensuiteBathrooms: true, garage: "enclosed", gardenAreaM2: 70 },
  { label: "Penthouse terrace apartment", variant: "apartment", bedrooms: 3, layoutStyle: "corner", separateKitchen: true, ensuiteBathrooms: true, totalAreaM2: 150 },
  { label: "Organic curved courtyard", variant: "villa", bedrooms: 4, layoutStyle: "courtyard", footprint: "drawn", footprintPoints: [{x:.08,y:.18},{x:.22,y:.06},{x:.78,y:.06},{x:.92,y:.2},{x:.84,y:.46},{x:.94,y:.78},{x:.7,y:.94},{x:.3,y:.94},{x:.06,y:.76},{x:.16,y:.48}], roofStyle: "german-hip", gardenAreaM2: 100 },
] as const;

export function conceptStair(heightMm: number) {
  const riseMm = heightMm + 200;
  const steps = Math.ceil(riseMm / 360) * 2;
  const flightSteps = steps / 2;
  return { riseMm, steps, flightSteps, riserMm: riseMm / steps, treadMm: 280,
    runMm: (flightSteps - 1) * 280, landingMm: 1200, widthMm: 2550 };
}

/** Gross internal area includes partitions and stair voids, excludes perimeter walls. */
export function allocateResidential(input: ResidentialParameters, wallHeightMm = 3000, thicknessMm = 200, fixedInternalWidthMm?: number) {
  const { variant, bedrooms } = input;
  const bedroomAreaM2 = input.bedroomAreaM2 ?? 20;
  if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 6 || !Number.isFinite(bedroomAreaM2) || bedroomAreaM2 < 7.5 || bedroomAreaM2 > 100) throw new Error("Choose 1–6 bedrooms with 7.5–100 m² per bedroom.");
  for (const [name, area, minimum] of [["living", input.livingAreaM2, 10], ["kitchen", input.kitchenAreaM2, 6], ["bathroom", input.bathroomAreaM2, 4]] as const) {
    if (area !== undefined && (!Number.isFinite(area) || area < minimum || area > 300)) throw new Error(`${name} area must be ${minimum}–300 m².`);
  }
  if (!Number.isFinite(wallHeightMm) || wallHeightMm < 2400 || wallHeightMm > 6000 || !Number.isFinite(thicknessMm) || thicknessMm < 100 || thicknessMm > 500) throw new Error("Residential concepts need wall height 2400–6000 mm and thickness 100–500 mm.");
  if (input.totalAreaM2 !== undefined && (!Number.isFinite(input.totalAreaM2) || input.totalAreaM2 < 30 || input.totalAreaM2 > 2000)) throw new Error("Total internal area must be between 30 and 2000 m².");
  const floors = variant === "duplex" ? 2 : 1;
  const bays = variant === "apartment" ? bedrooms : Math.max(2, Math.ceil(bedrooms / floors));
  const partitionMm = 150, corridorMm = 1200;
  const stair = conceptStair(wallHeightMm);
  const serviceMinimumMm = variant === "duplex" ? stair.runMm + stair.landingMm + 1800 : 2400;
  const stairFootprintM2 = variant === "duplex" ? stair.widthMm * (stair.runMm + stair.landingMm) / 1e6 : 0;
  const bathroomTargetM2 = input.bathroomAreaM2 ?? 8;
  const mainSharedMinimumM2 = (input.livingAreaM2 ?? (variant === "villa" ? 24 : 20)) + (input.kitchenAreaM2 ?? 8);
  const serviceBudget = (width: number, depth: number) => {
    let bathroomWidthMm = Math.max(1800, bathroomTargetM2 * 1e6 / depth);
    let bathroomDepthMm = bathroomTargetM2 * 1e6 / bathroomWidthMm;
    if (depth - bathroomDepthMm > .001 && depth - bathroomDepthMm < 300) {
      bathroomWidthMm = bathroomTargetM2 * 1e6 / depth;
      bathroomDepthMm = depth;
    }
    const bathroomEnclosed = depth - bathroomDepthMm > .001;
    const servicePartitionM2 = (partitionMm * bathroomDepthMm + (bathroomEnclosed ? partitionMm * (bathroomWidthMm + partitionMm) : 0)) / 1e6;
    const sharedM2 = width * depth / 1e6 - bathroomTargetM2 - servicePartitionM2;
    const fits = bathroomWidthMm >= 1500 && bathroomWidthMm <= 3500 && bathroomDepthMm >= 2000
      && width - bathroomWidthMm - partitionMm >= 1800
      && (variant !== "duplex" || width >= bathroomWidthMm + 300 + stair.widthMm + 600)
      && sharedM2 - stairFootprintM2 >= mainSharedMinimumM2;
    return { bathroomWidthMm, bathroomDepthMm, bathroomEnclosed, servicePartitionM2, sharedM2, fits };
  };
  const candidates: { roomWidthMm: number; roomDepthMm: number; internalWidthMm: number; minimumM2: number }[] = [];
  const fixedRoomWidth = fixedInternalWidthMm === undefined ? undefined : (fixedInternalWidthMm - (bays - 1) * partitionMm) / bays;
  for (let roomWidthMm = fixedRoomWidth ?? 2150; roomWidthMm <= (fixedRoomWidth ?? 10000); roomWidthMm += 25) {
    if (roomWidthMm < 2150 || roomWidthMm > 10000) continue;
    const roomDepthMm = bedroomAreaM2 * 1e6 / roomWidthMm;
    if (roomDepthMm < 2150 || roomDepthMm > 15000) continue;
    const internalWidthMm = bays * roomWidthMm + (bays - 1) * partitionMm;
    // A shared zone needs both a usable bathroom and living/kitchen, not only spare area.
    const fits = (depth: number) => serviceBudget(internalWidthMm, depth).fits;
    let low = serviceMinimumMm, high = 1000000;
    if (!fits(high)) continue;
    for (let i = 0; i < 40; i++) { const middle = (low + high) / 2; if (fits(middle)) high = middle; else low = middle; }
    const minimumServiceMm = fits(serviceMinimumMm) ? serviceMinimumMm : high;
    const minimumM2 = floors * internalWidthMm * (roomDepthMm + corridorMm + 2 * partitionMm + minimumServiceMm) / 1e6;
    candidates.push({ roomWidthMm, roomDepthMm, internalWidthMm, minimumM2 });
  }
  if (!candidates.length) throw new Error("These room sizes cannot fit this concept layout. Increase bedroom area or reduce the requested shared-room sizes.");
  const minimumAreaM2 = Math.ceil(Math.min(...candidates.map(c => c.minimumM2)));
  const preferred = bedrooms * bedroomAreaM2 + (variant === "apartment" ? 45 + bedrooms * 5 : variant === "villa" ? 70 + bedrooms * 10 : 130 + bedrooms * 10)
    + Math.max(0, (input.livingAreaM2 ?? 24) - 24) + Math.max(0, (input.kitchenAreaM2 ?? 10) - 10) + floors * Math.max(0, bathroomTargetM2 - 8);
  const recommendedAreaM2 = Math.max(Math.ceil(preferred / 5) * 5, Math.ceil(minimumAreaM2 * 1.1 / 5) * 5);
  const totalAreaM2 = input.totalAreaM2 ?? recommendedAreaM2;
  const feasible = candidates.flatMap(c => {
    const internalDepthMm = totalAreaM2 * 1e6 / floors / c.internalWidthMm;
    const serviceDepthMm = internalDepthMm - c.roomDepthMm - corridorMm - 2 * partitionMm;
    if (serviceDepthMm < serviceMinimumMm) return [];
    const budget = serviceBudget(c.internalWidthMm, serviceDepthMm);
    if (!budget.fits) return [];
    const aspect = c.internalWidthMm / internalDepthMm;
    const score = Math.abs(Math.log(aspect)) * 3 + Math.abs(c.roomWidthMm - 4000) / 4000 + Math.abs(Math.log(c.roomWidthMm / c.roomDepthMm)) * .3;
    return [{ ...c, internalDepthMm, serviceDepthMm, ...budget, score }];
  }).sort((a, b) => a.score - b.score);
  const choice = feasible[0];
  if (!choice) throw new Error(`${totalAreaM2} m² cannot fit ${bedrooms} bedrooms of ${bedroomAreaM2} m² with usable shared spaces${floors === 2 ? " and stairs" : ""}. Try at least ${minimumAreaM2} m², or reduce bedroom area. Suggested total: ${recommendedAreaM2} m².`);
  const studyAreaM2 = (bays * floors - bedrooms) * bedroomAreaM2;
  const circulationAreaM2 = floors * choice.internalWidthMm * corridorMm / 1e6;
  const bathroomAreaM2 = floors * bathroomTargetM2;
  const stairAreaM2 = variant === "duplex" ? floors * stair.widthMm * (stair.runMm + stair.landingMm) / 1e6 : 0;
  const livingKitchenAreaM2 = floors * choice.sharedM2 - stairAreaM2;
  const sharedPerFloorM2 = choice.sharedM2 - stairFootprintM2;
  const kitchenTotalM2 = input.kitchenAreaM2 ?? Math.max(8, Math.min(18, sharedPerFloorM2 * .28, sharedPerFloorM2 - (input.livingAreaM2 ?? 20)));
  const livingTotalM2 = input.livingAreaM2 ?? sharedPerFloorM2 - kitchenTotalM2;
  const familyDiningAreaM2 = livingKitchenAreaM2 - livingTotalM2 - kitchenTotalM2;
  const partitionAreaM2 = totalAreaM2 - bedrooms * bedroomAreaM2 - studyAreaM2 - circulationAreaM2 - bathroomAreaM2 - stairAreaM2 - livingKitchenAreaM2;
  return { ...choice, floors, bays, bedroomAreaM2, totalAreaM2, recommendedAreaM2, minimumAreaM2,
    widthMm: choice.internalWidthMm + thicknessMm, depthMm: choice.internalDepthMm + thicknessMm,
    bedroomEndMm: thicknessMm / 2 + choice.roomDepthMm + partitionMm / 2,
    corridorEndMm: thicknessMm / 2 + choice.roomDepthMm + partitionMm + corridorMm + partitionMm / 2,
    bedroomTotalM2: bedrooms * bedroomAreaM2, studyAreaM2, circulationAreaM2, bathroomTotalM2: bathroomAreaM2,
    stairAreaM2, livingKitchenTotalM2: livingKitchenAreaM2, kitchenTotalM2, livingTotalM2, familyDiningAreaM2, partitionAreaM2, stair };
}

export function residentialCommand(input: ResidentialParameters) {
  if(input.variant==="apartment"&&(input.apartmentFloors!==undefined||input.apartmentsPerFloor!==undefined||input.bedroomsPerApartment!==undefined))return `Create a multi-storey apartment building with ${input.apartmentFloors??3} floors, ${input.apartmentsPerFloor??4} homes per floor and ${input.bedroomsPerApartment??2} bedrooms in each home${input.totalAreaM2?`, total area ${input.totalAreaM2} m²`:""}. Include a shared lift, aligned stairs, corridor access, furniture and requested MEP.`;
  if(input.sketches)return `Create a ${input.variant} from my ${input.sketches.length} floor drawings, with ${input.bedrooms} bedrooms. Preserve the exact outside and inside line dimensions${input.furnished!==false?", with properly arranged basic furniture":""}${input.underfloorHeating?", underfloor heating":""}${input.piping&&input.piping!=="none"?`, water piping ${input.piping}`:""}${input.ducts==="ceiling"?", ceiling ducts":""}.`;
  const noun = input.variant === "apartment" ? "apartment" : input.variant === "villa" ? "villa" : "duplex house";
  const styleFootprint = input.layoutStyle === "courtyard" ? "u" : input.layoutStyle === "corner" ? "l" : input.layoutStyle === "central" ? "u" : input.footprint;
  return `Create a ${input.bedrooms}-bedroom ${noun}${input.totalAreaM2 !== undefined ? ` with total area ${input.totalAreaM2} m²` : ""} and bedrooms ${input.bedroomAreaM2 ?? 20} m² each${input.livingAreaM2 !== undefined ? `, living room ${input.livingAreaM2} m²` : ""}${input.kitchenAreaM2 !== undefined ? `, kitchen ${input.kitchenAreaM2} m²` : ""}${input.bathroomAreaM2 !== undefined ? `, bathroom ${input.bathroomAreaM2} m²` : ""}${styleFootprint&&styleFootprint!=="rectangle"?`, ${input.layoutStyle ?? styleFootprint} footprint`:""}${input.widthM&&input.lengthM?`, ${input.widthM} m wide by ${input.lengthM} m long inside walls`:""}${input.cultureStyle === "vastu" ? ", Vastu-oriented zoning" : input.cultureStyle === "german" ? ", German planning style" : ""}${input.roofStyle ? `, ${input.roofStyle} roof` : ""}${input.separateKitchen?", separate kitchen room":""}${input.ensuiteBathrooms?", ensuite bathrooms":""}${input.furnished!==undefined?`, ${input.furnished?"basic furniture":"unfurnished"}`:""}${input.underfloorHeating?", underfloor heating":""}${input.piping&&input.piping!=="none"?`, water piping ${input.piping}`:""}${input.ducts==="ceiling"?", ducts below roof":""}${input.garage&&input.garage!=="none"?`, ${input.garage} garage ${input.garageWidthM??3.5} × ${input.garageDepthM??6} m`:""}${input.gardenAreaM2?`, garden ${input.gardenAreaM2} m²`:""}`;
}



