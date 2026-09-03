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
import gsap from "gsap";
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
  LuSearch,
  LuSettings,
  LuTable,
  LuFileSpreadsheet,
} from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useStudioSettingsStore, STUDIO_ACCENTS } from "@/store/useStudioSettingsStore";
import { detectLoopsFromSegments } from "@/lib/linesLoopDetector";
import { useIfcStructure } from "./useIfcStructure";
import IfcStructureTree from "./IfcStructureTree";
import ToolFloorsSection from "./ToolFloorsSection";
import MarkupPropertiesPanel from "./MarkupPropertiesPanel";
import ElementInspector from "./ElementInspector";
import EditTypeDialog, { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import EditTypeEmbeddedPanel from "./EditTypeEmbeddedPanel";
import MaterialEditorPanel from "./MaterialEditorPanel";
import EmbeddedSettingsTab from "./EmbeddedSettingsTab";
import LayoutPropertiesPanel from "./LayoutPropertiesPanel";
import {
  wallLengthMm,
  type LayoutLevel,
  type LayoutSlab,
  type LayoutToolId,
  type LayoutWall,
} from "@/lib/layoutDrawing";
import UnifiedButton from "@/components/common/UnifiedButton";

const MIN_WIDTH = 260;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

type BrowserTab = "all" | "ifc";

export default function ToolRightPanel({
  onFile,
  isLoadingModel = false,
  panelWidth: controlledPanelWidth,
  onPanelWidthChange,
  onOpenRoomSchedule,
  onOpenSheet,
}: {
  onFile?: (file: File) => void;
  isLoadingModel?: boolean;
  panelWidth?: number;
  onPanelWidthChange?: (w: number) => void;
  onOpenRoomSchedule?: () => void;
  onOpenSheet?: (sheetId: string) => void;
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

  const [propHeight, setPropHeight] = useState(280); // compact default split

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.innerWidth < 1100);
      if (!isSplitDraggingRef.current) {
        setPropHeight(Math.max(200, Math.round((window.innerHeight - 120) / 2)));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -- Edit type, materials, and settings tabs in Properties -----------------
  const [propTab, setPropTab] = useState<"properties" | "materials" | "settings">("properties");
  const [editTypeMode, setEditTypeMode] = useState(false);
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);
  const [types, setTypes] = useState<Record<string, ElementTypeDefinition>>(DEFAULT_ELEMENT_TYPES);

  const accent = useStudioSettingsStore((s) => s.accent);
  const syncArchMep = useStudioSettingsStore((s) => s.syncArchMep);
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);

  const activeHighlightClass = mepModeActive
    ? "btn-v-blue btn-liquid-hover shadow-md shadow-sky-400/30 !text-slate-950 font-bold"
    : "btn-v-yellow btn-liquid-hover shadow-md shadow-yellow-400/30 !text-zinc-950 font-bold";
  const activeTextClass = mepModeActive ? "text-sky-400" : "text-yellow-400";
  const activeDotClass = mepModeActive
    ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
    : "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]";
  const activeAccent = syncArchMep
    ? (STUDIO_ACCENTS[accent] || STUDIO_ACCENTS.vyellow)
    : mepModeActive
    ? STUDIO_ACCENTS.vblue
    : STUDIO_ACCENTS.vyellow;

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
  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const gridLines = useLayoutDrawingStore((s) => s.gridLines);
  const stairs = useLayoutDrawingStore((s) => s.stairs);
  const ramps = useLayoutDrawingStore((s) => s.ramps);
  const ducts = useLayoutDrawingStore((s) => s.ducts);
  const pipes = useLayoutDrawingStore((s) => s.pipes);
  const cableTrays = useLayoutDrawingStore((s) => s.cableTrays);
  const mepEquipment = useLayoutDrawingStore((s) => s.mepEquipment);
  const groups = useLayoutDrawingStore((s) => s.groups);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectElement = useLayoutDrawingStore((s) => s.selectElement);
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const levels = useLayoutDrawingStore((s) => s.levels);

  useEffect(() => {
    if (!selectedElements.length) return;
    const tabletLandscape = window.innerWidth >= 700 && window.innerWidth < 1100 && window.innerWidth > window.innerHeight;
    if (tabletLandscape) setRightPanelOpen(true);
  }, [selectedElements.length, setRightPanelOpen]);

  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const selectedDuctId = useLayoutDrawingStore((s) => s.selectedDuctId);
  const selectedPipeId = useLayoutDrawingStore((s) => s.selectedPipeId);
  const selectedCableTrayId = useLayoutDrawingStore((s) => s.selectedCableTrayId);
  const selectedEquipmentId = useLayoutDrawingStore((s) => s.selectedEquipmentId);
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
  const viewPreset = useToolMarkupStore((s) => s.viewPreset);

  const browserSearch = useLayoutDrawingStore((s) => s.browserSearch);
  const elementsCategoryFilter = useLayoutDrawingStore((s) => s.elementsCategoryFilter);
  const [views3DOpen, setViews3DOpen] = useState(true);
  const [viewsSidesOpen, setViewsSidesOpen] = useState(true);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);

  const tabTrackRef = useRef<HTMLDivElement | null>(null);
  const capsuleIndicatorRef = useRef<HTMLDivElement | null>(null);
  const defaultBtnRef = useRef<HTMLButtonElement | null>(null);
  const materialsBtnRef = useRef<HTMLButtonElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const track = tabTrackRef.current;
    const indicator = capsuleIndicatorRef.current;
    if (!track || !indicator) return;

    let targetBtn: HTMLButtonElement | null = null;
    if (propTab === "properties") targetBtn = defaultBtnRef.current;
    else if (propTab === "materials") targetBtn = materialsBtnRef.current;
    else if (propTab === "settings") targetBtn = settingsBtnRef.current;

    if (targetBtn) {
      const trackRect = track.getBoundingClientRect();
      const btnRect = targetBtn.getBoundingClientRect();
      if (btnRect.width > 0) {
        const targetX = btnRect.left - trackRect.left;
        const targetW = btnRect.width;

        gsap.to(indicator, {
          x: targetX,
          width: targetW,
          duration: 0.35,
          ease: "power3.out",
        });
      }
    }
  }, [propTab, panelWidth, rightPanelOpen]);

  const getViewTitle = () => {
    if (viewPreset === "top") {
      return currentFloorObj ? `Floor Plan: ${currentFloorObj.name}` : "Top (Plan)";
    }
    if (viewPreset === "north") return "Elevation: North";
    if (viewPreset === "south") return "Elevation: South";
    if (viewPreset === "east") return "Elevation: East";
    if (viewPreset === "west") return "Elevation: West";
    if (viewPreset === "free" || !viewPreset) {
      return currentFloorObj ? `3D View (${currentFloorObj.name})` : "3D View";
    }
    return "3D View";
  };
  
  // Derive selection objects
  const selectedWall = walls.find((w) => w.id === selectedWallId);
  const selectedDoor = doors.find((d) => d.id === selectedDoorId);
  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedSlab = slabs.find((s) => s.id === selectedSlabId);
  const selectedStair = stairs.find((st) => st.id === (selectedStairId ?? selectedElements.find((e) => e.kind === "stair")?.id));
  const selectedRamp = ramps.find((rp) => rp.id === (selectedRampId ?? selectedElements.find((e) => e.kind === "ramp")?.id));
  const selectedDuct = ducts.find((item) => item.id === (selectedDuctId ?? selectedElements.find((e) => e.kind === "duct")?.id));
  const selectedPipe = pipes.find((item) => item.id === (selectedPipeId ?? selectedElements.find((e) => e.kind === "pipe")?.id));
  const selectedCableTray = cableTrays.find((item) => item.id === (selectedCableTrayId ?? selectedElements.find((e) => e.kind === "cabletray")?.id));
  const selectedEquipment = mepEquipment.find((item) => item.id === (selectedEquipmentId ?? selectedElements.find((e) => e.kind === "equipment")?.id));
  const selectedColumn = columns.find((item) => selectedElements.some((ref) => ref.kind === "column" && ref.id === item.id));
  const selectedBeam = beams.find((item) => selectedElements.some((ref) => ref.kind === "beam" && ref.id === item.id));
  const selectedSketchLine = sketchLines.find((l) => l.id === selectedSketchLineId);
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId);

  const hasLineSelection = Boolean(selectedSketchLine || sketchLines.length > 0);
  const hasSelection = Boolean(
    selectedWall || selectedDoor || selectedWindow || selectedSlab || selectedStair || selectedRamp || selectedColumn || selectedBeam || selectedDuct || selectedPipe || selectedCableTray || selectedEquipment || hasLineSelection || selectedPlacement
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
    : selectedStair
    ? "Stair Properties"
    : selectedRamp
    ? "Ramp Properties"
    : selectedColumn
    ? "Column Properties"
    : selectedBeam
    ? "Beam Properties"
    : selectedDuct
    ? "Duct Properties"
    : selectedPipe
    ? "Pipe Properties"
    : selectedCableTray
    ? "Cable Tray Properties"
    : selectedEquipment
    ? "Equipment Properties"
    : selectedSketchLine
    ? "Line Properties"
    : sketchLines.length > 0
    ? "Sketch Lines"
    : selectedPlacement
    ? "Markup Properties"
    : armedLayoutTool
    ? `${armedLayoutTool === "lines" ? "Line" : armedLayoutTool[0].toUpperCase() + armedLayoutTool.slice(1)} Creation Properties`
    : "Properties";

  // Type definitions
  const activeTypeKey = selectedWall
    ? (selectedWall.wallTypeId && (types[selectedWall.wallTypeId] || DEFAULT_ELEMENT_TYPES[selectedWall.wallTypeId])
        ? selectedWall.wallTypeId
        : (selectedWall.thicknessMm === 100
            ? "wall-interior-100"
            : selectedWall.thicknessMm === 300
            ? "wall-exterior-300"
            : "wall-generic-200"))
    : selectedDoor
    ? "door-single-900"
    : selectedWindow
    ? "win-double-1200"
    : selectedSlab
    ? (selectedSlab.kind === "roof" ? "slab-roof-300" : "slab-floor-200")
    : "wall-generic-200";

  const currentType = types[activeTypeKey] || DEFAULT_ELEMENT_TYPES[activeTypeKey] || DEFAULT_ELEMENT_TYPES["wall-300"] || Object.values(DEFAULT_ELEMENT_TYPES)[0];

  const isMepActive = Boolean(selectedDuct || selectedPipe || selectedCableTray || selectedEquipment);

  const handleTypeChange = (typeId: string) => {
    const tDef = types[typeId] || DEFAULT_ELEMENT_TYPES[typeId];
    if (!tDef) return;
    if (selectedWall && tDef.category === "Wall") {
      const ids = selectedElements.filter((item) => item.kind === "wall").map((item) => item.id);
      for (const id of ids.length ? ids : [selectedWall.id]) void updateWall(id, {
        thicknessMm: tDef.thicknessMm || selectedWall.thicknessMm,
        heightMm: tDef.heightMm || selectedWall.heightMm,
        wallTypeId: tDef.id,
        layers: tDef.layers ? [...tDef.layers] : undefined,
      });
    } else if (selectedDoor && tDef.category === "Door") {
      const ids = selectedElements.filter((item) => item.kind === "door").map((item) => item.id);
      for (const id of ids.length ? ids : [selectedDoor.id]) void updateDoor(id, {
        widthMm: tDef.widthMm || selectedDoor.widthMm,
        heightMm: tDef.heightMm || selectedDoor.heightMm,
      });
    } else if (selectedWindow && tDef.category === "Window") {
      const ids = selectedElements.filter((item) => item.kind === "window").map((item) => item.id);
      for (const id of ids.length ? ids : [selectedWindow.id]) void updateWindow(id, {
        widthMm: tDef.widthMm || selectedWindow.widthMm,
        heightMm: tDef.heightMm || selectedWindow.heightMm,
      });
    } else if (selectedSlab && (tDef.category === "Floor" || tDef.category === "Roof")) {
      const ids = selectedElements.filter((item) => item.kind === "slab").map((item) => item.id);
      for (const id of ids.length ? ids : [selectedSlab.id]) void updateSlab(id, {
        thicknessMm: tDef.thicknessMm || selectedSlab.thicknessMm,
      });
    }
  };

  const handleTypeSave = (updated: ElementTypeDefinition) => {
    setTypes((prev) => ({ ...prev, [updated.id]: updated }));
    if (selectedWall && updated.category === "Wall") {
      const ids = selectedElements.filter((item) => item.kind === "wall").map((item) => item.id);
      for (const id of ids.length ? ids : [selectedWall.id]) void updateWall(id, {
        thicknessMm: updated.thicknessMm || selectedWall.thicknessMm,
        heightMm: updated.heightMm || selectedWall.heightMm,
        wallTypeId: updated.id,
        layers: updated.layers ? [...updated.layers] : undefined,
        material: updated.material,
      });
    } else if (selectedDoor && updated.category === "Door") {
      void updateDoor(selectedDoor.id, {
        widthMm: updated.widthMm || selectedDoor.widthMm,
        heightMm: updated.heightMm || selectedDoor.heightMm,
        material: updated.material,
      });
    } else if (selectedWindow && updated.category === "Window") {
      void updateWindow(selectedWindow.id, {
        widthMm: updated.widthMm || selectedWindow.widthMm,
        heightMm: updated.heightMm || selectedWindow.heightMm,
        sillHeightMm: updated.sillHeightMm ?? selectedWindow.sillHeightMm,
        material: updated.material,
      });
    } else if (selectedSlab && (updated.category === "Floor" || updated.category === "Roof")) {
      void updateSlab(selectedSlab.id, {
        thicknessMm: updated.thicknessMm || selectedSlab.thicknessMm,
        material: updated.material,
      });
    }
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
          className="tool-right-launcher fixed right-3 top-[80px] z-30 flex h-10 w-10 items-center justify-center rounded-full liquid-glass-panel hover:bg-yellow-400/10 text-[var(--text-strong)] transition-all shadow-xl border border-[var(--panel-divider)]"
          onClick={() => setRightPanelOpen(true)}
          title="Expand Layout & Properties Panel"
        >
          <LuSlidersHorizontal className="h-4 w-4" />
        </button>
      )}

      <aside
        data-open={rightPanelOpen ? "true" : "false"}
        className={`fixed z-30 flex flex-col transition-transform duration-300 select-none overflow-hidden ${
          isFloating
            ? "right-2 top-[72px] bottom-10 liquid-glass-panel"
            : "top-0 bottom-0 right-0 h-full liquid-glass-dock border-l border-y-0 border-r-0 rounded-none shadow-2xl"
        } ${rightPanelOpen ? "translate-x-0" : "translate-x-full"} tool-right-compact`}
        style={{ width: panelWidth }}
      >
        {!isFloating && rightPanelOpen && (
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group hover:bg-yellow-400/50 transition-colors"
            title="Drag to resize panel"
          />
        )}

        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-2.5 bg-[var(--surface-overlay)]/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="font-semibold text-[11px] text-[var(--text-strong)] truncate">
              {activeModelLabel || "Architecture Project"}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">
              • {getViewTitle()}
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

        {/* THREE TABS DIRECTLY BELOW FILE NAME AND LEVEL NAME (Animated GSAP Sliding Capsule) */}
        <div className="border-b border-[var(--panel-divider)] px-2.5 py-1.5 bg-[var(--surface-overlay)]/40">
          <div
            ref={tabTrackRef}
            className="relative flex h-7 items-center rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-0.5 shadow-inner backdrop-blur-md"
          >
            {/* Animated Sliding Capsule Highlight - Neutral Gray/Black/White */}
            <div
              ref={capsuleIndicatorRef}
              className="absolute top-0.5 bottom-0.5 left-0 rounded-full pointer-events-none transition-colors bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_3px_rgba(0,0,0,0.3)]"
              style={{
                width: "33.333%",
              }}
            />

            <button
              ref={defaultBtnRef}
              type="button"
              onClick={() => {
                setPropTab("properties");
                setEditTypeMode(false);
              }}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 py-0.5 px-1.5 text-[10.5px] font-bold border-0 outline-none focus:outline-none shadow-none rounded-full transition-colors ${
                propTab === "properties"
                  ? "!text-[var(--text-strong)] font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
              title="Default: Properties & Layout Inspector"
            >
              <LuSlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate hidden min-[260px]:inline">Default</span>
            </button>

            <button
              ref={materialsBtnRef}
              type="button"
              onClick={() => setPropTab("materials")}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 py-0.5 px-1.5 text-[10.5px] font-bold border-0 outline-none focus:outline-none shadow-none rounded-full transition-colors ${
                propTab === "materials"
                  ? "!text-[var(--text-strong)] font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
              title="Material Library & Shader Studio"
            >
              <LuPalette className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate hidden min-[260px]:inline">Materials</span>
            </button>

            <button
              ref={settingsBtnRef}
              type="button"
              onClick={() => setPropTab("settings")}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 py-0.5 px-1.5 text-[10.5px] font-bold border-0 outline-none focus:outline-none shadow-none rounded-full transition-colors ${
                propTab === "settings"
                  ? "!text-[var(--text-strong)] font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
              title="Studio Settings & Workspace Preferences"
            >
              <LuSettings className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate hidden min-[260px]:inline">Settings</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DEFAULT (PROPERTIES & LAYOUT) */}
        {propTab === "properties" && (
          editTypeMode && (selectedWall || selectedDoor || selectedWindow || selectedSlab) ? (
            <div className="flex-1 min-h-0 h-full overflow-hidden">
              <EditTypeEmbeddedPanel
                typeDef={currentType}
                onBack={() => setEditTypeMode(false)}
                onSave={handleTypeSave}
                onOpenMaterialPicker={() => setPropTab("materials")}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
              {/* Top Properties Region */}
              <div
                className="tool-properties-region flex flex-col border-b border-[var(--panel-divider)] overflow-hidden shrink-0"
                style={{ height: propHeight, minHeight: 120 }}
              >
                <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/40 px-2.5 bg-[var(--surface-overlay)]/40">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTextClass} flex items-center gap-1.5 truncate`}>
                    <LuSlidersHorizontal className="h-3 w-3 shrink-0" />
                    {propertiesTitle}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasSelection &&
                      (selectedWall ||
                        selectedDoor ||
                        selectedWindow ||
                        selectedSlab) && (
                        <button
                          type="button"
                          onClick={() => setEditTypeMode(true)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${activeHighlightClass} transition-all`}
                          title="Edit Type Parameters (Esc to return)"
                        >
                          <LuSlidersHorizontal className="h-2.5 w-2.5" />
                          <span>Edit Type</span>
                        </button>
                      )}
                  </div>
                </div>

                <div className="tool-properties-content flex-1 overflow-y-auto p-2 thin-scroll space-y-1.5 text-[11px]">
                  {hasSelection ? (
                    <>
                {selectedElements.length > 1 ? (
                  <BulkSelectionProperties />
                ) : selectedStair || selectedRamp || selectedColumn || selectedBeam || selectedDuct || selectedPipe || selectedCableTray || selectedEquipment ? (
                  <LayoutPropertiesPanel />
                ) : selectedSketchLine ? (
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

                      <SketchLineStyleEditor lineId={selectedSketchLine.id} />

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

                      {selectedSlab?.kind === "roof" && <RoofEdgeSlopeEditor slab={selectedSlab} />}

                      {selectedWall && (
                        <>
                          <PropSection
                            open={openSections.constraints}
                            onToggle={() => toggleSection("constraints")}
                            icon={<LuShieldCheck className="h-3.5 w-3.5 text-yellow-400" />}
                            label="Wall Constraints"
                          >
                            <WallConstraintFields
                              wall={selectedWall}
                              levels={levels}
                              onUpdate={(patch) => void updateWall(selectedWall.id, patch)}
                            />
                          </PropSection>
                        </>
                      )}

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
            ) : armedLayoutTool ? (
              <DraftToolProperties tool={armedLayoutTool} />
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
            className="tool-properties-splitter h-1 shrink-0 cursor-row-resize flex items-center justify-center bg-[var(--panel-divider)]/30 hover:bg-yellow-400/40 transition-colors group"
            title="Drag to resize split"
          >
            <LuGripVertical className="h-3.5 w-3.5 text-[var(--text-muted)] rotate-90 opacity-60 group-hover:opacity-100 group-hover:text-yellow-400" />
          </div>

          {/* -- LAYOUT (formerly Project Browser) -------------------------- */}
          <div className="tool-layout-browser flex flex-col flex-1 min-h-0">
            {/* Layout header + tabs */}
            <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--panel-divider)]/40 px-2.5 bg-[var(--surface-overlay)]/40">
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
            <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-1.5 thin-scroll text-[11px] space-y-1.5">
              {browserTab === "all" ? (
                <>
                  {/* Levels & Stories tree */}
                  <div className="pb-1.5 border-b border-[var(--panel-divider)]/40">
                    <button 
                      type="button" 
                      onClick={() => setFloorsOpen(!floorsOpen)} 
                      className="w-full flex items-center justify-between text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--text-strong)] mb-1 hover:text-yellow-400 transition-colors cursor-pointer group"
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
                    <div className="flex flex-col ml-1 pl-2 border-l border-[var(--panel-divider)]/40 space-y-2">
                      {/* 3D Views */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setViews3DOpen(!views3DOpen)}
                          className="w-full flex items-center justify-between text-[10px] font-semibold text-[var(--text-muted)] uppercase hover:text-yellow-400 transition-colors"
                        >
                          <span>3D Views</span>
                          {views3DOpen ? <LuChevronDown className="h-3 w-3" /> : <LuChevronRight className="h-3 w-3" />}
                        </button>
                        {views3DOpen && (
                          <div className="flex flex-col space-y-0.5 pl-1.5 pt-0.5">
                            <button 
                              onClick={() => setViewPreset("free")} 
                              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                            >
                              <LuChevronRight className="h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-yellow-400" />
                              3D View
                            </button>
                          </div>
                        )}
                      </div>

                      {/* All Sides (Elevations) */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setViewsSidesOpen(!viewsSidesOpen)}
                          className="w-full flex items-center justify-between text-[10px] font-semibold text-[var(--text-muted)] uppercase hover:text-yellow-400 transition-colors"
                        >
                          <span>All Sides</span>
                          {viewsSidesOpen ? <LuChevronDown className="h-3 w-3" /> : <LuChevronRight className="h-3 w-3" />}
                        </button>
                        {viewsSidesOpen && (
                          <div className="flex flex-col space-y-0.5 pl-1.5 pt-0.5">
                            {[
                              { id: 'north', label: 'North Elevation' },
                              { id: 'south', label: 'South Elevation' },
                              { id: 'east', label: 'East Elevation' },
                              { id: 'west', label: 'West Elevation' },
                            ].map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setViewPreset(s.id as 'north' | 'south' | 'east' | 'west')}
                                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                              >
                                <LuChevronRight className="h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-yellow-400" />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Schedules / Quantities */}
                  <div className="pt-1 border-t border-[var(--panel-divider)]/40">
                    <button
                      type="button"
                      onClick={() => setSchedulesOpen(!schedulesOpen)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-[var(--text-strong)] uppercase hover:text-yellow-400 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <LuTable className="h-3 w-3 text-yellow-400" />
                        <span>Schedules / Quantities</span>
                      </div>
                      {schedulesOpen ? <LuChevronDown className="h-3 w-3" /> : <LuChevronRight className="h-3 w-3" />}
                    </button>
                    {schedulesOpen && (
                      <div className="flex flex-col space-y-0.5 pl-4 pt-1">
                        <button
                          type="button"
                          onClick={onOpenRoomSchedule}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                        >
                          <LuTable className="h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-yellow-400" />
                          <span>Room Schedule</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sheets */}
                  <div className="pt-1 border-t border-[var(--panel-divider)]/40">
                    <button
                      type="button"
                      onClick={() => setSheetsOpen(!sheetsOpen)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-[var(--text-strong)] uppercase hover:text-yellow-400 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <LuFileSpreadsheet className="h-3 w-3 text-yellow-400" />
                        <span>Sheets (All)</span>
                      </div>
                      {sheetsOpen ? <LuChevronDown className="h-3 w-3" /> : <LuChevronRight className="h-3 w-3" />}
                    </button>
                    {sheetsOpen && (
                      <div className="flex flex-col space-y-0.5 pl-4 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenSheet?.("A101")}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                        >
                          <LuFileSpreadsheet className="h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-yellow-400" />
                          <span>A101 - Floor Plan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSheet?.("A102")}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-yellow-400 transition-colors text-left w-full group"
                        >
                          <LuFileSpreadsheet className="h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-yellow-400" />
                          <span>A102 - Elevations</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* IFC Spatial Hierarchy */
                <div className="h-full flex-1 min-h-[200px]">
                  <IfcStructureTree structure={structure} loading={loading} />
                </div>
              )}
            </div>
          </div>
        </div>
      )
    )}

      {/* TAB 2: EMBEDDED MATERIALS (Complete Full Height) */}
      {propTab === "materials" && (
        <div className="flex-1 min-h-0 h-full overflow-hidden">
          <MaterialEditorPanel
            isOpen={true}
            onClose={() => setPropTab("properties")}
            embedded={true}
          />
        </div>
      )}

      {/* TAB 3: EMBEDDED SETTINGS (Complete Full Height) */}
      {propTab === "settings" && (
        <div className="flex-1 min-h-0 h-full overflow-hidden">
          <EmbeddedSettingsTab />
        </div>
      )}
      </aside>
    </>
  );
}

// -- Small helper components ---------------------------------------------------

function BulkSelectionProperties() {
  const selected = useLayoutDrawingStore((s) => s.selectedElements);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const stairs = useLayoutDrawingStore((s) => s.stairs);
  const ramps = useLayoutDrawingStore((s) => s.ramps);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);
  const updateColumn = useLayoutDrawingStore((s) => s.updateColumn);
  const updateBeam = useLayoutDrawingStore((s) => s.updateBeam);
  const updateStair = useLayoutDrawingStore((s) => s.updateStair);
  const updateRamp = useLayoutDrawingStore((s) => s.updateRamp);
  const kinds = [...new Set(selected.map((item) => item.kind))];
  const kind = kinds.length === 1 ? kinds[0] : null;
  const ids = new Set(selected.filter((item) => item.kind === kind).map((item) => item.id));
  const records = (kind === "wall" ? walls : kind === "door" ? doors : kind === "window" ? windows : kind === "slab" ? slabs : kind === "column" ? columns : kind === "beam" ? beams : kind === "stair" ? stairs : kind === "ramp" ? ramps : [])
    .filter((item) => ids.has(item.id)) as unknown as Array<Record<string, unknown> & { id: string }>;

  const fields: Record<string, Array<{ key: string; label: string; suffix?: string }>> = {
    wall: [{ key: "thicknessMm", label: "Thickness", suffix: "mm" }, { key: "heightMm", label: "Height", suffix: "mm" }],
    door: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "heightMm", label: "Height", suffix: "mm" }],
    window: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "heightMm", label: "Height", suffix: "mm" }, { key: "sillHeightMm", label: "Sill height", suffix: "mm" }],
    slab: [{ key: "thicknessMm", label: "Thickness", suffix: "mm" }, { key: "elevationOffsetMm", label: "Elevation offset", suffix: "mm" }],
    column: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "depthMm", label: "Depth", suffix: "mm" }, { key: "heightMm", label: "Height", suffix: "mm" }],
    beam: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "depthMm", label: "Depth", suffix: "mm" }, { key: "elevationOffsetMm", label: "Elevation offset", suffix: "mm" }],
    stair: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "targetRiserHeightMm", label: "Target Riser", suffix: "mm" }, { key: "treadDepthMm", label: "Tread Depth", suffix: "mm" }],
    ramp: [{ key: "widthMm", label: "Width", suffix: "mm" }, { key: "thicknessMm", label: "Thickness", suffix: "mm" }],
  };

  const apply = (key: string, value: number | string) => {
    for (const id of ids) {
      const patch = { [key]: value } as never;
      if (kind === "wall") void updateWall(id, patch);
      else if (kind === "door") void updateDoor(id, patch);
      else if (kind === "window") void updateWindow(id, patch);
      else if (kind === "slab") void updateSlab(id, patch);
      else if (kind === "column") void updateColumn(id, patch);
      else if (kind === "beam") void updateBeam(id, patch);
      else if (kind === "stair") void updateStair(id, patch);
      else if (kind === "ramp") void updateRamp(id, patch);
    }
  };

  if (!kind || !fields[kind]) {
    return <div className="space-y-2 rounded-xl border border-yellow-400/35 bg-yellow-400/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-strong)]">{selected.length} elements · mixed categories</div><p className="text-[10px] leading-relaxed text-[var(--text-muted)]">Use Selection Filter in the Modify ribbon to keep Walls, Doors, Windows, Floors, Columns, or Beams. Compatible properties can then be edited together.</p><div className="flex flex-wrap gap-1">{kinds.map((item) => <span key={item} className="rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-2 py-0.5 text-[9px] font-semibold capitalize">{item}s · {selected.filter((ref) => ref.kind === item).length}</span>)}</div></div>;
  }

  return <div className="space-y-2"><div className="rounded-xl border border-yellow-400/35 bg-yellow-400/10 p-2.5"><strong className="block text-[11px] capitalize text-[var(--text-strong)]">{records.length} {kind}s selected</strong><span className="text-[9px] text-[var(--text-muted)]">Changes below apply to every selected element.</span></div><div className="space-y-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2">{fields[kind].map((field) => { const values = records.map((item) => Number(item[field.key])).filter(Number.isFinite); const common = values.length && values.every((value) => value === values[0]) ? values[0] : undefined; return <label key={`${field.key}-${common ?? "mixed"}`} className="grid grid-cols-[1fr_7rem] items-center gap-2 py-1 text-[10px]"><span className="font-semibold text-[var(--text-body)]">{field.label}</span><span className="flex items-center rounded-lg border border-[var(--panel-divider)] bg-[var(--popover-bg)] px-2"><input type="number" defaultValue={common} placeholder="Mixed" className="h-7 min-w-0 flex-1 bg-transparent text-right font-mono text-[10px] outline-none" onBlur={(event) => { if (event.target.value !== "") apply(field.key, Number(event.target.value)); }} /><small className="ml-1 text-[8px] text-[var(--text-muted)]">{field.suffix}</small></span></label>; })}<label className="grid grid-cols-[1fr_7rem] items-center gap-2 py-1 text-[10px]"><span className="font-semibold text-[var(--text-body)]">Material</span><input type="text" defaultValue={records.length && records.every((item) => item.material === records[0].material) ? String(records[0].material ?? "") : ""} placeholder="Mixed" className="h-8 rounded-lg border border-[var(--panel-divider)] bg-[var(--popover-bg)] px-2 text-right text-[10px] outline-none" onBlur={(event) => { if (event.target.value.trim()) apply("material", event.target.value.trim()); }} /></label></div></div>;
}

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
    <div className="border-b border-[var(--panel-divider)]/40 pb-1.5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1 px-1 font-bold text-[11px] text-[var(--text-strong)] hover:text-yellow-400 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </span>
        {open ? (
          <LuChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        ) : (
          <LuChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        )}
      </button>
      {open && (
        <div className="pt-1 px-1 space-y-1 text-[11px]">
          {children}
        </div>
      )}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[var(--panel-divider)]/20 last:border-b-0">
      <span className="text-[var(--text-muted)] text-[10px]">{label}:</span>
      {children}
    </div>
  );
}

function WallConstraintFields({
  wall,
  levels,
  onUpdate,
}: {
  wall: LayoutWall;
  levels: LayoutLevel[];
  onUpdate: (patch: Partial<LayoutWall>) => void;
}) {
  const sortedLevels = [...levels].sort((a, b) => a.elevationMm - b.elevationMm);
  const base = levels.find((level) => level.id === wall.levelId);
  const fieldClass = "h-7 w-[8.5rem] rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right text-[10px] font-semibold text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none";
  const updateBase = (levelId: string) => {
    const nextBase = levels.find((level) => level.id === levelId);
    const top = levels.find((level) => level.id === wall.topLevelId);
    onUpdate({
      levelId,
      ...(nextBase && top && top.elevationMm > nextBase.elevationMm
        ? { heightMm: top.elevationMm - nextBase.elevationMm }
        : {}),
    });
  };
  const updateTop = (levelId: string) => {
    const top = levels.find((level) => level.id === levelId);
    onUpdate({
      topLevelId: levelId || undefined,
      ...(base && top ? { heightMm: top.elevationMm - base.elevationMm } : {}),
    });
  };

  return (
    <div className="space-y-1">
      <PropRow label="Base level">
        <select className={fieldClass} value={wall.levelId} onChange={(event) => updateBase(event.target.value)}>
          {sortedLevels.map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
        </select>
      </PropRow>
      <PropRow label="Top level">
        <select className={fieldClass} value={wall.topLevelId ?? ""} onChange={(event) => updateTop(event.target.value)}>
          <option value="">Unconnected</option>
          {sortedLevels.filter((level) => level.elevationMm > (base?.elevationMm ?? -Infinity)).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
        </select>
      </PropRow>
      <PropRow label="Height">
        <input className={fieldClass} type="number" min={50} value={wall.heightMm} onChange={(event) => onUpdate({ heightMm: Math.max(50, Number(event.target.value)), topLevelId: undefined })} />
      </PropRow>
      <PropRow label="Thickness">
        <input className={fieldClass} type="number" min={50} value={wall.thicknessMm} onChange={(event) => onUpdate({ thicknessMm: Math.max(50, Number(event.target.value)) })} />
      </PropRow>
    </div>
  );
}

function DraftToolProperties({ tool }: { tool: LayoutToolId }) {
  const store = useLayoutDrawingStore();
  const markup = useToolMarkupStore();
  const fieldClass = "h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] font-semibold text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none";
  const labelClass = "space-y-1 text-[10px] font-semibold text-[var(--text-muted)]";
  const baseLevelId = store.draftWallBaseLevelId ?? markup.markupFloorId ?? store.levels[0]?.id ?? "";
  const base = store.levels.find((level) => level.id === baseLevelId);
  const top = store.levels.find((level) => level.id === store.draftWallTopLevelId);
  const wallHeight = base && top ? top.elevationMm - base.elevationMm : store.draftWallHeightMm;

  const heading = tool === "lines" ? "New drawing line" : `New ${tool}`;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">{heading} properties</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Set these values before drawing. New elements will use them.</p>
      </div>

      {tool === "wall" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Base level
            <select className={fieldClass} value={baseLevelId} onChange={(event) => { const id = event.target.value; markup.setMarkupFloorId(id); store.setDraftWallBaseLevelId(id); }}>
              {[...store.levels].sort((a, b) => a.elevationMm - b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
            </select>
          </label>
          <label className={labelClass}>Top level
            <select className={fieldClass} value={store.draftWallTopLevelId ?? ""} onChange={(event) => store.setDraftWallTopLevelId(event.target.value || null)}>
              <option value="">Unconnected</option>
              {store.levels.filter((level) => level.elevationMm > (base?.elevationMm ?? -Infinity)).sort((a, b) => a.elevationMm - b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
            </select>
          </label>
          <label className={labelClass}>Height (mm)
            <input className={fieldClass} type="number" min={50} value={wallHeight} onChange={(event) => { store.setDraftWallHeightMm(Number(event.target.value)); store.setDraftWallTopLevelId(null); }} />
          </label>
          <label className={labelClass}>Thickness (mm)
            <input className={fieldClass} type="number" min={50} value={store.draftWallThicknessMm} onChange={(event) => store.setDraftWallThicknessMm(Number(event.target.value))} />
          </label>
        </div>
      )}

      {tool === "door" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Width (mm)<input className={fieldClass} type="number" value={store.draftDoorWidthMm} onChange={(event) => store.setDraftDoorSize(Number(event.target.value), store.draftDoorHeightMm)} /></label>
          <label className={labelClass}>Height (mm)<input className={fieldClass} type="number" value={store.draftDoorHeightMm} onChange={(event) => store.setDraftDoorSize(store.draftDoorWidthMm, Number(event.target.value))} /></label>
        </div>
      )}

      {tool === "window" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Width (mm)<input className={fieldClass} type="number" value={store.draftWindowWidthMm} onChange={(event) => store.setDraftWindowSize(Number(event.target.value), store.draftWindowHeightMm, store.draftWindowSillMm)} /></label>
          <label className={labelClass}>Height (mm)<input className={fieldClass} type="number" value={store.draftWindowHeightMm} onChange={(event) => store.setDraftWindowSize(store.draftWindowWidthMm, Number(event.target.value), store.draftWindowSillMm)} /></label>
          <label className={`${labelClass} col-span-2`}>Sill height (mm)<input className={fieldClass} type="number" value={store.draftWindowSillMm} onChange={(event) => store.setDraftWindowSize(store.draftWindowWidthMm, store.draftWindowHeightMm, Number(event.target.value))} /></label>
        </div>
      )}

      {(tool === "floor" || tool === "roof") && (
        <label className={labelClass}>Thickness (mm)<input className={fieldClass} type="number" min={20} value={store.draftSlabThicknessMm} onChange={(event) => store.setDraftSlabThicknessMm(Number(event.target.value))} /></label>
      )}

      {tool === "duct" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Shape
            <select className={fieldClass} value={store.draftDuctShape} onChange={(e) => store.setDraftDuctShape(e.target.value as any)}>
              <option value="rectangular">Rectangular</option>
              <option value="round">Round</option>
            </select>
          </label>
          <label className={labelClass}>System
            <select className={fieldClass} value={store.draftDuctSystem} onChange={(e) => store.setDraftDuctSystem(e.target.value as any)}>
              <option value="supply">Supply Air</option>
              <option value="return">Return Air</option>
              <option value="exhaust">Exhaust Air</option>
            </select>
          </label>
          {store.draftDuctShape === "rectangular" ? (
            <>
              <label className={labelClass}>Width (mm)<input className={fieldClass} type="number" min={50} value={store.draftDuctWidthMm} onChange={(e) => store.setDraftDuctWidthMm(Number(e.target.value))} /></label>
              <label className={labelClass}>Height (mm)<input className={fieldClass} type="number" min={50} value={store.draftDuctHeightMm} onChange={(e) => store.setDraftDuctHeightMm(Number(e.target.value))} /></label>
            </>
          ) : (
            <label className={`${labelClass} col-span-2`}>Diameter (mm)<input className={fieldClass} type="number" min={50} value={store.draftDuctDiameterMm} onChange={(e) => store.setDraftDuctDiameterMm(Number(e.target.value))} /></label>
          )}
          <label className={`${labelClass} col-span-2`}>Elevation offset (mm)<input className={fieldClass} type="number" value={store.draftDuctElevationMm} onChange={(e) => store.setDraftDuctElevationMm(Number(e.target.value))} /></label>
        </div>
      )}

      {tool === "pipe" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Diameter (mm)<input className={fieldClass} type="number" min={10} value={store.draftPipeDiameterMm} onChange={(e) => store.setDraftPipeDiameterMm(Number(e.target.value))} /></label>
          <label className={labelClass}>System
            <select className={fieldClass} value={store.draftPipeSystem} onChange={(e) => store.setDraftPipeSystem(e.target.value as any)}>
              <option value="domestic_cold">Cold Water</option>
              <option value="domestic_hot">Hot Water</option>
              <option value="sanitary_waste">Sanitary Waste</option>
              <option value="gas">Gas</option>
            </select>
          </label>
          <label className={`${labelClass} col-span-2`}>Elevation offset (mm)<input className={fieldClass} type="number" value={store.draftPipeElevationMm} onChange={(e) => store.setDraftPipeElevationMm(Number(e.target.value))} /></label>
        </div>
      )}

      {tool === "cabletray" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>Width (mm)<input className={fieldClass} type="number" min={50} value={store.draftCableTrayWidthMm} onChange={(e) => store.setDraftCableTrayWidthMm(Number(e.target.value))} /></label>
          <label className={labelClass}>Height (mm)<input className={fieldClass} type="number" min={25} value={store.draftCableTrayHeightMm} onChange={(e) => store.setDraftCableTrayHeightMm(Number(e.target.value))} /></label>
          <label className={`${labelClass} col-span-2`}>Elevation offset (mm)<input className={fieldClass} type="number" value={store.draftCableTrayElevationMm} onChange={(e) => store.setDraftCableTrayElevationMm(Number(e.target.value))} /></label>
        </div>
      )}

      {tool === "lines" && <DraftSketchLineProperties />}

    </div>
  );
}

function DraftSketchLineProperties() {
  const store = useLayoutDrawingStore();
  const totalLength = store.sketchLines.reduce((sum, line) => sum + Math.hypot(line.endXmm - line.startXmm, line.endYmm - line.startYmm), 0);
  return <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Current length</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(store.sketchDraw?.lengthMm ?? 0)} mm</strong></div><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Angle</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(store.sketchDraw?.angleDeg ?? 0)}°</strong></div><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Segments</span><strong className="font-mono text-xs text-[var(--text-strong)]">{store.sketchLines.length}</strong></div><div className="rounded-lg border border-[var(--panel-divider)] p-2"><span className="block text-[9px] text-[var(--text-muted)]">Total length</span><strong className="font-mono text-xs text-[var(--text-strong)]">{Math.round(totalLength)} mm</strong></div></div>{!store.sketchTargetKind && <SketchLineStyleEditor />}{store.sketchTargetKind && <p className="rounded-lg bg-yellow-500/10 p-2 text-[10px] font-semibold text-yellow-600">Yellow boundary mode · draw one closed outer loop and optional closed inner loops for openings.</p>}<div className="grid grid-cols-2 gap-1.5"><button type="button" className="btn-v-yellow min-h-9 rounded-lg px-2 text-[10px]" onClick={() => void store.convertSketchToSlab(store.sketchTargetKind ?? "floor")}>Create {store.sketchTargetKind ?? "floor"}</button>{!store.sketchTargetKind && <button type="button" className="btn-v-yellow min-h-9 rounded-lg px-2 text-[10px]" onClick={() => void store.convertSketchToSlab("roof")}>Create roof</button>}{store.sketchDraw && <button type="button" className="btn-yellow-border-hover min-h-9 rounded-lg border border-[var(--panel-divider)] px-2 text-[10px]" onClick={store.finishSketchLineDraw}>Finish</button>}<button type="button" className="btn-yellow-border-hover min-h-9 rounded-lg border border-[var(--panel-divider)] px-2 text-[10px]" onClick={store.clearSketchLines}>Clear</button></div></div>;
}

function SketchLineStyleEditor({ lineId }: { lineId?: string }) {
  const store = useLayoutDrawingStore();
  const line = lineId ? store.sketchLines.find((item) => item.id === lineId) : null;
  const style = line ?? store.draftSketchLineStyle;
  const update = (patch: Parameters<typeof store.setDraftSketchLineStyle>[0]) => lineId ? store.updateSketchLine(lineId, patch) : store.setDraftSketchLineStyle(patch);
  return <div className="space-y-2 rounded-lg border border-[var(--panel-divider)] p-2"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Line style</p><div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-semibold text-[var(--text-muted)]">Pattern<select className="mt-1 h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px]" value={style.pattern ?? "solid"} onChange={(e) => update({ pattern: e.target.value as NonNullable<typeof style.pattern> })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="dash-dot">Dash dot</option></select></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Thickness<input className="mt-1 h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px]" type="number" min={1} max={8} value={style.thicknessPx ?? 1} onChange={(e) => update({ thicknessPx: Number(e.target.value) })}/></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Dash (mm)<input className="mt-1 h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px]" type="number" min={20} value={style.dashSizeMm ?? 250} onChange={(e) => update({ dashSizeMm: Number(e.target.value) })}/></label><label className="text-[9px] font-semibold text-[var(--text-muted)]">Gap (mm)<input className="mt-1 h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px]" type="number" min={20} value={style.gapSizeMm ?? 140} onChange={(e) => update({ gapSizeMm: Number(e.target.value) })}/></label><label className="col-span-2 text-[9px] font-semibold text-[var(--text-muted)]">Color<input className="mt-1 h-8 w-full rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] p-1" type="color" value={style.color ?? "#374151"} onChange={(e) => update({ color: e.target.value })}/></label></div></div>;
}

function RoofEdgeSlopeEditor({ slab }: { slab: LayoutSlab }) {
  const store = useLayoutDrawingStore();
  const count = slab.boundary?.length ?? 4;
  const slopes = Array.from({ length: count }, (_, edgeIdx) => slab.edgeSlopes?.find((edge) => edge.edgeIdx === edgeIdx) ?? { edgeIdx, isSloped: true, pitchDeg: 30 });
  const update = (edgeIdx: number, patch: Partial<(typeof slopes)[number]>) => void store.updateSlab(slab.id, { edgeSlopes: slopes.map((edge) => edge.edgeIdx === edgeIdx ? { ...edge, ...patch } : edge) });
  return <PropSection open onToggle={() => {}} icon={<LuSlidersHorizontal className="h-3.5 w-3.5 text-yellow-400"/>} label="Roof Edge Slopes"><div className="space-y-1.5">{slopes.map((edge) => <div key={edge.edgeIdx} className="grid grid-cols-[1fr_auto_4.5rem] items-center gap-2 rounded-md border border-[var(--panel-divider)] p-1.5"><span className="text-[10px] font-semibold">Edge {edge.edgeIdx + 1}</span><label className="flex items-center gap-1 text-[9px]"><input type="checkbox" checked={edge.isSloped} onChange={(e) => update(edge.edgeIdx, { isSloped: e.target.checked })}/>Slope</label><input aria-label={`Edge ${edge.edgeIdx + 1} pitch`} disabled={!edge.isSloped} className="h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1 text-right text-[10px]" type="number" min={0} max={89} value={edge.pitchDeg} onChange={(e) => update(edge.edgeIdx, { pitchDeg: Number(e.target.value) })}/></div>)}</div></PropSection>;
}
