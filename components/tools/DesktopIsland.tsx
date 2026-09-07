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
import { flushSync } from "react-dom";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
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
  LuPencil,
  LuRotate3D,
  LuRuler,
  LuScissors,
  LuShapes,
  LuTrash2,
  LuX,
  LuZap,
  LuArmchair,
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
import { groupCapsulesForMorph } from "@/lib/capsuleMorph";
import { DEFAULT_ELEMENT_TYPES, type ElementTypeDefinition } from "./EditTypeDialog";

gsap.registerPlugin(Flip);

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
  { id: "wall", label: "Wall", hint: "Choose a wall type and draw (W)", icon: <IconMarkupWall className="h-3.5 w-3.5 text-amber-500 shrink-0" />, hasDropdown: true },
  { id: "window", label: "Window", hint: "Choose a window type and place it", icon: <IconMarkupWindow className="h-3.5 w-3.5 text-sky-400 shrink-0" />, hasDropdown: true },
  { id: "door", label: "Door", hint: "Choose a door type and place it (D)", icon: <LuDoorOpen className="h-3 w-3 text-orange-500 shrink-0" />, hasDropdown: true },
  { id: "floor", label: "Floor", hint: "Choose a floor type and sketch its boundary", icon: <IconMarkupFloor className="h-3.5 w-3.5 text-emerald-400 shrink-0" />, hasDropdown: true },
  { id: "roof", label: "Roof", hint: "Choose a roof type and sketch its boundary", icon: <IconMarkupRoof className="h-3.5 w-3.5 text-violet-400 shrink-0" />, hasDropdown: true },
  { id: "lines", label: "Lines", hint: "Draw detail & sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <IconMarkupColumn className="h-3 w-3 text-slate-300 shrink-0" /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <IconMarkupBeam className="h-3.5 w-3.5 text-indigo-400 shrink-0" /> },
  { id: "stair", label: "Stair", hint: "Create architectural stairs (S)", icon: <IconMarkupStair className="h-3 w-3 text-teal-400 shrink-0" /> },
  { id: "ramp", label: "Ramp", hint: "Create access ramps (R)", icon: <IconMarkupRamp className="h-3 w-3 text-lime-400 shrink-0" /> },
  { id: "component", label: "Component", hint: "Place furniture and architectural components", icon: <LuArmchair className="h-3.5 w-3.5 text-amber-400 shrink-0" /> },
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
  { id: "lines", label: "Lines", hint: "Draw detail sketch lines (L)", icon: <LuPencil className="h-3 w-3 text-blue-400 shrink-0" /> },
  { id: "dimension", label: "Dimension", hint: "Measure distance between elements", icon: <LuRuler className="h-3 w-3 text-yellow-400 shrink-0" /> },
  { id: "note", label: "Note", hint: "Place text note or callout", icon: <LuFileText className="h-3 w-3 text-teal-400 shrink-0" /> },
];

const ARCH_INSERT_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 className="h-3 w-3 text-amber-400 shrink-0" /> },
  { id: "component", label: "Component", hint: "Place furniture and architectural components", icon: <LuArmchair className="h-3.5 w-3.5 text-amber-400 shrink-0" /> },
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

