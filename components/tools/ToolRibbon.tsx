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
  LuMagnet,
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
import { undoWerkzeug, redoWerkzeug } from "@/lib/werkzeugHistory";
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

// Two primary tabs plus contextual modify
export type RibbonTab = "vstudio" | "manage" | "modify";

interface ToolRibbonProps {
  viewerRef: RefObject<WerkzeugViewer3DHandle | null>;
  onFile: (file: File) => void;
  isLoadingModel: boolean;
  onOpenRoomSchedule?: () => void;
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
      className={`flex flex-col items-center gap-0.5 ${border ? "border-r border-[var(--panel-divider)]/60 pr-2.5" : ""}`}
    >
      <div className="flex items-center gap-1">{children}</div>
      <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider select-none leading-none mt-0.5">
        {label}
      </span>
    </div>
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

  const displayLabel = label;

  const animateIn = () => {
    if (active) return;
    if (btnRef.current) {
      gsap.to(btnRef.current, {
        backgroundColor: "rgba(250, 204, 21, 0.16)",
        borderColor: "rgba(250, 204, 21, 0.4)",
        boxShadow: "0 0 12px rgba(250, 204, 21, 0.22)",
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
        { scale: 0.92, backgroundColor: "rgba(250, 204, 21, 0)" },
        {
          scale: 1,
          backgroundColor: "#facc15",
          borderColor: "#fde047",
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
  }, [active]);

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
      className={`relative overflow-hidden flex items-center justify-center rounded-lg border border-transparent transition-all cursor-pointer min-w-[34px] min-h-[30px] px-2 py-1 ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : active
          ? "text-slate-950 font-bold shadow-md shadow-yellow-400/20"
          : "text-[var(--text-body)] hover:text-yellow-400"
      }`}
    >
      {children}
      {displayLabel && (
        <span
          ref={labelRef}
          className="overflow-hidden whitespace-nowrap text-[10px] font-bold text-[var(--text-strong)] opacity-0 max-w-0 pointer-events-none"
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
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border transition-all ${
        active
          ? "border-yellow-400 bg-yellow-400/20 text-yellow-500 dark:text-yellow-400 font-bold"
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

  const isDark = colorTheme === "dark";

  // Layout Store
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const setArmedLayoutTool = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const selectWall = useLayoutDrawingStore((s) => s.selectWall);
  const selectDoor = useLayoutDrawingStore((s) => s.selectDoor);
  const selectWindow = useLayoutDrawingStore((s) => s.selectWindow);
  const selectSlab = useLayoutDrawingStore((s) => s.selectSlab);

  // Markup Store
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const setSnapToFaces = useToolMarkupStore((s) => s.setSnapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const setGridSnap = useToolMarkupStore((s) => s.setGridSnap);
  const snapEndpoint = useToolMarkupStore((s) => s.snapEndpoint);
  const setSnapEndpoint = useToolMarkupStore((s) => s.setSnapEndpoint);
  const snapMidpoint = useToolMarkupStore((s) => s.snapMidpoint);
  const setSnapMidpoint = useToolMarkupStore((s) => s.setSnapMidpoint);
  const snapCenter = useToolMarkupStore((s) => s.snapCenter);
  const setSnapCenter = useToolMarkupStore((s) => s.setSnapCenter);
  const snapIntersection = useToolMarkupStore((s) => s.snapIntersection);
  const setSnapIntersection = useToolMarkupStore((s) => s.setSnapIntersection);
  const snapPerpendicular = useToolMarkupStore((s) => s.snapPerpendicular);
  const setSnapPerpendicular = useToolMarkupStore((s) => s.setSnapPerpendicular);
  const snapExtension = useToolMarkupStore((s) => s.snapExtension);
  const setSnapExtension = useToolMarkupStore((s) => s.setSnapExtension);
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const measurements = useToolMarkupStore((s) => s.measurements);
  const clearMeasurements = useToolMarkupStore((s) => s.clearMeasurements);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectPlacement = useToolMarkupStore((s) => s.selectPlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const duplicatePlacement = useToolMarkupStore((s) => s.duplicatePlacement);

  const sketchLines = useLayoutDrawingStore((s) => s.sketchLines);
  const gapHighlightPoints = useLayoutDrawingStore((s) => s.gapHighlightPoints);
  const convertSketchToSlab = useLayoutDrawingStore((s) => s.convertSketchToSlab);
  const clearSketchLines = useLayoutDrawingStore((s) => s.clearSketchLines);
  const [sketchError, setSketchError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<RibbonTab>("vstudio");
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [previousTab, setPreviousTab] = useState<RibbonTab>("vstudio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"build" | "shapes" | "rooms" | "annotate" | "snaps" | null>(null);

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
    selectedWallId || selectedDoorId || selectedWindowId || selectedSlabId || selectedPlacementId || isSketching
  );

  const contextualModifyTitle = selectedWallId
    ? "Modify | Walls"
    : selectedDoorId
    ? "Modify | Doors"
    : selectedWindowId
    ? "Modify | Windows"
    : selectedSlabId
    ? "Modify | Floors"
    : selectedPlacementId
    ? "Modify | 3D Shapes"
    : isSketching
    ? `Sketch (${sketchLines.length} ${sketchLines.length === 1 ? "Line" : "Lines"})`
    : null;

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
    setArmedLayoutTool(armedLayoutTool === id ? null : id);
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
          active={["wall", "door", "window", "floor", "roof", "lines"].includes(armedLayoutTool || "")}
          onClick={() => setActiveDropdown(activeDropdown === "build" ? null : "build")}
          title="Build Elements (Walls, Doors, Windows, Slabs, Lines)"
        >
          <IconMarkupWall className="h-4.5 w-4.5" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "build" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-32 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("wall"); setActiveDropdown(null); }}>
              <IconMarkupWall className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Wall (W)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("door"); setActiveDropdown(null); }}>
              <IconMarkupDoor className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Door (D)</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("window"); setActiveDropdown(null); }}>
              <IconMarkupWindow className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Window</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("floor"); setActiveDropdown(null); }}>
              <IconMarkupFloor className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Floor</span>
            </button>
            <button type="button" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]" onClick={() => { handleSelectLayoutTool("roof"); setActiveDropdown(null); }}>
              <IconMarkupRoof className="h-4 w-4 text-yellow-400" /> <span className="text-xs">Roof</span>
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

