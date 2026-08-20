"use client";

import React, { forwardRef, useRef } from "react";
import { motion } from "@/lib/designTokens";

export interface UnifiedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  isLoading?: boolean;
}

export const UnifiedButton = forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      isLoading = false,
      children,
      className = "",
      disabled,
      ...props
    },
    forwardedRef,
  ) => {
    const internalRef = useRef<HTMLButtonElement>(null);
    const ref = (forwardedRef || internalRef) as React.RefObject<HTMLButtonElement>;

    const sizeClasses = {
      xs: "px-2 py-0.5 text-[10px] gap-1 rounded-md min-h-[24px]",
      sm: "px-3 py-1 text-xs gap-1.5 rounded-lg min-h-[30px]",
      md: "px-4 py-1.5 text-xs gap-2 rounded-xl min-h-[36px]",
      lg: "px-6 py-2.5 text-sm gap-2 rounded-xl min-h-[44px]",
    }[size];

    const variantClasses = {
      primary:
        "btn-v-yellow btn-liquid-hover",
      secondary:
        "btn-yellow-border-hover border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-strong)] font-semibold shadow-sm",
      danger:
        "border border-red-400/40 bg-gradient-to-br from-red-500/20 to-red-600/30 text-red-400 font-semibold hover:bg-red-500/30 hover:border-red-400",
      ghost:
        "border border-transparent bg-transparent text-[var(--text-body)] font-medium hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]",
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${motion.base} inline-flex items-center justify-center font-sans tracking-wide transition-all cursor-pointer select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);

UnifiedButton.displayName = "UnifiedButton";
export default UnifiedButton;
