"use client";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

type Props = {
  className?: string;
};

/** Auto winter / summer 3D sky — shared by lighting panel and profile menu. */
export default function SeasonalBgToggle({ className = "" }: Props) {
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const uiLanguage = useAppStore((s) => s.uiLanguage);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoSceneBackground}
      aria-label={t(uiLanguage, "seasonalBg")}
      onClick={() => setAutoSceneBackground(!autoSceneBackground)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ${
        autoSceneBackground
          ? "border-amber-300/80 bg-gradient-to-br from-amber-300/95 to-amber-400/80"
          : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]"
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          autoSceneBackground ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
