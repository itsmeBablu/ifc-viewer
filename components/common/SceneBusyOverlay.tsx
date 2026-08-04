"use client";

import LiquidGlassSpinner from "./LiquidGlassSpinner";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

/** Centered spinner while the 3D scene recolors / rebuilds (mode switches). */
export default function SceneBusyOverlay() {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isSceneBusy = useAppStore((s) => s.sceneBusy);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);

  if (!isSceneBusy || isLoadingModel) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[25] flex items-center justify-center p-4">
      <div className="pointer-events-none flex flex-col items-center gap-2.5">
        <LiquidGlassSpinner size="lg" srLabel={t(uiLanguage, "working")} />
        <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] drop-shadow-sm">
          {t(uiLanguage, "working")}
        </p>
      </div>
    </div>
  );
}
