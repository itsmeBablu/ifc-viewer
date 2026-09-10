"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useDrawingInteractionStore } from "@/store/useDrawingInteractionStore";
import type { DrawingShape } from "@/lib/drawingShapes";
import { LuChevronDown, LuMousePointerClick, LuCheck, LuSparkles } from "react-icons/lu";

export interface DrawingShapeMeta {
  id: DrawingShape;
  label: string;
  glyph: string;
  badge: string;
  shortDesc: string;
  detail: string;
  steps: string[];
}

export const DRAWING_SHAPES: DrawingShapeMeta[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    glyph: "▭",
    badge: "2 corners · 90°",
    shortDesc: "Draw 4 walls / lines with perpendicular corners",
    detail: "Click the first corner, then click the opposite diagonal corner. Automatically generates 4 connected boundary segments with 90° right angles.",
    steps: ["Click 1st corner", "Click opposite corner"],
  },
  {
    id: "line",
    label: "Straight Line",
    glyph: "╱",
    badge: "2 points · Chain",
    shortDesc: "Single wall or continuous line chain",
    detail: "Click start point, then click endpoint. Continue clicking to chain connected segments, or click Finish / press Esc to complete.",
    steps: ["Click start point", "Click endpoint", "Continue chain or Finish"],
  },
  {
    id: "arc",
    label: "3-Point Arc",
    glyph: "◠",
    badge: "3 points · Curve",
    shortDesc: "Curved wall or boundary arc",
    detail: "Click the arc start point, then click the endpoint, then click a point on the curve to define the arc radius and sweep curvature.",
    steps: ["Click start point", "Click endpoint", "Click curve radius"],
  },
  {
    id: "circle",
    label: "Circle",
    glyph: "○",
    badge: "Center + Radius",
    shortDesc: "Circular wall or round boundary",
    detail: "Click the center point, then move the cursor outward and click to set the circle radius. Divides smoothly into 4 analytical arcs.",
    steps: ["Click center point", "Click radius point"],
  },
  {
    id: "pick-edge",
    label: "Pick Edge / DWG",
    glyph: "⌁",
    badge: "Trace segment",
    shortDesc: "Trace existing model edge or CAD vector line",
    detail: "Hover and click any existing model line, wall boundary, or imported DWG/DXF vector segment to instantly duplicate and trace it.",
    steps: ["Hover geometry / DWG", "Click segment to trace"],
  },
  {
    id: "pick-face",
    label: "Pick Face Outline",
    glyph: "▱",
    badge: "Project 3D face",
    shortDesc: "Extract and project planar mesh boundary",
    detail: "Click any planar 3D mesh face in the model. Its perimeter outline is automatically extracted and projected onto the active level.",
    steps: ["Click 3D surface", "Auto-project boundary"],
  },
];

