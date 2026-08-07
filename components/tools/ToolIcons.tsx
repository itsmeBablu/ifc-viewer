"use client";

/**
 * ToolIcons — small inline SVG icon set for the Werkzeug tool panel
 * (chevron, eye/eye-off/eye-mixed, isolate, reset, target, search).
 * Purely presentational; no store access or state.
 */

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconChevron({
  open,
  className = "",
}: IconProps & { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
        open ? "rotate-90" : ""
      } ${className}`}
      {...stroke}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconEye({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function IconEyeOff({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.3 7.5A17 17 0 0 0 2.5 12S6 18 12 18a9.4 9.4 0 0 0 3.7-.75" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Half-filled square — mixed visibility inside a subtree. */
export function IconEyeMixed({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <path d="M12 9.25v5.5" />
    </svg>
  );
}

export function IconIsolate({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconReset({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5" />
    </svg>
  );
}

export function IconTarget({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function IconSearch({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} {...stroke} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
