"use client";

import { useState } from "react";
import {
  LuX,
  LuPlus,
  LuTrash2,
  LuCheck,
  LuPalette,
  LuSparkles,
  LuLayers,
  LuBox,
  LuSliders,
} from "react-icons/lu";
import {
  useMaterialStore,
  type MaterialDefinition,
  type HatchStyle,
} from "@/store/materialStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

const HATCH_OPTIONS: { id: HatchStyle; label: string; icon: string }[] = [
  { id: "solid", label: "Solid", icon: "■" },
  { id: "diagonal", label: "Diagonal", icon: "///" },
  { id: "cross", label: "Cross-Hatch", icon: "✕✕" },
  { id: "brick", label: "Brick", icon: "☲" },
  { id: "concrete", label: "Concrete", icon: "∴" },
  { id: "dots", label: "Dots", icon: "••" },
  { id: "zigzag", label: "Insulation", icon: "⌇⌇" },
  { id: "wood", label: "Wood Grain", icon: "≋" },
];

const PRESET_COLORS = [
  "#878683", "#a0522d", "#8b5a2b", "#bae6fd", "#94a3b8", "#f8fafc",
  "#d6d3d1", "#78716c", "#38bdf8", "#0284c7", "#f59e0b", "#10b981",
  "#ef4444", "#8b5cf6", "#1e293b", "#334155", "#475569", "#cbd5e1",
];

