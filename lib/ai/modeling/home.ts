import { residentialSketches } from "./preview";
import { sketchActions } from "./sketch";
import { allocateBuilding } from "./footprint";
import type { ResidentialParameters } from "./allocation";

export type HomeSuggestion = { id: string; label: string; reason: string; parameters: ResidentialParameters; footprintAreaM2: number; totalAreaM2: number };
export type HomeSite = { areaM2: number; widthM?: number; lengthM?: number };

/** Recommend only concepts the native compiler can fit on the supplied site. */
export function suggestHomes(site: HomeSite, heightMm = 3000, thicknessMm = 200): HomeSuggestion[] {
  if (!Number.isFinite(site.areaM2) || site.areaM2 < 30) return [];
  const suggestions: HomeSuggestion[] = [];
  const maxBedrooms = site.areaM2 <= 140 ? 2 : site.areaM2 <= 220 ? 3 : Math.min(5, Math.floor(site.areaM2 / 65));
  const bedroomAreaM2 = site.areaM2 <= 140 ? 11 : site.areaM2 <= 220 ? 14 : 18;
  for (const variant of ["apartment", "villa", "duplex"] as const) {
    for (let bedrooms = 1; bedrooms <= maxBedrooms; bedrooms++) {
      if (variant === "duplex" && bedrooms < 2) continue;
      const p: ResidentialParameters = { variant, bedrooms, bedroomAreaM2, footprint: "rectangle", garage: "none", gardenAreaM2: 0, balcony: "none", furnished: true, separateKitchen: true, ensuiteBathrooms: false, bathFixture: "shower", layoutSeed: 0, layoutRevision: 0, plotAreaM2: site.areaM2, plotWidthM: site.widthM, plotLengthM: site.lengthM };
      try {
        let building = allocateBuilding(p, heightMm, thicknessMm);
        // Keep a modest amount of the site free for access; this is a concept budget.
        const footprint = building.allocation.widthMm * building.allocation.depthMm / 1e6;
        if (footprint > site.areaM2 * .9) continue;
        if (site.widthM && site.lengthM && (building.allocation.widthMm / 1000 + thicknessMm / 1000 > site.widthM || building.allocation.depthMm / 1000 + thicknessMm / 1000 > site.lengthM)) {
          p.widthM = site.widthM - thicknessMm * 2 / 1000;
          p.lengthM = Math.min(site.lengthM - thicknessMm * 2 / 1000, site.areaM2 * .85 / p.widthM);
          building = allocateBuilding(p, heightMm, thicknessMm);
        }
        const footprintAreaM2 = (building.polygon ? Math.max(...building.polygon.map(p => p.xMm)) * Math.max(...building.polygon.map(p => p.yMm)) / 1e6 : footprint);
        if (footprintAreaM2 > site.areaM2 * .9) continue;
        const totalAreaM2 = building.allocation.totalAreaM2 + building.extraAreaM2;
        p.totalAreaM2 = totalAreaM2;
        if (!homeSiteFit(p, site, heightMm, thicknessMm).fits) continue;
        // Offer plans that remain buildable after editing, including aligned stair access.
        sketchActions({...p,sketches:residentialSketches(p,heightMm,thicknessMm)},"suggestion","ground",0,heightMm,thicknessMm);
        const floors = variant === "duplex" ? 2 : 1;
        suggestions.push({ id: `${variant}:${bedrooms}`, label: `${bedrooms}-bedroom ${variant === "villa" ? "single-storey home" : variant === "duplex" ? "two-storey home" : "compact home"}`, reason: `${floors === 2 ? "Bedrooms across two floors" : "All rooms on one floor"}; ${Math.round(footprintAreaM2)} m² building footprint, ${Math.floor(site.areaM2 - footprintAreaM2)} m² remaining outdoors.`, parameters: p, footprintAreaM2, totalAreaM2 });
      } catch { /* Do not offer a concept that fails dimensional checks. */ }
    }
  }
  // One suitable size per typology, rather than a catalogue of unrelated homes.
  return ["apartment", "villa", "duplex"].flatMap(variant => {
    const choices = suggestions.filter(s => s.parameters.variant === variant);
    return choices.length ? [choices[choices.length - 1]] : [];
  });
}

export function homeSiteFit(p: ResidentialParameters, site: HomeSite, heightMm = 3000, thicknessMm = 200) {
  const building = allocateBuilding(p, heightMm, thicknessMm);
  const width = building.polygon ? Math.max(...building.polygon.map(p => p.xMm)) + thicknessMm * 2 : building.allocation.widthMm + thicknessMm;
  const depth = building.polygon ? Math.max(...building.polygon.map(p => p.yMm)) + thicknessMm * 2 : building.allocation.depthMm + thicknessMm;
  const footprint = width * depth / 1e6;
  const parking = p.garage && p.garage !== "none" ? (p.garageWidthM ?? 3.5) * (p.garageDepthM ?? 6) : 0;
  const remainingAreaM2 = site.areaM2 - footprint - parking - (p.gardenAreaM2 ?? 0);
  const outdoorWidth = width + (parking ? 800 + (p.garageWidthM ?? 3.5) * 1000 : 0);
  const gardenDepth = p.gardenAreaM2 ? 1000 + p.gardenAreaM2 * 1e6 / (p.gardenPosition === "parking" ? (p.garageWidthM ?? 3.5) * 1000 : width) : 0;
  const outdoorDepth = p.gardenPosition === "parking" ? Math.max(depth, (p.garageDepthM ?? 6) * 1000 + gardenDepth) : Math.max(depth, parking ? (p.garageDepthM ?? 6) * 1000 : 0) + gardenDepth;
  return { building, footprintAreaM2: footprint, remainingAreaM2, fits: remainingAreaM2 >= -.1 && (!site.widthM || outdoorWidth <= site.widthM * 1000 + 1) && (!site.lengthM || outdoorDepth <= site.lengthM * 1000 + 1) };
}
