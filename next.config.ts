import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent ~/package-lock.json must not become the Turbopack workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Ensure three.js / web-ifc / That Open packages are transpiled for the App Router.
  transpilePackages: [
    "three",
    "web-ifc",
    "@thatopen/components",
    "@thatopen/fragments",
    "pdfjs-dist",
  ],
  // LibreDWG WASM is loaded only via dynamic import (API + client DWG path).
  serverExternalPackages: ["@mlightcad/libredwg-web"],
  async redirects() {
    return [
      {
        source: "/Werkzeug",
        destination: "/werkzeug",
        permanent: true,
      },
      {
        source: "/Werkzeug/:path*",
        destination: "/werkzeug/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
