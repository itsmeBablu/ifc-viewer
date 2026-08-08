"use client";

/**
 * WelcomeGate — shows the welcome screen until the user continues, or when
 * Home is chosen from the mode menu.
 */

import { useCallback, type ReactNode } from "react";
import type { WelcomePreferences } from "@/lib/welcomePreferences";
import { useAppStore } from "@/store/useAppStore";
import WelcomeScreen from "./WelcomeScreen";

type Props = {
  children: ReactNode;
};

export default function WelcomeGate({ children }: Props) {
  const welcomeAppEntered = useAppStore((s) => s.welcomeAppEntered);
  const welcomeScreenRequested = useAppStore((s) => s.welcomeScreenRequested);
  const completeWelcomeScreen = useAppStore((s) => s.completeWelcomeScreen);

  const showWelcome = welcomeScreenRequested || !welcomeAppEntered;

  const onContinue = useCallback(
    (_prefs: WelcomePreferences) => {
      completeWelcomeScreen();
    },
    [completeWelcomeScreen],
  );

  if (showWelcome) {
    return <WelcomeScreen onContinue={onContinue} />;
  }

  return <>{children}</>;
}
