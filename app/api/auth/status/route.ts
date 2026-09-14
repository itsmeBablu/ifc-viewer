/**
 * Public Auth.js preflight. It intentionally exposes only whether the minimum
 * server configuration exists; OAuth credentials and the secret never leave
 * the server.
 */
export function GET() {
  const configured = Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET,
  );
  return Response.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}
