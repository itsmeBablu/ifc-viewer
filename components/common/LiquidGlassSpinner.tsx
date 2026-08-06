"use client";

/**
 * LiquidGlassSpinner — temperature-gradient ring spinner used for all
 * "busy"/loading indicators in the app (cursor busy state, scene overlay,
 * generic loading UI).
 *
 * `hollow` toggles a transparent center vs. a filled glass disc; `label`
 * renders visible text below the ring, `srLabel` sets the a11y status text.
 */

type Size = "xs" | "sm" | "md" | "lg";

type Props = {
  size?: Size;
  className?: string;
  /** Transparent center (ring only). Default — no white glass disc. */
  hollow?: boolean;
  /** Visible label below the spinner (block layout). */
  label?: string;
  srLabel?: string;
};

/** Temperature-gradient liquid-glass ring spinner. */
export default function LiquidGlassSpinner({
  size = "md",
  className = "",
  hollow = true,
  label,
  srLabel = "Loading",
}: Props) {
  return (
    <div
      className={`liquid-glass-spinner ${hollow ? "liquid-glass-spinner--hollow" : ""} ${label ? "liquid-glass-spinner--stacked" : ""} ${className}`}
      data-size={size}
      role="status"
      aria-label={srLabel}
    >
      <div className="liquid-glass-spinner__orbit" aria-hidden>
        <div className="liquid-glass-spinner__ring" />
      </div>
      {hollow ? (
        <div className="liquid-glass-spinner__core" aria-hidden />
      ) : (
        <div className="liquid-glass-spinner__glass" aria-hidden />
      )}
      {label ? (
        <p className="liquid-glass-spinner__label">{label}</p>
      ) : null}
    </div>
  );
}
