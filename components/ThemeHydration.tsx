"use client";

import { useLayoutEffect } from "react";
import { applyThemeVars } from "@/lib/themeColors";
import { getDefaultSceneBackground, getModeSkyPreset } from "@/lib/sceneSky";
import { useAppStore } from "@/store/useAppStore";

/** Apply saved theme + mode sky before first paint on the client. */
export default function ThemeHydration() {
  useLayoutEffect(() => {
    const theme = useAppStore.getState().colorTheme;
    const mode = useAppStore.getState().dataViewMode;
    applyThemeVars(theme);
    if (useAppStore.getState().autoSceneBackground) {
      useAppStore
        .getState()
        .setSceneBackground(getModeSkyPreset(mode, theme));
    } else {
      useAppStore
        .getState()
        .setSceneBackground(getDefaultSceneBackground(theme), { persist: false });
    }
  }, []);

  return null;
}
