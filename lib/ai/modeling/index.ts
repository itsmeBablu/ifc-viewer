import type { CommandRequest } from "../protocol";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";
import { defaultResidentialBrief } from "./brief";

/** Only standalone, explicitly default briefs bypass language-model interpretation. */
export function defaultModelingPlan(input: CommandRequest) {
  if ((input.mode ?? "build") !== "build" || input.attachments.length || input.history.length || input.context.selection.length) return null;
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
  const brief = defaultResidentialBrief(input.command);
  if (!brief) return null;
  const { bedrooms, variant } = brief;
  const id = `${variant}-${crypto.randomUUID()}`;
  const levelId = input.context.activeLevelId ?? `${id}:level`;
  const existingWalls = input.context.elements.filter(e => e.kind === "wall" && e.levelId === levelId);
  const ends = existingWalls.flatMap(e => [e.properties.startXmm, e.properties.endXmm]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const xMm = ends.length ? Math.max(...ends) + 2000 : 0;
  const baseElevationMm = Number(input.context.elements.find(e => e.id === levelId && e.kind === "level")?.properties.elevationMm ?? 0);
  const plan = expandModelPlan({ summary: `${bedrooms}-bedroom concept ${variant} with 20 m² bedrooms, circulation, bathroom and open living/kitchen area.`,
    assumptions: ["Concept defaults: each bedroom 4 × 5 m clear; corridor 1.2 m clear.", "Project wall height and exterior thickness; 150 mm partitions; 200 mm floor.", variant === "apartment" ? "One storey, 8 m² bathroom; unfurnished, no roof or engineered MEP." : variant === "villa" ? "Single-storey villa with a spacious living/kitchen zone, bathroom and flat roof; unfurnished, no engineered MEP." : "Duplex means one two-storey dwelling; bedrooms split across floors, bathroom on each, flat roof. Unused sleeping-zone bays are studies.", ...(variant === "duplex" ? [`${Math.floor(bedrooms / 2)} bedrooms downstairs and ${Math.ceil(bedrooms / 2)} upstairs.`, "Concept stair uses slab solids with an upper-floor opening; railings and stair detailing remain."] : []), ...(ends.length ? ["Placed 2 m to the right of existing wall extents."] : ["Origin at 0,0 on the active or new ground level."])],
    actions: [...(input.context.activeLevelId ? [] : [{ kind: "level", operation: "create", id: levelId, name: "Ground", elevationMm: 0, heightMm: input.context.defaults.wallHeightMm }]),
      { kind: variant === "apartment" ? "apartment_layout" : "house_layout", ...(variant === "apartment" ? {} : { variant, baseElevationMm }), id, levelId, bedrooms, xMm, heightMm: input.context.defaults.wallHeightMm, thicknessMm: input.context.defaults.wallThicknessMm }] });
  return { kind: "plan" as const, plan: validatePlan(plan, input.context), model: input.model ?? "gemini-3.1-flash-lite", mode: "build" as const, usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 } };
}

export const MODELING_DEFAULT_GUIDE = "Create routine residential briefs automatically without asking for routine dimensions. Understand number words and apartment spelling variants. Use apartment_layout for 1–6 bedroom apartments (default two); house_layout variant villa for villas, houses and bungalows (default three bedrooms, one storey), variant duplex for a single two-storey dwelling (default five bedrooms). Set bedrooms from the request; for house_layout supply baseElevationMm from the ground level. Code computes rooms, circulation, doors, windows, slabs and house flat roof; duplex also creates the upper level, concept stair solids and floor opening. Never repeat generated geometry. Bedrooms default 20 m², corridor 1200 mm, project wall sizes. Extra house sleeping-zone bays are studies. Disclose these assumptions; do not ask whether defaults are acceptable. For explicit footprints/storeys, twin-unit duplexes or bespoke layouts, use suitable explicit actions/recipes honoring those constraints. Columns 300×300 mm at project wall height; beams 200×400 mm at ceiling; cable trays 200×50 mm at 2500 mm; water pipes 22 mm, waste 108 mm at 1% slope, heating 28 mm; ducts 300×200 mm at 2600 mm. Use catalogue dimensions for equipment. Choose simple concept routes for new standalone systems; existing connections need evidence. Ask only about ambiguous edits/connections or conflicting constraints. No compliance or performance claims. Stair solids are concept geometry without native stair semantics or railings.";
