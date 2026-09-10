"use client";
import WallAttachControl from "./WallAttachControl";
import { activateModifyTool } from "./ModifyTools";
import { useModifyStore } from "@/store/useModifyStore";

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
  LuCircleDot,
  LuCompass,
  LuCopy,
  LuDoorOpen,
  LuFileText,
  LuFlipHorizontal2,
  LuGrid2X2,
  LuLayers3,
  LuMinus,
  LuMousePointer2,
  LuMove,
  LuPencil,
  LuRotate3D,
  LuRuler,
  LuScissors,
  LuShapes,
  LuTrash2,
  LuX,
  LuZap,
  LuArmchair,
  LuArrowUpToLine,
  LuCylinder,
  LuCable,
  LuCamera,
  LuDownload,
  LuSparkles,
  LuSunMedium,
  LuWand,
} from "react-icons/lu";
import {
  IconMarkupStair,
  IconMarkupRamp,
  IconMarkupColumn,
  IconMarkupBeam,
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

import { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";
import { useViewDisplayStore, type RenderPreset } from "@/store/useViewDisplayStore";
import { enterRenderView } from "./RenderViewControls";
import { useModelScene } from "./WerkzeugModelSceneContext";



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
  { id: "render", label: "Render" },
];

export const MEP_TABS: DesktopCategoryTab[] = [
  { id: "all", label: "All" },
  { id: "hvac", label: "Duct" },
  { id: "piping", label: "Piping" },
  { id: "wiring", label: "Wiring" },
  { id: "electrical", label: "Electrical" },
  { id: "components", label: "Components" },
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
  { id: "wall", label: "Wall", hint: "Choose a wall type and draw (W)", icon: <IconMarkupWall className="h-3.5 w-3.5 text-amber-500 shrink-0" />, hasDropdown: true },
  { id: "window", label: "Window", hint: "Choose a window type and place it", icon: <IconMarkupWindow className="h-3.5 w-3.5 text-sky-400 shrink-0" />, hasDropdown: true },
  { id: "door", label: "Door", hint: "Choose a door type and place it (D)", icon: <LuDoorOpen className="h-3 w-3 text-orange-500 shrink-0" />, hasDropdown: true },
  { id: "floor", label: "Floor", hint: "Choose a floor type and sketch its boundary", icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" />, hasDropdown: true },
  { id: "roof", label: "Roof", hint: "Choose a roof type and sketch its boundary", icon: <IconMarkupRoof className="h-3.5 w-3.5 text-violet-400 shrink-0" />, hasDropdown: true },
  { id: "lines", label: "Lines", hint: "Draw detail & sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
  { id: "stair", label: "Stair", hint: "Create architectural stairs (S)", icon: <IconMarkupStair className="h-3 w-3 text-teal-400 shrink-0" /> },
  { id: "ramp", label: "Ramp", hint: "Create access ramps (R)", icon: <IconMarkupRamp className="h-3 w-3 text-lime-400 shrink-0" /> },
];

const ARCH_STRUCTURE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <IconMarkupColumn className="h-3 w-3 text-slate-300 shrink-0" /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <IconMarkupBeam className="h-3.5 w-3.5 text-indigo-400 shrink-0" /> },
  { id: "floor", label: "Slab", hint: "Choose a structural slab type", icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" />, hasDropdown: true },
  { id: "grid", label: "Grid", hint: "Draw column grid lines (G)", icon: <LuGrid2X2 className="h-3 w-3 text-orange-400 shrink-0" /> },
];

const TYPE_CATEGORY: Partial<Record<string, ElementTypeDefinition["category"]>> = {
  wall: "Wall",
  door: "Door",
  window: "Window",
  floor: "Floor",
  roof: "Roof",
  column: "Column",
  beam: "Beam",
  stair: "Stair",
  ramp: "Ramp",
};


const ARCH_ANNOTATE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "dimension-distance", label: "Aligned Dim", hint: "Measure linear distance between elements or points", icon: <LuRuler className="h-3.5 w-3.5 text-yellow-400 shrink-0" /> },
  { id: "dimension-angle", label: "Angular Dim", hint: "Measure angle between two reference edges or lines", icon: <LuCompass className="h-3.5 w-3.5 text-sky-400 shrink-0" /> },
  { id: "dimension-arc", label: "Arc / Radial", hint: "Measure arc radius and circumference segment length", icon: <LuCircleDot className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> },
  { id: "note", label: "Note", hint: "Place 2D/3D text note or callout", icon: <LuFileText className="h-3 w-3 text-teal-400 shrink-0" /> },
  { id: "lines", label: "Lines", hint: "Draw 2D detail sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
];

const ARCH_INSERT_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "component", label: "Component", hint: "Place furniture and architectural components", icon: <LuArmchair className="h-3.5 w-3.5 text-amber-400 shrink-0" /> },
  { id: "shapes", label: "Shapes", hint: "Pick and place 3D shape (Box, Sphere, Cylinder, etc.)", icon: <LuShapes className="h-3.5 w-3.5 text-pink-400 shrink-0" />, hasDropdown: true },
  { id: "note", label: "Note", hint: "Insert 3D text note or callout", icon: <LuFileText className="h-3 w-3 text-teal-400 shrink-0" /> },
];

