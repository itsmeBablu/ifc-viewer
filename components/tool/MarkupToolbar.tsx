"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import {
  MARKUP_TOOL_ICONS,
  MARKUP_TOOL_ORDER,
} from "./MarkupIcons";

/**
 * Compact left strip — expands tools only. Full controls live in Modify tab.
 */
export default function MarkupToolbar({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);

  const [toolsOpen, setToolsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ActiveIcon = armedTool
    ? MARKUP_TOOL_ICONS[armedTool]
    : MARKUP_TOOL_ICONS.cube;

  useEffect(() => {
    if (!toolsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [toolsOpen]);

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto relative flex flex-col items-center gap-1 ${className}`}
    >
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-panel-bg,rgba(255,255,255,0.78))] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <button
          type="button"
          title={t(uiLanguage, "markupToolbar")}
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((v) => !v)}
          className={`flex h-10 w-9 items-center justify-center rounded-xl transition ${
            toolsOpen || armedTool
              ? "bg-zinc-200 text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <ActiveIcon />
        </button>

        {selectedPlacementId && (
          <>
            <div className="my-0.5 h-px w-7 bg-[var(--panel-divider)]" />
            {(
              [
                ["translate", "↔", "markupMove"],
                ["rotate", "↻", "markupRotate"],
                ["scale", "⤡", "markupScale"],
              ] as const
            ).map(([mode, glyph, labelKey]) => (
              <button
                key={mode}
                type="button"
                title={t(uiLanguage, labelKey)}
                aria-pressed={transformMode === mode}
                onClick={() => setTransformMode(mode)}
                className={`flex h-8 w-9 items-center justify-center rounded-xl text-sm transition ${
                  transformMode === mode
                    ? "bg-sky-400/85 text-sky-950"
                    : "text-[var(--text-body)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {glyph}
              </button>
            ))}
          </>
        )}
      </div>

      {toolsOpen && (
        <div className="absolute top-0 left-[calc(100%+0.4rem)] z-10 flex w-max flex-col gap-1 rounded-2xl border border-[var(--panel-divider)] bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
          <div className="flex gap-1">
            {MARKUP_TOOL_ORDER.map((id) => {
              const Icon = MARKUP_TOOL_ICONS[id];
              const active = armedTool === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  title={t(uiLanguage, `markupHint_${id}` as "markupHint_cube")}
                  onClick={() => {
                    setArmedTool(active ? null : id);
                    setToolsOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    active
                      ? "bg-amber-400/90 text-amber-950"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
          {!compact && (
            <p className="max-w-[12rem] px-1 text-[9px] text-zinc-500">
              {t(uiLanguage, "toolTabModify")} → {t(uiLanguage, "markupSaveAs")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
