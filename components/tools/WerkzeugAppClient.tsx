"use client";

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import LiquidGlassSpinner from "@/components/common/LiquidGlassSpinner";

const WerkzeugApp = dynamic(() => import("./WerkzeugApp"), {
  ssr: false,
  loading: () => <WerkzeugLoadingFallback />,
});

function WerkzeugLoadingFallback() {
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
        label="Loading Werkzeug…"
        srLabel="Loading Werkzeug"
      />
    </div>
  );
}

export default function WerkzeugAppClient() {
  return <WerkzeugApp />;
}
