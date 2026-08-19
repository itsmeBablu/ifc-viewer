"use client";

import { useState } from "react";
import { LuChevronDown, LuChevronUp, LuX } from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/lib/i18n";

type Property = {
  pset?: string;
  name: string;
  value: any;
};

type ElementData = {
  id?: string;
  name: string;
  typeName?: string;
  kind: string;
  floorId?: string | null;
  expressId: number;
  roomId?: string | null;
  globalId?: string | null;
  properties: Property[];
};

type RevitPropertiesPanelProps = {
  selectedElement: ElementData;
  onClear?: () => void;
};

const getThumbnail = (kind: string) => {
  switch (kind?.toLowerCase()) {
    case "wall":
      return (
        <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="4" x2="6" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="18" y1="4" x2="18" y2="20" />
        </svg>
      );
    case "window":
      return (
        <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      );
    case "door":
      return (
        <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 21V3h11v18" />
          <path d="M14 5a4 4 0 0 1 4 4v12" />
        </svg>
      );
    case "room":
      return (
        <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      );
  }
};

const getSection = (propName: string, pset?: string) => {
  const n = propName.toLowerCase();
  const ps = (pset || "").toLowerCase();
  if (
    n.includes("length") || n.includes("width") || n.includes("height") ||
    n.includes("area") || n.includes("volume") || n.includes("thickness") ||
    n.includes("dicker") || n.includes("breite") || n.includes("höhe") ||
    n.includes("länge") || n.includes("fläche") || n.includes("volumen") ||
    n.includes("size") || n.includes("dimension") || n.includes("depth") ||
    n.includes("elevation") || ps.includes("dimension")
  ) {
    return "Dimensions";
  }
  if (
    n.includes("material") || n.includes("color") || n.includes("finish") ||
    n.includes("putz") || n.includes("belag") || n.includes("oberfläche") ||
    n.includes("farb") || n.includes("texture") || ps.includes("material") ||
    ps.includes("finish")
  ) {
    return "Materials & Finishes";
  }
  return "Identity Data";
};

export default function RevitPropertiesPanel({ selectedElement, onClear }: RevitPropertiesPanelProps) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Identity Data": true,
    "Dimensions": false,
    "Materials & Finishes": false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Base identity properties
  const identityProps: { name: string; value: any }[] = [
    { name: "Kind", value: selectedElement.kind },
    { name: "Floor", value: selectedElement.floorId ?? "—" },
    { name: "Express ID", value: selectedElement.expressId },
    { name: "Room ID", value: selectedElement.roomId ?? "—" },
    { name: "Global ID", value: selectedElement.globalId ?? "—" },
  ];

  const dimensionsProps: { name: string; value: any }[] = [];
  const materialsProps: { name: string; value: any }[] = [];

  // Categorize dynamic properties
  (selectedElement.properties ?? []).forEach((p) => {
    const section = getSection(p.name, p.pset);
    const label = p.pset ? `${p.pset} · ${p.name}` : p.name;
    const item = { name: label, value: p.value || "—" };
    if (section === "Dimensions") {
      dimensionsProps.push(item);
    } else if (section === "Materials & Finishes") {
      materialsProps.push(item);
    } else {
      identityProps.push(item);
    }
  });

  const sections = [
    { name: "Identity Data", props: identityProps },
    { name: "Dimensions", props: dimensionsProps },
    { name: "Materials & Finishes", props: materialsProps },
  ];

  return (
    <div className="flex h-full max-h-full flex-col overflow-hidden text-xs">
      {/* Revit Style Header Swatch */}
      <div className="flex items-center gap-2.5 p-2 rounded-xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 shadow-sm backdrop-blur-md shrink-0 mb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/30 dark:border-white/10 bg-gradient-to-tr from-white/20 to-white/5 dark:from-white/5 dark:to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
          {getThumbnail(selectedElement.kind)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold text-[var(--text-strong)] leading-tight">
            {selectedElement.name || selectedElement.typeName}
          </div>
          <div className="truncate text-[9px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
            {selectedElement.typeName || selectedElement.kind}
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 p-1 rounded-lg hover:bg-zinc-500/10 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Accordion List */}
      <div className="flex-1 overflow-y-auto pr-1 thin-scroll space-y-1.5">
        {sections.map((sec) => {
          const isOpen = openSections[sec.name];
          if (sec.props.length === 0) return null;

          return (
            <div
              key={sec.name}
              className="rounded-lg border border-zinc-300/30 dark:border-white/5 bg-white/20 dark:bg-white/5 overflow-hidden"
            >
              {/* Accordion Toggle Header */}
              <button
                type="button"
                onClick={() => toggleSection(sec.name)}
                className="flex w-full items-center justify-between px-2.5 py-1.5 bg-zinc-900/5 dark:bg-white/5 border-b border-zinc-300/20 dark:border-white/5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-strong)] select-none hover:bg-zinc-900/10 dark:hover:bg-white/10 transition-colors"
              >
                <span>{sec.name}</span>
                {isOpen ? (
                  <LuChevronUp className="h-3 w-3 text-[var(--text-muted)]" />
                ) : (
                  <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
                )}
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="p-1.5 space-y-1 bg-white/10 dark:bg-transparent">
                  {sec.props.map((p, idx) => (
                    <div
                      key={`${p.name}-${idx}`}
                      className="grid grid-cols-[100px_1fr] gap-2 items-center py-0.5 border-b border-zinc-500/5 last:border-0"
                    >
                      <span
                        className="text-[10px] text-[var(--text-muted)] truncate select-none pl-0.5"
                        title={p.name}
                      >
                        {p.name}
                      </span>
                      <div className="w-full min-w-0">
                        <div
                          className="w-full text-[10px] font-medium text-[var(--text-strong)] bg-white/30 dark:bg-black/20 border border-white/20 dark:border-white/5 rounded px-1.5 py-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] truncate"
                          title={String(p.value)}
                        >
                          {String(p.value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
