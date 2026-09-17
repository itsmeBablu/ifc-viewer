import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import type { CommandRequest } from "../protocol";
import { architectureGuide } from "./architecture";
import { equipmentGuide } from "./equipment";
import { mepGuide } from "./mep";

const architectureKinds = ["apartment_layout", "level", "wall", "wall_path", "rectangular_shell", "door", "window", "window_row", "floor", "roof", "column", "beam", "equipment", "equipment_grid"];
const mepKinds = ["level", "duct", "duct_run", "pipe", "pipe_run", "cabletray", "equipment", "equipment_grid"];

function guideEntry(guide: { id: string; instructions: string[]; example?: { actions: { kind: string }[] } }, kinds: Set<string>) {
  return { id: guide.id, instructions: guide.instructions,
    ...(guide.example && kinds.has(guide.example.actions[0].kind) ? { example: guide.example } : {}) };
}

/** Conservative routing reduces prompt size, never guesses or applies geometry. */
export function creationPlaybook(input: CommandRequest) {
  const text = [input.command, ...input.history.slice(-4).map(turn => turn.text)].join(" ").toLowerCase();
  const kinds = new Set<string>(["level"]);
  const guides = new Set<"architecture" | "mep" | "equipment">();
  const add = (values: string[], guide: "architecture" | "mep" | "equipment") => {
    values.forEach(kind => kinds.add(kind)); guides.add(guide);
  };
  const complex = input.attachments.length > 0 || /\b(house|home|building|layout|floor\s?plan|apartment|appartement|flat|bedroom|bungalow|haus|wohnung|grundriss)\b/.test(text);
  if (complex) add(architectureKinds, "architecture");
  if (/\b(shell|outline|walls?|partitions?|wand|wände|hülle)\b/.test(text)) add(["wall", "wall_path", "rectangular_shell"], "architecture");
  if (/\b(doors?|tür|türen)\b/.test(text)) add(["door", "wall", "wall_path"], "architecture");
  if (/\b(windows?|fenster)\b/.test(text)) add(["window", "window_row", "wall"], "architecture");
  if (/\b(floors?|slabs?|roofs?|dach|boden|decke)\b/.test(text)) add(["floor", "roof"], "architecture");
  if (/\b(columns?|beams?|stütze|träger)\b/.test(text)) add(["column", "beam"], "architecture");
  if (/\b(ducts?|ducting|ventilation|lüftung)\b/.test(text)) add(["duct", "duct_run"], "mep");
  if (/\b(pipes?|piping|plumbing|hydronic|drainage|rohr|rohre)\b/.test(text)) add(["pipe", "pipe_run"], "mep");
  if (/\b(cable|tray|trays|conduit|kabel)\b/.test(text)) add(["cabletray"], "mep");
  if (/\b(mep|hvac|heating|cooling|electrical|heizung|sanitär)\b/.test(text) || input.attachments.length > 0) add(mepKinds, "mep");
  const words = new Set(text.match(/[a-z][a-z0-9_-]{2,}/g) ?? []);
  ["wall", "walls", "floor", "floors", "roof", "room", "rooms", "ground", "level", "supply", "return", "create", "model", "build", "place"].forEach(word => words.delete(word));
  const matched = COMPONENT_CATALOG.filter(item => words.has(item.id) || [item.name, item.room, item.category].some(value =>
    value.toLowerCase().split(/[^a-z0-9]+/).some(word => word.length > 3 && (words.has(word) || words.has(word + "s")))));
  const equipmentRequested = matched.length > 0 || /\b(equipment|furniture|chairs?|tables?|radiators?|boilers?|fcu|ahu|diffusers?|grilles?|sprinklers?|fixtures?|möbel)\b/.test(text);
  if (equipmentRequested) add(["equipment", "equipment_grid"], "equipment");
  // Unknown, referential or multilingual briefs retain the complete tool vocabulary.
  const full = kinds.size === 1 || /\b(delete|remove|edit|update|change|move|resize|replace|undo|löschen|ändern|verschieben)\b/.test(text);
  if (full) { add(architectureKinds, "architecture"); add(mepKinds, "mep"); kinds.add("delete"); }
  // Compact concept apartments need one recipe, rather than every geometry schema.
  const defaultApartment = /\b(apartment|appartement|flat)\b/.test(input.command.toLowerCase())
    && /\b(default|standard|basic)\b/.test(input.command.toLowerCase())
    && /\b(?:[1-4]|one|two|three|four)[-\s]*(?:bedroom|bed room)\b/.test(input.command.toLowerCase())
    && !input.attachments.length && !full
    && !/\b(mep|duct|pipe|cable|footprint|storeys?|stories|roof|delete|edit|update|move|resize|furnished|furniture|equipment|beds?|chairs?|tables?|sofas?|radiators?)\b|\d\s*(?:m²|m2|mm|metres?|meters?)\b/.test(text);
  if (defaultApartment) { kinds.clear(); kinds.add("level"); kinds.add("apartment_layout"); }
  const catalog = kinds.has("equipment")
    ? (!complex && !full && matched.length ? matched : COMPONENT_CATALOG)
    : [];
  return {
    kinds: [...kinds], catalog,
    guide: [architectureGuide, mepGuide, equipmentGuide].filter(guide => guides.has(guide.id as "architecture" | "mep" | "equipment")).map(guide => guideEntry(guide, kinds)),
  };
}
