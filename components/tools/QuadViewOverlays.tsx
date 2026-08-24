"use client";

import { useEffect, useRef, useState } from "react";
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

const OPTIONS: { id: MarkupViewPreset; label: string; titleKey: string }[] = [
  { id: "top", label: "Top", titleKey: "markupView_top" },
  { id: "north", label: "N", titleKey: "markupView_north" },
  { id: "south", label: "S", titleKey: "markupView_south" },
  { id: "east", label: "O", titleKey: "markupView_east" },
  { id: "west", label: "W", titleKey: "markupView_west" },
  { id: "free", label: "3D", titleKey: "markupView_free" },
];

/**
 * Per-quadrant view pickers for 4-view mode — glass chips in each pane's corner.
 */
export default function QuadViewOverlays() {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const quadView = useToolMarkupStore((s) => s.quadView);
  const quadPresets = useToolMarkupStore((s) => s.quadPresets);
  const quadActiveIndex = useToolMarkupStore((s) => s.quadActiveIndex);
  const setQuadPreset = useToolMarkupStore((s) => s.setQuadPreset);
  const setQuadActiveIndex = useToolMarkupStore((s) => s.setQuadActiveIndex);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex == null) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenIndex(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openIndex]);

  useEffect(() => {
    const dismiss = () => setOpenIndex(null);
    window.addEventListener("werkzeug-dismiss-popovers", dismiss);
    return () => window.removeEventListener("werkzeug-dismiss-popovers", dismiss);
  }, []);

  if (!quadView) return null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[6] grid grid-cols-2 grid-rows-2"
      aria-hidden={false}
    >
      {quadPresets.map((preset, index) => {
        const active = quadActiveIndex === index;
        const open = openIndex === index;
        const current = OPTIONS.find((o) => o.id === preset) ?? OPTIONS[0];
        const triggerPosition = [
          "right-1.5 bottom-1.5",
          "left-1.5 bottom-1.5",
          "right-1.5 top-1.5",
          "left-1.5 top-1.5",
        ][index];
        const menuPosition = [
          "right-0 bottom-[calc(100%+0.25rem)]",
          "left-0 bottom-[calc(100%+0.25rem)]",
          "right-0 top-[calc(100%+0.25rem)]",
          "left-0 top-[calc(100%+0.25rem)]",
        ][index];
        return (
          <div
            key={index}
            className={`relative border border-white/25 ${
              active ? "ring-1 ring-inset ring-amber-400/50" : ""
            }`}
          >
            <div className={`pointer-events-auto absolute z-10 ${triggerPosition}`}>
              <button
                type="button"
                aria-expanded={open}
                onPointerDown={() => setQuadActiveIndex(index as 0 | 1 | 2 | 3)}
                onClick={() => setOpenIndex(open ? null : index)}
                className="tool-glass flex h-7 min-w-[2.75rem] items-center justify-center rounded-lg px-2 text-[10px] font-bold tracking-wide text-[var(--text-strong)] shadow-sm"
                title={t(uiLanguage, current.titleKey as "markupView_top")}
              >
                {current.label}
              </button>
              {open && (
                <div className={`tool-glass absolute z-20 flex min-w-[3.5rem] flex-col overflow-hidden rounded-xl py-1 shadow-lg ${menuPosition}`}>
                  {OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setQuadPreset(index as 0 | 1 | 2 | 3, opt.id);
                        setOpenIndex(null);
                      }}
                      className={`px-2.5 py-1.5 text-left text-[10px] font-bold ${
                        opt.id === preset
                          ? "bg-amber-100/80 text-amber-950"
                          : "text-[var(--text-body)] hover:bg-white/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
