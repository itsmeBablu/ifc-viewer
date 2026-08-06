"use client";

/**
 * LegendPanel — thin wrapper rendering LegendBody with top padding; the
 * legend surface shown in the right side panel for non-presentation data
 * view modes (heizlast, kuhllast, luftung, temperature).
 */

import LegendBody from "./LegendBody";

/** Compact legend panel — wraps shared LegendBody. */
export default function LegendPanel() {
  return <LegendBody paddedTop />;
}
