"use client";

import { useEffect, useRef, useState } from "react";
import {
  LuBox,
  LuChevronDown,
  LuGrid2X2,
  LuLayers3,
  LuPanelTop,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import type { MarkupViewPreset } from "@/lib/toolMarkup";

const ELEVATIONS: Array<{ id: MarkupViewPreset; label: string }> = [
  { id: "north", label: "North" },
  { id: "south", label: "South" },
  { id: "east", label: "East" },
  { id: "west", label: "West" },
];

/** Revit/AutoCAD-inspired document view tabs for fast 2D/3D coordination. */
export default function WorkspaceViewTabs() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [elevationsOpen, setElevationsOpen] = useState(false);
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const quadView = useToolMarkupStore((s) => s.quadView);
  const setQuadView = useToolMarkupStore((s) => s.setQuadView);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const activeLevelId = useToolMarkupStore((s) => s.markupFloorId);
  const selectedFloor = useAppStore((s) => s.selectedFloor);

  const activeLevel =
    levels.find((level) => level.id === (activeLevelId ?? selectedFloor)) ?? levels[0];
  const isElevation = ELEVATIONS.some((view) => view.id === viewPreset) && !quadView;

  useEffect(() => {
    if (!elevationsOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setElevationsOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [elevationsOpen]);

  const openView = (preset: MarkupViewPreset) => {
    setQuadView(false);
    setViewPreset(preset);
  };

  return (
    <nav
      ref={rootRef}
      aria-label="Drawing views"
      className="werkzeug-view-tabs pointer-events-auto fixed left-1/2 top-4 z-[48] flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)]/92 p-1 shadow-[0_12px_32px_rgba(0,0,0,.22)] backdrop-blur-xl"
    >
      <ViewTab
        active={!quadView && viewPreset === "top"}
        icon={<LuLayers3 />}
        label={activeLevel ? `2D · ${activeLevel.name}` : "2D Plan"}
        title="Open the active level as a precise 2D floor plan"
        onClick={() => openView("top")}
      />
      <ViewTab
        active={!quadView && viewPreset === "free"}
        icon={<LuBox />}
        label="3D View"
        title="Open the coordinated 3D model view"
        onClick={() => openView("free")}
      />

      <div className="relative">
        <button
          type="button"
          aria-expanded={elevationsOpen}
          aria-haspopup="menu"
          className={`werkzeug-view-tab ${isElevation ? "is-active" : ""}`}
          title="Open an architectural elevation"
          onClick={() => setElevationsOpen((open) => !open)}
        >
          <LuPanelTop />
          <span>{isElevation ? `${viewPreset[0].toUpperCase()}${viewPreset.slice(1)} Elevation` : "Elevations"}</span>
          <LuChevronDown className={`h-3 w-3 transition-transform ${elevationsOpen ? "rotate-180" : ""}`} />
        </button>
        {elevationsOpen && (
          <div role="menu" className="absolute left-1/2 top-[calc(100%+8px)] grid w-44 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-2xl">
            {ELEVATIONS.map((view) => (
              <button
                key={view.id}
                type="button"
                role="menuitem"
                className={`rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition hover:bg-[var(--glass-inset-bg)] ${viewPreset === view.id && !quadView ? "text-yellow-500" : "text-[var(--text-body)]"}`}
                onClick={() => {
                  openView(view.id);
                  setElevationsOpen(false);
                }}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="mx-0.5 h-5 w-px bg-[var(--panel-divider)]" aria-hidden />
      <ViewTab
        active={quadView}
        icon={<LuGrid2X2 />}
        label="2D + 3D"
        title="Coordinate plan, 3D and elevations in four linked viewports"
        onClick={() => setQuadView(!quadView)}
      />
    </nav>
  );
}

function ViewTab({ active, icon, label, title, onClick }: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`werkzeug-view-tab ${active ? "is-active" : ""}`}
      title={title}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
