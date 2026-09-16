import { z } from "zod";
import { actionSchema, planSchema, wallFields, equipmentFields, windowFields, type AiAction } from "./schema";

const id = z.string().min(1).max(160);
const coordinate = z.number().min(-1_000_000).max(1_000_000);
const point = z.object({ xMm: coordinate, yMm: coordinate }).strict();
const count = z.number().int().min(1).max(150);
const wallSize = { thicknessMm: wallFields.thicknessMm, heightMm: wallFields.heightMm };

export const recipeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rectangular_shell"), id, levelId: wallFields.levelId,
    xMm: coordinate, yMm: coordinate,
    widthMm: z.number().min(10).max(100_000), depthMm: z.number().min(10).max(100_000),
    ...wallSize,
    floorThicknessMm: z.number().min(1).max(100_000).optional(),
    roof: z.object({ preset: z.enum(["flat", "hip", "gable", "shed"]), pitchDeg: z.number().min(0).max(60), thicknessMm: z.number().min(1).max(100_000) }).strict().optional(),
  }).strict().describe("Create four walls on an existing/earlier-created level. x/y is the minimum wall-centre corner; width/depth are wall-centre spans. Optional floor at level elevation and roof at wall height. Wall IDs id:wall:0..3 run +X,+Y,-X,-Y. Floor/roof IDs id:floor,id:roof. No rooms or openings are inferred."),
  z.object({
    kind: z.literal("wall_path"), id, levelId: wallFields.levelId,
    points: z.array(point).min(2).max(64), closed: z.boolean(), ...wallSize,
  }).strict().describe("Create connected straight walls with shared dimensions. Do not repeat the closing point. IDs id:wall:0 onwards follow point order."),
  z.object({
    kind: z.literal("equipment_grid"), id, ...equipmentFields,
    columns: count, rows: count, stepXmm: coordinate, stepYmm: coordinate,
  }).strict().describe("Create equal catalogue items in a grid. x/y is the first centre. Columns advance in world X and rows in world Y; item rotation does not rotate the grid. IDs id:item:0 onwards, row-major. No layout is inferred."),
  z.object({
    kind: z.literal("window_row"), id, ...windowFields,
    count, spacingMm: z.number().min(1).max(100_000),
  }).strict().describe("Create identical windows along one host wall. positionMm is the first centre distance from wall start; spacingMm is centre-to-centre. IDs id:window:0 onwards."),
  z.object({
    kind: z.literal("duct_run"), id, levelId: wallFields.levelId,
    points: z.array(point).min(2).max(64),
    shape: z.enum(["rectangular", "round"]).default("rectangular"),
    widthMm: z.number().min(1).max(100_000).optional(),
    heightMm: z.number().min(1).max(100_000).optional(),
    diameterMm: z.number().min(1).max(100_000).optional(),
    elevationOffsetMm: z.number().min(-1_000_000).max(1_000_000).default(2600),
    systemType: z.enum(["supply", "return", "exhaust", "fresh_air"]).default("supply"),
  }).strict().describe("Create connected ventilation duct segments along waypoints. Points define the duct route. IDs id:duct:0 onwards."),
  z.object({
    kind: z.literal("pipe_run"), id, levelId: wallFields.levelId,
    points: z.array(point).min(2).max(64),
    diameterMm: z.number().min(1).max(100_000).default(28),
    elevationOffsetMm: z.number().min(-1_000_000).max(1_000_000).default(2500),
    systemType: z.enum(["hydronic_supply", "hydronic_return", "domestic_cold", "domestic_hot", "sanitary_waste", "fire_protection", "gas"]).default("hydronic_supply"),
  }).strict().describe("Create connected piping segments along waypoints. Points define the pipe route. IDs id:pipe:0 onwards."),
]);

// Existing explicit actions remain available for irregular geometry and edits.
export const modelPlanSchema = planSchema.extend({
  actions: z.array(z.discriminatedUnion("kind", [...recipeSchema.options, ...actionSchema.options])).min(1).max(150),
});

