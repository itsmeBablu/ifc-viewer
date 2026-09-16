export const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite";
const ECONOMY_MODELS = [DEFAULT_AI_MODEL, "gemini-3.5-flash-lite"] as const;

export function aiModel() {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;
  if (!ECONOMY_MODELS.some(allowed => model === allowed)) {
    throw new Error("Choose gemini-3.1-flash-lite or gemini-3.5-flash-lite for GEMINI_MODEL. Automatic upgrades to more expensive models are disabled.");
  }
  return model;
}
