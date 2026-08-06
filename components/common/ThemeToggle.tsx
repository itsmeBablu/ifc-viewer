"use client";

/**
 * ThemeToggle — sun/moon pill switch for light/dark color theme.
 *
 * Animates the knob position and icon opacities with GSAP on theme
 * change; the cinematic full-screen day/night blend itself is handled
 * separately by ThemeTransition, which listens to the same store state.
 */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { PiMoonThin, PiSunDimThin } from "react-icons/pi";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const KNOB_TRAVEL = 22;

type Props = {
  className?: string;
};

/** Sun / moon pill toggle — knob animates with GSAP; cinematic blend runs in ThemeTransition. */
export default function ThemeToggle({ className = "" }: Props) {
  const colorTheme = useAppStore((s) => s.colorTheme);
  const setColorTheme = useAppStore((s) => s.setColorTheme);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isDark = colorTheme === "dark";
  const knobRef = useRef<HTMLSpanElement>(null);
  const sunIconRef = useRef<HTMLSpanElement>(null);
  const moonIconRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    killGsap(knob);
    gsap.to(knob, {
      x: isDark ? KNOB_TRAVEL : 0,
      duration: gsapDuration.menu,
      ease: gsapEase.iosOut,
    });
  }, [isDark]);

  useLayoutEffect(() => {
    if (sunIconRef.current) {
      gsap.to(sunIconRef.current, {
        opacity: isDark ? 0.45 : 0.85,
        duration: gsapDuration.menu,
        ease: gsapEase.iosOut,
      });
    }
    if (moonIconRef.current) {
      gsap.to(moonIconRef.current, {
        opacity: isDark ? 0.9 : 0.4,
        duration: gsapDuration.menu,
        ease: gsapEase.iosOut,
      });
    }
  }, [isDark]);

  const toggle = () => {
    setColorTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={
        isDark ? t(uiLanguage, "dayMode") : t(uiLanguage, "nightMode")
      }
      onClick={toggle}
      className={`relative h-7 w-[3.1rem] shrink-0 rounded-full border border-[var(--glass-border)] bg-[var(--glass-inset-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${className}`}
    >
      <span
        ref={sunIconRef}
        className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2"
      >
        <PiSunDimThin className="h-3.5 w-3.5 text-amber-500/85" aria-hidden />
      </span>
      <span
        ref={moonIconRef}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
      >
        <PiMoonThin className="h-3.5 w-3.5 text-indigo-100/90" aria-hidden />
      </span>
      <span
        ref={knobRef}
        className="absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/55 bg-gradient-to-br from-white/95 to-zinc-100/90 text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]"
      >
        {isDark ? (
          <PiMoonThin className="h-3.5 w-3.5 text-indigo-800" aria-hidden />
        ) : (
          <PiSunDimThin className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        )}
      </span>
    </button>
  );
}
