"use client";

import { LiquidGlass } from "@liquidglass/react";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  liquidGlass,
  motion,
  radius,
  type GlassVariant,
} from "@/lib/designTokens";

type Props = {
  children: ReactNode;
  className?: string;
  /** Outer wrapper classes (positioning / margins) — LiquidGlass fills this. */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  variant?: GlassVariant;
  /** Override LiquidGlass z-index (library default is 9999 — too aggressive). */
  zIndex?: number;
  /** Stretch to parent height (sidebar sheets). Default: size to content. */
  fill?: boolean;
  /** Allow dropdowns / absolute menus to paint outside the glass clip. */
  allowOverflow?: boolean;
};

const RADIUS_CSS: Record<GlassVariant, number> = {
  panel: radius.panelPx,
  control: radius.controlPx,
  chip: radius.chipPx,
};

/**
 * Single shared glass surface for the whole app.
 * Desktop: @liquidglass/react. Mobile: CSS frosted glass (iOS-style) —
 * displacement/elasticity reads poorly on touch WebKit.
 */
export default function GlassPanel({
  children,
  className = "",
  wrapperClassName = "",
  wrapperStyle,
  variant = "panel",
  zIndex = 1,
  fill = false,
  allowOverflow = false,
}: Props) {
  const preset = liquidGlass[variant];
  const [cssGlass, setCssGlass] = useState(false);

  useEffect(() => {
    // Phones + iPad / touch: CSS frosted glass. @liquidglass displacement
    // often looks flat or muddy on iOS / iPadOS Safari.
    const widthMq = window.matchMedia("(max-width: 1024px)");
    const touchMq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setCssGlass(widthMq.matches || touchMq.matches);
    update();
    widthMq.addEventListener("change", update);
    touchMq.addEventListener("change", update);
    return () => {
      widthMq.removeEventListener("change", update);
      touchMq.removeEventListener("change", update);
    };
  }, []);

  const overflowCls = allowOverflow ? "overflow-visible" : "overflow-hidden";
  const contentOverflow = allowOverflow
    ? "overflow-visible"
    : fill
      ? "min-h-0 flex-1 overflow-hidden"
      : "overflow-hidden";

  if (cssGlass) {
    const r =
      (wrapperStyle?.borderRadius as number | string | undefined) ??
      RADIUS_CSS[variant];
    return (
      <div
        className={`relative ${overflowCls} ${fill ? "h-full min-h-0" : ""} ${motion.base} ${wrapperClassName}`}
        style={{
          ...wrapperStyle,
          zIndex,
          borderRadius: r,
        }}
      >
        <div
          className={`ios-glass ios-glass--${variant} ${
            fill ? "ios-glass--fill" : ""
          } ${allowOverflow ? "overflow-visible" : ""} ${className}`}
          style={{ borderRadius: r }}
        >
          <div
            className={`glass-surface-content ${
              fill ? "min-h-0 flex-1" : ""
            } ${contentOverflow}`}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${allowOverflow ? "overflow-visible" : ""} ${fill ? "h-full min-h-0" : ""} ${motion.base} ${wrapperClassName}`}
      style={wrapperStyle}
    >
      <LiquidGlass
        {...preset}
        zIndex={zIndex}
        className={`glass-surface ${fill ? "glass-surface--fill" : ""} ${className}`}
      >
        <div
          className={`glass-surface-content ${
            fill ? "min-h-0 flex-1" : ""
          } ${contentOverflow}`}
        >
          {children}
        </div>
      </LiquidGlass>
    </div>
  );
}
