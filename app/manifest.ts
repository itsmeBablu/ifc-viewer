/**
 * Web app manifest for IBV Viewer.
 *
 * Declares PWA metadata (name, start URL, display mode, theme colors,
 * icon set) consumed by browsers/OSes for "install to home screen" and
 * standalone-window presentation. Next.js serves this as /manifest.webmanifest.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IBV Viewer",
    short_name: "IBV",
    description:
      "Client-side IFC viewer for building heating load (Heizlast) and room temperature visualization",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#f4f4f5",
    icons: [
      {
        src: "/ibv.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/ibv.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ibv.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ibv.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
