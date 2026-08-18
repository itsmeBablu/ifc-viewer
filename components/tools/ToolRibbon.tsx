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
} from "react-icons/lu";
import {
  MdZoomInMap,
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

type RibbonTab = "architecture" | "shapes" | "annotate" | "view" | "manage";

interface ToolRibbonProps {
  viewerRef: RefObject<WerkzeugViewer3DHandle | null>;
  onFile: (file: File) => void;
  isLoadingModel: boolean;
}

export default function ToolRibbon({
  viewerRef,
  onFile,
  isLoadingModel,
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

  const [activeTab, setActiveTab] = useState<RibbonTab>("architecture");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto switch ribbon tab when tools are selected from other triggers
  useEffect(() => {
    if (armedLayoutTool) {
      setActiveTab("architecture");
    } else if (armedTool && armedTool !== "note") {
      setActiveTab("shapes");
    }
  }, [armedLayoutTool, armedTool]);

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
          { id: "architecture", label: "Architecture / Build" },
          { id: "shapes", label: "3D Shapes & Primitives" },
          { id: "annotate", label: "Annotate & Measure" },
          { id: "view", label: "View & Display" },
          { id: "manage", label: "Manage / IFC Tree" },
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
      </div>

      {/* Ribbon Content Panel for Active Tab */}
      <div className="flex h-20 items-center gap-3 overflow-x-auto px-4 py-2 thin-scroll">
        {/* TAB 1: ARCHITECTURE / BUILD */}
        {activeTab === "architecture" && (
          <div className="flex items-center gap-3">
            {/* Group: Walls */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("wall")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
                    armedLayoutTool === "wall"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupWall className="h-5 w-5" />
                  <span className="text-[10px]">Wall (W)</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Wall</span>
            </div>

            {/* Group: Openings (Doors & Windows) */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("door")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
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
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
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

            {/* Group: Slabs & Roofs */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("floor")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
                    armedLayoutTool === "floor"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupFloor className="h-5 w-5" />
                  <span className="text-[10px]">Floor / Slab</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLayoutTool("roof")}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
                    armedLayoutTool === "roof"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupRoof className="h-5 w-5" />
                  <span className="text-[10px]">Roof</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Flooring</span>
            </div>

            {/* Group: Floor / Story Elevation Select */}
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
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Floor Constraint</span>
            </div>
          </div>
        )}

        {/* TAB 2: 3D SHAPES & PRIMITIVES */}
        {activeTab === "shapes" && (
          <div className="flex items-center gap-3">
            {/* Primitives */}
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
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">3D Primitives</span>
            </div>

            {/* Transform Gizmo Modes */}
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
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Gizmo Control</span>
            </div>

            {/* Snapping Options */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSnapToFaces(!snapToFaces)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                    snapToFaces
                      ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                  }`}
                >
                  Snap to Faces {snapToFaces ? "✓" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setGridSnap(!gridSnap)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                    gridSnap
                      ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                  }`}
                >
                  Grid Snap {gridSnap ? "✓" : ""}
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Precision Snap</span>
            </div>
          </div>
        )}

        {/* TAB 3: ANNOTATE & MEASURE */}
        {activeTab === "annotate" && (
          <div className="flex items-center gap-3">
            {/* Measure Tool */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setArmedLayoutTool(null);
                    setArmedTool(armedTool === "cube" ? null : "cube");
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuRuler className="h-5 w-5 text-amber-500" />
                  <span className="text-[10px]">Measure (M)</span>
                </button>
                {measurements.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMeasurements}
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Clear ({measurements.length})
                  </button>
                )}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dimension Tape</span>
            </div>

            {/* Sticky Notes / Pins */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setArmedLayoutTool(null);
                    setArmedTool(armedTool === "note" ? null : "note");
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all ${
                    armedTool === "note"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  <IconMarkupNote className="h-5 w-5" />
                  <span className="text-[10px]">Sticky Note</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tags</span>
            </div>

            {/* Element Inspector Trigger */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightPanelOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-all"
                >
                  <LuSlidersHorizontal className="h-5 w-5 text-indigo-400" />
                  <span className="text-[10px]">BIM Properties</span>
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Property Sets</span>
            </div>
          </div>
        )}

        {/* TAB 4: VIEW & CAMERA */}
        {activeTab === "view" && (
          <div className="flex items-center gap-3">
            {/* Standard Ortho & Iso Views */}
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
                    className="flex flex-col items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)] hover:text-[var(--text-strong)] hover:border-amber-400 transition-all"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Camera Views</span>
            </div>

            {/* Shading Mode */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <div className="flex items-center gap-1">
                {(["realistic", "fullColor", "light", "wireframe"] as RenderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRenderMode(mode)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize border transition-all ${
                      renderMode === mode
                        ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-muted)]"
                    }`}
                  >
                    {mode === "fullColor" ? "Shaded" : mode}
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Shading Style</span>
            </div>

            {/* Fit Model */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => viewerRef.current?.fitVisible?.()}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)] hover:border-amber-400 transition-all"
              >
                <MdZoomInMap className="h-4 w-4 text-amber-500" />
                <span>Zoom Extents</span>
              </button>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Framing</span>
            </div>
          </div>
        )}

        {/* TAB 5: MANAGE / IFC TREE */}
        {activeTab === "manage" && (
          <div className="flex items-center gap-3">
            {/* IFC Tree Dock Toggle */}
            <div className="flex flex-col items-center gap-1 border-r border-[var(--panel-divider)]/60 pr-3">
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-semibold text-xs border transition-all ${
                  rightPanelOpen
                    ? "border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] text-[var(--text-body)]"
                }`}
              >
                <LuLayers className="h-4 w-4" />
                <span>IFC Spatial Tree {rightPanelOpen ? "Active" : "Closed"}</span>
              </button>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Project Browser</span>
            </div>

            {/* Export Actions */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveFrag}
                  className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all"
                >
                  Export .frag
                </button>
                <button
                  type="button"
                  onClick={handleSaveIfc}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  Export .ifc
                </button>
              </div>
              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">BIM Export</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
