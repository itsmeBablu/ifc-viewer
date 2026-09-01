"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  LuSun,
  LuMoon,
  LuPalette,
  LuType,
  LuGlobe,
  LuGrid2X2,
  LuPrinter,
  LuMaximize,
  LuMinimize,
  LuCheck,
  LuChevronDown,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import {
  useStudioSettingsStore,
  STUDIO_ACCENTS,
  type StudioAccent,
  type StudioFont,
  type StudioFontScale,
} from "@/store/useStudioSettingsStore";
import GsapPopMenu from "../common/GsapPopMenu";
import GsapHeightAccordion from "../common/GsapHeightAccordion";
import GlassPanel from "../common/GlassPanel";
import ThemeToggle from "../common/ThemeToggle";
import SeasonalBgToggle from "../common/SeasonalBgToggle";
import { t } from "@/lib/i18n";

type HoverId = "language" | "accents" | "typography" | "en" | "de" | "es" | null;

interface StudioSettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function StudioSettingsDropdown({
  isOpen,
  onClose,
}: StudioSettingsDropdownProps) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const isDark = colorTheme === "dark";

  const {
    accent,
    setAccent,
    syncArchMep,
    setSyncArchMep,
    font,
    setFont,
    fontScale,
    setFontScale,
  } = useStudioSettingsStore();

  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [accentsExpanded, setAccentsExpanded] = useState(false);
  const [typographyExpanded, setTypographyExpanded] = useState(false);
  const [hoverId, setHoverId] = useState<HoverId>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [show3DGrid, setShow3DGrid] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", onDocClick);
    }
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const menuRowIdle =
    "box-border border border-transparent transition-[background-color,border-color,box-shadow,color] duration-150";
  const menuRowHighlight = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/92 via-yellow-200/82 to-amber-400/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.4)] text-amber-950 font-semibold"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.28)] text-amber-950 font-semibold";

  return (
    <GsapPopMenu
      show={isOpen}
      className="absolute top-[calc(100%+0.5rem)] right-0 z-[60]"
      onMouseLeave={() => setHoverId(null)}
    >
      <div ref={menuRef}>
        <GlassPanel variant="menu" zIndex={60}>
          <div className="box-border w-[17rem] p-2 space-y-1 select-none text-[var(--text-body)]">
            {/* Header */}
            <div className="flex items-center justify-between px-1.5 pb-1 border-b border-[var(--panel-divider)]/40">
              <span className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                Studio Settings
              </span>
              <span className="text-[9px] font-mono text-yellow-400 font-semibold px-1 py-0.5 rounded bg-yellow-400/10">
                vStudio
              </span>
            </div>

            {/* Language Accordion */}
            <button
              type="button"
              onClick={() => {
                setLanguageExpanded((v) => !v);
                setAccentsExpanded(false);
                setTypographyExpanded(false);
              }}
              onMouseEnter={() => setHoverId("language")}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs ${
                hoverId === "language" || languageExpanded
                  ? menuRowHighlight
                  : `${menuRowIdle} hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]`
              }`}
            >
              <span className="flex items-center gap-2">
                <LuGlobe className="h-3.5 w-3.5" />
                <span>{t(uiLanguage, "language")}</span>
              </span>
              <LuChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  languageExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <GsapHeightAccordion
              open={languageExpanded}
              innerClassName="flex flex-col gap-1 px-1 pb-1 pt-0.5"
              contentKey={uiLanguage}
            >
              {(
                [
                  ["en", "langEn"],
                  ["de", "langDe"],
                  ["es", "langEs"],
                ] as const
              ).map(([lang, labelKey]) => {
                const isSelected = uiLanguage === lang;
                const isHovered = hoverId === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onMouseEnter={() => setHoverId(lang)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => {
                      setUiLanguage(lang);
                      setHoverId(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs ${
                      isSelected || isHovered
                        ? menuRowHighlight
                        : `${menuRowIdle} text-[var(--text-body)]`
                    }`}
                  >
                    <span className="h-4 w-4 overflow-hidden rounded-full border border-white/60 shadow-sm">
                      <Image
                        src={`/${lang}.svg`}
                        alt={lang}
                        width={16}
                        height={16}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="flex-1">{t(uiLanguage, labelKey)}</span>
                    {isSelected && <LuCheck className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </GsapHeightAccordion>

            {/* Studio Accents Accordion */}
            <button
              type="button"
              onClick={() => {
                setAccentsExpanded((v) => !v);
                setLanguageExpanded(false);
                setTypographyExpanded(false);
              }}
              onMouseEnter={() => setHoverId("accents")}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs ${
                hoverId === "accents" || accentsExpanded
                  ? menuRowHighlight
                  : `${menuRowIdle} hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]`
              }`}
            >
              <span className="flex items-center gap-2">
                <LuPalette className="h-3.5 w-3.5" />
                <span>Accent Color</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: STUDIO_ACCENTS[accent].hex }}
                />
                <LuChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    accentsExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            <GsapHeightAccordion
              open={accentsExpanded}
              innerClassName="flex flex-col gap-1.5 px-2 pb-1.5 pt-0.5 bg-[var(--surface-overlay)]/40 rounded-xl"
              contentKey={accent}
            >
              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {(Object.keys(STUDIO_ACCENTS) as StudioAccent[]).map((key) => {
                  const acc = STUDIO_ACCENTS[key];
                  const isSelected = accent === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAccent(key)}
                      title={acc.name}
                      className={`h-6 rounded-lg flex items-center justify-center transition-transform ${
                        isSelected
                          ? "ring-2 ring-white/90 scale-110 shadow-md"
                          : "opacity-75 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: acc.hex }}
                    >
                      {isSelected && <LuCheck className="h-3 w-3 text-zinc-950 font-bold" />}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={syncArchMep}
                  onChange={(e) => setSyncArchMep(e.target.checked)}
                  className="rounded border-[var(--panel-divider)] text-yellow-400 focus:ring-0"
                />
                <span>Sync Arch & MEP accents</span>
              </label>
            </GsapHeightAccordion>

            {/* Typography Accordion */}
            <button
              type="button"
              onClick={() => {
                setTypographyExpanded((v) => !v);
                setLanguageExpanded(false);
                setAccentsExpanded(false);
              }}
              onMouseEnter={() => setHoverId("typography")}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs ${
                hoverId === "typography" || typographyExpanded
                  ? menuRowHighlight
                  : `${menuRowIdle} hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]`
              }`}
            >
              <span className="flex items-center gap-2">
                <LuType className="h-3.5 w-3.5" />
                <span>Typography</span>
              </span>
              <LuChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  typographyExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <GsapHeightAccordion
              open={typographyExpanded}
              innerClassName="flex flex-col gap-1.5 px-2 pb-1.5 pt-0.5 bg-[var(--surface-overlay)]/40 rounded-xl"
              contentKey={font}
            >
              <div className="flex gap-1 pt-1">
                {[
                  { id: "inter", label: "Clean" },
                  { id: "jakarta", label: "Studio" },
                  { id: "mono", label: "CAD Mono" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f.id as StudioFont)}
                    className={`flex-1 py-1 text-[10px] font-semibold rounded border text-center transition-all ${
                      font === f.id
                        ? "border-yellow-400/80 bg-[var(--surface-card)] text-[var(--text-strong)]"
                        : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(["compact", "default", "spacious"] as StudioFontScale[]).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setFontScale(scale)}
                    className={`flex-1 py-0.5 text-[9px] capitalize rounded border text-center transition-all ${
                      fontScale === scale
                        ? "border-yellow-400/80 bg-[var(--surface-card)] text-[var(--text-strong)] font-bold"
                        : "border-[var(--panel-divider)] text-[var(--text-muted)]"
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </GsapHeightAccordion>

            {/* UI Theme Toggle */}
            <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1">
              <span className="text-xs font-medium text-[var(--text-body)] flex items-center gap-2">
                {isDark ? <LuMoon className="h-3.5 w-3.5" /> : <LuSun className="h-3.5 w-3.5 text-yellow-400" />}
                <span>{t(uiLanguage, "theme")}</span>
              </span>
              <ThemeToggle />
            </div>

            {/* Seasonal Ambient BG */}
            <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1">
              <span className="text-xs font-medium text-[var(--text-body)]">
                {t(uiLanguage, "seasonalBg")}
              </span>
              <SeasonalBgToggle />
            </div>

            {/* Quick Actions Row: Grid, Print, Fullscreen */}
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-[var(--panel-divider)]/40">
              <button
                type="button"
                onClick={() => setShow3DGrid(!show3DGrid)}
                className={`flex items-center justify-center gap-1 py-1 rounded border text-[10px] font-semibold transition-all ${
                  show3DGrid
                    ? "border-yellow-400/60 bg-[var(--surface-card)] text-[var(--text-strong)] font-bold"
                    : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)]"
                }`}
              >
                <LuGrid2X2 className="h-3 w-3" />
                <span>Grid</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1 py-1 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:text-[var(--text-strong)] text-[10px] font-semibold transition-all"
              >
                <LuPrinter className="h-3 w-3" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center justify-center gap-1 py-1 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:text-[var(--text-strong)] text-[10px] font-semibold transition-all"
              >
                {isFullscreen ? <LuMinimize className="h-3 w-3" /> : <LuMaximize className="h-3 w-3" />}
                <span>{isFullscreen ? "Exit" : "Full"}</span>
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </GsapPopMenu>
  );
}
