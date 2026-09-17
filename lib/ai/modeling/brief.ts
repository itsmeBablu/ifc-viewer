const numbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const count = "(one|two|three|four|five|six|[1-6])";
const bedroom = "(?:bedrooms?|bed rooms?|beds?)";

/** Anchored grammar: never silently discard footprint, furniture or other constraints. */
export function defaultResidentialBrief(command: string) {
  const text = command.toLowerCase().trim()
    .replace(/\b(?:appartement|appartment|apartemtnt|apartement|appartamento)\b/g, "apartment")
    .replace(/[.!]+$/, "").replace(/\s+/g, " ")
    .replace(/^(?:please )?(?:(?:create|build|make|model|generate|add)(?: me)? |i want (?:you to (?:create|build|make) )?)/, "")
    .replace(/^(?:a|an) /, "")
    .replace(/(?: (?:with|using))? (?:default|standard|basic)(?: sizes?| dimensions?| layout)?$/, "");
  const prefix = text.match(new RegExp(`^${count}[- ]*${bedroom} (apartment|flat|villa|duplex(?: house)?|house|bungalow)$`));
  const suffix = text.match(new RegExp(`^(apartment|flat|villa|duplex(?: house)?|house|bungalow)(?: with)? ${count}[- ]*${bedroom}$`));
  const bare = text.match(/^(apartment|flat|villa|duplex(?: house)?|house|bungalow)$/);
  const noun = prefix?.[2] ?? suffix?.[1] ?? bare?.[1];
  if (!noun) return null;
  const variant = noun === "apartment" || noun === "flat" ? "apartment" : noun.startsWith("duplex") ? "duplex" : "villa";
  const value = prefix?.[1] ?? suffix?.[2];
  const bedrooms = value ? numbers[value] ?? Number(value) : variant === "apartment" ? 2 : variant === "duplex" ? 5 : 3;
  return { variant, bedrooms } as { variant: "apartment" | "villa" | "duplex"; bedrooms: number };
}
