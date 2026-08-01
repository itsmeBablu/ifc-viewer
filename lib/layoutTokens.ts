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

export const mobileSafeTopClass = "top-[calc(3.25rem+env(safe-area-inset-top,0px))]";
export const mobileSafeBottomClass = "bottom-[max(0.35rem,env(safe-area-inset-bottom,0px))]";

export const leftPanelInsetClass = "left-2 md:left-4";

export const leftPanelWidthClass =
  "w-[min(300px,calc(100vw-1.5rem))] md:w-[min(340px,calc(100vw-2rem))] lg:w-[min(360px,calc(100vw-2rem))]";
