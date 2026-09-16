import { z } from "zod";
import { contextSchema } from "./schema";
import { attachmentsSchema } from "./attachments";
import { expandModelPlan, modelPlanSchema } from "./recipes";
import { AI_MODEL_IDS, type AiMode } from "./models";

export const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(4000),
  model: z.enum(AI_MODEL_IDS).optional(),
  mode: z.enum(["build", "review", "guide"]).optional(),
  context: contextSchema,
  discipline: z.enum(["arch", "mep"]).optional(),
  attachments: attachmentsSchema.default([]),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) }).strict()).max(12).default([]),
}).strict();

export type CommandRequest = z.infer<typeof commandRequestSchema>;

export const functionDeclarations = [{
  name: "ask_clarification",
  description: "Ask for essential missing house dimensions, storeys, room requirements, or ambiguous element references. Do not guess consequential design choices.",
  parameters: { type: "OBJECT", properties: { question: { type: "STRING" } }, required: ["question"] },
}, {
  name: "answer_question",
  description: "Give useful modeling advice, a project review or workflow guidance without creating a plan. Ground findings in the supplied geometry; separate observations from suggestions. Use short headings and bullets when helpful, and finish with a concrete next step.",
  parameters: { type: "OBJECT", properties: { answer: { type: "STRING" } }, required: ["answer"] },
}, {
  name: "propose_model",
  description: "Propose one batch for preview, at most 150 expanded elements. Prefer rectangular_shell, wall_path, window_row and equipment_grid to avoid repeating coordinates. Mix recipes with explicit actions; order levels before walls, walls before openings. Generated recipe IDs can be referenced by later actions. Use explicit actions for edits/deletes. Never execute directly.",
  parametersJsonSchema: z.toJSONSchema(modelPlanSchema, { target: "draft-7" }),
}];

export function toolsForMode(mode: AiMode) {
  return mode === "build" ? functionDeclarations : functionDeclarations.filter(tool => tool.name !== "propose_model");
}

export function toolsForCreation(mode: AiMode, kinds: string[]) {
  if (mode !== "build") return toolsForMode(mode);
  const options = modelPlanSchema.shape.actions.element.options.filter(option => kinds.includes(option.shape.kind.value));
  if (!options.length) return toolsForMode(mode);
  const schema = modelPlanSchema.extend({
    actions: z.array(z.discriminatedUnion("kind", options as [typeof options[number], ...typeof options[number][]])).min(1).max(150),
  });
  return functionDeclarations.map(tool => tool.name === "propose_model"
    ? { ...tool, parametersJsonSchema: z.toJSONSchema(schema, { target: "draft-7" }) }
    : tool);
}

export const modelReplySchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.string().optional(),
    content: z.object({ parts: z.array(z.object({
      text: z.string().optional(),
      thought: z.boolean().optional(),
      functionCall: z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) }).optional(),
    })) }).optional(),
  })).optional(),
});

export function parseModelReply(value: unknown) {
  const candidate = modelReplySchema.parse(value).candidates?.[0];
  if (!candidate || candidate.finishReason !== "STOP") throw new Error("The AI response was incomplete. Please try a smaller request.");
  const parts = candidate.content?.parts.filter(p => !p.thought) ?? [];
  const calls = parts.flatMap(p => p.functionCall ? [p.functionCall] : []);
  if (calls.length) {
    if (calls.length === 1 && calls[0].name === "propose_model") return { kind: "plan" as const, plan: expandModelPlan(calls[0].args) };
    if (calls.length === 1 && calls[0].name === "answer_question") {
      const { answer } = z.object({ answer: z.string().trim().min(1).max(8000) }).strict().parse(calls[0].args);
      return { kind: "advice" as const, message: answer };
    }
    if (calls.length !== 1 || calls[0].name !== "ask_clarification") throw new Error("The AI returned an unsupported action.");
    const { question } = z.object({ question: z.string().trim().min(1).max(8000) }).strict().parse(calls[0].args);
    return { kind: "clarification" as const, message: question };
  }
  const message = parts.map(p => p.text ?? "").join("\n").trim();
  if (!message || message.length > 8000) throw new Error("The AI returned no usable response.");
  return { kind: "advice" as const, message };
}
