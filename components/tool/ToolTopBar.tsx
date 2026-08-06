"use client";

import { useEffect, useRef, useState } from "react";
import { TfiSave } from "react-icons/tfi";
import {
  buildFragBlob,
  buildMarkupOnlyIfc,
  downloadBlob,
  getCachedIfcBytes,
  mergeMarkupIntoIfc,
} from "@/lib/markupFragSave";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import type { MarkupViewPreset } from "@/lib/toolMarkup";

const VIEWS: { id: MarkupViewPreset; label: string; titleKey: string }[] = [
  { id: "top", label: "Top", titleKey: "markupView_top" },
  { id: "north", label: "N", titleKey: "markupView_north" },
  { id: "south", label: "S", titleKey: "markupView_south" },
  { id: "east", label: "O", titleKey: "markupView_east" },
  { id: "west", label: "W", titleKey: "markupView_west" },
  { id: "free", label: "3D", titleKey: "markupView_free" },
];

/**
 * Slim Werkzeug top chrome — Save (.ifc/.frag) + orthographic/perspective views.
 */
export default function ToolTopBar({ className = "" }: { className?: string }) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const modelKey = useToolMarkupStore((s) => s.modelKey);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const markSaved = useToolMarkupStore((s) => s.markSaved);

  const [saveOpen, setSaveOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!saveOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setSaveOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [saveOpen]);

  const saveAs = (kind: "frag" | "ifc") => {
    if (!modelKey) return;
    const base = (activeModelLabel ?? modelKey)
      .replace(/\.ifc$/i, "")
      .replace(/[^\w.-]+/g, "_");
    if (kind === "frag") {
      downloadBlob(
        buildFragBlob({
          modelKey,
          modelLabel: activeModelLabel,
          placements,
          notes,
          ifcBytes: getCachedIfcBytes(modelKey),
        }),
        `${base}.frag`,
      );
      markSaved();
    } else {
      const cached = getCachedIfcBytes(modelKey);
      const blob = cached
        ? mergeMarkupIntoIfc({
            baseIfc: cached,
            placements,
            notes,
          })
        : buildMarkupOnlyIfc({
            modelLabel: activeModelLabel,
            placements,
            notes,
          });
      downloadBlob(blob, `${base}_marked.ifc`);
      markSaved();
    }
    setSaveOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#141820]/92 px-1.5 py-1 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          title={t(uiLanguage, "markupSaveAs")}
          aria-expanded={saveOpen}
          disabled={!modelKey}
          onClick={() => setSaveOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-200 transition duration-150 hover:bg-white/10 hover:text-white disabled:opacity-35"
        >
          <TfiSave className="h-[15px] w-[15px]" />
        </button>
        {saveOpen && (
          <div className="absolute top-[calc(100%+0.4rem)] left-0 z-40 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1a1f2a] py-1 shadow-xl">
            <p className="px-3 py-1 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
              {t(uiLanguage, "markupSaveAs")}
            </p>
            <button
              type="button"
              onClick={() => saveAs("frag")}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-zinc-200 transition duration-150 hover:bg-white/8"
            >
              {t(uiLanguage, "markupSaveFrag")}
            </button>
            <button
              type="button"
              onClick={() => saveAs("ifc")}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-zinc-200 transition duration-150 hover:bg-white/8"
            >
              {t(uiLanguage, "markupSaveIfc")}
            </button>
          </div>
        )}
      </div>

      <div className="mx-0.5 h-5 w-px bg-white/10" />

      <div className="flex items-center gap-0.5">
        {VIEWS.map((v) => {
          const active = viewPreset === v.id;
          return (
            <button
              key={v.id}
              type="button"
              title={t(uiLanguage, v.titleKey as "markupView_top")}
              aria-pressed={active}
              onClick={() => setViewPreset(v.id)}
              className={`relative flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[10px] font-bold tracking-wide transition duration-150 ${
                active
                  ? "bg-amber-400/90 text-amber-950"
                  : "text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
