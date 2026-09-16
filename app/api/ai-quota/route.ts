import { auth } from "@/auth";
import { getAiUserQuota } from "@/lib/ai/rateLimit";

export const runtime = "nodejs";

export async function GET() {
  let session;
  try {
    session = await auth();
  } catch {
    return Response.json(
      { remaining: 1500, reset: Date.now() + 24 * 3600 * 1000, total: 1500 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!session?.user?.id) {
    return Response.json(
      { remaining: 1500, reset: Date.now() + 24 * 3600 * 1000, total: 1500 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const quota = await getAiUserQuota(session.user.id);
  return Response.json(quota, { headers: { "Cache-Control": "no-store" } });
}
