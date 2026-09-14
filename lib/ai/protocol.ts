import { z } from "zod";

export const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(4000),
  context: z.object({
    projectId: z.string().min(1).max(200),
    activeLevelId: z.string().max(200).nullable(),
    elements: z.array(z.record(z.string(), z.unknown())).max(1000),
  }).strict(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) }).strict()).max(12).default([]),
}).strict();

export type CommandRequest = z.infer<typeof commandRequestSchema>;

export const functionDeclarations = [{
  name: "ask_clarification",
  description: "Ask for essential missing house dimensions, storeys, room requirements, or ambiguous element references. Do not guess consequential design choices.",
  parameters: { type: "OBJECT", properties: { question: { type: "STRING" } }, required: ["question"] },
}];

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
    if (calls.length !== 1 || calls[0].name !== "ask_clarification") throw new Error("The AI returned an unsupported action.");
    const { question } = z.object({ question: z.string().trim().min(1).max(8000) }).strict().parse(calls[0].args);
    return { kind: "clarification" as const, message: question };
  }
  const message = parts.map(p => p.text ?? "").join("\n").trim();
  if (!message || message.length > 8000) throw new Error("The AI returned no usable response.");
  return { kind: "clarification" as const, message };
}
