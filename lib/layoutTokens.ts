/**
 * Layout geometry tokens shared between the header and viewer chrome.
 *
 * Pixel/CSS-calc helpers (header width, left panel width, mobile dock
 * insets) that mirror the Tailwind breakpoints and safe-area insets used in
 * ViewerApp/ViewerToolbar, so JS-side measurements stay consistent with the
 * actual rendered layout.
 */

/** IBV wordmark aspect (ibv_logo.svg viewBox). */
const IBV_LOGO_ASPECT = 309.85333 / 72.639999;

/** Minimum collapsed header shell width — logo + padding + expand chevron. */
export function headerCollapsedMinWidthPx(
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 375,
): number {
  const sm = viewportWidth >= 640;
  const logoH = sm ? 28 : 24;
  const padL = sm ? 14 : 12;
  const chevron = 20;
  return Math.ceil(padL + logoH * IBV_LOGO_ASPECT + chevron);
}

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
  "bottom-[max(0.65rem,env(safe-area-inset-bottom))]";

export const mobileLandscapeLeftClass =
  "left-[max(0.5rem,env(safe-area-inset-left))]";

export const mobileLandscapeRightClass =
  "right-[max(0.5rem,env(safe-area-inset-right))]";

export const mobileSafeTopClass = "top-[calc(3.25rem+env(safe-area-inset-top,0px))]";
export const mobileSafeBottomClass = "bottom-[max(0.35rem,env(safe-area-inset-bottom,0px))]";

export const leftPanelInsetClass = "left-2 md:left-4";

export const leftPanelWidthClass =
  "w-[min(300px,calc(100vw-1.5rem))] md:w-[min(340px,calc(100vw-2rem))] lg:w-[min(360px,calc(100vw-2rem))]";
