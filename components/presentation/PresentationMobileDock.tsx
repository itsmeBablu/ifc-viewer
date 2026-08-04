"use client";

import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "../common/GlassPanel";
import LegendBody from "../legend/LegendBody";
import PresentationSidePanel from "./PresentationSidePanel";
import {
  mobileDockBottomPortraitClass,
  mobileDockHeightCss,
  mobileLandscapeBottomClass,
  mobileLandscapeRightClass,
} from "@/lib/layoutTokens";
import { useMobileLandscapeDockLayout } from "@/lib/useMobileLandscapeDockLayout";

type Props = {
  /** Portrait: centered. Landscape: flush right. */
  align: "center" | "right";
  landscapeMobile?: boolean;
};

/**
 * Presentation mobile: bottom-aligned, content height — grows upward to header
 * max cap; scrolls when content exceeds available space.
 */
export default function PresentationMobileDock({
  align,
  landscapeMobile = false,
}: Props) {
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const layout = useMobileLandscapeDockLayout(landscapeMobile);
  const isRight = align === "right";
  const portraitMaxHeight = mobileDockHeightCss(false);
  const landscapeMaxHeight =
    layout?.maxHeight ?? mobileDockHeightCss(true);

  return (
    <div
      className={`pointer-events-auto fixed z-40 ${
        landscapeMobile
          ? `${mobileLandscapeRightClass} ${mobileLandscapeBottomClass} w-[min(calc(100vw-5rem),20rem)]`
          : isRight
            ? `${mobileDockBottomPortraitClass} right-2 w-[min(calc(100vw-4.25rem),20rem)]`
            : `${mobileDockBottomPortraitClass} left-1/2 w-[min(100vw-0.5rem,22.5rem)] -translate-x-1/2`
      }`}
    >
      <GlassPanel
        variant="panel"
        zIndex={40}
        fill={false}
        allowOverflow
        wrapperClassName="max-h-[inherit] w-full min-w-0"
      >
        <div
          className="flex min-h-0 flex-col thin-scroll overflow-y-auto overscroll-contain"
          style={{
            maxHeight: landscapeMobile ? landscapeMaxHeight : portraitMaxHeight,
          }}
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
