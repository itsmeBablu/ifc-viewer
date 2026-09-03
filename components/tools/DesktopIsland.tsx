"use client";

/**
 * DesktopIsland — unified central fixed workspace header & contextual capsule row for desktop /werkzeug.
 *
 * Requirements:
 *  1. Header IBV logo: contains the Arch ↔ MEP discipline switch (HeaderDisciplineToggle in ToolRibbon).
 *  2. Center top header: stable (NOT movable) category tabs:
 *     - In Arch: Build (default), Structure, Annotate (extensible for future tabs).
 *     - In MEP: All, HVAC, Piping, Electrical.
 *     - Selection: Modify status badge + Deselect (Esc) button.
 *  3. Directly below header: related capsules:
 *     - Outer row: transparent (no overarching background card).
 *     - Individual capsules: have their own liquid-glass pill background.
 *     - Compact height & padding.
 *     - Colorful icons for every tool.
 *     - Contextual modify swap when an element is selected in 3D.
 *     - Liquid glass hover tooltip (GlassTooltip) explaining each tool.
 */

import React, { useMemo } from "react";
import {
  LuAlignCenterHorizontal,
  LuBox,
  LuCheck,
  LuChevronDown,
  LuCopy,
  LuDoorOpen,
  LuFileText,
  LuFlipHorizontal2,
  LuGrid2X2,
  LuLayers3,
  LuMinus,
  LuMousePointer2,
  LuMove,
  LuPalette,
  LuPencil,
  LuRotate3D,
  LuRuler,
  LuScissors,
  LuShapes,
  LuTrash2,
  LuX,
  LuZap,
} from "react-icons/lu";
import {
  IconMarkupFloor,
  IconMarkupRoof,
  IconMarkupWall,
  IconMarkupWindow,
  IconMarkupCube,
  IconMarkupSphere,
  IconMarkupCylinder,
  IconMarkupCone,
  IconMarkupTorus,
  IconMarkupCapsule,
  IconMarkupPyramid,
} from "./MarkupIcons";
import GlassTooltip from "@/components/common/GlassTooltip";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import type { LayoutToolId } from "@/lib/layoutDrawing";
import type { MarkupShapeType } from "@/lib/toolMarkup";

/* ───── types & tab definitions ──────────────────────────────────── */

export interface DesktopCategoryTab {
  id: string;
  label: string;
}

export const ARCH_TABS: DesktopCategoryTab[] = [
  { id: "build", label: "Build" },
  { id: "structure", label: "Structure" },
  { id: "annotate", label: "Annotate" },
  { id: "insert", label: "Insert" },
];

export const MEP_TABS: DesktopCategoryTab[] = [
  { id: "all", label: "All" },
  { id: "hvac", label: "HVAC" },
  { id: "piping", label: "Piping" },
  { id: "electrical", label: "Electrical" },
];

type CapsuleItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  isDanger?: boolean;
  hasDropdown?: boolean;
};

export const SHAPE_ITEMS: Array<{
  id: MarkupShapeType;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  { id: "cube", label: "Box / Cube", hint: "3D Box geometry", icon: <IconMarkupCube className="h-3.5 w-3.5 text-amber-400 shrink-0" /> },
  { id: "sphere", label: "Sphere", hint: "3D Sphere geometry", icon: <IconMarkupSphere className="h-3.5 w-3.5 text-sky-400 shrink-0" /> },
  { id: "cylinder", label: "Cylinder", hint: "3D Cylinder geometry", icon: <IconMarkupCylinder className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> },
  { id: "cone", label: "Cone", hint: "3D Cone geometry", icon: <IconMarkupCone className="h-3.5 w-3.5 text-purple-400 shrink-0" /> },
  { id: "torus", label: "Torus", hint: "3D Torus geometry", icon: <IconMarkupTorus className="h-3.5 w-3.5 text-orange-400 shrink-0" /> },
  { id: "capsule", label: "Capsule", hint: "3D Capsule geometry", icon: <IconMarkupCapsule className="h-3.5 w-3.5 text-pink-400 shrink-0" /> },
  { id: "pyramid", label: "Pyramid", hint: "3D Pyramid geometry", icon: <IconMarkupPyramid className="h-3.5 w-3.5 text-yellow-400 shrink-0" /> },
];

