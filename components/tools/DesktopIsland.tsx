"use client";
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
import { flushSync } from "react-dom";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
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

gsap.registerPlugin(Flip, MorphSVGPlugin);

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

function appendCellularMorph(
  timeline: gsap.core.Timeline,
  outgoing: HTMLElement[],
  incoming: HTMLElement[],
  fusionLayer: HTMLElement,
) {
  // Keep the organic phases compact: the entire row settles in 230–280 ms.
  timeline.timeScale(1.9);
  const groupDelay = 0.01;
  const approach = 0.12;
  const fusion = 0.15;
  const resolve = 0.13;
  const pinchAt = approach + fusion;
  const settleAt = pinchAt + resolve;
  // This timeline inherits overwrite:true. Phases intentionally share targets,
  // so their local tweens must coexist instead of killing the next phase.
  const phase = { overwrite: false };
  const ns = "http://www.w3.org/2000/svg";
  const sourceRects = new Map(outgoing.map((node) => [node, node.getBoundingClientRect()]));
  const targetRects = new Map(incoming.map((node) => [node, node.getBoundingClientRect()]));

  const pill = (cx: number, cy: number, width: number, height: number) => {
    const r = Math.min(height, width) / 2, k = r * 0.55228475;
    const l = cx - width / 2, t = cy - height / 2, b = cy + height / 2, right = cx + width / 2;
    return `M${l + r},${t} H${right - r} C${right - r + k},${t} ${right},${t + r - k} ${right},${t + r}
      V${b - r} C${right},${b - r + k} ${right - r + k},${b} ${right - r},${b}
      H${l + r} C${l + r - k},${b} ${l},${b - r + k} ${l},${b - r}
      V${t + r} C${l},${t + r - k} ${l + r - k},${t} ${l + r},${t} Z`;
  };
  // Smooth lobes joined by narrow necks: every split point pinches together.
  const lobes = (cx: number, cy: number, width: number, height: number, count: number) => {
    const l = cx - width / 2, step = width / count, neck = height * 0.07;
    let d = `M${l},${cy}`;
    for (let i = 0; i < count; i++) {
      const x = l + i * step, endY = i === count - 1 ? cy : cy - neck;
      d += ` C${x},${cy - height * 0.65} ${x + step},${cy - height * 0.65} ${x + step},${endY}`;
    }
    for (let i = count - 1; i >= 0; i--) {
      const x = l + i * step, endY = i === 0 ? cy : cy + neck;
      d += ` C${x + step},${cy + height * 0.65} ${x},${cy + height * 0.65} ${x},${endY}`;
    }
    return `${d} Z`;
  };
  const body = (reference: HTMLElement, shape: string) => {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "fixed", inset: "0", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" });
    const computed = getComputedStyle(reference);
    const colors = computed.backgroundImage.match(/rgba?\([^)]+\)/g);
    const gradientId = `capsule-blob-${gsap.utils.random(0, 1e9, 1)}`;
    const defs = document.createElementNS(ns, "defs");
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = gradientId;
    gradient.setAttribute("x2", "0"); gradient.setAttribute("y2", "1");
    [colors?.[0] ?? computed.backgroundColor, colors?.at(-1) ?? computed.backgroundColor].forEach((color, i) => {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", String(i)); stop.setAttribute("stop-color", color); gradient.appendChild(stop);
    });
    defs.appendChild(gradient); svg.appendChild(defs);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", shape); path.setAttribute("fill", `url(#${gradientId})`);
    path.setAttribute("stroke", computed.borderTopColor); path.setAttribute("stroke-width", "1");
    path.style.opacity = "0";
    svg.appendChild(path); fusionLayer.appendChild(svg);
    return path;
  };
  const morph = (path: SVGPathElement, from: string, to: string, at: number, duration: number, ease: string) => {
    timeline.fromTo(path, { morphSVG: from }, {
      ...phase, morphSVG: { shape: to, shapeIndex: 0 }, duration, ease, immediateRender: false,
    }, at);
  };
  const reveal = (target: HTMLElement, path: SVGPathElement, at: number) => {
    // Real buttons (including their labels) arrive only after the body settles.
    timeline.to(target, { ...phase, autoAlpha: 1, duration: 0.07, ease: "sine.out" }, at + 0.36);
    timeline.to(path, { ...phase, opacity: 0, duration: 0.04, ease: "sine.out" }, at + settleAt);
  };
  const same = (source: HTMLElement, target: HTMLElement, offset: number) => {
    const first = sourceRects.get(source)!, last = targetRects.get(target)!;
    const dx = last.left - first.left, dy = last.top - first.top;
    gsap.set(target, { autoAlpha: 0, x: -dx, y: -dy, scaleX: first.width / last.width, transformOrigin: "left center" });
    timeline.to(source, { ...phase, x: dx, y: dy, width: last.width, scaleY: 1.04, borderRadius: "50%", duration: 0.28, ease: "back.inOut(1.15)" }, offset);
    timeline.to(source.children, { ...phase, autoAlpha: 0, duration: 0.08 }, offset + 0.1);
    timeline.to(target, { ...phase, x: 0, y: 0, scaleX: 1, duration: 0.28, ease: "back.inOut(1.15)" }, offset);
    timeline.to(target, { ...phase, autoAlpha: 1, duration: 0.12, ease: "sine.inOut" }, offset + 0.14);
    timeline.to(source, { ...phase, autoAlpha: 0, duration: 0.1 }, offset + 0.16);
    timeline.to(target, { ...phase, scaleY: 1, duration: 0.08, ease: "elastic.out(1, .7)" }, offset + 0.28);
  };

  if (outgoing.length === incoming.length) {
    outgoing.forEach((source, index) => same(source, incoming[index], index * groupDelay));
    return;
  }

  if (outgoing.length > incoming.length) {
    const groups = groupCapsulesForMorph(outgoing, incoming.length);
    incoming.forEach((target, groupIndex) => {
      const group = groups[groupIndex] ?? [];
      if (!group.length) return;
      const offset = groupIndex * groupDelay;
      if (group.length === 1) { same(group[0], target, offset); return; }
      const targetRect = targetRects.get(target)!;
      const targetCenter = targetRect.left + targetRect.width / 2;
      const sourceCenter = group.reduce((sum, source) => { const r = sourceRects.get(source)!; return sum + r.left + r.width / 2; }, 0) / group.length;
      const center = sourceCenter + (targetCenter - sourceCenter) * 0.45;
      const cy = targetRect.top + targetRect.height / 2;
      const diameter = targetRect.height * 1.2;
      const joinedWidth = diameter * (1 + (group.length - 1) * 0.65);
      const joined = lobes(center, cy, joinedWidth, diameter, group.length);
      const absorbed = pill(center, cy, diameter * 1.15, diameter);
      const final = pill(targetCenter, cy, targetRect.width, targetRect.height);
      const blob = body(target, joined);
      gsap.set(target, { autoAlpha: 0 });
      group.forEach((source, i) => {
        const rect = sourceRects.get(source)!;
        const firstCenter = rect.left + rect.width / 2;
        const beadWidth = Math.max(diameter, rect.width * 0.62);
        timeline.to(source, { ...phase,
          x: center + (firstCenter - sourceCenter) * 0.4 - rect.left - beadWidth / 2,
          y: cy - rect.top - rect.height / 2, width: beadWidth,
          scaleX: 0.92, scaleY: 0.94, borderRadius: "50%",
          duration: approach, ease: "power2.inOut",
        }, offset);
        timeline.to(source, { ...phase,
          x: center + (i - (group.length - 1) / 2) * diameter * 0.65 - rect.left - diameter / 2,
          width: diameter, scaleX: 0.8, scaleY: 1.14, borderRadius: "50%",
          duration: fusion, ease: "back.inOut(1.5)",
        }, offset + approach);
        timeline.to(source.children, { ...phase, autoAlpha: 0, duration: 0.08 }, offset + 0.07);
        timeline.to(source, { ...phase, autoAlpha: 0, duration: 0.08 }, offset + 0.15);
      });
      timeline.to(blob, { ...phase, opacity: 1, duration: 0.06 }, offset + approach);
      morph(blob, joined, absorbed, offset + approach, fusion, "back.inOut(1.4)");
      morph(blob, absorbed, final, offset + pinchAt, resolve, "elastic.out(1, .65)");
      reveal(target, blob, offset);
    });
    return;
  }

  const targetGroups = groupCapsulesForMorph(incoming, outgoing.length);
  outgoing.forEach((source, groupIndex) => {
    const targets = targetGroups[groupIndex] ?? [];
    if (!targets.length) return;
    const offset = groupIndex * groupDelay;
    if (targets.length === 1) { same(source, targets[0], offset); return; }
    const first = sourceRects.get(source)!;
    const rects = targets.map((target) => targetRects.get(target)!);
    const sourceCenter = first.left + first.width / 2;
    const finalCenter = (rects[0].left + rects.at(-1)!.right) / 2;
    const center = sourceCenter + (finalCenter - sourceCenter) * 0.45;
    const cy = first.top + first.height / 2;
    const width = Math.max(first.width * 1.25, targets.length * first.height * 0.85);
    const swelled = pill(sourceCenter, cy, first.width * 1.08, first.height * 1.12);
    const pinched = lobes(center, cy, width, first.height * 1.12, targets.length);
    const blob = body(source, swelled);
    timeline.to(source, { ...phase, scaleX: 1.08, scaleY: 1.12, borderRadius: "50%", duration: approach, ease: "back.out(1.3)" }, offset);
    timeline.to(source.children, { ...phase, autoAlpha: 0, duration: 0.07 }, offset + 0.07);
    timeline.to(source, { ...phase, autoAlpha: 0, duration: 0.05 }, offset + approach);
    timeline.to(blob, { ...phase, opacity: 1, duration: 0.05 }, offset + approach);
    morph(blob, swelled, pinched, offset + approach, fusion, "back.inOut(1.5)");
    timeline.set(blob, { ...phase, opacity: 0 }, offset + pinchAt);
    targets.forEach((target, i) => {
      const rect = rects[i];
      const pieceCenter = center - width / 2 + (i + 0.5) * width / targets.length;
      const seed = lobes(pieceCenter, cy, width / targets.length, first.height * 1.12, 1);
      const final = pill(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height);
      const piece = body(target, seed);
      gsap.set(target, { autoAlpha: 0 });
      timeline.set(piece, { ...phase, opacity: 1 }, offset + pinchAt);
      morph(piece, seed, final, offset + pinchAt, resolve, "elastic.out(1, .65)");
      reveal(target, piece, offset);
    });
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
  const armedMarkupTool = useToolMarkupStore((s) => s.armedTool);


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
            { id: "roof-hip", label: "Hip", hint: "Hip roof (all edges sloped 30°)", icon: <span className="text-[11px] font-bold text-yellow-400">◺</span> },
            { id: "roof-gable", label: "Gable", hint: "Gable roof (2 opposite slopes, 2 vertical ends)", icon: <span className="text-[11px] font-bold text-amber-400">∧</span> },
            { id: "roof-shed", label: "Shed", hint: "Shed / mono-pitch roof (single slope)", icon: <span className="text-[11px] font-bold text-orange-400">/</span> },
            { id: "roof-flat", label: "Flat", hint: "Flat roof slab (0° pitch)", icon: <span className="text-[11px] font-bold text-blue-400">—</span> },
          );
        }
        return [...slabItems, ...MODIFY_ITEMS];
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
  }, [hasContextSelection, mepModeActive, archCategory, mepCategory, isBoundaryEditing, selectedSlabId, slabs]);

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
      selectFlipRef.current = Flip.from(selectState, { targets: incomingSelect, duration: 0.22, ease: "back.inOut(1.2)", absolute: true });
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
    if (id === "move" || id === "rotate" || id === "align" || id === "mirror" || id === "split") {
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
    if (id.startsWith("boundary-")) return id === `boundary-${boundaryEdit?.tool}`;
    if (id === "dimension") return measureMode;
    if (["move", "rotate", "align", "mirror", "split"].includes(id)) return modifyTool === id;
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
