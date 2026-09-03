"use client";

import React, { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { LuBuilding2, LuZap } from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export default function HeaderDisciplineToggle() {
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const setMepModeActive = useLayoutDrawingStore((s) => s.setMepModeActive);

  const thumbRef = useRef<HTMLSpanElement>(null);
  const archRef = useRef<HTMLSpanElement>(null);
  const mepRef = useRef<HTMLSpanElement>(null);
  const thumbReadyRef = useRef(false);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const target = mepModeActive ? mepRef.current : archRef.current;
    if (!thumb || !target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const properties = {
      x: target.offsetLeft - 1,
      width: target.offsetWidth + 2,
      backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0.90)" : "rgba(250, 204, 21, 0.90)",
      boxShadow: mepModeActive
        ? "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(56,189,248,.38)"
        : "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(250,204,21,.34)",
    };

    if (!thumbReadyRef.current || reduceMotion) {
      gsap.set(thumb, properties);
      thumbReadyRef.current = true;
      return;
    }

    gsap.to(thumb, { ...properties, duration: 0.38, ease: "power3.inOut", overwrite: true });
    return () => {
      gsap.killTweensOf(thumb);
    };
  }, [mepModeActive]);

  const toggleMode = () => {
    const next = !mepModeActive;
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    useToolMarkupStore.getState().setArmedTool(null);
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
    setMepModeActive(next);
  };

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-pressed={mepModeActive}
      data-mode={mepModeActive ? "mep" : "arch"}
      aria-label={mepModeActive ? "Switch to Architecture mode" : "Switch to MEP mode"}
      title={mepModeActive ? "MEP mode active — click to switch to Architecture" : "Architecture mode active — click to switch to MEP"}
      className="desktop-header-discipline-toggle group relative flex h-[1.625rem] shrink-0 items-center gap-0 rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-px transition-all select-none"
    >
      <span
        ref={thumbRef}
        className="pointer-events-none absolute left-px top-px h-[1.375rem] rounded-full"
        aria-hidden="true"
      />
      <span
        ref={archRef}
        className={`relative z-[1] flex h-[1.375rem] items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-none transition-colors duration-300 ${
          !mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
        }`}
      >
        <LuBuilding2 className="h-3 w-3" />
        <span>Arch</span>
      </span>
      <span
        ref={mepRef}
        className={`relative z-[1] flex h-[1.375rem] items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-none transition-colors duration-300 ${
          mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
        }`}
      >
        <LuZap className="h-3 w-3" />
        <span>MEP</span>
      </span>
    </button>
  );
}