const ARCH_BUILD_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "wall", label: "Wall", hint: "Draw architectural walls (W)", icon: <IconMarkupWall className="h-3.5 w-3.5 text-amber-500 shrink-0" /> },
  { id: "window", label: "Window", hint: "Place windows on walls", icon: <IconMarkupWindow className="h-3.5 w-3.5 text-sky-400 shrink-0" /> },
  { id: "door", label: "Door", hint: "Place doors on walls (D)", icon: <LuDoorOpen className="h-3 w-3 text-orange-500 shrink-0" /> },
  { id: "floor", label: "Floor", hint: "Sketch floor slab boundary", icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> },
  { id: "roof", label: "Roof", hint: "Sketch roof boundary", icon: <IconMarkupRoof className="h-3.5 w-3.5 text-violet-400 shrink-0" /> },
  { id: "lines", label: "Lines", hint: "Draw detail & sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <LuBox className="h-3 w-3 text-slate-300 shrink-0" /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <LuMinus className="h-3.5 w-3.5 text-indigo-400 stroke-[3] shrink-0" /> },
  { id: "stair", label: "Stair", hint: "Create architectural stairs (S)", icon: <LuLayers3 className="h-3 w-3 text-teal-400 shrink-0" /> },
  { id: "ramp", label: "Ramp", hint: "Create access ramps (R)", icon: <LuLayers3 className="h-3 w-3 text-lime-400 shrink-0" /> },
  { id: "materials", label: "Materials", hint: "Open material editor panel", icon: <LuPalette className="h-3 w-3 text-pink-400 shrink-0" /> },
  { id: "levels", label: "Levels", hint: "Manage building storeys & elevations", icon: <LuLayers3 className="h-3 w-3 text-cyan-400 shrink-0" /> },
];

const ARCH_STRUCTURE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <LuBox className="h-3 w-3 text-slate-300 shrink-0" /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <LuMinus className="h-3.5 w-3.5 text-indigo-400 stroke-[3] shrink-0" /> },
  { id: "floor", label: "Slab", hint: "Place structural concrete slab", icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> },
  { id: "grid", label: "Grid", hint: "Draw column grid lines (G)", icon: <LuGrid2X2 className="h-3 w-3 text-orange-400 shrink-0" /> },
];

const ARCH_ANNOTATE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "lines", label: "Lines", hint: "Draw detail sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
  { id: "dimension", label: "Dimension", hint: "Measure distance between elements", icon: <LuRuler className="h-3 w-3 text-yellow-400 shrink-0" /> },
  { id: "note", label: "Note", hint: "Place text note or callout", icon: <LuFileText className="h-3 w-3 text-teal-400 shrink-0" /> },
];

const ARCH_INSERT_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "shapes", label: "Shapes", hint: "Pick and place 3D shape (Box, Sphere, Cylinder, etc.)", icon: <LuShapes className="h-3.5 w-3.5 text-pink-400 shrink-0" />, hasDropdown: true },
  { id: "note", label: "Note", hint: "Insert 3D text note or callout", icon: <LuFileText className="h-3 w-3 text-teal-400 shrink-0" /> },
];

const MEP_ALL_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "duct", label: "Duct", hint: "Draw rectangular supply duct", icon: <span className="font-bold text-sky-400 text-xs shrink-0">▭</span> },
  { id: "pipe", label: "Pipe", hint: "Draw hydronic & sanitary piping", icon: <span className="font-bold text-cyan-400 text-xs shrink-0">○</span> },
  { id: "cabletray", label: "Tray", hint: "Route electrical cable tray", icon: <span className="font-bold text-amber-400 text-xs shrink-0">≋</span> },
  { id: "wire", label: "Wire", hint: "Draw electrical circuits & wiring", icon: <LuZap className="h-3 w-3 text-yellow-400 shrink-0" /> },
  { id: "equipment", label: "Equipment", hint: "Place mechanical & electrical equipment", icon: <LuBox className="h-3 w-3 text-orange-400 shrink-0" /> },
  { id: "workplane", label: "Work Plane", hint: "Set reference drawing plane (G)", icon: <LuGrid2X2 className="h-3 w-3 text-blue-400 shrink-0" /> },
];

