"use client";

/**
 * GsapCrossfade — crossfades its children whenever `contentKey` changes.
 *
 * Used to swap panel content (e.g. legend modes) with a short GSAP
 * fade/slide instead of an abrupt DOM replace; animation timings live in
 * lib/gsapMotion (duration/easing tokens, killGsap for cleanup).
 */

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";

type Props = {
  /** Change key to crossfade inner content. */
  contentKey: string | number;
  className?: string;
  children: ReactNode;
};

/** Swap panel content with a short GSAP crossfade (legend modes, etc.). */
export default function GsapCrossfade({
  contentKey,
  className = "",
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    killGsap(el);
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 6 },
      {
        autoAlpha: 1,
        y: 0,
        duration: gsapDuration.fast,
        ease: gsapEase.iosOut,
      },
    );
  }, [contentKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
