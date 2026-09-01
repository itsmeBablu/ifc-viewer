"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { LiquidGlass, type LiquidGlassProps, type GlassStyle } from "@specy/liquid-glass-react";

export interface ThreeLiquidGlassProps {
  children?: ReactNode;
  className?: string;
  style?: string;
  wrapperStyle?: CSSProperties;
  glassStyle?: GlassStyle;
  targetElement?: HTMLElement;
  renderKey?: string | number;
}

/**
 * ThreeLiquidGlass — React component using @specy/liquid-glass-react
 * A Three.js powered liquid glass effect that recreates Apple's liquid glass design.
 */
export default function ThreeLiquidGlass({
  children,
  className = "",
  style = "",
  wrapperStyle,
  glassStyle,
  targetElement,
  renderKey,
}: ThreeLiquidGlassProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`relative overflow-hidden backdrop-blur-2xl bg-[var(--surface-card)]/80 border border-[var(--panel-divider)] ${className}`}
        style={wrapperStyle}
      >
        {children}
      </div>
    );
  }

  return (
    <LiquidGlass
      style={style}
      wrapperStyle={wrapperStyle}
      glassStyle={glassStyle}
      targetElement={targetElement}
      renderKey={renderKey}
    >
      <div className={`relative z-10 ${className}`}>
        {children}
      </div>
    </LiquidGlass>
  );
}

export { LiquidGlass as SpecyLiquidGlass };
