"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useAppStore } from "@/store/useAppStore";
import ColorSwatchPicker from "./ColorSwatchPicker";
import {
  LuTrash2,
  LuCopy,
  LuMove,
  LuRotate3D,
  LuScaling,
} from "react-icons/lu";

export default function ToolOptionsBar() {
  const armedLayoutTool = useLayoutDrawingStore((s) => s.armedLayoutTool);
  const setArmedLayoutTool = useLayoutDrawingStore((s) => s.setArmedLayoutTool);
  const draftWallThicknessMm = useLayoutDrawingStore((s) => s.draftWallThicknessMm);
  const setDraftWallThicknessMm = useLayoutDrawingStore((s) => s.setDraftWallThicknessMm);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const draftWallTopLevelId = useLayoutDrawingStore((s) => s.draftWallTopLevelId);
  const draftWallBaseLevelId = useLayoutDrawingStore((s) => s.draftWallBaseLevelId);
  const setDraftWallBaseLevelId = useLayoutDrawingStore((s) => s.setDraftWallBaseLevelId);
  const setDraftWallTopLevelId = useLayoutDrawingStore((s) => s.setDraftWallTopLevelId);
  const markupFloorId = useToolMarkupStore((s) => s.markupFloorId);
  const setMarkupFloorId = useToolMarkupStore((s) => s.setMarkupFloorId);
  const draftDoorWidthMm = useLayoutDrawingStore((s) => s.draftDoorWidthMm);
  const draftDoorHeightMm = useLayoutDrawingStore((s) => s.draftDoorHeightMm);
  const setDraftDoorSize = useLayoutDrawingStore((s) => s.setDraftDoorSize);
  const draftWindowWidthMm = useLayoutDrawingStore((s) => s.draftWindowWidthMm);
  const draftWindowHeightMm = useLayoutDrawingStore((s) => s.draftWindowHeightMm);
  const draftWindowSillMm = useLayoutDrawingStore((s) => s.draftWindowSillMm);
  const setDraftWindowSize = useLayoutDrawingStore((s) => s.setDraftWindowSize);
  const draftSlabThicknessMm = useLayoutDrawingStore((s) => s.draftSlabThicknessMm);
  const setDraftSlabThicknessMm = useLayoutDrawingStore((s) => s.setDraftSlabThicknessMm);
  const draftStairWidthMm = useLayoutDrawingStore((s) => s.draftStairWidthMm);
  const setDraftStairWidthMm = useLayoutDrawingStore((s) => s.setDraftStairWidthMm);
  const draftStairTargetRiserMm = useLayoutDrawingStore((s) => s.draftStairTargetRiserMm);
  const setDraftStairTargetRiserMm = useLayoutDrawingStore((s) => s.setDraftStairTargetRiserMm);
  const draftStairTreadDepthMm = useLayoutDrawingStore((s) => s.draftStairTreadDepthMm);
  const setDraftStairTreadDepthMm = useLayoutDrawingStore((s) => s.setDraftStairTreadDepthMm);
  const draftStairType = useLayoutDrawingStore((s) => s.draftStairType);
  const setDraftStairType = useLayoutDrawingStore((s) => s.setDraftStairType);
  const draftStairBaseLevelId = useLayoutDrawingStore((s) => s.draftStairBaseLevelId);
  const setDraftStairBaseLevelId = useLayoutDrawingStore((s) => s.setDraftStairBaseLevelId);
  const draftStairTopLevelId = useLayoutDrawingStore((s) => s.draftStairTopLevelId);
  const setDraftStairTopLevelId = useLayoutDrawingStore((s) => s.setDraftStairTopLevelId);
  const draftRampWidthMm = useLayoutDrawingStore((s) => s.draftRampWidthMm);
  const setDraftRampWidthMm = useLayoutDrawingStore((s) => s.setDraftRampWidthMm);
  const draftRampThicknessMm = useLayoutDrawingStore((s) => s.draftRampThicknessMm);
  const setDraftRampThicknessMm = useLayoutDrawingStore((s) => s.setDraftRampThicknessMm);
  const draftRampBaseLevelId = useLayoutDrawingStore((s) => s.draftRampBaseLevelId);
  const setDraftRampBaseLevelId = useLayoutDrawingStore((s) => s.setDraftRampBaseLevelId);
  const draftRampTopLevelId = useLayoutDrawingStore((s) => s.draftRampTopLevelId);
  const setDraftRampTopLevelId = useLayoutDrawingStore((s) => s.setDraftRampTopLevelId);

  // Selection
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const selectedStairId = useLayoutDrawingStore((s) => s.selectedStairId);
  const selectedRampId = useLayoutDrawingStore((s) => s.selectedRampId);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const deleteStair = useLayoutDrawingStore((s) => s.deleteStair);
  const deleteRamp = useLayoutDrawingStore((s) => s.deleteRamp);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const duplicateStair = useLayoutDrawingStore((s) => s.duplicateStair);
  const duplicateRamp = useLayoutDrawingStore((s) => s.duplicateRamp);

  // Markup Store
  const armedTool = useToolMarkupStore((s) => s.armedTool);
  const setArmedTool = useToolMarkupStore((s) => s.setArmedTool);
  const transformMode = useToolMarkupStore((s) => s.transformMode);
  const setTransformMode = useToolMarkupStore((s) => s.setTransformMode);
  const defaultColor = useToolMarkupStore((s) => s.defaultColor);
  const setDefaultColor = useToolMarkupStore((s) => s.setDefaultColor);
  const selectedPlacementId = useToolMarkupStore((s) => s.selectedPlacementId);
  const deletePlacement = useToolMarkupStore((s) => s.deletePlacement);
  const duplicatePlacement = useToolMarkupStore((s) => s.duplicatePlacement);

  const hasSelection = Boolean(
    selectedWallId || selectedDoorId || selectedWindowId || selectedSlabId || selectedStairId || selectedRampId || selectedPlacementId
  );

  return (
    <div className="relative flex h-10 w-full items-center justify-between border-b border-[var(--panel-divider)] bg-[var(--glass-inset-bg)]/80 px-4 text-xs select-none backdrop-blur-md">
      {/* Active Tool Options */}
      <div className="flex items-center gap-4 overflow-x-auto thin-scroll">
        {/* WALL TOOL OPTIONS */}
        {armedLayoutTool === "wall" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500 flex items-center gap-1">
              <span>Wall Properties:</span>
            </span>

            {/* Thickness presets */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Thickness:</span>
              {[150, 240, 300, 365].map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setDraftWallThicknessMm(th)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all ${
                    draftWallThicknessMm === th
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-amber-300"
                  }`}
                >
                  {th} mm
                </button>
              ))}
              <input
                type="number"
                value={draftWallThicknessMm}
                onChange={(e) => setDraftWallThicknessMm(Math.max(50, Number(e.target.value)))}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px] text-[var(--text-strong)] focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="h-4 w-px bg-[var(--panel-divider)]" />

            <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              Base:
              <select
                value={draftWallBaseLevelId ?? markupFloorId ?? levels[0]?.id ?? ""}
                onChange={(e) => {
                  const baseId = e.target.value;
                  setMarkupFloorId(baseId);
                  setDraftWallBaseLevelId(baseId);
                  const base = levels.find((level) => level.id === baseId);
                  const next = levels.filter((level) => level.elevationMm > (base?.elevationMm ?? 0)).sort((a, b) => a.elevationMm - b.elevationMm)[0];
                  setDraftWallTopLevelId(next?.id ?? null);
                }}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px] text-[var(--text-strong)]"
              >
                {levels.slice().sort((a, b) => a.elevationMm - b.elevationMm).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              Top:
              <select
                value={draftWallTopLevelId ?? ""}
                onChange={(e) => setDraftWallTopLevelId(e.target.value || null)}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px] text-[var(--text-strong)]"
              >
                <option value="">Unconnected</option>
                {levels
                  .filter((level) => level.elevationMm > (levels.find((item) => item.id === (draftWallBaseLevelId ?? markupFloorId))?.elevationMm ?? -Infinity))
                  .sort((a, b) => a.elevationMm - b.elevationMm)
                  .map((level) => <option key={level.id} value={level.id}>{level.name} ({level.elevationMm} mm)</option>)}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setArmedLayoutTool(null)}
              className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-red-400 transition-colors"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {/* DOOR TOOL OPTIONS */}
        {armedLayoutTool === "door" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500">Door Properties:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Width:</span>
              {[800, 900, 1000].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDraftDoorSize(w, draftDoorHeightMm)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                    draftDoorWidthMm === w
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)]"
                  }`}
                >
                  {w} mm
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Height:</span>
              <input
                type="number"
                value={draftDoorHeightMm}
                onChange={(e) => setDraftDoorSize(draftDoorWidthMm, Number(e.target.value))}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
              <span className="text-[10px] text-[var(--text-muted)]">mm</span>
            </div>

            <span className="text-[10px] text-emerald-500 font-medium italic">Click on any drawn wall to place door</span>
          </div>
        )}

        {/* WINDOW TOOL OPTIONS */}
        {armedLayoutTool === "window" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500">Window Properties:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Width:</span>
              <input
                type="number"
                value={draftWindowWidthMm}
                onChange={(e) => setDraftWindowSize(Number(e.target.value), draftWindowHeightMm, draftWindowSillMm)}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Height:</span>
              <input
                type="number"
                value={draftWindowHeightMm}
                onChange={(e) => setDraftWindowSize(draftWindowWidthMm, Number(e.target.value), draftWindowSillMm)}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Sill:</span>
              <input
                type="number"
                value={draftWindowSillMm}
                onChange={(e) => setDraftWindowSize(draftWindowWidthMm, draftWindowHeightMm, Number(e.target.value))}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
            </div>
            <span className="text-[10px] text-emerald-500 font-medium italic">Click on any drawn wall to place window</span>
          </div>
        )}

        {/* FLOOR / SLAB TOOL OPTIONS */}
        {armedLayoutTool === "floor" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500">Floor Slab:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Thickness:</span>
              <input
                type="number"
                value={draftSlabThicknessMm}
                onChange={(e) => setDraftSlabThicknessMm(Number(e.target.value))}
                className="w-16 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
              <span className="text-[10px] text-[var(--text-muted)]">mm</span>
            </div>
            <span className="text-[10px] text-emerald-500 font-medium italic">Click 1st corner, then opposite corner in Top View</span>
          </div>
        )}

        {/* STAIR TOOL OPTIONS */}
        {armedLayoutTool === "stair" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500">Stair Properties:</span>
            {/* Shape */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Type:</span>
              {(
                [
                  { id: "straight", label: "Straight" },
                  { id: "l-shape", label: "L-Shape" },
                  { id: "u-shape", label: "U-Shape" },
                  { id: "spiral", label: "Spiral" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraftStairType(t.id)}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${
                    draftStairType === t.id
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Base Level */}
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Base:</span>
              <select
                value={draftStairBaseLevelId ?? markupFloorId ?? levels[0]?.id ?? ""}
                onChange={(e) => {
                  setDraftStairBaseLevelId(e.target.value);
                  setMarkupFloorId(e.target.value);
                }}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px]"
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.elevationMm}mm)
                  </option>
                ))}
              </select>
            </label>

            {/* Top Level */}
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Top:</span>
              <select
                value={draftStairTopLevelId ?? levels[1]?.id ?? levels[0]?.id ?? ""}
                onChange={(e) => setDraftStairTopLevelId(e.target.value)}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px]"
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.elevationMm}mm)
                  </option>
                ))}
              </select>
            </label>

            {/* Width */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Width:</span>
              {[900, 1000, 1200].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDraftStairWidthMm(w)}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${
                    draftStairWidthMm === w
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)]"
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>

            <span className="text-[10px] text-emerald-500 font-medium italic">Click start, then click end of stair run</span>
          </div>
        )}

        {/* RAMP TOOL OPTIONS */}
        {armedLayoutTool === "ramp" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500">Ramp Properties:</span>
            {/* Base Level */}
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Base:</span>
              <select
                value={draftRampBaseLevelId ?? markupFloorId ?? levels[0]?.id ?? ""}
                onChange={(e) => {
                  setDraftRampBaseLevelId(e.target.value);
                  setMarkupFloorId(e.target.value);
                }}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px]"
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.elevationMm}mm)
                  </option>
                ))}
              </select>
            </label>

            {/* Top Level */}
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Top:</span>
              <select
                value={draftRampTopLevelId ?? levels[1]?.id ?? levels[0]?.id ?? ""}
                onChange={(e) => setDraftRampTopLevelId(e.target.value)}
                className="rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[11px]"
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.elevationMm}mm)
                  </option>
                ))}
              </select>
            </label>

            {/* Width */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Width:</span>
              {[1000, 1200, 1500].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDraftRampWidthMm(w)}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${
                    draftRampWidthMm === w
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)]"
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>

            {/* Thickness */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Thick:</span>
              <input
                type="number"
                value={draftRampThicknessMm}
                onChange={(e) => setDraftRampThicknessMm(Number(e.target.value))}
                className="w-14 rounded-md border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-right font-mono text-[11px]"
              />
              <span className="text-[10px] text-[var(--text-muted)]">mm</span>
            </div>

            <span className="text-[10px] text-emerald-500 font-medium italic">Click start, then click top landing</span>
          </div>
        )}

        {/* 3D SHAPE OPTIONS */}
        {armedTool && armedTool !== "note" && (
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-500 capitalize">{armedTool} Mode:</span>
            <ColorSwatchPicker color={defaultColor} onChange={setDefaultColor} />
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-muted)]">Gizmo:</span>
              {[
                { id: "translate" as const, label: "Move", icon: LuMove },
                { id: "rotate" as const, label: "Rotate", icon: LuRotate3D },
                { id: "scale" as const, label: "Scale", icon: LuScaling },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTransformMode(g.id)}
                  className={`rounded-md p-1 border ${
                    transformMode === g.id
                      ? "border-amber-500 bg-amber-500/20 text-amber-500"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)]"
                  }`}
                  title={g.label}
                >
                  <g.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <span className="text-[10px] text-emerald-500 font-medium italic">Click & drag on 3D canvas to draw shape</span>
          </div>
        )}

        {/* IDLE OR DEFAULT STATE */}
        {!armedLayoutTool && (!armedTool || armedTool === "note") && (
          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] font-medium">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Ready. Press <kbd className="px-1 py-0.5 rounded bg-[var(--surface-overlay)] border border-[var(--panel-divider)] font-mono text-[10px] text-[var(--text-strong)]">W</kbd> for Wall, <kbd className="px-1 py-0.5 rounded bg-[var(--surface-overlay)] border border-[var(--panel-divider)] font-mono text-[10px] text-[var(--text-strong)]">D</kbd> for Door, <kbd className="px-1 py-0.5 rounded bg-[var(--surface-overlay)] border border-[var(--panel-divider)] font-mono text-[10px] text-[var(--text-strong)]">M</kbd> for Measure, <kbd className="px-1 py-0.5 rounded bg-[var(--surface-overlay)] border border-[var(--panel-divider)] font-mono text-[10px] text-[var(--text-strong)]">Esc</kbd> for Select</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Side: Quick Selection Actions */}
      {hasSelection && (
        <div className="flex items-center gap-1.5 pl-3 border-l border-[var(--panel-divider)]">
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Selection:</span>

          {selectedWallId && (
            <>
              <button
                type="button"
                onClick={() => duplicateWall(selectedWallId)}
                title="Duplicate Wall"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-[var(--surface-overlay)] border border-[var(--panel-divider)] text-[10px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
              >
                <LuCopy className="h-3 w-3" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => deleteWall(selectedWallId)}
                title="Delete Wall"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
              >
                <LuTrash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </>
          )}

          {selectedDoorId && (
            <button
              type="button"
              onClick={() => deleteDoor(selectedDoorId)}
              className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
            >
              <LuTrash2 className="h-3 w-3" />
              <span>Delete Door</span>
            </button>
          )}

          {selectedWindowId && (
            <button
              type="button"
              onClick={() => deleteWindow(selectedWindowId)}
              className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
            >
              <LuTrash2 className="h-3 w-3" />
              <span>Delete Window</span>
            </button>
          )}

          {selectedSlabId && (
            <button
              type="button"
              onClick={() => deleteSlab(selectedSlabId)}
              className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
            >
              <LuTrash2 className="h-3 w-3" />
              <span>Delete Slab</span>
            </button>
          )}

          {selectedStairId && (
            <>
              <button
                type="button"
                onClick={() => duplicateStair(selectedStairId)}
                title="Duplicate Stair"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-[var(--surface-overlay)] border border-[var(--panel-divider)] text-[10px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
              >
                <LuCopy className="h-3 w-3" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => deleteStair(selectedStairId)}
                title="Delete Stair"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
              >
                <LuTrash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </>
          )}

          {selectedRampId && (
            <>
              <button
                type="button"
                onClick={() => duplicateRamp(selectedRampId)}
                title="Duplicate Ramp"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-[var(--surface-overlay)] border border-[var(--panel-divider)] text-[10px] font-semibold text-[var(--text-body)] hover:text-[var(--text-strong)]"
              >
                <LuCopy className="h-3 w-3" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => deleteRamp(selectedRampId)}
                title="Delete Ramp"
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
              >
                <LuTrash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </>
          )}

          {selectedPlacementId && (
            <>
              <button
                type="button"
                onClick={() => duplicatePlacement(selectedPlacementId)}
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-[var(--surface-overlay)] border border-[var(--panel-divider)] text-[10px] font-semibold text-[var(--text-body)]"
              >
                <LuCopy className="h-3 w-3" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => deletePlacement(selectedPlacementId)}
                className="flex items-center gap-1 rounded-md px-2 py-1 bg-red-500/10 border border-red-500/30 text-[10px] font-semibold text-red-500 hover:bg-red-500/20"
              >
                <LuTrash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
