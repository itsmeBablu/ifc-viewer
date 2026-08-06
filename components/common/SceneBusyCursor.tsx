"use client";

/**
 * SceneBusyCursor — small gradient spinner that follows the pointer while
 * the 3D scene is busy (recoloring/rebuilding), giving cursor-level busy
 * feedback distinct from the centered SceneBusyOverlay.
 *
 * Hidden during initial model load and until the pointer has moved over
 * the canvas at least once (`active`); reuses LiquidGlassSpinner.
 */

import LiquidGlassSpinner from "./LiquidGlassSpinner";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

type Props = {
  x: number;
  y: number;
  /** Pointer has moved over the 3D canvas at least once. */
  active: boolean;
};

/** Gradient ring spinner at cursor while the scene is busy. */
export default function SceneBusyCursor({ x, y, active }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isSceneBusy = useAppStore((s) => s.sceneBusy);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);

  if (!isSceneBusy || isLoadingModel || !active) return null;

  return (
    <div
      className="pointer-events-none fixed z-[25] -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
      aria-hidden
    >
      <LiquidGlassSpinner size="md" srLabel={t(uiLanguage, "working")} />
    </div>
  );
}