  const snapsCluster = (
    <Cluster label="Snaps" border={false}>
      <div className="relative">
        <RibbonBtn
          onClick={() => setActiveDropdown(activeDropdown === "snaps" ? null : "snaps")}
          title="Object Snaps"
        >
          <LuMagnet className="h-4.5 w-4.5 text-yellow-400" />
          <LuChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
        </RibbonBtn>
        {activeDropdown === "snaps" && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-1 w-40 bg-[var(--popover-bg)] border border-[var(--panel-divider)] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
            {[
              { key: "endpoint", label: "Endpoint", active: snapEndpoint, set: setSnapEndpoint },
              { key: "midpoint", label: "Midpoint", active: snapMidpoint, set: setSnapMidpoint },
              { key: "center", label: "Center", active: snapCenter, set: setSnapCenter },
              { key: "intersection", label: "Intersection", active: snapIntersection, set: setSnapIntersection },
              { key: "perp", label: "Perpendicular", active: snapPerpendicular, set: setSnapPerpendicular },
              { key: "ext", label: "Extension", active: snapExtension, set: setSnapExtension },
              { key: "face", label: "Face (3D)", active: snapToFaces, set: setSnapToFaces },
              { key: "grid", label: "Grid", active: gridSnap, set: setGridSnap },
            ].map((s) => (
              <button 
                key={s.key} 
                type="button" 
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]"
                onClick={(e) => {
                  e.stopPropagation();
                  s.set(!s.active);
                }}
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${s.active ? 'bg-yellow-400 border-yellow-400 text-slate-950' : 'border-[var(--panel-divider)] text-transparent'}`}>
                  <LuCheck className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold">{s.label}</span>
              </button>
            ))}
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

        <RibbonBtn
          onClick={() => {
            if (selectedWallId) duplicateWall(selectedWallId);
            if (selectedPlacementId) duplicatePlacement(selectedPlacementId);
          }}
          title="Copy / Duplicate (CO)"
        >
          <LuCopy className="h-4 w-4" />
        </RibbonBtn>

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
              const res = await convertSketchToSlab("floor");
              if (!res.success && res.error) {
                setSketchError(res.error);
              } else {
                setSketchError(null);
              }
            }}
            title="Convert closed sketch loop into Floor slab"
          >
            <IconMarkupFloor className="h-4 w-4" />
            <span className="text-[9px]">To Floor</span>
          </RibbonBtn>

          <RibbonBtn
            active
            onClick={async () => {
              const res = await convertSketchToSlab("roof");
              if (!res.success && res.error) {
                setSketchError(res.error);
              } else {
                setSketchError(null);
              }
            }}
            title="Convert closed sketch loop into Roof slab"
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

      {/* Deselect */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => {
            if (isSketching) {
              clearSketchLines();
              setSketchError(null);
            }
            clearCurrentSelection();
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all cursor-pointer"
        >
          <span className="text-xs font-bold">Esc</span>
          <span className="text-[10px]">Finish</span>
        </button>
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Finish
        </span>
      </div>
    </div>
  );

  // -- All V Studio clusters in order -----------------------------------------
  const vstudioClusters = [
    { key: "build", node: buildCluster },
    { key: "rooms", node: roomsCluster },
    { key: "shapes", node: shapesCluster },
    { key: "annotate", node: annotateCluster },
    { key: "snaps", node: snapsCluster },
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

          {/* Print */}
          <div className="h-4 w-px bg-[var(--panel-divider)]" />
          <button
            type="button"
            onClick={handlePrint}
            title="Print (Ctrl+P)"
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuPrinter className="h-3.5 w-3.5" />
          </button>
          {/* Theme & Fullscreen */}
          <div className="h-4 w-px bg-[var(--panel-divider)]" />
          <button
            type="button"
            onClick={() => setColorTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            {isDark ? <LuSun className="h-3.5 w-3.5 text-yellow-400" /> : <LuMoon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            {isFullscreen ? <LuMinimize className="h-3.5 w-3.5" /> : <LuMaximize className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Center: Active Model Name + Active Level (When right panel is collapsed) */}
        {!rightPanelOpen && (
          <div className="absolute top-4 right-4 z-50 hidden md:flex items-center gap-2 liquid-glass-pill px-3 py-1.5 shadow-lg select-none pointer-events-auto">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="truncate max-w-[200px] text-[var(--text-strong)] font-semibold text-xs">
              {activeModelLabel || "Architecture Project"}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
              • {currentFloor?.name ?? "All Levels"}
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
              onClick={() => setSaveMenuOpen(true)}
              title="Save"
              className="p-1.5 rounded-lg text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] text-yellow-400"
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

          {/* Center: Dropdown-only Tool Groups or Sketch Actions */}
          {isSketching ? (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <span className="text-xs font-bold text-yellow-400 px-1.5">
                {sketchLines.length} {sketchLines.length === 1 ? "Line" : "Lines"}
              </span>

              <button
                type="button"
                onClick={async () => {
                  const res = await convertSketchToSlab("floor");
                  if (!res.success && res.error) setSketchError(res.error);
                  else setSketchError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-yellow-400 text-slate-950 font-bold text-xs hover:bg-yellow-300 shadow-md shadow-yellow-400/20 transition-all cursor-pointer"
              >
                <IconMarkupFloor className="h-3.5 w-3.5" />
                <span>To Floor</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await convertSketchToSlab("roof");
                  if (!res.success && res.error) setSketchError(res.error);
                  else setSketchError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-yellow-400 text-slate-950 font-bold text-xs hover:bg-yellow-300 shadow-md shadow-yellow-400/20 transition-all cursor-pointer"
              >
                <IconMarkupRoof className="h-3.5 w-3.5" />
                <span>To Roof</span>
              </button>

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
          ) : (
            <div className="flex items-center gap-1">
              {buildCluster}
              {roomsCluster}
              {shapesCluster}
              {annotateCluster}
              {snapsCluster}
            </div>
          )}

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setColorTheme(isDark ? "light" : "dark")}
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
          className="absolute z-40 flex w-auto flex-col liquid-glass-panel shadow-2xl select-none pointer-events-auto touch-none"
          style={{
            top: `calc(1rem + ${ribbonPos.y}px)`,
            left: `calc(50% + ${ribbonPos.x}px)`,
            transform: `translateX(-50%)`,
          }}
          onPointerDown={handleRibbonPointerDown}
          onPointerMove={handleRibbonPointerMove}
          onPointerUp={handleRibbonPointerUp}
          onPointerCancel={handleRibbonPointerUp}
        >
          {/* -- Tab Bar ---------------------------------------------------------- */}
          <div className="flex items-center gap-2 p-2 cursor-move bg-[var(--surface-overlay)]/50 border-b border-[var(--panel-divider)]/50">
            {/* V Studio (home tab) */}
            <button
              type="button"
              onClick={() => setActiveTab("vstudio")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all border ${
                activeTab === "vstudio"
                  ? "bg-yellow-400 text-slate-950 font-bold border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                  : "bg-[var(--glass-inset-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              V Studio
            </button>

            {/* Manage */}
            <button
              type="button"
              onClick={() => setActiveTab("manage")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all border ${
                activeTab === "manage"
                  ? "bg-yellow-400 text-slate-950 font-bold border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                  : "bg-[var(--glass-inset-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              Manage
            </button>

            {/* Modify (Contextual) */}
            {hasSelection && (
              <>
                <div className="h-4 w-px bg-[var(--panel-divider)] mx-1" />
                <button
                  type="button"
                  onClick={() => setActiveTab("modify")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all border ${
                    activeTab === "modify"
                      ? "bg-yellow-400 text-slate-950 font-bold border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                      : "bg-[var(--glass-inset-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  {contextualModifyTitle}
                </button>
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
              className="flex h-[52px] items-center gap-2.5 px-3 py-1 animate-in fade-in slide-in-from-top-1 duration-150 relative min-w-[400px]"
            >
              {activeTab === "vstudio" && (
                <div className="flex items-center gap-3">
                  {vstudioClusters.map((c) => (
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
