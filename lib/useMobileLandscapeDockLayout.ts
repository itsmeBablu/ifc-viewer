"use client";

import { useLayoutEffect, useState } from "react";

export type MobileLandscapeDockLayout = {
  /** Header top edge — dock top aligns here. */
  top: number;
  /** Usable height from header top to bottom inset. */
  maxHeight: number;
};

const BOTTOM_INSET_PX = 10.4; // max(0.65rem) at 16px root

function measureLayout(): MobileLandscapeDockLayout | null {
  if (typeof window === "undefined") return null;

  const header =
    document.querySelector("[data-app-header-actions]") ??
    document.querySelector("[data-app-header]");
  const top = header
    ? header.getBoundingClientRect().top
    : 8 + Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "env(safe-area-inset-top)",
        ) || "0",
      );

  const vv = window.visualViewport;
  const viewportHeight = vv?.height ?? window.innerHeight;
  const maxHeight = Math.max(120, viewportHeight - top + (vv?.offsetTop ?? 0) - BOTTOM_INSET_PX);

  return { top, maxHeight };
}

/** Landscape mobile dock geometry aligned to the live header row. */
export function useMobileLandscapeDockLayout(enabled: boolean) {
  const [layout, setLayout] = useState<MobileLandscapeDockLayout | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setLayout(null);
      return;
    }

    const update = () => setLayout(measureLayout());

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return layout;
}
