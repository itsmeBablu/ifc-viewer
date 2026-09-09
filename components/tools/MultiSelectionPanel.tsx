"use client";

import React, { useState, useMemo } from "react";
import { useLayoutDrawingStore, type SelectedElementRef, type LayoutElementKind } from "@/store/useLayoutDrawingStore";
import {
  LuSquareCheck,
  LuCopy,
  LuTrash2,
  LuLayers,
  LuArrowUpToLine,
  LuRuler,
  LuPalette,
  LuX,
} from "react-icons/lu";

interface MultiSelectionPanelProps {
  className?: string;
}

const KIND_LABELS: Record<string, { label: string; singular: string }> = {
  wall: { label: "Walls", singular: "Wall" },
  door: { label: "Doors", singular: "Door" },
  window: { label: "Windows", singular: "Window" },
  slab: { label: "Floors / Roofs", singular: "Floor/Roof" },
  column: { label: "Columns", singular: "Column" },
  beam: { label: "Beams", singular: "Beam" },
  stair: { label: "Stairs", singular: "Stair" },
  ramp: { label: "Ramps", singular: "Ramp" },
  duct: { label: "MEP Ducts", singular: "Duct" },
  pipe: { label: "MEP Pipes", singular: "Pipe" },
  cabletray: { label: "Cable Trays", singular: "Cable Tray" },
  equipment: { label: "MEP Equipment", singular: "Equipment" },
  wire: { label: "Electrical Wires", singular: "Wire" },
};