export type RenderTextureOption = {
  id: string;
  name: string;
  desc: string;
  color: string;
};

export const WALL_TEXTURES: RenderTextureOption[] = [
  { id: "concrete", name: "Architectural Concrete", desc: "Smooth exposed formwork grey", color: "#94a3b8" },
  { id: "brick", name: "Red Brick", desc: "Classic running bond masonry", color: "#b91c1c" },
  { id: "exterior-stucco-fine", name: "Fine White Stucco", desc: "Clean modern exterior finish", color: "#f8fafc" },
  { id: "plaster-smooth-white", name: "Smooth Gypsum Plaster", desc: "Minimalist interior finish", color: "#f1f5f9" },
  { id: "facade-timber-slat", name: "Timber Slat Cladding", desc: "Natural architectural wood louvers", color: "#b45309" },
  { id: "marble-nero-marquina", name: "Nero Marquina Marble", desc: "High-contrast dark polished marble", color: "#18181b" },
  { id: "marble-calacatta-gold", name: "Calacatta Gold Marble", desc: "Luxury Italian white & gold marble", color: "#f8fafc" },
];

export const ROOF_TEXTURES: RenderTextureOption[] = [
  { id: "facade-standing-seam-zinc", name: "Standing Seam Anthracite", desc: "Architectural dark zinc seams", color: "#334155" },
  { id: "standing-seam-zinc", name: "Titanium Zinc Seam", desc: "Light metallic standing seam", color: "#64748b" },
  { id: "terracotta-roof-tile", name: "Terracotta Clay Tile", desc: "Traditional warm pitched roof", color: "#c2410c" },
  { id: "slate-roof-tile", name: "Natural Slate Tile", desc: "Fine dark anthracite slate shingle", color: "#334155" },
  { id: "flat-roof-bitumen", name: "Bituminous Gravel", desc: "Commercial aggregate flat roof", color: "#475569" },
  { id: "roof-epdm-membrane-black", name: "EPDM Membrane", desc: "Smooth waterproof roof membrane", color: "#18181b" },
];

export const FLOOR_TEXTURES: RenderTextureOption[] = [
  { id: "hardwood-herringbone-oak", name: "Herringbone Oak Parquet", desc: "Warm luxury French oak pattern", color: "#b45309" },
  { id: "hardwood-floor", name: "Natural Plank Hardwood", desc: "Classic architectural timber boards", color: "#92400e" },
  { id: "carrara-marble", name: "Carrara Polished Marble", desc: "Clean Italian white stone tiles", color: "#f8fafc" },
  { id: "floor-terrazzo-venetian", name: "Venetian Terrazzo", desc: "Multi-tone mineral aggregate", color: "#d6d3d1" },
  { id: "ceramic-floor-tile", name: "Porcelain Tile 60x60", desc: "Modern architectural grey grid", color: "#e2e8f0" },
  { id: "concrete", name: "Polished Concrete", desc: "Reflective industrial loft finish", color: "#64748b" },
];

const ARCH_RENDER_ITEMS: CapsuleItem[] = [
  {
    id: "auto-textures",
    label: "Auto Textures",
    hint: "Automatically assign architectural PBR textures to walls, roofs, floors and render",
    icon: <LuWand className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  },
  {
    id: "walls-texture",
    label: "Walls",
    hint: "Apply PBR texture to walls (Concrete, Brick, Stucco, Timber, Marble...)",
    icon: <IconMarkupWall className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    hasDropdown: true,
  },
  {
    id: "roofs-texture",
    label: "Roofs",
    hint: "Apply PBR texture to roofs (Standing Seam Zinc, Slate, Terracotta Tile...)",
    icon: <IconMarkupRoof className="h-3.5 w-3.5 text-violet-400 shrink-0" />,
    hasDropdown: true,
  },
  {
    id: "floors-texture",
    label: "Floors",
    hint: "Apply PBR texture to floors (Oak Parquet, Polished Concrete, Marble, Terrazzo...)",
    icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
    hasDropdown: true,
  },
  {
    id: "render-studio",
    label: "Render Studio",
    hint: "Toggle photorealistic Render Studio (lighting & shadows)",
    icon: <LuCamera className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  },
  {
    id: "render-sun",
    label: "Sun & Sky",
    hint: "Cycle atmosphere & sun presets (Noon, Golden, Overcast, Dusk, Interior)",
    icon: <LuSunMedium className="h-3.5 w-3.5 text-yellow-400 shrink-0" />,
  },
  {
    id: "render-shadows",
    label: "Shadows",
    hint: "Toggle real-time contact shadows",
    icon: <LuSparkles className="h-3.5 w-3.5 text-sky-400 shrink-0" />,
  },
  {
    id: "render-capture",
    label: "Snapshot",
    hint: "Export high-resolution rendered PNG image",
    icon: <LuDownload className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
  },
];