const MODIFY_ITEMS: CapsuleItem[] = [
  { id: "move", label: "Move", hint: "Translate selected elements", icon: <LuMove className="h-3 w-3 text-sky-400 shrink-0" /> },
  { id: "rotate", label: "Rotate", hint: "Rotate selected elements around center", icon: <LuRotate3D className="h-3 w-3 text-emerald-400 shrink-0" /> },
  { id: "align", label: "Align", hint: "Align elements along X or Y axis", icon: <LuAlignCenterHorizontal className="h-3 w-3 text-purple-400 shrink-0" /> },
  { id: "mirror", label: "Mirror", hint: "Mirror selection about an axis", icon: <LuFlipHorizontal2 className="h-3 w-3 text-indigo-400 shrink-0" /> },
  { id: "copy", label: "Copy", hint: "Duplicate selected elements", icon: <LuCopy className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "trim", label: "Trim", hint: "Trim or extend elements (T)", icon: <LuScissors className="h-3 w-3 text-pink-400 shrink-0" /> },
  { id: "delete", label: "Delete", hint: "Delete selected elements (Del)", icon: <LuTrash2 className="h-3 w-3 text-red-500 shrink-0" />, isDanger: true },
  { id: "deselect", label: "Deselect", hint: "Clear active selection (Esc)", icon: <LuX className="h-3 w-3 text-zinc-400 shrink-0" /> },
];

/* ───── component ───────────────────────────────────────────────── */

