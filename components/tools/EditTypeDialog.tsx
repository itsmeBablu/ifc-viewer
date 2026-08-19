"use client";

import { useState, useEffect } from "react";
import { LuX, LuCheck, LuSlidersHorizontal, LuInfo } from "react-icons/lu";

export type ElementTypeDefinition = {
  id: string;
  name: string;
  category: "Wall" | "Door" | "Window" | "Floor" | "Roof" | "Shape";
  thicknessMm?: number;
  widthMm?: number;
  heightMm?: number;
  sillHeightMm?: number;
  material: string;
  functionType: "Interior" | "Exterior" | "Structural" | "Non-Bearing";
  thermalConductivity?: string;
  fireRating?: string;
};

export const DEFAULT_ELEMENT_TYPES: Record<string, ElementTypeDefinition> = {
  // Wall Types
  "wall-generic-200": {
    id: "wall-generic-200",
    name: "Generic - 200mm",
    category: "Wall",
    thicknessMm: 200,
    heightMm: 3000,
    material: "Masonry Concrete",
    functionType: "Interior",
    thermalConductivity: "0.45 W/mK",
    fireRating: "F90",
  },
  "wall-interior-100": {
    id: "wall-interior-100",
    name: "Interior Partition - 100mm",
    category: "Wall",
    thicknessMm: 100,
    heightMm: 3000,
    material: "Gypsum Drywall",
    functionType: "Interior",
    thermalConductivity: "0.25 W/mK",
    fireRating: "F30",
  },
  "wall-interior-150": {
    id: "wall-interior-150",
    name: "Interior Block - 150mm",
    category: "Wall",
    thicknessMm: 150,
    heightMm: 3000,
    material: "Concrete Block",
    functionType: "Interior",
    thermalConductivity: "0.38 W/mK",
    fireRating: "F60",
  },
  "wall-exterior-300": {
    id: "wall-exterior-300",
    name: "Exterior - 300mm Insulated",
    category: "Wall",
    thicknessMm: 300,
    heightMm: 3000,
    material: "Brick & Thermal Insulation",
    functionType: "Exterior",
    thermalConductivity: "0.18 W/mK",
    fireRating: "F90-A",
  },
  "wall-exterior-365": {
    id: "wall-exterior-365",
    name: "Exterior - 365mm Monolithic",
    category: "Wall",
    thicknessMm: 365,
    heightMm: 3000,
    material: "Clay Poroton Block",
    functionType: "Exterior",
    thermalConductivity: "0.14 W/mK",
    fireRating: "F90-A",
  },

  // Door Types
  "door-single-800": {
    id: "door-single-800",
    name: "Single-Flush: 800 x 2100mm",
    category: "Door",
    widthMm: 800,
    heightMm: 2100,
    material: "Timber Wood",
    functionType: "Interior",
    fireRating: "T30",
  },
  "door-single-900": {
    id: "door-single-900",
    name: "Single-Flush: 900 x 2100mm",
    category: "Door",
    widthMm: 900,
    heightMm: 2100,
    material: "Timber Wood",
    functionType: "Interior",
    fireRating: "T30",
  },
  "door-double-1800": {
    id: "door-double-1800",
    name: "Double-Door: 1800 x 2100mm",
    category: "Door",
    widthMm: 1800,
    heightMm: 2100,
    material: "Aluminium & Glass",
    functionType: "Exterior",
    fireRating: "T60",
  },

  // Window Types
  "win-fixed-1000": {
    id: "win-fixed-1000",
    name: "Fixed: 1000 x 1400mm",
    category: "Window",
    widthMm: 1000,
    heightMm: 1400,
    sillHeightMm: 900,
    material: "Triple-Glazed UPVC",
    functionType: "Exterior",
    thermalConductivity: "0.85 W/m²K (Uw)",
  },
  "win-double-1200": {
    id: "win-double-1200",
    name: "Double-Hung: 1200 x 1400mm",
    category: "Window",
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
    material: "Triple-Glazed Timber-Alu",
    functionType: "Exterior",
    thermalConductivity: "0.80 W/m²K (Uw)",
  },
  "win-pano-2000": {
    id: "win-pano-2000",
    name: "Panoramic: 2000 x 1600mm",
    category: "Window",
    widthMm: 2000,
    heightMm: 1600,
    sillHeightMm: 600,
    material: "Triple-Glazed Aluminium",
    functionType: "Exterior",
    thermalConductivity: "0.75 W/m²K (Uw)",
  },

  // Slab Types
  "slab-floor-200": {
    id: "slab-floor-200",
    name: "Floor Slab - 200mm Concrete",
    category: "Floor",
    thicknessMm: 200,
    material: "Reinforced Concrete C25/30",
    functionType: "Structural",
    fireRating: "REI 90",
  },
  "slab-roof-300": {
    id: "slab-roof-300",
    name: "Roof Slab - 300mm Insulated",
    category: "Roof",
    thicknessMm: 300,
    material: "Concrete + PIR Insulation",
    functionType: "Exterior",
    thermalConductivity: "0.15 W/m²K",
  },
};

