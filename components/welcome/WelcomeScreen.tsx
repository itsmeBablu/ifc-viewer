"use client";

/**
 * WelcomeScreen — responsive split/stacked home with live 3D preview + preferences.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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

  const mobileActions = (
    <div className={layout.actionsClass}>
      {showWerkzeugLink && (
        <button
          type="button"
          onClick={handleGoWerkzeug}
          className={`${btnMotion} ${layout.secondaryBtnClass}`}
        >
          {t(uiLanguage, "welcomeGoWerkzeug")}
        </button>
      )}
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
      {showWerkzeugLink && (
        <button
          type="button"
          onClick={handleGoWerkzeug}
          className={`${btnMotion} ${layout.secondaryBtnClass}`}
        >
          {t(uiLanguage, "welcomeGoWerkzeug")}
        </button>
      )}
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
    </div>
  );
}