export default function DesktopIsland() {
  /* ── store subscriptions ─────────────────────────────── */
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  const archCategory = useLayoutDrawingStore((s) => s.desktopArchCategory);
  const setArchCategory = useLayoutDrawingStore((s) => s.setDesktopArchCategory);
  const mepCategory = useLayoutDrawingStore((s) => s.desktopMepCategory);
  const setMepCategory = useLayoutDrawingStore((s) => s.setDesktopMepCategory);

  const armedMarkupTool = useToolMarkupStore((s) => s.armedTool);
  const [shapesDropdownOpen, setShapesDropdownOpen] = React.useState(false);
  const shapesMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  React.useEffect(() => {
    if (!shapesDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(e.target as Node)) {
        setShapesDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shapesDropdownOpen]);

  /* ── context selection detection ─────────────────────── */
  const hasContextSelection = useMemo(() => {
    return (
      (selectedElements && selectedElements.length > 0) ||
      Boolean(selectedWallId) ||
      Boolean(selectedDoorId) ||
      Boolean(selectedWindowId) ||
      Boolean(selectedSlabId) ||
      Boolean(selectedStairId) ||
      Boolean(selectedRampId)
    );
  }, [
    selectedElements,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    selectedSlabId,
    selectedStairId,
    selectedRampId,
  ]);

  const modifyTitle = useMemo(() => {
    if (selectedWallId) return "Modify · Wall";
    if (selectedDoorId) return "Modify · Door";
    if (selectedWindowId) return "Modify · Window";
    if (selectedSlabId) return "Modify · Slab";
    if (selectedStairId) return "Modify · Stair";
    if (selectedRampId) return "Modify · Ramp";
    if (selectedElements && selectedElements.length > 1) {
      return `Modify · ${selectedElements.length} Items`;
    }
    return "Modify";
  }, [
    selectedElements,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    selectedSlabId,
    selectedStairId,
    selectedRampId,
  ]);

  /* ── active capsule set ──────────────────────────────── */
  const activeCapsules = useMemo(() => {
    if (hasContextSelection) {
      return MODIFY_ITEMS;
    }
    if (mepModeActive) {
      return MEP_ALL_ITEMS;
    }
    switch (archCategory) {
      case "structure":
        return ARCH_STRUCTURE_ITEMS;
      case "annotate":
        return ARCH_ANNOTATE_ITEMS;
      case "insert":
        return ARCH_INSERT_ITEMS;
      case "build":
      default:
        return ARCH_BUILD_ITEMS;
    }
  }, [hasContextSelection, mepModeActive, archCategory]);

  const [alignAxis, setAlignAxis] = React.useState<"x" | "y">("x");

  /* ── handlers ────────────────────────────────────────── */
  const clearSelection = () => {
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
  };

  const handleSelectShape = (shapeId: MarkupShapeType) => {
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    useToolMarkupStore.getState().setArmedTool(shapeId);
    setShapesDropdownOpen(false);
  };

  const handleCapsuleClick = (id: string) => {
    if (id === "select") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool(null);
      setShapesDropdownOpen(false);
      return;
    }
    if (id === "shapes") {
      setShapesDropdownOpen((prev) => !prev);
      return;
    }
    if (id === "note") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool("note");
      setShapesDropdownOpen(false);
      return;
    }
    if (id === "deselect") {
      clearSelection();
      return;
    }
    if (id === "materials") {
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }
    if (id === "delete") {
      void useLayoutDrawingStore.getState().deleteSelected();
      clearSelection();
      return;
    }
    if (id === "move") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setTransformMode("translate");
      return;
    }
    if (id === "rotate") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setTransformMode("rotate");
      return;
    }
    if (id === "align") {
      void useLayoutDrawingStore.getState().alignSelected(alignAxis);
      setAlignAxis((axis) => (axis === "x" ? "y" : "x"));
      return;
    }
    if (id === "mirror") {
      const store = useLayoutDrawingStore.getState();
      const wall = store.walls.find((item) => item.id === store.selectedWallId);
      if (wall) {
        void store.mirrorSelected(
          { xMm: wall.startXmm, yMm: wall.startYmm },
          { xMm: wall.endXmm, yMm: wall.endYmm },
        );
        return;
      }
      const column = store.columns.find((item) =>
        store.selectedElements.some((ref) => ref.kind === "column" && ref.id === item.id),
      );
      const slab = store.slabs.find((item) => item.id === store.selectedSlabId);
      const centerX = column?.xMm ?? (slab ? (slab.minXmm + slab.maxXmm) / 2 : 0);
      void store.mirrorSelected(
        { xMm: centerX, yMm: -1_000_000 },
        { xMm: centerX, yMm: 1_000_000 },
      );
      return;
    }
    if (id === "copy") {
      const markup = useToolMarkupStore.getState();
      if (markup.selectedPlacementId) {
        void markup.duplicatePlacement(markup.selectedPlacementId);
      } else {
        void useLayoutDrawingStore.getState().copySelected(100, 100);
      }
      return;
    }
    if (id === "trim") {
      const active = armed === "trim";
      useLayoutDrawingStore.getState().setArmedLayoutTool(active ? null : "trim");
      return;
    }

    useLayoutDrawingStore.getState().setArmedLayoutTool(id as LayoutToolId);
  };

  const isCapsuleActive = (id: string) => {
    if (id === "deselect" || id === "delete" || id === "mirror" || id === "copy" || id === "align") return false;
    if (id === "move") {
      return useToolMarkupStore.getState().transformMode === "translate";
    }
    if (id === "rotate") {
      return useToolMarkupStore.getState().transformMode === "rotate";
    }
    if (id === "trim") {
      return armed === "trim";
    }
    if (id === "shapes") {
      return SHAPE_ITEMS.some((s) => s.id === armedMarkupTool) || shapesDropdownOpen;
    }
    if (id === "note") {
      return armedMarkupTool === "note";
    }
    if (id === "select") return armed === null && armedMarkupTool === null;
    return armed === id;
  };

  return (
    <>
      {/* ── 1. Center Top Header: Stable Category Tabs (NOT movable) ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center select-none">
        <div className="desktop-center-tabs-pill">
          {hasContextSelection ? (
            <div className="flex items-center gap-1.5 px-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-500 dark:text-yellow-300">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span>{modifyTitle}</span>
              </span>
              <button
                type="button"
                onClick={clearSelection}
                title="Deselect (Esc)"
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--glass-inset-bg)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
              >
                <LuX className="h-3 w-3" />
              </button>
            </div>
          ) : !mepModeActive ? (
            <div className="flex items-center gap-0.5">
              {ARCH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setArchCategory(tab.id as "build" | "structure" | "annotate" | "insert")}
                  className={`desktop-center-tab-btn ${archCategory === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              {MEP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMepCategory(tab.id as "all" | "hvac" | "piping" | "electrical")}
                  className={`desktop-center-tab-btn ${mepCategory === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Directly Below Header: Related Capsules ─────────────── */}
      <div
        className="desktop-capsules-container fixed top-[54px] left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center justify-center select-none"
        style={{
          maxWidth: rightPanelOpen ? "calc(100vw - 360px)" : "calc(100vw - 48px)",
        }}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto thin-scroll desktop-capsule-row-inner py-0.5 px-2 max-w-full">
          {activeCapsules.map((item) => {
            const active = isCapsuleActive(item.id);
            const isShapes = item.id === "shapes";
            const activeShape = isShapes ? SHAPE_ITEMS.find((s) => s.id === armedMarkupTool) : null;
            const displayIcon = activeShape ? activeShape.icon : item.icon;
            const displayLabel = activeShape ? `Shapes (${activeShape.label.split(" ")[0]})` : item.label;

            const buttonContent = (
              <button
                type="button"
                onClick={() => handleCapsuleClick(item.id)}
                className={`desktop-capsule-btn ${active ? "is-active" : ""} ${item.isDanger ? "is-danger" : ""}`}
                aria-pressed={active}
                aria-haspopup={isShapes ? "menu" : undefined}
                aria-expanded={isShapes ? shapesDropdownOpen : undefined}
                title={item.label}
              >
                {displayIcon}
                <span className="leading-none">{displayLabel}</span>
                {item.hasDropdown && (
                  <LuChevronDown
                    className={`h-2.5 w-2.5 opacity-60 ml-0.5 transition-transform duration-200 ${
                      shapesDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>
            );

            if (isShapes) {
              return (
                <div key={item.id} ref={shapesMenuRef} className="relative shrink-0">
                  <GlassTooltip
                    label={item.label}
                    hint={item.hint}
                    className="shrink-0"
                    disabled={shapesDropdownOpen}
                  >
                    {buttonContent}
                  </GlassTooltip>

                  {shapesDropdownOpen && (
                    <div
                      className="desktop-shapes-dropdown absolute top-[calc(100%+6px)] left-0 z-[120] min-w-[210px] p-1.5 rounded-xl animate-in fade-in zoom-in-95 duration-150"
                      role="menu"
                      aria-label="Pick a 3D Shape"
                    >
                      <div className="px-2 py-1 mb-1 border-b border-[var(--panel-divider)] flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wide uppercase text-[var(--text-muted)]">
                          Pick a 3D Shape
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)] font-medium">7 Shapes</span>
                      </div>
                      <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto thin-scroll">
                        {SHAPE_ITEMS.map((shape) => {
                          const isSelected = armedMarkupTool === shape.id;
                          return (
                            <button
                              key={shape.id}
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectShape(shape.id);
                              }}
                              className={`desktop-shape-option flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                                isSelected ? "is-active" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="shrink-0">{shape.icon}</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-[11px] leading-tight text-[var(--text-strong)]">
                                    {shape.label}
                                  </span>
                                  <span className="text-[9px] text-[var(--text-muted)] truncate">
                                    {shape.hint}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <LuCheck className="text-yellow-400 h-3.5 w-3.5 shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <GlassTooltip
                key={item.id}
                label={item.label}
                hint={item.hint}
                className="shrink-0"
              >
                {buttonContent}
              </GlassTooltip>
            );
          })}
        </div>
      </div>
    </>
  );
}
