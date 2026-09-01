"use client";

import { useState, useRef } from "react";
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
  LuSparkles,
} from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { wallLengthMm } from "@/lib/layoutDrawing";

export default function ToolPropertiesDock() {
  const [collapsed, setCollapsed] = useState(false);
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [types, setTypes] = useState<Record<string, ElementTypeDefinition>>(DEFAULT_ELEMENT_TYPES);
  const dockRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const isDark = useAppStore((s) => s.colorTheme === "dark");
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
      if (selectedWall.wallTypeId && (types[selectedWall.wallTypeId] || DEFAULT_ELEMENT_TYPES[selectedWall.wallTypeId])) {
        return selectedWall.wallTypeId;
      }
      if (selectedWall.thicknessMm === 100) return "wall-interior-100";
      if (selectedWall.thicknessMm === 300) return "wall-exterior-300";
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
      if (selectedSlab.thicknessMm === 300) return "slab-roof-300";
      return "slab-floor-200";
    }
    return "wall-generic-200";
  };

  const activeTypeKey = getActiveTypeKey();
  const currentType = types[activeTypeKey] || DEFAULT_ELEMENT_TYPES[activeTypeKey] || DEFAULT_ELEMENT_TYPES["wall-generic-200"];

  const handleTypeChange = (newTypeId: string) => {
    const selectedDef = types[newTypeId] || DEFAULT_ELEMENT_TYPES[newTypeId];
    if (!selectedDef) return;

    if (selectedWall) {
      void updateWall(selectedWall.id, {
        wallTypeId: selectedDef.id,
        thicknessMm: selectedDef.thicknessMm || selectedWall.thicknessMm,
        heightMm: selectedDef.heightMm || selectedWall.heightMm,
        material: selectedDef.material,
        layers: selectedDef.layers,
      });
    } else if (selectedDoor) {
      void updateDoor(selectedDoor.id, {
        widthMm: selectedDef.widthMm || selectedDoor.widthMm,
        heightMm: selectedDef.heightMm || selectedDoor.heightMm,
        material: selectedDef.material,
      });
    } else if (selectedWindow) {
      void updateWindow(selectedWindow.id, {
        widthMm: selectedDef.widthMm || selectedWindow.widthMm,
        heightMm: selectedDef.heightMm || selectedWindow.heightMm,
        sillHeightMm: selectedDef.sillHeightMm || selectedWindow.sillHeightMm,
        material: selectedDef.material,
      });
    } else if (selectedSlab) {
      void updateSlab(selectedSlab.id, {
        thicknessMm: selectedDef.thicknessMm || selectedSlab.thicknessMm,
        material: selectedDef.material,
      });
    }
  };

  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));
    handleTypeChange(updated.id);
  };

  // Dimensions Helpers
  const wallLen = selectedWall ? Math.round(wallLengthMm(selectedWall)) : 0;
  const wallArea = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000)) / 1_000_000).toFixed(2) : "0.00";
  const wallVol = selectedWall ? ((wallLen * (selectedWall.heightMm || 3000) * selectedWall.thicknessMm) / 1_000_000_000).toFixed(2) : "0.00";

  const isMepSelection = false; // Architecture mode default
  const accentColor = isMepSelection ? "text-sky-400" : "text-yellow-400";
  const accentBg = isMepSelection ? "bg-sky-400" : "bg-yellow-400";

  const cardStyle = "rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-card)] overflow-hidden shadow-sm";

  return (
    <>
      <aside
        ref={dockRef}
        className={`pointer-events-auto flex select-none flex-col border-l border-[var(--panel-divider)] bg-[var(--surface-card)] text-[var(--text-strong)] shadow-xl backdrop-blur-2xl transition-all duration-200 ${
          collapsed ? "w-9" : "w-72"
        }`}
      >
        {/* Dock Header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-2 bg-[var(--surface-overlay)]/60">
          {!collapsed && (
            <div className="flex items-center gap-1.5 min-w-0 pr-1">
              <span className={`h-2 w-2 rounded-full ${accentBg} shrink-0`} />
              <span className="font-bold text-[11px] tracking-wide uppercase text-[var(--text-strong)] truncate">
                Properties:
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Properties" : "Collapse Properties"}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors shrink-0"
          >
            {collapsed ? <LuChevronRight className="h-3.5 w-3.5" /> : <LuChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Dock Content Body */}
        {!collapsed && (
          <div ref={contentRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto p-2 thin-scroll space-y-1.5 text-xs">
            {/* TYPE SELECTOR HEADER & EDIT TYPE BUTTON */}
            {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
              <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${accentColor}`}>
                    <LuSparkles className="h-3 w-3" />
                    <span className="truncate">Type Definition:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditTypeOpen(true)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 font-bold text-[9px] transition-all border border-[var(--panel-divider)] ${accentColor} hover:${accentBg} hover:text-zinc-950`}
                  >
                    <LuSlidersHorizontal className="h-2.5 w-2.5" />
                    <span>Edit Type...</span>
                  </button>
                </div>

                <select
                  value={activeTypeKey}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 text-[11px] font-semibold text-[var(--text-strong)] focus:outline-none truncate"
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
              <div className="space-y-1.5">
                {/* 1. IDENTITY DATA */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("identity")}
                    className="flex w-full items-center justify-between p-2 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <LuFileText className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="truncate">Identity Data:</span>
                    </span>
                    {openSections.identity ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)] shrink-0" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)] shrink-0" />}
                  </button>

                  {openSections.identity && (
                    <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Mark / ID:</span>
                        <span className={`font-mono font-bold ${accentColor} truncate`}>
                          {selectedWall ? `W-${selectedWall.id.slice(-4)}` : selectedDoor ? `D-${selectedDoor.id.slice(-4)}` : selectedWindow ? `WN-${selectedWindow.id.slice(-4)}` : "EL-1"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-[var(--text-muted)] truncate max-w-[80px]">Remarks:</span>
                        <input
                          type="text"
                          placeholder="Add remark…"
                          className="w-32 h-6 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right text-[10px] text-[var(--text-strong)] focus:outline-none truncate"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DIMENSIONS */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("dimensions")}
                    className="flex w-full items-center justify-between p-2 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <LuRuler className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="truncate">Dimensions:</span>
                    </span>
                    {openSections.dimensions ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)] shrink-0" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)] shrink-0" />}
                  </button>

                  {openSections.dimensions && (
                    <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                      {selectedWall && (
                        <>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Length:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{wallLen} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Thickness:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedWall.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedWall.heightMm || 3000} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Area:</span>
                            <span className={`font-mono font-bold ${accentColor} truncate`}>{wallArea} m²</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Volume:</span>
                            <span className={`font-mono font-bold ${accentColor} truncate`}>{wallVol} m³</span>
                          </div>
                        </>
                      )}

                      {selectedDoor && (
                        <>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Width:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedDoor.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedDoor.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Clear Opening:</span>
                            <span className={`font-mono font-bold ${accentColor} truncate`}>{((selectedDoor.widthMm * selectedDoor.heightMm) / 1_000_000).toFixed(2)} m²</span>
                          </div>
                        </>
                      )}

                      {selectedWindow && (
                        <>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Width:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedWindow.widthMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedWindow.heightMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Sill Height:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedWindow.sillHeightMm} mm</span>
                          </div>
                        </>
                      )}

                      {selectedSlab && (
                        <>
                          <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Thickness:</span>
                            <span className="font-mono font-semibold text-[var(--text-strong)] truncate">{selectedSlab.thicknessMm} mm</span>
                          </div>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[100px]">Footprint:</span>
                            <span className={`font-mono font-bold ${accentColor} truncate`}>
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
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("constraints")}
                    className="flex w-full items-center justify-between p-2 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <LuLayers className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="truncate">Constraints:</span>
                    </span>
                    {openSections.constraints ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)] shrink-0" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)] shrink-0" />}
                  </button>

                  {openSections.constraints && (
                    <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Base Level:</span>
                        <span className={`font-semibold ${accentColor} truncate`}>
                          {currentFloorObj ? currentFloorObj.name : "Level 1 (0.00m)"}...
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Base Offset:</span>
                        <span className="font-mono text-[var(--text-body)] truncate">0 mm</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MATERIALS & FINISHES */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("materials")}
                    className="flex w-full items-center justify-between p-2 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <LuBox className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="truncate">Materials & Finish:</span>
                    </span>
                    {openSections.materials ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)] shrink-0" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)] shrink-0" />}
                  </button>

                  {openSections.materials && (
                    <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[90px]">Material:</span>
                        <span className={`font-medium truncate max-w-[140px] ${accentColor}`}>{currentType.material}...</span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-[var(--text-muted)] truncate max-w-[90px]">Function:</span>
                        <span className="font-medium text-[var(--text-strong)] truncate">{currentType.functionType}...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. IFC & EXPORT */}
                <div className={cardStyle}>
                  <button
                    type="button"
                    onClick={() => toggleSection("ifc")}
                    className="flex w-full items-center justify-between p-2 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <LuShieldCheck className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="truncate">IFC / BIM Data:</span>
                    </span>
                    {openSections.ifc ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)] shrink-0" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)] shrink-0" />}
                  </button>

                  {openSections.ifc && (
                    <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-[var(--text-muted)] truncate max-w-[90px]">Entity:</span>
                        <span className="font-mono text-[var(--text-strong)] truncate">
                          {selectedWall ? "IfcWallStandardCase" : selectedDoor ? "IfcDoor" : selectedWindow ? "IfcWindow" : "IfcSlab"}...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* DEFAULT PROJECT METADATA WHEN NOTHING SELECTED */
              <div className="space-y-2">
                <div className={cardStyle}>
                  <div className="p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LuInfo className={`h-3 w-3 ${accentColor} shrink-0`} />
                      <span className="text-[11px] font-bold tracking-tight text-[var(--text-strong)] truncate">Project Information:</span>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Model:</span>
                        <span className="font-semibold truncate max-w-[140px] text-[var(--text-strong)]">
                          {activeModelLabel || "Standard Project"}...
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Active Level:</span>
                        <span className={`font-semibold ${accentColor} truncate`}>
                          {currentFloorObj ? currentFloorObj.name : "All Levels"}...
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Units:</span>
                        <span className="font-semibold text-[var(--text-strong)] truncate">Millimeters (mm)</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Total Levels:</span>
                        <span className="font-mono font-bold text-[var(--text-strong)]">{floors.length}</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-[var(--panel-divider)]/30">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">Placed Walls:</span>
                        <span className={`font-mono font-bold ${accentColor}`}>{walls.length}</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-[var(--text-muted)] truncate max-w-[100px]">3D Shapes:</span>
                        <span className={`font-mono font-bold ${accentColor}`}>{placements.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* IFC INSPECTOR ON SELECTION */}
                <div className="pt-1 border-t border-[var(--panel-divider)]/40">
                  <div className="text-[10px] font-bold mb-1 uppercase tracking-wide text-[var(--text-muted)] truncate">
                    IFC Element Details:
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
