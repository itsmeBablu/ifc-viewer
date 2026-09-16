export const AI_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", tier: "Economy", description: "Lowest cost. Quick edits and repeated elements.", thinkingLevel: "MINIMAL", maxOutputTokens: 8192 },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", tier: "Economy+", description: "Newer lightweight model for everyday modeling.", thinkingLevel: "LOW", maxOutputTokens: 8192 },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", tier: "Balanced", description: "More reasoning for coordinated layouts. Higher API cost.", thinkingLevel: "MEDIUM", maxOutputTokens: 12000 },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)", tier: "Advanced", description: "Detailed design reasoning and reviews. Highest cost; may take longer.", thinkingLevel: "MEDIUM", maxOutputTokens: 16000 },
] as const;

export type AiModelId = typeof AI_MODELS[number]["id"];
export const AI_MODEL_IDS = AI_MODELS.map(model => model.id) as [AiModelId, ...AiModelId[]];
export const DEFAULT_AI_MODEL: AiModelId = "gemini-3.1-flash-lite";
export const isAiModelId = (value: unknown): value is AiModelId => AI_MODELS.some(model => model.id === value);
export const modelDetails = (id: AiModelId) => AI_MODELS.find(model => model.id === id)!;

export const AI_MODES = [
  { id: "build", label: "Build", description: "Create or modify elements with a preview before applying." },
  { id: "review", label: "Review", description: "Assess layout, dimensions and selected elements. No model changes." },
  { id: "guide", label: "Guide", description: "Get modeling advice and step-by-step workflow help. No model changes." },
] as const;
export type AiMode = typeof AI_MODES[number]["id"];
export const isAiMode = (value: unknown): value is AiMode => AI_MODES.some(mode => mode.id === value);
