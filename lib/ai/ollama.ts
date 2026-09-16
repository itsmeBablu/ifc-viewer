import { z } from "zod";
import { SYSTEM_PROMPT } from "./gemini";
import { BIM_DEFAULTS } from "@/lib/bim/defaults";
import { compactCatalog, promptContext, promptHistory } from "./prompt";
import { modelPlanSchema, expandModelPlan } from "./recipes";
import { validatePlan } from "./validate";
import type { CommandRequest } from "./protocol";

const replySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), plan: modelPlanSchema }).strict(),
  z.object({ kind: z.literal("advice"), message: z.string().trim().min(1).max(8000) }).strict(),
  z.object({ kind: z.literal("clarification"), message: z.string().trim().min(1).max(8000) }).strict(),
]);
export async function generateOllamaCommand(input: CommandRequest) {
  if (input.attachments.length) throw new Error("Ollama text modeling does not accept attachments. Remove files or select Gemini.");
  const base = new URL(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid server OLLAMA_BASE_URL.");
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!model) throw new Error("Set OLLAMA_MODEL to an installed local model and start Ollama on the app server.");
  const mode = input.mode ?? "build";
  let response: Response;
  try {
    response = await fetch(new URL("/api/chat", base), {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(220000),
      body: JSON.stringify({ model, stream: false, think: false, format: z.toJSONSchema(replySchema, { target: "draft-7" }),
        options: { temperature: 0, num_predict: 8192, num_ctx: 8192 }, messages: [
          { role: "system", content: `${SYSTEM_PROMPT} Return JSON matching the schema instead of tool calls. Mode: ${mode}; Review and Guide MUST return advice or clarification, never a plan. Discipline: ${input.discipline ?? "arch"}. Preserve architecture in MEP unless asked. Use routine concept defaults and disclose assumptions: ${JSON.stringify(BIM_DEFAULTS)}` },
          { role: "user", content: JSON.stringify({ catalog: compactCatalog }) },
          ...promptHistory(input.history).map(turn => ({ role: turn.role, content: turn.text })),
          { role: "user", content: JSON.stringify({ command: input.command, project: promptContext(input.context) }) },
        ] }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw error;
    throw new Error("Cannot reach Ollama on the app server. Start Ollama and check OLLAMA_BASE_URL.");
  }
  if (response.status === 404) throw new Error("The configured Ollama model is not installed. Pull OLLAMA_MODEL on the app server.");
  if (!response.ok) throw new Error("Ollama could not complete this request. Check the local server and model.");
  const envelope = z.object({ done: z.literal(true), done_reason: z.string().optional(), message: z.object({ content: z.string() }) }).parse(await response.json());
  if (envelope.done_reason === "length") throw new Error("Ollama output was incomplete. Try a smaller request.");
  const result = replySchema.parse(JSON.parse(envelope.message.content));
  if (result.kind === "plan") {
    if (mode !== "build") throw new Error("Review and Guide cannot create changes.");
    return { kind: "plan" as const, plan: validatePlan(expandModelPlan(result.plan), input.context), model: "ollama-local" as const, mode };
  }
  return { ...result, model: "ollama-local" as const, mode };
}
