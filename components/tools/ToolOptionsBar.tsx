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

  // Selection
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);

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
    selectedWallId || selectedDoorId || selectedWindowId || selectedSlabId || selectedPlacementId
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
