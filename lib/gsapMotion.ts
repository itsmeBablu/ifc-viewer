/**
 * Shared GSAP easing/duration presets and small animation helpers used
 * across the header, side panels, overlays, and camera fly-to.
 *
 * Covers menu/overlay/sidebar in-out transitions and a single tracked
 * "fly" tween so overlapping camera moves cancel cleanly. Note:
 * `gsapDuration.panelQuick` is a shorter sidebar-collapse duration added so
 * FloorsPanel finishes retracting before a header dropdown (menu duration)
 * finishes appearing above it.
 */
import gsap from "gsap";

/** iOS-like motion presets — tuned for UI + 3D camera. */
export const gsapEase = {
  ios: "power2.inOut",
  iosOut: "power3.out",
  iosIn: "power2.in",
  panel: "power3.inOut",
  mobile: "power2.out",
  snap: "back.out(1.15)",
  camera: "power2.inOut",
  explode: "power2.inOut",
} as const;

export const gsapDuration = {
  fast: 0.28,
  overlay: 0.42,
  mobile: 0.38,
  panel: 0.85,
  progress: 0.32,
  accordion: 0.4,
  sidebar: 0.9,
  panelQuick: 0.16,
  menu: 0.32,
  tooltip: 0.16,
  follow: 0.12,
  theme: 3,
} as const;

let activeFlyTween: gsap.core.Tween | null = null;
type FlyDone = () => void;
const flyDoneByTween = new WeakMap<gsap.core.Tween, FlyDone>();

export function killGsap(target: gsap.TweenTarget) {
  gsap.killTweensOf(target);
}

/** Kill active camera fly and resolve any waiter so awaits cannot hang. */
export function killFlyTween() {
  const tween = activeFlyTween;
  if (!tween) return;
  activeFlyTween = null;
  const done = flyDoneByTween.get(tween);
  tween.kill();
  done?.();
}

export function animateProgress(options: {
  duration: number;
  ease?: string;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}): gsap.core.Tween {
  const state = { t: 0 };
  return gsap.to(state, {
    t: 1,
    duration: options.duration,
    ease: options.ease ?? gsapEase.ios,
    onUpdate: () => options.onUpdate(state.t),
    onComplete: options.onComplete,
  });
}

export function animateOverlayIn(el: Element) {
  killGsap(el);
  return gsap.fromTo(
    el,
    { autoAlpha: 0, scale: 0.97, y: 8 },
    {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      duration: gsapDuration.overlay,
      ease: gsapEase.iosOut,
    },
  );
}

export function animateOverlayOut(el: Element) {
  killGsap(el);
  return gsap.to(el, {
    autoAlpha: 0,
    scale: 0.98,
    y: 4,
    duration: gsapDuration.fast,
    ease: gsapEase.iosIn,
  });
}

export function animateMenuIn(el: Element) {
  killGsap(el);
  return gsap.fromTo(
    el,
    { autoAlpha: 0, y: -6, scale: 0.97 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: gsapDuration.menu,
      ease: gsapEase.iosOut,
    },
  );
}

export function animateMenuOut(el: Element) {
  killGsap(el);
  return gsap.to(el, {
    autoAlpha: 0,
    y: -4,
    scale: 0.98,
    duration: gsapDuration.fast,
    ease: gsapEase.iosIn,
  });
}

export function animateSidebarPanel(
  el: Element,
  state: "open" | "peek" | "hidden",
  options?: { side?: "left" | "right"; peekPx?: number; fast?: boolean },
) {
  killGsap(el);
  const side = options?.side ?? "left";
  const peekPx = options?.peekPx ?? 20;
  const width = (el as HTMLElement).offsetWidth;
  let x: number;
  if (side === "left") {
    x =
      state === "open"
        ? 0
        : state === "peek"
          ? -(width - peekPx)
          : -(width + 24);
  } else {
    x =
      state === "open"
        ? 0
        : state === "peek"
          ? width - peekPx
          : width + 24;
  }
  const opacity = state === "hidden" ? 0 : 1;
  return gsap.to(el, {
    x,
    opacity,
    // Fast: must fully retract before a header dropdown (menu duration) pops in above it.
    duration: options?.fast ? gsapDuration.panelQuick : gsapDuration.sidebar,
    ease: options?.fast ? gsapEase.iosOut : gsapEase.panel,
  });
}

export function animateSidebarContent(el: Element, visible: boolean) {
  killGsap(el);
  return gsap.to(el, {
    autoAlpha: visible ? 1 : 0,
    duration: gsapDuration.fast,
    ease: gsapEase.iosOut,
  });
}

export function trackFlyTween(tween: gsap.core.Tween) {
  if (activeFlyTween && activeFlyTween !== tween) {
    const prev = activeFlyTween;
    activeFlyTween = null;
    const prevDone = flyDoneByTween.get(prev);
    prev.kill();
    prevDone?.();
  }
  activeFlyTween = tween;
}

export function flyToProgress(
  durationMs: number,
  onUpdate: (t: number) => void,
  onComplete?: () => void,
): gsap.core.Tween {
  killFlyTween();
  let settled = false;
  let tween: gsap.core.Tween;
  const done = () => {
    if (settled) return;
    settled = true;
    if (activeFlyTween === tween) activeFlyTween = null;
    onComplete?.();
  };
  const state = { t: 0 };
  const tween = gsap.to(state, {
    t: 1,
    duration: Math.max(0.001, durationMs / 1000),
    ease: gsapEase.camera,
    onUpdate: () => onUpdate(state.t),
    onComplete: done,
    onInterrupt: done,
  });
  flyDoneByTween.set(tween, done);
  trackFlyTween(tween);
  return tween;
}
