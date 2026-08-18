"use client";

import { useState } from "react";
import {
  LuSlidersHorizontal,
  LuChevronLeft,
  LuChevronRight,
} from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import LayoutPropertiesPanel from "./LayoutPropertiesPanel";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";

export default function ToolPropertiesDock() {
  const [collapsed, setCollapsed] = useState(false);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);

  // Selections
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);

  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectedNoteId = useToolMarkupStore((s) => s.selectedNoteId);
  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);

  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const selectedDoor = doors.find((d) => d.id === selectedDoorId);
  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedSlab = slabs.find((s) => s.id === selectedSlabId);
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId);
  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const hasSelection = Boolean(
    selectedWall || selectedDoor || selectedWindow || selectedSlab || selectedPlacement || selectedNote
  );

  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  const getElementTitle = () => {
    if (selectedWall) return `Basic Wall (${selectedWall.thicknessMm}mm)`;
    if (selectedDoor) return `Single Door (${selectedDoor.widthMm}×${selectedDoor.heightMm}mm)`;
    if (selectedWindow) return `Window (${selectedWindow.widthMm}×${selectedWindow.heightMm}mm)`;
    if (selectedSlab) return `Floor Slab (${selectedSlab.thicknessMm}mm)`;
    if (selectedPlacement) return `3D ${selectedPlacement.type.toUpperCase()} Shape`;
    if (selectedNote) return "Sticky Note Tag";
    return "Project & View Properties";
  };

  const getElementCategory = () => {
    if (selectedWall) return "Walls / Architecture";
    if (selectedDoor) return "Doors / Openings";
    if (selectedWindow) return "Windows / Openings";
    if (selectedSlab) return "Floors / Slabs";
    if (selectedPlacement) return "3D Massing & Primitives";
    if (selectedNote) return "Annotations";
    return "Architecture Model";
  };

  return (
    <aside
      className={`fixed left-0 top-[116px] bottom-7 z-30 flex flex-col border-r border-[var(--panel-divider)] bg-[var(--surface-overlay)]/95 shadow-xl backdrop-blur-xl transition-all duration-300 select-none ${
        collapsed ? "w-10" : "w-80"
      }`}
    >
      {/* Dock Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <LuSlidersHorizontal className="h-4 w-4 text-amber-500" />
            <span className="font-bold text-xs text-[var(--text-strong)] tracking-wide uppercase font-mono">
              Properties
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand Properties Palette" : "Collapse Properties Palette"}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
        >
          {collapsed ? <LuChevronRight className="h-4 w-4" /> : <LuChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Dock Content Body */}
      {!collapsed && (
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 thin-scroll space-y-4 text-xs">
          {/* Element Type Header Badge */}
          <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2.5 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
              {getElementCategory()}
            </div>
            <div className="mt-0.5 font-bold text-xs text-[var(--text-strong)] truncate">
              {getElementTitle()}
            </div>
          </div>

          {/* PROPERTIES BODY */}
          {hasSelection ? (
            <div className="space-y-3">
              {/* Layout Properties */}
              <LayoutPropertiesPanel />

              {/* Markup / Shapes Properties */}
              <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />

              {/* IFC Element Inspector if applicable */}
              <div className="pt-2 border-t border-[var(--panel-divider)]">
                <ElementInspector />
              </div>
            </div>
          ) : (
            /* PROJECT DEFAULT PROPERTIES */
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-strong)] mb-2 uppercase tracking-wide">
                  Project Information
                </div>
                <div className="space-y-2 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Model Name:</span>
                    <span className="font-semibold text-[var(--text-strong)] truncate max-w-[150px]">
                      {activeModelLabel || "Standard Project"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Active Level:</span>
                    <span className="font-semibold text-amber-500">
                      {currentFloorObj ? currentFloorObj.name : "All Levels"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Units:</span>
                    <span className="font-semibold text-[var(--text-strong)]">Millimeters (mm)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Total Levels:</span>
                    <span className="font-semibold text-[var(--text-strong)]">{floors.length}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Placed Walls:</span>
                    <span className="font-semibold text-[var(--text-strong)]">{walls.length}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">3D Shapes:</span>
                    <span className="font-semibold text-[var(--text-strong)]">{placements.length}</span>
                  </div>
                </div>
              </div>

              {/* IFC INSPECTOR ON SELECTION */}
              <div className="pt-2 border-t border-[var(--panel-divider)]">
                <div className="text-[11px] font-bold text-[var(--text-strong)] mb-2 uppercase tracking-wide">
                  IFC Element Details
                </div>
                <ElementInspector />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
