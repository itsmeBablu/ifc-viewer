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
}: Props) {
  const preset = liquidGlass[variant];
  const [cssGlass, setCssGlass] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setCssGlass(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (cssGlass) {
    const r =
      (wrapperStyle?.borderRadius as number | string | undefined) ??
      RADIUS_CSS[variant];
    return (
      <div
        className={`relative overflow-hidden ${fill ? "h-full min-h-0" : ""} ${motion.base} ${wrapperClassName}`}
        style={{
          ...wrapperStyle,
          zIndex,
          borderRadius: r,
        }}
      >
        <div
          className={`ios-glass ios-glass--${variant} ${
            fill ? "ios-glass--fill" : ""
          } ${className}`}
          style={{ borderRadius: r }}
        >
          <div
            className={`glass-surface-content ${
              fill ? "min-h-0 flex-1 overflow-hidden" : ""
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${fill ? "h-full min-h-0" : ""} ${motion.base} ${wrapperClassName}`}
      style={wrapperStyle}
    >
      <LiquidGlass
        {...preset}
        zIndex={zIndex}
        className={`glass-surface ${fill ? "glass-surface--fill" : ""} ${className}`}
      >
        <div
          className={`glass-surface-content ${fill ? "min-h-0 flex-1 overflow-hidden" : ""}`}
        >
          {children}
        </div>
      </LiquidGlass>
    </div>
  );
}
