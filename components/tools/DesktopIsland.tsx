"use client";

/**
 * DesktopIsland — unified central movable floating island for desktop /werkzeug.
 *
 * Combines:
 *  1. Top Movable Island Bar:
 *     - Drag grip handle (draggable anywhere across the viewport)
 *     - Arch ↔ MEP toggle switch with GSAP animated thumb
 *     - Right-side category options (In Arch: Build [default], Structure, Annotate; In MEP: All, HVAC, Piping, Electrical)
 *     - When element selected: Contextual Modify chip + Deselect button
 *  2. Full-Width Capsule Row (directly below the island bar):
 *     - In Arch (Build): Select, Wall, Window, Door, Floor, Roof, Lines, Column, Beam, Stair, Ramp, Materials, Levels
 *     - In MEP: Select, Duct, Pipe, Cable Tray, Wire, Equipment, Work Plane
 *     - Contextual swap in that SAME place when an element is selected: Move, Rotate, Align X/Y, Mirror, Copy, Trim, Delete
 *     - Horizontally scrollable (scroll-x) if overflowing
 *     - Every capsule button explains its purpose in a portaled liquid-glass popup (GlassTooltip)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  LuAlignCenterHorizontal,
  LuBox,
  LuBuilding2,
  LuCopy,
  LuDoorOpen,
  LuFileText,
  LuFlipHorizontal2,
  LuGrid2X2,
  LuGripHorizontal,
  LuLayers3,
  LuMousePointer2,
  LuMove,
  LuPalette,
  LuRotate3D,
  LuRuler,
  LuScissors,
  LuTrash2,
  LuX,
  LuZap,
} from "react-icons/lu";
import {
  IconMarkupFloor,
  IconMarkupRoof,
  IconMarkupWall,
  IconMarkupWindow,
} from "./MarkupIcons";
import GlassPanel from "@/components/common/GlassPanel";
import GlassTooltip from "@/components/common/GlassTooltip";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import type { LayoutToolId } from "@/lib/layoutDrawing";

/* ───── types & definitions ─────────────────────────────────────── */

type ArchCategory = "build" | "structure" | "annotate";
type MepCategory = "all" | "hvac" | "piping" | "electrical";

type CapsuleItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  isDanger?: boolean;
};

const ARCH_BUILD_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 /> },
  { id: "wall", label: "Wall", hint: "Draw architectural walls (W)", icon: <IconMarkupWall /> },
  { id: "window", label: "Window", hint: "Place windows on walls", icon: <IconMarkupWindow /> },
  { id: "door", label: "Door", hint: "Place doors on walls (D)", icon: <LuDoorOpen /> },
  { id: "floor", label: "Floor", hint: "Sketch floor slab boundary", icon: <IconMarkupFloor /> },
  { id: "roof", label: "Roof", hint: "Sketch roof boundary", icon: <IconMarkupRoof /> },
  { id: "lines", label: "Lines", hint: "Draw detail & sketch lines (L)", icon: <span className="font-bold">L</span> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <LuBox /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <LuBox /> },
  { id: "stair", label: "Stair", hint: "Create architectural stairs (S)", icon: <LuLayers3 /> },
  { id: "ramp", label: "Ramp", hint: "Create access ramps (R)", icon: <LuLayers3 /> },
  { id: "materials", label: "Materials", hint: "Open material editor panel", icon: <LuPalette /> },
  { id: "levels", label: "Levels", hint: "Manage building storeys & elevations", icon: <LuLayers3 /> },
];

const ARCH_STRUCTURE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 /> },
  { id: "column", label: "Column", hint: "Place structural column (C)", icon: <LuBox /> },
  { id: "beam", label: "Beam", hint: "Draw structural beam (B)", icon: <LuBox /> },
  { id: "floor", label: "Slab", hint: "Place structural concrete slab", icon: <IconMarkupFloor /> },
  { id: "grid", label: "Grid", hint: "Draw column grid lines (G)", icon: <LuGrid2X2 /> },
];

