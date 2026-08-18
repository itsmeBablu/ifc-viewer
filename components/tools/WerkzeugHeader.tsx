"use client";

/**
 * WerkzeugHeader — minimal top bar for the standalone /werkzeug route.
 * Logo, IFC upload, profile settings. No heating / ventilation / cooling modes.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MdOutlineAccountCircle } from "react-icons/md";
import GlassPanel from "@/components/common/GlassPanel";
import GsapPopMenu from "@/components/common/GsapPopMenu";
import GsapHeightAccordion from "@/components/common/GsapHeightAccordion";
import ThemeToggle from "@/components/common/ThemeToggle";
import SeasonalBgToggle from "@/components/common/SeasonalBgToggle";
import { t } from "@/lib/i18n";
import { OPEN_IFC_FILE_EVENT } from "@/lib/viewerHotkeys";
import { useAppStore } from "@/store/useAppStore";

type ProfileHoverId = "language" | "theme" | "seasonalBg" | "en" | "de" | "es";

const menuRowIdle =
  "box-border border border-transparent transition-[background-color,border-color,box-shadow,color] duration-200";

function menuRowStyles(isDark: boolean) {
  const surface = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/92 via-yellow-200/82 to-amber-400/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_16px_rgba(251,191,36,0.4)] backdrop-blur-md"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/90 via-yellow-300/70 to-amber-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(251,191,36,0.28)] backdrop-blur-md";
  return {
    highlight: `${surface} font-semibold text-amber-950`,
    surfaceHighlight: `${surface} text-amber-950`,
  };
}

function UploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V5" />
      <path d="m8 9 4-4 4 4" />
      <path d="M4 19h16" />
    </svg>
  );
}

type Props = {
  onFile: (file: File) => void;
  isLoadingModel: boolean;
};

export default function WerkzeugHeader({ onFile, isLoadingModel }: Props) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const isDark = colorTheme === "dark";
  const { highlight: menuRowHighlight, surfaceHighlight: menuRowSurfaceHighlight } =
    menuRowStyles(isDark);

  const [profileOpen, setProfileOpen] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [profileHoverId, setProfileHoverId] = useState<ProfileHoverId | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const sideBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[color,background,border,box-shadow,transform] duration-300 ease-out active:scale-95 sm:h-9 sm:w-9";
  const sideIdle = isDark
    ? `${sideBtn} border border-transparent text-[var(--toolbar-icon)] hover:border-amber-300/80 hover:bg-gradient-to-br hover:from-amber-300/95 hover:via-yellow-200/88 hover:to-amber-400/78 hover:text-amber-950`
    : `${sideBtn} border border-transparent text-[var(--toolbar-icon)] hover:border-amber-200/70 hover:bg-gradient-to-br hover:from-amber-200/95 hover:via-yellow-300/85 hover:to-amber-400/75 hover:text-amber-950`;
  const yellowGloss = isDark
    ? "amber-gloss-surface border border-amber-300/80 bg-gradient-to-br from-amber-300/95 via-yellow-200/88 to-amber-400/78 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]"
    : "amber-gloss-surface border border-amber-200/70 bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_14px_rgba(251,191,36,0.35)]";
  const sideActive = `${sideBtn} ${yellowGloss}`;

  useEffect(() => {
    const openPicker = () => {
      if (isLoadingModel) return;
      fileInputRef.current?.click();
    };
    window.addEventListener(OPEN_IFC_FILE_EVENT, openPicker);
    return () => window.removeEventListener(OPEN_IFC_FILE_EVENT, openPicker);
  }, [isLoadingModel]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
        setLanguageExpanded(false);
        setProfileHoverId(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed top-2 left-2 z-[45] sm:top-3 md:left-4"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.frag,application/x-step,application/octet-stream,.IFC,.FRAG"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />

      <div className="relative">
        <GsapPopMenu
          show={profileOpen}
          className="absolute top-[calc(100%+0.45rem)] right-0 z-[50]"
          onMouseLeave={() => setProfileHoverId(null)}
        >
          <GlassPanel variant="menu" zIndex={50}>
            <div className="box-border w-[13.25rem] p-1.5 sm:w-[14.25rem] sm:p-2">
              <p className="mb-1.5 px-1.5 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
                {t(uiLanguage, "profile")}
              </p>

              <button
                type="button"
                onClick={() => setLanguageExpanded((v) => !v)}
                aria-expanded={languageExpanded}
                onMouseEnter={() => setProfileHoverId("language")}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs ${
                  (profileHoverId != null
                    ? profileHoverId === "language"
                    : languageExpanded)
                    ? menuRowHighlight
                    : `${menuRowIdle} text-[var(--text-body)]`
                }`}
              >
                <span>{t(uiLanguage, "language")}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform duration-300 ${languageExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
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
                  const isHovered = profileHoverId === lang;
                  const isHighlighted = isSelected || isHovered;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onMouseEnter={() => setProfileHoverId(lang)}
                      onMouseLeave={() => setProfileHoverId(null)}
                      onClick={() => {
                        setUiLanguage(lang);
                        setProfileHoverId(null);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs ${
                        isHighlighted
                          ? menuRowHighlight
                          : `${menuRowIdle} text-[var(--text-body)]`
                      }`}
                    >
                      <span className="h-5 w-5 overflow-hidden rounded-full border border-white/60 shadow-sm">
                        <Image
                          src={`/${lang}.svg`}
                          alt={lang}
                          width={20}
                          height={20}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      {t(uiLanguage, labelKey)}
                    </button>
                  );
                })}
              </GsapHeightAccordion>

              <div className="mt-1 box-border flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5">
                <p className="text-xs font-medium text-[var(--text-body)]">
                  {t(uiLanguage, "theme")}
                </p>
                <ThemeToggle />
              </div>

              <div className="mt-1 box-border flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5">
                <p className="text-xs font-medium text-[var(--text-body)]">
                  {t(uiLanguage, "seasonalBg")}
                </p>
                <SeasonalBgToggle />
              </div>
            </div>
          </GlassPanel>
        </GsapPopMenu>

        <GlassPanel variant="panel" zIndex={45} wrapperClassName="inline-flex rounded-3xl">
          <div className="flex h-10 items-center gap-3 px-3 sm:h-11 sm:px-4">
            <Image
              src="/ibv_logo.svg"
              alt="IBV logo"
              width={132}
              height={32}
              className="h-6 w-auto object-contain sm:h-7"
              priority
            />

            <span className="h-5 w-px shrink-0 bg-amber-400/80" aria-hidden />

            <span className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              {t(uiLanguage, "tool")}
            </span>

            <button
              type="button"
              disabled={isLoadingModel}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t(uiLanguage, "loadIfc")}
              className={`${sideIdle} disabled:opacity-45`}
              title={t(uiLanguage, "ifcUpload")}
            >
              <UploadIcon />
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => {
                  if (v) setLanguageExpanded(false);
                  return !v;
                });
              }}
              aria-expanded={profileOpen}
              aria-label={t(uiLanguage, "profile")}
              className={profileOpen ? sideActive : sideIdle}
            >
              <MdOutlineAccountCircle className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
