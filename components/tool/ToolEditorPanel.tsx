"use client";

import { useEffect, useRef, useState } from "react";
import { CiGrid32 } from "react-icons/ci";
import { TbTarget } from "react-icons/tb";
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

const chip =
  "flex h-8 items-center justify-center rounded-lg transition duration-150";
const chipIdle =
  "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-amber-100/70 hover:text-amber-950";
const chipOn =
  "bg-gradient-to-br from-amber-200/95 via-yellow-300/85 to-amber-400/75 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";

/**
 * Editor tab — compact Save / views / snap / grid / color + tools + floors.
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
    <div
      className={`flex min-h-0 flex-col gap-2.5 overflow-y-auto thin-scroll ${className}`}
    >
      <div
        ref={saveRef}
        className="relative flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-muted)]/35 p-1.5"
      >
        <button
          type="button"
          title={t(uiLanguage, "markupSaveAs")}
          aria-expanded={saveOpen}
          disabled={!modelKey}
          onClick={() => setSaveOpen((v) => !v)}
          className={`${chip} w-8 ${chipIdle} disabled:opacity-35`}
        >
          <TfiSave className="h-3.5 w-3.5" />
        </button>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />

        {VIEWS.map((v) => {
          const active = viewPreset === v.id;
          return (
            <button
              key={v.id}
              type="button"
              title={t(uiLanguage, v.titleKey as "markupView_top")}
              aria-pressed={active}
              onClick={() => setViewPreset(v.id)}
              className={`${chip} min-w-[2rem] px-2 text-[10px] font-bold tracking-wide ${
                active ? chipOn : chipIdle
              }`}
            >
              {v.label}
            </button>
          );
        })}

        <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--panel-divider)]" />

        <button
          type="button"
          title={t(uiLanguage, "markupSnap")}
          aria-pressed={snapToFaces}
          onClick={() => setSnapToFaces(!snapToFaces)}
          className={`${chip} w-8 ${snapToFaces ? chipOn : chipIdle}`}
        >
          <TbTarget className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t(uiLanguage, "markupGridSnap")}
          aria-pressed={gridSnap}
          onClick={() => setGridSnap(!gridSnap)}
          className={`${chip} w-8 ${gridSnap ? chipOn : chipIdle}`}
        >
          <CiGrid32 className="h-4 w-4" />
        </button>
        <ColorSwatchPicker
          color={defaultColor}
          onChange={setDefaultColor}
          size="md"
        />

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

      <MarkupToolsSection hideChrome />
      <ToolFloorsSection className="max-h-36 shrink-0" />
      <div className="border-t border-[var(--panel-divider)] pt-2">
        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
      </div>
    </div>
  );
}
