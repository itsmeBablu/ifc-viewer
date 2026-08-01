"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import GsapHeightAccordion from "./GsapHeightAccordion";
import LegendBody from "./LegendBody";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import PresentationSidePanel from "./PresentationSidePanel";

type Props = {
  /** Portrait: centered. Landscape: flush right + bottom. */
  align: "center" | "right";
};

/**
 * Presentation mobile: legend with in-flow heating/options.
 * Opening a menu grows the dock upward so content stays inside the glass.
 */
export default function PresentationMobileDock({ align }: Props) {
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const [menuOpen, setMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRight = align === "right";

  const maxHeight = menuOpen
    ? "min(calc(100dvh - 5rem), 40rem)"
    : presentationIsolate
      ? "min(78vh, 34rem)"
      : "min(52vh, 22rem)";

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    gsap.to(el, {
      maxHeight,
      duration: gsapDuration.accordion,
      ease: gsapEase.ios,
    });
  }, [maxHeight]);

  return (
    <div
      className={`pointer-events-auto fixed z-40 ${
        isRight
          ? "right-2 bottom-[calc(3.7rem+env(safe-area-inset-bottom,0px))] w-[min(calc(100vw-4.25rem),20rem)]"
          : "left-1/2 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] w-[min(100vw-0.5rem,22.5rem)] -translate-x-1/2"
      }`}
    >
      <GlassPanel variant="panel" zIndex={40}>
        <div
          ref={bodyRef}
          className="flex min-h-0 flex-col thin-scroll overflow-y-auto overscroll-contain"
          style={{ maxHeight }}
        >
          <div className="shrink-0">
            <LegendBody
              compact
              onPresentationMenuOpenChange={setMenuOpen}
            />
          </div>

          {presentationIsolate && (
            <div className="shrink-0 border-t border-white/35">
              <PresentationSidePanel includeLegend={false} compact />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
