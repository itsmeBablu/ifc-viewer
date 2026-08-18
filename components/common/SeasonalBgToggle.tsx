"use client";

/**
 * SeasonalBgToggle — single thermometer icon pill switch for seasonal ambient background.
 * ON: warm amber/orange track + vibrant orange/amber thermometer icon on knob.
 * OFF: neutral glass track + gray thermometer icon on knob.
 */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { PiThermometerHotFill } from "react-icons/pi";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const KNOB_TRAVEL = 22;

type Props = {
  className?: string;
};

export default function SeasonalBgToggle({ className = "" }: Props) {
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const setAutoSceneBackground = useAppStore((s) => s.setAutoSceneBackground);
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const isOn = autoSceneBackground;
  const knobRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    killGsap(knob);
    gsap.to(knob, {
      x: isOn ? KNOB_TRAVEL : 0,
      duration: gsapDuration.menu,
      ease: gsapEase.iosOut,
    });
  }, [isOn]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={t(uiLanguage, "seasonalBg")}
      onClick={() => setAutoSceneBackground(!isOn)}
      className={`relative h-7 w-[3.1rem] shrink-0 rounded-full border transition-[background-color,border-color,box-shadow] duration-300 ease-out ${
        isOn
          ? "border-amber-300/80 bg-gradient-to-r from-amber-300/85 via-yellow-300/75 to-amber-400/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_12px_rgba(251,191,36,0.3)]"
          : "border-[var(--glass-border)] bg-[var(--glass-inset-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
      } ${className}`}
    >
      <span
        ref={knobRef}
        className="absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/60 bg-gradient-to-br from-white/95 to-zinc-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]"
      >
        <PiThermometerHotFill
          className={`h-3.5 w-3.5 transition-colors duration-300 ${
            isOn ? "text-amber-600" : "text-zinc-400 dark:text-zinc-500"
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}
