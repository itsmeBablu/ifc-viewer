"use client";

import { useState, useRef, useEffect } from "react";
import { LuChevronDown, LuLayers3 } from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

type Props = {
  className?: string;
};

/**
 * Persistent Active Level Indicator Badge.
 * Always visible in Plan, Elevation, Section, or 3D view so the user knows
 * which storey is being edited, with quick 1-click level switching.
 */
export default function ActiveLevelBadge({ className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const activeLevelId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const quadView = useToolMarkupStore((s) => s.quadView);

  const activeId = activeLevelId ?? selectedFloor;
  const activeLevel = levels.find((l) => l.id === activeId) ?? levels[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  if (!activeLevel || quadView) return null;

  const elevMeter = (activeLevel.elevationMm / 1000).toFixed(2);
  const sign = activeLevel.elevationMm >= 0 ? "+" : "";

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto fixed left-4 top-16 z-[46] ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex h-8 items-center gap-2 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)]/92 px-2.5 text-[11px] font-bold text-[var(--text-strong)] shadow-[0_8px_24px_rgba(0,0,0,.15)] backdrop-blur-xl transition-all hover:border-yellow-400/60"
        title="Active Storey / Floor Level"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-yellow-400/20 text-yellow-500">
          <LuLayers3 className="h-3.5 w-3.5" />
        </span>
        <span className="font-bold">{activeLevel.name}</span>
        <span className="tabular-nums text-[10px] font-medium text-[var(--text-muted)]">
          · {sign}{elevMeter} m
        </span>
        <LuChevronDown className={`h-3 w-3 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[200px] max-h-56 overflow-y-auto rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-2xl backdrop-blur-2xl thin-scroll animate-in fade-in zoom-in-95">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Storey Levels
          </p>
          {levels.map((level) => {
            const isSelected = level.id === activeLevel.id;
            const lvlSign = level.elevationMm >= 0 ? "+" : "";
            const lvlM = (level.elevationMm / 1000).toFixed(2);
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  setMarkupFloorId(level.id);
                  setSelectedFloor(level.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                  isSelected
                    ? "btn-v-yellow !text-zinc-950 font-bold shadow-sm"
                    : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-semibold">{level.name}</span>
                  <span className="text-[9px] opacity-70">
                    Floor-to-floor height: {level.heightMm} mm
                  </span>
                </div>
                <span className="tabular-nums text-[10px] font-mono shrink-0">
                  {lvlSign}{lvlM} m
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
