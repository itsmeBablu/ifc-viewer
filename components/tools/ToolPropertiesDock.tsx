"use client";

import { useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuChevronDown,
  LuChevronUp,
  LuSlidersHorizontal,
  LuLayers,
  LuInfo,
  LuFileText,
  LuRuler,
  LuBox,
  LuShieldCheck,
} from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import LayoutPropertiesPanel from "./LayoutPropertiesPanel";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { wallLengthMm, wallAngleDeg } from "@/lib/layoutDrawing";

export default function ToolPropertiesDock() {
  const [collapsed, setCollapsed] = useState(false);
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [types, setTypes] = useState<Record<string, ElementTypeDefinition>>(DEFAULT_ELEMENT_TYPES);

  // Section Collapse States
  const [openSections, setOpenSections] = useState({
    identity: true,
    dimensions: true,
    constraints: true,
    materials: true,
    ifc: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);

  // Layout Store Selections
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);

  // Markup Store Selections
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

  // Match Active Element to a Type Definition
  const getActiveTypeKey = (): string => {
    if (selectedWall) {
      if (selectedWall.thicknessMm === 100) return "wall-interior-100";
      if (selectedWall.thicknessMm === 150) return "wall-interior-150";
      if (selectedWall.thicknessMm === 300) return "wall-exterior-300";
      if (selectedWall.thicknessMm === 365) return "wall-exterior-365";
      return "wall-generic-200";
    }
    if (selectedDoor) {
      if (selectedDoor.widthMm === 800) return "door-single-800";
      if (selectedDoor.widthMm === 1800) return "door-double-1800";
      return "door-single-900";
    }
    if (selectedWindow) {
      if (selectedWindow.widthMm === 1000) return "win-fixed-1000";
      if (selectedWindow.widthMm === 2000) return "win-pano-2000";
      return "win-double-1200";
    }
    if (selectedSlab) {
      return selectedSlab.kind === "roof" ? "slab-roof-300" : "slab-floor-200";
    }
    return "wall-generic-200";
  };

  const activeTypeKey = getActiveTypeKey();
  const currentType = types[activeTypeKey] || DEFAULT_ELEMENT_TYPES["wall-generic-200"];

  const handleTypeChange = (newTypeKey: string) => {
    const target = types[newTypeKey];
    if (!target) return;

    if (selectedWall && target.thicknessMm) {
      updateWall(selectedWall.id, { thicknessMm: target.thicknessMm });
    } else if (selectedDoor && target.widthMm && target.heightMm) {
      updateDoor(selectedDoor.id, { widthMm: target.widthMm, heightMm: target.heightMm });
    } else if (selectedWindow && target.widthMm && target.heightMm) {
      updateWindow(selectedWindow.id, {
        widthMm: target.widthMm,
        heightMm: target.heightMm,
        sillHeightMm: target.sillHeightMm ?? 900,
      });
    } else if (selectedSlab && target.thicknessMm) {
      updateSlab(selectedSlab.id, { thicknessMm: target.thicknessMm });
    }
  };

  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));

    // Global update for all matching elements
    if (updated.category === "Wall" && updated.thicknessMm) {
      walls.forEach((w) => {
        if (w.thicknessMm === currentType.thicknessMm) {
          updateWall(w.id, { thicknessMm: updated.thicknessMm });
        }
      });
    } else if (updated.category === "Door" && updated.widthMm && updated.heightMm) {
      doors.forEach((d) => {
        if (d.widthMm === currentType.widthMm) {
          updateDoor(d.id, { widthMm: updated.widthMm, heightMm: updated.heightMm });
        }
      });
    }
  };

  // Calculations for selected wall
  const wallLen = selectedWall ? Math.round(wallLengthMm(selectedWall)) : 0;
  const wallArea = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000)) / 1_000_000).toFixed(2) : "0";
  const wallVol = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000) * selectedWall.thicknessMm) / 1_000_000_000).toFixed(3) : "0";

  return (
    <>
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
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 thin-scroll space-y-3.5 text-xs">
            {/* TYPE SELECTOR HEADER & EDIT TYPE BUTTON */}
            {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
              <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Type Selector
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTypeOpen(true)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] hover:bg-amber-500/20 transition-all"
                  >
                    <LuSlidersHorizontal className="h-3 w-3" />
                    <span>Edit Type</span>
                  </button>
                </div>

                <select
                  value={activeTypeKey}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 font-semibold text-xs text-[var(--text-strong)] focus:border-amber-500 focus:outline-none"
                >
                  {Object.values(types)
                    .filter((t) => {
                      if (selectedWall) return t.category === "Wall";
                      if (selectedDoor) return t.category === "Door";
                      if (selectedWindow) return t.category === "Window";
                      if (selectedSlab) return t.category === "Floor" || t.category === "Roof";
                      return true;
                    })
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* COLLAPSIBLE SECTIONS FOR SELECTED ELEMENT */}
            {hasSelection ? (
              <div className="space-y-2">
                {/* 1. IDENTITY DATA */}
                <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("identity")}
                    className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <LuFileText className="h-3.5 w-3.5 text-amber-500" />
                      <span>Identity Data</span>
                    </span>
                    {openSections.identity ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {openSections.identity && (
                    <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Mark / ID:</span>
                        <span className="font-mono font-semibold text-[var(--text-strong)]">
                          {selectedWall ? `W-${selectedWall.id.slice(-4)}` : selectedDoor ? `D-${selectedDoor.id.slice(-4)}` : selectedWindow ? `WN-${selectedWindow.id.slice(-4)}` : "EL-1"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Comments:</span>
                        <input
                          type="text"
                          placeholder="Add remark…"
                          className="w-36 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right text-[10px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DIMENSIONS */}
                <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("dimensions")}
                    className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <LuRuler className="h-3.5 w-3.5 text-amber-500" />
                      <span>Dimensions</span>
                    </span>
                    {openSections.dimensions ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {openSections.dimensions && (
                    <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
                      {selectedWall && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Length:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{wallLen} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Thickness:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWall.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWall.heightMm || 3000} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Area:</span>
                            <span className="font-mono font-semibold text-emerald-500">{wallArea} m²</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Volume:</span>
                            <span className="font-mono font-semibold text-sky-500">{wallVol} m³</span>
                          </div>
                        </>
                      )}

                      {selectedDoor && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Width:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedDoor.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedDoor.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Clear Opening Area:</span>
                            <span className="font-mono font-semibold text-emerald-500">{((selectedDoor.widthMm * selectedDoor.heightMm) / 1_000_000).toFixed(2)} m²</span>
                          </div>
                        </>
                      )}

                      {selectedWindow && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Width:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Sill Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.sillHeightMm} mm</span>
                          </div>
                        </>
                      )}

                      {selectedSlab && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Thickness:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedSlab.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Footprint Area:</span>
                            <span className="font-mono font-semibold text-emerald-500">
                              {(((selectedSlab.maxXmm - selectedSlab.minXmm) * (selectedSlab.maxYmm - selectedSlab.minYmm)) / 1_000_000).toFixed(2)} m²
                            </span>
                          </div>
                        </>
                      )}

                      {selectedPlacement && (
                        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
                      )}
                    </div>
                  )}
                </div>

                {/* 3. CONSTRAINTS */}
                <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("constraints")}
                    className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <LuLayers className="h-3.5 w-3.5 text-amber-500" />
                      <span>Constraints</span>
                    </span>
                    {openSections.constraints ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {openSections.constraints && (
                    <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Base Constraint:</span>
                        <span className="font-semibold text-amber-500">
                          {currentFloorObj ? currentFloorObj.name : "Level 1 (0.00m)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Base Offset:</span>
                        <span className="font-mono text-[var(--text-strong)]">0 mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MATERIALS & FINISHES */}
                <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("materials")}
                    className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <LuBox className="h-3.5 w-3.5 text-amber-500" />
                      <span>Materials & Finish</span>
                    </span>
                    {openSections.materials ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {openSections.materials && (
                    <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Structure Material:</span>
                        <span className="font-medium text-[var(--text-strong)]">{currentType.material}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Function:</span>
                        <span className="font-medium text-[var(--text-strong)]">{currentType.functionType}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. IFC & EXPORT */}
                <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("ifc")}
                    className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <LuShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                      <span>IFC / BIM Data</span>
                    </span>
                    {openSections.ifc ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {openSections.ifc && (
                    <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Export Entity:</span>
                        <span className="font-mono text-[var(--text-strong)]">
                          {selectedWall ? "IfcWallStandardCase" : selectedDoor ? "IfcDoor" : selectedWindow ? "IfcWindow" : "IfcSlab"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* DEFAULT PROJECT METADATA WHEN NOTHING SELECTED */
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

      {/* Edit Type Dialog */}
      <EditTypeDialog
        typeDef={currentType}
        isOpen={editTypeOpen}
        onClose={() => setEditTypeOpen(false)}
        onSave={handleTypeSave}
      />
    </>
  );
}
