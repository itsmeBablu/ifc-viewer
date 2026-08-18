"use client";

import { useRef } from "react";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import {
  LuCompass,
  LuLayers,
  LuScale,
  LuKeyboard,
  LuPaperclip,
  LuFileImage,
} from "react-icons/lu";
import type { RenderMode } from "@/lib/types";

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: "realistic", label: "Realistic" },
  { id: "fullColor", label: "Shaded" },
  { id: "light", label: "Light" },
  { id: "wireframe", label: "Wire" },
];

export default function ToolStatusBar({
  pointer,
  onAttachDwgPdf,
  onAttachIfc,
}: {
  pointer: { x: number; y: number };
  onAttachDwgPdf?: (file: File) => void;
  onAttachIfc?: (file: File) => void;
}) {
  const dwgInputRef = useRef<HTMLInputElement>(null);
  const ifcInputRef = useRef<HTMLInputElement>(null);

  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const drawingScale = useLayoutDrawingStore((s) => s.drawingScale || "1:100");
  const setDrawingScale = useLayoutDrawingStore((s) => s.setDrawingScale);

  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const unitSystem = useLayoutDrawingStore((s) => s.unitSystem);
  const setUnitSystem = useLayoutDrawingStore((s) => s.setUnitSystem);

  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const snapEndpoint = useToolMarkupStore((s) => s.snapEndpoint);
  const snapMidpoint = useToolMarkupStore((s) => s.snapMidpoint);
  const snapCenter = useToolMarkupStore((s) => s.snapCenter);
  const snapIntersection = useToolMarkupStore((s) => s.snapIntersection);
  const snapPerpendicular = useToolMarkupStore((s) => s.snapPerpendicular);
  const snapExtension = useToolMarkupStore((s) => s.snapExtension);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);

  // Build compact snap active summary
  const activeSnaps = [
    snapEndpoint && "Endpt",
    snapMidpoint && "Mid",
    snapCenter && "Ctr",
    snapIntersection && "Int",
    snapPerpendicular && "Perp",
    snapExtension && "Ext",
    snapToFaces && "Face",
    gridSnap && "Grid",
  ].filter(Boolean).join("+") || "Off";
  const wallSnapType = useLayoutDrawingStore((s) => s.wallDraw?.snapType);

  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);
  const renderMode = useAppStore((s) => s.renderMode);
  const setRenderMode = useAppStore((s) => s.setRenderMode);

  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  const getToolStatusAndHints = () => {
    if (armedLayoutTool === "wall") {
      if (wallDraw) {
        return {
          mode: "Wall Drawing Active",
          hint: "Click next point • Shift: 45° angle snap • Tab: switch direction • Enter: complete chain • Esc: cancel",
        };
      }
      return {
        mode: "Wall Tool Active",
        hint: "Click in 2D Top View or 3D floor plane to start wall • Space: flip wall alignment",
      };
    }
    if (armedLayoutTool === "door") {
      return {
        mode: "Door Tool Active",
        hint: "Hover over any wall and click to place door • Space: flip swing • Tab: flip hand",
      };
    }
    if (armedLayoutTool === "window") {
      return {
        mode: "Window Tool Active",
        hint: "Hover over any wall and click to insert window • Tab: cycle snap point",
      };
    }
    if (armedLayoutTool === "floor") {
      return {
        mode: "Floor Sketch Active",
        hint: "Click corners to define floor boundary • Close loop or Enter to finish • Inner loop = hole • Esc: cancel",
      };
    }
    if (armedLayoutTool === "roof") {
      return {
        mode: "Roof Sketch Active",
        hint: "Click corners to define roof boundary polygon • Enter: finish • Esc: cancel",
      };
    }
    if (armedTool && armedTool !== "note") {
      return {
        mode: `${armedTool.toUpperCase()} Shape Tool`,
        hint: "Click & drag on ground or IFC face to size shape • Shift: constrain proportions",
      };
    }
    if (armedTool === "note") {
      return {
        mode: "Sticky Tag Active",
        hint: "Click on any 3D geometry element or wall to attach a pin annotation tag",
      };
    }

    // Selection Modes
    if (selectedWallId) {
      return {
        mode: "Modify | Wall Selected",
        hint: "Drag endpoints to stretch • Space: flip direction • Ctrl+C: copy • Del: delete • Esc: deselect",
      };
    }
    if (selectedDoorId || selectedWindowId) {
      return {
        mode: "Modify | Opening Selected",
        hint: "Drag along wall to reposition • Space: flip swing • Tab: flip hand • Del: delete",
      };
    }
    if (selectedSlabId) {
      return {
        mode: "Modify | Slab Selected",
        hint: "Edit boundary in Properties panel • Del: delete • Esc: deselect",
      };
    }
    if (selectedPlacementId) {
      return {
        mode: "Modify | 3D Shape Selected",
        hint: "Use Transform Gizmo to Move / Rotate / Scale • Del: delete • Esc: deselect",
      };
    }

    return {
      mode: "Select Mode",
      hint: "Click element to inspect • Right Drag: Orbit 3D • Shift + Right Drag: Pan • Scroll: Zoom",
    };
  };

  const { mode, hint } = getToolStatusAndHints();

  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 flex h-7 items-center justify-between border-t border-[var(--panel-divider)] bg-[var(--surface-overlay)]/95 px-3 text-[11px] text-[var(--text-muted)] select-none backdrop-blur-xl">
      {/* Left: Mode Badge + Keyboard Guidance + Attach Actions */}
      <div className="flex items-center gap-2 font-medium min-w-0">
        {/* Mode badge */}
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0 uppercase tracking-wider text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
          {mode}
        </span>
        <span className="text-[var(--text-strong)] font-semibold truncate hidden lg:flex items-center gap-1 max-w-[380px]">
          <LuKeyboard className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="truncate">{hint}</span>
        </span>

        {/* Divider */}
        <div className="h-3 w-px bg-[var(--panel-divider)] shrink-0 mx-0.5" />

        {/* ── File Attach Actions (Section 3) ────────────────────────────── */}
        {/* Attach DWG/PDF underlay */}
        <input
          ref={dwgInputRef}
          type="file"
          accept=".dwg,.dxf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttachDwgPdf?.(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => dwgInputRef.current?.click()}
          title="Attach DWG / PDF underlay"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] border border-transparent hover:border-[var(--panel-divider)] transition-all"
        >
          <LuFileImage className="h-3 w-3 text-sky-400 shrink-0" />
          <span className="hidden sm:inline">Attach DWG/PDF</span>
        </button>

        {/* Attach IFC */}
        <input
          ref={ifcInputRef}
          type="file"
          accept=".ifc,.frag"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttachIfc?.(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => ifcInputRef.current?.click()}
          title="Attach IFC model"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-body)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] border border-transparent hover:border-[var(--panel-divider)] transition-all"
        >
          <LuPaperclip className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">Attach IFC</span>
        </button>
      </div>

      {/* Right: Shading Toggle + Scale + Level + Snap + Units */}
      <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
        {/* ── Shading Style Toggle (Section 3) ──────────────────────────── */}
        <div className="flex items-center rounded-md border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] overflow-hidden">
          {RENDER_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setRenderMode(m.id)}
              title={`Shading: ${m.label}`}
              className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                renderMode === m.id
                  ? "bg-amber-500/30 text-amber-600 dark:text-amber-400"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Scale Selector */}
        <div className="flex items-center gap-1 bg-[var(--glass-inset-bg)] px-1.5 py-0.5 rounded border border-[var(--panel-divider)]">
          <LuScale className="h-3 w-3 text-amber-500" />
          <span className="text-[var(--text-muted)]">Scale:</span>
          <select
            value={drawingScale}
            onChange={(e) => setDrawingScale(e.target.value as any)}
            className="bg-transparent font-bold text-[var(--text-strong)] focus:outline-none cursor-pointer"
          >
            <option value="1:20">1:20</option>
            <option value="1:50">1:50</option>
            <option value="1:100">1:100</option>
            <option value="1:200">1:200</option>
            <option value="1:500">1:500</option>
          </select>
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Active Level */}
        <div className="flex items-center gap-1 text-[var(--text-body)]">
          <LuLayers className="h-3 w-3 text-amber-500" />
          <span>{currentFloorObj ? currentFloorObj.name : "Level 1"}</span>
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Snap Indicator */}
        <div className="flex items-center gap-1 text-[var(--text-body)]">
          <LuCompass className="h-3 w-3 text-sky-400" />
          <span>
            {wallSnapType ? (
              <span className="text-amber-400 font-bold">{wallSnapType}</span>
            ) : (
              <span>Snap: {activeSnaps}</span>
            )}
          </span>
        </div>

        {/* Unit */}
        <button
          type="button"
          onClick={() => setUnitSystem(unitSystem === "metric" ? "imperial" : "metric")}
          title="Toggle Unit System (Metric / Imperial)"
          className="text-emerald-500 font-sans font-bold hover:text-emerald-600 transition-colors bg-[var(--glass-inset-bg)] px-2 py-0.5 rounded border border-[var(--panel-divider)]"
        >
          {unitSystem === "metric" ? "m ↔ ft" : "ft ↔ m"}
        </button>
      </div>
    </footer>
  );
}
