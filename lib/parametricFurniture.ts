import type { LayoutMepEquipment } from "./layoutDrawing";

export type FurnitureParameters =
  | { kind: "dining"; shape: "circular" | "rectangular"; chairs: number }
  | { kind: "kitchen"; modules: number; moduleMm: number; upperCabinets: boolean };
export type FurniturePart = { key: string; familyId: string; xMm: number; yMm: number; elevationMm: number; rotationDeg: number; widthMm: number; depthMm: number; heightMm: number };
export const SEAT_SPACING_MM = 650;

export function defaultFurnitureParameters(familyId?: string): FurnitureParameters | undefined {
  if (familyId === "dining-table" || familyId === "round-table") return { kind: "dining", shape: familyId === "round-table" ? "circular" : "rectangular", chairs: 6 };
  if (familyId === "kitchen-straight") return { kind: "kitchen", modules: 5, moduleMm: 600, upperCabinets: false };
}

export function furnitureParametersFor(item: Partial<LayoutMepEquipment>) {
  const parameters = item.furnitureParameters ?? defaultFurnitureParameters(item.familyId);
  if (!item.furnitureParameters && parameters?.kind === "kitchen") {
    const moduleMm = item.moduleWidthMm ?? parameters.moduleMm;
    return { ...parameters, moduleMm, modules: Math.round((item.widthMm ?? 3000) / Math.max(1, moduleMm)) };
  }
  return parameters;
}

/** Reusable contract: persisted parameters -> pure dimensions + stable generated parts.
 * Parts are regenerated, never edited as independent model records. The owner stays
 * in the ordinary equipment/group system, so history, copies and saved groups retain
 * parameters. Future families add a parameter union member and a deterministic rule.
 */
export function evaluateFurniture(input: FurnitureParameters) {
  const parts: FurniturePart[] = [];
  const add = (key: string, familyId: string, xMm: number, yMm: number, widthMm: number, depthMm: number, heightMm: number, rotationDeg = 0, elevationMm = 0) => parts.push({ key, familyId, xMm, yMm, widthMm, depthMm, heightMm, rotationDeg, elevationMm });
  if (input.kind === "dining") {
    const chairs = Math.max(2, Math.min(20, Math.round(Number.isFinite(input.chairs) ? input.chairs : 6)));
    const circular = input.shape === "circular";
    const ends = !circular && chairs >= 4 ? 2 : 0;
    const sideCount = Math.ceil((chairs - ends) / 2);
    // Chord spacing keeps adjacent place settings at least 650 mm apart on circles.
    const widthMm = circular ? Math.ceil(Math.max(900, SEAT_SPACING_MM / Math.sin(Math.PI / chairs))) : Math.max(900, sideCount * SEAT_SPACING_MM + (ends ? 400 : 0));
    const depthMm = circular ? widthMm : 900;
    add("table", circular ? "round-table" : "dining-table", 0, 0, widthMm, depthMm, 750);
    if (circular) {
      for (let i = 0; i < chairs; i++) {
        const angle = i * Math.PI * 2 / chairs;
        add(`chair-${i}`, "dining-chair", Math.cos(angle) * (widthMm / 2 + 300), Math.sin(angle) * (widthMm / 2 + 300), 480, 520, 900, Math.atan2(-Math.cos(angle), -Math.sin(angle)) * 180 / Math.PI);
      }
    } else {
      let index = 0;
      for (const side of [-1, 1]) {
        const count = side === -1 ? sideCount : chairs - ends - sideCount;
        for (let i = 0; i < count; i++) add(`chair-${index++}`, "dining-chair", (i - (count - 1) / 2) * SEAT_SPACING_MM, side * (depthMm / 2 + 300), 480, 520, 900, side === -1 ? 0 : 180);
      }
      if (ends) for (const side of [-1, 1]) add(`chair-${index++}`, "dining-chair", side * (widthMm / 2 + 300), 0, 480, 520, 900, -side * 90);
    }
    return { parameters: { kind: "dining", shape: circular ? "circular" : "rectangular", chairs } as FurnitureParameters, widthMm, depthMm, heightMm: 750, parts };
  }
  const modules = Math.max(1, Math.min(24, Math.round(Number.isFinite(input.modules) ? input.modules : 5)));
  const moduleMm = [300, 400, 450, 500, 600, 800, 900].includes(input.moduleMm) ? input.moduleMm : 600;
  const widthMm = modules * moduleMm;
  for (let i = 0; i < modules; i++) {
    const x = (i - (modules - 1) / 2) * moduleMm;
    add(`base-${i}`, "kitchen-base", x, 0, moduleMm, 600, 860);
    if (input.upperCabinets) add(`upper-${i}`, "kitchen-wall", x, -125, moduleMm, 350, 720, 0, 1500);
  }
  add("countertop", "parametric-countertop", 0, 10, widthMm, 620, 40, 0, 860);
  return { parameters: { kind: "kitchen", modules, moduleMm, upperCabinets: Boolean(input.upperCabinets) } as FurnitureParameters, widthMm, depthMm: 600, heightMm: 900, parts };
}

export function normalizeParametricFurniture<T extends Partial<LayoutMepEquipment>>(item: T): T {
  const parameters = furnitureParametersFor(item);
  if (!parameters) return item;
  const result = evaluateFurniture(parameters);
  return { ...item, furnitureParameters: result.parameters, widthMm: result.widthMm, depthMm: result.depthMm, heightMm: result.heightMm, moduleWidthMm: result.parameters.kind === "kitchen" ? result.parameters.moduleMm : item.moduleWidthMm };
}
