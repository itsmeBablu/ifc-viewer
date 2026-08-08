"use client";

/**
 * SeasonalBgToggle — snowflake (seasonal) / hot thermometer (fixed) pill switch.
 * Left = snowflake on, right = red thermometer off.
 */

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { PiSnowflakeThin, PiThermometerHotFill } from "react-icons/pi";
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
  const snowTrackRef = useRef<HTMLSpanElement>(null);
  const heatTrackRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    killGsap(knob);
    gsap.to(knob, {
      x: isOn ? 0 : KNOB_TRAVEL,
      duration: gsapDuration.menu,
      ease: gsapEase.iosOut,
    });
  }, [isOn]);

  useLayoutEffect(() => {
    if (snowTrackRef.current) {
      gsap.to(snowTrackRef.current, {
        opacity: isOn ? 0.9 : 0.4,
        duration: gsapDuration.menu,
        ease: gsapEase.iosOut,
      });
    }
    if (heatTrackRef.current) {
      gsap.to(heatTrackRef.current, {
        opacity: isOn ? 0.4 : 0.9,
        duration: gsapDuration.menu,
        ease: gsapEase.iosOut,
      });
    }
  }, [isOn]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={t(uiLanguage, "seasonalBg")}
      onClick={() => setAutoSceneBackground(!isOn)}
      className={`relative h-7 w-[3.1rem] shrink-0 rounded-full border border-[var(--glass-border)] bg-[var(--glass-inset-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${className}`}
    >
      <span
        ref={snowTrackRef}
        className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2"
      >
        <PiSnowflakeThin className="h-3.5 w-3.5 text-sky-400/90" aria-hidden />
      </span>
      <span
        ref={heatTrackRef}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
      >
        <PiThermometerHotFill className="h-3.5 w-3.5 text-red-500" aria-hidden />
      </span>
      <span
        ref={knobRef}
        className="absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/55 bg-gradient-to-br from-white/95 to-zinc-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]"
      >
        {isOn ? (
          <PiSnowflakeThin className="h-3.5 w-3.5 text-sky-600" aria-hidden />
        ) : (
          <PiThermometerHotFill className="h-3.5 w-3.5 text-red-600" aria-hidden />
        )}
      </span>
    </button>
  );
}
