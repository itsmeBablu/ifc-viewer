"use client";

import { useState, useRef, useCallback } from "react";
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
  LuPalette,
  LuSettings,
} from "react-icons/lu";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import { useStudioSettingsStore, STUDIO_ACCENTS } from "@/store/useStudioSettingsStore";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeEmbeddedPanel from "./EditTypeEmbeddedPanel";
import MaterialEditorPanel from "./MaterialEditorPanel";
import EmbeddedSettingsTab from "./EmbeddedSettingsTab";
import { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { wallLengthMm } from "@/lib/layoutDrawing";

export default function ToolPropertiesDock() {
  const [collapsed, setCollapsed] = useState(false);
  const [dockTab, setDockTab] = useState<"properties" | "materials" | "settings">("properties");
  const [editTypeMode, setEditTypeMode] = useState(false);
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

  const accent = useStudioSettingsStore((s) => s.accent);
  const syncArchMep = useStudioSettingsStore((s) => s.syncArchMep);

  // Layout Store Selections
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateWalls = useLayoutDrawingStore((s) => s.updateWalls);
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

    const wallRefs = selectedElements.filter((e) => e.kind === "wall");
    if (wallRefs.length > 1) {
      void updateWalls(
        wallRefs.map((r) => r.id),
        {
          wallTypeId: selectedDef.id,
          thicknessMm: selectedDef.thicknessMm,
          heightMm: selectedDef.heightMm,
          material: selectedDef.material,
          layers: selectedDef.layers,
        },
      );
    } else if (selectedWall) {
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

  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const activeAccent = syncArchMep
    ? STUDIO_ACCENTS[accent]
    : mepModeActive
    ? STUDIO_ACCENTS.vblue
    : STUDIO_ACCENTS.vyellow;

  const accentColor = activeAccent.textClass;
  const accentBg = activeAccent.bgClass;
  const activeHighlightClass = mepModeActive
    ? "btn-v-blue btn-liquid-hover shadow-md shadow-sky-400/30 !text-slate-950 font-bold"
    : "btn-v-yellow btn-liquid-hover shadow-md shadow-yellow-400/30 !text-zinc-950 font-bold";

  return (
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
              {dockTab === "properties" ? (editTypeMode ? "Edit Type:" : "Properties:") : dockTab === "materials" ? "Materials:" : "Settings:"}
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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* THREE TABS DIRECTLY BELOW HEADER (Equal width grid, icon fallback on compact) */}
          <div className="grid grid-cols-3 h-8 shrink-0 border-b border-[var(--panel-divider)] bg-[var(--surface-overlay)]/70 p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setDockTab("properties");
                setEditTypeMode(false);
              }}
              className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-bold transition-all min-w-0 ${
                dockTab === "properties"
                  ? activeHighlightClass
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--glass-inset-bg)] btn-yellow-border-hover"
              }`}
              title="Default: Element Properties & Type Editing"
            >
              <LuSlidersHorizontal className="h-3 w-3 shrink-0" />
              <span className="truncate hidden min-[240px]:inline">Default</span>
            </button>

            <button
              type="button"
              onClick={() => setDockTab("materials")}
              className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-bold transition-all min-w-0 ${
                dockTab === "materials"
                  ? activeHighlightClass
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--glass-inset-bg)] btn-yellow-border-hover"
              }`}
              title="Material Library & Shader Studio"
            >
              <LuPalette className="h-3 w-3 shrink-0" />
              <span className="truncate hidden min-[240px]:inline">Materials</span>
            </button>

            <button
              type="button"
              onClick={() => setDockTab("settings")}
              className={`flex items-center justify-center gap-1 py-1 px-1 rounded-md text-[10px] font-bold transition-all min-w-0 ${
                dockTab === "settings"
                  ? activeHighlightClass
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--glass-inset-bg)] btn-yellow-border-hover"
              }`}
              title="Studio Settings & Workspace Preferences"
            >
              <LuSettings className="h-3 w-3 shrink-0" />
              <span className="truncate hidden min-[240px]:inline">Settings</span>
            </button>
          </div>

          {/* TAB 1: PROPERTIES (Instance or In-Place Edit Type) */}
          {dockTab === "properties" && (
            editTypeMode && (selectedWall || selectedDoor || selectedWindow || selectedSlab) ? (
              <div className="flex-1 min-h-0 h-full overflow-hidden">
                <EditTypeEmbeddedPanel
                  typeDef={currentType}
                  onBack={() => setEditTypeMode(false)}
                  onSave={handleTypeSave}
                  onOpenMaterialPicker={() => setDockTab("materials")}
                />
              </div>
            ) : (
              <div ref={contentRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto p-2 thin-scroll space-y-1.5 text-xs">
                {/* TYPE SELECTOR HEADER & EDIT TYPE BUTTON */}
                {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
                  <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${accentColor}`}>
                        <LuSparkles className="h-3 w-3" />
                        <span>Type Family</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditTypeMode(true)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--panel-divider)] text-[9px] font-bold ${accentColor} hover:${accentBg} hover:text-zinc-950 transition-all`}
                        title="Edit Type Parameters in Full Panel (Esc to return)"
                      >
                        <LuSlidersHorizontal className="h-2.5 w-2.5" />
                        <span>Edit Type...</span>
                      </button>
                    </div>

                    <select
                      value={activeTypeKey}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="w-full h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 text-[11px] font-bold text-[var(--text-strong)] focus:outline-none transition-colors truncate"
                    >
                      {Object.values(types)
                        .filter((t) => {
                          if (selectedWall) return t.category === "Wall";
                          if (selectedDoor) return t.category === "Door";
                          if (selectedWindow) return t.category === "Window";
                          if (selectedSlab) return t.category === "Slab" || t.category === "Roof";
                          return false;
                        })
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* MAIN INSTANCE PROPERTY CARDS */}
                {hasSelection ? (
                  <div className="space-y-1.5">
                    {/* 1. Identity Data */}
                    <div className={cardStyle}>
                      <button
                        type="button"
                        onClick={() => toggleSection("identity")}
                        className="flex w-full items-center justify-between p-2 text-left font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <LuFileText className={`h-3 w-3 ${accentColor} shrink-0`} />
                          <span className="truncate">Identity Data:</span>
                        </div>
                        {openSections.identity ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)]" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />}
                      </button>

                      {openSections.identity && (
                        <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[80px]">Category:</span>
                            <span className={`font-semibold ${accentColor} truncate max-w-[120px]`}>
                              {selectedWall ? "Wall" : selectedDoor ? "Door" : selectedWindow ? "Window" : selectedSlab ? "Floor / Slab" : selectedPlacement ? "Shape" : "Annotation"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[80px]">Element ID:</span>
                            <span className="font-mono text-[var(--text-muted)] truncate max-w-[120px]">
                              {selectedWall?.id || selectedDoor?.id || selectedWindow?.id || selectedSlab?.id || selectedPlacement?.id || selectedNote?.id}...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Dimensions */}
                    <div className={cardStyle}>
                      <button
                        type="button"
                        onClick={() => toggleSection("dimensions")}
                        className="flex w-full items-center justify-between p-2 text-left font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <LuRuler className={`h-3 w-3 ${accentColor} shrink-0`} />
                          <span className="truncate">Dimensions:</span>
                        </div>
                        {openSections.dimensions ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)]" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />}
                      </button>

                      {openSections.dimensions && (
                        <div className="p-2 pt-0 space-y-1 border-t border-[var(--panel-divider)]/40 text-[10px]">
                          {selectedWall && (
                            <>
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-[var(--text-muted)] truncate max-w-[80px]">Length:</span>
                                <span className="font-mono font-bold text-[var(--text-strong)]">{wallLen} mm</span>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-[var(--text-muted)] truncate max-w-[80px]">Thickness:</span>
                                <span className="font-mono font-bold text-[var(--text-strong)]">{selectedWall.thicknessMm} mm</span>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-[var(--text-muted)] truncate max-w-[80px]">Height:</span>
                                <span className="font-mono font-bold text-[var(--text-strong)]">{selectedWall.heightMm || 3000} mm</span>
                              </div>
                            </>
                          )}
                          {selectedDoor && (
                            <>
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-[var(--text-muted)] truncate max-w-[80px]">Width:</span>
                                <span className="font-mono font-bold text-[var(--text-strong)]">{selectedDoor.widthMm} mm</span>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span className="text-[var(--text-muted)] truncate max-w-[80px]">Height:</span>
                                <span className="font-mono font-bold text-[var(--text-strong)]">{selectedDoor.heightMm} mm</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Materials & Finishes */}
                    <div className={cardStyle}>
                      <button
                        type="button"
                        onClick={() => toggleSection("materials")}
                        className="flex w-full items-center justify-between p-2 text-left font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <LuBox className={`h-3 w-3 ${accentColor} shrink-0`} />
                          <span className="truncate">Materials & Finish:</span>
                        </div>
                        {openSections.materials ? <LuChevronUp className="h-3 w-3 text-[var(--text-muted)]" /> : <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />}
                      </button>

                      {openSections.materials && (
                        <div className="p-2 pt-0 space-y-1.5 border-t border-[var(--panel-divider)]/40 text-[10px]">
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[var(--text-muted)] truncate max-w-[80px]">Material:</span>
                            <button
                              type="button"
                              onClick={() => setDockTab("materials")}
                              className={`font-semibold ${accentColor} hover:underline truncate max-w-[130px] flex items-center gap-1`}
                              title="Open in Material Studio Tab"
                            >
                              <LuPalette className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">
                                {selectedWall?.material || selectedDoor?.material || selectedWindow?.material || selectedSlab?.material || currentType?.material || "Default"}
                              </span>
                            </button>
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
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-[var(--panel-divider)]/40">
                      <div className="text-[10px] font-bold mb-1 uppercase tracking-wide text-[var(--text-muted)] truncate">
                        IFC Element Details:
                      </div>
                      <ElementInspector />
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* TAB 2: EMBEDDED MATERIAL STUDIO */}
          {dockTab === "materials" && (
            <div className="flex-1 min-h-0 h-full overflow-hidden">
              <MaterialEditorPanel
                isOpen={true}
                onClose={() => setDockTab("properties")}
                embedded={true}
              />
            </div>
          )}

          {/* TAB 3: EMBEDDED SETTINGS */}
          {dockTab === "settings" && (
            <div className="flex-1 min-h-0 h-full overflow-hidden">
              <EmbeddedSettingsTab />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
