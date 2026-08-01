"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";

type Props = {
  open: boolean;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  /** Re-measure when inner content changes. */
  contentKey?: string | number;
};

/** iOS-style height accordion — replaces CSS max-height transitions. */
export default function GsapHeightAccordion({
  open,
  className = "overflow-hidden",
  innerClassName = "",
  children,
  contentKey,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);

  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer) return;

    killGsap(outer);

    if (open && mounted) {
      if (!inner) return;
      gsap.set(outer, { height: 0, autoAlpha: 0 });
      const target = inner.scrollHeight;
      gsap.to(outer, {
        height: target,
        autoAlpha: 1,
        duration: gsapDuration.accordion,
        ease: gsapEase.iosOut,
        onComplete: () => {
          gsap.set(outer, { height: "auto" });
        },
      });
      return;
    }

    if (!mounted) return;
    const current = outer.offsetHeight;
    gsap.fromTo(
      outer,
      { height: current, autoAlpha: 1 },
      {
        height: 0,
        autoAlpha: 0,
        duration: gsapDuration.accordion,
        ease: gsapEase.iosIn,
        onComplete: () => setMounted(false),
      },
    );
  }, [open, mounted, contentKey]);

  if (!mounted) return null;

  return (
    <div ref={outerRef} className={className} style={{ height: 0, visibility: "hidden" }}>
      <div ref={innerRef} className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
