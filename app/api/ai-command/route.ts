import { auth } from "@/auth";
import { commandRequestSchema } from "@/lib/ai/protocol";
import { generateCommand } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 256_000;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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
  try { return reply(await generateCommand(input)); }
  catch (error) {
    // Never return raw provider payloads, credentials or stack traces.
    const message = error instanceof Error && !error.name.includes("Zod") && error.name !== "TimeoutError" ? error.message : "AI could not produce a valid response. Please try again.";
    return reply({ error: message }, 502);
  }
}