export default function MaterialEditorPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const materials = useMaterialStore((s) => s.materials);
  const selectedMaterialId = useMaterialStore((s) => s.selectedMaterialId);
  const setSelectedMaterialId = useMaterialStore((s) => s.setSelectedMaterialId);
  const addMaterial = useMaterialStore((s) => s.addMaterial);
  const updateMaterial = useMaterialStore((s) => s.updateMaterial);
  const deleteMaterial = useMaterialStore((s) => s.deleteMaterial);

  // Selection stores for per-part assignment
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);

  const selectedMat =
    materials.find((m) => m.id === selectedMaterialId) || materials[0];

  const [partTarget, setPartTarget] = useState<"primary" | "frame" | "panel">("primary");

  if (!isOpen) return null;

  const handleCreateNew = () => {
    const newMat = addMaterial({
      name: `Custom Material ${materials.length + 1}`,
      category: "Custom",
      color: selectedMat?.color || "#a1a1aa",
      roughness: selectedMat?.roughness ?? 0.5,
      metalness: selectedMat?.metalness ?? 0.1,
      opacity: selectedMat?.opacity ?? 1.0,
      transmission: selectedMat?.transmission ?? 0.0,
      hatchStyle: selectedMat?.hatchStyle || "diagonal",
    });
    setSelectedMaterialId(newMat.id);
  };

  const handleAssignToSelected = () => {
    if (!selectedMat) return;

    if (selectedWallId) {
      updateWall(selectedWallId, {
        material: selectedMat.id as any,
        color: selectedMat.color,
      });
    } else if (selectedSlabId) {
      updateSlab(selectedSlabId, {
        material: selectedMat.id as any,
        color: selectedMat.color,
      });
    } else if (selectedDoorId) {
      if (partTarget === "panel") {
        updateDoor(selectedDoorId, {
          style: (selectedMat.id === "glass" ? "glass" : selectedMat.id === "metal" ? "metal" : "wood") as any,
        });
      } else {
        updateDoor(selectedDoorId, {
          color: selectedMat.color,
        });
      }
    } else if (selectedWindowId) {
      updateWindow(selectedWindowId, {
        color: selectedMat.color,
      });
    }
  };

  const hasSelection = Boolean(
    selectedWallId || selectedDoorId || selectedWindowId || selectedSlabId
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[var(--popover-bg)] backdrop-blur-2xl border border-[var(--panel-divider)] rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3.5 bg-[var(--surface-overlay)]/70">
        <div className="flex items-center gap-2">
          <LuPalette className="h-4 w-4 text-amber-500" />
          <span className="font-bold text-xs text-[var(--text-strong)]">
            Material Editor (3ds Max Style)
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close Material Editor (Esc)"
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 thin-scroll text-xs">
        {/* Swatch Library Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <LuBox className="h-3 w-3" />
              Material Library
            </span>
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] hover:bg-amber-500/20 transition-all"
            >
              <LuPlus className="h-3 w-3" />
              <span>New Material</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {materials.map((mat) => {
              const isSelected = mat.id === selectedMaterialId;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setSelectedMaterialId(mat.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center group ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/20 shadow-md ring-1 ring-amber-500/50"
                      : "border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] hover:border-amber-400/60"
                  }`}
                >
                  {/* Visual 3D-effect swatch circle */}
                  <div
                    className="h-8 w-8 rounded-full border border-white/30 shadow-inner flex items-center justify-center relative overflow-hidden"
                    style={{
                      backgroundColor: mat.color,
                      opacity: mat.opacity,
                      boxShadow: `inset -2px -2px 6px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(255,255,255,${
                        mat.metalness > 0.5 ? "0.8" : "0.4"
                      })`,
                    }}
                  >
                    <span className="text-[9px] font-mono opacity-60 font-bold text-slate-900 mix-blend-difference">
                      {HATCH_OPTIONS.find((h) => h.id === mat.hatchStyle)?.icon || "■"}
                    </span>
                  </div>
                  <span className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text-strong)] w-full">
                    {mat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Material Property Controls */}
        {selectedMat && (
          <div className="space-y-3 rounded-2xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--panel-divider)]/60 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <LuSliders className="h-3 w-3" />
                Parameters — {selectedMat.name}
              </span>
              {!selectedMat.isPreset && (
                <button
                  type="button"
                  onClick={() => deleteMaterial(selectedMat.id)}
                  className="text-red-500 hover:text-red-400 p-1 rounded transition-colors"
                  title="Delete Custom Material"
                >
                  <LuTrash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Name & Category */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Name</label>
                <input
                  type="text"
                  value={selectedMat.name}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-xs text-[var(--text-strong)] font-medium disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Category</label>
                <select
                  value={selectedMat.category}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { category: e.target.value as any })}
                  className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-xs text-[var(--text-strong)] disabled:opacity-60"
                >
                  <option value="Masonry">Masonry</option>
                  <option value="Concrete">Concrete</option>
                  <option value="Wood">Wood</option>
                  <option value="Glass">Glass</option>
                  <option value="Metal">Metal</option>
                  <option value="Finishes">Finishes</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Color Palette + Custom Hex */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Base Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedMat.color}
                    disabled={selectedMat.isPreset}
                    onChange={(e) => updateMaterial(selectedMat.id, { color: e.target.value })}
                    className="h-5 w-5 rounded cursor-pointer border-0 p-0 bg-transparent disabled:opacity-60"
                  />
                  <span className="font-mono text-[10px] text-[var(--text-strong)]">
                    {selectedMat.color.toUpperCase()}
                  </span>
                </div>
              </div>

              {!selectedMat.isPreset && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateMaterial(selectedMat.id, { color: c })}
                      className="h-4 w-4 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* PBR Sliders */}
            <div className="space-y-2.5 pt-1">
              {/* Roughness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-body)]">Roughness (Matte vs Gloss):</span>
                  <span className="font-mono font-bold text-amber-500">
                    {Math.round(selectedMat.roughness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedMat.roughness}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { roughness: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer disabled:opacity-60"
                />
              </div>

              {/* Metalness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-body)]">Metalness (Dielectric vs Metal):</span>
                  <span className="font-mono font-bold text-sky-500">
                    {Math.round(selectedMat.metalness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedMat.metalness}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { metalness: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer disabled:opacity-60"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-body)]">Opacity (Solid vs Transparent):</span>
                  <span className="font-mono font-bold text-emerald-500">
                    {Math.round(selectedMat.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={selectedMat.opacity}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer disabled:opacity-60"
                />
              </div>

              {/* 2D Plan Hatch Pattern */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  2D Plan Hatch Pattern
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {HATCH_OPTIONS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      disabled={selectedMat.isPreset}
                      onClick={() => updateMaterial(selectedMat.id, { hatchStyle: h.id })}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all ${
                        selectedMat.hatchStyle === h.id
                          ? "border-amber-500 bg-amber-500/20 text-amber-500 font-bold"
                          : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-amber-400/50"
                      } disabled:opacity-60`}
                    >
                      <span className="text-xs font-mono font-bold">{h.icon}</span>
                      <span className="text-[9px] mt-0.5 truncate">{h.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Part Assignment Action Banner */}
        <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <LuSparkles className="h-3 w-3" />
            Assign to Selected Element
          </div>

          {(selectedDoorId || selectedWindowId) && (
            <div className="flex items-center gap-1 bg-[var(--surface-overlay)] p-1 rounded-lg border border-[var(--panel-divider)]">
              <button
                type="button"
                onClick={() => setPartTarget("frame")}
                className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  partTarget === "frame"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                Frame
              </button>
              <button
                type="button"
                onClick={() => setPartTarget("panel")}
                className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  partTarget === "panel"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                {selectedDoorId ? "Leaf Panel" : "Glass Pane"}
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={!hasSelection}
            onClick={handleAssignToSelected}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LuCheck className="h-4 w-4" />
            <span>
              {hasSelection
                ? `Apply "${selectedMat?.name}" to Selection`
                : "Select an element to assign"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
