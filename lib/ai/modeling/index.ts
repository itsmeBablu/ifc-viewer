import type { CommandRequest } from "../protocol";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";

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
  const match = input.command.trim().toLowerCase().match(/^(?:please\s+)?(?:create|build|make|model)\s+(?:a|an)?\s*(?:(one|two|three|four|[1-4])[-\s]*(?:bedroom|bed room)\s+(?:apartment|appartement|flat))(?:\s+(?:with|using))?(?:\s+(?:default|standard|basic)(?:\s+sizes?)?)?[.!]?$/);
  if (!match) return null;
  const bedrooms = Number(match[1]) || ({ one: 1, two: 2, three: 3, four: 4 }[match[1]] ?? 2);
  const id = `apartment-${crypto.randomUUID()}`;
  const levelId = input.context.activeLevelId ?? `${id}:level`;
  const existingWalls = input.context.elements.filter(e => e.kind === "wall" && e.levelId === levelId);
  const ends = existingWalls.flatMap(e => [e.properties.startXmm, e.properties.endXmm]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const xMm = ends.length ? Math.max(...ends) + 2000 : 0;
  const plan = expandModelPlan({ summary: `${bedrooms}-bedroom concept apartment with 20 m² bedrooms, a corridor, bathroom and open living/kitchen area.`,
    assumptions: ["Concept defaults: each bedroom 4 × 5 m clear; bathroom 2 × 4 m; corridor 1.2 m clear.", "Project wall height and exterior thickness; 150 mm partitions; 200 mm floor.", "Unfurnished layout; no roof or engineered MEP design.", ...(ends.length ? ["Placed 2 m to the right of existing wall extents."] : ["Origin at 0,0 on the active or new ground level."])],
    actions: [...(input.context.activeLevelId ? [] : [{ kind: "level", operation: "create", id: levelId, name: "Ground", elevationMm: 0, heightMm: input.context.defaults.wallHeightMm }]),
      { kind: "apartment_layout", id, levelId, bedrooms, xMm, heightMm: input.context.defaults.wallHeightMm, thicknessMm: input.context.defaults.wallThicknessMm }] });
  return { kind: "plan" as const, plan: validatePlan(plan, input.context), model: input.model ?? "gemini-3.1-flash-lite", mode: "build" as const, usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 } };
}

export const MODELING_DEFAULT_GUIDE = "For routine creation, assume a single active/ground level and concept dimensions; do not ask for routine sizes. Bedrooms 20 m² (4×5 m), living 24 m², kitchen 10 m², bathroom 8 m², corridor 1200 mm. Use apartment_layout for 1–4 bedroom apartments without a bespoke footprint: supply id, levelId, bedrooms and optional bedroomAreaM2/origin/project wall sizes; code creates partitions, circulation, doors, windows and floor. For bespoke footprints use existing recipes and actions. Columns 300×300 mm at project wall height; beams 200×400 mm at ceiling; cable trays 200×50 mm at 2500 mm; water pipes 22 mm, waste 108 mm at 1% slope, heating 28 mm; ducts 300×200 mm at 2600 mm. Use catalogue dimensions for furniture/equipment. Choose simple concept routes only for new standalone systems; existing connections need evidence. Honor explicit dimensions, disclose assumptions, and ask only about ambiguous edits/connections or constraints that prevent a coherent layout. No code-compliance or performance claims.";
