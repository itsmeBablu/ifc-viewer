"use client";
import gsap from "gsap";
import React, { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LuChevronDown,
  LuFolderOpen,
  LuSave,
  LuUndo2,
  LuRedo2,
  LuRuler,
  LuSun,
  LuMoon,
  LuMaximize,
  LuMinimize,
  LuSlidersHorizontal,
  LuLayers,
  LuRotate3D,
  LuMove,
  LuScaling,
  LuCopy,
  LuTrash2,
  LuArrowLeftRight,
  LuRotateCw,
  LuTable,
  LuFileSpreadsheet,
  LuLayoutGrid,
  LuPrinter,
  LuEllipsis,
  LuX,
  LuCornerUpLeft,
  LuAlignCenter,
  LuCrosshair,
  LuMinus,
  LuArrowRight,
  LuCheck,
  LuPencil,
  LuScissors,
  LuFilter,
  LuZap,
  LuWaves,
  LuFan,
  LuFlame,
  LuDroplets,
  LuSettings,
  LuActivity,
  LuShieldAlert,
  LuLock,
  LuLockOpen,
} from "react-icons/lu";
import {
  MdZoomInMap,
  MdOutlineFlip,
} from "react-icons/md";
import {
  IoHomeOutline,
} from "react-icons/io5";
import {
  IconMarkupWall,
  IconMarkupDoor,
  IconMarkupWindow,
  IconMarkupFloor,
  IconMarkupRoof,
  IconMarkupCube,
  IconMarkupSphere,
  IconMarkupCylinder,
  IconMarkupCone,
  IconMarkupTorus,
  IconMarkupCapsule,
  IconMarkupPyramid,
  IconMarkupNote,
} from "./MarkupIcons";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { UnifiedButton } from "@/components/common/UnifiedButton";
import { undoWerkzeug, redoWerkzeug } from "@/lib/werkzeugHistory";
import StudioSettingsDropdown from "./StudioSettingsDropdown";
import StudioSettingsModal from "./StudioSettingsModal";
import { useStudioSettingsStore } from "@/store/useStudioSettingsStore";
import {
  buildFragBlob,
  buildMarkupOnlyIfc,
  downloadBlob,
  getCachedIfcBytes,
  mergeMarkupIntoIfc,
} from "@/lib/markupFragSave";
import type { MarkupShapeType, MarkupViewPreset } from "@/lib/toolMarkup";
import type { LayoutToolId } from "@/lib/layoutDrawing";
import type { RenderMode } from "@/lib/types";
import type { WerkzeugViewer3DHandle } from "./WerkzeugViewer3D";

// Primary tabs plus MEP and contextual modify
export type RibbonTab = "vstudio" | "mep" | "manage" | "modify";

interface ToolRibbonProps {
  viewerRef: RefObject<WerkzeugViewer3DHandle | null>;
  onFile: (file: File) => void;
  isLoadingModel: boolean;
  onOpenRoomSchedule?: () => void;
  onOpenSheet?: () => void;
}

// --- Cluster wrapper helpers ---------------------------------------------------

function Cluster({
  label,
  children,
  border = true,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${border ? "border-r border-[var(--panel-divider)]/60 pr-1.5" : ""}`}
    >
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-[.08em] select-none leading-none">
        {label}
      </span>
    </div>
  );
}

function MepToolDropdown({
  label,
  title,
  open,
  active,
  icon,
  onToggle,
  children,
}: {
  label: string;
  title: string;
  open: boolean;
  active: boolean;
  icon: React.ReactNode;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Cluster label={label}>
      <div className="relative">
        <RibbonBtn active={active || open} onClick={onToggle} title={title}>
          {icon}
          <LuChevronDown className={`ml-0.5 h-2.5 w-2.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
        </RibbonBtn>
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 grid min-w-[148px] grid-cols-1 gap-1 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-2xl animate-in fade-in zoom-in-95">
            {children}
          </div>
        )}
      </div>
    </Cluster>
  );
}

function RibbonBtn({
  active,
  onClick,
  title,
  label,
  children,
  danger,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  label?: string;
  children: React.ReactNode;
  danger?: boolean;
  large?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);

  const displayLabel = label;

  const animateIn = () => {
    if (active) return;
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0.18)" : "rgba(250, 204, 21, 0.16)",
        borderColor: mepModeActive ? "rgba(56, 189, 248, 0.45)" : "rgba(250, 204, 21, 0.4)",
        boxShadow: mepModeActive ? "0 0 14px rgba(56, 189, 248, 0.28)" : "0 0 12px rgba(250, 204, 21, 0.22)",
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (labelRef.current && displayLabel) {
      gsap.to(labelRef.current, {
        maxWidth: 80,
        opacity: 1,
        marginLeft: 4,
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  const animateOut = () => {
    if (active) return;
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        backgroundColor: "transparent",
        borderColor: "transparent",
        boxShadow: "none",
        duration: 0.2,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    }
    if (labelRef.current) {
      gsap.to(labelRef.current, {
        maxWidth: 0,
        opacity: 0,
        marginLeft: 0,
        duration: 0.2,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    }
  };

  useEffect(() => {
    if (active && btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 0.92, backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0)" : "rgba(250, 204, 21, 0)" },
        {
          scale: 1,
          backgroundColor: mepModeActive ? "#38bdf8" : "#facc15",
          borderColor: mepModeActive ? "#7dd3fc" : "#fde047",
          duration: 0.35,
          ease: "elastic.out(1, 0.5)",
          overwrite: "auto",
        },
      );
    } else if (btnRef.current) {
      gsap.to(btnRef.current, {
        scale: 1,
        backgroundColor: "transparent",
        borderColor: "transparent",
        duration: 0.2,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, [active, mepModeActive]);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      animateIn();
    }, 350);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      title={title}
      onPointerEnter={animateIn}
      onPointerLeave={animateOut}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative overflow-hidden flex items-center justify-center rounded-md border border-transparent transition-all cursor-pointer min-w-[30px] min-h-[26px] px-1.5 py-0.5 ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : active
          ? mepModeActive
            ? "text-[#082f49] font-bold shadow-md shadow-sky-400/25 btn-v-blue"
            : "text-slate-950 font-bold shadow-md shadow-yellow-400/20 btn-v-yellow"
          : mepModeActive
          ? "text-[var(--text-body)] hover:text-sky-400"
          : "text-[var(--text-body)] hover:text-yellow-400"
      }`}
    >
      {children}
      {displayLabel && (
        <span
          ref={labelRef}
          className="overflow-hidden whitespace-nowrap text-[9px] font-semibold text-[var(--text-strong)] opacity-0 max-w-0 pointer-events-none"
        >
          {displayLabel}
        </span>
      )}
    </button>
  );
}

function ToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg p-1 min-w-[38px] border transition-all ${
        active
          ? mepModeActive
            ? "btn-v-blue btn-liquid-hover !text-slate-950 font-bold shadow-sm"
            : "btn-v-yellow btn-liquid-hover !text-zinc-950 font-bold shadow-sm"
          : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
      }`}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === "span") return null;
        return child;
      })}
    </button>
  );
}

