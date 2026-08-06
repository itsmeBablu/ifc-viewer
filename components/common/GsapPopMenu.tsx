"use client";

/**
 * GsapPopMenu — mount wrapper for dropdowns/popovers with GSAP enter/exit.
 *
 * Mirrors GsapOverlay's mount-until-exit-completes pattern but uses the
 * menu-specific animateMenuIn/Out easing; forwards mouse enter/leave so
 * callers can keep a hover-triggered menu open while the pointer is inside.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animateMenuIn, animateMenuOut } from "@/lib/gsapMotion";

type Props = {
  show: boolean;
  className?: string;
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

/** Dropdown / popover mount with GSAP enter + exit. */
export default function GsapPopMenu({
  show,
  className = "",
  children,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(show);

  useLayoutEffect(() => {
    if (show) setMounted(true);
  }, [show]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !mounted) return;

    if (show) {
      animateMenuIn(el);
      return;
    }

    const tween = animateMenuOut(el);
    tween.eventCallback("onComplete", () => setMounted(false));
    return () => {
      tween.eventCallback("onComplete", null);
      tween.kill();
    };
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ visibility: "hidden" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
