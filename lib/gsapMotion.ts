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
  menu: 0.32,
  tooltip: 0.16,
  follow: 0.12,
  theme: 3,
} as const;

let activeFlyTween: gsap.core.Tween | null = null;

export function killGsap(target: gsap.TweenTarget) {
  gsap.killTweensOf(target);
}

export function killFlyTween() {
  activeFlyTween?.kill();
  activeFlyTween = null;
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
  options?: { side?: "left" | "right"; peekPx?: number },
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
    duration: gsapDuration.sidebar,
    ease: gsapEase.panel,
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
  activeFlyTween?.kill();
  activeFlyTween = tween;
  tween.eventCallback("onComplete", () => {
    if (activeFlyTween === tween) activeFlyTween = null;
  });
  tween.eventCallback("onInterrupt", () => {
    if (activeFlyTween === tween) activeFlyTween = null;
  });
}

export function flyToProgress(
  durationMs: number,
  onUpdate: (t: number) => void,
  onComplete?: () => void,
): gsap.core.Tween {
  killFlyTween();
  const state = { t: 0 };
  const tween = gsap.to(state, {
    t: 1,
    duration: durationMs / 1000,
    ease: gsapEase.camera,
    onUpdate: () => onUpdate(state.t),
    onComplete,
  });
  trackFlyTween(tween);
  return tween;
}
