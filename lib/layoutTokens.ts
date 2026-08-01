/** Left panel / header width — matches ViewerApp left aside Tailwind breakpoints. */
export function leftPanelWidthPx(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280): number {
  if (viewportWidth >= 1024) return Math.min(360, viewportWidth - 32);
  if (viewportWidth >= 768) return Math.min(340, viewportWidth - 32);
  return Math.min(300, viewportWidth - 24);
}

/** Phone / short viewport — not desktop layout (matches ViewerApp). */
export function isCompactMobileViewport(
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
): boolean {
  return !(viewportWidth >= 768 && viewportHeight >= 560);
}

/** Landscape phone / tablet — compact UI with side dock layout. */
export function isLandscapeMobile(
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
): boolean {
  return viewportWidth > viewportHeight && isCompactMobileViewport(viewportWidth, viewportHeight);
}

/** Full-height mobile dock — below header, above safe area / toolbar. */
export const mobileDockTopClass =
  "top-[calc(3.25rem+env(safe-area-inset-top,0px))]";

export const mobileDockBottomLandscapeClass =
  "bottom-[max(0.35rem,env(safe-area-inset-bottom,0px))]";

export const mobileDockBottomPortraitClass =
  "bottom-[calc(3.7rem+env(safe-area-inset-bottom,0px))]";

export function mobileDockHeightCss(landscapeMobile: boolean): string {
  return landscapeMobile
    ? "calc(100dvh - 3.25rem - env(safe-area-inset-top, 0px) - max(0.65rem, env(safe-area-inset-bottom, 0px)))"
    : "calc(100dvh - 3.25rem - env(safe-area-inset-top, 0px) - calc(3.7rem + env(safe-area-inset-bottom, 0px)))";
}

/** Landscape bottom bar / mirrored corner controls — matches ViewerToolbar insets. */
export const mobileLandscapeBottomClass =
  "bottom-[max(0.65rem,env(safe-area-inset-bottom,0px))]";

export const mobileLandscapeLeftClass =
  "left-[max(0.5rem,env(safe-area-inset-left))]";

export const mobileLandscapeRightClass =
  "right-[max(0.5rem,env(safe-area-inset-right,0px))]";

/** Right-aligned landscape panel widths — flush to right inset, not centered. */
export const mobileLandscapeLegendWidthClass =
  "w-[min(20rem,calc(100vw-max(0.5rem,env(safe-area-inset-right,0px))-max(0.5rem,env(safe-area-inset-left,0px))))]";

export const mobileLandscapeOptionsWidthClass =
  "w-[min(24rem,calc(100vw-max(0.5rem,env(safe-area-inset-right,0px))-max(0.5rem,env(safe-area-inset-left,0px))))]";

export const mobileSafeTopClass = "top-[calc(3.25rem+env(safe-area-inset-top,0px))]";
export const mobileSafeBottomClass = "bottom-[max(0.35rem,env(safe-area-inset-bottom,0px))]";

export const leftPanelInsetClass = "left-2 md:left-4";

export const leftPanelWidthClass =
  "w-[min(300px,calc(100vw-1.5rem))] md:w-[min(340px,calc(100vw-2rem))] lg:w-[min(360px,calc(100vw-2rem))]";
