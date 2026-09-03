"use client";

/**
 * GlassTooltip — shared portaled glass tooltip for hover-capable devices.
 *
 * Extracted from WerkzeugToolbar's ToolTipWrap: renders a GlassPanel popup
 * above (or below) an anchor element on mouse hover, portaled to avoid
 * clipping by parent overflow/glass containers.
 *
 * Desktop-only — gated by `canHover()`.  Touch devices see no tooltip.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import GlassPanel from "@/components/common/GlassPanel";
import { canHover } from "@/lib/canHover";

type Props = {
  /** Bold title line inside the tooltip. */
  label: string;
  /** One-line description below the title. */
  hint: string;
  children: ReactNode;
  /** Wrap class passed to the outer div (layout). */
  className?: string;
  /** Prefer tooltip below the anchor instead of above. */
  preferBelow?: boolean;
};

export default function GlassTooltip({
  label,
  hint,
  children,
  className = "",
  preferBelow = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  }>({ bottom: 0, left: 0 });
  const hoverCapable = canHover();

  const updatePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 10;
    const centerX = r.left + r.width / 2;

    if (preferBelow) {
      // Show below, but flip above if near viewport bottom
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < 80) {
        setPos({ bottom: window.innerHeight - r.top + gap, left: centerX });
      } else {
        setPos({ top: r.bottom + gap, left: centerX });
      }
    } else {
      // Show above, but flip below if near viewport top
      if (r.top < 80) {
        setPos({ top: r.bottom + gap, left: centerX });
      } else {
        setPos({ bottom: window.innerHeight - r.top + gap, left: centerX });
      }
    }
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={wrapRef}
      className={`relative flex items-center justify-center ${className}`}
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
            style={{
              ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
              ...(pos.top != null ? { top: pos.top } : {}),
              left: pos.left,
            }}
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
