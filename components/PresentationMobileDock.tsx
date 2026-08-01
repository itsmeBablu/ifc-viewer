"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import LegendBody from "./LegendBody";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";
import PresentationSidePanel from "./PresentationSidePanel";
import {
  mobileDockBottomLandscapeClass,
  mobileDockBottomPortraitClass,
  mobileDockHeightCss,
  mobileDockTopClass,
} from "@/lib/layoutTokens";

type Props = {
  /** Portrait: centered. Landscape: flush right, full height. */
  align: "center" | "right";
  /** Landscape phone — legend dock spans full viewport height. */
  landscapeMobile?: boolean;
};

/**
 * Presentation mobile: legend with in-flow heating/options — full viewport height.
 */
export default function PresentationMobileDock({
  align,
  landscapeMobile = false,
}: Props) {
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRight = align === "right";
  const fullHeight = mobileDockHeightCss(landscapeMobile);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    gsap.to(el, {
      maxHeight: fullHeight,
      duration: gsapDuration.accordion,
      ease: gsapEase.ios,
    });
  }, [fullHeight]);

  return (
    <div
      className={`pointer-events-auto fixed z-40 ${mobileDockTopClass} ${
        landscapeMobile
          ? `${mobileDockBottomLandscapeClass} right-2 w-[min(calc(100vw-5rem),20rem)]`
          : isRight
            ? `${mobileDockBottomPortraitClass} right-2 w-[min(calc(100vw-4.25rem),20rem)]`
            : `${mobileDockBottomPortraitClass} left-1/2 w-[min(100vw-0.5rem,22.5rem)] -translate-x-1/2`
      }`}
    >
      <GlassPanel
        variant="panel"
        zIndex={40}
        fill
        wrapperClassName="h-full"
      >
        <div
          ref={bodyRef}
          className="flex h-full min-h-0 flex-col thin-scroll overflow-y-auto overscroll-contain"
          style={{ maxHeight: fullHeight, height: fullHeight }}
        >
          <div className="shrink-0">
            <LegendBody compact onPresentationMenuOpenChange={() => {}} />
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

