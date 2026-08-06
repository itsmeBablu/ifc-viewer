"use client";

/**
 * ThemeTransition — cinematic full-screen day/night blend overlay,
 * portaled to <body>, that plays whenever colorTheme or dataViewMode
 * (for auto seasonal sky) changes.
 *
 * Supports interrupting a blend mid-flight and reversing/continuing from
 * the current progress instead of restarting, so rapid toggles stay
 * smooth; also cross-fades the 3D scene's sky background in step with
 * the overlay when autoSceneBackground is enabled.
 */

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { PiMoonThin, PiSunDimThin } from "react-icons/pi";
import { gsapDuration, gsapEase, killGsap } from "@/lib/gsapMotion";
import {
  applyThemeBlend,
  applyThemeVars,
  type ColorTheme,
} from "@/lib/themeColors";
import {
  getDefaultSceneBackground,
  getModeSkyBottomHex,
  getModeSkyHex,
  getModeSkyPreset,
  isDefaultSceneBackground,
  lerpSceneBackgroundValue,
} from "@/lib/sceneSky";
import type { DataViewMode } from "@/lib/dataViewMode";
import { useAppStore } from "@/store/useAppStore";

const FULL = gsapDuration.theme;
const FAST = 1.35;
const MODE_SKY = 1.15;

type BlendState = {
  from: ColorTheme;
  to: ColorTheme;
  t: number;
};

function modeSkySurfaces(mode: DataViewMode, theme: ColorTheme) {
  return {
    sceneBackground: getModeSkyHex(mode, theme),
    pageBackground: getModeSkyBottomHex(mode, theme),
  };
}

/**
 * Cinematic day ↔ night — supports fast toggles by reversing mid-blend
 * instead of waiting for the 3s timeline to finish.
 */
