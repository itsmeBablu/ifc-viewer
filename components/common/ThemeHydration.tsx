"use client";

import { useLayoutEffect } from "react";
import { applyThemeVars } from "@/lib/themeColors";
import {
  getDefaultSceneBackground,
  getModeSkyBottomHex,
  getModeSkyHex,
  getModeSkyPreset,
} from "@/lib/sceneSky";
import { useAppStore } from "@/store/useAppStore";

/** Apply saved theme + mode sky before first paint on the client. */
export default function ThemeHydration() {
  useLayoutEffect(() => {
    const theme = useAppStore.getState().colorTheme;
    const mode = useAppStore.getState().dataViewMode;
    if (useAppStore.getState().autoSceneBackground) {
      applyThemeVars(theme, {
        sceneBackground: getModeSkyHex(mode, theme),
        pageBackground: getModeSkyBottomHex(mode, theme),
      });
      useAppStore
        .getState()
        .setSceneBackground(getModeSkyPreset(mode, theme));
    } else {
      applyThemeVars(theme);
      useAppStore
        .getState()
        .setSceneBackground(getDefaultSceneBackground(theme), { persist: false });
    }
  }, []);

  return null;
}
