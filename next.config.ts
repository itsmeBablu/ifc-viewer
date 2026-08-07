import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
