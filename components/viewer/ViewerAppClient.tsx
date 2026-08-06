"use client";

/**
 * ViewerAppClient — thin client boundary that lazy-loads ViewerApp via
 * `next/dynamic` with `ssr: false` (Three.js/WebGL needs the browser), showing
 * a fade-in glass spinner fallback while the chunk loads. This is the
 * component `app/page.tsx` actually renders.
 */

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import LiquidGlassSpinner from "../common/LiquidGlassSpinner";

const ViewerApp = dynamic(() => import("./ViewerApp"), {
  ssr: false,
  loading: () => <ViewerLoadingFallback />,
});

function ViewerLoadingFallback() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.fromTo(
      root,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: gsapDuration.overlay, ease: gsapEase.ios },
    );
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex h-dvh w-full items-center justify-center bg-[var(--background)] text-[var(--text-muted)]"
      style={{ visibility: "hidden" }}
    >
      <LiquidGlassSpinner
        size="lg"
        label="Loading viewer…"
        srLabel="Loading viewer"
      />
    </div>
  );
}

export default function ViewerAppClient() {
  return <ViewerApp />;
}
