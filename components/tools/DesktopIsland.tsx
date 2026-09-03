"use client";

/**
 * DesktopIsland — central floating "island" for the desktop /werkzeug layout.
 *
 * A draggable glass capsule whose primary visible control is the Arch ↔ MEP
 * discipline toggle. Positioned top-center by default; user can drag it
 * anywhere on screen via the grab handle.
 *
 * Desktop-only (≥1100px). The iPad layout continues to use the inline
 * Arch/MEP toggle inside WerkzeugWorkspaceChrome.
 */

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LuBuilding2, LuGripHorizontal, LuZap } from "react-icons/lu";
import GlassPanel from "@/components/common/GlassPanel";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export default function DesktopIsland() {
  /* ── store ──────────────────────────────────────────── */
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const setMepModeActive = useLayoutDrawingStore((s) => s.setMepModeActive);

  /* ── drag state ─────────────────────────────────────── */
  const panelRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const archRef = useRef<HTMLSpanElement>(null);
  const mepRef = useRef<HTMLSpanElement>(null);
  const thumbReadyRef = useRef(false);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? Math.round(window.innerWidth / 2) : 600,
    y: 16,
  }));

  /* ── Arch/MEP thumb animation (gsap, same as WerkzeugWorkspaceChrome) ── */
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const target = mepModeActive ? mepRef.current : archRef.current;
    if (!thumb || !target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const properties = {
      x: target.offsetLeft - 2,
      width: target.offsetWidth + 2,
      backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0.88)" : "rgba(250, 204, 21, 0.88)",
      boxShadow: mepModeActive
        ? "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(56,189,248,.38)"
        : "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(250,204,21,.34)",
    };

    if (!thumbReadyRef.current || reduceMotion) {
      gsap.set(thumb, properties);
      thumbReadyRef.current = true;
      return;
    }

    gsap.to(thumb, { ...properties, duration: 0.44, ease: "power3.inOut", overwrite: true });
    return () => { gsap.killTweensOf(thumb); };
  }, [mepModeActive]);

  /* ── drag handler ───────────────────────────────────── */
  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = { cx: e.clientX, cy: e.clientY, px: pos.x, py: pos.y };

    const move = (ev: PointerEvent) => {
      const nextX = Math.max(80, Math.min(window.innerWidth - 80, start.px + ev.clientX - start.cx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 52, start.py + ev.clientY - start.cy));
      setPos({ x: nextX, y: nextY });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ── toggle handler ─────────────────────────────────── */
  const toggleMode = () => {
    const nextMep = !mepModeActive;
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    useToolMarkupStore.getState().setArmedTool(null);
    setMepModeActive(nextMep);
  };

  return (
    <div
      ref={panelRef}
      className="desktop-island pointer-events-auto fixed z-[75]"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translateX(-50%)",
      }}
      onPointerDown={beginDrag}
    >
      <GlassPanel variant="panel" zIndex={75} wrapperClassName="inline-flex rounded-full">
        <div className="flex h-10 items-center gap-2 pl-2 pr-3">
          {/* Drag grip */}
          <span className="flex h-7 w-6 cursor-grab items-center justify-center text-[var(--text-muted)] opacity-60 active:cursor-grabbing">
            <LuGripHorizontal className="h-3.5 w-3.5" />
          </span>

          {/* Arch / MEP Toggle */}
          <button
            type="button"
            onClick={toggleMode}
            aria-pressed={mepModeActive}
            data-mode={mepModeActive ? "mep" : "arch"}
            aria-label={mepModeActive ? "Switch to Architecture mode" : "Switch to MEP mode"}
            title={mepModeActive ? "MEP mode active — switch to Architecture" : "Architecture mode active — switch to MEP"}
            className="desktop-island-toggle group relative flex h-7 shrink-0 items-center gap-0 rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-px transition-all"
          >
            <span
              ref={thumbRef}
              className="pointer-events-none absolute left-px top-px h-[1.625rem] rounded-full"
              aria-hidden="true"
            />
            <span
              ref={archRef}
              className={`relative z-[1] flex h-[1.625rem] items-center gap-1 rounded-full px-2.5 text-[10px] font-bold leading-none transition-colors duration-300 ${
                !mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)]"
              }`}
            >
              <LuBuilding2 className="h-3 w-3" />
              <span>Arch</span>
            </span>
            <span
              ref={mepRef}
              className={`relative z-[1] flex h-[1.625rem] items-center gap-1 rounded-full px-2.5 text-[10px] font-bold leading-none transition-colors duration-300 ${
                mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)]"
              }`}
            >
              <LuZap className="h-3 w-3" />
              <span>MEP</span>
            </span>
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
