"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import LegendBody from "./LegendBody";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import PresentationSidePanel from "./PresentationSidePanel";

type Props = {
  /** Portrait: centered. Landscape: flush right, full height. */
  align: "center" | "right";
  /** Landscape phone — legend dock spans full viewport height. */
  landscapeMobile?: boolean;
};

/**
 * Presentation mobile: legend with in-flow heating/options.
 * Opening a menu grows the dock upward so content stays inside the glass.
 */
export default function PresentationMobileDock({
  align,
  landscapeMobile = false,
}: Props) {
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const [menuOpen, setMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRight = align === "right";

  const fullHeight =
    "calc(100dvh - 3.25rem - env(safe-area-inset-top, 0px) - max(0.35rem, env(safe-area-inset-bottom, 0px)))";

  const maxHeight = landscapeMobile
    ? fullHeight
    : menuOpen
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
        landscapeMobile
          ? "right-2 top-[calc(3.25rem+env(safe-area-inset-top,0px))] bottom-[max(0.35rem,env(safe-area-inset-bottom,0px))] w-[min(calc(100vw-5rem),20rem)]"
          : isRight
            ? "right-2 bottom-[calc(3.7rem+env(safe-area-inset-bottom,0px))] w-[min(calc(100vw-4.25rem),20rem)]"
            : "left-1/2 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] w-[min(100vw-0.5rem,22.5rem)] -translate-x-1/2"
      }`}
    >
      <GlassPanel
        variant="panel"
        zIndex={40}
        fill={landscapeMobile}
        wrapperClassName={landscapeMobile ? "h-full" : undefined}
      >
        <div
          ref={bodyRef}
          className={`flex min-h-0 flex-col thin-scroll overflow-y-auto overscroll-contain ${
            landscapeMobile ? "h-full" : ""
          }`}
          style={{ maxHeight: landscapeMobile ? fullHeight : maxHeight }}
        >
          <div className="shrink-0">
            <LegendBody
              compact
              onPresentationMenuOpenChange={setMenuOpen}
            />
          </div>

          {presentationIsolate && (
            <div className="min-h-0 shrink-0 border-t border-[var(--panel-divider)]">
              <PresentationSidePanel includeLegend={false} compact />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
