"use client";

/**
 * WelcomeScreen — responsive split/stacked home with live 3D preview + preferences.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LuLock } from "react-icons/lu";
import GlassPanel from "@/components/common/GlassPanel";
import ThemeToggle from "@/components/common/ThemeToggle";
import SeasonalBgToggle from "@/components/common/SeasonalBgToggle";
import LanguageSelect from "@/components/common/LanguageSelect";
import ThemeHydration from "@/components/common/ThemeHydration";
import ThemeTransition from "@/components/common/ThemeTransition";
import { motion, radius } from "@/lib/designTokens";
import { t } from "@/lib/i18n";
import { applyThemeVars } from "@/lib/themeColors";
import {
  readWelcomePreferences,
  writeWelcomePreferences,
  type WelcomePreferences,
} from "@/lib/welcomePreferences";
import { getWelcomeAmbientBackground } from "@/lib/seasonalAmbient";
import { getSceneCssHex } from "@/lib/sceneSky";
import { useAppStore } from "@/store/useAppStore";
import AmbientViewport from "./AmbientViewport";
import { getWelcomeLayout, type WelcomeLayoutConfig } from "./welcomeLayout";
import "./welcome.css";

type Props = {
  onContinue: (prefs: WelcomePreferences) => void;
};

const DEFAULT_LAYOUT = getWelcomeLayout(390, 844);

export default function WelcomeScreen({ onContinue }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setColorTheme = useAppStore((s) => s.setColorTheme);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const setUiLanguage = useAppStore((s) => s.setUiLanguage);
  const completeWelcomeScreen = useAppStore((s) => s.completeWelcomeScreen);
  const showWerkzeugLink = pathname !== "/werkzeug";

  const [userName, setUserName] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [layout, setLayout] = useState<WelcomeLayoutConfig>(DEFAULT_LAYOUT);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    const update = () => {
      setLayout(getWelcomeLayout(window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const saved = readWelcomePreferences();
    setUserName(saved.userName);
    setUiLanguage(saved.language);
    setColorTheme(saved.theme);
    setAutoSceneBackground(saved.seasonalBackground);
    applyThemeVars(saved.theme, {
      sceneBackground: getSceneCssHex(
        getWelcomeAmbientBackground(saved.theme, saved.seasonalBackground),
      ),
    });
    setHydrated(true);
  }, [setAutoSceneBackground, setColorTheme, setUiLanguage]);

  useEffect(() => {
    if (!hydrated) return;
    applyThemeVars(colorTheme, {
      sceneBackground: getSceneCssHex(
        getWelcomeAmbientBackground(colorTheme, autoSceneBackground),
      ),
    });
  }, [colorTheme, autoSceneBackground, hydrated]);

  const buildPrefs = (): WelcomePreferences => ({
    userName: userName.trim(),
    language: uiLanguage,
    theme: colorTheme,
    seasonalBackground: autoSceneBackground,
    welcomeCompleted: true,
  });

  const handleContinue = () => {
    const prefs = buildPrefs();
    writeWelcomePreferences(prefs);
    onContinue(prefs);
  };

  const handleGoWerkzeug = () => {
    const prefs = buildPrefs();
    writeWelcomePreferences(prefs);
    completeWelcomeScreen();
    router.push("/werkzeug");
  };

  if (!hydrated) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-[var(--background)]">
        <ThemeHydration />
      </div>
    );
  }

  const btnMotion = `${motion.base} ${radius.control}`;
  const showHints = layout.tier === "splitSpacious";

  const mobileFields = (
    <div className={layout.fieldsClass}>
      <label className="shrink-0">
        <span className={layout.labelClass}>{t(uiLanguage, "welcomeNameLabel")}</span>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={t(uiLanguage, "welcomeNamePlaceholder")}
          autoComplete="name"
          className={layout.inputClass}
        />
      </label>

      <div className={layout.cardClass}>
        <p className={layout.bodyTextClass}>{t(uiLanguage, "language")}</p>
        <div className={layout.isMobileLandscape ? "welcome-mobile-lang-inner mt-1" : "mt-2"}>
          <LanguageSelect wide compact={layout.languageCompact} />
        </div>
      </div>

      <div className={`welcome-mobile-theme ${layout.themeCardClass}`}>
        <p className={layout.bodyTextClass}>{t(uiLanguage, "theme")}</p>
        <div className="welcome-mobile-theme-toggle">
          <ThemeToggle />
        </div>
      </div>

      <div className={layout.seasonalCardClass}>
        <div className="welcome-mobile-seasonal-row">
          <p className={layout.bodyTextClass}>{t(uiLanguage, "seasonalBg")}</p>
          <SeasonalBgToggle />
        </div>
        <p className={layout.seasonalHintClass}>{t(uiLanguage, "welcomeSeasonalHint")}</p>
      </div>
    </div>
  );

  const desktopFields = (
    <div className={layout.fieldsClass}>
      <label className="block shrink-0">
        <span className={layout.labelClass}>{t(uiLanguage, "welcomeNameLabel")}</span>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={t(uiLanguage, "welcomeNamePlaceholder")}
          autoComplete="name"
          className={layout.inputClass}
        />
      </label>

      <div className={layout.cardClass}>
        <p className={layout.bodyTextClass}>{t(uiLanguage, "language")}</p>
        {showHints && (
          <p className={layout.hintClass}>{t(uiLanguage, "welcomeLanguageHint")}</p>
        )}
        <div className="mt-2 sm:mt-3">
          <LanguageSelect wide compact={layout.languageCompact} />
        </div>
      </div>

      <div className={layout.togglesRowClass}>
        <div className={layout.toggleCellClass}>
          <p className={layout.bodyTextClass}>{t(uiLanguage, "theme")}</p>
          {showHints && <p className={layout.hintClass}>{t(uiLanguage, "themeHint")}</p>}
          <ThemeToggle />
        </div>
        <div className="w-px shrink-0 self-stretch bg-[var(--panel-divider)]" aria-hidden />
        <div className={layout.toggleCellClass}>
          <p className={layout.bodyTextClass}>{t(uiLanguage, "seasonalBg")}</p>
          {showHints && (
            <p className={layout.hintClass}>{t(uiLanguage, "welcomeSeasonalHint")}</p>
          )}
          <SeasonalBgToggle />
        </div>
      </div>
    </div>
  );

  const handlePasswordSubmit = () => {
    if (passwordInput.trim() === "2303") {
      setPasswordModalOpen(false);
      setPasswordInput("");
      setPasswordError(false);
      handleGoWerkzeug();
    } else {
      setPasswordError(true);
    }
  };

  const werkzeugBtn = (
    <button
      type="button"
      onClick={() => {
        setPasswordModalOpen(true);
        setPasswordInput("");
        setPasswordError(false);
      }}
      className={`${btnMotion} ${layout.secondaryBtnClass} inline-flex items-center justify-center gap-1.5`}
    >
      <span>{t(uiLanguage, "welcomeGoWerkzeug")}</span>
      <LuLock className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden />
    </button>
  );

  const mobileActions = (
    <div className={layout.actionsClass}>
      {showWerkzeugLink && werkzeugBtn}
      <button
        type="button"
        onClick={handleContinue}
        className={`${btnMotion} ${layout.primaryBtnClass}`}
      >
        {t(uiLanguage, "welcomeLetsGo")}
      </button>
    </div>
  );

  const desktopActions = (
    <div className={layout.actionsClass}>
      <button
        type="button"
        onClick={handleContinue}
        className={`${btnMotion} ${layout.primaryBtnClass}`}
      >
        {t(uiLanguage, "welcomeLetsGo")}
      </button>
      {showWerkzeugLink && werkzeugBtn}
    </div>
  );

  return (
    <div
      className={`flex h-dvh max-h-dvh w-full overflow-hidden bg-[var(--background)] text-[var(--text-body)] ${
        layout.isWide ? "flex-row" : "flex-col"
      }`}
    >
      <ThemeHydration />
      <ThemeTransition />

      <div className={layout.viewportClass}>
        <AmbientViewport
          colorTheme={colorTheme}
          seasonalOn={autoSceneBackground}
          className="absolute inset-0"
        />
      </div>

      <div className={layout.formClass}>
        <GlassPanel
          variant="panel"
          zIndex={10}
          fill
          wrapperClassName="flex h-full min-h-0 flex-col overflow-hidden rounded-none"
        >
          <div className={layout.shellClass}>
            <div className={`${layout.contentBlockClass} ${layout.formMaxWidth}`}>
              <header className={layout.headerClass}>
                <Image
                  src="/ibv_logo.svg"
                  alt="IBV"
                  width={220}
                  height={56}
                  className={layout.logoClass}
                  priority
                />
                <h1 className={layout.titleClass}>{t(uiLanguage, "welcomeTitle")}</h1>
                {layout.showSubtitle && (
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                    {t(uiLanguage, "welcomeSubtitle")}
                  </p>
                )}
              </header>

              {layout.isMobileForm ? mobileFields : desktopFields}
              {layout.isMobileForm ? mobileActions : desktopActions}
            </div>
          </div>
        </GlassPanel>
      </div>

      {passwordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="werkzeug-pwd-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPasswordModalOpen(false);
              setPasswordInput("");
              setPasswordError(false);
            }
          }}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <GlassPanel
              variant="panel"
              zIndex={101}
              wrapperClassName="overflow-hidden rounded-3xl border border-[var(--panel-divider)] shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
            >
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/90 via-yellow-200/80 to-amber-400/70 text-amber-950 shadow-sm border border-amber-300/70">
                      <LuLock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2
                        id="werkzeug-pwd-title"
                        className="text-sm font-semibold tracking-wide text-[var(--text-strong)]"
                      >
                        {t(uiLanguage, "werkzeugPasswordTitle")}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {t(uiLanguage, "werkzeugPasswordPrompt")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordModalOpen(false);
                      setPasswordInput("");
                      setPasswordError(false);
                    }}
                    className="rounded-lg p-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                    aria-label={t(uiLanguage, "cancel")}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handlePasswordSubmit();
                  }}
                  className="space-y-3.5 pt-1"
                >
                  <div>
                    <input
                      type="password"
                      autoFocus
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (passwordError) setPasswordError(false);
                      }}
                      placeholder={t(uiLanguage, "werkzeugPasswordPlaceholder")}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-xs tracking-wider text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none transition-all ${
                        passwordError
                          ? "border-red-500/80 bg-red-500/10 focus:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]"
                          : "border-[var(--glass-border)] bg-[var(--glass-inset-bg)] focus:border-amber-400/80 focus:shadow-[0_0_0_1px_rgba(251,191,36,0.3)]"
                      }`}
                    />
                    {passwordError && (
                      <p className="mt-1.5 text-[11px] font-medium text-red-500">
                        {t(uiLanguage, "werkzeugPasswordError")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordModalOpen(false);
                        setPasswordInput("");
                        setPasswordError(false);
                      }}
                      className={`${btnMotion} rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border)]`}
                    >
                      {t(uiLanguage, "cancel")}
                    </button>
                    <button
                      type="submit"
                      className={`${btnMotion} rounded-xl bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-400 px-4 py-2 text-xs font-semibold text-amber-950 shadow-sm hover:brightness-105 active:scale-95`}
                    >
                      {t(uiLanguage, "werkzeugPasswordSubmit")}
                    </button>
                  </div>
                </form>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
