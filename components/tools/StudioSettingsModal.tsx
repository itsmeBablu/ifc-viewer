"use client";

import { useEffect, useRef } from "react";
import {
  LuX,
  LuSliders,
  LuSun,
  LuMoon,
  LuPalette,
  LuType,
  LuGlobe,
  LuSparkles,
  LuPrinter,
  LuMaximize,
  LuMinimize,
  LuGrid2X2,
  LuCheck,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import {
  useStudioSettingsStore,
  STUDIO_ACCENTS,
  type StudioAccent,
  type StudioFont,
  type StudioFontScale,
} from "@/store/useStudioSettingsStore";
import UnifiedButton from "@/components/common/UnifiedButton";

export default function StudioSettingsModal() {
  const isOpen = useStudioSettingsStore((s) => s.settingsModalOpen);
  const setIsOpen = useStudioSettingsStore((s) => s.setSettingsModalOpen);
  const accent = useStudioSettingsStore((s) => s.accent);
  const setAccent = useStudioSettingsStore((s) => s.setAccent);
  const syncArchMep = useStudioSettingsStore((s) => s.syncArchMep);
  const setSyncArchMep = useStudioSettingsStore((s) => s.setSyncArchMep);
  const font = useStudioSettingsStore((s) => s.font);
  const setFont = useStudioSettingsStore((s) => s.setFont);
  const fontScale = useStudioSettingsStore((s) => s.fontScale);
  const setFontScale = useStudioSettingsStore((s) => s.setFontScale);

  const colorTheme = useAppStore((s) => s.colorTheme);
  const setColorTheme = useAppStore((s) => s.setColorTheme);
  const isDark = colorTheme === "dark";
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);
  const show3DGrid = useAppStore((s) => s.show3dgrid);
  const setShow3DGrid = useAppStore((s) => s.setShow3DGrid);

  // Esc key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const currentAccent = STUDIO_ACCENTS[accent] || STUDIO_ACCENTS.vyellow;

  const handlePrint = () => {
    window.print();
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{ width: 440, maxWidth: "96vw" }}
        className="relative flex flex-col rounded-2xl border border-[var(--panel-divider)] bg-[var(--surface-card)] text-[var(--text-strong)] shadow-2xl backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3 bg-[var(--surface-overlay)]/60">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: currentAccent.hex }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
              Studio & Workspace Settings:
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="Close (Esc)"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 thin-scroll text-xs">
          {/* Section 1: Color Themes */}
          <div className="rounded-xl border border-[var(--panel-divider)] p-2.5 bg-[var(--surface-overlay)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <LuSun className="h-3 w-3" />
                <span>UI Theme:</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {isDark ? "Dark Obsidian" : "Light Studio"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setColorTheme("light")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${
                  !isDark
                    ? "bg-white text-zinc-900 border-yellow-400 shadow-sm"
                    : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                <LuSun className="h-3.5 w-3.5 text-yellow-500" />
                <span>Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setColorTheme("dark")}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${
                  isDark
                    ? "bg-slate-900 text-white border-yellow-400 shadow-sm"
                    : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                <LuMoon className="h-3.5 w-3.5 text-yellow-400" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Section 2: Accent Customization */}
          <div className="rounded-xl border border-[var(--panel-divider)] p-2.5 bg-[var(--surface-overlay)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <LuPalette className="h-3 w-3" />
                <span>Accent Color:</span>
              </span>
              <span className="text-[10px] font-bold text-[var(--text-strong)]">
                {currentAccent.name}
              </span>
            </div>

            {/* Accent Swatches */}
            <div className="grid grid-cols-6 gap-1.5 pt-0.5">
              {Object.values(STUDIO_ACCENTS).map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAccent(acc.id)}
                  className={`group relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all ${
                    accent === acc.id
                      ? "border-[var(--text-strong)] shadow-md scale-105 bg-[var(--surface-card)]"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] hover:scale-105"
                  }`}
                  title={acc.name}
                >
                  <div
                    className="h-5 w-5 rounded-full shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: acc.hex }}
                  >
                    {accent === acc.id && (
                      <LuCheck className="h-3 w-3 text-zinc-950 stroke-[3]" />
                    )}
                  </div>
                  <span className="text-[8px] font-mono mt-1 text-[var(--text-muted)] truncate w-full text-center">
                    {acc.id}
                  </span>
                </button>
              ))}
            </div>

            {/* Sync Arch & MEP Toggle */}
            <label className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-body)] cursor-pointer">
              <span className="truncate">Sync Arch & MEP to same accent:</span>
              <input
                type="checkbox"
                checked={syncArchMep}
                onChange={(e) => setSyncArchMep(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--panel-divider)] accent-yellow-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Section 3: Typography & Text Clarity */}
          <div className="rounded-xl border border-[var(--panel-divider)] p-2.5 bg-[var(--surface-overlay)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <LuType className="h-3 w-3" />
                <span>Typography & Font Style:</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {[
                { id: "inter", label: "Clean Sans", preview: "Inter UI" },
                { id: "jakarta", label: "Modern Studio", preview: "Jakarta" },
                { id: "mono", label: "Technical CAD", preview: "Fira Mono" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id as StudioFont)}
                  className={`p-1.5 rounded-lg border text-left transition-all ${
                    font === f.id
                      ? "border-yellow-400/80 bg-[var(--surface-card)] text-[var(--text-strong)] font-bold shadow-sm"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <div className="text-[10px] font-bold truncate">{f.label}</div>
                  <div className="text-[9px] text-[var(--text-muted)] truncate">{f.preview}</div>
                </button>
              ))}
            </div>

            {/* Font Scale */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[var(--text-muted)]">Text Scaling:</span>
              <div className="flex gap-1">
                {(["compact", "default", "spacious"] as StudioFontScale[]).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setFontScale(scale)}
                    className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase border transition-all ${
                      fontScale === scale
                        ? "bg-yellow-400 text-zinc-950 font-bold border-yellow-400"
                        : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Language & Locale */}
          <div className="rounded-xl border border-[var(--panel-divider)] p-2.5 bg-[var(--surface-overlay)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <LuGlobe className="h-3 w-3" />
                <span>Language & Locale:</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {[
                { code: "en", label: "English" },
                { code: "de", label: "Deutsch" },
                { code: "es", label: "Español" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setUiLanguage(lang.code as any)}
                  className={`py-1.5 px-2 rounded-lg border text-center text-[10px] font-bold transition-all ${
                    uiLanguage === lang.code
                      ? "border-yellow-400/80 bg-[var(--surface-card)] text-[var(--text-strong)] shadow-sm"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: Quick Display Actions */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[10px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-card)] transition-all"
            >
              <LuPrinter className="h-3 w-3" />
              <span>Print View</span>
            </button>
            <button
              type="button"
              onClick={handleFullscreen}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[10px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-card)] transition-all"
            >
              <LuMaximize className="h-3 w-3" />
              <span>Fullscreen</span>
            </button>
            <button
              type="button"
              onClick={() => setShow3DGrid(!show3DGrid)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[10px] font-semibold transition-all ${
                show3DGrid
                  ? "border-yellow-400/60 bg-[var(--surface-card)] text-[var(--text-strong)] font-bold"
                  : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
              }`}
            >
              <LuGrid2X2 className="h-3 w-3" />
              <span>3D Grid</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-2.5 border-t border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40">
          <UnifiedButton
            size="sm"
            variant="primary"
            onClick={() => setIsOpen(false)}
            icon={<LuCheck className="h-3.5 w-3.5" />}
            className="!bg-yellow-400 !text-zinc-950 font-bold"
          >
            Done
          </UnifiedButton>
        </div>
      </div>
    </div>
  );
}
