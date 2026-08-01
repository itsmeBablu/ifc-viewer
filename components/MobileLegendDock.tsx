"use client";

import GlassPanel from "./GlassPanel";
import LegendPanel from "./LegendPanel";
import {
  mobileDockBottomLandscapeClass,
  mobileDockBottomPortraitClass,
  mobileDockHeightCss,
  mobileDockTopClass,
} from "@/lib/layoutTokens";

type Props = {
  landscapeMobile?: boolean;
};

/** Mobile: always-visible legend dock spanning full viewport height. */
export default function MobileLegendDock({ landscapeMobile = false }: Props) {
  const fullHeight = mobileDockHeightCss(landscapeMobile);

  return (
    <div
      className={`pointer-events-auto fixed right-2 z-40 ${mobileDockTopClass} ${
        landscapeMobile
          ? mobileDockBottomLandscapeClass
          : mobileDockBottomPortraitClass
      } w-[min(18rem,calc(100vw-5rem))]`}
    >
      <GlassPanel variant="panel" zIndex={40} fill wrapperClassName="h-full">
        <div
          className="thin-scroll h-full overflow-y-auto overscroll-contain"
          style={{ height: fullHeight }}
        >
          <LegendPanel />
        </div>
      </GlassPanel>
    </div>
  );
}
