"use client";

import React from "react";
import type { GlobalSnapResult } from "@/lib/globalSnapping";

export type SnapGlyphOverlayProps = {
  snap: GlobalSnapResult | null;
  /** Optional container style */
  className?: string;
};

/**
 * High-contrast Revit-grade Visual Snap Glyph HUD.
 * Renders vector SVG glyphs exactly at the cursor-proximity position in real time
 * for both 2D and 3D views, plus pulsing auto-close boundary assist.
 */
export default function SnapGlyphOverlay({ snap, className = "" }: SnapGlyphOverlayProps) {
  if (!snap || !snap.snapped || !snap.type) return null;

  const { screen, type, label, isAutoClose, referenceAngle } = snap;
  const { clientX, clientY } = screen;

  // Revit Magenta / Cyan CAD Theme colors
  const snapColor = isAutoClose ? "#10b981" : "#ec4899"; // Emerald for close, magenta for geometry snap
  const snapGlow = isAutoClose ? "rgba(16, 185, 129, 0.4)" : "rgba(236, 72, 153, 0.35)";

  const renderGlyph = () => {
    switch (type) {
      case "endpoint":
        // Small Square (Revit Endpoint)
        return (
          <svg className="h-4 w-4 overflow-visible" viewBox="0 0 16 16">
            <rect
              x="3"
              y="3"
              width="10"
              height="10"
              fill="none"
              stroke={snapColor}
              strokeWidth="2"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
          </svg>
        );

      case "midpoint":
        // Small Triangle (Revit Midpoint)
        return (
          <svg className="h-4 w-4 overflow-visible" viewBox="0 0 16 16">
            <polygon
              points="8,2 14,14 2,14"
              fill="none"
              stroke={snapColor}
              strokeWidth="2"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
          </svg>
        );

      case "center":
        // Small Circle with Center Dot (Revit Center)
        return (
          <svg className="h-4 w-4 overflow-visible" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke={snapColor}
              strokeWidth="2"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
            <circle cx="8" cy="8" r="1.5" fill={snapColor} />
          </svg>
        );

      case "intersection":
        // Small X Cross (Revit Intersection)
        return (
          <svg className="h-4 w-4 overflow-visible" viewBox="0 0 16 16">
            <line
              x1="3"
              y1="3"
              x2="13"
              y2="13"
              stroke={snapColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
            <line
              x1="13"
              y1="3"
              x2="3"
              y2="13"
              stroke={snapColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
          </svg>
        );

      case "perpendicular": {
        // Small Right-Angle Bracket Symbol (Revit Perpendicular)
        const angleDeg = referenceAngle != null ? (referenceAngle * 180) / Math.PI : 0;
        return (
          <svg
            className="h-4 w-4 overflow-visible transition-transform duration-75"
            viewBox="0 0 16 16"
            style={{ transform: `rotate(${angleDeg}deg)` }}
          >
            <path
              d="M3,13 L13,13 M8,13 L8,3 M8,8 L13,8"
              fill="none"
              stroke={snapColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="miter"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
          </svg>
        );
      }

      case "nearest":
        // Small Hourglass / Dot on line (Revit Nearest)
        return (
          <svg className="h-4 w-4 overflow-visible" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="3.5"
              fill={snapColor}
              stroke="#ffffff"
              strokeWidth="1.2"
              className="drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]"
            />
          </svg>
        );

      case "autoclose":
        // Pulsing Halo + Centered Square for Auto-Close
        return (
          <div className="relative flex items-center justify-center">
            {/* Animated Pulsing Ring */}
            <span
              className="absolute -inset-2.5 rounded-full animate-ping opacity-75"
              style={{ backgroundColor: snapGlow }}
            />
            <span
              className="absolute -inset-1.5 rounded-full border border-emerald-400 opacity-90 animate-pulse"
            />
            {/* Center target square */}
            <svg className="relative h-4 w-4 overflow-visible" viewBox="0 0 16 16">
              <rect
                x="3"
                y="3"
                width="10"
                height="10"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              />
            </svg>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`pointer-events-none fixed z-[90] select-none ${className}`}
      style={{
        left: `${clientX}px`,
        top: `${clientY}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Glyph Visual Symbol */}
      <div className="flex items-center justify-center">
        {renderGlyph()}
      </div>

      {/* Auto-Close Badge or Snap Type Label */}
      {isAutoClose ? (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shadow-lg backdrop-blur-sm animate-bounce">
          ✦ Click to Close Boundary
        </div>
      ) : label ? (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/80 border border-pink-500/40 px-1.5 py-0.5 text-[9px] font-mono font-medium text-pink-300 shadow backdrop-blur-xs">
          {label}
        </div>
      ) : null}
    </div>
  );
}
