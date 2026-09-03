"use client";

/**
 * DesktopIsland — unified central fixed workspace header & contextual capsule row for desktop /werkzeug.
 *
 * Features:
 *  1. Center top header: stable category tabs with GSAP animated underline:
 *     - In Arch: Build (default), Structure, Annotate, Insert.
 *     - In MEP: All, HVAC, Piping, Electrical.
 *     - Selection: Modify status badge + Deselect (Esc) button.
 *  2. Directly below header: related capsules:
 *     - Distinct top-60px padding to avoid any overlap with header.
 *     - Outer row: transparent, no shadow.
 *     - Individual capsules: clean glass pill, no blurry shadows.
 *     - Micro-stagger animation on tab/category switch.
 *     - 3D Shapes dropdown portaled to document.body (z-[9999]) to avoid overflow clipping.
 */

import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
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
  const [alignAxis, setAlignAxis] = useState<"x" | "y">("x");

  const archCategory = useLayoutDrawingStore((s) => s.desktopArchCategory);
  const setArchCategory = useLayoutDrawingStore((s) => s.setDesktopArchCategory);
  const mepCategory = useLayoutDrawingStore((s) => s.desktopMepCategory);
  const setMepCategory = useLayoutDrawingStore((s) => s.setDesktopMepCategory);

  const armedMarkupTool = useToolMarkupStore((s) => s.armedTool);
  const transformMode = useToolMarkupStore((s) => s.transformMode);

  /* ── Tab thumb refs & animations ──────────────────────── */
  const tabThumbRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const tabThumbReadyRef = useRef(false);

  /* ── Capsules animation ref ──────────────────────────── */
  const capsulesRowRef = useRef<HTMLDivElement>(null);

  /* ── Shapes dropdown refs & state ────────────────────── */
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const shapesButtonRef = useRef<HTMLButtonElement>(null);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const [shapesMenuPos, setShapesMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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

  /* ── 1. GSAP squeeze-and-release underline, shared with Floors / Attributes ── */
  useLayoutEffect(() => {
    const thumb = tabThumbRef.current;
    if (!thumb) return;

    if (hasContextSelection) {
      gsap.to(thumb, { opacity: 0, duration: 0.18, overwrite: true });
      return;
    }

    const activeId = mepModeActive ? mepCategory : archCategory;
    const target = tabRefs.current[activeId];
    if (!target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const insetX = 10;
    const toX = target.offsetLeft + insetX;
    const toW = Math.max(target.offsetWidth - insetX * 2, 12);
    const properties = {
      x: toX,
      width: toW,
      opacity: 1,
      backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0.95)" : "rgba(250, 204, 21, 0.95)",
    };

    if (!tabThumbReadyRef.current || reduceMotion) {
      gsap.set(thumb, properties);
      tabThumbReadyRef.current = true;
      return;
    }

    const fromX = Number(gsap.getProperty(thumb, "x"));
    const fromW = Number(gsap.getProperty(thumb, "width"));
    const midX = fromX + (toX - fromX) * 0.5;
    const midW = Math.max(18, Math.min(fromW, toW) * 0.45);
    gsap.timeline({ overwrite: true })
      .to(thumb, {
        x: midX + (fromW - midW) / 2,
        width: midW,
        opacity: 1,
        backgroundColor: properties.backgroundColor,
        duration: 0.18,
        ease: "power2.in",
      })
      .to(thumb, {
        x: toX,
        width: toW,
        duration: 0.26,
        ease: "power3.out",
      });
  }, [archCategory, mepCategory, mepModeActive, hasContextSelection]);

  // Keep thumb aligned on resize
  useEffect(() => {
    const handleResize = () => {
      if (hasContextSelection) return;
      const activeId = mepModeActive ? mepCategory : archCategory;
      const target = tabRefs.current[activeId];
      const thumb = tabThumbRef.current;
      if (!target || !thumb) return;
      const insetX = 10;
      gsap.set(thumb, {
        x: target.offsetLeft + insetX,
        width: Math.max(target.offsetWidth - insetX * 2, 12),
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [archCategory, mepCategory, mepModeActive, hasContextSelection]);

  /* ── 2. Position & click outside for Shapes dropdown ──── */
  const toggleShapesDropdown = () => {
    if (!shapesDropdownOpen) {
      if (shapesButtonRef.current) {
        const rect = shapesButtonRef.current.getBoundingClientRect();
        const menuWidth = 220;
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
        setShapesMenuPos({ top: rect.bottom + 8, left });
      }
      setShapesDropdownOpen(true);
    } else {
      setShapesDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (!shapesDropdownOpen) return;
    const updatePos = () => {
      if (shapesButtonRef.current) {
        const rect = shapesButtonRef.current.getBoundingClientRect();
        const menuWidth = 220;
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
        setShapesMenuPos({ top: rect.bottom + 8, left });
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        shapesMenuRef.current &&
        !shapesMenuRef.current.contains(target) &&
        shapesButtonRef.current &&
        !shapesButtonRef.current.contains(target)
      ) {
        setShapesDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesDropdownOpen(false);
    };

    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shapesDropdownOpen]);

  const handleSelectShape = (shapeId: MarkupShapeType) => {
    useToolMarkupStore.getState().setArmedTool(shapeId);
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    setShapesDropdownOpen(false);
  };

  /* ── modify title label ──────────────────────────────── */
  const modifyTitle = useMemo(() => {
    if (selectedWallId) return "Modify · Wall";
    if (selectedDoorId) return "Modify · Door";
    if (selectedWindowId) return "Modify · Window";
    if (selectedSlabId) return "Modify · Slab";
    if (selectedStairId) return "Modify · Stair";
    if (selectedRampId) return "Modify · Ramp";
    if (selectedElements && selectedElements.length > 0) {
      return `Modify (${selectedElements.length})`;
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

  /* ── active capsules list ────────────────────────────── */
  const activeCapsules: CapsuleItem[] = useMemo(() => {
    if (hasContextSelection) {
      return MODIFY_ITEMS.map((item) =>
        item.id === "align"
          ? { ...item, label: `Align ${alignAxis.toUpperCase()}` }
          : item,
      );
    }

    if (!mepModeActive) {
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
    } else {
      switch (mepCategory) {
        case "hvac":
          return MEP_ALL_ITEMS.filter((i) => i.id === "select" || i.id === "duct" || i.id === "equipment");
        case "piping":
          return MEP_ALL_ITEMS.filter((i) => i.id === "select" || i.id === "pipe" || i.id === "equipment");
        case "electrical":
          return MEP_ALL_ITEMS.filter((i) => i.id === "select" || i.id === "cabletray" || i.id === "wire" || i.id === "equipment");
        case "all":
        default:
          return MEP_ALL_ITEMS;
      }
    }
  }, [hasContextSelection, alignAxis, mepModeActive, archCategory, mepCategory]);

  /* ── 3. Refractive liquid-glass transition on category switch ── */
  useLayoutEffect(() => {
    if (!capsulesRowRef.current) return;
    const buttons = capsulesRowRef.current.querySelectorAll(".desktop-capsule-btn");
    if (!buttons || buttons.length === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const row = capsulesRowRef.current;
    const context = gsap.context(() => {
      gsap.fromTo(row,
        { autoAlpha: 0.55, scaleX: 0.94, filter: "blur(6px) saturate(1.35)" },
        { autoAlpha: 1, scaleX: 1, filter: "blur(0px) saturate(1)", duration: 0.42, ease: "power3.out", overwrite: true },
      );
      gsap.fromTo(buttons,
        { autoAlpha: 0, x: (index) => (index - (buttons.length - 1) / 2) * -7, y: 7, scale: 0.9, rotateX: -18 },
        { autoAlpha: 1, x: 0, y: 0, scale: 1, rotateX: 0, duration: 0.46, stagger: 0.025, ease: "back.out(1.5)", overwrite: true },
      );
    }, row);
    return () => context.revert();
  }, [activeCapsules, hasContextSelection]);

  /* ── actions ─────────────────────────────────────────── */
  const clearSelection = () => {
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
  };

  const handleCapsuleClick = (id: string) => {
    if (id === "select") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool(null);
      clearSelection();
      return;
    }

    if (id === "shapes") {
      toggleShapesDropdown();
      return;
    }

    if (id === "note") {
      const active = armedMarkupTool === "note";
      useToolMarkupStore.getState().setArmedTool(active ? null : "note");
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      return;
    }

    if (id === "materials" || id === "levels") {
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool(null);
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }

    // Modify actions
    if (id === "deselect") {
      clearSelection();
      return;
    }
    if (id === "delete") {
      const markup = useToolMarkupStore.getState();
      if (markup.selectedPlacementId) {
        markup.deletePlacement(markup.selectedPlacementId);
      } else {
        void useLayoutDrawingStore.getState().deleteSelected();
      }
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
      const wall = store.walls.find((w) => w.id === store.selectedWallId);
      if (wall) {
        void store.mirrorSelected(
          { xMm: wall.startXmm, yMm: wall.startYmm },
          { xMm: wall.endXmm, yMm: wall.endYmm },
        );
      } else {
        const column = store.columns.find((c) =>
          store.selectedElements.some((ref) => ref.kind === "column" && ref.id === c.id)
        );
        const slab = store.slabs.find((s) => s.id === store.selectedSlabId);
        const centerX = column?.xMm ?? (slab ? (slab.minXmm + slab.maxXmm) / 2 : 0);
        void store.mirrorSelected(
          { xMm: centerX, yMm: -1_000_000 },
          { xMm: centerX, yMm: 1_000_000 },
        );
      }
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
      return transformMode === "translate";
    }
    if (id === "rotate") {
      return transformMode === "rotate";
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
      {/* ── 1. Center Top Header: Stable Category Tabs with Moving Thumb ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center select-none">
        <div className="desktop-clean-tabs-row">
          {/* Animated V-Yellow underline */}
          {!hasContextSelection && (
            <div
              ref={tabThumbRef}
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full z-[1]"
              aria-hidden="true"
            />
          )}

          {hasContextSelection ? (
            <div className="flex items-center gap-1.5 px-2 relative z-[2]">
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
            <div className="flex items-center gap-0.5 relative z-[2]">
              {ARCH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  type="button"
                  onClick={() => setArchCategory(tab.id as "build" | "structure" | "annotate" | "insert")}
                  className={`desktop-clean-tab-btn ${archCategory === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-0.5 relative z-[2]">
              {MEP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  type="button"
                  onClick={() => setMepCategory(tab.id as "all" | "hvac" | "piping" | "electrical")}
                  className={`desktop-clean-tab-btn ${mepCategory === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Directly Below Header: Related Capsules (top-[60px] padding) ── */}
      <div
        className="desktop-capsules-container fixed top-[60px] left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center justify-center select-none"
        style={{
          maxWidth: rightPanelOpen ? "calc(100vw - 360px)" : "calc(100vw - 48px)",
        }}
      >
        <div
          ref={capsulesRowRef}
          className="flex items-center gap-1.5 overflow-x-auto thin-scroll desktop-capsule-row-inner py-0.5 px-2 max-w-full"
        >
          {activeCapsules.map((item) => {
            const active = isCapsuleActive(item.id);
            const isShapes = item.id === "shapes";
            const activeShape = isShapes ? SHAPE_ITEMS.find((s) => s.id === armedMarkupTool) : null;
            const displayIcon = activeShape ? activeShape.icon : item.icon;
            const displayLabel = activeShape ? `Shapes (${activeShape.label.split(" ")[0]})` : item.label;

            const buttonContent = (
              <button
                ref={isShapes ? shapesButtonRef : undefined}
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

            return (
              <GlassTooltip
                key={item.id}
                label={item.label}
                hint={item.hint}
                className="shrink-0"
                disabled={isShapes && shapesDropdownOpen}
              >
                {buttonContent}
              </GlassTooltip>
            );
          })}
        </div>
      </div>

      {/* ── 3. Portaled Shapes Dropdown Menu (immune to overflow clipping) ── */}
      {shapesDropdownOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={shapesMenuRef}
          style={{ top: shapesMenuPos.top, left: shapesMenuPos.left }}
          className="desktop-shapes-dropdown fixed z-[9999] min-w-[210px] p-1.5 rounded-xl animate-in fade-in zoom-in-95 duration-150"
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
        </div>,
        document.body
      )}
    </>
  );
}