/** Expand bounded declarative recipes, never execute model-provided code. */
export function expandModelPlan(value: unknown) {
  const plan = modelPlanSchema.parse(value);
  const actions: AiAction[] = [];
  const append = (action: AiAction) => {
    if (actions.length >= 150) throw new Error("This build exceeds 150 elements. Split it into smaller batches.");
    actions.push(action);
  };
  for (const item of plan.actions) {
    switch (item.kind) {
      case "rectangular_shell": {
        const { xMm: x, yMm: y, widthMm: w, depthMm: d } = item;
        const points = [{ xMm: x, yMm: y }, { xMm: x + w, yMm: y }, { xMm: x + w, yMm: y + d }, { xMm: x, yMm: y + d }];
        points.forEach((p, i) => {
          const q = points[(i + 1) % 4];
          append({ kind: "wall", operation: "create", id: `${item.id}:wall:${i}`, levelId: item.levelId, startXmm: p.xMm, startYmm: p.yMm, endXmm: q.xMm, endYmm: q.yMm, thicknessMm: item.thicknessMm, heightMm: item.heightMm });
        });
        // Slabs extend to exterior wall faces, not just the wall centreline.
        const half = item.thicknessMm / 2;
        const boundary = [{ xMm: x - half, yMm: y - half }, { xMm: x + w + half, yMm: y - half }, { xMm: x + w + half, yMm: y + d + half }, { xMm: x - half, yMm: y + d + half }];
        if (item.floorThicknessMm !== undefined) append({ kind: "floor", operation: "create", id: `${item.id}:floor`, levelId: item.levelId, boundary, thicknessMm: item.floorThicknessMm, elevationOffsetMm: 0, roofPreset: "flat", pitchDeg: 0 });
        if (item.roof) append({ kind: "roof", operation: "create", id: `${item.id}:roof`, levelId: item.levelId, boundary, thicknessMm: item.roof.thicknessMm, elevationOffsetMm: item.heightMm, roofPreset: item.roof.preset, pitchDeg: item.roof.pitchDeg });
        break;
      }
      case "wall_path": {
        if (item.closed && item.points.length < 3) throw new Error("A closed wall path needs at least three points.");
        if (new Set(item.points.map(p => `${p.xMm},${p.yMm}`)).size !== item.points.length) throw new Error("Wall path points must be distinct; do not repeat the closing point.");
        const length = item.closed ? item.points.length : item.points.length - 1;
        for (let i = 0; i < length; i++) {
          const p = item.points[i], q = item.points[(i + 1) % item.points.length];
          append({ kind: "wall", operation: "create", id: `${item.id}:wall:${i}`, levelId: item.levelId, startXmm: p.xMm, startYmm: p.yMm, endXmm: q.xMm, endYmm: q.yMm, thicknessMm: item.thicknessMm, heightMm: item.heightMm });
        }
        break;
      }
      case "equipment_grid": {
        if (item.rows * item.columns > 150 - actions.length) throw new Error("This build exceeds 150 elements. Split it into smaller batches.");
        if (item.columns > 1 && item.stepXmm === 0 || item.rows > 1 && item.stepYmm === 0) throw new Error("Repeated items need nonzero spacing.");
        for (let row = 0; row < item.rows; row++) for (let column = 0; column < item.columns; column++) {
          append({ kind: "equipment", operation: "create", id: `${item.id}:item:${row * item.columns + column}`, familyId: item.familyId, levelId: item.levelId, xMm: item.xMm + column * item.stepXmm, yMm: item.yMm + row * item.stepYmm, rotationDeg: item.rotationDeg, elevationMm: item.elevationMm });
        }
        break;
      }
      case "window_row": {
        for (let i = 0; i < item.count; i++) append({ kind: "window", operation: "create", id: `${item.id}:window:${i}`, wallId: item.wallId, positionMm: item.positionMm + i * item.spacingMm, widthMm: item.widthMm, heightMm: item.heightMm, sillHeightMm: item.sillHeightMm, operationType: item.operationType });
        break;
      }
      case "duct_run": {
        for (let i = 0; i < item.points.length - 1; i++) {
          const p = item.points[i], q = item.points[i + 1];
          append({
            kind: "duct", operation: "create", id: `${item.id}:duct:${i}`, levelId: item.levelId,
            startXmm: p.xMm, startYmm: p.yMm, endXmm: q.xMm, endYmm: q.yMm,
            shape: item.shape, widthMm: item.widthMm ?? 300, heightMm: item.heightMm ?? 200, diameterMm: item.diameterMm ?? 250,
            elevationOffsetMm: item.elevationOffsetMm, systemType: item.systemType,
          });
        }
        break;
      }
      case "pipe_run": {
        for (let i = 0; i < item.points.length - 1; i++) {
          const p = item.points[i], q = item.points[i + 1];
          append({
            kind: "pipe", operation: "create", id: `${item.id}:pipe:${i}`, levelId: item.levelId,
            startXmm: p.xMm, startYmm: p.yMm, endXmm: q.xMm, endYmm: q.yMm,
            diameterMm: item.diameterMm, elevationOffsetMm: item.elevationOffsetMm, systemType: item.systemType,
          });
        }
        break;
      }
      default: append(item);
    }
  }
  // Check computed coordinates and the expanded cap before downstream validation.
  return planSchema.parse({ ...plan, actions });
}
