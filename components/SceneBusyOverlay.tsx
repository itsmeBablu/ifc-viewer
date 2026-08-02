"use client";

import LiquidGlassSpinner from "./LiquidGlassSpinner";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

/** Centered overlay while the 3D scene recolors / rebuilds (mode switches). */
export default function SceneBusyOverlay() {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isSceneBusy = useAppStore((s) => s.sceneBusy);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);

  if (!isSceneBusy || isLoadingModel) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[25] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--background)]/20 backdrop-blur-[2px]"
        aria-hidden
      />
      <div className="relative pointer-events-none flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--glass-border)]/70 bg-[var(--glass-tint)]/55 px-6 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.1)] backdrop-blur-md">
        <LiquidGlassSpinner size="lg" srLabel={t(uiLanguage, "working")} />
        <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">
          {t(uiLanguage, "working")}
        </p>
      </div>
    </div>
  );
}
