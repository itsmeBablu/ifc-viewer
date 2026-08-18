"use client";

/**
 * ToolRightPanel — unified right-side panel for V Studio.
 *
 * Layout (top → bottom):
 *   1. Panel header with collapse toggle + resize handle
 *   2. Properties section (top half, resizable splitter)
 *   3. Project Browser section (bottom half)
 *      – Tab "All": levels, views, Active Level selector
 *      – Tab "IFC": raw IFC spatial tree
 *
 * The panel is:
 *   - Resizable: drag the left edge to change width (280–600px)
 *   - Collapsible: toggle button slides the full panel in/out
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  LuChevronRight,
  LuChevronLeft,
  LuChevronDown,
  LuChevronUp,
  LuSlidersHorizontal,
  LuFolderTree,
  LuLayers,
  LuRuler,
  LuFileText,
  LuBox,
  LuShieldCheck,
  LuTrash2,
  LuGripVertical,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useIfcStructure } from "./useIfcStructure";
import IfcStructureTree from "./IfcStructureTree";
import ToolFloorsSection from "./ToolFloorsSection";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { wallLengthMm } from "@/lib/layoutDrawing";

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

type BrowserTab = "all" | "ifc";

export default function ToolRightPanel({
  onFile,
  isLoadingModel = false,
}: {
  onFile?: (file: File) => void;
  isLoadingModel?: boolean;
}) {
  // -- Panel open/width state ------------------------------------------------
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [browserTab, setBrowserTab] = useState<BrowserTab>("all");
  const [isFloating, setIsFloating] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -- Splitter between Properties and Browser -------------------------------
  const [propHeight, setPropHeight] = useState(220); // px

  // -- Edit type dialog ------------------------------------------------------
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [types, setTypes] = useState<Record<string, ElementTypeDefinition>>(DEFAULT_ELEMENT_TYPES);

  // -- Properties section collapse -------------------------------------------
  const [openSections, setOpenSections] = useState({
    identity: true,
    dimensions: true,
    constraints: true,
    materials: true,
    ifc: false,
  });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  // -- Store slices ----------------------------------------------------------
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
  const floors = useAppStore((s) => s.floors);

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
  const selectWall = useLayoutDrawingStore((s) => s.selectWall);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);

  const placements = useToolMarkupStore((s) => s.placements);
  const notes = useToolMarkupStore((s) => s.notes);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectedNoteId = useToolMarkupStore((s) => s.selectedNoteId);
  const selectPlacement = useToolMarkupStore((s) => s.selectPlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);

  const { structure, loading } = useIfcStructure(true);

  // -- Derived selections ----------------------------------------------------
  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const selectedDoor = doors.find((d) => d.id === selectedDoorId);
  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedSlab = slabs.find((s) => s.id === selectedSlabId);
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId);

  const hasSelection = Boolean(
    selectedWall || selectedDoor || selectedWindow || selectedSlab || selectedPlacement
  );

  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  // -- Type selector helpers -------------------------------------------------
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

  // -- Wall metrics ----------------------------------------------------------
  const wallLen = selectedWall ? Math.round(wallLengthMm(selectedWall)) : 0;
  const wallArea = selectedWall
    ? ((wallLen * (selectedWall.heightMm || 3000)) / 1_000_000).toFixed(2)
    : "0";
  const wallVol = selectedWall
    ? (
        (wallLen * (selectedWall.heightMm || 3000) * selectedWall.thicknessMm) /
        1_000_000_000
      ).toFixed(3)
    : "0";

  // -- Left-edge resize drag -------------------------------------------------
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(DEFAULT_WIDTH);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = panelWidth;

      const onMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = dragStartXRef.current - ev.clientX;
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidthRef.current + delta));
        setPanelWidth(next);
      };
      const onUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth]
  );

  // -- Horizontal splitter drag (Properties / Browser split) -----------------
  const isSplitDraggingRef = useRef(false);
  const splitStartYRef = useRef(0);
  const splitStartHeightRef = useRef(220);

  const onSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isSplitDraggingRef.current = true;
      splitStartYRef.current = e.clientY;
      splitStartHeightRef.current = propHeight;

      const onMove = (ev: MouseEvent) => {
        if (!isSplitDraggingRef.current) return;
        const delta = ev.clientY - splitStartYRef.current;
        const next = Math.min(480, Math.max(80, splitStartHeightRef.current + delta));
        setPropHeight(next);
      };
      const onUp = () => {
        isSplitDraggingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [propHeight]
  );

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <>
      {!rightPanelOpen && (
        <button
          className="fixed right-4 top-[88px] z-30 flex h-10 w-10 items-center justify-center rounded-full liquid-glass-panel hover:bg-amber-500/10 text-[var(--text-strong)] transition-all shadow-xl border border-[var(--panel-divider)]"
          onClick={() => setRightPanelOpen(true)}
          title="Expand Panel"
        >
          <LuChevronLeft className="h-5 w-5" />
        </button>
      )}

      <aside
        className={`fixed right-4 top-[88px] bottom-16 z-30 flex flex-col liquid-glass-panel transition-transform duration-300 select-none overflow-hidden ${
          rightPanelOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
        }`}
        style={{ width: panelWidth }}
      >
        {/* -- Left resize handle -------------------------------------------- */}
        {!isFloating && rightPanelOpen && (
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group hover:bg-amber-500/40 transition-colors"
            title="Drag to resize panel"
          />
        )}

        {/* -- Panel top header ---------------------------------------------- */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3">
          <button
            type="button"
            onClick={() => setRightPanelOpen(false)}
            title="Collapse Panel"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 ml-1">
              <LuSlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-black text-[11px] text-[var(--text-strong)] tracking-widest uppercase font-mono">
                Project Layout
              </span>
            </div>
        </div>
            {/* -- PROPERTIES (top portion) ----------------------------------- */}
            {hasSelection && (
              <>
                <div
                  className="flex flex-col border-b border-[var(--panel-divider)] overflow-y-auto thin-scroll"
                  style={{ height: propHeight, minHeight: 80 }}
                >
              {/* Properties header */}
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/60 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <LuSlidersHorizontal className="h-3 w-3" />
                  Properties
                </span>

                {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
                  <button
                    type="button"
                    onClick={() => setEditTypeOpen(true)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] hover:bg-amber-500/20 transition-all"
                  >
                    <LuSlidersHorizontal className="h-2.5 w-2.5" />
                    <span>Edit Type</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 thin-scroll space-y-3 text-xs">
                {/* Type Selector */}
                {hasSelection && (selectedWall || selectedDoor || selectedWindow || selectedSlab) && (
                  <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3 shadow-sm space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                      Type
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

                {hasSelection ? (
                  <div className="space-y-2">
                    {/* Identity */}
                    <PropSection
                      open={openSections.identity}
                      onToggle={() => toggleSection("identity")}
                      icon={<LuFileText className="h-3.5 w-3.5 text-amber-500" />}
                      label="Identity Data"
                    >
                      <PropRow label="Mark / ID">
                        <span className="font-mono font-semibold text-[var(--text-strong)]">
                          {selectedWall
                            ? `W-${selectedWall.id.slice(-4)}`
                            : selectedDoor
                            ? `D-${selectedDoor.id.slice(-4)}`
                            : selectedWindow
                            ? `WN-${selectedWindow.id.slice(-4)}`
                            : "EL-1"}
                        </span>
                      </PropRow>
                      <PropRow label="Remarks">
                        <input
                          type="text"
                          placeholder="Add remark…"
                          className="w-32 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right text-[10px]"
                        />
                      </PropRow>
                    </PropSection>

                    {/* Dimensions */}
                    <PropSection
                      open={openSections.dimensions}
                      onToggle={() => toggleSection("dimensions")}
                      icon={<LuRuler className="h-3.5 w-3.5 text-amber-500" />}
                      label="Dimensions"
                    >
                      {selectedWall && (
                        <>
                          <PropRow label="Length">
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{wallLen} mm</span>
                          </PropRow>
                          <PropRow label="Thickness">
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWall.thicknessMm} mm</span>
                          </PropRow>
                          <PropRow label="Height">
                            <span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWall.heightMm || 3000} mm</span>
                          </PropRow>
                          <PropRow label="Area">
                            <span className="font-mono font-semibold text-emerald-500">{wallArea} m²</span>
                          </PropRow>
                          <PropRow label="Volume">
                            <span className="font-mono font-semibold text-sky-500">{wallVol} m³</span>
                          </PropRow>
                        </>
                      )}
                      {selectedDoor && (
                        <>
                          <PropRow label="Width"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedDoor.widthMm} mm</span></PropRow>
                          <PropRow label="Height"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedDoor.heightMm} mm</span></PropRow>
                          <PropRow label="Opening Area"><span className="font-mono font-semibold text-emerald-500">{((selectedDoor.widthMm * selectedDoor.heightMm) / 1_000_000).toFixed(2)} m²</span></PropRow>
                        </>
                      )}
                      {selectedWindow && (
                        <>
                          <PropRow label="Width"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.widthMm} mm</span></PropRow>
                          <PropRow label="Height"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.heightMm} mm</span></PropRow>
                          <PropRow label="Sill Height"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedWindow.sillHeightMm} mm</span></PropRow>
                        </>
                      )}
                      {selectedSlab && (
                        <>
                          <PropRow label="Thickness"><span className="font-mono font-semibold text-[var(--text-strong)]">{selectedSlab.thicknessMm} mm</span></PropRow>
                          <PropRow label="Area"><span className="font-mono font-semibold text-emerald-500">{(((selectedSlab.maxXmm - selectedSlab.minXmm) * (selectedSlab.maxYmm - selectedSlab.minYmm)) / 1_000_000).toFixed(2)} m²</span></PropRow>
                        </>
                      )}
                      {selectedPlacement && (
                        <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
                      )}
                    </PropSection>

                    {/* Constraints */}
                    <PropSection
                      open={openSections.constraints}
                      onToggle={() => toggleSection("constraints")}
                      icon={<LuLayers className="h-3.5 w-3.5 text-amber-500" />}
                      label="Constraints"
                    >
                      <PropRow label="Base Constraint"><span className="font-semibold text-amber-500">{currentFloorObj ? currentFloorObj.name : "Level 1"}</span></PropRow>
                      <PropRow label="Base Offset"><span className="font-mono text-[var(--text-strong)]">0 mm</span></PropRow>
                    </PropSection>

                    {/* Materials */}
                    <PropSection
                      open={openSections.materials}
                      onToggle={() => toggleSection("materials")}
                      icon={<LuBox className="h-3.5 w-3.5 text-amber-500" />}
                      label="Materials & Finish"
                    >
                      <PropRow label="Structure"><span className="font-medium text-[var(--text-strong)]">{currentType.material}</span></PropRow>
                      <PropRow label="Function"><span className="font-medium text-[var(--text-strong)]">{currentType.functionType}</span></PropRow>
                    </PropSection>

                    {/* IFC */}
                    <PropSection
                      open={openSections.ifc}
                      onToggle={() => toggleSection("ifc")}
                      icon={<LuShieldCheck className="h-3.5 w-3.5 text-amber-500" />}
                      label="IFC / BIM Data"
                    >
                      <PropRow label="Export Entity">
                        <span className="font-mono text-[var(--text-strong)]">
                          {selectedWall ? "IfcWallStandardCase" : selectedDoor ? "IfcDoor" : selectedWindow ? "IfcWindow" : "IfcSlab"}
                        </span>
                      </PropRow>
                    </PropSection>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center opacity-50 h-full">
                    <p className="text-xs">No elements selected</p>
                  </div>
                )}
              </div>
            </div>
                {/* -- Horizontal splitter ----------------------------------------- */}
                <div
                  onMouseDown={onSplitterMouseDown}
                  className="h-1.5 shrink-0 cursor-row-resize flex items-center justify-center bg-[var(--panel-divider)]/30 hover:bg-amber-500/30 transition-colors group"
                  title="Drag to resize"
                >
                  <LuGripVertical className="h-3 w-3 text-[var(--text-muted)] rotate-90 opacity-50 group-hover:opacity-100" />
                </div>
              </>
            )}

            {/* -- PROJECT BROWSER (bottom portion) --------------------------- */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* Browser header + tabs */}
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/60 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  Project Browser
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBrowserTab("all")}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      browserTab === "all"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                        : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrowserTab("ifc")}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      browserTab === "ifc"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-400/40"
                        : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                    }`}
                  >
                    IFC
                  </button>
                </div>
              </div>

              {/* Browser body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 thin-scroll text-xs space-y-2">
                {browserTab === "all" ? (
                  <>
                    {/* Active Level selector — lives here, NOT in the ribbon */}
                    <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                        Active Level
                      </div>
                      <select
                        value={selectedFloor || ""}
                        onChange={(e) => setSelectedFloor(e.target.value || null)}
                        className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">All Levels (Building)</option>
                        {floors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.elevation != null ? `${f.elevation.toFixed(2)} m` : "Level"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Levels & Stories tree */}
                    <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-strong)] mb-2 flex items-center gap-1.5">
                        <LuLayers className="h-3 w-3 text-amber-500" />
                        Building Levels & Stories
                      </div>
                      <ToolFloorsSection />
                      
                      {/* View Shortcuts */}
                      <div className="flex items-center justify-between gap-2 mt-3">
                        {[
                          { id: 'north', label: 'N' },
                          { id: 'east', label: 'O' },
                          { id: 'south', label: 'S' },
                          { id: 'west', label: 'W' },
                          { id: 'free', label: '3D' }
                        ].map(v => (
                          <button 
                            key={v.id} 
                            onClick={() => setViewPreset(v.id as any)} 
                            className="flex-1 bg-[var(--glass-inset-bg)] border border-[var(--panel-divider)] rounded-lg py-1.5 text-xs font-bold text-[var(--text-strong)] hover:bg-amber-500 hover:text-slate-900 hover:border-amber-400 transition-colors shadow-sm"
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* IFC Tree tab */
                  <div className="h-full flex-1">
                    <IfcStructureTree structure={structure} loading={loading} />
                  </div>
                )}
              </div>
            </div>
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

// -- Small helper components ---------------------------------------------------

function PropSection({
  open,
  onToggle,
  icon,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-2.5 font-bold text-[11px] text-[var(--text-strong)] hover:bg-[var(--surface-overlay)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </span>
        {open ? <LuChevronUp className="h-3.5 w-3.5" /> : <LuChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="p-2.5 pt-0 space-y-2 border-t border-[var(--panel-divider)]/40 text-[11px]">
          {children}
        </div>
      )}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-muted)]">{label}:</span>
      {children}
    </div>
  );
}
