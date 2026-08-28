"use client";

import { useState, useEffect } from "react";
import { LuX, LuCheck, LuSlidersHorizontal, LuInfo, LuPlus, LuTrash2, LuLayers } from "react-icons/lu";
import { UnifiedButton } from "@/components/common/UnifiedButton";
import type { WallLayer, WallLayerFunction } from "@/lib/layoutDrawing";

export type ElementTypeDefinition = {
  id: string;
  name: string;
  category:
    | "Wall"
    | "Door"
    | "Window"
    | "Floor"
    | "Roof"
    | "Shape"
    | "Stair"
    | "Ramp"
    | "Duct"
    | "Pipe"
    | "CableTray"
    | "Heater"
    | "Cooling"
    | "Equipment";
  thicknessMm?: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  diameterMm?: number;
  sillHeightMm?: number;
  powerWatts?: number;
  coolingWatts?: number;
  airflowM3h?: number;
  profile?: "rectangular" | "round" | "oval";
  material: string;
  functionType: "Interior" | "Exterior" | "Structural" | "Non-Bearing";
  thermalConductivity?: string;
  fireRating?: string;
  layers?: WallLayer[];
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
    layers: [
      { id: "l1", name: "Plaster Interior", function: "finish1", material: "Plaster", thicknessMm: 15, color: "#f1f5f9" },
      { id: "l2", name: "Concrete Core", function: "structure", material: "Concrete Core", thicknessMm: 170, color: "#94a3b8" },
      { id: "l3", name: "Plaster Exterior", function: "finish2", material: "Plaster", thicknessMm: 15, color: "#f1f5f9" },
    ],
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
    layers: [
      { id: "l1", name: "Gypsum Board", function: "finish1", material: "Gypsum Board", thicknessMm: 12.5, color: "#e2e8f0" },
      { id: "l2", name: "Metal Stud Air", function: "core", material: "Stud Cavity", thicknessMm: 75, color: "#cbd5e1" },
      { id: "l3", name: "Gypsum Board", function: "finish2", material: "Gypsum Board", thicknessMm: 12.5, color: "#e2e8f0" },
    ],
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
    layers: [
      { id: "l1", name: "Interior Plaster", function: "finish1", material: "Plaster", thicknessMm: 15, color: "#f8fafc" },
      { id: "l2", name: "Concrete Block", function: "structure", material: "Concrete Block", thicknessMm: 175, color: "#94a3b8" },
      { id: "l3", name: "Mineral Wool", function: "insulation", material: "Mineral Wool", thicknessMm: 100, color: "#fef08a" },
      { id: "l4", name: "Exterior Render", function: "finish2", material: "Stucco Render", thicknessMm: 10, color: "#e2e8f0" },
    ],
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

  // Stair Types
  "stair-straight-1000": {
    id: "stair-straight-1000",
    name: "Straight Run - 1000mm Width",
    category: "Stair",
    widthMm: 1000,
    material: "Cast-in-Place Concrete",
    functionType: "Interior",
    fireRating: "REI 90",
  },
  "stair-lshape-1000": {
    id: "stair-lshape-1000",
    name: "L-Shape 90° - 1000mm Width",
    category: "Stair",
    widthMm: 1000,
    material: "Precast Concrete with Timber Treads",
    functionType: "Interior",
    fireRating: "REI 90",
  },
  "stair-ushape-1200": {
    id: "stair-ushape-1200",
    name: "U-Shape Switchback - 1200mm Width",
    category: "Stair",
    widthMm: 1200,
    material: "Cast-in-Place Concrete",
    functionType: "Interior",
    fireRating: "REI 120",
  },
  "stair-spiral-1600": {
    id: "stair-spiral-1600",
    name: "Spiral Helical - 1600mm Diameter",
    category: "Stair",
    widthMm: 800,
    material: "Steel Spine & Hardwood Treads",
    functionType: "Interior",
    fireRating: "F30",
  },

  // Ramp Types
  "ramp-ada-1200": {
    id: "ramp-ada-1200",
    name: "ADA Accessible Ramp (1:12 Max)",
    category: "Ramp",
    widthMm: 1200,
    thicknessMm: 150,
    material: "Broom Finish Concrete",
    functionType: "Exterior",
    fireRating: "REI 60",
  },
  "ramp-service-1500": {
    id: "ramp-service-1500",
    name: "Service & Delivery Ramp (1:8)",
    category: "Ramp",
    widthMm: 1500,
    thicknessMm: 200,
    material: "Reinforced Concrete C30/37",
    functionType: "Exterior",
    fireRating: "REI 120",
  },

  // MEP Heater / Radiator Types
  "heater-panel-1000": {
    id: "heater-panel-1000",
    name: "Hydronic Radiator: 1000 x 600 x 100mm",
    category: "Heater",
    widthMm: 1000,
    heightMm: 600,
    depthMm: 100,
    powerWatts: 1500,
    material: "Enamel Coated Steel",
    functionType: "Interior",
  },
  "heater-compact-800": {
    id: "heater-compact-800",
    name: "Compact Radiator: 800 x 600 x 80mm",
    category: "Heater",
    widthMm: 800,
    heightMm: 600,
    depthMm: 80,
    powerWatts: 1100,
    material: "Enamel Coated Steel",
    functionType: "Interior",
  },

  // MEP Cooling Types
  "cooling-fancoil-900": {
    id: "cooling-fancoil-900",
    name: "Fan Coil Unit (FCU): 900 x 250 x 600mm",
    category: "Cooling",
    widthMm: 900,
    heightMm: 250,
    depthMm: 600,
    coolingWatts: 2500,
    airflowM3h: 450,
    material: "Galvanized Steel & Coil",
    functionType: "Interior",
  },
  "cooling-ac-split-850": {
    id: "cooling-ac-split-850",
    name: "AC Wall Unit: 850 x 290 x 210mm",
    category: "Cooling",
    widthMm: 850,
    heightMm: 290,
    depthMm: 210,
    coolingWatts: 3500,
    material: "Molded Polymer & Coil",
    functionType: "Interior",
  },

  // Duct Types
  "duct-rect-400x200": {
    id: "duct-rect-400x200",
    name: "Rectangular Duct: 400 x 200mm",
    category: "Duct",
    widthMm: 400,
    heightMm: 200,
    profile: "rectangular",
    material: "Galvanized Sheet Metal",
    functionType: "Interior",
  },
  "duct-round-250": {
    id: "duct-round-250",
    name: "Spiral Round Duct: Ø250mm",
    category: "Duct",
    diameterMm: 250,
    profile: "round",
    material: "Galvanized Spiral Steel",
    functionType: "Interior",
  },
  "duct-oval-450x200": {
    id: "duct-oval-450x200",
    name: "Flat Oval Duct: 450 x 200mm",
    category: "Duct",
    widthMm: 450,
    heightMm: 200,
    profile: "oval",
    material: "Galvanized Sheet Metal",
    functionType: "Interior",
  },

  // Pipe Types
  "pipe-heating-28": {
    id: "pipe-heating-28",
    name: "Heating Pipe: Ø28mm Copper",
    category: "Pipe",
    diameterMm: 28,
    material: "Copper DIN EN 1057",
    functionType: "Interior",
  },
  "pipe-waste-110": {
    id: "pipe-waste-110",
    name: "Sanitary Waste Pipe: Ø110mm HT-PP",
    category: "Pipe",
    diameterMm: 110,
    material: "Polypropylene HT-PP",
    functionType: "Interior",
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
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--popover-bg)] backdrop-blur-2xl border-l border-[var(--panel-divider)] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-3.5 bg-[var(--surface-overlay)]/70">
        <div className="flex items-center gap-2 truncate">
          <LuSlidersHorizontal className="h-4 w-4 text-yellow-400 shrink-0" />
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

      {/* Form Body (Dense, Compact, Thin Dividers) */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 space-y-2.5 thin-scroll text-xs">
        {/* Note Banner */}
        <div className="flex items-start gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-2 text-yellow-500 dark:text-yellow-400">
          <LuInfo className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="text-[10px] leading-relaxed">
            <strong>Global Type Parameters:</strong> Changes apply to <strong>all instances</strong> of this type in the project.
          </div>
        </div>

        {/* Type Name */}
        <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Type Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2.5 py-1.5 font-medium text-xs text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none"
          />
        </div>

        {/* Wall Layered Assembly Structure */}
        {formData.category === "Wall" && (
          <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                <LuLayers className="h-3.5 w-3.5" />
                <span>Layer Structure (Interior → Exterior)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newLayer: WallLayer = {
                    id: `l-${Date.now()}`,
                    name: "New Layer",
                    function: "insulation",
                    material: "Thermal Insulation",
                    thicknessMm: 50,
                    color: "#fde047",
                  };
                  const updatedLayers = [...(formData.layers || []), newLayer];
                  const total = updatedLayers.reduce((s, l) => s + l.thicknessMm, 0);
                  setFormData({
                    ...formData,
                    layers: updatedLayers,
                    thicknessMm: total,
                  });
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 hover:text-yellow-300"
              >
                <LuPlus className="h-3 w-3" />
                <span>Add Layer</span>
              </button>
            </div>

            {/* Visual Cross-Section Preview Bar */}
            {formData.layers && formData.layers.length > 0 && (
              <div className="flex h-4 w-full overflow-hidden rounded border border-slate-700 bg-slate-900">
                {formData.layers.map((l, i) => (
                  <div
                    key={l.id || i}
                    style={{
                      width: `${(l.thicknessMm / (formData.thicknessMm || 1)) * 100}%`,
                      backgroundColor: l.color || (l.function === "insulation" ? "#facc15" : l.function === "structure" ? "#64748b" : "#94a3b8"),
                    }}
                    title={`${l.name}: ${l.thicknessMm}mm`}
                    className="h-full border-r border-slate-950/40 last:border-none"
                  />
                ))}
              </div>
            )}

            {/* Layers Table */}
            <div className="space-y-2">
              {(formData.layers || []).map((layer, idx) => (
                <div
                  key={layer.id || idx}
                  className="flex flex-col gap-1.5 rounded-lg bg-[var(--surface-overlay)] p-2 border border-[var(--panel-divider)]/70 text-[11px] shadow-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <select
                      value={layer.function}
                      onChange={(e) => {
                        const updated = (formData.layers || []).map((l, i) =>
                          i === idx ? { ...l, function: e.target.value as WallLayerFunction } : l
                        );
                        setFormData({ ...formData, layers: updated });
                      }}
                      className="vstudio-select vstudio-select-compact flex-1 min-w-0 text-[10px]"
                    >
                      <option value="finish1">Finish 1 [Int]</option>
                      <option value="substrate">Substrate</option>
                      <option value="structure">Structure</option>
                      <option value="core">Core Cavity</option>
                      <option value="insulation">Insulation</option>
                      <option value="finish2">Finish 2 [Ext]</option>
                    </select>

                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={layer.thicknessMm}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx ? { ...l, thicknessMm: val } : l
                          );
                          const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                          setFormData({ ...formData, layers: updated, thicknessMm: total });
                        }}
                        className="w-14 rounded-md border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-1.5 py-0.5 text-right font-mono text-[10px] text-[var(--text-strong)] focus:border-yellow-400 focus:outline-none"
                      />
                      <span className="text-[9px] text-[var(--text-muted)] font-mono">mm</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = (formData.layers || []).filter((_, i) => i !== idx);
                        const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                        setFormData({ ...formData, layers: updated, thicknessMm: total });
                      }}
                      className="text-[var(--text-muted)] hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors shrink-0"
                      title="Remove layer"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={layer.material}
                      onChange={(e) => {
                        const updated = (formData.layers || []).map((l, i) =>
                          i === idx ? { ...l, material: e.target.value, name: e.target.value } : l
                        );
                        setFormData({ ...formData, layers: updated });
                      }}
                      placeholder="Material name..."
                      className="min-w-0 flex-1 rounded-md border border-[var(--panel-divider)] bg-[var(--glass-inset-bg)] px-2 py-1 text-[10px] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Construction Dimensions */}
        <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            Dimensions
          </div>

          {formData.profile !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Profile Shape:</span>
              <select
                value={formData.profile}
                onChange={(e) => setFormData({ ...formData, profile: e.target.value as any })}
                className="w-32 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-xs text-[var(--text-strong)]"
              >
                <option value="rectangular">Rectangular</option>
                <option value="round">Round Spiral</option>
                <option value="oval">Flat Oval</option>
              </select>
            </div>
          )}

          {formData.thicknessMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Total Thickness:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.thicknessMm}
                  disabled={formData.category === "Wall" && Boolean(formData.layers && formData.layers.length > 0)}
                  onChange={(e) => setFormData({ ...formData, thicknessMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)] disabled:opacity-60"
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

          {formData.depthMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Depth:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.depthMm}
                  onChange={(e) => setFormData({ ...formData, depthMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}

          {formData.diameterMm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Diameter:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.diameterMm}
                  onChange={(e) => setFormData({ ...formData, diameterMm: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
              </div>
            </div>
          )}

          {formData.powerWatts !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Heating Rating:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.powerWatts}
                  onChange={(e) => setFormData({ ...formData, powerWatts: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">W</span>
              </div>
            </div>
          )}

          {formData.coolingWatts !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Cooling Capacity:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.coolingWatts}
                  onChange={(e) => setFormData({ ...formData, coolingWatts: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">W</span>
              </div>
            </div>
          )}

          {formData.airflowM3h !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-body)]">Airflow Rate:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.airflowM3h}
                  onChange={(e) => setFormData({ ...formData, airflowM3h: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 py-1 text-right font-mono text-[11px] text-[var(--text-strong)]"
                />
                <span className="text-[10px] text-[var(--text-muted)] font-mono">m³/h</span>
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
        <div className="pb-2.5 border-b border-[var(--panel-divider)]/40 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
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
              className="vstudio-select min-w-36 text-[11px]"
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
          <UnifiedButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </UnifiedButton>
          <UnifiedButton
            type="submit"
            size="sm"
            variant="primary"
            icon={<LuCheck className="h-3.5 w-3.5" />}
          >
            Apply
          </UnifiedButton>
        </div>
      </form>
    </div>
  );
}
