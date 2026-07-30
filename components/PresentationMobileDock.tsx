"use client";

import { useState } from "react";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { heading } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import GlassPanel from "./GlassPanel";
import LegendBody from "./LegendBody";
import PresentationSidePanel from "./PresentationSidePanel";

type Props = {
  /** Portrait: centered. Landscape: flush right + bottom. */
  align: "center" | "right";
};

/**
 * Presentation: arrow on top → options between arrow & legend → legend.
 */
export default function PresentationMobileDock({ align }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const [expanded, setExpanded] = useState(false);
  const isRight = align === "right";

  return (
    <div
      className={`pointer-events-auto fixed z-40 ${
        isRight
          ? "right-[3.75rem] bottom-[calc(4.15rem+env(safe-area-inset-bottom,0px))] w-[min(calc(100vw-5rem),18rem)]"
          : "left-1/2 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] w-[min(100vw-1rem,20rem)] -translate-x-1/2"
      }`}
    >
      <GlassPanel variant="panel" zIndex={40}>
        <div className="flex max-h-[min(62vh,26rem)] flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={t(uiLanguage, "moreOptions")}
            className="flex w-full shrink-0 items-center justify-center border-b border-white/40 py-1 text-zinc-600 active:bg-white/30"
          >
            {expanded ? (
              <IoChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <IoChevronUp className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>

          <div
            className={`min-h-0 overflow-hidden transition-[max-height,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
              expanded
                ? "max-h-[min(40vh,16rem)] opacity-100"
                : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="max-h-[min(40vh,16rem)] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5">
                <p className={heading.panel}>{t(uiLanguage, "moreOptions")}</p>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label={t(uiLanguage, "closePanels")}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-600 active:bg-white/40"
                >
                  <IoChevronDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <PresentationSidePanel includeLegend={false} compact />
            </div>
          </div>

          <div className="shrink-0 border-t border-white/35">
            <LegendBody compact />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