function appendCellularMorph(
  timeline: gsap.core.Timeline,
  outgoing: HTMLElement[],
  incoming: HTMLElement[],
  fusionLayer: HTMLElement,
) {
  const groupDelay = 0.045;
  timeline.to(fusionLayer, {
    filter: "blur(.65px) contrast(1.12) saturate(1.04)",
    duration: 0.18,
    ease: "power2.inOut",
  }, 0.1);
  timeline.to(fusionLayer, {
    filter: "blur(0px) contrast(1) saturate(1)",
    duration: 0.16,
    ease: "power2.out",
  }, 0.27);

  if (outgoing.length === incoming.length) {
    outgoing.forEach((source, index) => {
      const target = incoming[index];
      const first = source.getBoundingClientRect();
      const last = target.getBoundingClientRect();
      const offset = index * 0.018;
      gsap.set(target, { autoAlpha: 0, scaleX: 0.94, filter: "blur(1px)" });
      timeline.to(source, {
        x: last.left - first.left, width: last.width, scaleY: 1.03,
        borderRadius: 999, duration: 0.2, ease: "back.inOut(1.2)",
      }, offset);
      timeline.to(source.children, { autoAlpha: 0, duration: 0.08, ease: "power2.in" }, offset + 0.1);
      timeline.to(source, { autoAlpha: 0, scaleY: 1, duration: 0.12 }, offset + 0.18);
      timeline.to(target, {
        autoAlpha: 1, scaleX: 1, filter: "blur(0px)", duration: 0.16, ease: "back.out(1.3)",
      }, offset + 0.17);
    });
    return;
  }

  if (outgoing.length > incoming.length) {
    const groups = groupCapsulesForMorph(outgoing, incoming.length);
    incoming.forEach((target, groupIndex) => {
      const group = groups[groupIndex] ?? [];
      const targetRect = target.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;
      const offset = groupIndex * groupDelay;
      const sourceCenter = group.reduce((sum, source) => {
        const rect = source.getBoundingClientRect();
        return sum + rect.left + rect.width / 2;
      }, 0) / Math.max(group.length, 1);
      const fusionCore = target.cloneNode(false) as HTMLElement;
      fusionCore.removeAttribute("data-capsule-id");
      fusionCore.removeAttribute("data-flip-id");
      fusionCore.classList.add("desktop-capsule-morph-clone", "desktop-capsule-fusion-core");
      Object.assign(fusionCore.style, {
        position: "fixed",
        left: `${targetCenter - 11}px`,
        top: `${targetRect.top}px`,
        width: "22px",
        height: `${targetRect.height}px`,
        opacity: "0",
        margin: "0px",
      });
      fusionLayer.appendChild(fusionCore);
      gsap.set(target, {
        autoAlpha: 0, x: sourceCenter - targetCenter, scaleX: 0.36, scaleY: 1.06,
        borderRadius: 999, filter: "blur(2px) drop-shadow(0 0 7px rgba(250,204,21,.28))",
      });
      group.forEach((source) => {
        const rect = source.getBoundingClientRect();
        const delta = targetCenter - (rect.left + rect.width / 2);
        const fusedWidth = Math.max(22, targetRect.width * 0.72);
        timeline.to(source, {
          x: delta * 0.58, scaleX: 0.9, scaleY: 0.97, borderRadius: 999,
          duration: 0.14, ease: "power2.inOut",
        }, offset);
        timeline.to(source, {
          x: targetCenter - (rect.left + fusedWidth / 2), width: fusedWidth,
          scaleX: 0.82, scaleY: 1.06, borderRadius: 999,
          duration: 0.17, ease: "back.inOut(1.18)",
        }, offset + 0.12);
        timeline.to(source.children, { autoAlpha: 0, duration: 0.1, ease: "power2.in" }, offset + 0.2);
        timeline.to(source, { autoAlpha: 0, scale: 0.5, duration: 0.12, ease: "power2.in" }, offset + 0.29);
      });
      timeline.to(fusionCore, {
        autoAlpha: 0.92, width: Math.max(30, targetRect.width * 0.52),
        x: -(Math.max(30, targetRect.width * 0.52) - 22) / 2,
        scaleY: 1.08, duration: 0.17, ease: "back.out(1.22)",
      }, offset + 0.15);
      timeline.to(fusionCore, {
        width: targetRect.width, x: -(targetRect.width - 22) / 2,
        scaleY: 1, duration: 0.15, ease: "elastic.out(1, .8)",
      }, offset + 0.29);
      timeline.to(target, {
        autoAlpha: 1, x: 0, scaleX: 1, scaleY: 1, borderRadius: 999,
        filter: "blur(0px) drop-shadow(0 0 0 rgba(250,204,21,0))",
        duration: 0.17, ease: "elastic.out(1, .78)",
      }, offset + 0.35);
      timeline.to(fusionCore, { autoAlpha: 0, duration: 0.12, ease: "power2.out" }, offset + 0.37);
    });
    return;
  }

  const targetGroups = groupCapsulesForMorph(incoming, outgoing.length);
  outgoing.forEach((source, groupIndex) => {
    const targets = targetGroups[groupIndex] ?? [];
    const sourceRect = source.getBoundingClientRect();
    const targetRects = targets.map((target) => target.getBoundingClientRect());
    const left = Math.min(...targetRects.map((rect) => rect.left));
    const right = Math.max(...targetRects.map((rect) => rect.right));
    const splitCenter = (left + right) / 2;
    const swollenWidth = Math.min(Math.max(sourceRect.width * 1.28, 38), 112);
    const offset = groupIndex * groupDelay;
    timeline.to(source, {
      scaleX: 1.08, scaleY: 1.05, borderRadius: 999,
      duration: 0.14, ease: "back.out(1.18)",
    }, offset);
    timeline.to(source, {
      x: splitCenter - (sourceRect.left + swollenWidth / 2), width: swollenWidth,
      scaleX: 1, scaleY: 0.94, borderRadius: 999,
      duration: 0.17, ease: "back.inOut(1.16)",
    }, offset + 0.12);
    timeline.to(source.children, { autoAlpha: 0, duration: 0.1 }, offset + 0.23);
    targets.forEach((target) => {
      const targetRect = target.getBoundingClientRect();
      gsap.set(target, {
        autoAlpha: 0, x: splitCenter - (targetRect.left + targetRect.width / 2),
        scaleX: 0.3, scaleY: 1.06, borderRadius: 999, filter: "blur(2px)",
      });
      timeline.to(target, {
        autoAlpha: 1, x: 0, scaleX: 1, scaleY: 1, borderRadius: 999, filter: "blur(0px)",
        duration: 0.2, ease: "elastic.out(1, .78)",
      }, offset + 0.31);
    });
    timeline.to(source, { autoAlpha: 0, scaleY: 0.72, duration: 0.14, ease: "power2.out" }, offset + 0.31);
  });
}

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

  const measureMode = useToolMarkupStore((s) => s.measureMode);
  const armedMarkupTool = useToolMarkupStore((s) => s.armedTool);
  const transformMode = useToolMarkupStore((s) => s.transformMode);

  /* ── Tab thumb refs & animations ──────────────────────── */
  const tabThumbRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const tabThumbReadyRef = useRef(false);

  /* ── Capsules animation ref ──────────────────────────── */
  const capsulesRowRef = useRef<HTMLDivElement>(null);
  const capsuleTransitionRef = useRef<gsap.core.Timeline | null>(null);
  const selectFlipRef = useRef<gsap.core.Timeline | null>(null);
  const morphGenerationRef = useRef(0);
  const morphClonesRef = useRef<HTMLElement[]>([]);
  const morphLayerRef = useRef<HTMLDivElement | null>(null);
  const modifyLabelRef = useRef<HTMLDivElement>(null);

  /* ── Shapes dropdown refs & state ────────────────────── */
  const [shapesDropdownOpen, setShapesDropdownOpen] = useState(false);
  const shapesButtonRef = useRef<HTMLButtonElement>(null);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const [shapesMenuPos, setShapesMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const typeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [typeMenu, setTypeMenu] = useState<{ toolId: string; top: number; left: number } | null>(null);

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

  const [renderedCapsules, setRenderedCapsules] = useState(activeCapsules);
  const renderedCapsulesRef = useRef(renderedCapsules);

  /* FLIP + grouped many-to-few liquid-glass morph. Old buttons briefly live
     as fixed clones while React renders and measures the destination row. */
  useLayoutEffect(() => {
    const row = capsulesRowRef.current;
    if (!row) return;
    const generation = ++morphGenerationRef.current;
    const previous = renderedCapsulesRef.current;
    const previousIds = previous.map((item) => item.id).join("|");
    const nextIds = activeCapsules.map((item) => item.id).join("|");
    if (previousIds === nextIds) {
      renderedCapsulesRef.current = activeCapsules;
      setRenderedCapsules(activeCapsules);
      return;
    }

    capsuleTransitionRef.current?.kill();
    selectFlipRef.current?.kill();
    morphLayerRef.current?.remove();
    morphLayerRef.current = null;
    morphClonesRef.current.forEach((clone) => clone.remove());
    morphClonesRef.current = [];
    gsap.set(row.querySelectorAll(".desktop-capsule-btn"), { clearProps: "all" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      renderedCapsulesRef.current = activeCapsules;
      queueMicrotask(() => {
        if (generation === morphGenerationRef.current) {
          flushSync(() => setRenderedCapsules(activeCapsules));
        }
      });
      return;
    }

    const outgoingButtons = Array.from(row.querySelectorAll<HTMLElement>("[data-capsule-id]"));
    const oldSelect = outgoingButtons.find((button) => button.dataset.capsuleId === "select");
    const selectState = oldSelect ? Flip.getState(oldSelect) : null;
    const fusionLayer = document.createElement("div");
    fusionLayer.className = "desktop-capsule-morph-layer";
    document.body.appendChild(fusionLayer);
    morphLayerRef.current = fusionLayer;
    const clones = outgoingButtons.map((button) => {
      const rect = button.getBoundingClientRect();
      const clone = button.cloneNode(true) as HTMLElement;
      clone.classList.add("desktop-capsule-morph-clone");
      Object.assign(clone.style, {
        position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, margin: "0px",
      });
      fusionLayer.appendChild(clone);
      return clone;
    });
    morphClonesRef.current = clones;

    queueMicrotask(() => {
    if (generation !== morphGenerationRef.current || !row.isConnected) {
      clones.forEach((clone) => clone.remove());
      fusionLayer.remove();
      if (morphLayerRef.current === fusionLayer) morphLayerRef.current = null;
      return;
    }
    renderedCapsulesRef.current = activeCapsules;
    flushSync(() => setRenderedCapsules(activeCapsules));
    const incomingButtons = Array.from(row.querySelectorAll<HTMLElement>("[data-capsule-id]"));
    gsap.set(incomingButtons, {
      transition: "none",
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    });
    const incomingSelect = incomingButtons.find((button) => button.dataset.capsuleId === "select");
    const outgoingMerge = clones.filter((clone) => clone.dataset.capsuleId !== "select");
    const incomingMerge = incomingButtons.filter((button) => button.dataset.capsuleId !== "select");
    const timeline = gsap.timeline({
      defaults: { overwrite: true },
      onComplete: () => {
        clones.forEach((clone) => clone.remove());
        fusionLayer.remove();
        if (morphLayerRef.current === fusionLayer) morphLayerRef.current = null;
        morphClonesRef.current = [];
        gsap.set(incomingButtons, { clearProps: "all" });
      },
    });
    capsuleTransitionRef.current = timeline;

    appendCellularMorph(timeline, outgoingMerge, incomingMerge, fusionLayer);

    const outgoingSelect = clones.find((clone) => clone.dataset.capsuleId === "select");
    if (selectState && incomingSelect) {
      selectFlipRef.current = Flip.from(selectState, { targets: incomingSelect, duration: 0.38, ease: "back.inOut(1.2)", absolute: true });
      outgoingSelect?.remove();
    } else if (outgoingSelect) {
      timeline.to(outgoingSelect, { autoAlpha: 0, scale: 0.35, duration: 0.2, ease: "power3.in" }, 0);
    } else if (incomingSelect) {
      timeline.fromTo(incomingSelect, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.24, ease: "sine.out" }, 0.12);
    }
    });
  }, [activeCapsules]);

  useLayoutEffect(() => {
    if (!hasContextSelection || !modifyLabelRef.current) return;
    gsap.fromTo(modifyLabelRef.current, { autoAlpha: 0, y: -7 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power3.out" });
  }, [hasContextSelection, modifyTitle]);

  useEffect(() => () => {
    morphGenerationRef.current += 1;
    capsuleTransitionRef.current?.kill();
    selectFlipRef.current?.kill();
    morphLayerRef.current?.remove();
    morphClonesRef.current.forEach((clone) => clone.remove());
  }, []);

  /* ── actions ─────────────────────────────────────────── */
  const clearSelection = () => {
    useLayoutDrawingStore.getState().clearSelection();
    useToolMarkupStore.getState().clearSelection();
  };

  const handleCapsuleClick = (id: string) => {
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

    clearSelection();
    useLayoutDrawingStore.getState().setArmedLayoutTool(id as LayoutToolId);
    useAppStore.getState().setRightPanelOpen(true);
  };

  const chooseElementType = (toolId: string, typeDef: ElementTypeDefinition) => {
    const layout = useLayoutDrawingStore.getState();
    clearSelection();
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
    if (id === "dimension") return measureMode;
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
              className="pointer-events-none absolute bottom-0.5 left-0 h-0.5 rounded-full z-[1]"
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
        className="desktop-capsules-container fixed top-[63px] left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center justify-center select-none"
        style={{
          maxWidth: rightPanelOpen ? "calc(100vw - 360px)" : "calc(100vw - 48px)",
        }}
      >
        <div
          ref={capsulesRowRef}
          className="flex items-center gap-1.5 overflow-x-auto thin-scroll desktop-capsule-row-inner py-0.5 px-2 max-w-full"
        >
          {renderedCapsules.map((item) => {
            const active = isCapsuleActive(item.id);
            const isShapes = item.id === "shapes";
            const isTypeSelector = Boolean(TYPE_CATEGORY[item.id]);
            const activeShape = isShapes ? SHAPE_ITEMS.find((s) => s.id === armedMarkupTool) : null;
            const displayIcon = activeShape ? activeShape.icon : item.icon;
            const displayLabel = activeShape ? `Shapes (${activeShape.label.split(" ")[0]})` : item.label;

            const buttonContent = (
              <button
                ref={(element) => {
                  if (isShapes) shapesButtonRef.current = element;
                  if (isTypeSelector) typeButtonRefs.current[item.id] = element;
                }}
                type="button"
                data-capsule-id={item.id}
                data-flip-id={item.id === "select" ? "desktop-capsule-select" : undefined}
                onClick={() => handleCapsuleClick(item.id)}
                className={`desktop-capsule-btn ${active ? "is-active" : ""} ${item.isDanger ? "is-danger" : ""}`}
                aria-pressed={active}
                aria-haspopup={item.hasDropdown ? "menu" : undefined}
                aria-expanded={isShapes ? shapesDropdownOpen : isTypeSelector ? typeMenu?.toolId === item.id : undefined}
                title={item.label}
              >
                {displayIcon}
                <span className="desktop-capsule-label leading-none">{displayLabel}</span>
                {item.hasDropdown && (
                  <LuChevronDown
                    className={`h-2.5 w-2.5 opacity-60 ml-0.5 transition-transform duration-200 ${
                      (isShapes ? shapesDropdownOpen : typeMenu?.toolId === item.id) ? "rotate-180" : ""
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