export default function MultiSelectionPanel({ className = "" }: MultiSelectionPanelProps) {
  const selected = useLayoutDrawingStore((s) => s.selectedElements);
  const selectMultiple = useLayoutDrawingStore((s) => s.selectMultiple);
  const clearSelection = useLayoutDrawingStore((s) => s.clearSelection);

  // Store element lists
  const walls = useLayoutDrawingStore((s) => s.walls);
  const doors = useLayoutDrawingStore((s) => s.doors);
  const windows = useLayoutDrawingStore((s) => s.windows);
  const slabs = useLayoutDrawingStore((s) => s.slabs);
  const columns = useLayoutDrawingStore((s) => s.columns);
  const beams = useLayoutDrawingStore((s) => s.beams);
  const stairs = useLayoutDrawingStore((s) => s.stairs);
  const ramps = useLayoutDrawingStore((s) => s.ramps);
  const ducts = useLayoutDrawingStore((s) => s.ducts);
  const pipes = useLayoutDrawingStore((s) => s.pipes);
  const cableTrays = useLayoutDrawingStore((s) => s.cableTrays);
  const mepEquipment = useLayoutDrawingStore((s) => s.mepEquipment);
  const wires = useLayoutDrawingStore((s) => s.wires);
  const levels = useLayoutDrawingStore((s) => s.levels);
  const activeLevelId = useLayoutDrawingStore((s) => s.activeLevelId);

  // Store actions
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);
  const updateColumn = useLayoutDrawingStore((s) => s.updateColumn);
  const updateBeam = useLayoutDrawingStore((s) => s.updateBeam);
  const updateStair = useLayoutDrawingStore((s) => s.updateStair);
  const updateRamp = useLayoutDrawingStore((s) => s.updateRamp);
  const updateDuct = useLayoutDrawingStore((s) => s.updateDuct);
  const updatePipe = useLayoutDrawingStore((s) => s.updatePipe);
  const updateCableTray = useLayoutDrawingStore((s) => s.updateCableTray);
  const updateEquipment = useLayoutDrawingStore((s) => s.updateEquipment);
  const updateWire = useLayoutDrawingStore((s) => s.updateWire);

  const deleteWall = useLayoutDrawingStore((s) => s.deleteWall);
  const deleteDoor = useLayoutDrawingStore((s) => s.deleteDoor);
  const deleteWindow = useLayoutDrawingStore((s) => s.deleteWindow);
  const deleteSlab = useLayoutDrawingStore((s) => s.deleteSlab);
  const deleteColumn = useLayoutDrawingStore((s) => s.deleteColumn);
  const deleteBeam = useLayoutDrawingStore((s) => s.deleteBeam);
  const deleteStair = useLayoutDrawingStore((s) => s.deleteStair);
  const deleteRamp = useLayoutDrawingStore((s) => s.deleteRamp);
  const deleteDuct = useLayoutDrawingStore((s) => s.deleteDuct);
  const deletePipe = useLayoutDrawingStore((s) => s.deletePipe);
  const deleteCableTray = useLayoutDrawingStore((s) => s.deleteCableTray);
  const deleteEquipment = useLayoutDrawingStore((s) => s.deleteEquipment);
  const deleteWire = useLayoutDrawingStore((s) => s.deleteWire);

  const duplicateWall = useLayoutDrawingStore((s) => s.duplicateWall);
  const duplicateDoor = useLayoutDrawingStore((s) => s.duplicateDoor);
  const duplicateWindow = useLayoutDrawingStore((s) => s.duplicateWindow);
  const duplicateSlab = useLayoutDrawingStore((s) => s.duplicateSlab);
  const duplicateColumn = useLayoutDrawingStore((s) => s.duplicateColumn);
  const duplicateBeam = useLayoutDrawingStore((s) => s.duplicateBeam);
  const duplicateStair = useLayoutDrawingStore((s) => s.duplicateStair);
  const duplicateRamp = useLayoutDrawingStore((s) => s.duplicateRamp);
  const duplicateDuct = useLayoutDrawingStore((s) => s.duplicateDuct);
  const duplicatePipe = useLayoutDrawingStore((s) => s.duplicatePipe);
  const duplicateCableTray = useLayoutDrawingStore((s) => s.duplicateCableTray);
  const duplicateEquipment = useLayoutDrawingStore((s) => s.duplicateEquipment);
  const duplicateWire = useLayoutDrawingStore((s) => s.duplicateWire);

  // Roof slabs available for wall-to-roof attachment
  const roofSlabs = useMemo(() => {
    return slabs.filter((s) => s.kind === "roof" || s.kind === "floor");
  }, [slabs]);

  const [selectedRoofId, setSelectedRoofId] = useState<string>(() => roofSlabs[0]?.id || "");
  const [batchHeight, setBatchHeight] = useState<string>("");
  const [batchThickness, setBatchThickness] = useState<string>("");
  const [batchMaterial, setBatchMaterial] = useState<string>("");

  // Group selected elements by kind
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of selected) {
      counts[item.kind] = (counts[item.kind] || 0) + 1;
    }
    return counts;
  }, [selected]);

  const kinds = useMemo(() => Object.keys(categoryCounts), [categoryCounts]);

  const hasWalls = Boolean(categoryCounts.wall);
  const hasColumns = Boolean(categoryCounts.column);
  const hasSlabs = Boolean(categoryCounts.slab);

  // Toggle category inclusion in current selection
  const handleToggleCategory = (kind: string) => {
    const filtered = selected.filter((item) => item.kind !== kind);
    if (filtered.length === 0) {
      clearSelection();
    } else {
      selectMultiple(filtered, "replace");
    }
  };

  // "Only" - filter selection to only this kind
  const handleSelectOnly = (kind: string) => {
    const only = selected.filter((item) => item.kind === kind);
    selectMultiple(only, "replace");
  };

  // "Select Similar" - select all elements of this category in active level
  const handleSelectSimilar = (kind: string) => {
    let similarRefs: SelectedElementRef[] = [];
    const filterByLevel = <T extends { id: string; levelId?: string }>(items: T[]) =>
      items.filter((i) => !activeLevelId || i.levelId === activeLevelId).map((i) => ({ id: i.id, kind: kind as LayoutElementKind }));

    if (kind === "wall") similarRefs = filterByLevel(walls);
    else if (kind === "door") similarRefs = doors.map((d) => ({ id: d.id, kind: "door" }));
    else if (kind === "window") similarRefs = windows.map((w) => ({ id: w.id, kind: "window" }));
    else if (kind === "slab") similarRefs = filterByLevel(slabs);
    else if (kind === "column") similarRefs = filterByLevel(columns);
    else if (kind === "beam") similarRefs = filterByLevel(beams);
    else if (kind === "stair") similarRefs = filterByLevel(stairs);
    else if (kind === "ramp") similarRefs = filterByLevel(ramps);
    else if (kind === "duct") similarRefs = filterByLevel(ducts);
    else if (kind === "pipe") similarRefs = filterByLevel(pipes);
    else if (kind === "cabletray") similarRefs = filterByLevel(cableTrays);
    else if (kind === "equipment") similarRefs = filterByLevel(mepEquipment);
    else if (kind === "wire") similarRefs = filterByLevel(wires);

    if (similarRefs.length > 0) {
      selectMultiple(similarRefs, "replace");
    }
  };

  // Bulk Duplicate / Copy
  const handleBulkDuplicate = async () => {
    const newRefs: SelectedElementRef[] = [];
    for (const item of selected) {
      let created: { id: string } | null = null;
      if (item.kind === "wall") created = await duplicateWall(item.id);
      else if (item.kind === "door") created = await duplicateDoor(item.id);
      else if (item.kind === "window") created = await duplicateWindow(item.id);
      else if (item.kind === "slab") created = await duplicateSlab(item.id);
      else if (item.kind === "column") created = await duplicateColumn(item.id);
      else if (item.kind === "beam") created = await duplicateBeam(item.id);
      else if (item.kind === "stair") created = await duplicateStair(item.id);
      else if (item.kind === "ramp") created = await duplicateRamp(item.id);
      else if (item.kind === "duct") created = await duplicateDuct(item.id);
      else if (item.kind === "pipe") created = await duplicatePipe(item.id);
      else if (item.kind === "cabletray") created = await duplicateCableTray(item.id);
      else if (item.kind === "equipment") created = await duplicateEquipment(item.id);
      else if (item.kind === "wire") created = await duplicateWire(item.id);

      if (created) {
        newRefs.push({ id: created.id, kind: item.kind });
      }
    }
    if (newRefs.length > 0) {
      selectMultiple(newRefs, "replace");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    for (const item of selected) {
      if (item.kind === "wall") await deleteWall(item.id);
      else if (item.kind === "door") await deleteDoor(item.id);
      else if (item.kind === "window") await deleteWindow(item.id);
      else if (item.kind === "slab") await deleteSlab(item.id);
      else if (item.kind === "column") await deleteColumn(item.id);
      else if (item.kind === "beam") await deleteBeam(item.id);
      else if (item.kind === "stair") await deleteStair(item.id);
      else if (item.kind === "ramp") await deleteRamp(item.id);
      else if (item.kind === "duct") await deleteDuct(item.id);
      else if (item.kind === "pipe") await deletePipe(item.id);
      else if (item.kind === "cabletray") await deleteCableTray(item.id);
      else if (item.kind === "equipment") await deleteEquipment(item.id);
      else if (item.kind === "wire") await deleteWire(item.id);
    }
    clearSelection();
  };

  // Attach selected walls to Roof / Ceiling
  const handleAttachWallsToRoof = (roofId: string) => {
    const wallRefs = selected.filter((item) => item.kind === "wall");
    for (const w of wallRefs) {
      void updateWall(w.id, { attachedTopRoofId: roofId });
    }
  };

  const handleDetachWallsFromRoof = () => {
    const wallRefs = selected.filter((item) => item.kind === "wall");
    for (const w of wallRefs) {
      void updateWall(w.id, { attachedTopRoofId: undefined });
    }
  };

  // Bulk Level Change
  const handleBatchLevelChange = (levelId: string) => {
    for (const item of selected) {
      if (item.kind === "wall") void updateWall(item.id, { levelId });
      else if (item.kind === "slab") void updateSlab(item.id, { levelId });
      else if (item.kind === "column") void updateColumn(item.id, { baseLevelId: levelId });
      else if (item.kind === "beam") void updateBeam(item.id, { levelId });
      else if (item.kind === "duct") void updateDuct(item.id, { levelId });
      else if (item.kind === "pipe") void updatePipe(item.id, { levelId });
      else if (item.kind === "cabletray") void updateCableTray(item.id, { levelId });
      else if (item.kind === "equipment") void updateEquipment(item.id, { levelId });
      else if (item.kind === "wire") void updateWire(item.id, { levelId });
    }
  };

  // Bulk Height Change
  const handleApplyHeight = () => {
    const val = parseFloat(batchHeight);
    if (isNaN(val) || val <= 0) return;
    for (const item of selected) {
      if (item.kind === "wall") void updateWall(item.id, { heightMm: val });
      else if (item.kind === "column") void updateColumn(item.id, { heightMm: val });
      else if (item.kind === "door") void updateDoor(item.id, { heightMm: val });
      else if (item.kind === "window") void updateWindow(item.id, { heightMm: val });
    }
  };

  // Bulk Thickness Change
  const handleApplyThickness = () => {
    const val = parseFloat(batchThickness);
    if (isNaN(val) || val <= 0) return;
    for (const item of selected) {
      if (item.kind === "wall") void updateWall(item.id, { thicknessMm: val });
      else if (item.kind === "slab") void updateSlab(item.id, { thicknessMm: val });
      else if (item.kind === "ramp") void updateRamp(item.id, { thicknessMm: val });
    }
  };

  // Bulk Material Change
  const handleApplyMaterial = (mat: string) => {
    if (!mat) return;
    for (const item of selected) {
      if (item.kind === "wall") void updateWall(item.id, { material: mat });
      else if (item.kind === "slab") void updateSlab(item.id, { material: mat });
      else if (item.kind === "column") void updateColumn(item.id, { material: mat });
      else if (item.kind === "beam") void updateBeam(item.id, { material: mat });
      else if (item.kind === "door") void updateDoor(item.id, { material: mat });
      else if (item.kind === "window") void updateWindow(item.id, { material: mat });
    }
  };

  // Bulk Color Change
  const handleApplyColor = (color: string) => {
    for (const item of selected) {
      if (item.kind === "wall") void updateWall(item.id, { color });
      else if (item.kind === "slab") void updateSlab(item.id, { color });
      else if (item.kind === "column") void updateColumn(item.id, { color });
      else if (item.kind === "beam") void updateBeam(item.id, { color });
      else if (item.kind === "door") void updateDoor(item.id, { color });
      else if (item.kind === "window") void updateWindow(item.id, { color });
      else if (item.kind === "wire") void updateWire(item.id, { color });
    }
  };

  return (
    <div className={`flex flex-col gap-3 text-[11px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--panel-divider)]/40 pb-2">
        <div className="flex items-center gap-1.5">
          <LuSquareCheck className="h-4 w-4 text-yellow-400" />
          <span className="font-bold uppercase tracking-wider text-[var(--text-strong)] text-[10px]">
            {selected.length} Objects Selected
          </span>
        </div>
        <button
          type="button"
          onClick={clearSelection}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] cursor-pointer"
          title="Deselect All"
        >
          <LuX className="h-3 w-3" />
          Deselect
        </button>
      </div>

      {/* Category Breakdown with Tick Marks & Select Similar */}
      <div className="space-y-1.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2">
        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Categories in Selection
        </div>
        {kinds.map((k) => {
          const info = KIND_LABELS[k] || { label: `${k}s`, singular: k };
          const count = categoryCounts[k];
          return (
            <div
              key={k}
              className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-overlay)]/60 px-2 py-1.5 hover:bg-[var(--surface-overlay)] transition-colors"
            >
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => handleToggleCategory(k)}
                  className="h-3.5 w-3.5 rounded border-[var(--panel-divider)] accent-yellow-500 cursor-pointer"
                />
                <span className="font-semibold text-[var(--text-strong)] text-[10px]">
                  {info.label}
                </span>
                <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.2 text-[9px] font-bold text-yellow-400">
                  {count}
                </span>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectOnly(k)}
                  className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-strong)] cursor-pointer"
                  title={`Keep only ${info.label}`}
                >
                  Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSimilar(k)}
                  className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-400 hover:bg-yellow-500/20 cursor-pointer"
                  title={`Select all similar ${info.label}`}
                >
                  Select Similar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Action Buttons (Copy, Move, Delete) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleBulkDuplicate}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] py-2 text-[10px] font-semibold text-[var(--text-strong)] hover:border-yellow-400/50 hover:bg-yellow-400/10 cursor-pointer transition-colors"
        >
          <LuCopy className="h-3.5 w-3.5 text-yellow-400" />
          Duplicate / Copy
        </button>
        <button
          type="button"
          onClick={handleBulkDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 cursor-pointer transition-colors"
        >
          <LuTrash2 className="h-3.5 w-3.5" />
          Delete Selected
        </button>
      </div>

      {/* Fix / Attach Wall to Roof */}
      {hasWalls && (
        <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-300 text-[10px]">
              <LuArrowUpToLine className="h-3.5 w-3.5" />
              Fix Wall to Roof
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">
              {categoryCounts.wall} wall{categoryCounts.wall > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">
            Attach selected walls to roof profile or ceiling underside for clean CAD/BIM gable cuts.
          </p>
          {roofSlabs.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <select
                value={selectedRoofId}
                onChange={(e) => setSelectedRoofId(e.target.value)}
                className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[10px] text-[var(--text-strong)] outline-none"
              >
                {roofSlabs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.kind === "roof" ? "Roof" : "Floor"}: {r.id.slice(0, 8)} ({r.thicknessMm || 200}mm)
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAttachWallsToRoof(selectedRoofId || roofSlabs[0]?.id)}
                  className="flex-1 rounded bg-sky-500/20 py-1 font-semibold text-sky-300 hover:bg-sky-500/30 text-[10px] cursor-pointer"
                >
                  Attach to Roof
                </button>
                <button
                  type="button"
                  onClick={handleDetachWallsFromRoof}
                  className="rounded border border-[var(--panel-divider)] px-2.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
                >
                  Detach
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[9px] text-amber-400/90 italic">
              Draw a roof or floor slab first to enable roof attachment.
            </p>
          )}
        </div>
      )}

      {/* Common Properties Section */}
      <div className="space-y-2 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-strong)]">
          <LuLayers className="h-3.5 w-3.5 text-yellow-400" />
          Batch Properties
        </div>

        {/* Level */}
        <div className="grid grid-cols-[1fr_7.5rem] items-center gap-2 text-[10px]">
          <span className="font-semibold text-[var(--text-body)]">Level</span>
          <select
            onChange={(e) => {
              if (e.target.value) handleBatchLevelChange(e.target.value);
            }}
            defaultValue=""
            className="h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-[10px] font-semibold text-[var(--text-strong)] outline-none"
          >
            <option value="" disabled>
              Set Level...
            </option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.elevationMm}mm)
              </option>
            ))}
          </select>
        </div>

        {/* Height (Walls / Columns / Openings) */}
        {(hasWalls || hasColumns) && (
          <div className="grid grid-cols-[1fr_7.5rem] items-center gap-2 text-[10px]">
            <span className="font-semibold text-[var(--text-body)]">Height</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Height mm"
                value={batchHeight}
                onChange={(e) => setBatchHeight(e.target.value)}
                className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right font-mono text-[10px] outline-none"
              />
              <button
                type="button"
                onClick={handleApplyHeight}
                className="rounded bg-yellow-500/20 px-1.5 py-1 text-[9px] font-bold text-yellow-400 hover:bg-yellow-500/30 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Thickness (Walls / Slabs / Ramps) */}
        {(hasWalls || hasSlabs) && (
          <div className="grid grid-cols-[1fr_7.5rem] items-center gap-2 text-[10px]">
            <span className="font-semibold text-[var(--text-body)]">Thickness</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Thick mm"
                value={batchThickness}
                onChange={(e) => setBatchThickness(e.target.value)}
                className="h-7 w-full rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-right font-mono text-[10px] outline-none"
              />
              <button
                type="button"
                onClick={handleApplyThickness}
                className="rounded bg-yellow-500/20 px-1.5 py-1 text-[9px] font-bold text-yellow-400 hover:bg-yellow-500/30 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Material */}
        <div className="grid grid-cols-[1fr_7.5rem] items-center gap-2 text-[10px]">
          <span className="font-semibold text-[var(--text-body)]">Material</span>
          <select
            onChange={(e) => {
              if (e.target.value) handleApplyMaterial(e.target.value);
            }}
            defaultValue=""
            className="h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-1.5 text-[10px] text-[var(--text-strong)] outline-none"
          >
            <option value="" disabled>
              Set Material...
            </option>
            <option value="Concrete">Cast Concrete</option>
            <option value="Brick">Running Bond Brick</option>
            <option value="Wood">Warm Timber Wood</option>
            <option value="Glass">Architectural Glass</option>
            <option value="Metal">Structural Metal</option>
            <option value="Plaster">Gypsum Plaster</option>
            <option value="Roofing">Slate Tile Roofing</option>
            <option value="Insulation">Mineral Wool Insulation</option>
          </select>
        </div>

        {/* Color swatches */}
        <div className="pt-1 border-t border-[var(--panel-divider)]/30 space-y-1.5">
          <span className="font-semibold text-[var(--text-body)] text-[10px] flex items-center gap-1">
            <LuPalette className="h-3 w-3 text-yellow-400" />
            Color Swatch
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { color: "#b94833", name: "Brick Red" },
              { color: "#9ca3af", name: "Concrete Gray" },
              { color: "#92613b", name: "Timber Oak" },
              { color: "#f8fafc", name: "Crisp White" },
              { color: "#475569", name: "Slate Dark" },
              { color: "#cbd5e1", name: "Galvanized Metal" },
              { color: "#fef08a", name: "Insulation Yellow" },
              { color: "#38bdf8", name: "Glass Cyan" },
            ].map((swatch) => (
              <button
                key={swatch.color}
                type="button"
                onClick={() => handleApplyColor(swatch.color)}
                style={{ backgroundColor: swatch.color }}
                className="h-5 w-5 rounded-full border border-white/20 hover:scale-110 transition-transform cursor-pointer shadow-sm"
                title={swatch.name}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
