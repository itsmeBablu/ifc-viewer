"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
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
  LuMoreHorizontal,
  LuX,
  LuCornerUpLeft,
  LuAlignCenter,
  LuCrosshair,
  LuMinus,
  LuArrowRight,
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

// ─── Cluster wrapper helpers ───────────────────────────────────────────────────

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
      className={`flex flex-col items-center gap-1 ${border ? "border-r border-[var(--panel-divider)]/60 pr-3" : ""}`}
    >
      <div className="flex items-center gap-1">{children}</div>
      <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function RibbonBtn({
  active,
  onClick,
  title,
  children,
  danger,
  large,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  danger?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
        large ? "p-2 min-w-[50px]" : "p-1.5 min-w-[44px]"
      } ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : active
          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
          : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
      }`}
    >
      {children}
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
          ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
          : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
      }`}
    >
      {children}
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

  const [activeTab, setActiveTab] = useState<RibbonTab>("vstudio");
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [previousTab, setPreviousTab] = useState<RibbonTab>("vstudio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);

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
  const hasSelection = Boolean(
    selectedWallId || selectedDoorId || selectedWindowId || selectedSlabId || selectedPlacementId
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
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("ribbon-overflow-menu");
      if (el && !el.contains(e.target as Node)) setOverflowOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  // ── V Studio tab content clusters ──────────────────────────────────────────
  const buildCluster = (
    <Cluster label="Build">
      <RibbonBtn
        large
        active={armedLayoutTool === "wall"}
        onClick={() => handleSelectLayoutTool("wall")}
        title="Wall (W)"
      >
        <IconMarkupWall className="h-5 w-5" />
        <span className="text-[10px]">Wall (W)</span>
      </RibbonBtn>
    </Cluster>
  );

  const openingsCluster = (
    <Cluster label="Openings">
      <RibbonBtn
        large
        active={armedLayoutTool === "door"}
        onClick={() => handleSelectLayoutTool("door")}
        title="Door (D)"
      >
        <IconMarkupDoor className="h-5 w-5" />
        <span className="text-[10px]">Door (D)</span>
      </RibbonBtn>
      <RibbonBtn
        large
        active={armedLayoutTool === "window"}
        onClick={() => handleSelectLayoutTool("window")}
        title="Window"
      >
        <IconMarkupWindow className="h-5 w-5" />
        <span className="text-[10px]">Window</span>
      </RibbonBtn>
    </Cluster>
  );

  const structureCluster = (
    <Cluster label="Structure">
      <RibbonBtn
        large
        active={armedLayoutTool === "floor"}
        onClick={() => handleSelectLayoutTool("floor")}
        title="Floor"
      >
        <IconMarkupFloor className="h-5 w-5" />
        <span className="text-[10px]">Floor</span>
      </RibbonBtn>
      <RibbonBtn
        large
        active={armedLayoutTool === "roof"}
        onClick={() => handleSelectLayoutTool("roof")}
        title="Roof"
      >
        <IconMarkupRoof className="h-5 w-5" />
        <span className="text-[10px]">Roof</span>
      </RibbonBtn>
    </Cluster>
  );

  const roomsCluster = (
    <Cluster label="Rooms">
      <RibbonBtn
        large
        onClick={() => {
          setArmedLayoutTool(null);
          setArmedTool(null);
          onOpenRoomSchedule?.();
        }}
        title="Room (RM)"
      >
        <LuTable className="h-5 w-5 text-amber-500" />
        <span className="text-[10px]">Room</span>
      </RibbonBtn>
      <RibbonBtn large onClick={() => onOpenRoomSchedule?.()} title="Schedule">
        <LuFileSpreadsheet className="h-5 w-5 text-emerald-500" />
        <span className="text-[10px]">Schedule</span>
      </RibbonBtn>
    </Cluster>
  );

  const shapesCluster = (
    <Cluster label="Shapes">
      {(
        [
          { id: "cube" as const, label: "Cube", icon: IconMarkupCube },
          { id: "cylinder" as const, label: "Cyl", icon: IconMarkupCylinder },
          { id: "sphere" as const, label: "Sphere", icon: IconMarkupSphere },
          { id: "cone" as const, label: "Cone", icon: IconMarkupCone },
          { id: "torus" as const, label: "Torus", icon: IconMarkupTorus },
          { id: "pyramid" as const, label: "Pyr", icon: IconMarkupPyramid },
        ] as const
      ).map((item) => {
        const Icon = item.icon;
        return (
          <RibbonBtn
            key={item.id}
            active={armedTool === item.id}
            onClick={() => handleSelectShape(item.id)}
            title={item.label}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[9px]">{item.label}</span>
          </RibbonBtn>
        );
      })}
    </Cluster>
  );

  const annotateCluster = (
    <Cluster label="Annotate">
      <RibbonBtn
        large
        active={armedTool === "note"}
        onClick={() => {
          setArmedLayoutTool(null);
          setArmedTool(armedTool === "note" ? null : "note");
        }}
        title="Sticky Tag"
      >
        <IconMarkupNote className="h-5 w-5" />
        <span className="text-[10px]">Tag</span>
      </RibbonBtn>
      <RibbonBtn
        large
        onClick={() => {
          setArmedLayoutTool(null);
          setArmedTool(armedTool === "cube" ? null : "cube");
        }}
        title="Measure (M)"
      >
        <LuRuler className="h-5 w-5 text-amber-500" />
        <span className="text-[10px]">Measure</span>
      </RibbonBtn>
      {measurements.length > 0 && (
        <RibbonBtn large danger onClick={clearMeasurements} title="Clear Measurements">
          <LuTrash2 className="h-5 w-5" />
          <span className="text-[10px]">Clear ({measurements.length})</span>
        </RibbonBtn>
      )}
    </Cluster>
  );

  const cameraCluster = (
    <Cluster label="Views">
      {(
        [
          { id: "free" as const, label: "3D Iso" },
          { id: "top" as const, label: "Top" },
          { id: "north" as const, label: "N" },
          { id: "south" as const, label: "S" },
          { id: "east" as const, label: "E" },
          { id: "west" as const, label: "W" },
        ] as const
      ).map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setViewPreset(v.id as MarkupViewPreset)}
          className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 text-[10px] font-semibold border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:text-[var(--text-strong)] hover:border-amber-400 transition-all min-w-[34px]"
        >
          <span>{v.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => viewerRef.current?.fitVisible?.()}
        className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 text-[10px] font-semibold border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:border-amber-400 hover:text-[var(--text-strong)] transition-all"
        title="Fit to Extents"
      >
        <MdZoomInMap className="h-4 w-4 text-amber-500" />
        <span>Fit</span>
      </button>
    </Cluster>
  );

  const snapsCluster = (
    <Cluster label="Snaps" border={false}>
      {/* Full CAD snap suite — all combinable */}
      {[
        { key: "endpoint", label: "Endpt", active: snapEndpoint, set: setSnapEndpoint, title: "Endpoint snap" },
        { key: "midpoint", label: "Mid", active: snapMidpoint, set: setSnapMidpoint, title: "Midpoint snap" },
        { key: "center", label: "Ctr", active: snapCenter, set: setSnapCenter, title: "Center point snap" },
        { key: "intersection", label: "Int", active: snapIntersection, set: setSnapIntersection, title: "Intersection snap" },
        { key: "perp", label: "Perp", active: snapPerpendicular, set: setSnapPerpendicular, title: "Perpendicular snap" },
        { key: "ext", label: "Ext", active: snapExtension, set: setSnapExtension, title: "Extension snap" },
        { key: "face", label: "Face", active: snapToFaces, set: setSnapToFaces, title: "Face snap (3D)" },
        { key: "grid", label: "Grid", active: gridSnap, set: setGridSnap, title: "Grid snap (100mm)" },
      ].map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => s.set(!s.active)}
          title={s.title}
          className={`flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-bold border transition-all min-w-[28px] ${
            s.active
              ? "border-amber-400 bg-amber-500/25 text-amber-600 dark:text-amber-400"
              : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          {s.label}
        </button>
      ))}
    </Cluster>
  );

  // ── Manage tab content ─────────────────────────────────────────────────────
  const manageTabContent = (
    <div className="flex items-center gap-3">
      <Cluster label="Structure">
        <button
          type="button"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[60px] border transition-all ${
            rightPanelOpen
              ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
              : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)]"
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
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[55px] border border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all font-semibold"
        >
          <LuSave className="h-4 w-4" />
          <span className="text-[10px]">.frag</span>
        </button>
        <button
          type="button"
          onClick={handleSaveIfc}
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[55px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all font-semibold"
        >
          <LuSave className="h-4 w-4" />
          <span className="text-[10px]">.ifc</span>
        </button>
      </Cluster>
    </div>
  );

  // ── Contextual Modify tab content ──────────────────────────────────────────
  const modifyTabContent = hasSelection && (
    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Universal Modify Tools */}
      <Cluster label="Modify Tools">
        {(
          [
            { id: "translate" as const, label: "Move", icon: LuMove },
            { id: "rotate" as const, label: "Rotate", icon: LuRotate3D },
            { id: "scale" as const, label: "Scale", icon: LuScaling },
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
              <span className="text-[9px]">{m.label}</span>
            </RibbonBtn>
          );
        })}

        <RibbonBtn
          onClick={() => {
            if (selectedWallId) duplicateWall(selectedWallId);
            if (selectedPlacementId) duplicatePlacement(selectedPlacementId);
          }}
          title="Copy / Duplicate (CO)"
        >
          <LuCopy className="h-4 w-4" />
          <span className="text-[9px]">Copy</span>
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
          <span className="text-[9px]">Delete</span>
        </RibbonBtn>
      </Cluster>

      {/* Category-specific controls */}
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

      {/* Deselect */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={clearCurrentSelection}
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all"
        >
          <span className="text-xs font-bold">Esc</span>
          <span className="text-[10px]">Deselect</span>
        </button>
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Finish
        </span>
      </div>
    </div>
  );

  // ── All V Studio clusters in order ─────────────────────────────────────────
  const vstudioClusters = [
    { key: "build", node: buildCluster },
    { key: "openings", node: openingsCluster },
    { key: "structure", node: structureCluster },
    { key: "rooms", node: roomsCluster },
    { key: "shapes", node: shapesCluster },
    { key: "annotate", node: annotateCluster },
    { key: "camera", node: cameraCluster },
    { key: "snaps", node: snapsCluster },
  ];

  return (
    <header className="relative z-40 flex w-full flex-col border-b border-[var(--panel-divider)] bg-[var(--surface-overlay)] shadow-md backdrop-blur-xl select-none">
      {/* ── Quick Access Toolbar (QAT) ─────────────────────────────────────── */}
      <div className="flex h-9 items-center justify-between border-b border-[var(--panel-divider)]/60 px-3 text-xs">
        {/* Left: V Studio brand + Quick Actions */}
        <div className="flex items-center gap-1.5">
          {/* V Studio home logo */}
          <a
            href="/"
            title="Back to Viewer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 font-bold hover:bg-[var(--glass-inset-bg)] transition-colors"
          >
            <IoHomeOutline className="h-4 w-4 text-amber-500" />
            <span className="tracking-widest uppercase font-mono text-[11px] bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-black">
              V Studio
            </span>
          </a>

          <div className="h-4 w-px bg-[var(--panel-divider)]" />

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setSaveMenuOpen(!saveMenuOpen)}
              title="Save .frag / .ifc"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
            >
              <LuSave className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline text-[11px]">Save</span>
              <LuChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
            </button>

            {saveMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setSaveMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={handleSaveFrag}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
                >
                  <LuSave className="h-3.5 w-3.5 text-sky-500" />
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
                  <LuSave className="h-3.5 w-3.5 text-emerald-500" />
                  <div>
                    <div className="font-semibold text-[var(--text-strong)]">Save as .ifc</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Export with IFC structure & geometry</div>
                  </div>
                </button>
              </div>
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
        </div>

        {/* Center: Active Model Name */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate max-w-[300px] text-[var(--text-strong)] font-semibold">
            {activeModelLabel || "Empty Architecture Project"}
          </span>
        </div>

        {/* Right: Theme Toggle & Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setColorTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            {isDark ? <LuSun className="h-3.5 w-3.5 text-amber-400" /> : <LuMoon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            {isFullscreen ? <LuMinimize className="h-3.5 w-3.5" /> : <LuMaximize className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setRibbonCollapsed(!ribbonCollapsed)}
            title={ribbonCollapsed ? "Expand Ribbon" : "Minimize Ribbon"}
            className="rounded-md p-1.5 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
          >
            <LuChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${ribbonCollapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="flex h-8 items-center gap-1 border-b border-[var(--panel-divider)]/40 px-3 text-xs">
        {/* V Studio (home tab) */}
        <button
          type="button"
          onClick={() => setActiveTab("vstudio")}
          className={`relative px-4 py-1 font-semibold transition-colors ${
            activeTab === "vstudio"
              ? "text-amber-500 font-black"
              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          V Studio
          {activeTab === "vstudio" && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          )}
        </button>

        {/* Manage */}
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={`relative px-3.5 py-1 font-semibold transition-colors ${
            activeTab === "manage"
              ? "text-amber-500 font-bold"
              : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          }`}
        >
          Manage
          {activeTab === "manage" && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          )}
        </button>

        {/* Contextual Modify */}
        {hasSelection && (
          <button
            type="button"
            onClick={() => setActiveTab("modify")}
            className={`relative ml-2 flex items-center gap-1 rounded-t-lg px-4 py-1 font-bold transition-all border-t-2 ${
              activeTab === "modify"
                ? "bg-amber-500/15 text-amber-500 border-amber-500 shadow-sm"
                : "bg-[var(--glass-inset-bg)] text-amber-600 dark:text-amber-400 border-transparent hover:bg-amber-500/10"
            }`}
          >
            <span>{contextualModifyTitle || "Modify"}</span>
            {activeTab === "modify" && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-500" />
            )}
          </button>
        )}
      </div>

      {/* ── Ribbon Content Panel ───────────────────────────────────────────── */}
      {!ribbonCollapsed && (
        <div
          ref={ribbonContentRef}
          className="flex h-20 items-center gap-3 px-4 py-2 animate-in fade-in slide-in-from-top-1 duration-150 relative"
        >
          {/* V Studio tab: all clusters in a scrollable row with overflow button */}
          {activeTab === "vstudio" && (
            <>
              <div className="flex items-center gap-3 overflow-x-hidden min-w-0 flex-1">
                {vstudioClusters
                  .filter((c) => !isTouchMode || c.key === "build" || c.key === "structure")
                  .map((c) => (
                    <div key={c.key} className="flex-shrink-0">
                      {c.node}
                    </div>
                  ))}
              </div>

              {/* Overflow: More button at compact widths / iPad mode */}
              <div className="relative ml-auto flex-shrink-0" id="ribbon-overflow-menu">
                <button
                  type="button"
                  onClick={() => setOverflowOpen(!overflowOpen)}
                  className={`flex flex-col items-center justify-center rounded-xl p-1.5 border transition-all text-xs min-w-[40px] ${
                    overflowOpen
                      ? "border-amber-400 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                  }`}
                  title="More tools"
                >
                  {overflowOpen ? (
                    <LuX className="h-4 w-4" />
                  ) : (
                    <LuMoreHorizontal className="h-4 w-4" />
                  )}
                  <span className="text-[9px]">More</span>
                </button>

                {overflowOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[70dvh] overflow-y-auto thin-scroll">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                      {isTouchMode ? "Advanced Tools" : "All Tools"}
                    </div>
                    <div className="flex flex-col gap-3">
                      {vstudioClusters
                        .filter((c) => !isTouchMode || (c.key !== "build" && c.key !== "structure"))
                        .map((c) => (
                          <div key={c.key} className="border-b border-[var(--panel-divider)]/40 pb-2 last:border-0 last:pb-0">
                            {c.node}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Manage tab content */}
          {activeTab === "manage" && manageTabContent}

          {/* Modify tab content */}
          {activeTab === "modify" && modifyTabContent}
        </div>
      )}
    </header>
  );
}
