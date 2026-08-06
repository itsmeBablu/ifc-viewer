"use client";

/**
 * HoverTip — hover/focus tooltip styled like the bottom toolbar's tip
 * (glass label + hint text), portaled to <body> (or the fullscreen
 * element) so parent overflow/clipping can't hide it.
 *
 * Tracks the anchor's position on scroll/resize; `placement` flips the
 * tip above or below the anchor. A click suppresses the tip until the
 * pointer leaves, so it doesn't reappear right after a tap/click.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { canHover } from "@/lib/canHover";
import GlassPanel from "./GlassPanel";

type Props = {
  label: string;
  hint: string;
  children: ReactNode;
  /** Prefer tip below the anchor (e.g. legend in a top panel). Default: above. */
  placement?: "above" | "below";
  className?: string;
};

/**
 * Hover popup matching the bottom toolbar tip style (glass label + hint).
 * Portaled so overflow/clipping parents cannot hide it.
 */
export default function HoverTip({
  label,
  hint,
  children,
  placement = "above",
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState({ top: 0, bottom: 0, left: 0 });
  const hoverCapable = canHover();

  const updatePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 12,
      bottom: window.innerHeight - r.top + 12,
      left: r.left + r.width / 2,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`relative ${className}`}
      onMouseEnter={() => {
        if (!hoverCapable || suppressed) return;
        updatePos();
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
        setSuppressed(false);
      }}
      onFocus={() => {
        if (!hoverCapable || suppressed) return;
        updatePos();
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
      onClick={() => {
        setOpen(false);
        setSuppressed(true);
      }}
    >
      {children}
      {open &&
        hoverCapable &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-max max-w-[240px] -translate-x-1/2"
            style={
              placement === "below"
                ? { top: pos.top, left: pos.left }
                : { bottom: pos.bottom, left: pos.left }
            }
          >
            <GlassPanel variant="panel" zIndex={200}>
              <div className="px-3.5 py-2.5 text-center">
                <p className="text-[12px] font-semibold tracking-wide text-[var(--text-strong)]">
                  {label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[var(--text-body)]">
                  {hint}
                </p>
              </div>
            </GlassPanel>
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}
