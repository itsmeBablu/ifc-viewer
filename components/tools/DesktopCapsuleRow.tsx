"use client";

/**
 * DesktopCapsuleRow — full-width horizontal row of individually glass-styled
 * capsule buttons fixed at the bottom of the desktop viewport.
 *
 * Context-swaps between:
 *  • Build tool set (Arch mode, nothing selected)
 *  • MEP tool set (MEP mode active)
 *  • Modify actions (element selected — wall, door, slab, etc.)
 *
 * Desktop-only (≥1100px). The iPad layout uses the inline tool ribbon
 * and modify ribbon inside WerkzeugWorkspaceChrome.
 */

import { useMemo, useState } from "react";
import {
  LuAlignCenterHorizontal,
  LuBox,
  LuCopy,
  LuDoorOpen,
  LuFlipHorizontal2,
  LuGrid2X2,
  LuLayers3,
  LuMove,
  LuPalette,
  LuRotate3D,
  LuScissors,
  LuTrash2,
  LuZap,
} from "react-icons/lu";
import {
  IconMarkupFloor,
  IconMarkupRoof,
  IconMarkupWall,
  IconMarkupWindow,
} from "./MarkupIcons";
import GlassTooltip from "@/components/common/GlassTooltip";
import GlassPanel from "@/components/common/GlassPanel";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import type { LayoutToolId } from "@/lib/layoutDrawing";

/* ───── tool / modify item definitions ──────────────────────────── */

type CapsuleItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const BUILD_ITEMS: CapsuleItem[] = [
  { id: "levels", label: "Levels", hint: "Manage building storeys", icon: <LuLayers3 /> },
  { id: "wall", label: "Wall", hint: "Draw walls (W)", icon: <IconMarkupWall /> },
  { id: "door", label: "Door", hint: "Place doors on walls (D)", icon: <LuDoorOpen /> },
  { id: "window", label: "Window", hint: "Place windows on walls", icon: <IconMarkupWindow /> },
  { id: "roof", label: "Roof", hint: "Sketch roof boundaries", icon: <IconMarkupRoof /> },
  { id: "floor", label: "Floor", hint: "Sketch floor slabs", icon: <IconMarkupFloor /> },
  { id: "lines", label: "Lines", hint: "Draw sketch lines (L)", icon: <span className="font-bold">L</span> },
  { id: "materials", label: "Materials", hint: "Material editor", icon: <LuPalette /> },
];

const MEP_ITEMS: CapsuleItem[] = [
  { id: "duct", label: "Duct", hint: "Draw rectangular ducts", icon: <span className="font-bold text-sky-400">▭</span> },
  { id: "pipe", label: "Pipe", hint: "Draw round pipes", icon: <span className="font-bold text-blue-400">○</span> },
  { id: "cabletray", label: "Tray", hint: "Cable tray runs", icon: <span className="font-bold text-slate-400">≋</span> },
  { id: "wire", label: "Wire", hint: "Electrical wiring", icon: <LuZap /> },
  { id: "equipment", label: "Equipment", hint: "Place MEP equipment", icon: <LuBox /> },
  { id: "workplane", label: "Work Plane", hint: "Set active work plane (G)", icon: <LuGrid2X2 /> },
];

const MODIFY_ITEMS: CapsuleItem[] = [
  { id: "move", label: "Move", hint: "Translate selected elements", icon: <LuMove /> },
  { id: "rotate", label: "Rotate", hint: "Rotate selected elements", icon: <LuRotate3D /> },
  { id: "align", label: "Align", hint: "Align elements along axis", icon: <LuAlignCenterHorizontal /> },
  { id: "mirror", label: "Mirror", hint: "Mirror selection about an axis", icon: <LuFlipHorizontal2 /> },
  { id: "copy", label: "Copy", hint: "Duplicate selected elements", icon: <LuCopy /> },
  { id: "trim", label: "Trim", hint: "Trim / extend elements (T)", icon: <LuScissors /> },
  { id: "delete", label: "Delete", hint: "Remove selected elements", icon: <LuTrash2 /> },
];

