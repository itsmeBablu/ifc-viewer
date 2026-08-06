"use client";

import { useEffect, useRef, useState } from "react";
import { MARKUP_COLOR_PALETTE } from "@/lib/toolMarkup";

/**
 * Single swatch → expands to palette on click; collapses after pick.
 * Same interaction pattern as the collapsed tool flyout.
 */
export default function ColorSwatchPicker({
  color,
  onChange,
  className = "",
  size = "md",
}: {
  color: string;
  onChange: (hex: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dim =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-6 w-6";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={color}
        title={color}
        onClick={() => setOpen((v) => !v)}
        className={`${dim} rounded-md border border-white/20 shadow-inner transition-[transform,box-shadow] duration-150 hover:scale-105 ${
          open ? "ring-2 ring-amber-400/80" : ""
        }`}
        style={{ backgroundColor: color }}
      />
      {open && (
        <div className="absolute top-[calc(100%+0.35rem)] left-0 z-30 flex w-max max-w-[11rem] flex-wrap gap-1.5 rounded-xl border border-white/10 bg-[#1a1f2a]/98 p-2 shadow-xl backdrop-blur-md">
          {MARKUP_COLOR_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              onClick={() => {
                onChange(hex);
                setOpen(false);
              }}
              className={`h-5 w-5 rounded-md border transition duration-150 hover:scale-110 ${
                color.toLowerCase() === hex.toLowerCase()
                  ? "border-white ring-1 ring-amber-400"
                  : "border-white/15"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
