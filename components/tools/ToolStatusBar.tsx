"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import { LuCompass, LuLayers } from "react-icons/lu";

export default function ToolStatusBar({
  pointer,
}: {
  pointer: { x: number; y: number };
}) {
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const wallDraw = useLayoutDrawingStore((s) => s.wallDraw);
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const snapToFaces = useToolMarkupStore((s) => s.snapToFaces);
  const gridSnap = useToolMarkupStore((s) => s.gridSnap);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const floors = useAppStore((s) => s.floors);

  const currentFloorObj = floors.find((f) => f.id === selectedFloor);

  const getPromptHint = () => {
    if (armedLayoutTool === "wall") {
      if (wallDraw) {
        return "Click to place next wall endpoint • Enter to finish chain • Esc to cancel";
      }
      return "Wall Tool: Click in 2D Top View or 3D floor plane to start drawing wall";
    }
    if (armedLayoutTool === "door") {
      return "Door Tool: Hover over any drawn wall and click to insert door";
    }
    if (armedLayoutTool === "window") {
      return "Window Tool: Hover over any drawn wall and click to insert window";
    }
    if (armedLayoutTool === "floor") {
      return "Floor Slab: Click 1st corner, then click opposite diagonal corner";
    }
    if (armedLayoutTool === "roof") {
      return "Roof Tool: Click corners to define roof footprint";
    }
    if (armedTool && armedTool !== "note") {
      return `3D ${armedTool.toUpperCase()} Tool: Click & drag on floor/face to place shape`;
    }
    if (armedTool === "note") {
      return "Sticky Note: Click on any 3D element to attach an annotation pin";
    }
    return "Select Mode: Click element to inspect properties • Orbit: Right Drag • Pan: Shift+Right Drag";
  };

  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 flex h-7 items-center justify-between border-t border-[var(--panel-divider)] bg-[var(--surface-overlay)]/95 px-3 text-[11px] text-[var(--text-muted)] select-none backdrop-blur-xl">
      {/* Left: Active Tool Prompt / Instructions */}
      <div className="flex items-center gap-2 font-medium truncate max-w-[60%]">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[var(--text-strong)] font-semibold truncate">{getPromptHint()}</span>
      </div>

      {/* Right: Snap, Level, Coordinates & Unit Readout */}
      <div className="flex items-center gap-3 font-mono text-[10px]">
        {/* Active Level */}
        <div className="flex items-center gap-1 text-[var(--text-body)]">
          <LuLayers className="h-3 w-3 text-amber-500" />
          <span>{currentFloorObj ? currentFloorObj.name : "All Levels"}</span>
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Snap Indicator */}
        <div className="flex items-center gap-1 text-[var(--text-body)]">
          <LuCompass className="h-3 w-3 text-sky-400" />
          <span>Snap: {gridSnap ? "Grid (100mm)" : "Angle (45°)"}{snapToFaces ? " + Face" : ""}</span>
        </div>

        <div className="h-3 w-px bg-[var(--panel-divider)]" />

        {/* Unit Scale */}
        <span className="text-[var(--text-muted)] font-sans">mm (1:100)</span>
      </div>
    </footer>
  );
}