export default function ToolRibbon({
  viewerRef,
  onFile,
  isLoadingModel,
  onOpenRoomSchedule,
  onOpenSheet,
}: ToolRibbonProps) {
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  const colorTheme = useAppStore((s) => s.colorTheme);
  const setColorTheme = useAppStore((s) => s.setColorTheme);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);
  const currentFloor = floors.find((f) => f.id === selectedFloor);

  const viewPreset = useToolMarkupStore((s) => s.viewPreset);
  const getViewTitle = () => {
    if (viewPreset === "top") {
      return currentFloor ? `Floor Plan: ${currentFloor.name}` : "Top (Plan)";
    }
    if (viewPreset === "north") return "Elevation: North";
    if (viewPreset === "south") return "Elevation: South";
    if (viewPreset === "east") return "Elevation: East";
    if (viewPreset === "west") return "Elevation: West";
    if (viewPreset === "free" || !viewPreset) {
      return currentFloor ? `3D View (${currentFloor.name})` : "3D View";
    }
    return "3D View";
  };

  const isDark = colorTheme === "dark";
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  // Layout Store
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const sketchTargetKind = useLayoutDrawingStore((s) => s.sketchTargetKind);
  const setArmedLayoutTool = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const deleteStair = useLayoutDrawingStore((s) => s.deleteStair);
  const deleteRamp = useLayoutDrawingStore((s) => s.deleteRamp);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const duplicateStair = useLayoutDrawingStore((s) => s.duplicateStair);
  const duplicateRamp = useLayoutDrawingStore((s) => s.duplicateRamp);
  const selectWall = useLayoutDrawingStore((s) => s.selectWall);
  const selectDoor = useLayoutDrawingStore((s) => s.selectDoor);
  const selectWindow = useLayoutDrawingStore((s) => s.selectWindow);
  const selectSlab = useLayoutDrawingStore((s) => s.selectSlab);
  const selectStair = useLayoutDrawingStore((s) => s.selectStair);
  const selectRamp = useLayoutDrawingStore((s) => s.selectRamp);

  // Markup Store
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const measurements = useToolMarkupStore((s) => s.measurements);
  const clearMeasurements = useToolMarkupStore((s) => s.clearMeasurements);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectPlacement = useToolMarkupStore((s) => s.selectPlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const duplicatePlacement = useToolMarkupStore((s) => s.duplicatePlacement);

  const sketchLines = useLayoutDrawingStore((s) => s.sketchLines);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectMultiple = useLayoutDrawingStore((s) => s.selectMultiple);
  const copySelected = useLayoutDrawingStore((s) => s.copySelected);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const gridLines = useLayoutDrawingStore((s) => s.gridLines);
  const stairs = useLayoutDrawingStore((s) => s.stairs);
  const ramps = useLayoutDrawingStore((s) => s.ramps);
  const gapHighlightPoints = useLayoutDrawingStore((s) => s.gapHighlightPoints);
  const convertSketchToSlab = useLayoutDrawingStore((s) => s.convertSketchToSlab);
  const clearSketchLines = useLayoutDrawingStore((s) => s.clearSketchLines);
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const setMepModeActive = useLayoutDrawingStore((s) => s.setMepModeActive);
  const mepArchitectureLocked = useLayoutDrawingStore((s) => s.mepArchitectureLocked);
  const setMepArchitectureLocked = useLayoutDrawingStore((s) => s.setMepArchitectureLocked);
  const setDraftDuctShape = useLayoutDrawingStore((s) => s.setDraftDuctShape);
  const setDraftPipeSystem = useLayoutDrawingStore((s) => s.setDraftPipeSystem);
  const setDraftCableTrayType = useLayoutDrawingStore((s) => s.setDraftCableTrayType);
  const setDraftEquipmentCategory = useLayoutDrawingStore((s) => s.setDraftEquipmentCategory);
  const draftDuctShape = useLayoutDrawingStore((s) => s.draftDuctShape);
  const draftPipeSystem = useLayoutDrawingStore((s) => s.draftPipeSystem);
  const draftEquipmentCategory = useLayoutDrawingStore((s) => s.draftEquipmentCategory);
  const [sketchError, setSketchError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<RibbonTab>(mepModeActive ? "mep" : "vstudio");
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [previousTab, setPreviousTab] = useState<RibbonTab>("vstudio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<
    | "build"
    | "shapes"
    | "rooms"
    | "annotate"
    | "snaps"
    | "mep-hvac"
    | "mep-piping"
    | "mep-electrical"
    | "mep-model"
    | "mep-analysis"
    | null
  >(null);
  const [selectionFilterOpen, setSelectionFilterOpen] = useState(false);
  const [copyToLevelOpen, setCopyToLevelOpen] = useState(false);

  useEffect(() => {
    if (mepModeActive && activeTab !== "mep" && activeTab !== "modify") {
      setActiveTab("mep");
    }
  }, [mepModeActive, activeTab]);

  useEffect(() => {
    document.body.classList.toggle("mep-mode-active", Boolean(mepModeActive || activeTab === "mep"));
    return () => document.body.classList.remove("mep-mode-active");
  }, [mepModeActive, activeTab]);

  useEffect(() => {
    const dismiss = () => {
      setSaveMenuOpen(false);
      setOverflowOpen(false);
      setActiveDropdown(null);
      setSelectionFilterOpen(false);
      setCopyToLevelOpen(false);
    };
    window.addEventListener("werkzeug-dismiss-popovers", dismiss);
    return () => window.removeEventListener("werkzeug-dismiss-popovers", dismiss);
  }, []);

  // Draggable Ribbon State
  const [ribbonPos, setRibbonPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleRibbonPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, .no-drag")) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - ribbonPos.x,
      y: e.clientY - ribbonPos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleRibbonPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setRibbonPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };
  const handleRibbonPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!activeDropdown) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("ribbon-dropdown-container");
      if (el && !el.contains(e.target as Node)) setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeDropdown]);
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchMode(window.innerWidth < 1024 || ('ontouchstart' in window));
    };
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ribbonContentRef = useRef<HTMLDivElement>(null);

  // Determine what is currently selected for contextual Modify tab
  const isSketching = Boolean(armedLayoutTool === "lines" || sketchLines.length > 0);
  const hasSelection = Boolean(
    selectedElements.length || selectedPlacementId || isSketching
  );

  const contextualModifyTitle = selectedWallId
    ? "Modify | Walls"
    : selectedDoorId
    ? "Modify | Doors"
    : selectedWindowId
    ? "Modify | Windows"
    : selectedSlabId
    ? "Modify | Floors"
    : selectedStairId
    ? "Modify | Stairs"
    : selectedRampId
    ? "Modify | Ramps"
    : selectedElements.length > 1
    ? `Modify | ${selectedElements.length} Elements`
    : selectedPlacementId
    ? "Modify | 3D Shapes"
    : isSketching
    ? `Sketch (${sketchLines.length} ${sketchLines.length === 1 ? "Line" : "Lines"})`
    : null;

  const selectionCategories = [
    { kind: "wall" as const, label: "Walls", ids: walls.map((item) => item.id) },
    { kind: "door" as const, label: "Doors", ids: doors.map((item) => item.id) },
    { kind: "window" as const, label: "Windows", ids: windows.map((item) => item.id) },
    { kind: "slab" as const, label: "Floors / Roofs", ids: slabs.map((item) => item.id) },
    { kind: "stair" as const, label: "Stairs", ids: stairs.map((item) => item.id) },
    { kind: "ramp" as const, label: "Ramps", ids: ramps.map((item) => item.id) },
    { kind: "column" as const, label: "Columns", ids: columns.map((item) => item.id) },
    { kind: "beam" as const, label: "Beams", ids: beams.map((item) => item.id) },
    { kind: "grid" as const, label: "Grids", ids: gridLines.map((item) => item.id) },
    { kind: "line" as const, label: "Lines", ids: sketchLines.map((item) => item.id) },
  ].filter((category) => category.ids.length > 0);

  // Auto switch to contextual Modify tab when selection occurs
  useEffect(() => {
    if (hasSelection) {
      if (activeTab !== "modify") {
        setPreviousTab(activeTab);
        setActiveTab("modify");
      }
    } else {
      if (activeTab === "modify") {
        setActiveTab(previousTab || "vstudio");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection]);

  const handleSelectLayoutTool = (id: LayoutToolId) => {
    setArmedTool(null);
    const active = armedLayoutTool === id || ((id === "floor" || id === "roof") && sketchTargetKind === id);
    setArmedLayoutTool(active ? null : id);
    setActiveDropdown(null);
  };

  const handleSelectMepTool = (id: LayoutToolId) => {
    setArmedTool(null);
    setArmedLayoutTool(id);
    setActiveDropdown(null);
  };

  const handleSelectShape = (shape: MarkupShapeType) => {
    setArmedLayoutTool(null);
    setArmedTool(armedTool === shape ? null : shape);
  };

  const handleSaveFrag = async () => {
    setSaveMenuOpen(false);
    try {
      const placements = useToolMarkupStore.getState().placements;
      const notes = useToolMarkupStore.getState().notes;
      const key = activeModelLabel || "model";
      const blob = await buildFragBlob({
        modelKey: key,
        modelLabel: activeModelLabel,
        placements,
        notes,
        ifcBytes: getCachedIfcBytes(key),
      });
      downloadBlob(blob, `${activeModelLabel || "vstudio-model"}.frag`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveIfc = async () => {
    setSaveMenuOpen(false);
    try {
      const key = activeModelLabel || "model";
      const cached = getCachedIfcBytes(key);
      const placements = useToolMarkupStore.getState().placements;
      const notes = useToolMarkupStore.getState().notes;
      const blob = cached
        ? mergeMarkupIntoIfc({ baseIfc: cached, placements, notes })
        : buildMarkupOnlyIfc({ modelLabel: activeModelLabel, placements, notes });
      downloadBlob(blob, `${activeModelLabel || "model"}-markup.ifc`);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const clearCurrentSelection = () => {
    selectWall(null);
    selectDoor(null);
    selectWindow(null);
    selectSlab(null);
    selectStair(null);
    selectRamp(null);
    selectPlacement(null);
  };

  // Close overflow on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ribbonContentRef.current && !ribbonContentRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
      
      const target = e.target as HTMLElement;
      if (!target.closest('.save-menu-container')) {
        setSaveMenuOpen(false);
      }
      if (!target.closest('.settings-menu-container')) {
        setSettingsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [overflowOpen]);

  // -- V Studio tab content clusters ------------------------------------------
  const buildCluster = (
    <Cluster label="Build">
      <div className="relative">
        <RibbonBtn
          active={["wall", "door", "window", "floor", "roof", "stair", "ramp", "lines"].includes(armedLayoutTool || "")}
          onClick={() => setActiveDropdown(activeDropdown === "build" ? null : "build")}
          title="Build Elements (Walls, Doors, Windows, Stairs, Ramps, Slabs, Lines)"
        >
          <IconMarkupWall className="h-4.5 w-4.5" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "build" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-36 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("wall"); setActiveDropdown(null); }}>
              <IconMarkupWall className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Wall (W)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("door"); setActiveDropdown(null); }}>
              <IconMarkupDoor className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Door (D)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("window"); setActiveDropdown(null); }}>
              <IconMarkupWindow className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Window</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("stair"); setActiveDropdown(null); }}>
              <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">🪜</span> <span className="text-xs">Stairs (ST)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("ramp"); setActiveDropdown(null); }}>
              <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">⊿</span> <span className="text-xs">Ramp (RP)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("floor"); setActiveDropdown(null); }}>
              <IconMarkupFloor className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Floor</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("roof"); setActiveDropdown(null); }}>
              <IconMarkupRoof className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Roof</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("column"); setActiveDropdown(null); }}>
              <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">▮</span> <span className="text-xs">Column (CL)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("beam"); setActiveDropdown(null); }}>
              <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">▬</span> <span className="text-xs">Beam (BM)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("grid"); setActiveDropdown(null); }}>
              <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">⊞</span> <span className="text-xs">Grid (GR)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("lines"); setActiveDropdown(null); }}>
              <LuPencil className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Lines (L)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("trim"); setActiveDropdown(null); }}>
              <LuScissors className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Trim / Extend (TR)</span>
            </button>
          </div>
        )}
      </div>
    </Cluster>
  );

  const roomsCluster = (
    <Cluster label="Rooms">
      <div className="relative">
        <RibbonBtn
          onClick={() => setActiveDropdown(activeDropdown === "rooms" ? null : "rooms")}
          title="Rooms & Schedule"
        >
          <LuTable className="h-4.5 w-4.5 text-yellow-400" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "rooms" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-32 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { setArmedLayoutTool(null); setArmedTool(null); onOpenRoomSchedule?.(); setActiveDropdown(null); }}>
              <LuTable className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Room (RM)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { onOpenRoomSchedule?.(); setActiveDropdown(null); }}>
              <LuFileSpreadsheet className="h-4 w-4 text-emerald-400" /> <span className="text-xs">Schedule</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { onOpenSheet?.(); setActiveDropdown(null); }}>
              <LuFileSpreadsheet className="h-4 w-4 text-sky-400" /> <span className="text-xs">Sheet (SH)</span>
            </button>
          </div>
        )}
      </div>
    </Cluster>
  );

  const shapesCluster = (
    <Cluster label="Shapes">
      <div className="relative">
        <RibbonBtn
          active={Boolean(armedTool && ["cube", "cylinder", "sphere", "cone", "torus", "pyramid"].includes(armedTool))}
          onClick={() => setActiveDropdown(activeDropdown === "shapes" ? null : "shapes")}
          title="3D Markup Shapes"
        >
          <IconMarkupCube className="h-4.5 w-4.5" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "shapes" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-32 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            {([
              { id: "cube" as const, label: "Cube", icon: IconMarkupCube },
              { id: "cylinder" as const, label: "Cyl", icon: IconMarkupCylinder },
              { id: "sphere" as const, label: "Sphere", icon: IconMarkupSphere },
              { id: "cone" as const, label: "Cone", icon: IconMarkupCone },
              { id: "torus" as const, label: "Torus", icon: IconMarkupTorus },
              { id: "pyramid" as const, label: "Pyr", icon: IconMarkupPyramid },
            ]).map((item) => (
              <button key={item.id} type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectShape(item.id); setActiveDropdown(null); }}>
                <item.icon className="h-4 w-4 text-[var(--text-muted)]" /> <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Cluster>
  );

  const annotateCluster = (
    <Cluster label="Annotate">
      <div className="relative">
        <RibbonBtn
          active={armedTool === "note"}
          onClick={() => setActiveDropdown(activeDropdown === "annotate" ? null : "annotate")}
          title="Sticky Notes & Dimensions"
        >
          <IconMarkupNote className="h-4.5 w-4.5 text-yellow-400" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "annotate" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-32 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            <button 
              type="button" 
              className={`flex items-center gap-2 p-1.5 rounded-lg text-[var(--text-body)] ${armedTool === "note" ? 'bg-yellow-400/20 text-yellow-400' : 'hover:bg-[var(--glass-inset-bg)]'}`}
              onClick={() => {
                setArmedLayoutTool(null);
                setArmedTool(armedTool === "note" ? null : "note");
                setActiveDropdown(null);
              }}
            >
              <IconMarkupNote className="h-4 w-4" /> <span className="text-xs">Sticky Tag</span>
            </button>
            <button 
              type="button" 
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]"
              onClick={() => {
                setArmedLayoutTool(null);
                setArmedTool(armedTool === "cube" ? null : "cube");
                setActiveDropdown(null);
              }}
            >
              <LuRuler className="h-4 w-4 text-[var(--text-muted)]" /> <span className="text-xs">Measure</span>
            </button>
            {measurements.length > 0 && (
              <button 
                type="button" 
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 mt-1 border-t border-[var(--panel-divider)]/40 pt-2"
                onClick={() => {
                  clearMeasurements();
                  setActiveDropdown(null);
                }}
              >
                <LuTrash2 className="h-4 w-4" /> <span className="text-xs">Clear ({measurements.length})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Cluster>
  );

  // -- Manage tab content -----------------------------------------------------
  const manageTabContent = (
    <div className="flex items-center gap-3">
      <Cluster label="Structure">
        <button
          type="button"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title="Toggle the Project Layout panel to view the IFC tree and properties"
          className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[60px] border transition-all ${
            rightPanelOpen
              ? "border-amber-400 bg-amber-500/20 text-amber-500 font-bold"
              : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-amber-400"
          }`}
        >
          <LuLayers className="h-5 w-5" />
          <span className="text-[10px]">IFC Tree</span>
        </button>
      </Cluster>

      <Cluster label="Export" border={false}>
        <button
          type="button"
          onClick={handleSaveFrag}
          title="Export the model as a lightweight .frag file for fast web loading"
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[55px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-amber-400 transition-all font-semibold"
        >
          <LuSave className="h-4 w-4" />
          <span className="text-[10px]">.frag</span>
        </button>
        <button
          type="button"
          onClick={handleSaveIfc}
          title="Export the model with full BIM data structure as an .ifc file"
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[55px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-amber-400 transition-all font-semibold"
        >
          <LuSave className="h-4 w-4" />
          <span className="text-[10px]">.ifc</span>
        </button>
      </Cluster>
    </div>
  );

  // -- Contextual Modify tab content ------------------------------------------
  const modifyTabContent = hasSelection && (
    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Universal Modify Tools */}
      <Cluster label="Modify Tools">
        <RibbonBtn
          active={rightPanelOpen}
          onClick={() => setRightPanelOpen(true)}
          title="Edit all properties for the selected element"
        >
          <LuSlidersHorizontal className="h-4 w-4 text-amber-500" />
          <span className="text-[9px]">Edit Properties</span>
        </RibbonBtn>
        <div className="relative">
          <RibbonBtn active={selectionFilterOpen} onClick={() => setSelectionFilterOpen((open) => !open)} title="Selection Filter / Select Similar">
            <LuFilter className="h-4 w-4" />
          </RibbonBtn>
          {selectionFilterOpen && (
            <div className="absolute left-0 top-full z-[90] mt-1 w-52 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2 shadow-2xl backdrop-blur-2xl">
              <div className="mb-1.5 flex items-center justify-between border-b border-[var(--panel-divider)] pb-1.5"><span className="text-[10px] font-bold text-[var(--text-strong)]">Selection Filter</span><span className="text-[9px] text-[var(--text-muted)]">{selectedElements.length} selected</span></div>
              <p className="mb-1.5 text-[8px] text-[var(--text-muted)]">Click a category to keep only that type. Click again to select all similar.</p>
              <div className="space-y-0.5">{selectionCategories.map((category) => {
                const selectedCount = selectedElements.filter((item) => item.kind === category.kind).length;
                const allSelected = selectedCount === category.ids.length;
                return <button key={category.kind} type="button" onClick={() => {
                  const selectedInCategory = selectedElements.filter((item) => item.kind === category.kind);
                  if (selectedElements.length > selectedInCategory.length && selectedInCategory.length) {
                    selectMultiple(selectedInCategory, "replace");
                  } else {
                    selectMultiple(allSelected ? [] : category.ids.map((id) => ({ kind: category.kind, id })), "replace");
                  }
                }} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[9px] hover:bg-yellow-400/15"><span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${allSelected ? "border-yellow-400 bg-yellow-400 text-zinc-900" : selectedCount ? "border-yellow-400 text-yellow-500" : "border-[var(--panel-divider)]"}`}>{allSelected ? <LuCheck className="h-2.5 w-2.5"/> : selectedCount ? "–" : ""}</span><span className="flex-1 text-[var(--text-body)]">{category.label}</span><span className="font-mono text-[8px] text-[var(--text-muted)]">{selectedCount}/{category.ids.length}</span></button>;
              })}</div>
            </div>
          )}
        </div>
        {(
          [
            { id: "translate" as const, label: "Move (MV)", icon: LuMove },
            { id: "rotate" as const, label: "Rotate (RO)", icon: LuRotate3D },
            { id: "scale" as const, label: "Scale (RE)", icon: LuScaling },
          ] as const
        ).map((m) => {
          const Icon = m.icon;
          return (
            <RibbonBtn
              key={m.id}
              active={transformMode === m.id}
              onClick={() => setTransformMode(m.id)}
              title={m.label}
            >
              <Icon className="h-4 w-4" />
            </RibbonBtn>
          );
        })}

        <RibbonBtn
          active={armedLayoutTool === "trim"}
          onClick={() => {
            if (armedLayoutTool === "trim") {
              setArmedLayoutTool(null);
            } else {
              handleSelectLayoutTool("trim");
            }
          }}
          title="Trim / Extend to Corner (TR)"
        >
          <LuScissors className="h-4 w-4" />
        </RibbonBtn>

        <div className="relative">
          <RibbonBtn
            active={copyToLevelOpen}
            onClick={() => {
              if (selectedPlacementId) duplicatePlacement(selectedPlacementId);
              else if (selectedElements.length) setCopyToLevelOpen((open) => !open);
              else if (selectedWallId) duplicateWall(selectedWallId);
            }}
            title="Copy / Paste Aligned to Level"
          >
            <LuCopy className="h-4 w-4" />
          </RibbonBtn>
          {copyToLevelOpen && (
            <div className="absolute left-0 top-full z-[90] mt-1 w-48 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2 shadow-2xl backdrop-blur-2xl">
              <div className="mb-1.5 border-b border-[var(--panel-divider)] pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Paste aligned to level</div>
              <div className="max-h-48 space-y-1 overflow-y-auto thin-scroll">
                {levels.map((level) => (
                  <button key={level.id} type="button" className="dock-menu-row" onClick={() => { void copySelected(0, 0, level.id); setCopyToLevelOpen(false); }}>
                    <LuLayers className="h-3.5 w-3.5" />
                    <span><strong>{level.name}</strong><small>{level.elevationMm} mm · keep XY position</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <RibbonBtn
          danger
          onClick={() => {
            if (selectedWallId) deleteWall(selectedWallId);
            if (selectedDoorId) deleteDoor(selectedDoorId);
            if (selectedWindowId) deleteWindow(selectedWindowId);
            if (selectedSlabId) deleteSlab(selectedSlabId);
            if (selectedPlacementId) deletePlacement(selectedPlacementId);
          }}
          title="Delete element (DE)"
        >
          <LuTrash2 className="h-4 w-4" />
        </RibbonBtn>
      </Cluster>

      {/* Category-specific controls */}
      {isSketching && !selectedWallId && !selectedDoorId && !selectedWindowId && !selectedSlabId && !selectedPlacementId ? (
        <Cluster label="Sketch Loop Actions">
          <div className="flex items-center gap-2 px-2 py-1">
            <LuPencil className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-bold text-[var(--text-strong)]">
              {sketchLines.length} {sketchLines.length === 1 ? "Line" : "Lines"}
            </span>
          </div>

          <RibbonBtn
            active
            onClick={async () => {
              const target = sketchTargetKind || "floor";
              const res = await convertSketchToSlab(target);
              if (!res.success && res.error) {
                setSketchError(res.error);
              } else {
                setSketchError(null);
              }
            }}
            title="Finish Boundary Sketch (✓)"
          >
            <LuCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-500">Finish (✓)</span>
          </RibbonBtn>

          <RibbonBtn
            danger
            onClick={() => {
              useLayoutDrawingStore.getState().cancelSlabBoundaryEdit();
              setSketchError(null);
            }}
            title="Cancel Boundary Sketch (✕)"
          >
            <LuX className="h-4 w-4 text-rose-500" />
            <span className="text-[9px] font-bold text-rose-500">Cancel (✕)</span>
          </RibbonBtn>

          <RibbonBtn
            onClick={async () => {
              const res = await convertSketchToSlab("floor");
              if (!res.success && res.error) {
                setSketchError(res.error);
              } else {
                setSketchError(null);
              }
            }}
            title="Convert sketch loop into Floor slab"
          >
            <IconMarkupFloor className="h-4 w-4" />
            <span className="text-[9px]">To Floor</span>
          </RibbonBtn>

          <RibbonBtn
            onClick={async () => {
              const res = await convertSketchToSlab("roof");
              if (!res.success && res.error) {
                setSketchError(res.error);
              } else {
                setSketchError(null);
              }
            }}
            title="Convert sketch loop into Roof slab"
          >
            <IconMarkupRoof className="h-4 w-4" />
            <span className="text-[9px]">To Roof</span>
          </RibbonBtn>

          <RibbonBtn
            danger
            onClick={() => {
              clearSketchLines();
              setSketchError(null);
            }}
            title="Clear all drawn sketch lines"
          >
            <LuTrash2 className="h-4 w-4" />
            <span className="text-[9px]">Clear</span>
          </RibbonBtn>

          {(sketchError || gapHighlightPoints.length > 0) && (
            <div className="flex flex-col justify-center gap-0.5 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 max-w-xs">
              {sketchError && (
                <span className="text-[10px] font-semibold text-rose-400 leading-tight">
                  {sketchError}
                </span>
              )}
              {gapHighlightPoints.length > 0 && (
                <span className="text-[9.5px] font-semibold text-amber-400 leading-tight">
                  ✦ {gapHighlightPoints.length} gap {gapHighlightPoints.length === 1 ? "point" : "points"}
                </span>
              )}
            </div>
          )}
        </Cluster>
      ) : (
        <Cluster label="Element Controls">
          {selectedWallId && (
            <RibbonBtn
              onClick={() => {
                const wall = useLayoutDrawingStore.getState().walls.find((w) => w.id === selectedWallId);
                if (wall) {
                  useLayoutDrawingStore.getState().updateWall(wall.id, {
                    startXmm: wall.endXmm,
                    startYmm: wall.endYmm,
                    endXmm: wall.startXmm,
                    endYmm: wall.startYmm,
                  });
                }
              }}
              title="Flip wall direction (Spacebar)"
            >
              <MdOutlineFlip className="h-4 w-4 text-amber-500" />
              <span className="text-[9px]">Flip Wall</span>
            </RibbonBtn>
          )}

          {selectedDoorId && (
            <>
              <RibbonBtn
                onClick={() => {
                  const door = useLayoutDrawingStore.getState().doors.find((d) => d.id === selectedDoorId);
                  if (door) {
                    useLayoutDrawingStore.getState().updateDoor(door.id, {
                      hinge: door.hinge === "start" ? "end" : "start",
                    });
                  }
                }}
                title="Flip hinge hand"
              >
                <LuArrowLeftRight className="h-4 w-4 text-amber-500" />
                <span className="text-[9px]">Flip Hand</span>
              </RibbonBtn>
              <RibbonBtn
                onClick={() => {
                  const door = useLayoutDrawingStore.getState().doors.find((d) => d.id === selectedDoorId);
                  if (door) {
                    useLayoutDrawingStore.getState().updateDoor(door.id, {
                      swing: door.swing === 1 ? -1 : 1,
                    });
                  }
                }}
                title="Flip swing direction"
              >
                <LuRotateCw className="h-4 w-4 text-amber-500" />
                <span className="text-[9px]">Flip Swing</span>
              </RibbonBtn>
            </>
          )}

          {selectedWindowId && (
            <RibbonBtn
              onClick={() => {
                const win = useLayoutDrawingStore.getState().windows.find((w) => w.id === selectedWindowId);
                if (win) {
                  useLayoutDrawingStore.getState().updateWindow(win.id, { positionMm: win.positionMm });
                }
              }}
              title="Flip window"
            >
              <LuArrowLeftRight className="h-4 w-4 text-amber-500" />
              <span className="text-[9px]">Flip Window</span>
            </RibbonBtn>
          )}

          {selectedSlabId && (
            <>
              <RibbonBtn
                onClick={() => {
                  useLayoutDrawingStore.getState().beginSlabBoundaryEdit(selectedSlabId);
                }}
                title="Edit Slab Boundary (Grenzen bearbeiten)"
              >
                <LuPencil className="h-4 w-4 text-amber-500" />
                <span className="text-[9px]">Edit Boundary</span>
              </RibbonBtn>
              <RibbonBtn
                onClick={() => {
                  const slab = useLayoutDrawingStore.getState().slabs.find((s) => s.id === selectedSlabId);
                  if (slab) {
                    void useLayoutDrawingStore.getState().updateSlab(slab.id, {
                      kind: slab.kind === "floor" ? "roof" : "floor",
                    });
                  }
                }}
                title="Toggle Floor / Roof"
              >
                <IconMarkupRoof className="h-4 w-4 text-amber-500" />
                <span className="text-[9px]">Floor/Roof</span>
              </RibbonBtn>
            </>
          )}

          {selectedPlacementId && (
            <RibbonBtn
              onClick={() => duplicatePlacement(selectedPlacementId)}
              title="Duplicate shape"
            >
              <LuCopy className="h-4 w-4 text-amber-500" />
              <span className="text-[9px]">Duplicate</span>
            </RibbonBtn>
          )}
        </Cluster>
      )}
    </div>
  );

  // -- All V Studio clusters in order -----------------------------------------
  const vstudioClusters = [
    { key: "build", node: buildCluster },
    { key: "rooms", node: roomsCluster },
    { key: "shapes", node: shapesCluster },
    { key: "annotate", node: annotateCluster },
  ];

  // -- MEP tab content clusters -----------------------------------------------
  const hvacActive = armedLayoutTool === "duct" || armedLayoutTool === "flex_duct" || armedLayoutTool === "mep_placeholder" ||
    (armedLayoutTool === "equipment" && ["air_terminal", "diffuser_supply", "diffuser_extract"].includes(draftEquipmentCategory));
  const pipingActive = armedLayoutTool === "pipe" ||
    (armedLayoutTool === "equipment" && draftEquipmentCategory === "sprinkler");
  const electricalActive = armedLayoutTool === "cabletray" || armedLayoutTool === "wire" ||
    (armedLayoutTool === "equipment" && ["lighting_fixture", "panel", "socket"].includes(draftEquipmentCategory));
  const modelActive = armedLayoutTool === "workplane" ||
    (armedLayoutTool === "equipment" && draftEquipmentCategory === "generic_component");

  const hvacIcon = armedLayoutTool === "duct"
    ? <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-400">{draftDuctShape === "round" ? "◯" : draftDuctShape === "oval" ? "⬭" : "▭"}</span>
    : armedLayoutTool === "flex_duct"
    ? <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-300">〰</span>
    : armedLayoutTool === "mep_placeholder"
    ? <span className="flex h-4 w-4 items-center justify-center font-bold text-sky-400">⋯</span>
    : <LuFan className="h-4 w-4 text-cyan-400" />;
  const pipingIcon = draftPipeSystem === "hydronic_supply"
    ? <LuFlame className="h-4 w-4 text-rose-500" />
    : <LuDroplets className="h-4 w-4 text-blue-500" />;
  const electricalIcon = armedLayoutTool === "equipment" && draftEquipmentCategory === "lighting_fixture"
    ? <LuSun className="h-4 w-4 text-yellow-300" />
    : <LuZap className="h-4 w-4 text-yellow-400" />;

  const mepHvacCluster = (
    <MepToolDropdown
      label="HVAC / Air"
      title="HVAC and air tools"
      open={activeDropdown === "mep-hvac"}
      active={hvacActive}
      icon={hvacIcon}
      onToggle={() => setActiveDropdown(activeDropdown === "mep-hvac" ? null : "mep-hvac")}
    >
      <RibbonBtn
        active={armedLayoutTool === "duct" && draftDuctShape === "rectangular"}
        onClick={() => {
          setDraftDuctShape("rectangular");
          handleSelectMepTool("duct");
        }}
        title="Rectangular Air Duct"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-400">▭</span>
        <span className="text-[9px]">Rect Duct</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "duct" && draftDuctShape === "round"}
        onClick={() => {
          setDraftDuctShape("round");
          handleSelectMepTool("duct");
        }}
        title="Round Air Duct"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-400">◯</span>
        <span className="text-[9px]">Round Duct</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "duct" && draftDuctShape === "oval"}
        onClick={() => {
          setDraftDuctShape("oval");
          handleSelectMepTool("duct");
        }}
        title="Flat Oval Air Duct"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-400">⬭</span>
        <span className="text-[9px]">Oval Duct</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "flex_duct"}
        onClick={() => {
          handleSelectMepTool("flex_duct");
        }}
        title="Flexible Duct Connection (Flexkanal)"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-300">〰</span>
        <span className="text-[9px]">Flex Duct</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "mep_placeholder"}
        onClick={() => {
          handleSelectMepTool("mep_placeholder");
        }}
        title="Duct / Pipe Route Placeholder (Platzhalter)"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-sky-400">⋯</span>
        <span className="text-[9px]">Placeholder</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "air_terminal"}
        onClick={() => {
          setDraftEquipmentCategory("air_terminal");
          handleSelectMepTool("equipment");
        }}
        title="Air Terminal / Diffuser (Luftdurchlass)"
      >
        <LuFan className="h-4 w-4 text-cyan-400" />
        <span className="text-[9px]">Terminal</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "diffuser_supply"}
        onClick={() => {
          setDraftEquipmentCategory("diffuser_supply");
          handleSelectMepTool("equipment");
        }}
        title="Supply Air Diffuser (Zuluft)"
      >
        <LuFan className="h-4 w-4 text-sky-400" />
        <span className="text-[9px]">Supply</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "diffuser_extract"}
        onClick={() => {
          setDraftEquipmentCategory("diffuser_extract");
          handleSelectMepTool("equipment");
        }}
        title="Extract Air Diffuser (Abluft)"
      >
        <LuFan className="h-4 w-4 text-amber-400" />
        <span className="text-[9px]">Extract</span>
      </RibbonBtn>
    </MepToolDropdown>
  );

  const mepPipingCluster = (
    <MepToolDropdown
      label="Piping & Fire"
      title="Piping and fire protection tools"
      open={activeDropdown === "mep-piping"}
      active={pipingActive}
      icon={pipingIcon}
      onToggle={() => setActiveDropdown(activeDropdown === "mep-piping" ? null : "mep-piping")}
    >
      <RibbonBtn
        active={armedLayoutTool === "pipe" && draftPipeSystem === "hydronic_supply"}
        onClick={() => {
          setDraftPipeSystem("hydronic_supply");
          handleSelectMepTool("pipe");
        }}
        title="Hydronic Heating Supply Pipe (Vorlauf)"
      >
        <LuFlame className="h-4 w-4 text-rose-500" />
        <span className="text-[9px]">Supply</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "pipe" && draftPipeSystem === "hydronic_return"}
        onClick={() => {
          setDraftPipeSystem("hydronic_return");
          handleSelectMepTool("pipe");
        }}
        title="Hydronic Heating Return Pipe (Rücklauf)"
      >
        <LuDroplets className="h-4 w-4 text-blue-500" />
        <span className="text-[9px]">Return</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "pipe" && draftPipeSystem === "domestic_cold"}
        onClick={() => {
          setDraftPipeSystem("domestic_cold");
          handleSelectMepTool("pipe");
        }}
        title="Domestic Cold Water Pipe"
      >
        <LuDroplets className="h-4 w-4 text-sky-400" />
        <span className="text-[9px]">Cold W</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "pipe" && draftPipeSystem === "sanitary_waste"}
        onClick={() => {
          setDraftPipeSystem("sanitary_waste");
          handleSelectMepTool("pipe");
        }}
        title="Sanitary Drainage / Waste Pipe"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-purple-400">⤓</span>
        <span className="text-[9px]">Drain</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "sprinkler"}
        onClick={() => {
          setDraftEquipmentCategory("sprinkler");
          handleSelectMepTool("equipment");
        }}
        title="Fire Suppression Sprinkler Head"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-red-500">🚿</span>
        <span className="text-[9px]">Sprinkler</span>
      </RibbonBtn>
    </MepToolDropdown>
  );

  const mepElectricalCluster = (
    <MepToolDropdown
      label="Electrical"
      title="Electrical tools"
      open={activeDropdown === "mep-electrical"}
      active={electricalActive}
      icon={electricalIcon}
      onToggle={() => setActiveDropdown(activeDropdown === "mep-electrical" ? null : "mep-electrical")}
    >
      <RibbonBtn
        active={armedLayoutTool === "cabletray"}
        onClick={() => {
          setDraftCableTrayType("ladder");
          handleSelectMepTool("cabletray");
        }}
        title="Cable Tray (Kabelpritsche)"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-slate-300">🪜</span>
        <span className="text-[9px]">Tray</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "wire"}
        onClick={() => {
          handleSelectMepTool("wire");
        }}
        title="Electrical Wire / Conductor Run (Leitung)"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-yellow-400">〰</span>
        <span className="text-[9px]">Wire</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "lighting_fixture"}
        onClick={() => {
          setDraftEquipmentCategory("lighting_fixture");
          handleSelectMepTool("equipment");
        }}
        title="Lighting Fixture (Leuchte)"
      >
        <LuSun className="h-4 w-4 text-yellow-300" />
        <span className="text-[9px]">Lighting</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "panel"}
        onClick={() => {
          setDraftEquipmentCategory("panel");
          handleSelectMepTool("equipment");
        }}
        title="Electrical Distribution Panel / Box"
      >
        <LuZap className="h-4 w-4 text-yellow-400" />
        <span className="text-[9px]">Panel</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "socket"}
        onClick={() => {
          setDraftEquipmentCategory("socket");
          handleSelectMepTool("equipment");
        }}
        title="Power Socket / Outlet"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-amber-400">🔌</span>
        <span className="text-[9px]">Socket</span>
      </RibbonBtn>
    </MepToolDropdown>
  );

  const mepModelCluster = (
    <MepToolDropdown
      label="Model & Reference"
      title="Model and reference tools"
      open={activeDropdown === "mep-model"}
      active={modelActive}
      icon={<IconMarkupCube className="h-4 w-4 text-slate-300" />}
      onToggle={() => setActiveDropdown(activeDropdown === "mep-model" ? null : "mep-model")}
    >
      <RibbonBtn
        active={armedLayoutTool === "equipment" && draftEquipmentCategory === "generic_component"}
        onClick={() => {
          setDraftEquipmentCategory("generic_component");
          handleSelectMepTool("equipment");
        }}
        title="Generic MEP Model Component"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-slate-300">📦</span>
        <span className="text-[9px]">Component</span>
      </RibbonBtn>

      <RibbonBtn
        active={armedLayoutTool === "workplane"}
        onClick={() => {
          handleSelectMepTool("workplane");
        }}
        title="Set Reference Work Plane (Festlegen / Arbeitsebene)"
      >
        <span className="flex h-4 w-4 items-center justify-center font-bold text-cyan-400">▱</span>
        <span className="text-[9px]">Work Plane</span>
      </RibbonBtn>
    </MepToolDropdown>
  );

  const mepCalculationsCluster = (
    <MepToolDropdown
      label="Analysis & Sizing"
      title="Analysis and sizing tools"
      open={activeDropdown === "mep-analysis"}
      active={false}
      icon={<LuActivity className="h-4 w-4 text-cyan-400" />}
      onToggle={() => setActiveDropdown(activeDropdown === "mep-analysis" ? null : "mep-analysis")}
    >
      <RibbonBtn
        active={false}
        onClick={() => {
          onOpenRoomSchedule?.();
          setActiveDropdown(null);
        }}
        title="View Room Ventilation Airflows & Heat Loads (DIN 1946-6 / Solar-Computer)"
      >
        <LuActivity className="h-4 w-4 text-cyan-400" />
        <span className="text-[9px]">Airflows</span>
      </RibbonBtn>

      <RibbonBtn
        active={false}
        onClick={() => {
          window.dispatchEvent(new CustomEvent("mep-run-clash-check"));
          setActiveDropdown(null);
        }}
        title="Check MEP Penetrations vs Structural Walls & Columns"
      >
        <LuShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="text-[9px]">Clash Check</span>
      </RibbonBtn>
    </MepToolDropdown>
  );

  const mepClusters = [
    { key: "hvac", node: mepHvacCluster },
    { key: "piping", node: mepPipingCluster },
    { key: "electrical", node: mepElectricalCluster },
    { key: "model", node: mepModelCluster },
    { key: "analysis", node: mepCalculationsCluster },
  ];


  return (
    <>
      {/* -- Quick Access Floating Cluster --------------------------------------- */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-1 liquid-glass-pill px-2 py-1.5 shadow-lg select-none pointer-events-auto">
        {/* V Studio home logo */}
        <Link
          href="/"
          title="Back to Viewer"
          className="flex items-center justify-center rounded-md px-2 py-1 hover:bg-[var(--glass-inset-bg)] transition-colors"
        >
          <Image src="/ibv_logo.svg" alt="IBV" width={100} height={24} className="h-6 w-auto object-contain" priority />
        </Link>

        <div className="h-4 w-px bg-[var(--panel-divider)] mx-1" />

          {/* Open IFC */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc,.frag"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingModel}
            title={t(uiLanguage, "loadNewIfc") || "Open IFC Model"}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors disabled:opacity-40"
          >
            <LuFolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">Open</span>
          </button>

          {/* Save Dropdown */}
          <div className="relative save-menu-container">
            <button
              type="button"
              onClick={() => setSaveMenuOpen(!saveMenuOpen)}
              title="Save .frag / .ifc"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
            >
              <LuSave className="h-3.5 w-3.5 text-yellow-400" />
              <span className="hidden sm:inline text-[11px]">Save</span>
              <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
            </button>

            {saveMenuOpen && (
              isTouchMode ? (
                <div 
                  className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                  onClick={() => setSaveMenuOpen(false)}
                >
                  <div 
                    className="w-full bg-[var(--popover-bg)] border-t border-[var(--panel-divider)] rounded-t-[2rem] p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200 select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-1.5 bg-[var(--text-muted)]/40 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--panel-divider)]">
                      <span className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                        <LuSave className="h-4 w-4 text-yellow-400" />
                        Save Project
                      </span>
                      <button 
                        type="button"
                        onClick={() => setSaveMenuOpen(false)} 
                        className="p-1.5 rounded-full hover:bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                      >
                        <LuX className="h-5 w-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => { handleSaveFrag(); setSaveMenuOpen(false); }}
                      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left border border-[var(--panel-divider)] bg-[var(--surface-overlay)] active:bg-yellow-400/20 active:border-yellow-400 transition-colors"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                        <LuSave className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text-strong)]">Save as .frag</div>
                        <div className="text-xs text-[var(--text-muted)]">Fast lightweight binary geometry package</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { handleSaveIfc(); setSaveMenuOpen(false); }}
                      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left border border-[var(--panel-divider)] bg-[var(--surface-overlay)] active:bg-yellow-400/20 active:border-yellow-400 transition-colors"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                        <LuSave className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text-strong)]">Save as .ifc</div>
                        <div className="text-xs text-[var(--text-muted)]">Full BIM export with IFC schema structures</div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setSaveMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={handleSaveFrag}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
                  >
                    <LuSave className="h-3.5 w-3.5 text-sky-400" />
                    <div>
                      <div className="font-semibold text-[var(--text-strong)]">Save as .frag</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Fast lightweight binary geometry</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveIfc}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
                  >
                    <LuSave className="h-3.5 w-3.5 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-[var(--text-strong)]">Save as .ifc</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Export with IFC structure & geometry</div>
                    </div>
                  </button>
                </div>
              )
            )}
          </div>

          {/* Undo / Redo */}
          <div className="h-4 w-px bg-[var(--panel-divider)]" />
          <button
            type="button"
            onClick={undoWerkzeug}
            title="Undo (Ctrl+Z)"
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuUndo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redoWerkzeug}
            title="Redo (Ctrl+Y)"
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuRedo2 className="h-3.5 w-3.5" />
          </button>

          {/* Studio Settings Dropdown Trigger */}
          <div className="h-4 w-px bg-[var(--panel-divider)]" />
          <div className="relative settings-menu-container">
            <button
              type="button"
              onClick={() => setSettingsDropdownOpen((v) => !v)}
              title="Studio & Workspace Settings"
              className={`rounded-md p-1.5 transition-colors ${
                settingsDropdownOpen
                  ? "bg-yellow-400/20 text-yellow-400 font-bold"
                  : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuSettings className="h-3.5 w-3.5" />
            </button>

            {/* Dropdown Popover attached to Settings Trigger */}
            <StudioSettingsDropdown
              isOpen={settingsDropdownOpen}
              onClose={() => setSettingsDropdownOpen(false)}
            />
          </div>
        </div>

        {/* Global Studio Settings Modal (fallback/direct store trigger) */}
        <StudioSettingsModal />

        {/* Center: Active Model Name + Active View (When right panel is collapsed) */}
        {!rightPanelOpen && (
          <div className="absolute top-4 right-4 z-50 hidden md:flex items-center gap-2 liquid-glass-pill px-3 py-1.5 shadow-lg select-none pointer-events-auto">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="truncate max-w-[200px] text-[var(--text-strong)] font-semibold text-xs">
              {activeModelLabel || "Architecture Project"}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
              • {getViewTitle()}
            </span>
          </div>
        )}

      {/* -- Main Tool Island (Desktop & iPad) ----------------------- */}
      {isTouchMode ? (
        /* iPad Combined Single Thin Bar (Section 4) */
        <header
          id="ribbon-dropdown-container"
          className="absolute top-3 left-3 right-3 z-40 flex h-11 items-center justify-between liquid-glass-panel px-3 shadow-2xl select-none pointer-events-auto rounded-2xl border border-[var(--glass-border)]"
        >
          {/* Left: Brand + Quick Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 pr-2 border-r border-[var(--panel-divider)]/60">
              <span className="font-black text-sm tracking-tight text-yellow-400">V</span>
              <span className="font-bold text-xs text-[var(--text-strong)] hidden sm:inline">STUDIO</span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingModel}
              title="Open"
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
            >
              <LuFolderOpen className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSaveFrag}
              title="Save (.frag)"
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
            >
              <LuSave className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={undoWerkzeug}
              title="Undo"
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
            >
              <LuUndo2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={redoWerkzeug}
              title="Redo"
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
            >
              <LuRedo2 className="h-4 w-4" />
            </button>
          </div>

          {/* Center: mode-specific touch ribbon */}
          {!mepModeActive && sketchLines.length > 0 && armedLayoutTool !== "lines" ? (
            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
              <span className="text-xs font-bold text-yellow-400 px-1.5">
                {sketchLines.length} {sketchLines.length === 1 ? "Line" : "Lines"}
              </span>

              <UnifiedButton
                size="xs"
                variant="primary"
                onClick={async () => {
                  const res = await convertSketchToSlab("floor");
                  if (!res.success && res.error) setSketchError(res.error);
                  else setSketchError(null);
                }}
                icon={<IconMarkupFloor className="h-3.5 w-3.5" />}
              >
                To Floor
              </UnifiedButton>

              <UnifiedButton
                size="xs"
                variant="primary"
                onClick={async () => {
                  const res = await convertSketchToSlab("roof");
                  if (!res.success && res.error) setSketchError(res.error);
                  else setSketchError(null);
                }}
                icon={<IconMarkupRoof className="h-3.5 w-3.5" />}
              >
                To Roof
              </UnifiedButton>

              <button
                type="button"
                onClick={() => {
                  clearSketchLines();
                  setSketchError(null);
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                title="Clear Lines"
              >
                <LuTrash2 className="h-4 w-4" />
              </button>
            </div>
          ) : mepModeActive ? (
            <div className="flex items-center gap-1">
              {mepClusters.map((cluster) => (
                <div key={cluster.key} className="flex-shrink-0">
                  {cluster.node}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {buildCluster}
              {roomsCluster}
              {shapesCluster}
              {annotateCluster}
            </div>
          )}

          {/* Right: discipline and theme toggles */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextMepMode = !mepModeActive;
                setArmedLayoutTool(null);
                setArmedTool(null);
                setActiveDropdown(null);
                setActiveTab(nextMepMode ? "mep" : "vstudio");
                setMepModeActive(nextMepMode);
              }}
              title={mepModeActive ? "Switch to Architecture tools" : "Switch to MEP tools"}
              aria-pressed={mepModeActive}
              className={`flex min-h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition-colors ${
                mepModeActive
                  ? "border-sky-400/60 bg-sky-400/20 text-sky-500 dark:text-sky-300"
                  : "border-yellow-400/60 bg-yellow-400/15 text-yellow-600 dark:text-yellow-300"
              }`}
            >
              <span aria-hidden="true">{mepModeActive ? "⚡" : "⌂"}</span>
              <span>{mepModeActive ? "MEP" : "Arch"}</span>
            </button>
            <button
              type="button"
              onClick={() => setColorTheme(isDark ? "light" : "dark")}
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)]"
            >
              {isDark ? <LuSun className="h-4 w-4 text-yellow-400" /> : <LuMoon className="h-4 w-4" />}
            </button>
          </div>
        </header>
      ) : (
        /* Desktop Floating Main Tool Island */
        <header 
          id="ribbon-dropdown-container"
          className="absolute z-40 flex w-auto max-w-[calc(100vw-1rem)] flex-col overflow-visible rounded-xl liquid-glass-panel shadow-xl select-none pointer-events-auto touch-none"
          style={{
            top: `calc(.5rem + ${ribbonPos.y}px)`,
            left: `calc(50% + ${ribbonPos.x}px)`,
            transform: `translateX(-50%)`,
          }}
          onPointerDown={handleRibbonPointerDown}
          onPointerMove={handleRibbonPointerMove}
          onPointerUp={handleRibbonPointerUp}
          onPointerCancel={handleRibbonPointerUp}
        >
          {/* -- Tab Bar ---------------------------------------------------------- */}
          <div className="flex items-center gap-1 p-1 cursor-move bg-[var(--surface-overlay)]/50 border-b border-[var(--panel-divider)]/50">
            {/* V Studio (home tab) */}
            <UnifiedButton
              size="xs"
              variant={activeTab === "vstudio" ? "primary" : "secondary"}
              onClick={() => {
                setActiveTab("vstudio");
                setMepModeActive(false);
              }}
            >
              V Studio
            </UnifiedButton>

            {/* MEP Mode Tab */}
            <UnifiedButton
              size="xs"
              variant={activeTab === "mep" ? "v-blue" : "secondary"}
              onClick={() => {
                setActiveTab("mep");
                setMepModeActive(true);
              }}
            >
              <span className="flex items-center gap-1">
                <span className="text-cyan-400 text-xs">⚡</span>
                <span>MEP</span>
              </span>
            </UnifiedButton>

            {activeTab === "mep" && (
              <UnifiedButton
                size="xs"
                variant={mepArchitectureLocked ? "v-blue" : "secondary"}
                onClick={() => setMepArchitectureLocked(!mepArchitectureLocked)}
                title={mepArchitectureLocked
                  ? "Architecture is reference-only. Click to allow architecture selection."
                  : "Architecture selection is enabled. Click to lock architecture."}
              >
                <span className="flex items-center gap-1">
                  {mepArchitectureLocked ? <LuLock className="h-3.5 w-3.5" /> : <LuLockOpen className="h-3.5 w-3.5" />}
                  <span>{mepArchitectureLocked ? "Arch Locked" : "Arch Select"}</span>
                </span>
              </UnifiedButton>
            )}

            {/* Modify (Contextual) */}
            {hasSelection && (
              <>
                <div className="h-4 w-px bg-[var(--panel-divider)] mx-1" />
                <UnifiedButton
                  size="xs"
                  variant={activeTab === "modify" ? "primary" : "secondary"}
                  onClick={() => {
                    setActiveTab("modify");
                    setMepModeActive(false);
                  }}
                >
                  {contextualModifyTitle}
                </UnifiedButton>
              </>
            )}

            {/* Ribbon collapse chevron */}
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setRibbonCollapsed(!ribbonCollapsed)}
                title={ribbonCollapsed ? "Expand Ribbon" : "Minimize Ribbon"}
                className="rounded-md p-1.5 no-drag text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
              >
                <LuChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${ribbonCollapsed ? "" : "rotate-180"}`}
                />
              </button>
            </div>
          </div>

          {/* -- Ribbon Content Panel --------------------------------------------- */}
          {!ribbonCollapsed && (
            <div
              ref={ribbonContentRef}
              className="flex h-[44px] max-w-[calc(100vw-1rem)] min-w-[320px] items-center gap-1.5 overflow-visible px-1.5 py-0.5 animate-in fade-in slide-in-from-top-1 duration-150 relative"
            >
              {activeTab === "vstudio" && (
                <div className="flex items-center gap-1.5">
                  {vstudioClusters.map((c) => (
                    <div key={c.key} className="flex-shrink-0">
                      {c.node}
                    </div>
                  ))}
                </div>
              )}

              {/* MEP tab content */}
              {activeTab === "mep" && (
                <div className="flex items-center gap-1.5">
                  {mepClusters.map((c) => (
                    <div key={c.key} className="flex-shrink-0">
                      {c.node}
                    </div>
                  ))}
                </div>
              )}

              {/* Manage tab content */}
              {activeTab === "manage" && manageTabContent}

              {/* Modify tab content */}
              {activeTab === "modify" && modifyTabContent}
            </div>
          )}
        </header>
      )}
    </>
  );
}
