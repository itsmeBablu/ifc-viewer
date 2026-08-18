"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";

/**
 * Single swatch → expands to a portaled palette (not clipped by panel overflow)..
 */
export default function ColorSwatchPicker({
  color,
  onChange,
  className = "",
  size = "md",
  onOpenChange,
}: {
  color: string;
  onChange: (hex: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dim =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-8 w-8";

  const setOpenNotify = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const updatePos = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelH = 120;
    const gap = 8;
    const spaceBelow = window.innerHeight - r.bottom;
    const placeAbove = spaceBelow < panelH + gap && r.top > spaceBelow;
    setPos({
      top: placeAbove ? r.top - gap : r.bottom + gap,
      left: Math.min(r.left, window.innerWidth - 180),
      placeAbove,
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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={color}
        title={color}
        onClick={(e) => {
          e.stopPropagation();
          setOpenNotify(!open);
        }}
        className={`${dim} shrink-0 rounded-md border border-amber-200/60 shadow-inner transition-[transform,box-shadow] duration-150 hover:scale-105 ${
          open ? "ring-2 ring-amber-400/80" : ""
        }`}
        style={{ backgroundColor: color }}
      />
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="fixed z-[220] flex w-max max-w-[11rem] flex-wrap gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg,#fff)] p-2 shadow-xl backdrop-blur-md"
            style={{
              top: pos.placeAbove ? undefined : pos.top,
              bottom: pos.placeAbove
                ? window.innerHeight - pos.top
                : undefined,
              left: Math.max(8, pos.left),
            }}
          >
            {MARKUP_COLOR_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                role="option"
                aria-label={hex}
                aria-selected={color.toLowerCase() === hex.toLowerCase()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(hex);
                  setOpenNotify(false);
                }}
                className={`h-6 w-6 rounded-md border shadow-sm transition duration-150 hover:scale-110 ${
                  color.toLowerCase() === hex.toLowerCase()
                    ? "border-zinc-800 ring-2 ring-amber-400"
                    : hex.toLowerCase() === "#ffffff"
                      ? "border-zinc-300"
                      : "border-black/15"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>,
          (document.fullscreenElement as HTMLElement | null) ?? document.body,
        )}
    </div>
  );
}
