"use client";

/**
 * HoverTip — hover/focus tooltip styled like the bottom toolbar tip.
 * Delayed open (~250ms), immediate close on leave; click suppresses until leave.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { canHover } from "@/lib/canHover";
import GlassPanel from "./GlassPanel";

type Props = {
  label: string;
  hint: string;
  children: ReactNode;
  placement?: "above" | "below";
  className?: string;
  /** Skip tip entirely (e.g. when a child popover is open). */
  disabled?: boolean;
};

export default function HoverTip({
  label,
  hint,
  children,
  placement = "above",
  className = "",
  disabled = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pos, setPos] = useState({ top: 0, bottom: 0, left: 0 });
  const hoverCapable = canHover();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const updatePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 10,
      bottom: window.innerHeight - r.top + 10,
      left: r.left + r.width / 2,
    });
  };

  const close = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, disabled]);

  const tipVisible = open && !disabled && hoverCapable;

  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => {
        if (!hoverCapable || suppressed || disabled) return;
        clearTimer();
        timerRef.current = setTimeout(() => {
          updatePos();
          setOpen(true);
        }, 260);
      }}
      onMouseLeave={() => {
        clearTimer();
        setOpen(false);
        setSuppressed(false);
      }}
      onFocus={() => {
        if (!hoverCapable || suppressed || disabled) return;
        updatePos();
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) close();
      }}
      onPointerDown={() => {
        clearTimer();
        setOpen(false);
        setSuppressed(true);
      }}
    >
      {children}
      {tipVisible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-max max-w-[220px] -translate-x-1/2"
            style={
              placement === "below"
                ? { top: pos.top, left: pos.left }
                : { bottom: pos.bottom, left: pos.left }
            }
          >
            <GlassPanel variant="panel" zIndex={200}>
              <div className="px-3 py-2 text-center">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--text-strong)]">
                  {label}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-body)]">
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
