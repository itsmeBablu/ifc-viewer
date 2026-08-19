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
  LuSlidersHorizontal,
} from "react-icons/lu";
import {
  useMaterialStore,
  type MaterialDefinition,
  type HatchStyle,
} from "@/store/materialStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { renderMaterialSphere } from "@/lib/materialSpherePreview";
import UnifiedButton from "@/components/common/UnifiedButton";

const HATCH_OPTIONS: { id: HatchStyle; label: string; icon: string }[] = [
  { id: "solid", label: "None (Solid)", icon: "■" },
  { id: "diagonal", label: "Diagonal", icon: "///" },
  { id: "cross", label: "Cross-Hatch", icon: "✕✕" },
  { id: "brick", label: "Brick", icon: "☲" },
  { id: "concrete", label: "Concrete", icon: "∴" },
  { id: "dots", label: "Dots", icon: "••" },
  { id: "zigzag", label: "Insulation", icon: "⌇⌇" },
  { id: "wood", label: "Wood Grain", icon: "≋" },
];

const CATEGORIES = [
  "All",
  "Masonry",
  "Concrete",
  "Wood",
  "Glass",
  "Metal",
  "Finishes",
  "Custom",
] as const;

const PRESET_COLORS = [
  "#878683", "#a0522d", "#8b5a2b", "#bae6fd", "#94a3b8", "#f8fafc",
  "#d6d3d1", "#78716c", "#38bdf8", "#0284c7", "#facc15", "#10b981",
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

  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Selection stores for per-part assignment
  const selectedWallId = useLayoutDrawingStore((s) => s.selectedWallId);
  const selectedDoorId = useLayoutDrawingStore((s) => s.selectedDoorId);
  const selectedWindowId = useLayoutDrawingStore((s) => s.selectedWindowId);
  const selectedSlabId = useLayoutDrawingStore((s) => s.selectedSlabId);
  const updateWall = useLayoutDrawingStore((s) => s.updateWall);
  const updateDoor = useLayoutDrawingStore((s) => s.updateDoor);
  const updateWindow = useLayoutDrawingStore((s) => s.updateWindow);
  const updateSlab = useLayoutDrawingStore((s) => s.updateSlab);

  const filteredMaterials =
    selectedCategory === "All"
      ? materials
      : materials.filter(
          (m) =>
            m.category.toLowerCase() === selectedCategory.toLowerCase() ||
            (selectedCategory === "Custom" && !m.isPreset),
        );

  const selectedMat =
    materials.find((m) => m.id === selectedMaterialId) || filteredMaterials[0] || materials[0];

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
      hatchStyle: selectedMat?.hatchStyle || "solid",
      hatchScaleMm: 200,
      tilingScale: 1.0,
      bumpScale: 0.2,
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
    <div className="absolute inset-0 z-40 flex flex-col bg-[var(--popover-bg)] backdrop-blur-2xl border-l border-[var(--panel-divider)] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3.5 bg-[var(--surface-overlay)]/70">
        <div className="flex items-center gap-2">
          <LuPalette className="h-4 w-4 text-yellow-400" />
          <span className="font-bold text-xs text-[var(--text-strong)]">
            Material Library & Shader Editor
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

      {/* Main Body (Dense, Compact, Thin Dividers) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 thin-scroll text-xs">
        {/* Swatch Library Grid with 3D Sphere Previews */}
        <div className="pb-2 border-b border-[var(--panel-divider)]/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
              <LuBox className="h-3 w-3" />
              Presets & Custom Materials
            </span>
            <UnifiedButton
              size="xs"
              variant="primary"
              onClick={handleCreateNew}
              icon={<LuPlus className="h-3 w-3" />}
            >
              New
            </UnifiedButton>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto thin-scroll pb-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 transition-all border ${
                  selectedCategory === cat
                    ? "bg-yellow-400 border-yellow-300 text-slate-950 shadow-sm"
                    : "bg-[var(--surface-overlay)] border-[var(--panel-divider)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5 max-h-[150px] overflow-y-auto thin-scroll p-0.5">
            {filteredMaterials.map((mat) => {
              const isSelected = mat.id === selectedMaterialId;
              const sphereUrl = renderMaterialSphere(mat, 52);
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setSelectedMaterialId(mat.id)}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all text-center group ${
                    isSelected
                      ? "border-yellow-400 bg-yellow-400/15 shadow-md ring-1 ring-yellow-400/50"
                      : "border-[var(--panel-divider)] bg-[var(--surface-overlay)]/40 hover:border-yellow-400/50"
                  }`}
                >
                  {/* 3D Rendered Sphere Preview */}
                  <div className="h-8 w-8 flex items-center justify-center relative">
                    {sphereUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sphereUrl}
                        alt={mat.name}
                        className="h-8 w-8 object-contain drop-shadow-md"
                      />
                    ) : (
                      <div
                        className="h-7 w-7 rounded-full border border-white/30 shadow-inner"
                        style={{ backgroundColor: mat.color }}
                      />
                    )}
                    <span className="absolute bottom-0 right-0 text-[7px] font-mono font-bold bg-black/60 text-white rounded px-0.5 border border-white/20">
                      {HATCH_OPTIONS.find((h) => h.id === mat.hatchStyle)?.icon || "■"}
                    </span>
                  </div>
                  <span className="mt-1 truncate text-[9px] font-semibold text-[var(--text-strong)] w-full">
                    {mat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Material Property Controls (Compact, Thin Dividers) */}
        {selectedMat && (
          <div className="space-y-2 pb-2 border-b border-[var(--panel-divider)]/40">
            <div className="flex items-center justify-between pb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                <LuSlidersHorizontal className="h-3 w-3" />
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
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Name</label>
                <input
                  type="text"
                  value={selectedMat.name}
                  disabled={selectedMat.isPreset}
                  onChange={(e) => updateMaterial(selectedMat.id, { name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-xs text-[var(--text-strong)] font-medium disabled:opacity-60"
                />
              </div>
              <div className="space-y-0.5">
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
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Base Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedMat.color}
                    onChange={(e) => updateMaterial(selectedMat.id, { color: e.target.value })}
                    className="h-4 w-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="font-mono text-[9.5px] text-[var(--text-strong)]">
                    {selectedMat.color.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-0.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateMaterial(selectedMat.id, { color: c })}
                    className={`h-3.5 w-3.5 rounded-full border transition-all ${
                      selectedMat.color.toLowerCase() === c.toLowerCase()
                        ? "border-yellow-400 scale-125 shadow-sm"
                        : "border-white/20 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* PBR Sliders — Thin & Sleek with Unified Yellow Accent */}
            <div className="space-y-2 pt-1">
              {/* Roughness */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[var(--text-body)]">Roughness (Matte vs Gloss):</span>
                  <span className="font-mono font-bold text-yellow-400">
                    {Math.round(selectedMat.roughness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedMat.roughness}
                  onChange={(e) => updateMaterial(selectedMat.id, { roughness: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
              </div>

              {/* Metalness */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[var(--text-body)]">Metalness (Dielectric vs Metal):</span>
                  <span className="font-mono font-bold text-yellow-400">
                    {Math.round(selectedMat.metalness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedMat.metalness}
                  onChange={(e) => updateMaterial(selectedMat.id, { metalness: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[var(--text-body)]">Opacity (Solid vs Transparent):</span>
                  <span className="font-mono font-bold text-yellow-400">
                    {Math.round(selectedMat.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.01"
                  value={selectedMat.opacity}
                  onChange={(e) => updateMaterial(selectedMat.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
              </div>

              {/* 2D Plan Hatch Pattern */}
              <div className="space-y-1 pt-1.5 border-t border-[var(--panel-divider)]/40">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  2D Plan Hatch Pattern
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {HATCH_OPTIONS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => updateMaterial(selectedMat.id, { hatchStyle: h.id })}
                      className={`flex flex-col items-center justify-center p-1 rounded-lg border text-center transition-all cursor-pointer ${
                        selectedMat.hatchStyle === h.id
                          ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 font-bold shadow-sm"
                          : "border-[var(--panel-divider)] bg-[var(--surface-overlay)] text-[var(--text-body)] hover:border-yellow-400/50"
                      }`}
                    >
                      <span className="text-xs font-mono font-bold">{h.icon}</span>
                      <span className="text-[8.5px] mt-0.5 truncate">{h.label}</span>
                    </button>
                  ))}
                </div>

                {/* Hatch Size / Spacing Slider */}
                {selectedMat.hatchStyle !== "solid" && (
                  <div className="space-y-0.5 pt-1">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-[var(--text-body)]">Hatch Line Spacing:</span>
                      <span className="font-mono font-bold text-yellow-400">
                        {selectedMat.hatchScaleMm || 200} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="25"
                      value={selectedMat.hatchScaleMm || 200}
                      onChange={(e) =>
                        updateMaterial(selectedMat.id, {
                          hatchScaleMm: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Advanced Surface Mapping Controls */}
              <div className="space-y-1.5 pt-1.5 border-t border-[var(--panel-divider)]/40">
                <label className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                  Surface Texture & Relief
                </label>

                {/* Texture Tiling / Scale */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-[var(--text-body)]">Tiling / UV Scale:</span>
                    <span className="font-mono font-bold text-yellow-400">
                      {(selectedMat.tilingScale || 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="5.0"
                    step="0.1"
                    value={selectedMat.tilingScale || 1.0}
                    onChange={(e) =>
                      updateMaterial(selectedMat.id, {
                        tilingScale: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                  />
                </div>

                {/* Bump / Normal Relief */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-[var(--text-body)]">Surface Bump / Depth:</span>
                    <span className="font-mono font-bold text-yellow-400">
                      {Math.round((selectedMat.bumpScale ?? 0.2) * 50)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={selectedMat.bumpScale ?? 0.2}
                    onChange={(e) =>
                      updateMaterial(selectedMat.id, {
                        bumpScale: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1 bg-[var(--surface-muted)] accent-yellow-400 rounded-lg appearance-none cursor-pointer focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Part Assignment Action (Compact, Thin Divider, No Heavy Box) */}
        <div className="pt-2 border-t border-[var(--panel-divider)]/40 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-500 dark:text-yellow-400 flex items-center gap-1.5">
            <LuSparkles className="h-3 w-3" />
            Assign to Selected Element
          </div>

          {(selectedDoorId || selectedWindowId) && (
            <div className="flex items-center gap-1 bg-[var(--surface-overlay)] p-0.5 rounded-lg border border-[var(--panel-divider)]">
              <button
                type="button"
                onClick={() => setPartTarget("frame")}
                className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  partTarget === "frame"
                    ? "bg-yellow-400 text-slate-950 shadow-sm"
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
                    ? "bg-yellow-400 text-slate-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                {selectedDoorId ? "Leaf Panel" : "Glass Pane"}
              </button>
            </div>
          )}

          <UnifiedButton
            variant="primary"
            size="md"
            disabled={!hasSelection}
            onClick={handleAssignToSelected}
            icon={<LuCheck className="h-4 w-4" />}
            className="w-full"
          >
            {hasSelection
              ? `Apply "${selectedMat?.name}" to Selection`
              : "Select an element to assign"}
          </UnifiedButton>
        </div>
      </div>
    </div>
  );
}
