"use client";

import { useState, useRef, useEffect, type RefObject } from "react";
import {
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
  LuBox,
  LuFileSpreadsheet,
  LuEye,
  LuSearch,
  LuLayoutGrid,
  LuMagnet,
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

export type RibbonTab = "architecture" | "shapes" | "annotate" | "view" | "manage" | "modify";

interface ToolRibbonProps {
  viewerRef: RefObject<WerkzeugViewer3DHandle | null>;
  onFile: (file: File) => void;
  isLoadingModel: boolean;
  onOpenRoomSchedule?: () => void;
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
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);
  const setSelectedFloor = useAppStore((s) => s.setSelectedFloor);
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
  const setViewPreset = useToolMarkupStore((s) => s.setViewPreset);
  const measurements = useToolMarkupStore((s) => s.measurements);
  const clearMeasurements = useToolMarkupStore((s) => s.clearMeasurements);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const selectPlacement = useToolMarkupStore((s) => s.selectPlacement);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const duplicatePlacement = useToolMarkupStore((s) => s.duplicatePlacement);

  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
  const [previousTab, setPreviousTab] = useState<RibbonTab>("architecture");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine what is currently selected for Contextual Modify Tab (Section 2)
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
        setActiveTab(previousTab || "architecture");
      }
    }
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
      downloadBlob(blob, `${activeModelLabel || "werkzeug-model"}.frag`);
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

  return (
    <header className="relative z-40 flex w-full flex-col border-b border-[var(--panel-divider)] bg-[var(--surface-overlay)] shadow-md backdrop-blur-xl select-none">
      {/* Top Quick Access Toolbar (QAT) */}
      <div className="flex h-9 items-center justify-between border-b border-[var(--panel-divider)]/60 px-3 text-xs">
        {/* Left: App Title & Quick Action Icons */}
        <div className="flex items-center gap-2">
          <a
            href="/"
            title="Back to Viewer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 font-bold text-amber-500 hover:bg-[var(--glass-inset-bg)] transition-colors"
          >
            <IoHomeOutline className="h-4 w-4" />
            <span className="tracking-wide uppercase font-mono text-[11px]">Revit BIM Studio</span>
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
            <span className="hidden sm:inline text-[11px]">{t(uiLanguage, "loadNewIfc") || "Open"}</span>
          </button>

          {/* Save Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSaveMenuOpen(!saveMenuOpen)}
              title={t(uiLanguage, "markupSaveAs") || "Save .frag / .ifc"}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
            >
              <LuSave className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline text-[11px]">Save</span>
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

          <div className="h-4 w-px bg-[var(--panel-divider)]" />

          {/* Undo / Redo */}
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
        </div>
      </div>

      {/* Main Ribbon Tabs Header */}
      <div className="flex h-8 items-center gap-1 border-b border-[var(--panel-divider)]/40 px-3 text-xs">
        {[
          { id: "architecture", label: "Architecture" },
          { id: "shapes", label: "3D Shapes" },
          { id: "annotate", label: "Annotate" },
          { id: "view", label: "View" },
          { id: "manage", label: "Manage" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as RibbonTab)}
            className={`relative px-3.5 py-1 font-semibold transition-colors ${
              activeTab === tab.id
                ? "text-amber-500 font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            )}
          </button>
        ))}

        {/* Section 2: Contextual Modify Tab if Selection Exists */}
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

      {/* Ribbon Content Panel for Active Tab — Standardized Uniform Cluster Layout */}
      <div className="flex h-20 items-center gap-3 overflow-x-auto px-4 py-2 thin-scroll">
        {/* TAB 1: ARCHITECTURE / BUILD */}
        {activeTab === "architecture" && (
          <div className="flex items-center gap-3">
            {/* Cluster: BUILD */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("wall")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedLayoutTool === "wall"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupWall className="h-5 w-5" />
                  <span className="text-[10px]">Wall (W)</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Build</span>
            </div>

            {/* Cluster: OPENINGS */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("door")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedLayoutTool === "door"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupDoor className="h-5 w-5" />
                  <span className="text-[10px]">Door (D)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("window")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedLayoutTool === "window"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupWindow className="h-5 w-5" />
                  <span className="text-[10px]">Window</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Openings</span>
            </div>

            {/* Cluster: STRUCTURE */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("floor")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedLayoutTool === "floor"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupFloor className="h-5 w-5" />
                  <span className="text-[10px]">Floor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("roof")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedLayoutTool === "roof"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupRoof className="h-5 w-5" />
                  <span className="text-[10px]">Roof</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Structure</span>
            </div>

            {/* Cluster: ROOMS & SPACES (Section 4) */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    // Room tool trigger
                    setArmedLayoutTool(null);
                    setArmedTool(null);
                    onOpenRoomSchedule?.();
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuTable className="h-5 w-5 text-amber-500" />
                  <span className="text-[10px]">Room (RM)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenRoomSchedule?.()}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuFileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <span className="text-[10px]">Schedule</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Rooms</span>
            </div>

            {/* Cluster: CONSTRAINTS */}
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">Active Level:</span>
                <select
                  value={selectedFloor || ""}
                  onChange={(e) => setSelectedFloor(e.target.value || null)}
                  className="rounded-lg border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--text-strong)] focus:border-amber-500 focus:outline-none"
                >
                  <option value="">All Levels (Building)</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.elevation != null ? `${(f.elevation).toFixed(2)} m` : "Level"})
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Level Constraint</span>
            </div>
          </div>
        )}

        {/* TAB 2: 3D SHAPES & PRIMITIVES */}
        {activeTab === "shapes" && (
          <div className="flex items-center gap-3">
            {/* Cluster: 3D PRIMITIVES */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                {[
                  { id: "cube" as const, label: "Cube", icon: IconMarkupCube },
                  { id: "cylinder" as const, label: "Cylinder", icon: IconMarkupCylinder },
                  { id: "sphere" as const, label: "Sphere", icon: IconMarkupSphere },
                  { id: "cone" as const, label: "Cone", icon: IconMarkupCone },
                  { id: "torus" as const, label: "Torus", icon: IconMarkupTorus },
                  { id: "pyramid" as const, label: "Pyramid", icon: IconMarkupPyramid },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSel = armedTool === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectShape(item.id)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[48px] transition-all ${
                        isSel
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Primitives</span>
            </div>

            {/* Cluster: TRANSFORM */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                {[
                  { id: "translate" as const, label: "Move", icon: LuMove },
                  { id: "rotate" as const, label: "Rotate", icon: LuRotate3D },
                  { id: "scale" as const, label: "Scale", icon: LuScaling },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSel = transformMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTransformMode(m.id)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] transition-all ${
                        isSel
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px]">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Transform</span>
            </div>

            {/* Cluster: SNAPPING */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSnapToFaces(!snapToFaces)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border transition-all ${
                    snapToFaces
                      ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                  }`}
                >
                  <LuMagnet className="h-4 w-4" />
                  <span className="text-[9px]">Face Snap</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridSnap(!gridSnap)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border transition-all ${
                    gridSnap
                      ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                  }`}
                >
                  <LuLayoutGrid className="h-4 w-4" />
                  <span className="text-[9px]">Grid Snap</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Precision</span>
            </div>
          </div>
        )}

        {/* TAB 3: ANNOTATE & MEASURE */}
        {activeTab === "annotate" && (
          <div className="flex items-center gap-3">
            {/* Cluster: DIMENSIONS & MEASURE */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setArmedLayoutTool(null);
                    setArmedTool(armedTool === "cube" ? null : "cube");
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuRuler className="h-5 w-5 text-amber-500" />
                  <span className="text-[10px]">Measure (M)</span>
                </button>
                {measurements.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMeasurements}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <LuTrash2 className="h-5 w-5" />
                    <span className="text-[10px]">Clear ({measurements.length})</span>
                  </button>
                )}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dimension</span>
            </div>

            {/* Cluster: TAGS & TEXT */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setArmedLayoutTool(null);
                    setArmedTool(armedTool === "note" ? null : "note");
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] transition-all ${
                    armedTool === "note"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupNote className="h-5 w-5" />
                  <span className="text-[10px]">Sticky Tag</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tags</span>
            </div>

            {/* Cluster: INSPECTOR */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightPanelOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuSlidersHorizontal className="h-5 w-5 text-indigo-400" />
                  <span className="text-[10px]">Inspector</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Property Sets</span>
            </div>
          </div>
        )}

        {/* TAB 4: VIEW & CAMERA */}
        {activeTab === "view" && (
          <div className="flex items-center gap-3">
            {/* Cluster: CAMERA VIEWS */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                {[
                  { id: "free" as const, label: "3D Iso" },
                  { id: "top" as const, label: "Top (Plan)" },
                  { id: "north" as const, label: "North" },
                  { id: "south" as const, label: "South" },
                  { id: "east" as const, label: "East" },
                  { id: "west" as const, label: "West" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setViewPreset(v.id as MarkupViewPreset)}
                    className="flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:text-[var(--text-strong)] hover:border-amber-400 transition-all min-w-[42px]"
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Cameras</span>
            </div>

            {/* Cluster: SHADING STYLES */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                {(["realistic", "fullColor", "light", "wireframe"] as RenderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRenderMode(mode)}
                    className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize border transition-all min-w-[50px] ${
                      renderMode === mode
                        ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                    }`}
                  >
                    <span>{mode === "fullColor" ? "Shaded" : mode}</span>
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Shading</span>
            </div>

            {/* Cluster: FRAMING */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => viewerRef.current?.fitVisible?.()}
                className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
              >
                <MdZoomInMap className="h-5 w-5 text-amber-500" />
                <span className="text-[10px]">Extents</span>
              </button>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Framing</span>
            </div>
          </div>
        )}

        {/* TAB 5: MANAGE / IFC TREE */}
        {activeTab === "manage" && (
          <div className="flex items-center gap-3">
            {/* Cluster: PROJECT BROWSER */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
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
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Structure</span>
            </div>

            {/* Cluster: EXPORT */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
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
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Export</span>
            </div>
          </div>
        )}

        {/* SECTION 2: CONTEXTUAL MODIFY TAB BODY */}
        {activeTab === "modify" && hasSelection && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Cluster: UNIVERSAL MODIFY TOOLS (Move, Copy, Rotate, Mirror, Scale, Delete) */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTransformMode("translate")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] transition-all ${
                    transformMode === "translate"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                  title="Move element (MV)"
                >
                  <LuMove className="h-4 w-4" />
                  <span className="text-[9px]">Move</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedWallId) duplicateWall(selectedWallId);
                    if (selectedPlacementId) duplicatePlacement(selectedPlacementId);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                  title="Copy / Duplicate (CO)"
                >
                  <LuCopy className="h-4 w-4" />
                  <span className="text-[9px]">Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransformMode("rotate")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] transition-all ${
                    transformMode === "rotate"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                  title="Rotate element (RO)"
                >
                  <LuRotate3D className="h-4 w-4" />
                  <span className="text-[9px]">Rotate</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransformMode("scale")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] transition-all ${
                    transformMode === "scale"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                  title="Scale element (RE)"
                >
                  <LuScaling className="h-4 w-4" />
                  <span className="text-[9px]">Scale</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedWallId) deleteWall(selectedWallId);
                    if (selectedDoorId) deleteDoor(selectedDoorId);
                    if (selectedWindowId) deleteWindow(selectedWindowId);
                    if (selectedSlabId) deleteSlab(selectedSlabId);
                    if (selectedPlacementId) deletePlacement(selectedPlacementId);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[44px] text-red-500 hover:bg-red-500/10 transition-all font-semibold"
                  title="Delete element (DE)"
                >
                  <LuTrash2 className="h-4 w-4" />
                  <span className="text-[9px]">Delete</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wider">Modify Tools</span>
            </div>

            {/* Cluster: CATEGORY-SPECIFIC CONTROLS */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1.5">
                {selectedWallId && (
                  <button
                    type="button"
                    onClick={() => {
                      // Flip wall
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
                    className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400 text-[var(--text-strong)] transition-all font-semibold"
                    title="Flip wall direction (Spacebar)"
                  >
                    <MdOutlineFlip className="h-4 w-4 text-amber-500" />
                    <span className="text-[9px]">Flip Wall</span>
                  </button>
                )}

                {selectedDoorId && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const door = useLayoutDrawingStore.getState().doors.find((d) => d.id === selectedDoorId);
                        if (door) {
                          useLayoutDrawingStore.getState().updateDoor(door.id, {
                            hinge: door.hinge === "start" ? "end" : "start",
                          });
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400 text-[var(--text-strong)] transition-all font-semibold"
                      title="Flip hinge hand"
                    >
                      <LuArrowLeftRight className="h-4 w-4 text-amber-500" />
                      <span className="text-[9px]">Flip Hand</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const door = useLayoutDrawingStore.getState().doors.find((d) => d.id === selectedDoorId);
                        if (door) {
                          useLayoutDrawingStore.getState().updateDoor(door.id, {
                            swing: door.swing === 1 ? -1 : 1,
                          });
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400 text-[var(--text-strong)] transition-all font-semibold"
                      title="Flip swing direction"
                    >
                      <LuRotateCw className="h-4 w-4 text-amber-500" />
                      <span className="text-[9px]">Flip Swing</span>
                    </button>
                  </>
                )}

                {selectedWindowId && (
                  <button
                    type="button"
                    onClick={() => {
                      const win = useLayoutDrawingStore.getState().windows.find((w) => w.id === selectedWindowId);
                      if (win) {
                        useLayoutDrawingStore.getState().updateWindow(win.id, {
                          positionMm: win.positionMm,
                        });
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400 text-[var(--text-strong)] transition-all font-semibold"
                  >
                    <LuArrowLeftRight className="h-4 w-4 text-amber-500" />
                    <span className="text-[9px]">Flip Window</span>
                  </button>
                )}

                {selectedPlacementId && (
                  <button
                    type="button"
                    onClick={() => duplicatePlacement(selectedPlacementId)}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400 text-[var(--text-strong)] transition-all font-semibold"
                  >
                    <LuCopy className="h-4 w-4 text-amber-500" />
                    <span className="text-[9px]">Duplicate</span>
                  </button>
                )}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Element Controls</span>
            </div>

            {/* Cluster: SELECTION CLOSE */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={clearCurrentSelection}
                className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[50px] border border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all"
              >
                <span className="text-xs font-bold">Esc</span>
                <span className="text-[10px]">Deselect</span>
              </button>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Finish</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
