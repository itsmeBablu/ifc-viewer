import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "./next.config";
import { proxy } from "./proxy";

describe("public route redirects", () => {
  it.each(["/", "/werkzeug", "/werkzeug?project=example"])(
    "does not redirect the canonical URL %s",
    async (path) => {
      const url = `https://example.com${path}`;
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig });
      expect(response.headers.get("location")).toBeNull();
      expect(proxy(new NextRequest(url)).headers.get("location")).toBeNull();
    },
  );

  it.each(["/Werkzeug", "/WERKZEUG"])(
    "normalizes %s once and preserves query parameters",
    async (path) => {
      const response = proxy(new NextRequest(`https://example.com${path}?project=example`));
      const destination = response.headers.get("location")!;
      expect(destination).toBe("https://example.com/werkzeug?project=example");
      expect(proxy(new NextRequest(destination)).headers.get("location")).toBeNull();
      const configured = await unstable_getResponseFromNextConfig({ url: destination, nextConfig });
      expect(configured.headers.get("location")).toBeNull();
    },
  );
});
