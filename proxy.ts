import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep the public Werkzeug link forgiving about URL capitalization. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.toLowerCase() === "/werkzeug" && pathname !== "/werkzeug") {
    const url = request.nextUrl.clone();
    url.pathname = "/werkzeug";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
