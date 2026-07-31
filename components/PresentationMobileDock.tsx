"use client";

import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import LegendBody from "./LegendBody";
import PresentationSidePanel from "./PresentationSidePanel";

type Props = {
  /** Portrait: centered. Landscape: flush right + bottom. */
  align: "center" | "right";
};

/**
 * Presentation mobile: legend (with more menu) + floor select when isolate is on.
 */
export default function PresentationMobileDock({ align }: Props) {
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const isRight = align === "right";

  return (
    <div
      className={`pointer-events-auto fixed z-40 ${
        isRight
          ? "right-[3.75rem] bottom-[calc(3.7rem+env(safe-area-inset-bottom,0px))] w-[min(calc(100vw-5rem),18rem)]"
          : "left-1/2 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] w-[min(100vw-1rem,20rem)] -translate-x-1/2"
      }`}
    >
      <GlassPanel variant="panel" zIndex={40}>
        <div
          className={`flex flex-col ${
            presentationIsolate
              ? "max-h-[min(78vh,34rem)] min-h-0 overflow-hidden"
              : "thin-scroll max-h-[min(62vh,26rem)] overflow-y-auto overscroll-contain"
          }`}
        >
          <div className="shrink-0">
            <LegendBody compact />
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
