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
import type { MarkupViewPreset } from "@/lib/toolMarkup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import ColorSwatchPicker from "./ColorSwatchPicker";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import MarkupToolsSection from "./MarkupToolsSection";
import ToolFloorsSection from "./ToolFloorsSection";

const VIEWS: { id: MarkupViewPreset; label: string; titleKey: string }[] = [
  { id: "top", label: "Top", titleKey: "markupView_top" },
  { id: "north", label: "N", titleKey: "markupView_north" },
  { id: "south", label: "S", titleKey: "markupView_south" },
  { id: "east", label: "O", titleKey: "markupView_east" },
  { id: "west", label: "W", titleKey: "markupView_west" },
  { id: "free", label: "3D", titleKey: "markupView_free" },
];

/**
 * Editor tab — Save + views, snap/grid/color, shapes, floors, properties.
 */
export default function ToolEditorPanel({
  className = "",
}: {
  className?: string;
}) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const modelKey = useToolMarkupStore((s) => s.modelKey);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const markSaved = useToolMarkupStore((s) => s.markSaved);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const setSnapToFaces = useToolMarkupStore((s) => s.setSnapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const setGridSnap = useToolMarkupStore((s) => s.setGridSnap);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);

  const [saveOpen, setSaveOpen] = useState(false);
  const saveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!saveOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!saveRef.current?.contains(e.target as Node)) setSaveOpen(false);
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
    } else {
      const cached = getCachedIfcBytes(modelKey);
      downloadBlob(
        cached
          ? mergeMarkupIntoIfc({
              baseIfc: cached,
              placements,
              notes,
            })
          : buildMarkupOnlyIfc({
              modelLabel: activeModelLabel,
              placements,
              notes,
            }),
        `${base}_marked.ifc`,
      );
    }
    markSaved();
    setSaveOpen(false);
  };

  return (
    <div className={`flex min-h-0 flex-col gap-2 overflow-y-auto thin-scroll ${className}`}>
      {/* Save + views */}
      <div
        ref={saveRef}
        className="relative flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/40 p-1.5"
      >
        <button
          type="button"
          title={t(uiLanguage, "markupSaveAs")}
          aria-expanded={saveOpen}
          disabled={!modelKey}
          onClick={() => setSaveOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-body)] transition duration-150 hover:bg-amber-200/50 hover:text-amber-950 disabled:opacity-35"
        >
          <TfiSave className="h-[15px] w-[15px]" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-[var(--panel-divider)]" />
        {VIEWS.map((v) => {
          const active = viewPreset === v.id;
          return (
            <button
              key={v.id}
              type="button"
              title={t(uiLanguage, v.titleKey as "markupView_top")}
              aria-pressed={active}
              onClick={() => setViewPreset(v.id)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[10px] font-bold tracking-wide transition duration-150 ${
                active
                  ? "bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                  : "text-[var(--text-muted)] hover:bg-amber-100/60 hover:text-amber-950"
              }`}
            >
              {v.label}
            </button>
          );
        })}
        {saveOpen && (
          <div className="absolute top-[calc(100%+0.35rem)] left-0 z-30 w-44 overflow-hidden rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] py-1 shadow-xl">
            <p className="px-3 py-1 text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              {t(uiLanguage, "markupSaveAs")}
            </p>
            <button
              type="button"
              onClick={() => saveAs("frag")}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-[var(--text-body)] transition duration-150 hover:bg-amber-50"
            >
              {t(uiLanguage, "markupSaveFrag")}
            </button>
            <button
              type="button"
              onClick={() => saveAs("ifc")}
              className="w-full px-3 py-2 text-left text-[11px] font-medium text-[var(--text-body)] transition duration-150 hover:bg-amber-50"
            >
              {t(uiLanguage, "markupSaveIfc")}
            </button>
          </div>
        )}
      </div>

      {/* Snap / grid / color */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-0.5">
        <button
          type="button"
          title={t(uiLanguage, "markupSnap")}
          aria-pressed={snapToFaces}
          onClick={() => setSnapToFaces(!snapToFaces)}
          className={`rounded-lg px-2 py-1 text-[9px] font-bold transition duration-150 ${
            snapToFaces
              ? "bg-emerald-400/85 text-emerald-950"
              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
          }`}
        >
          SNAP
        </button>
        <button
          type="button"
          title={t(uiLanguage, "markupGridSnap")}
          aria-pressed={gridSnap}
          onClick={() => setGridSnap(!gridSnap)}
          className={`rounded-lg px-2 py-1 text-[9px] font-bold transition duration-150 ${
            gridSnap
              ? "bg-emerald-400/85 text-emerald-950"
              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
          }`}
        >
          GRID
        </button>
        <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          {t(uiLanguage, "markupColor")}
        </span>
        <ColorSwatchPicker
          color={defaultColor}
          onChange={setDefaultColor}
          size="md"
        />
      </div>

      <MarkupToolsSection hideChrome />
      <ToolFloorsSection className="max-h-36 shrink-0" />
      <div className="border-t border-[var(--panel-divider)] pt-2">
        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
      </div>
    </div>
  );
}
