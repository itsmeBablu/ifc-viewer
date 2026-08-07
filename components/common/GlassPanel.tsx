"use client";

/**
 * GlassPanel — the app's single shared frosted-glass surface primitive.
 *
 * Desktop uses @liquidglass/react for real displacement/refraction; touch
 * devices (phone/tablet, coarse pointer) fall back to a CSS frosted-glass
 * style since the library's effect reads flat on iOS/iPadOS WebKit.
 * `variant` picks preset radius/tint (panel/control/menu/chip); `fill`,
 * `allowOverflow`, and `zIndex` control layout/stacking edge cases.
 */

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
  /** Force CSS frosted glass (skip @liquidglass) — clearer on Werkzeug chrome. */
  preferCss?: boolean;
};

const RADIUS_CSS: Record<GlassVariant, number> = {
  panel: radius.panelPx,
  control: radius.controlPx,
  menu: radius.controlPx,
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
  preferCss = false,
}: Props) {
  const preset = liquidGlass[variant];
  const [mediaCssGlass, setMediaCssGlass] = useState(false);
  const cssGlass = preferCss || mediaCssGlass;

  useEffect(() => {
    if (preferCss) return;
    // Phones + iPad / touch: CSS frosted glass. @liquidglass displacement
    // often looks flat or muddy on iOS / iPadOS Safari.
    const widthMq = window.matchMedia("(max-width: 1024px)");
    const touchMq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setMediaCssGlass(widthMq.matches || touchMq.matches);
    update();
    widthMq.addEventListener("change", update);
    touchMq.addEventListener("change", update);
    return () => {
      widthMq.removeEventListener("change", update);
      touchMq.removeEventListener("change", update);
    };
  }, [preferCss]);

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
          zIndex,
          borderRadius: r,
          ...wrapperStyle,
          // Keep caller borderRadius (e.g. Werkzeug dock = 0) after defaults.
          ...(wrapperStyle?.borderRadius != null
            ? { borderRadius: wrapperStyle.borderRadius }
            : {}),
        }}
      >
        <div
          className={`ios-glass ios-glass--${variant} ${
            variant === "menu" ? "ios-glass--menu" : ""
          } ${fill ? "ios-glass--fill" : ""} ${allowOverflow ? "overflow-visible" : ""} ${className}`}
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
        className={`glass-surface ${variant === "menu" ? "glass-surface--menu" : ""} ${fill ? "glass-surface--fill" : ""} ${className}`}
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
