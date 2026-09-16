import { DEFAULT_AI_MODEL, isAiModelId } from "./models";

export function aiModel(requested?: string) {
  const model = requested ?? (process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL);
  if (!isAiModelId(model)) {
    throw new Error("The selected Gemini model is not supported. Choose a model from the assistant's model selector.");
  }
  return model;
}
