/**
 * Welcome-screen preferences — stored locally until a backend exists.
 */

import type { UiLanguage } from "@/lib/i18n";
import type { ColorTheme } from "@/lib/themeColors";

export const WELCOME_PREFS_KEY = "ifc-viewer-preferences";

export type WelcomePreferences = {
  userName: string;
  language: UiLanguage;
  theme: ColorTheme;
  seasonalBackground: boolean;
  /** Set after first successful "Let's Go" — used to pre-fill on return visits. */
  welcomeCompleted: boolean;
};

const DEFAULT_PREFS: WelcomePreferences = {
  userName: "",
  language: "de",
  theme: "light",
  seasonalBackground: true,
  welcomeCompleted: false,
};

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "en" || value === "de" || value === "es";
}

export function readWelcomePreferences(): WelcomePreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(WELCOME_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<WelcomePreferences>;
    return {
      userName:
        typeof parsed.userName === "string" ? parsed.userName : DEFAULT_PREFS.userName,
      language: isUiLanguage(parsed.language) ? parsed.language : DEFAULT_PREFS.language,
      theme:
        parsed.theme === "dark" || parsed.theme === "light"
          ? parsed.theme
          : DEFAULT_PREFS.theme,
      seasonalBackground:
        typeof parsed.seasonalBackground === "boolean"
          ? parsed.seasonalBackground
          : DEFAULT_PREFS.seasonalBackground,
      welcomeCompleted:
        typeof parsed.welcomeCompleted === "boolean"
          ? parsed.welcomeCompleted
          : DEFAULT_PREFS.welcomeCompleted,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writeWelcomePreferences(prefs: WelcomePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WELCOME_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

/** Merge partial updates into saved welcome preferences (e.g. language from header). */
export function patchWelcomePreferences(patch: Partial<WelcomePreferences>): void {
  writeWelcomePreferences({ ...readWelcomePreferences(), ...patch });
}