/* ───── component ───────────────────────────────────────────────── */

export default function DesktopCapsuleRow() {
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

  /* ── selection detection (matches WerkzeugWorkspaceChrome logic) ── */
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

  /* ── modify title label ──────────────────────────────── */
  const modifyTitle = selectedWallId
    ? "Modify · Walls"
    : selectedDoorId
      ? "Modify · Doors"
      : selectedWindowId
        ? "Modify · Windows"
        : selectedSlabId
          ? "Modify · Slabs"
          : selectedStairId
            ? "Modify · Stairs"
            : selectedRampId
              ? "Modify · Ramps"
              : "Modify";

  /* ── which set to show ───────────────────────────────── */
  const activeSet = useMemo(() => {
    if (hasContextSelection) {
      return MODIFY_ITEMS.map((item) =>
        item.id === "align"
          ? { ...item, label: `Align ${alignAxis.toUpperCase()}` }
          : item,
      );
    }
    return mepModeActive ? MEP_ITEMS : BUILD_ITEMS;
  }, [hasContextSelection, alignAxis, mepModeActive]);

  /* ── click handlers ──────────────────────────────────── */
  const handleBuildClick = (id: string) => {
    const store = useLayoutDrawingStore.getState();
    const markup = useToolMarkupStore.getState();

    if (id === "levels" || id === "materials") {
      store.setArmedLayoutTool(null);
      markup.setArmedTool(null);
      // Open the right panel to the relevant section
      useAppStore.getState().setRightPanelOpen(true);
      return;
    }

    // Toggle: if already armed, disarm; otherwise arm this tool
    const toolId = id as LayoutToolId;
    if (store.armedLayoutTool === toolId) {
      store.setArmedLayoutTool(null);
    } else {
      store.setArmedLayoutTool(toolId);
      markup.setArmedTool(null);
    }
  };

  const handleModifyClick = (id: string) => {
    const store = useLayoutDrawingStore.getState();
    const markup = useToolMarkupStore.getState();

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
            store.selectedElements.some(
              (ref) => ref.kind === "column" && ref.id === c.id,
            ),
          );
          const slab = store.slabs.find((s) => s.id === store.selectedSlabId);
          const centerX =
            column?.xMm ?? (slab ? (slab.minXmm + slab.maxXmm) / 2 : 0);
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
        store.setArmedLayoutTool(
          store.armedLayoutTool === "trim" ? null : "trim",
        );
        break;
      case "delete":
        void store.deleteSelected();
        break;
    }
  };

  const handleClick = hasContextSelection ? handleModifyClick : handleBuildClick;

  /* ── active check ────────────────────────────────────── */
  const isActive = (id: string) => {
    if (hasContextSelection) {
      if (id === "trim") return armed === "trim";
      return false;
    }
    return armed === id;
  };

  return (
    <div
      className="desktop-capsule-row pointer-events-auto fixed bottom-3 z-[72]"
      style={{
        left: 12,
        right: rightPanelOpen ? 332 : 12,
      }}
    >
      <GlassPanel
        variant="panel"
        zIndex={72}
        wrapperClassName="desktop-capsule-row-glass w-full rounded-2xl"
      >
        <div className="desktop-capsule-row-inner flex items-center gap-1 overflow-x-auto px-2 py-1.5 thin-scroll">
          {/* Mode / context label */}
          <span className="desktop-capsule-row-label shrink-0 select-none px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {hasContextSelection
              ? modifyTitle
              : mepModeActive
                ? "MEP"
                : "Build"}
          </span>

          <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-divider)] opacity-50" />

          {/* Capsule buttons */}
          {activeSet.map((item) => {
            const active = isActive(item.id);
            const isDanger = item.id === "delete";
            return (
              <GlassTooltip
                key={item.id}
                label={item.label}
                hint={item.hint}
                className="shrink-0"
              >
                <button
                  type="button"
                  onClick={() => handleClick(item.id)}
                  className={`desktop-capsule-btn ${active ? "is-active" : ""} ${isDanger ? "is-danger" : ""}`}
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
  );
}
