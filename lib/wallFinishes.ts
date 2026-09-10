import { resolveWallLayers, type LayoutWall, type WallLayer } from "./layoutDrawing";

export type RenderMaterialTarget = "walls" | "walls-interior" | "walls-exterior" | "floors" | "roofs" | "doors" | "window-frames" | "window-glass";
type Finish = { id: string; color: string };

/** Keep the assembly thickness while assigning independent finishes to its two faces. */
export function wallFaceFinishes(wall: LayoutWall, types: { id: string; layers?: WallLayer[] }[], interior?: Finish, exterior?: Finish): Partial<LayoutWall> {
  let layers = resolveWallLayers(wall, types).map(layer => ({ ...layer }));
  if (layers.length === 1) {
    const core = layers[0];
    const finishMm = Math.min(1, core.thicknessMm / 4);
    layers = [
      { ...core, id: `${core.id}-inside`, name: "Interior finish", function: "finish1", thicknessMm: finishMm },
      { ...core, thicknessMm: core.thicknessMm - finishMm * 2 },
      { ...core, id: `${core.id}-outside`, name: "Exterior finish", function: "finish2", thicknessMm: finishMm },
    ];
  }
  if (interior) layers[0] = { ...layers[0], material: interior.id, color: interior.color };
  if (exterior) layers[layers.length - 1] = { ...layers[layers.length - 1], material: exterior.id, color: exterior.color };
  return { layers, ...(exterior ? { material: exterior.id, color: exterior.color } : {}) };
}