export function DrawingModeSelect() {
  const shape = useDrawingInteractionStore((s) => s.shape);
  const busy = useDrawingInteractionStore((s) => s.busy);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredShapeId, setHoveredShapeId] = useState<DrawingShape | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const activeShape = DRAWING_SHAPES.find((s) => s.id === shape) || DRAWING_SHAPES[0];
  const previewShape = DRAWING_SHAPES.find((s) => s.id === (hoveredShapeId || shape)) || activeShape;

  const selectShape = (newShape: DrawingShape) => {
    useDrawingInteractionStore.setState({ shape: newShape, navigating: false, message: null });
    window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
    setDropdownOpen(false);
  };

  const toggleDropdown = () => {
    if (busy) return;
    if (!dropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popupW = 320;
      const left = Math.max(12, Math.min(window.innerWidth - popupW - 12, rect.left));
      const top = rect.bottom + 6;
      setMenuPos({ top, left });
    }
    setDropdownOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <div className="flex items-center gap-1">
      {/* Quick Line button */}
      <button
        type="button"
        disabled={busy}
        onClick={() => selectShape("line")}
        className={`flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md text-[11px] font-bold transition-all border ${
          shape === "line"
            ? "bg-amber-500/20 border-amber-500/80 text-amber-400 shadow-sm"
            : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-amber-400/40 hover:text-[var(--text-strong)]"
        }`}
        title="Straight Line (╱) — Tap start and endpoint"
      >
        <span className="font-mono text-sm leading-none">╱</span>
        <span>Line</span>
      </button>

      {/* Quick Rectangle button */}
      <button
        type="button"
        disabled={busy}
        onClick={() => selectShape("rectangle")}
        className={`flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md text-[11px] font-bold transition-all border ${
          shape === "rectangle"
            ? "bg-amber-500/20 border-amber-500/80 text-amber-400 shadow-sm"
            : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-amber-400/40 hover:text-[var(--text-strong)]"
        }`}
        title="Rectangle (▭) — Tap two opposite corners to draw rectangle"
      >
        <span className="font-mono text-sm leading-none">▭</span>
        <span>Rectangle</span>
      </button>

      {/* All Shapes Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={busy}
        onClick={toggleDropdown}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className={`flex items-center gap-1 px-2 py-0.5 h-7 rounded-md text-[11px] font-medium transition-all border ${
          dropdownOpen || (shape !== "line" && shape !== "rectangle")
            ? "bg-amber-500/15 border-amber-500/60 text-amber-400"
            : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-body)]"
        }`}
        title="Drawing Shapes dropdown — Rectangle, Arc, Circle, Pick"
      >
        <span className="font-mono text-xs">{activeShape.glyph}</span>
        <span className="capitalize">
          {shape === "line" || shape === "rectangle" ? "Shapes" : activeShape.label}
        </span>
        <LuChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Portaled Shapes Dropdown with Live Hover Details */}
      {dropdownOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[9999] w-[330px] rounded-2xl border border-[var(--panel-divider)] bg-[var(--popover-bg)] p-2.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-label="Drawing shapes selection"
          >
            {/* Header */}
            <div className="mb-2 flex items-center justify-between border-b border-[var(--panel-divider)] px-1.5 pb-2">
              <div className="flex items-center gap-1.5">
                <LuSparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-400">
                  Draw Mode & Shapes
                </span>
              </div>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                {DRAWING_SHAPES.length} Modes
              </span>
            </div>

            {/* Shapes list */}
            <div className="space-y-1">
              {DRAWING_SHAPES.map((item) => {
                const isSelected = shape === item.id;
                const isHovered = (hoveredShapeId || shape) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => selectShape(item.id)}
                    onMouseEnter={() => setHoveredShapeId(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all ${
                      isSelected
                        ? "bg-amber-500/20 border border-amber-500/60 text-amber-300"
                        : isHovered
                        ? "bg-[var(--glass-inset-bg)] border border-[var(--panel-divider)] text-[var(--text-strong)]"
                        : "border border-transparent hover:bg-[var(--glass-inset-bg)] text-[var(--text-body)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-overlay)] font-mono text-sm font-bold shadow-inner">
                        {item.glyph}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold leading-tight truncate">
                            {item.label}
                          </span>
                          {item.id === "rectangle" && (
                            <span className="rounded bg-amber-500/25 px-1 py-0.2 text-[8.5px] font-bold text-amber-300">
                              Featured
                            </span>
                          )}
                        </div>
                        <span className="block text-[9.5px] text-[var(--text-muted)] truncate">
                          {item.shortDesc}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="rounded bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[var(--text-muted)]">
                        {item.badge}
                      </span>
                      {isSelected && <LuCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hover Details Card */}
            <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {previewShape.glyph}
                  </span>
                  <span className="text-xs font-bold text-amber-300">{previewShape.label} Details</span>
                </div>
                <span className="text-[9px] font-semibold text-amber-400/80">
                  {previewShape.badge}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-body)] mb-2">
                {previewShape.detail}
              </p>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-amber-500/20 text-[9px] text-[var(--text-muted)]">
                <LuMousePointerClick className="h-3 w-3 text-amber-400 shrink-0" />
                <span>
                  <strong>Steps:</strong> {previewShape.steps.join(" → ")}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function DrawingShapeOptions() {
  const armed = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const wall = useLayoutDrawingStore((s) => s.selectedWallId);
  const line = useLayoutDrawingStore((s) => s.selectedSketchLineId);
  const selected = useLayoutDrawingStore((s) => s.selectedElements);
  const state = useDrawingInteractionStore();

  const kind =
    armed === "wall" || armed === "lines"
      ? armed
      : wall || selected.some((s) => s.kind === "wall")
      ? "wall"
      : line || selected.some((s) => s.kind === "line")
      ? "lines"
      : null;

  if (!kind) return null;

  const currentShapeMeta =
    DRAWING_SHAPES.find((s) => s.id === state.shape) || DRAWING_SHAPES[0];

  const handleSelectShape = (shapeId: DrawingShape) => {
    useLayoutDrawingStore.getState().setArmedLayoutTool(kind);
    useDrawingInteractionStore.setState({
      shape: shapeId,
      navigating: false,
      message: null,
    });
    window.dispatchEvent(new CustomEvent("werkzeug-drawing-reset"));
  };

  return (
    <section className="drawing-shape-options compact-properties space-y-3" aria-label="Drawing shapes">
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-400">
            {armed === kind ? "Drawing Shapes" : "Draw New Shape"}
          </span>
          <span className="text-[9px] text-[var(--text-muted)]">
            Click to activate
          </span>
        </div>

        {/* 2-column Grid of Shapes with Icons */}
        <div className="grid grid-cols-2 gap-1.5">
          {DRAWING_SHAPES.map((item) => {
            const active = state.shape === item.id && armed === kind;
            return (
              <button
                key={item.id}
                type="button"
                disabled={state.busy}
                onClick={() => handleSelectShape(item.id)}
                className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all border ${
                  active
                    ? "bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-sm"
                    : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-amber-400/40 hover:text-[var(--text-strong)]"
                }`}
                title={item.detail}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-base)] font-mono text-sm font-bold shadow-inner">
                  {item.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold leading-tight truncate">
                    {item.label}
                  </span>
                  <span className="block text-[8.5px] text-[var(--text-muted)] truncate">
                    {item.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Shape Detail Card */}
      <div className="rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-overlay)] p-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1">
          <span className="font-mono text-sm">{currentShapeMeta.glyph}</span>
          <span>{currentShapeMeta.label}</span>
          <span className="ml-auto text-[9px] font-normal text-[var(--text-muted)]">
            {currentShapeMeta.badge}
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          {currentShapeMeta.detail}
        </p>
      </div>

      <details className="property-disclosure">
        <summary className="text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer">
          Snapping &amp; Tracking
        </summary>
        <label className="property-field mt-1.5">
          <span>Alignment</span>
          <select
            aria-label="Alignment tracking"
            value={state.tracking ? "on" : "off"}
            onChange={(e) =>
              useDrawingInteractionStore.setState({ tracking: e.target.value === "on" })
            }
            className="rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-xs text-[var(--text-body)]"
          >
            <option value="on">Horizontal / vertical</option>
            <option value="off">Off</option>
          </select>
        </label>
      </details>

      {state.message && (
        <p role="status" className="text-xs text-amber-500">
          {state.message}
        </p>
      )}
    </section>
  );
}
