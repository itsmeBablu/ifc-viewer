"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import { LuCompass, LuLayers, LuScale, LuKeyboard } from "react-icons/lu";

export default function ToolStatusBar({
  pointer,
}: {
  pointer: { x: number; y: number };
}) {
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const drawingScale = useLayoutDrawingStore((s) => s.drawingScale || "1:100");
  const setDrawingScale = useLayoutDrawingStore((s) => s.setDrawingScale);

  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);

  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);

  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);

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
        mode: "Floor Slab Active",
        hint: "Click 1st corner, then opposite diagonal corner in Top View • Esc: cancel",
      };
    }
    if (armedLayoutTool === "roof") {
      return {
        mode: "Roof Tool Active",
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
      {/* Left: Mode Badge & Dynamic Contextual Keyboard Guidance */}
      <div className="flex items-center gap-2 font-medium truncate max-w-[65%]">
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0 uppercase tracking-wider text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
          {mode}
        </span>
        <span className="text-[var(--text-strong)] font-semibold truncate flex items-center gap-1">
          <LuKeyboard className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="truncate">{hint}</span>
        </span>
      </div>

      {/* Right: Metric Scale Selector, Snap, Level & Units */}
      <div className="flex items-center gap-2.5 font-mono text-[10px]">
        {/* Metric Scale Selector (Section 5) */}
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
          <span>Snap: {gridSnap ? "Grid (100mm)" : "Angle (45°)"}{snapToFaces ? "+Face" : ""}</span>
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Unit Scale Metric */}
        <span className="text-emerald-500 font-sans font-bold">Metric (m / mm)</span>
      </div>
    </footer>
  );
}