const ARCH_ANNOTATE_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 /> },
  { id: "lines", label: "Lines", hint: "Draw detail sketch lines (L)", icon: <span className="font-bold">L</span> },
  { id: "dimension", label: "Dimension", hint: "Measure distance between elements", icon: <LuRuler /> },
  { id: "note", label: "Note", hint: "Place text note or callout", icon: <LuFileText /> },
];

const MEP_ALL_ITEMS: CapsuleItem[] = [
  { id: "select", label: "Select", hint: "Select elements in 3D viewport (Esc)", icon: <LuMousePointer2 /> },
  { id: "duct", label: "Duct", hint: "Draw rectangular supply duct", icon: <span className="font-bold text-sky-400">▭</span> },
  { id: "pipe", label: "Pipe", hint: "Draw hydronic & sanitary piping", icon: <span className="font-bold text-blue-400">○</span> },
  { id: "cabletray", label: "Tray", hint: "Route electrical cable tray", icon: <span className="font-bold text-slate-400">≋</span> },
  { id: "wire", label: "Wire", hint: "Draw electrical circuits & wiring", icon: <LuZap /> },
  { id: "equipment", label: "Equipment", hint: "Place mechanical & electrical equipment", icon: <LuBox /> },
  { id: "workplane", label: "Work Plane", hint: "Set reference drawing plane (G)", icon: <LuGrid2X2 /> },
];

const MODIFY_ITEMS: CapsuleItem[] = [
  { id: "move", label: "Move", hint: "Translate selected elements", icon: <LuMove /> },
  { id: "rotate", label: "Rotate", hint: "Rotate selected elements around center", icon: <LuRotate3D /> },
  { id: "align", label: "Align", hint: "Align elements along X or Y axis", icon: <LuAlignCenterHorizontal /> },
  { id: "mirror", label: "Mirror", hint: "Mirror selection about an axis", icon: <LuFlipHorizontal2 /> },
  { id: "copy", label: "Copy", hint: "Duplicate selected elements", icon: <LuCopy /> },
  { id: "trim", label: "Trim", hint: "Trim or extend elements (T)", icon: <LuScissors /> },
  { id: "delete", label: "Delete", hint: "Delete selected elements (Del)", icon: <LuTrash2 />, isDanger: true },
  { id: "deselect", label: "Deselect", hint: "Clear active selection (Esc)", icon: <LuX /> },
];

/* ───── component ───────────────────────────────────────────────── */

