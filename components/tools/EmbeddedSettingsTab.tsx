"use client";

import {
  LuSun,
  LuMoon,
  LuPalette,
  LuType,
  LuGlobe,
  LuGrid,
  LuPrinter,
  LuMaximize,
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

export default function EmbeddedSettingsTab() {
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

  const currentAccent = STUDIO_ACCENTS[accent] || STUDIO_ACCENTS.vyellow;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 space-y-2 thin-scroll text-xs select-none">
      {/* Header */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/40 px-1 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5 truncate">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentAccent.hex }} />
          Studio Settings
        </span>
      </div>

      {/* 1. Theme */}
      <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <LuSun className="h-3 w-3" />
            UI Theme:
          </span>
          <span className="text-[9px] text-[var(--text-muted)] font-mono">
            {isDark ? "Dark Obsidian" : "Light Studio"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setColorTheme("light")}
            className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md border text-[10px] font-bold transition-all ${
              !isDark
                ? "bg-white text-zinc-900 border-yellow-400 shadow-sm"
                : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <LuSun className="h-3 w-3 text-yellow-500" />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => setColorTheme("dark")}
            className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md border text-[10px] font-bold transition-all ${
              isDark
                ? "bg-slate-900 text-white border-yellow-400 shadow-sm"
                : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            <LuMoon className="h-3 w-3 text-yellow-400" />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* 2. Accent Colors */}
      <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <LuPalette className="h-3 w-3" />
            Accent Colors:
          </span>
          <span className="text-[9px] font-bold text-[var(--text-strong)]">
            {currentAccent.name}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1 pt-0.5">
          {Object.values(STUDIO_ACCENTS).map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => setAccent(acc.id)}
              className={`flex flex-col items-center justify-center p-1 rounded-md border transition-all ${
                accent === acc.id
                  ? "border-[var(--text-strong)] bg-[var(--surface-card)] shadow-sm scale-105"
                  : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] hover:scale-105"
              }`}
              title={acc.name}
            >
              <div
                className="h-4 w-4 rounded-full flex items-center justify-center shadow-inner"
                style={{ backgroundColor: acc.hex }}
              >
                {accent === acc.id && (
                  <LuCheck className="h-2.5 w-2.5 text-zinc-950 stroke-[3]" />
                )}
              </div>
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between pt-1 text-[10px] text-[var(--text-body)] cursor-pointer">
          <span className="truncate">Sync Arch & MEP accents:</span>
          <input
            type="checkbox"
            checked={syncArchMep}
            onChange={(e) => setSyncArchMep(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--panel-divider)] accent-yellow-400 cursor-pointer"
          />
        </label>
      </div>

      {/* 3. Typography */}
      <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <LuType className="h-3 w-3" />
            Font & Typography:
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {[
            { id: "inter", label: "Clean Sans" },
            { id: "jakarta", label: "Studio" },
            { id: "mono", label: "CAD Mono" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFont(f.id as StudioFont)}
              className={`p-1 rounded-md border text-center text-[9px] font-bold transition-all truncate ${
                font === f.id
                  ? "border-yellow-400/80 bg-[var(--surface-card)] text-[var(--text-strong)] shadow-sm"
                  : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[9px] text-[var(--text-muted)]">Scale:</span>
          <div className="flex gap-1">
            {(["compact", "default", "spacious"] as StudioFontScale[]).map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => setFontScale(scale)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase border transition-all ${
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

      {/* 4. Language */}
      <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <LuGlobe className="h-3 w-3" />
            Language:
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {[
            { code: "en", label: "EN" },
            { code: "de", label: "DE" },
            { code: "es", label: "ES" },
          ].map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setUiLanguage(lang.code as any)}
              className={`py-1 px-1 rounded-md border text-center text-[9px] font-bold transition-all ${
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

      {/* 5. Shortcuts */}
      <div className="grid grid-cols-3 gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-1 py-1 px-1 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[9px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
        >
          <LuPrinter className="h-2.5 w-2.5" />
          <span>Print</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="flex items-center justify-center gap-1 py-1 px-1 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[9px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
        >
          <LuMaximize className="h-2.5 w-2.5" />
          <span>Full</span>
        </button>
        <button
          type="button"
          onClick={() => setShow3DGrid(!show3DGrid)}
          className={`flex items-center justify-center gap-1 py-1 px-1 rounded border text-[9px] font-semibold transition-all ${
            show3DGrid
              ? "border-yellow-400/60 bg-[var(--surface-card)] text-[var(--text-strong)] font-bold"
              : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
          }`}
        >
          <LuGrid className="h-2.5 w-2.5" />
          <span>Grid</span>
        </button>
      </div>
    </div>
  );
}
