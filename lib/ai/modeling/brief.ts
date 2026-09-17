import { z } from "zod";
import type { ResidentialParameters } from "./allocation";

const numbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const count = "(one|two|three|four|five|six|[1-6])";
const bedroom = "(?:bedrooms?|bed rooms?|beds?)";

/** Anchored grammar: never silently discard footprint, furniture or other constraints. */
export function defaultResidentialBrief(command: string) {
  let text = command.toLowerCase().trim()
    .replace(/\b(?:appartement|appartment|apartemtnt|apartement|appartamento)\b/g, "apartment")
    .replace(/[.!]+$/, "").replace(/\s+/g, " ")
    .replace(/^(?:please )?(?:(?:create|build|make|model|generate|add)(?: me)? |i want (?:you to (?:create|build|make) )?)/, "")
    .replace(/^(?:a|an) /, "")
    .replace(/(?: (?:with|using))? (?:default|standard|basic)(?: sizes?| dimensions?| layout)?$/, "");
  const areaUnit = "(?:m²|m2|sqm|sq\\.? ?m|square met(?:er|re)s?)";
  const areas: Partial<ResidentialParameters> = {};
  const clauses = new RegExp(`(?:,\\s*| (?:with|and) | )(total (?:internal )?area|(?:each )?bed ?rooms?|living(?: ?room)?|kitchen|bathrooms?)(?: (?:area|sizes?|of|is)|:|=)* ?(\\d+(?:\\.\\d+)?) ?${areaUnit}(?: each)?`, "g");
  let duplicate = false;
  text = text.replace(clauses, (_clause, label: string, value: string) => {
    const key = label.startsWith("total") ? "totalAreaM2" : label.includes("bed") ? "bedroomAreaM2" : label.startsWith("living") ? "livingAreaM2" : label.startsWith("kitchen") ? "kitchenAreaM2" : "bathroomAreaM2";
    if (areas[key] !== undefined) duplicate = true;
    areas[key] = Number(value); return "";
  });
  if (duplicate) return null;
  const totalArea = text.match(new RegExp(`(?: with| and|,)? (?:total (?:internal )?area(?: of)? |(?:of )?)(\\d+(?:\\.\\d+)?) ?${areaUnit}(?: total)?$`));
  if (totalArea) { areas.totalAreaM2 = Number(totalArea[1]); text = text.slice(0, totalArea.index); }
  text = text.trim().replace(/\s+/g, " ");
  const prefix = text.match(new RegExp(`^${count}[- ]*${bedroom} (apartment|flat|villa|duplex(?: house)?|house|bungalow)$`));
  const suffix = text.match(new RegExp(`^(apartment|flat|villa|duplex(?: house)?|house|bungalow)(?: with)? ${count}[- ]*${bedroom}$`));
  const bare = text.match(/^(apartment|flat|villa|duplex(?: house)?|house|bungalow)$/);
  const noun = prefix?.[2] ?? suffix?.[1] ?? bare?.[1];
  if (!noun) return null;
  const variant = noun === "apartment" || noun === "flat" ? "apartment" : noun.startsWith("duplex") ? "duplex" : "villa";
  const value = prefix?.[1] ?? suffix?.[2];
  const bedrooms = value ? numbers[value] ?? Number(value) : variant === "apartment" ? 2 : variant === "duplex" ? 5 : 3;
  return { variant, bedrooms, ...areas } as ResidentialParameters;
}
export const residentialOptions = {
  sketches: z.array(z.object({ points:z.array(z.object({xMm:z.number().min(0).max(80000),yMm:z.number().min(0).max(80000)}).strict()).min(3).max(32), lines:z.array(z.object({start:z.object({xMm:z.number().min(0).max(80000),yMm:z.number().min(0).max(80000)}).strict(),end:z.object({xMm:z.number().min(0).max(80000),yMm:z.number().min(0).max(80000)}).strict()}).strict()).max(30) }).strict()).min(1).max(4).optional(),
  furnished: z.boolean().optional(), underfloorHeating: z.boolean().optional(),
  piping: z.enum(["none", "underfloor", "ceiling"]).optional(), ducts: z.enum(["none", "ceiling"]).optional(),
  garage: z.enum(["none", "open", "enclosed"]).optional(), garageWidthM: z.number().min(3).max(12).optional(), garageDepthM: z.number().min(5.5).max(15).optional(),
  gardenAreaM2: z.number().min(0).max(2000).optional(),
  footprint: z.enum(["rectangle", "l", "u", "drawn"]).optional(), widthM: z.number().min(4).max(80).optional(), lengthM: z.number().min(4).max(80).optional(),
  footprintPoints: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(3).max(16).optional(),
};
export const residentialParametersSchema = z.object({
  variant: z.enum(["apartment", "villa", "duplex"]), bedrooms: z.number().int().min(1).max(6),
  bedroomAreaM2: z.number().min(7.5).max(100).optional(), totalAreaM2: z.number().min(30).max(2000).optional(),
  livingAreaM2: z.number().min(10).max(300).optional(), kitchenAreaM2: z.number().min(6).max(300).optional(), bathroomAreaM2: z.number().min(4).max(300).optional(),
  ...residentialOptions,
}).strict();
