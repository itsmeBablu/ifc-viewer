import { describe, expect, it } from "vitest";
import { planSchema } from "./schema";
import { parseModelReply } from "./protocol";

const wall = { kind: "wall", operation: "create", id: "w1", levelId: "l1", startXmm: 0, startYmm: 0, endXmm: 5000, endYmm: 0, thicknessMm: 200, heightMm: 3000 };
describe("AI function protocol", () => {
  it("accepts bounded geometry and rejects unknown fields, wrong types and nonfinite numbers", () => {
    const plan = { summary: "One wall", assumptions: [], actions: [wall] };
    expect(planSchema.safeParse(plan).success).toBe(true);
    for (const patch of [{ thicknessMm: -1 }, { heightMm: "3000" }, { startXmm: Infinity }, { code: "alert(1)" }]) {
      expect(planSchema.safeParse({ ...plan, actions: [{ ...wall, ...patch }] }).success).toBe(false);
    }
  });
  it("rejects unsupported, truncated or mixed clarification/action responses", () => {
    const call = { functionCall: { name: "propose_model", args: { summary: "Wall", assumptions: [], actions: [wall] } } };
    expect(parseModelReply({ candidates: [{ finishReason: "STOP", content: { parts: [call] } }] }).kind).toBe("plan");
    expect(() => parseModelReply({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [call] } }] })).toThrow();
    expect(() => parseModelReply({ candidates: [{ finishReason: "STOP", content: { parts: [call, { functionCall: { name: "ask_clarification", args: { question: "Size?" } } }] } }] })).toThrow();
  });
});