export default function ThemeTransition() {
  const colorTheme = useAppStore((s) => s.colorTheme);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const setSceneBackground = useAppStore((s) => s.setSceneBackground);
  const autoSceneBackground = useAppStore((s) => s.autoSceneBackground);
  const overlayRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef<BlendState>({ from: colorTheme, to: colorTheme, t: 1 });
  const prevModeRef = useRef(dataViewMode);
  const ready = useRef(false);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const prevMode = prevModeRef.current;
    const modeChanged = prevMode !== dataViewMode;
    prevModeRef.current = dataViewMode;

    const applyAutoSkySurfaces = (theme: ColorTheme, mode = dataViewMode) => {
      const surfaces = modeSkySurfaces(mode, theme);
      applyThemeVars(theme, surfaces);
      return surfaces;
    };

    if (!ready.current) {
      if (autoSceneBackground) {
        applyAutoSkySurfaces(colorTheme);
        setSceneBackground(getModeSkyPreset(dataViewMode, colorTheme));
      } else {
        applyThemeVars(colorTheme);
        setSceneBackground(getDefaultSceneBackground(colorTheme), {
          persist: false,
        });
      }
      blendRef.current = { from: colorTheme, to: colorTheme, t: 1 };
      ready.current = true;
      return;
    }

    const to = colorTheme;
    const active = blendRef.current;
    const wasAnimating = active.t < 1;
    const themeChanged = active.to !== to || wasAnimating;

    tweenRef.current?.kill();
    tweenRef.current = null;
    killGsap(
      [overlayRef.current, veilRef.current, sunRef.current, moonRef.current].filter(
        Boolean,
      ),
    );

    if (modeChanged && autoSceneBackground && !themeChanged) {
      const fromPreset = getModeSkyPreset(prevMode, colorTheme);
      const toPreset = getModeSkyPreset(dataViewMode, colorTheme);
      if (fromPreset === toPreset) return;

      const fromSurfaces = modeSkySurfaces(prevMode, colorTheme);
      const toSurfaces = modeSkySurfaces(dataViewMode, colorTheme);
      const state = { t: 0 };

      const finishMode = () => {
        applyThemeVars(colorTheme, toSurfaces);
        setSceneBackground(toPreset);
        tweenRef.current = null;
      };

      const tl = gsap.timeline({ onComplete: finishMode, onInterrupt: finishMode });
      tl.to(
        state,
        {
          t: 1,
          duration: MODE_SKY,
          ease: "power1.inOut",
          onUpdate: () => {
            const sceneValue = lerpSceneBackgroundValue(
              fromPreset,
              toPreset,
              state.t,
            );
            setSceneBackground(sceneValue, { persist: false });
            applyThemeBlend(colorTheme, colorTheme, state.t, {
              from: fromSurfaces,
              to: toSurfaces,
            });
          },
        },
        0,
      );
      tweenRef.current = tl;
      return () => {
        tl.kill();
      };
    }

    if (!themeChanged) return;

    let from: ColorTheme;
    let startT = 0;

    if (wasAnimating) {
      applyThemeBlend(active.from, active.to, active.t, autoSceneBackground
        ? {
            from: modeSkySurfaces(dataViewMode, active.from),
            to: modeSkySurfaces(dataViewMode, active.to),
          }
        : undefined);
      if (to === active.from) {
        from = active.to;
        startT = 1 - active.t;
      } else {
        from = active.to;
        startT = to === active.to ? active.t : 0;
      }
    } else {
      from = active.to;
      startT = 0;
    }

    if (from === to && startT >= 1) return;

    const toDark = to === "dark";
    const duration = wasAnimating
      ? Math.max(FAST, FULL * (1 - startT) * 0.75)
      : FULL;

    const overlay = overlayRef.current;
    const veil = veilRef.current;
    const sun = sunRef.current;
    const moon = moonRef.current;
    const state = { t: startT };

    blendRef.current = { from, to, t: startT };

    const fromSkyPreset = autoSceneBackground
      ? getModeSkyPreset(dataViewMode, from)
      : null;
    const toSkyPreset = autoSceneBackground
      ? getModeSkyPreset(dataViewMode, to)
      : null;
    const fromSurfaces = autoSceneBackground
      ? modeSkySurfaces(dataViewMode, from)
      : undefined;
    const toSurfaces = autoSceneBackground
      ? modeSkySurfaces(dataViewMode, to)
      : undefined;

    const hideOverlay = () => {
      if (overlay) gsap.set(overlay, { autoAlpha: 0 });
      if (veil) gsap.set(veil, { autoAlpha: 0 });
      if (sun) gsap.set(sun, { autoAlpha: 0 });
      if (moon) gsap.set(moon, { autoAlpha: 0 });
    };

    const finish = () => {
      if (autoSceneBackground) {
        applyThemeVars(to, toSurfaces);
        setSceneBackground(toSkyPreset!);
      } else {
        applyThemeVars(to);
        if (isDefaultSceneBackground(useAppStore.getState().sceneBackground, from)) {
          setSceneBackground(getDefaultSceneBackground(to));
        }
      }
      blendRef.current = { from: to, to, t: 1 };
      tweenRef.current = null;
      hideOverlay();
    };

    if (overlay) gsap.set(overlay, { autoAlpha: 0 });
    if (veil) gsap.set(veil, { autoAlpha: 0 });
    if (sun) gsap.set(sun, { autoAlpha: 0, scale: 0.7, y: 24, rotation: 0 });
    if (moon) gsap.set(moon, { autoAlpha: 0, scale: 0.55, y: 32, rotation: -12 });

    const tl = gsap.timeline({
      onComplete: finish,
      onInterrupt: finish,
    });

    tl.to(
      state,
      {
        t: 1,
        duration,
        ease: "power1.inOut",
        onUpdate: () => {
          blendRef.current.t = state.t;
          applyThemeBlend(from, to, state.t, autoSceneBackground
            ? { from: fromSurfaces, to: toSurfaces }
            : undefined);
          if (autoSceneBackground && fromSkyPreset && toSkyPreset) {
            const sceneValue = lerpSceneBackgroundValue(
              fromSkyPreset,
              toSkyPreset,
              state.t,
            );
            setSceneBackground(sceneValue, { persist: false });
          }
        },
      },
      0,
    );

    const fadeIn = duration * 0.42;
    const fadeOut = duration * 0.58;

    if (overlay) {
      tl.fromTo(
        overlay,
        { autoAlpha: 0 },
        { autoAlpha: toDark ? 0.88 : 0.5, duration: fadeIn, ease: gsapEase.iosOut },
        0,
      );
      tl.to(overlay, { autoAlpha: 0, duration: fadeOut, ease: gsapEase.iosIn }, fadeIn);
    }

    if (veil) {
      tl.fromTo(
        veil,
        { autoAlpha: 0 },
        { autoAlpha: toDark ? 0.7 : 0.32, duration: duration * 0.48, ease: "sine.inOut" },
        0,
      );
      tl.to(veil, { autoAlpha: 0, duration: duration * 0.52, ease: "sine.inOut" }, duration * 0.48);
    }

    if (sun) {
      if (toDark) {
        tl.fromTo(
          sun,
          { autoAlpha: 0.96, scale: 1.06, y: 0, rotation: 0 },
          {
            autoAlpha: 0,
            scale: 0.42,
            y: 72,
            rotation: 18,
            duration: duration * 0.72,
            ease: "power2.in",
          },
          0,
        );
      } else {
        const sunDelay = wasAnimating ? 0 : duration * 0.12;
        tl.fromTo(
          sun,
          { autoAlpha: 0, scale: 0.42, y: 72, rotation: -10 },
          {
            autoAlpha: 0.94,
            scale: 1.04,
            y: 0,
            rotation: 0,
            duration: duration * 0.72,
            ease: "power2.out",
          },
          sunDelay,
        );
        tl.to(sun, { autoAlpha: 0, duration: duration * 0.2, ease: "power1.in" }, sunDelay + duration * 0.72);
      }
    }

    if (moon) {
      if (toDark) {
        const moonDelay = wasAnimating ? 0 : duration * 0.14;
        tl.fromTo(
          moon,
          { autoAlpha: 0, scale: 0.5, y: 48, rotation: 16 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotation: 0,
            duration: duration * 0.7,
            ease: "power2.out",
          },
          moonDelay,
        );
        tl.to(moon, { autoAlpha: 0, duration: duration * 0.24, ease: "power1.in" }, moonDelay + duration * 0.66);
      } else {
        tl.fromTo(
          moon,
          { autoAlpha: 0.92, scale: 1, y: 0, rotation: 0 },
          {
            autoAlpha: 0,
            scale: 0.48,
            y: -56,
            rotation: -14,
            duration: duration * 0.62,
            ease: "power2.in",
          },
          0,
        );
      }
    }

    tweenRef.current = tl;

    return () => {
      tl.kill();
    };
  }, [colorTheme, dataViewMode, setSceneBackground, autoSceneBackground]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{ visibility: "hidden" }}
      aria-hidden
    >
      <div
        ref={veilRef}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(251,191,36,0.18)_0%,rgba(8,12,22,0.88)_55%,rgba(2,4,8,0.96)_100%)]"
        style={{ visibility: "hidden" }}
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_72%,rgba(255,248,220,0.22)_0%,rgba(255,255,255,0)_58%)]"
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={sunRef}
          className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-gradient-to-br from-amber-100/90 via-yellow-200/80 to-amber-300/70 shadow-[0_0_100px_rgba(251,191,36,0.55),0_0_40px_rgba(255,220,120,0.35)]"
          style={{ visibility: "hidden" }}
        >
          <PiSunDimThin className="h-[3.4rem] w-[3.4rem] text-amber-700/90" aria-hidden />
        </div>
        <div
          ref={moonRef}
          className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100/35 via-slate-200/25 to-indigo-300/30 shadow-[0_0_70px_rgba(129,140,248,0.45),0_0_24px_rgba(191,219,254,0.2)]"
          style={{ visibility: "hidden" }}
        >
          <PiMoonThin className="h-12 w-12 text-indigo-50/95" aria-hidden />
        </div>
      </div>
    </div>,
    document.body,
  );
}
