import { auth } from "@/auth";
import { commandRequestSchema } from "@/lib/ai/protocol";
import { generateCommand } from "@/lib/ai/gemini";
import { generateOllamaCommand } from "@/lib/ai/ollama";
import { limitAiUser } from "@/lib/ai/rateLimit";
import { MAX_REQUEST_BYTES } from "@/lib/ai/attachments";
import { GeminiError } from "@/lib/ai/providerError";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_BYTES = MAX_REQUEST_BYTES;
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

async function readBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Missing command.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error("Project context is too large. Use a smaller project."); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  let session;
  try { session = await auth(); } catch { return reply({ error: "Google sign-in is not configured." }, 503); }
  if (!session?.user?.id) return reply({ error: "Sign in with Google to use AI commands." }, 401);
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (!origin || origin !== expectedOrigin) return reply({ error: "Request origin is not allowed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Send a JSON command." }, 415);
  let input;
  try {
    input = commandRequestSchema.parse(await readBody(request));
  } catch { return reply({ error: "Invalid or oversized command. Check the text and project context." }, 400); }
  let limit: Awaited<ReturnType<typeof limitAiUser>>;
  try {
    limit = await limitAiUser(session.user.id);
    if (!limit.success) {
      const retryAfter = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000));
      return reply({ error: `AI request limit reached. Try again in about ${Math.ceil(retryAfter / 60)} minute(s).`, retryAfter }, 429, { "Retry-After": String(retryAfter), "X-AI-Remaining": "0", "X-AI-Reset": String(limit.reset), "X-AI-Total": String(limit.total) });
    }
  } catch {
    limit = { success: true, remaining: 1500, reset: Date.now() + 24 * 3600 * 1000, total: 1500 };
  }
  try { return reply(await (input.model === "ollama-local" ? generateOllamaCommand(input) : generateCommand(input)), 200, { "X-AI-Remaining": String(limit.remaining), "X-AI-Reset": String(limit.reset), "X-AI-Total": String(limit.total) }); }
  catch (error) {
    // Never return raw provider payloads, credentials or stack traces.
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "AI took too long to respond. Try a smaller request."
      : error instanceof Error && !error.name.includes("Zod") && !(error instanceof TypeError) && !(error instanceof SyntaxError)
        ? error.message : "AI could not produce a valid response. Please try again.";
    return reply({ error: message, ...(error instanceof GeminiError ? { code: error.code, provider: "gemini" } : {}) }, error instanceof GeminiError ? error.status : 502,
      { "X-AI-Remaining": String(limit.remaining), "X-AI-Reset": String(limit.reset), "X-AI-Total": String(limit.total),
        ...(error instanceof GeminiError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) });
  }
}
