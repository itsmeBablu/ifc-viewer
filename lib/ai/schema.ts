import { z } from "zod";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";

const id = z.string().min(1).max(200);
const coordinate = z.number().min(-1_000_000).max(1_000_000);
const size = z.number().min(1).max(100_000);
const point = z.object({ xMm: coordinate, yMm: coordinate }).strict();
const base = { id, operation: z.enum(["create", "update"]).describe("Use create with a unique temporary ID, or update with an existing element ID. Supply every geometry field on updates.") };
export const levelFields = { name: z.string().trim().min(1).max(100), elevationMm: coordinate, heightMm: size };
export const wallFields = { levelId: id, startXmm: coordinate, startYmm: coordinate, endXmm: coordinate, endYmm: coordinate, thicknessMm: size, heightMm: size, wallType: z.enum(["exterior","partition","fire","curtain"]).optional() };
export const doorFields = { wallId: id, positionMm: z.number().min(0).max(1_000_000).describe("Opening centre distance along the wall from its start, in mm."), widthMm: size, heightMm: size, hinge: z.enum(["start", "end"]), swing: z.union([z.literal(1), z.literal(-1)]), style: z.enum(["wood", "metal", "glass", "double", "sliding", "garage"]) };
export const windowFields = { wallId: id, positionMm: doorFields.positionMm, widthMm: size, heightMm: size, sillHeightMm: z.number().min(0).max(100_000), operationType: z.enum(["single-hung", "double-hung", "casement", "fixed", "sliding"]) };
export const slabFields = { levelId: id, boundary: z.array(point).min(3).max(64), thicknessMm: size, elevationOffsetMm: coordinate, roofPreset: z.enum(["flat", "hip", "gable", "shed"]), pitchDeg: z.number().min(0).max(60) };
export const columnFields = { levelId: id, xMm: coordinate, yMm: coordinate, profile: z.enum(["rect", "circle", "i"]), widthMm: size, depthMm: size, heightMm: size };
export const beamFields = { levelId: id, startXmm: coordinate, startYmm: coordinate, endXmm: coordinate, endYmm: coordinate, profile: z.enum(["rect", "i"]), widthMm: size, depthMm: size, elevationOffsetMm: coordinate };
export const equipmentFields = { levelId: id, connectedHostId: id.optional(), familyId: z.enum(COMPONENT_CATALOG.map(p => p.id) as [string, ...string[]]), xMm: coordinate, yMm: coordinate, rotationDeg: z.number().min(-360).max(360), elevationMm: coordinate, widthMm: size.optional(), depthMm: size.optional(), heightMm: size.optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() };
export const ductFields = {
  levelId: id,
  startXmm: coordinate, startYmm: coordinate,
  endXmm: coordinate, endYmm: coordinate,
  shape: z.enum(["rectangular", "round"]).default("rectangular"),
  widthMm: size.optional(),
  heightMm: size.optional(),
  diameterMm: size.optional(),
  elevationOffsetMm: coordinate.default(2600),
  systemType: z.enum(["supply", "return", "exhaust", "fresh_air"]).default("supply"),
};
export const pipeFields = {
  levelId: id,
  startXmm: coordinate, startYmm: coordinate,
  endXmm: coordinate, endYmm: coordinate,
  slopePercent: z.number().min(0).max(20).default(0),
  diameterMm: size.default(28),
  elevationOffsetMm: coordinate.default(2500),
  systemType: z.enum(["hydronic_supply", "hydronic_return", "domestic_cold", "domestic_hot", "sanitary_waste", "fire_protection", "gas"]).default("hydronic_supply"),
};

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("level"), ...levelFields }).strict(),
  z.object({ ...base, kind: z.literal("wall"), ...wallFields }).strict(),
  z.object({ ...base, kind: z.literal("door"), ...doorFields }).strict(),
  z.object({ ...base, kind: z.literal("window"), ...windowFields }).strict(),
  z.object({ ...base, kind: z.literal("floor"), ...slabFields }).strict(),
  z.object({ ...base, kind: z.literal("roof"), ...slabFields }).strict(),
  z.object({ ...base, kind: z.literal("column"), ...columnFields }).strict(),
  z.object({ ...base, kind: z.literal("beam"), ...beamFields }).strict(),
  z.object({ ...base, kind: z.literal("equipment"), ...equipmentFields }).strict(),
  z.object({ ...base, kind: z.literal("duct"), ...ductFields }).strict(),
  z.object({ ...base, kind: z.literal("pipe"), ...pipeFields }).strict(),
  z.object({ ...base, kind: z.literal("cabletray"), levelId: id, startXmm: coordinate, startYmm: coordinate, endXmm: coordinate, endYmm: coordinate, widthMm: size, heightMm: size, elevationOffsetMm: coordinate, trayType: z.enum(["ladder", "perforated", "wire_mesh", "conduit"]) }).strict(),
  z.object({ kind: z.literal("delete"), id, targetKind: z.enum(["wall", "door", "window", "floor", "roof", "column", "beam", "equipment", "duct", "pipe", "cabletray"]) }).strict(),
]);
export const planSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  rationale: z.string().trim().min(1).max(2000).optional().describe("Explain the layout decisions, dimensions and how this addresses the user's brief. Do not claim changes are applied."),
  nextSteps: z.array(z.string().trim().min(1).max(400)).max(5).optional().describe("Specific remaining tasks or decisions after this preview, if any."),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(20),
  actions: z.array(actionSchema).min(1).max(5000),
}).strict();
export type AiAction = z.infer<typeof actionSchema>;
export type AiPlan = z.infer<typeof planSchema>;

// Context is a compact projection, never the user's IFC file or the complete store.
export const contextSchema = z.object({
  projectId: id,
  activeLevelId: id.nullable(),
  elements: z.array(z.object({
    id, kind: z.enum(["level", "wall", "door", "window", "floor", "roof", "column", "beam", "equipment", "duct", "pipe", "cabletray"]),
    levelId: id.optional(), wallId: id.optional(),
    properties: z.record(z.string(), z.unknown()),
  }).strict()).max(1000),
  selection: z.array(z.object({ kind: z.string().max(40), id }).strict()).max(100),
  defaults: z.object({ wallHeightMm: size, wallThicknessMm: size }).strict(),
}).strict();
export type AiContext = z.infer<typeof contextSchema>;