export default function DesktopIsland() {
  /* ── store subscriptions ─────────────────────────────── */
  const mepModeActive = useLayoutDrawingStore((s) => s.mepModeActive);
  const setMepModeActive = useLayoutDrawingStore((s) => s.setMepModeActive);
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const selectedElements = useLayoutDrawingStore((s) => s.selectedElements);
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  /* ── local category state ────────────────────────────── */
  const [archCategory, setArchCategory] = useState<ArchCategory>("build");
  const [mepCategory, setMepCategory] = useState<MepCategory>("all");
  const [alignAxis, setAlignAxis] = useState<"x" | "y">("x");

  /* ── drag position state ─────────────────────────────── */
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? Math.round(window.innerWidth / 2) : 640,
    y: 12,
  }));

  /* ── refs for animated toggle thumb ──────────────────── */
  const thumbRef = useRef<HTMLSpanElement>(null);
  const archRef = useRef<HTMLSpanElement>(null);
  const mepRef = useRef<HTMLSpanElement>(null);
  const thumbReadyRef = useRef(false);

  /* ── Arch/MEP thumb animation (GSAP) ─────────────────── */
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const target = mepModeActive ? mepRef.current : archRef.current;
    if (!thumb || !target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const properties = {
      x: target.offsetLeft - 2,
      width: target.offsetWidth + 2,
      backgroundColor: mepModeActive ? "rgba(56, 189, 248, 0.88)" : "rgba(250, 204, 21, 0.88)",
      boxShadow: mepModeActive
        ? "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(56,189,248,.38)"
        : "inset 0 1px rgba(255,255,255,.72), 0 2px 10px rgba(250,204,21,.34)",
    };

    if (!thumbReadyRef.current || reduceMotion) {
      gsap.set(thumb, properties);
      thumbReadyRef.current = true;
      return;
    }

    gsap.to(thumb, { ...properties, duration: 0.44, ease: "power3.inOut", overwrite: true });
    return () => { gsap.killTweensOf(thumb); };
  }, [mepModeActive]);

  /* ── drag handler (grab handle or top bar) ───────────── */
  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input, select, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = { cx: e.clientX, cy: e.clientY, px: pos.x, py: pos.y };

    const move = (ev: PointerEvent) => {
      const nextX = Math.max(160, Math.min(window.innerWidth - 160, start.px + ev.clientX - start.cx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 80, start.py + ev.clientY - start.cy));
      setPos({ x: nextX, y: nextY });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ── selection detection ─────────────────────────────── */
  const hasContextSelection = useMemo(
    () =>
      selectedElements.some(
        (ref) =>
          ref.kind === "wall" ||
          ref.kind === "door" ||
          ref.kind === "window" ||
          ref.kind === "slab" ||
          ref.kind === "stair" ||
          ref.kind === "ramp" ||
          ref.kind === "column" ||
          ref.kind === "beam",
      ),
    [selectedElements],
  );

  /* ── contextual title ────────────────────────────────── */
  const modifyTitle = selectedWallId
    ? "Modify · Wall"
    : selectedDoorId
      ? "Modify · Door"
      : selectedWindowId
        ? "Modify · Window"
        : selectedSlabId
          ? "Modify · Slab"
          : selectedStairId
            ? "Modify · Stair"
            : selectedRampId
              ? "Modify · Ramp"
              : "Modify";

  /* ── active capsule set ──────────────────────────────── */
  const activeCapsules = useMemo(() => {
    if (hasContextSelection) {
      return MODIFY_ITEMS.map((item) =>
        item.id === "align"
          ? { ...item, label: `Align ${alignAxis.toUpperCase()}` }
          : item,
      );
    }
    if (mepModeActive) {
      return MEP_ALL_ITEMS;
    }
    switch (archCategory) {
      case "structure":
        return ARCH_STRUCTURE_ITEMS;
      case "annotate":
        return ARCH_ANNOTATE_ITEMS;
      case "build":
      default:
        return ARCH_BUILD_ITEMS;
    }
  }, [hasContextSelection, mepModeActive, archCategory, alignAxis]);

  /* ── clear selection handler ─────────────────────────── */
  const clearSelection = () => {
    const store = useLayoutDrawingStore.getState();
    store.clearSelection();
    useToolMarkupStore.getState().clearSelection();
  };

  /* ── Escape key listener to clear selection ──────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        useLayoutDrawingStore.getState().setArmedLayoutTool(null);
        useToolMarkupStore.getState().setArmedTool(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── toggle Arch / MEP ───────────────────────────────── */
  const toggleMode = () => {
    const nextMep = !mepModeActive;
    useLayoutDrawingStore.getState().setArmedLayoutTool(null);
    useToolMarkupStore.getState().setArmedTool(null);
    clearSelection();
    setMepModeActive(nextMep);
  };

  /* ── click handlers ──────────────────────────────────── */
  const handleCapsuleClick = (id: string) => {
    const store = useLayoutDrawingStore.getState();
    const markup = useToolMarkupStore.getState();

    // Contextual modify actions
    if (hasContextSelection) {
      switch (id) {
        case "move":
          store.setArmedLayoutTool(null);
          markup.setTransformMode("translate");
          break;
        case "rotate":
          store.setArmedLayoutTool(null);
          markup.setTransformMode("rotate");
          break;
        case "align": {
          void store.alignSelected(alignAxis);
          setAlignAxis((axis) => (axis === "x" ? "y" : "x"));
          break;
        }
        case "mirror": {
          const wall = store.walls.find((w) => w.id === store.selectedWallId);
          if (wall) {
            void store.mirrorSelected(
              { xMm: wall.startXmm, yMm: wall.startYmm },
              { xMm: wall.endXmm, yMm: wall.endYmm },
            );
          } else {
            const column = store.columns.find((c) =>
              store.selectedElements.some((ref) => ref.kind === "column" && ref.id === c.id),
            );
            const slab = store.slabs.find((s) => s.id === store.selectedSlabId);
            const centerX = column?.xMm ?? (slab ? (slab.minXmm + slab.maxXmm) / 2 : 0);
            void store.mirrorSelected(
              { xMm: centerX, yMm: -1_000_000 },
              { xMm: centerX, yMm: 1_000_000 },
            );
          }
          break;
        }
        case "copy":
          if (markup.selectedPlacementId) {
            void markup.duplicatePlacement(markup.selectedPlacementId);
          } else {
            void store.copySelected(100, 100);
          }
          break;
        case "trim":
          store.setArmedLayoutTool(store.armedLayoutTool === "trim" ? null : "trim");
          break;
        case "delete":
          void store.deleteSelected();
          break;
        case "deselect":
          clearSelection();
          break;
      }
      return;
    }

    // Regular tool actions
    if (id === "select") {
      store.setArmedLayoutTool(null);
      markup.setArmedTool(null);
      return;
    }

    if (id === "levels" || id === "materials") {
      store.setArmedLayoutTool(null);
      markup.setArmedTool(null);
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }

    // Toggle: if already armed, disarm; otherwise arm
    const toolId = id as LayoutToolId;
    if (store.armedLayoutTool === toolId) {
      store.setArmedLayoutTool(null);
    } else {
      store.setArmedLayoutTool(toolId);
      markup.setArmedTool(null);
      // Ensure right panel responds to show tool options
      if (!rightPanelOpen) {
        useAppStore.getState().setRightPanelOpen(true);
      }
    }
  };

  /* ── check if capsule is active ──────────────────────── */
  const isCapsuleActive = (id: string) => {
    if (hasContextSelection) {
      if (id === "trim") return armed === "trim";
      return false;
    }
    if (id === "select") return armed === null;
    return armed === id;
  };

  return (
    <div
      className="desktop-movable-island pointer-events-auto fixed z-[75] flex flex-col items-center select-none"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translateX(-50%)",
        width: "min(1240px, calc(100vw - 32px))",
        maxWidth: rightPanelOpen ? "calc(100vw - 336px)" : "calc(100vw - 32px)",
      }}
    >
      {/* ── Top Bar: Movable Island Pill ─────────────────── */}
      <div
        onPointerDown={beginDrag}
        className="cursor-grab active:cursor-grabbing mb-1.5 transition-shadow"
      >
        <GlassPanel variant="panel" zIndex={76} wrapperClassName="rounded-full shadow-2xl">
          <div className="flex h-10 items-center gap-2 pl-2 pr-3">
            {/* Grab grip handle */}
            <span
              className="flex h-7 w-6 items-center justify-center text-[var(--text-muted)] opacity-60 hover:opacity-100 transition-opacity"
              title="Drag to reposition"
            >
              <LuGripHorizontal className="h-3.5 w-3.5" />
            </span>

            {/* Arch ↔ MEP Toggle switch */}
            <button
              type="button"
              onClick={toggleMode}
              aria-pressed={mepModeActive}
              data-mode={mepModeActive ? "mep" : "arch"}
              aria-label={mepModeActive ? "Switch to Architecture mode" : "Switch to MEP mode"}
              title={mepModeActive ? "MEP mode active — switch to Architecture" : "Architecture mode active — switch to MEP"}
              className="desktop-island-toggle group relative flex h-7 shrink-0 items-center gap-0 rounded-full border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-px transition-all"
            >
              <span
                ref={thumbRef}
                className="pointer-events-none absolute left-px top-px h-[1.625rem] rounded-full"
                aria-hidden="true"
              />
              <span
                ref={archRef}
                className={`relative z-[1] flex h-[1.625rem] items-center gap-1 rounded-full px-2.5 text-[10px] font-bold leading-none transition-colors duration-300 ${
                  !mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)]"
                }`}
              >
                <LuBuilding2 className="h-3 w-3" />
                <span>Arch</span>
              </span>
              <span
                ref={mepRef}
                className={`relative z-[1] flex h-[1.625rem] items-center gap-1 rounded-full px-2.5 text-[10px] font-bold leading-none transition-colors duration-300 ${
                  mepModeActive ? "text-zinc-900" : "text-[var(--text-muted)]"
                }`}
              >
                <LuZap className="h-3 w-3" />
                <span>MEP</span>
              </span>
            </button>

            {/* Divider */}
            <span className="h-4 w-px bg-[var(--panel-divider)] opacity-60 mx-0.5" />

            {/* Right side of island: Category Options / Selection Status */}
            {hasContextSelection ? (
              <div className="flex items-center gap-1.5 pl-1">
                <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 px-2.5 py-0.5 text-[10px] font-bold text-yellow-500 dark:text-yellow-300">
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setArchCategory("build")}
                  className={`desktop-island-category-btn ${archCategory === "build" ? "is-active" : ""}`}
                >
                  Build
                </button>
                <button
                  type="button"
                  onClick={() => setArchCategory("structure")}
                  className={`desktop-island-category-btn ${archCategory === "structure" ? "is-active" : ""}`}
                >
                  Structure
                </button>
                <button
                  type="button"
                  onClick={() => setArchCategory("annotate")}
                  className={`desktop-island-category-btn ${archCategory === "annotate" ? "is-active" : ""}`}
                >
                  Annotate
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMepCategory("all")}
                  className={`desktop-island-category-btn ${mepCategory === "all" ? "is-active" : ""}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setMepCategory("hvac")}
                  className={`desktop-island-category-btn ${mepCategory === "hvac" ? "is-active" : ""}`}
                >
                  HVAC
                </button>
                <button
                  type="button"
                  onClick={() => setMepCategory("piping")}
                  className={`desktop-island-category-btn ${mepCategory === "piping" ? "is-active" : ""}`}
                >
                  Piping
                </button>
                <button
                  type="button"
                  onClick={() => setMepCategory("electrical")}
                  className={`desktop-island-category-btn ${mepCategory === "electrical" ? "is-active" : ""}`}
                >
                  Electrical
                </button>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* ── Below It: Full-Width Capsule Row ──────────────── */}
      <div className="w-full">
        <GlassPanel variant="panel" zIndex={75} wrapperClassName="w-full rounded-2xl shadow-xl">
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 thin-scroll">
            {/* Mode / set descriptor label */}
            <span className="shrink-0 select-none px-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {hasContextSelection
                ? "Modify"
                : mepModeActive
                  ? mepCategory.toUpperCase()
                  : archCategory.toUpperCase()}
            </span>

            <span className="h-5 w-px shrink-0 bg-[var(--panel-divider)] opacity-40 mr-1" />

            {/* Capsules */}
            {activeCapsules.map((item) => {
              const active = isCapsuleActive(item.id);
              return (
                <GlassTooltip
                  key={item.id}
                  label={item.label}
                  hint={item.hint}
                  className="shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => handleCapsuleClick(item.id)}
                    className={`desktop-capsule-btn ${active ? "is-active" : ""} ${item.isDanger ? "is-danger" : ""}`}
                    aria-pressed={active}
                    title={item.label}
                  >
                    <span className="desktop-capsule-btn-icon">{item.icon}</span>
                    <span className="desktop-capsule-btn-label">{item.label}</span>
                  </button>
                </GlassTooltip>
              );
            })}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
