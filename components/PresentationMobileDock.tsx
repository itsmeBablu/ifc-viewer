"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import LegendBody from "./LegendBody";
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
  const isRight = align === "right";

  const maxH = menuOpen
    ? "max-h-[min(calc(100dvh-5rem),40rem)]"
    : presentationIsolate
      ? "max-h-[min(78vh,34rem)]"
      : "max-h-[min(52vh,22rem)]";

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
          className={`flex min-h-0 flex-col thin-scroll overflow-y-auto overscroll-contain transition-[max-height] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${maxH}`}
        >
          <div className="shrink-0">
            <LegendBody
              compact
              onPresentationMenuOpenChange={setMenuOpen}
            />
          </div>

          {presentationIsolate && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/35">
              <PresentationSidePanel includeLegend={false} compact />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
