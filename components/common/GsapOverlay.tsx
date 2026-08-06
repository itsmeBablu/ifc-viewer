"use client";

/**
 * GsapOverlay — centered overlay wrapper with GSAP enter/exit transitions.
 *
 * Used for loading, empty-state, and error overlays; stays mounted through
 * the exit animation (via animateOverlayOut's onComplete) before unmounting.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animateOverlayIn, animateOverlayOut } from "@/lib/gsapMotion";

type Props = {
  show: boolean;
  className?: string;
  children: ReactNode;
};

/** Centered overlay with GSAP enter/exit (loading, empty state, errors). */
export default function GsapOverlay({ show, className = "", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(show);

  useLayoutEffect(() => {
    if (show) setMounted(true);
  }, [show]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !mounted) return;

    if (show) {
      animateOverlayIn(el);
      return;
    }

    const tween = animateOverlayOut(el);
    tween.eventCallback("onComplete", () => setMounted(false));
    return () => {
      tween.eventCallback("onComplete", null);
      tween.kill();
    };
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div ref={ref} className={className} style={{ visibility: "hidden" }}>
      {children}
    </div>
  );
}