const MEP_ALL_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "duct", label: "Duct", hint: "Draw rectangular supply duct", icon: <LuBox className="h-4 w-4 shrink-0" /> },
  { id: "pipe", label: "Pipe", hint: "Draw hydronic & sanitary piping", icon: <LuCylinder className="h-4 w-4 shrink-0" /> },
  { id: "cabletray", label: "Tray", hint: "Route electrical cable tray", icon: <LuCable className="h-4 w-4 shrink-0" /> },
  { id: "wire", label: "Wire", hint: "Draw electrical circuits & wiring", icon: <LuZap className="h-3 w-3 text-yellow-400 shrink-0" /> },
  { id: "equipment", label: "Equipment", hint: "Place mechanical & electrical equipment", icon: <LuBox className="h-3 w-3 text-orange-400 shrink-0" /> },
  { id: "workplane", label: "Work Plane", hint: "Set reference drawing plane (G)", icon: <LuGrid2X2 className="h-3 w-3 text-blue-400 shrink-0" /> },
];

const MODIFY_ITEMS: CapsuleItem[] = [
  { id: "move", label: "Move", hint: "Translate selected elements", icon: <LuMove className="h-3 w-3 text-sky-400 shrink-0" /> },
  { id: "rotate", label: "Rotate", hint: "Rotate selected elements around center", icon: <LuRotate3D className="h-3 w-3 text-emerald-400 shrink-0" /> },
  { id: "align", label: "Align", hint: "Pick reference geometry, then the target feature", icon: <LuAlignCenterHorizontal className="h-3 w-3 text-purple-400 shrink-0" /> },
  { id: "mirror", label: "Mirror", hint: "Mirror selection about an axis", icon: <LuFlipHorizontal2 className="h-3 w-3 text-indigo-400 shrink-0" /> },
  { id: "copy", label: "Copy", hint: "Duplicate selected elements", icon: <LuCopy className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "trim", label: "Trim", hint: "Trim or extend elements (T)", icon: <LuScissors className="h-3 w-3 text-pink-400 shrink-0" /> },
  { id: "split", label: "Split", hint: "Split a wall or line at a picked point", icon: <LuScissors className="h-3 w-3 text-sky-400 shrink-0" /> },
  { id: "group", label: "Group", hint: "Save selected members as a named group", icon: <LuLayers3 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "delete", label: "Delete", hint: "Delete selected elements (Del)", icon: <LuTrash2 className="h-3 w-3 text-red-500 shrink-0" />, isDanger: true },
  { id: "deselect", label: "Deselect", hint: "Clear active selection (Esc)", icon: <LuX className="h-3 w-3 text-zinc-400 shrink-0" /> },
];

const BOUNDARY_ITEMS: CapsuleItem[] = [
  { id: "boundary-modify", label: "Modify", hint: "Drag vertices or select an edge to extend its endpoints", icon: <LuMove className="h-3 w-3 text-pink-400 shrink-0" /> },
  { id: "boundary-trim", label: "Trim / Extend", hint: "Click two edge portions to keep", icon: <LuScissors className="h-3 w-3 text-pink-400 shrink-0" /> },
  { id: "boundary-insert", label: "Insert vertex", hint: "Click an edge to add a vertex", icon: <LuPencil className="h-3 w-3 text-sky-400 shrink-0" /> },
  { id: "boundary-delete", label: "Remove vertex", hint: "Click a vertex to remove it", icon: <LuMinus className="h-3 w-3 text-rose-400 shrink-0" /> },
  { id: "boundary-finish", label: "Finish", hint: "Save the valid boundary sketch", icon: <LuCheck className="h-3 w-3 text-emerald-400 shrink-0" /> },
  { id: "boundary-cancel", label: "Cancel", hint: "Restore the original boundary and holes", icon: <LuX className="h-3 w-3 text-rose-400 shrink-0" /> },
];

