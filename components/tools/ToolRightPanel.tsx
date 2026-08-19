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
  LuEye,
  LuPlus,
  LuMinus,
  LuPalette,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { detectLoopsFromSegments } from "@/lib/linesLoopDetector";
import { useIfcStructure } from "./useIfcStructure";
import IfcStructureTree from "./IfcStructureTree";
import ToolFloorsSection from "./ToolFloorsSection";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import MaterialEditorPanel from "./MaterialEditorPanel";
import { wallLengthMm } from "@/lib/layoutDrawing";
import UnifiedButton from "@/components/common/UnifiedButton";

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

type BrowserTab = "all" | "ifc";

export default function ToolRightPanel({
  onFile,
  isLoadingModel = false,
  panelWidth: controlledPanelWidth,
  onPanelWidthChange,
}: {
  onFile?: (file: File) => void;
  isLoadingModel?: boolean;
  panelWidth?: number;
  onPanelWidthChange?: (w: number) => void;
}) {
  // -- Panel open/width state ------------------------------------------------
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const [internalPanelWidth, setInternalPanelWidth] = useState(DEFAULT_WIDTH);
  const panelWidth = controlledPanelWidth ?? internalPanelWidth;
  const setPanelWidth = onPanelWidthChange ?? setInternalPanelWidth;

  const [browserTab, setBrowserTab] = useState<BrowserTab>("all");
  const [floorsOpen, setFloorsOpen] = useState(true);
  const [isFloating, setIsFloating] = useState(false);

  const [propHeight, setPropHeight] = useState(320); // default ~50% split

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.innerWidth < 768);
      if (!isSplitDraggingRef.current) {
        setPropHeight(Math.max(200, Math.round((window.innerHeight - 120) / 2)));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -- Edit type and material editor panels ----------------------------------
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);
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
  const selectDoor = useLayoutDrawingStore((s) => s.selectDoor);
  const selectWindow = useLayoutDrawingStore((s) => s.selectWindow);
  const selectSlab = useLayoutDrawingStore((s) => s.selectSlab);

  const sketchLines = useLayoutDrawingStore((s) => s.sketchLines);
  const selectedSketchLineId = useLayoutDrawingStore((s) => s.selectedSketchLineId);
  const deleteSketchLine = useLayoutDrawingStore((s) => s.deleteSketchLine);
  const clearSketchLines = useLayoutDrawingStore((s) => s.clearSketchLines);
  const convertSketchToSlab = useLayoutDrawingStore((s) => s.convertSketchToSlab);

  const placements = useToolMarkupStore((s) => s.placements);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  
  // Derive selection objects
  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const selectedDoor = doors.find((d) => d.id === selectedDoorId);
  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedSlab = slabs.find((s) => s.id === selectedSlabId);
  const selectedSketchLine = sketchLines.find((l) => l.id === selectedSketchLineId);
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId);

  const hasLineSelection = Boolean(selectedSketchLine || sketchLines.length > 0);
  const hasSelection = Boolean(
    selectedWall || selectedDoor || selectedWindow || selectedSlab || hasLineSelection || selectedPlacement
  );

  const propertiesTitle = selectedWall
    ? "Wall Properties"
    : selectedDoor
    ? "Door Properties"
    : selectedWindow
    ? "Window Properties"
    : selectedSlab
    ? selectedSlab.kind === "roof"
      ? "Roof Properties"
      : "Floor Properties"
    : selectedSketchLine
    ? "Line Properties"
    : sketchLines.length > 0
    ? "Sketch Lines"
    : selectedPlacement
    ? "Markup Properties"
    : "Properties";

  // Type definitions
  const activeTypeKey = selectedWall
    ? "wall-generic-200"
    : selectedDoor
    ? "door-single-900"
    : selectedWindow
    ? "win-double-1200"
    : selectedSlab
    ? (selectedSlab.kind === "roof" ? "slab-roof-300" : "slab-floor-200")
    : "wall-generic-200";

  const currentType = types[activeTypeKey] || DEFAULT_ELEMENT_TYPES[activeTypeKey] || DEFAULT_ELEMENT_TYPES["wall-generic-200"];

  const handleTypeChange = (typeId: string) => {
    const tDef = types[typeId];
    if (!tDef) return;
    if (selectedWall && tDef.category === "Wall") {
      updateWall(selectedWall.id, {
        thicknessMm: tDef.thicknessMm || selectedWall.thicknessMm,
        heightMm: tDef.heightMm || selectedWall.heightMm,
      });
    } else if (selectedDoor && tDef.category === "Door") {
      updateDoor(selectedDoor.id, {
        widthMm: tDef.widthMm || selectedDoor.widthMm,
        heightMm: tDef.heightMm || selectedDoor.heightMm,
      });
    } else if (selectedWindow && tDef.category === "Window") {
      updateWindow(selectedWindow.id, {
        widthMm: tDef.widthMm || selectedWindow.widthMm,
        heightMm: tDef.heightMm || selectedWindow.heightMm,
      });
    } else if (selectedSlab && (tDef.category === "Floor" || tDef.category === "Roof")) {
      updateSlab(selectedSlab.id, {
        thicknessMm: tDef.thicknessMm || selectedSlab.thicknessMm,
      });
    }
  };

  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));
    handleTypeChange(updated.id);
  };

  // Dimensions formatted
  const wallLen = selectedWall ? Math.round(wallLengthMm(selectedWall)) : 0;
  const wallArea = selectedWall
    ? ((wallLen * (selectedWall.heightMm || 3000)) / 1_000_000).toFixed(2)
    : "0.00";
  const wallVol = selectedWall
    ? (
        (wallLen *
          (selectedWall.heightMm || 3000) *
          selectedWall.thicknessMm) /
        1_000_000_000
      ).toFixed(2)
    : "0.00";

  // IFC spatial tree hook
  const activeModelId = useAppStore((s) => s.activeModelId);
  const { structure, loading } = useIfcStructure(Boolean(activeModelId));

  // -- Left edge resize drag -------------------------------------------------
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_WIDTH);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = panelWidth;

      const onMove = (ev: MouseEvent) => {
        if (!isResizingRef.current) return;
        const delta = resizeStartXRef.current - ev.clientX;
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartWidthRef.current + delta));
        setPanelWidth(next);
      };
      const onUp = () => {
        isResizingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth, setPanelWidth]
  );

  // -- Horizontal splitter drag ---------------------------------------------
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
        const next = Math.min(520, Math.max(80, splitStartHeightRef.current + delta));
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

  return (
    <>
      {!rightPanelOpen && (
        <button
          className="fixed right-3 top-[80px] z-30 flex h-10 w-10 items-center justify-center rounded-xl liquid-glass-panel hover:bg-yellow-400/10 text-[var(--text-strong)] transition-all shadow-xl border border-[var(--panel-divider)]"
          onClick={() => setRightPanelOpen(true)}
          title="Expand Layout & Properties Panel"
        >
          <LuChevronLeft className="h-5 w-5" />
        </button>
      )}

      <aside
        className={`fixed z-30 flex flex-col transition-transform duration-300 select-none overflow-hidden ${
          isFloating
            ? "right-4 top-[88px] bottom-16 liquid-glass-panel"
            : "top-0 bottom-0 right-0 h-full liquid-glass-dock border-l border-y-0 border-r-0 rounded-none shadow-2xl"
        } ${rightPanelOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: panelWidth }}
      >
        {!isFloating && rightPanelOpen && (
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group hover:bg-yellow-400/50 transition-colors"
            title="Drag to resize panel"
          />
        )}

        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3.5 bg-[var(--surface-overlay)]/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="font-bold text-xs text-[var(--text-strong)] truncate">
              {activeModelLabel || "Architecture Project"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRightPanelOpen(false)}
            title="Collapse Panel"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div
          className="flex flex-col border-b border-[var(--panel-divider)] overflow-y-auto thin-scroll shrink-0"
          style={{ height: propHeight, minHeight: 120 }}
        >
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/40 px-3.5 bg-[var(--surface-overlay)]/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5 truncate">
              <LuSlidersHorizontal className="h-3 w-3 shrink-0" />
              {propertiesTitle}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <UnifiedButton
                size="xs"
                variant="secondary"
                onClick={() => setMaterialEditorOpen(true)}
                icon={<LuPalette className="h-2.5 w-2.5 text-yellow-400" />}
                title="Open Material Editor"
              >
                Materials
              </UnifiedButton>

              {hasSelection &&
                (selectedWall ||
                  selectedDoor ||
                  selectedWindow ||
                  selectedSlab) && (
                  <UnifiedButton
                    size="xs"
                    variant="primary"
                    onClick={() => setEditTypeOpen(true)}
                    icon={<LuSlidersHorizontal className="h-2.5 w-2.5" />}
                  >
                    Edit Type
                  </UnifiedButton>
                )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 thin-scroll space-y-2 text-xs">
            {hasSelection ? (
              <>
                {selectedSketchLine ? (
                  <div className="space-y-2">
                    <div className="pb-2.5 border-b border-[var(--panel-divider)]/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                        Element
                      </div>
                      <div className="font-semibold text-xs text-[var(--text-strong)] mt-0.5">
                        Sketch Line
                      </div>
                    </div>

                    <PropSection
                      open={openSections.dimensions}
                      onToggle={() => toggleSection("dimensions")}
                      icon={<LuRuler className="h-3.5 w-3.5 text-yellow-400" />}
                      label="Geometry"
                    >
                      <PropRow label="Length">
                        <span className="font-mono font-semibold text-yellow-400">
                          {Math.round(
                            Math.hypot(
                              selectedSketchLine.endXmm -
                                selectedSketchLine.startXmm,
                              selectedSketchLine.endYmm -
                                selectedSketchLine.startYmm,
                            ),
                          )}{" "}
                          mm
                        </span>
                      </PropRow>
                      <PropRow label="Angle">
                        <span className="font-mono text-[var(--text-strong)]">
                          {Math.round(
                            (Math.atan2(
                              selectedSketchLine.endYmm -
                                selectedSketchLine.startYmm,
                              selectedSketchLine.endXmm -
                                selectedSketchLine.startXmm,
                            ) *
                              180) /
                              Math.PI,
                          )}
                          °
                        </span>
                      </PropRow>
                      <PropRow label="Start">
                        <span className="font-mono text-[10px] text-[var(--text-strong)]">
                          ({selectedSketchLine.startXmm},{" "}
                          {selectedSketchLine.startYmm})
                        </span>
                      </PropRow>
                      <PropRow label="End">
                        <span className="font-mono text-[10px] text-[var(--text-strong)]">
                          ({selectedSketchLine.endXmm},{" "}
                          {selectedSketchLine.endYmm})
                        </span>
                      </PropRow>
                    </PropSection>

                    <PropSection
                      open={openSections.identity}
                      onToggle={() => toggleSection("identity")}
                      icon={<LuLayers className="h-3.5 w-3.5 text-yellow-400" />}
                      label="Chain & Loop"
                    >
                      <PropRow label="Status">
                        {detectLoopsFromSegments(sketchLines).isFullyClosed ? (
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/30">
                            Closed Loop
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                            Open Chain ({sketchLines.length} segments)
                          </span>
                        )}
                      </PropRow>
                    </PropSection>

                    <div className="pt-2 border-t border-[var(--panel-divider)]/40 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <UnifiedButton
                          size="xs"
                          variant="primary"
                          onClick={() => convertSketchToSlab("floor")}
                          className="w-full"
                        >
                          To Floor
                        </UnifiedButton>
                        <UnifiedButton
                          size="xs"
                          variant="primary"
                          onClick={() => convertSketchToSlab("roof")}
                          className="w-full"
                        >
                          To Roof
                        </UnifiedButton>
                      </div>
                      <UnifiedButton
                        size="xs"
                        variant="danger"
                        onClick={() => deleteSketchLine(selectedSketchLine.id)}
                        icon={<LuTrash2 className="h-3 w-3" />}
                        className="w-full"
                      >
                        Delete Line
                      </UnifiedButton>
                    </div>
                  </div>
                ) : sketchLines.length > 0 &&
                  !selectedWall &&
                  !selectedDoor &&
                  !selectedWindow &&
                  !selectedSlab &&
                  !selectedPlacement ? (
                  <div className="space-y-2">
                    <div className="pb-2.5 border-b border-[var(--panel-divider)]/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                        Element
                      </div>
                      <div className="font-semibold text-xs text-[var(--text-strong)] mt-0.5">
                        Sketch Lines Chain ({sketchLines.length} Segments)
                      </div>
                    </div>

                    <PropSection
                      open={openSections.dimensions}
                      onToggle={() => toggleSection("dimensions")}
                      icon={<LuRuler className="h-3.5 w-3.5 text-yellow-400" />}
                      label="Chain Geometry"
                    >
                      <PropRow label="Segments">
                        <span className="font-mono font-semibold text-yellow-400">
                          {sketchLines.length} lines
                        </span>
                      </PropRow>
                      <PropRow label="Total Perimeter">
                        <span className="font-mono font-semibold text-[var(--text-strong)]">
                          {Math.round(
                            sketchLines.reduce(
                              (sum, l) =>
                                sum +
                                Math.hypot(
                                  l.endXmm - l.startXmm,
                                  l.endYmm - l.startYmm,
                                ),
                              0,
                            ),
                          )}{" "}
                          mm
                        </span>
                      </PropRow>
                    </PropSection>

                    <PropSection
                      open={openSections.identity}
                      onToggle={() => toggleSection("identity")}
                      icon={<LuLayers className="h-3.5 w-3.5 text-yellow-400" />}
                      label="Chain & Loop"
                    >
                      <PropRow label="Status">
                        {detectLoopsFromSegments(sketchLines).isFullyClosed ? (
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/30">
                            Closed Loop
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                            Open Chain ({sketchLines.length} segments)
                          </span>
                        )}
                      </PropRow>
                    </PropSection>

                    <div className="pt-2 border-t border-[var(--panel-divider)]/40 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <UnifiedButton
                          size="xs"
                          variant="primary"
                          onClick={() => convertSketchToSlab("floor")}
                          className="w-full"
                        >
                          To Floor
                        </UnifiedButton>
                        <UnifiedButton
                          size="xs"
                          variant="primary"
                          onClick={() => convertSketchToSlab("roof")}
                          className="w-full"
                        >
                          To Roof
                        </UnifiedButton>
                      </div>
                      <UnifiedButton
                        size="xs"
                        variant="danger"
                        onClick={clearSketchLines}
                        icon={<LuTrash2 className="h-3 w-3" />}
                        className="w-full"
                      >
                        Clear All Lines
                      </UnifiedButton>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Type Selector (Compact, Thin Divider) */}
                    {(selectedWall ||
                      selectedDoor ||
                      selectedWindow ||
                      selectedSlab) && (
                      <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                          Type
                        </div>
                        <select
                          value={activeTypeKey}
                          onChange={(e) => handleTypeChange(e.target.value)}
                          className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 font-semibold text-xs text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none"
                        >
                          {Object.values(types)
                            .filter((t) => {
                              if (selectedWall) return t.category === "Wall";
                              if (selectedDoor) return t.category === "Door";
                              if (selectedWindow) return t.category === "Window";
                              if (selectedSlab)
                                return (
                                  t.category === "Floor" ||
                                  t.category === "Roof"
                                );
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

                    <div className="space-y-1">
                      {/* Identity */}
                      <PropSection
                        open={openSections.identity}
                        onToggle={() => toggleSection("identity")}
                        icon={
                          <LuFileText className="h-3.5 w-3.5 text-yellow-400" />
                        }
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
                        icon={
                          <LuRuler className="h-3.5 w-3.5 text-yellow-400" />
                        }
                        label="Dimensions"
                      >
                        {selectedWall && (
                          <>
                            <PropRow label="Length">
                              <span className="font-mono font-semibold text-yellow-400">
                                {Math.round(
                                  Math.hypot(
                                    selectedWall.endXmm - selectedWall.startXmm,
                                    selectedWall.endYmm - selectedWall.startYmm,
                                  ),
                                )}{" "}
                                mm
                              </span>
                            </PropRow>
                            <PropRow label="Thickness">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedWall.thicknessMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Height">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedWall.heightMm} mm
                              </span>
                            </PropRow>
                          </>
                        )}
                        {selectedDoor && (
                          <>
                            <PropRow label="Width">
                              <span className="font-mono font-semibold text-yellow-400">
                                {selectedDoor.widthMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Height">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedDoor.heightMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Offset on Wall">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedDoor.positionMm} mm
                              </span>
                            </PropRow>
                          </>
                        )}
                        {selectedWindow && (
                          <>
                            <PropRow label="Width">
                              <span className="font-mono font-semibold text-yellow-400">
                                {selectedWindow.widthMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Height">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedWindow.heightMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Sill Height">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedWindow.sillHeightMm} mm
                              </span>
                            </PropRow>
                          </>
                        )}
                        {selectedSlab && (
                          <>
                            <PropRow label="Thickness">
                              <span className="font-mono font-semibold text-yellow-400">
                                {selectedSlab.thicknessMm} mm
                              </span>
                            </PropRow>
                            <PropRow label="Elevation Offset">
                              <span className="font-mono text-[var(--text-strong)]">
                                {selectedSlab.elevationOffsetMm} mm
                              </span>
                            </PropRow>
                          </>
                        )}
                        {selectedPlacement && (
                          <MarkupPropertiesPanel className="!border-0 !bg-transparent !p-0 !shadow-none" />
                        )}
                      </PropSection>

                      {/* Materials & Finishes */}
                      <PropSection
                        open={openSections.materials}
                        onToggle={() => toggleSection("materials")}
                        icon={<LuBox className="h-3.5 w-3.5 text-yellow-400" />}
                        label="Materials & Finishes"
                      >
                        <div className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-[var(--text-muted)]">
                            Material
                          </span>
                          <button
                            type="button"
                            onClick={() => setMaterialEditorOpen(true)}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1 font-semibold text-xs text-yellow-400 hover:border-yellow-400 transition-all"
                          >
                            <LuPalette className="h-3 w-3" />
                            <span>
                              {selectedWall?.material ||
                                selectedSlab?.material ||
                                selectedDoor?.material ||
                                currentType?.material ||
                                "Default Material"}
                            </span>
                          </button>
                        </div>
                        {selectedDoor && (
                          <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-[var(--text-muted)]">
                              Door Style
                            </span>
                            <button
                              type="button"
                              onClick={() => setMaterialEditorOpen(true)}
                              className="font-semibold text-yellow-400 hover:underline"
                            >
                              <span>{selectedDoor.style || "Standard"}</span>
                            </button>
                          </div>
                        )}
                        <PropRow label="Function">
                          <span className="font-medium text-[var(--text-strong)]">
                            {currentType?.functionType || "Interior"}
                          </span>
                        </PropRow>
                      </PropSection>

                      {/* IFC */}
                      <PropSection
                        open={openSections.ifc}
                        onToggle={() => toggleSection("ifc")}
                        icon={
                          <LuShieldCheck className="h-3.5 w-3.5 text-yellow-400" />
                        }
                        label="IFC / BIM Data"
                      >
                        <PropRow label="Export Entity">
                          <span className="font-mono text-[var(--text-strong)]">
                            {selectedWall
                              ? "IfcWallStandardCase"
                              : selectedDoor
                              ? "IfcDoor"
                              : selectedWindow
                              ? "IfcWindow"
                              : "IfcSlab"}
                          </span>
                        </PropRow>
                      </PropSection>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Persistent Empty State when nothing is selected */
              <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[160px] text-[var(--text-muted)] space-y-2 select-none">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--glass-inset-bg)] border border-[var(--panel-divider)]">
                  <LuSlidersHorizontal className="h-5 w-5 text-yellow-400 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-[var(--text-body)]">No Element Selected</p>
                <p className="text-[10px] text-[var(--text-muted)] max-w-[200px] leading-relaxed">
                  Click any wall, door, window, or slab in the viewport to inspect and modify properties.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* -- Horizontal splitter ----------------------------------------- */}
        <div
          onMouseDown={onSplitterMouseDown}
          className="h-2 shrink-0 cursor-row-resize flex items-center justify-center bg-[var(--panel-divider)]/30 hover:bg-yellow-400/40 transition-colors group"
          title="Drag to resize split"
        >
          <LuGripVertical className="h-3.5 w-3.5 text-[var(--text-muted)] rotate-90 opacity-60 group-hover:opacity-100 group-hover:text-yellow-400" />
        </div>

        {/* -- LAYOUT (formerly Project Browser) -------------------------- */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Layout header + tabs */}
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/40 px-3.5 bg-[var(--surface-overlay)]/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              Layout
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBrowserTab("all")}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  browserTab === "all"
                    ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40"
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
                    ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                IFC
              </button>
            </div>
          </div>

          {/* Layout body (Compact, Thin Dividers) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 thin-scroll text-xs space-y-2.5">
            {browserTab === "all" ? (
              <>
                {/* Active Level selector */}
                <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                    Active Level
                  </div>
                  <select
                    value={selectedFloor || ""}
                    onChange={(e) => setSelectedFloor(e.target.value || null)}
                    className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none"
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
                <div className="pb-2.5 border-b border-[var(--panel-divider)]/40">
                  <button 
                    type="button" 
                    onClick={() => setFloorsOpen(!floorsOpen)} 
                    className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-strong)] mb-2 hover:text-yellow-400 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5">
                      <LuLayers className="h-3 w-3 text-yellow-400" />
                      Building Levels & Stories
                    </div>
                    <div className="flex items-center justify-center h-4 w-4 rounded border border-[var(--panel-divider)] group-hover:border-yellow-400 bg-[var(--surface-overlay)]/50 transition-colors">
                      {floorsOpen ? <LuMinus className="h-3 w-3 text-[var(--text-muted)] group-hover:text-yellow-400" /> : <LuPlus className="h-3 w-3 text-[var(--text-muted)] group-hover:text-yellow-400" />}
                    </div>
                  </button>
                  {floorsOpen && <ToolFloorsSection />}
                </div>

                {/* Views tree */}
                <div className="pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-strong)] mb-2 flex items-center gap-1.5">
                    <LuEye className="h-3 w-3 text-yellow-400" />
                    Views
                  </div>
                  <div className="flex flex-col ml-1 pl-2 border-l border-[var(--panel-divider)]/40 space-y-1">
                    {[
                      { id: 'free', label: '3D View' },
                      { id: 'north', label: 'North Elevation' },
                      { id: 'south', label: 'South Elevation' },
                      { id: 'east', label: 'East Elevation' },
                      { id: 'west', label: 'West Elevation' },
                    ].map(v => (
                      <button 
                        key={v.id} 
                        onClick={() => setViewPreset(v.id as any)} 
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                      >
                        <LuChevronRight className="h-3 w-3 text-[var(--text-muted)] group-hover:text-yellow-400 transition-colors" />
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

        {/* In-dock Slide-Over Edit Type Panel */}
        <EditTypeDialog
          typeDef={currentType}
          isOpen={editTypeOpen}
          onClose={() => setEditTypeOpen(false)}
          onSave={handleTypeSave}
        />

        {/* In-dock Slide-Over Material Editor */}
        <MaterialEditorPanel
          isOpen={materialEditorOpen}
          onClose={() => setMaterialEditorOpen(false)}
        />
      </aside>
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
