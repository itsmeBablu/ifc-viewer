import type { FloorSketch, ResidentialParameters, RoomUse } from "./allocation";
import { apartmentActions, apartmentSchema } from "./apartment";
import { houseActions, houseSchema } from "./house";
import { allocateBuilding, inscribedRectangle } from "./footprint";
import { clipSketchLines, sketchRooms } from "./sketch";
import { multiApartmentActions } from "./multiApartment";

/** Use the same native building compiler for preview, editable drafting and 3D. */
export function residentialSketches(parameters: ResidentialParameters, heightMm = 3000, thicknessMm = 200): FloorSketch[] {
  if (parameters.sketches?.length) return parameters.sketches.map(clipSketchLines);
  if (parameters.variant === "apartment" && (parameters.apartmentFloors || parameters.apartmentsPerFloor)) {
    const actions = multiApartmentActions(parameters, "preview", "preview:ground", 0, heightMm, thicknessMm);
    return Array.from({ length: parameters.apartmentFloors ?? 3 }, (_, floor) => {
      const slab = actions.find(a => a.kind === "floor" && a.id === `preview:floor:${floor}`);
      if (!slab || slab.kind !== "floor") throw new Error("Apartment floor plan is missing.");
      const levelId = floor ? `preview:level:${floor}` : "preview:ground";
      return clipSketchLines({ points: slab.boundary, lines: actions.flatMap(a => a.kind === "wall" && a.levelId === levelId && !a.id.includes("balcony") ? [{ start: { xMm: a.startXmm, yMm: a.startYmm }, end: { xMm: a.endXmm, yMm: a.endYmm } }] : []) });
    });
  }
  const building = allocateBuilding(parameters, heightMm, thicknessMm);
  const a = building.allocation;
  const points = building.polygon ?? [
    { xMm: 0, yMm: 0 }, { xMm: a.internalWidthMm, yMm: 0 },
    { xMm: a.internalWidthMm, yMm: a.internalDepthMm }, { xMm: 0, yMm: a.internalDepthMm },
  ];
  const { sketches: _sketches, variant, ...options } = parameters;
  void _sketches;
  const recipe = { ...options, id: "preview", levelId: "preview:ground", heightMm, thicknessMm, xMm: building.polygon ? 0 : -thicknessMm / 2, yMm: building.polygon ? 0 : -thicknessMm / 2 };
  const actions = variant === "apartment" ? apartmentActions(apartmentSchema.parse({ ...recipe, kind: "apartment_layout" }))
    : houseActions(houseSchema.parse({ ...recipe, kind: "house_layout", variant }));
  return Array.from({ length: a.floors }, (_, floor) => {
    const levelId = floor ? "preview:upper" : "preview:ground";
    const walls = actions.filter(action => action.kind === "wall" && action.levelId === levelId && !action.id.includes("garage") && !action.id.includes("balcony") && !action.id.includes(":outline:") && !/:wall:[0-3]$/.test(action.id));
    const sketch = clipSketchLines({ points: points.map(p => ({ ...p })), lines: walls.flatMap(action => action.kind === "wall" ? [{ start: { xMm: action.startXmm, yMm: action.startYmm }, end: { xMm: action.endXmm, yMm: action.endYmm } }] : []) });
    const rooms = sketchRooms(sketch);
    const ordered = [...rooms].sort((x, y) => Math.min(...x.map(p => p.yMm)) - Math.min(...y.map(p => p.yMm)) || Math.min(...x.map(p => p.xMm)) - Math.min(...y.map(p => p.xMm)));
    const beds = a.floors === 1 ? parameters.bedrooms : floor ? Math.ceil(parameters.bedrooms / 2) : Math.floor(parameters.bedrooms / 2);
    sketch.labels = ordered.map((room, i) => {
      const rect = inscribedRectangle(room);
      const use: RoomUse = i < beds ? "bedroom" : rect.depthMm <= 1600 ? "corridor" : rect.widthMm <= 3500 && rect.depthMm <= 4500 ? "bathroom" : "living";
      return { point: { xMm: rect.xMm + rect.widthMm / 2, yMm: rect.yMm + rect.depthMm / 2 }, name: use === "bedroom" ? `Bedroom ${i + 1}` : use === "living" ? "Living / kitchen" : use === "bathroom" ? "Bathroom" : "Hall", use };
    });
    return sketch;
  });
}