export default function DesktopIsland() {
  /* ── store subscriptions ─────────────────────────────── */
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const modifyTool = useModifyStore(s => s.tool);
  const boundaryEdit = useLayoutDrawingStore(s => s.slabBoundaryEdit);
  const isBoundaryEditing = Boolean(boundaryEdit);

  const archCategory = useLayoutDrawingStore((s) => s.desktopArchCategory);
  const setArchCategory = useLayoutDrawingStore((s) => s.setDesktopArchCategory);
  const mepCategory = useLayoutDrawingStore((s) => s.desktopMepCategory);
  const setMepCategory = useLayoutDrawingStore((s) => s.setDesktopMepCategory);

  const measureMode = useToolMarkupStore((s) => s.measureMode);
  const measurementKind = useToolMarkupStore((s) => s.measurementKind);
  const armedMarkupTool = useToolMarkupStore((s) => s.armedTool);

  /* ── Snapshot modal state ────────────────────────────── */
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotFormat, setSnapshotFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [snapshotScale, setSnapshotScale] = useState<number>(2);


  /* ── Tab thumb refs & animations ──────────────────────── */
  const tabThumbRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const tabThumbReadyRef = useRef(false);

  /* ── Capsules animation ref ──────────────────────────── */
  const capsulesRowRef = useRef<HTMLDivElement>(null);
  const modifyLabelRef = useRef<HTMLDivElement>(null);

  /* ── Shapes dropdown refs & state ────────────────────── */
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const shapesButtonRef = useRef<HTMLButtonElement>(null);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const [shapesMenuPos, setShapesMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const typeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [typeMenu, setTypeMenu] = useState<{ toolId: string; top: number; left: number } | null>(null);

  /* ── Render texture menu refs & state ─────────────────── */
  const renderPreview = useViewDisplayStore((s) => s.renderPreview);
  const shadowsEnabled = useViewDisplayStore((s) => s.shadowsEnabled);
  const autoTextureArchitecture = useLayoutDrawingStore((s) => s.autoTextureArchitecture);
  const { captureViewport } = useModelScene();
  const [textureMenu, setTextureMenu] = useState<{ category: "walls" | "roofs" | "floors"; top: number; left: number } | null>(null);
  const textureButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const textureMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textureMenu) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const activeBtn = textureButtonRefs.current[`${textureMenu.category}-texture`];
      if (!textureMenuRef.current?.contains(target) && !activeBtn?.contains(target)) {
        setTextureMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTextureMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [textureMenu]);

  useEffect(() => {
    if (!typeMenu) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!typeMenuRef.current?.contains(target) && !typeButtonRefs.current[typeMenu.toolId]?.contains(target)) {
        setTypeMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTypeMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [typeMenu]);

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
    slabs,
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
    const toX = target.getBoundingClientRect().left - thumb.parentElement!.getBoundingClientRect().left + insetX;
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

    gsap.to(thumb, { ...properties, duration: 0.14, ease: "power2.out", overwrite: true });
    return () => { gsap.killTweensOf(thumb); };
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
        x: target.getBoundingClientRect().left - thumb.parentElement!.getBoundingClientRect().left + insetX,
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
    if (selectedSlabId) {
      const slab = slabs.find((s) => s.id === selectedSlabId);
      return slab?.kind === "roof" ? "Modify · Roof" : "Modify · Floor";
    }
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
    if (isBoundaryEditing) return BOUNDARY_ITEMS;
    if (hasContextSelection) {
      if (selectedSlabId) {
        const slab = slabs.find((s) => s.id === selectedSlabId);
        const isRoof = slab?.kind === "roof";
        const slabItems: CapsuleItem[] = [
          {
            id: "edit-boundary",
            label: isRoof ? "Edit Roof" : "Edit Floor",
            hint: "Edit boundary sketch lines (re-draw perimeter)",
            icon: <LuPencil className="h-3 w-3 text-amber-400 shrink-0" />,
          },
        ];
        if (isRoof) {
          slabItems.push(
            { id: "joinRoof", label: "Join Roofs", hint: "Pick a roof boundary edge, then the other roof face", icon: <LuLayers3 /> },
            { id: "roof-hip", label: "Hip", hint: "Hip roof (all edges sloped 30°)", icon: <span className="text-[11px] font-bold text-yellow-400">◺</span> },
            { id: "roof-gable", label: "Gable", hint: "Gable roof (2 opposite slopes, 2 vertical ends)", icon: <span className="text-[11px] font-bold text-amber-400">∧</span> },
            { id: "roof-shed", label: "Shed", hint: "Shed / mono-pitch roof (single slope)", icon: <span className="text-[11px] font-bold text-orange-400">/</span> },
            { id: "roof-flat", label: "Flat", hint: "Flat roof slab (0° pitch)", icon: <span className="text-[11px] font-bold text-blue-400">—</span> },
          );
        }
        return [...slabItems, ...MODIFY_ITEMS];
      }
      if (selectedWallId || selectedElements.some((item) => item.kind === "wall")) {
        return [
          { id: "attach", label: "Attach", hint: "Attach wall top or bottom to a roof or floor", icon: <LuArrowUpToLine /> },

          ...MODIFY_ITEMS,
        ];
      }
      return MODIFY_ITEMS;
    }

    if (!mepModeActive) {
      switch (archCategory) {
        case "structure":
          return ARCH_STRUCTURE_ITEMS;
        case "annotate":
          return ARCH_ANNOTATE_ITEMS;
        case "insert":
          return ARCH_INSERT_ITEMS;
        case "render":
          return ARCH_RENDER_ITEMS;
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
        case "wiring":
          return MEP_ALL_ITEMS.filter((i) => i.id === "select" || i.id === "cabletray" || i.id === "wire");
        case "components":
          return MEP_ALL_ITEMS.filter((i) => i.id === "select" || i.id === "equipment");
        case "all":
        default:
          return MEP_ALL_ITEMS;
      }
    }
  }, [hasContextSelection, mepModeActive, archCategory, mepCategory, isBoundaryEditing, selectedSlabId, slabs, selectedWallId, selectedElements]);

  // Keep controls interactive throughout a short, non-spatial transition.
  const renderedCapsules = activeCapsules;
  useLayoutEffect(() => {
    const row = capsulesRowRef.current;
    if (!row || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = row.animate([{ opacity: 0.65 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
    return () => animation.cancel();
  }, [activeCapsules]);

  useLayoutEffect(() => {
    if (!hasContextSelection || !modifyLabelRef.current) return;
    gsap.fromTo(modifyLabelRef.current, { autoAlpha: 0, y: -7 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power3.out" });
  }, [hasContextSelection, modifyTitle]);

  /* ── actions ─────────────────────────────────────────── */
  const clearSelection = () => {
    if (useLayoutDrawingStore.getState().slabBoundaryEdit) useLayoutDrawingStore.getState().cancelSlabBoundaryEdit();
    useModifyStore.getState().activate("select");
    useModifyStore.setState({ selection: null, placingGroupId: null });
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
  };

  const handleCapsuleClick = (id: string) => {
    const layout = useLayoutDrawingStore.getState();
    if (layout.slabBoundaryEdit) {
      if (id === "boundary-finish") {
        if (layout.editingSlabId) {
          void layout.convertSketchToSlab(layout.sketchTargetKind || "floor");
        } else {
          void layout.commitSlabBoundaryEdit();
        }
      }
      else if (id === "boundary-cancel" || id === "deselect" || id === "select") layout.cancelSlabBoundaryEdit();
      else if (id === "boundary-modify") layout.setBoundaryEditTool("modify");
      else if (id === "boundary-trim") layout.setBoundaryEditTool("trim");
      else if (id === "boundary-insert") layout.setBoundaryEditTool("insert");
      else if (id === "boundary-delete") layout.setBoundaryEditTool("delete");
      return;
    }
    if (id === "dimension-distance" || id === "dimension-angle" || id === "dimension-arc") {
      const targetKind = id.replace("dimension-", "") as "distance" | "angle" | "arc";
      clearSelection();
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool(null);
      if (measureMode && measurementKind === targetKind) {
        useToolMarkupStore.getState().setMeasureMode(false);
      } else {
        useToolMarkupStore.getState().setMeasurementKind(targetKind);
        useToolMarkupStore.getState().setMeasureMode(true);
      }
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }
    if (id === "dimension") {
      clearSelection();
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setMeasureMode(!measureMode);
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }
    if (id === "select") {
      useToolMarkupStore.getState().setMeasureMode(false);
      useLayoutDrawingStore.getState().setArmedLayoutTool(null);
      useToolMarkupStore.getState().setArmedTool(null);
      clearSelection();
      return;
    }

    if (id === "shapes") {
      toggleShapesDropdown();
      return;
    }

    if (TYPE_CATEGORY[id]) {
      setShapesDropdownOpen(false);
      const button = typeButtonRefs.current[id];
      if (button) {
        const rect = button.getBoundingClientRect();
        const menuWidth = 292;
        setTypeMenu((current) => current?.toolId === id ? null : {
          toolId: id,
          top: rect.bottom + 8,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
        });
      }
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

    if (id === "edit-boundary") {
      if (selectedSlabId) {
        useLayoutDrawingStore.getState().beginSlabBoundaryEdit(selectedSlabId);
      }
      return;
    }
    if (id === "roof-hip") {
      if (selectedSlabId) void useLayoutDrawingStore.getState().applyRoofPreset(selectedSlabId, "hip");
      return;
    }
    if (id === "roof-gable") {
      if (selectedSlabId) void useLayoutDrawingStore.getState().applyRoofPreset(selectedSlabId, "gable");
      return;
    }
    if (id === "roof-shed") {
      if (selectedSlabId) void useLayoutDrawingStore.getState().applyRoofPreset(selectedSlabId, "shed");
      return;
    }
    if (id === "roof-flat") {
      if (selectedSlabId) void useLayoutDrawingStore.getState().applyRoofPreset(selectedSlabId, "flat");
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
    if (id === "move" || id === "rotate" || id === "align" || id === "mirror" || id === "split" || id === "attachTop" || id === "attachBase" || id === "joinRoof") {
      activateModifyTool(id);
      return;
    }
    if (id === "group") { useModifyStore.setState({ requestGroupName: true }); return; }
    if (id === "copy") {
      void useLayoutDrawingStore.getState().copySelected(100, 100).catch(error => useModifyStore.setState({ message: String(error) }));
      return;
    }
    if (id === "trim") {
      const active = armed === "trim";
      useLayoutDrawingStore.getState().setArmedLayoutTool(active ? null : "trim");
      return;
    }

    if (id === "auto-textures") {
      void autoTextureArchitecture().then(() => {
        enterRenderView();
      });
      return;
    }
    if (id === "walls-texture" || id === "roofs-texture" || id === "floors-texture") {
      setShapesDropdownOpen(false);
      setTypeMenu(null);
      const category = id.replace("-texture", "") as "walls" | "roofs" | "floors";
      const button = textureButtonRefs.current[id];
      if (button) {
        const rect = button.getBoundingClientRect();
        const menuWidth = 280;
        setTextureMenu((current) => current?.category === category ? null : {
          category,
          top: rect.bottom + 8,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
        });
      }
      return;
    }
    if (id === "render-studio") {
      if (renderPreview) {
        useViewDisplayStore.getState().setRenderPreview(false);
      } else {
        enterRenderView();
      }
      return;
    }
    if (id === "render-sun") {
      const presets: RenderPreset[] = ["architectural", "golden", "overcast", "dusk", "interior"];
      const cur = useViewDisplayStore.getState().renderPreset;
      const next = presets[(presets.indexOf(cur) + 1) % presets.length];
      useViewDisplayStore.getState().applyRenderPreset(next);
      if (!useViewDisplayStore.getState().renderPreview) enterRenderView();
      return;
    }
    if (id === "render-shadows") {
      useViewDisplayStore.getState().setRenderSetting("shadowsEnabled", !shadowsEnabled);
      if (!useViewDisplayStore.getState().renderPreview) enterRenderView();
      return;
    }
    if (id === "render-capture") {
      setSnapshotModalOpen(true);
      return;
    }

    clearSelection();
    useLayoutDrawingStore.getState().setArmedLayoutTool(id as LayoutToolId);
    useAppStore.getState().setRightPanelOpen(true);
  };

  const chooseElementType = (toolId: string, typeDef: ElementTypeDefinition) => {
    const layout = useLayoutDrawingStore.getState();
    clearSelection();
    layout.applyElementType(toolId as LayoutToolId, typeDef);
    if (toolId === "wall") {
      layout.setDraftWallTypeId(typeDef.id);
      if (typeDef.thicknessMm) layout.setDraftWallThicknessMm(typeDef.thicknessMm);
      if (typeDef.heightMm) layout.setDraftWallHeightMm(typeDef.heightMm);
    } else if (toolId === "door" && typeDef.widthMm && typeDef.heightMm) {
      layout.setDraftDoorSize(typeDef.widthMm, typeDef.heightMm);
    } else if (toolId === "window" && typeDef.widthMm && typeDef.heightMm) {
      layout.setDraftWindowSize(typeDef.widthMm, typeDef.heightMm, typeDef.sillHeightMm ?? layout.draftWindowSillMm);
    } else if ((toolId === "floor" || toolId === "roof") && typeDef.thicknessMm) {
      layout.setDraftSlabThicknessMm(typeDef.thicknessMm);
    }
    layout.setArmedLayoutTool(toolId as LayoutToolId);
    useAppStore.getState().setRightPanelOpen(true);
    useToolMarkupStore.getState().setArmedTool(null);
    setTypeMenu(null);
  };

  const isCapsuleActive = (id: string) => {
    if (id.startsWith("boundary-")) return id === `boundary-${boundaryEdit?.tool}`;
    if (id === "dimension-distance") return measureMode && measurementKind === "distance";
    if (id === "dimension-angle") return measureMode && measurementKind === "angle";
    if (id === "dimension-arc") return measureMode && measurementKind === "arc";
    if (id === "dimension") return measureMode;
    if (["move", "rotate", "align", "mirror", "split", "attachTop", "attachBase", "joinRoof"].includes(id)) return modifyTool === id;
    if (id === "deselect" || id === "delete" || id === "copy" || id === "group") return false;
    if (id === "trim") {
      return armed === "trim";
    }
    if (id === "shapes") {
      return SHAPE_ITEMS.some((s) => s.id === armedMarkupTool) || shapesDropdownOpen;
    }
    if (id === "note") {
      return armedMarkupTool === "note";
    }
    if (id === "render-studio") return renderPreview;
    if (id === "render-shadows") return shadowsEnabled;
    if (id === "walls-texture") return textureMenu?.category === "walls";
    if (id === "roofs-texture") return textureMenu?.category === "roofs";
    if (id === "floors-texture") return textureMenu?.category === "floors";
    if (id === "select") return !measureMode && armed === null && armedMarkupTool === null;
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
              className="pointer-events-none absolute bottom-1.5 left-0 h-0.5 rounded-full z-[1]"
              aria-hidden="true"
            />
          )}

          {hasContextSelection ? (
            <div ref={modifyLabelRef} className="flex items-center gap-1.5 px-2 relative z-[2]">
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
                  onClick={() => setArchCategory(tab.id as "build" | "structure" | "annotate" | "insert" | "render")}
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
                  onClick={() => setMepCategory(tab.id as "all" | "hvac" | "piping" | "wiring" | "electrical" | "components")}
                  className={`desktop-clean-tab-btn ${mepCategory === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Render View Floating Banner ── */}
      {renderPreview && (
        <div className="fixed top-[58px] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-amber-400/50 backdrop-blur-md shadow-lg shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-[11px] font-bold tracking-wide text-amber-400 uppercase">
              Render View Active
            </span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <button
            type="button"
            onClick={() => useViewDisplayStore.getState().setRenderPreview(false)}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Exit Render View"
          >
            <LuX className="h-3 w-3 stroke-[2.5]" />
            <span>Exit Render View</span>
          </button>
        </div>
      )}

      {/* ── 2. Directly Below Header: Related Capsules ── */}
      <div
        className={`desktop-capsules-container fixed ${renderPreview ? "top-[100px]" : "top-[63px]"} left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center justify-center select-none transition-[top] duration-200`}
        style={{
          maxWidth: rightPanelOpen ? "calc(100vw - 360px)" : "calc(100vw - 48px)",
        }}
      >
        <div
          ref={capsulesRowRef}
          className="flex items-center gap-1.5 overflow-x-auto thin-scroll desktop-capsule-row-inner py-0.5 px-2 max-w-full"
        >
          {renderedCapsules.map((item) => {
            if (item.id === "attach") return <WallAttachControl key={item.id} className="desktop-capsule-btn" />;
            const active = isCapsuleActive(item.id);
            const isShapes = item.id === "shapes";
            const isTypeSelector = Boolean(TYPE_CATEGORY[item.id]);
            const isTextureSelector = item.id.endsWith("-texture");
            const activeShape = isShapes ? SHAPE_ITEMS.find((s) => s.id === armedMarkupTool) : null;
            const displayIcon = activeShape ? activeShape.icon : item.icon;
            const displayLabel = activeShape ? `Shapes (${activeShape.label.split(" ")[0]})` : item.label;

            const buttonContent = (
              <button
                ref={(element) => {
                  if (isShapes) shapesButtonRef.current = element;
                  if (isTypeSelector) typeButtonRefs.current[item.id] = element;
                  if (isTextureSelector) textureButtonRefs.current[item.id] = element;
                }}
                type="button"
                data-capsule-id={item.id}
                data-flip-id={item.id === "select" ? "desktop-capsule-select" : undefined}
                onClick={() => handleCapsuleClick(item.id)}
                className={`desktop-capsule-btn ${active ? "is-active" : ""} ${item.isDanger ? "is-danger" : ""}`}
                aria-pressed={active}
                aria-haspopup={item.hasDropdown ? "menu" : undefined}
                aria-expanded={
                  isShapes
                    ? shapesDropdownOpen
                    : isTypeSelector
                    ? typeMenu?.toolId === item.id
                    : isTextureSelector
                    ? textureMenu?.category === item.id.replace("-texture", "")
                    : undefined
                }
                title={item.label}
              >
                {displayIcon}
                <span className="desktop-capsule-label leading-none">{displayLabel}</span>
                {item.hasDropdown && (
                  <LuChevronDown
                    className={`desktop-capsule-chevron h-2.5 w-2.5 opacity-60 ml-0.5 transition-transform duration-200 ${
                      (isShapes
                        ? shapesDropdownOpen
                        : isTypeSelector
                        ? typeMenu?.toolId === item.id
                        : isTextureSelector
                        ? textureMenu?.category === item.id.replace("-texture", "")
                        : false)
                        ? "rotate-180"
                        : ""
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
                disabled={(isShapes && shapesDropdownOpen) || (isTextureSelector && textureMenu !== null)}
              >
                {buttonContent}
              </GlassTooltip>
            );
          })}
        </div>
      </div>

      {typeMenu && typeof document !== "undefined" && createPortal(
        <div
          ref={typeMenuRef}
          style={{ top: typeMenu.top, left: typeMenu.left }}
          className="desktop-shapes-dropdown fixed z-[9999] w-[292px] rounded-2xl p-2"
          role="menu"
          aria-label={`Choose ${TYPE_CATEGORY[typeMenu.toolId]} type`}
        >
          <div className="mb-1.5 border-b border-[var(--panel-divider)] px-2 pb-1.5">
            <strong className="block text-[10px] uppercase tracking-wider text-yellow-500">{TYPE_CATEGORY[typeMenu.toolId]} types</strong>
            <span className="text-[9px] text-[var(--text-muted)]">Select a predefined type, then place it in the view.</span>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto thin-scroll">
            {Object.values(DEFAULT_ELEMENT_TYPES)
              .filter((typeDef) => typeDef.category === TYPE_CATEGORY[typeMenu.toolId])
              .map((typeDef) => (
                <button key={typeDef.id} type="button" role="menuitem" onClick={() => chooseElementType(typeMenu.toolId, typeDef)} className="desktop-shape-option w-full rounded-xl px-2.5 py-2 text-left">
                  <span className="block text-[11px] font-bold text-[var(--text-strong)]">{typeDef.name}</span>
                  <span className="mt-0.5 block text-[9px] text-[var(--text-muted)]">
                    {typeDef.functionType} · {typeDef.material}{typeDef.thicknessMm ? ` · ${typeDef.thicknessMm} mm` : ""}
                  </span>
                </button>
              ))}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Portaled Category Texture Menu ── */}
      {textureMenu && typeof document !== "undefined" && createPortal(
        <div
          ref={textureMenuRef}
          style={{ top: textureMenu.top, left: textureMenu.left }}
          className="desktop-shapes-dropdown fixed z-[9999] w-[280px] rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
          role="menu"
          aria-label={`Choose ${textureMenu.category} texture`}
        >
          <div className="mb-1.5 border-b border-[var(--panel-divider)] px-2 pb-1.5 flex items-center justify-between">
            <div>
              <strong className="block text-[10px] uppercase tracking-wider text-yellow-500">
                {textureMenu.category === "walls" ? "Wall Textures" : textureMenu.category === "roofs" ? "Roof Textures" : "Floor Textures"}
              </strong>
              <span className="text-[9px] text-[var(--text-muted)]">Select a PBR texture to apply & render.</span>
            </div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--glass-inset-bg)]">
              {textureMenu.category === "walls" ? WALL_TEXTURES.length : textureMenu.category === "roofs" ? ROOF_TEXTURES.length : FLOOR_TEXTURES.length}
            </span>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto thin-scroll">
            {(textureMenu.category === "walls" ? WALL_TEXTURES : textureMenu.category === "roofs" ? ROOF_TEXTURES : FLOOR_TEXTURES).map((tex) => (
              <button
                key={tex.id}
                type="button"
                role="menuitem"
                onClick={async () => {
                  await useLayoutDrawingStore.getState().applyCategoryTexture(textureMenu.category, tex.id, tex.color);
                  enterRenderView();
                  setTextureMenu(null);
                }}
                className="desktop-shape-option flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2 text-left transition-colors"
              >
                <span
                  className="h-5 w-5 rounded-lg border border-white/20 shrink-0 shadow-sm"
                  style={{ backgroundColor: tex.color }}
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-[var(--text-strong)] leading-tight">{tex.name}</span>
                  <span className="mt-0.5 block text-[9px] text-[var(--text-muted)] truncate">{tex.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}

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

      {/* ── 4. Portaled Snapshot Format & Resolution Modal ── */}
      {snapshotModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Export Render Snapshot"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSnapshotModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/95 p-5 shadow-2xl text-slate-100 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                  <LuCamera className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Export Render Snapshot</h3>
                  <p className="text-[11px] text-slate-400">Choose format and resolution for high-res export</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSnapshotModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                title="Close"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Format selection */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Image Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["png", "jpeg", "webp"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSnapshotFormat(fmt)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all ${
                        snapshotFormat === fmt
                          ? "border-yellow-400 bg-yellow-400/15 text-yellow-300 shadow-sm"
                          : "border-slate-800 bg-slate-850 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase">{fmt}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        {fmt === "png" ? "Lossless" : fmt === "jpeg" ? "Compressed" : "Modern Web"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution / Scale selection */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Resolution Scale
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { scale: 1, label: "1x Standard", desc: "Native Viewport" },
                    { scale: 2, label: "2x Retina", desc: "Print & Presentation" },
                    { scale: 4, label: "4x Ultra HD", desc: "4K High-Res ArchViz" },
                  ].map((opt) => (
                    <button
                      key={opt.scale}
                      type="button"
                      onClick={() => setSnapshotScale(opt.scale)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all ${
                        snapshotScale === opt.scale
                          ? "border-yellow-400 bg-yellow-400/15 text-yellow-300 shadow-sm"
                          : "border-slate-800 bg-slate-850 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSnapshotModalOpen(false)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const data = captureViewport?.({ scale: snapshotScale, format: snapshotFormat, quality: 0.95 });
                  if (data) {
                    const link = document.createElement("a");
                    link.href = data;
                    link.download = `render-snapshot-${snapshotScale}x.${snapshotFormat}`;
                    link.click();
                    setSnapshotModalOpen(false);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-yellow-300 transition-all shadow-md active:scale-95"
              >
                <LuDownload className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Download Snapshot</span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
