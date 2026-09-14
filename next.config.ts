import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent ~/package-lock.json must not become the Turbopack workspace root.
  turbopack: {
    root: path.join(__dirname),
    resolveAlias: {
      // The package's multi-file entry has circular class dependencies that
      // crash during production module evaluation. Its published bundle orders
      // those classes correctly and exposes the same API.
      "@node-projects/acad-ts": "./node_modules/@node-projects/acad-ts/dist/index-min.js",
    },
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
  // Case normalization lives in proxy.ts. Config redirects match without
  // case sensitivity, so /Werkzeug -> /werkzeug redirects to itself forever.
};

export default nextConfig;