interface EditTypeDialogProps {
  typeDef: ElementTypeDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: ElementTypeDefinition) => void;
}

export default function EditTypeDialog({
  typeDef,
  isOpen,
  onClose,
  onSave,
}: EditTypeDialogProps) {
  const [formData, setFormData] = useState<ElementTypeDefinition>({ ...typeDef });

  // Update form state live in place when selection changes
  useEffect(() => {
    setFormData({ ...typeDef });
  }, [typeDef]);

  // Esc key listener to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--popover-bg)] backdrop-blur-xl border border-[var(--panel-divider)] rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3.5 bg-[var(--surface-overlay)]/70">
        <div className="flex items-center gap-2 truncate">
          <LuSlidersHorizontal className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-bold text-xs text-[var(--text-strong)] truncate">
            Edit Type — {formData.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 space-y-3 thin-scroll text-xs">
        {/* Note Banner */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
          <LuInfo className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="text-[10px] leading-relaxed">
            <strong>Global Type Parameters:</strong> Changes apply to <strong>all instances</strong> of this type in the project.
          </div>
        </div>

        {/* Type Name */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Type Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 font-medium text-xs text-[var(--text-strong)] focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Construction Dimensions */}
        <div className="space-y-2.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Dimensions
          </div>

          {formData.thicknessMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Thickness:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.thicknessMm}
                  onChange={(e) => setFormData({ ...formData, thicknessMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}

          {formData.widthMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Width:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.widthMm}
                  onChange={(e) => setFormData({ ...formData, widthMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}

          {formData.heightMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Height:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.heightMm}
                  onChange={(e) => setFormData({ ...formData, heightMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}

          {formData.sillHeightMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Sill Height:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.sillHeightMm}
                  onChange={(e) => setFormData({ ...formData, sillHeightMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}
        </div>

        {/* Materials & Finishes */}
        <div className="space-y-2.5 rounded-xl border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Materials & Function
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-body)]">Material:</span>
            <input
              type="text"
              value={formData.material}
              onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              className="w-36 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right text-[11px] text-[var(--text-strong)]"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-body)]">Function:</span>
            <select
              value={formData.functionType}
              onChange={(e) => setFormData({ ...formData, functionType: e.target.value as any })}
              className="rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-[11px] text-[var(--text-strong)]"
            >
              <option value="Interior">Interior</option>
              <option value="Exterior">Exterior</option>
              <option value="Structural">Structural</option>
              <option value="Non-Bearing">Non-Bearing</option>
            </select>
          </div>

          {formData.thermalConductivity && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Thermal U/K:</span>
              <input
                type="text"
                value={formData.thermalConductivity}
                onChange={(e) => setFormData({ ...formData, thermalConductivity: e.target.value })}
                className="w-32 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
              />
            </div>
          )}

          {formData.fireRating && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Fire Rating:</span>
              <input
                type="text"
                value={formData.fireRating}
                onChange={(e) => setFormData({ ...formData, fireRating: e.target.value })}
                className="w-24 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--panel-divider)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--panel-divider)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
          >
            <LuCheck className="h-3.5 w-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </form>
    </div>
  );
}
