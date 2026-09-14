import { describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";

const captured = vi.hoisted(() => ({ config: {} as NextAuthConfig }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => { captured.config = config; return {}; } }));
import "./auth";

describe("Google identity", () => {
  it("uses the stable provider account ID, not email or client input", async () => {
    const jwt = captured.config.callbacks!.jwt!;
    const token = await jwt({ token: { email: "user@example.com" }, account: { provider: "google", providerAccountId: "google-123" } } as Parameters<typeof jwt>[0]);
    expect(token).toMatchObject({ googleId: "google-123" });
    const sessionCallback = captured.config.callbacks!.session!;
    const session = await sessionCallback({ session: { user: {}, expires: "2099-01-01" }, token } as Parameters<typeof sessionCallback>[0]);
    expect(session.user?.id).toBe("google-123");
    expect(captured.config.session?.strategy).toBe("jwt");
  });
});
