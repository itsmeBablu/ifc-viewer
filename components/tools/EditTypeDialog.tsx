"use client";

import { useState, useEffect, useRef } from "react";
import { LuX, LuCheck, LuSlidersHorizontal, LuInfo, LuPlus, LuTrash2, LuLayers } from "react-icons/lu";
import gsap from "gsap";
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
  const [activeTab, setActiveTab] = useState<"layers" | "dimensions" | "materials" | "physics">(
    typeDef.category === "Wall" ? "layers" : "dimensions"
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Update form state live in place when selection changes
  useEffect(() => {
    setFormData({ ...typeDef });
    if (typeDef.category === "Wall") {
      setActiveTab("layers");
    } else {
      setActiveTab("dimensions");
    }
  }, [typeDef]);

  // GSAP Spring Pop Animation on Mount / Open
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        modalRef.current,
        { scale: 0.92, opacity: 0, y: 16 },
        { scale: 1, opacity: 1, y: 0, duration: 0.38, ease: "back.out(1.4)" }
      );
      gsap.fromTo(
        ".ios-card-anim",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.32, stagger: 0.04, ease: "power2.out", delay: 0.05 }
      );
    }, modalRef);
    return () => ctx.revert();
  }, [isOpen, activeTab]);

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

  const getCategoryGradient = (cat: string) => {
    switch (cat) {
      case "Wall":
        return "from-amber-500 to-orange-600 shadow-orange-500/20";
      case "Door":
      case "Window":
        return "from-blue-500 to-indigo-600 shadow-blue-500/20";
      case "Floor":
      case "Roof":
        return "from-emerald-500 to-teal-600 shadow-emerald-500/20";
      case "Duct":
      case "Pipe":
      case "CableTray":
      case "Equipment":
        return "from-cyan-500 to-blue-600 shadow-cyan-500/20";
      default:
        return "from-purple-500 to-violet-600 shadow-purple-500/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Liquid Glass Modal Card */}
      <div
        ref={modalRef}
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[28px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 text-zinc-900 dark:text-white shadow-[0_24px_70px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl overflow-hidden transition-colors"
      >
        {/* iOS 26 Glass Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getCategoryGradient(
                formData.category
              )} flex items-center justify-center text-white shadow-md shrink-0`}
            >
              <LuSlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {formData.category} Type
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300 font-mono">
                  {formData.id}
                </span>
              </div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight truncate mt-0.5">
                {formData.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-95 shrink-0"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* iOS 26 Segmented Control Navigation */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex p-1 rounded-xl bg-black/[0.05] dark:bg-black/40 border border-black/[0.06] dark:border-white/10 backdrop-blur-md">
            {formData.category === "Wall" && (
              <button
                type="button"
                onClick={() => setActiveTab("layers")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "layers"
                    ? "bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white shadow-[0_2px_8px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LuLayers className="h-3.5 w-3.5" />
                <span>Compound Layers</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("dimensions")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "dimensions"
                  ? "bg-gradient-to-r from-blue-500/90 to-indigo-500/90 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span>Dimensions</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "materials"
                  ? "bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span>Material & Function</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("physics")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "physics"
                  ? "bg-gradient-to-r from-purple-500/90 to-violet-500/90 text-white shadow-[0_2px_8px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span>Physics & Ratings</span>
            </button>
          </div>
        </div>

        {/* Form Body with Grouped iOS Settings Cards */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-3 space-y-4 thin-scroll"
        >
          {/* TAB 1: Compound Layers (Walls) */}
          {activeTab === "layers" && formData.category === "Wall" && (
            <div className="space-y-3 ios-card-anim">
              {/* Type Name Card */}
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-3.5 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1.5">
                  Type Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-white shadow-sm focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition-all"
                />
              </div>

              {/* Cross-Section Visualizer Card */}
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-3.5 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs shadow-sm">
                      <LuLayers className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Compound Cross-Section</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Total: {formData.thicknessMm || 200} mm
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newLayer: WallLayer = {
                          id: `l-${Date.now()}`,
                          name: "Thermal Insulation",
                          function: "insulation",
                          material: "thermal-insulation",
                          thicknessMm: 50,
                          color: "#fef08a",
                        };
                        const updatedLayers = [...(formData.layers || []), newLayer];
                        const total = updatedLayers.reduce((s, l) => s + l.thicknessMm, 0);
                        setFormData({
                          ...formData,
                          layers: updatedLayers,
                          thicknessMm: total,
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300 transition-all active:scale-95"
                    >
                      <LuPlus className="h-3 w-3" />
                      <span>Add Layer</span>
                    </button>
                  </div>
                </div>

                {/* High-definition Layer Glass Bar */}
                {formData.layers && formData.layers.length > 0 && (
                  <div className="relative flex h-7 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/20 bg-black/10 dark:bg-black/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] p-0.5 gap-0.5">
                    {formData.layers.map((l, i) => (
                      <div
                        key={l.id || i}
                        style={{
                          width: `${(l.thicknessMm / Math.max(1, formData.thicknessMm || 1)) * 100}%`,
                          backgroundColor:
                            l.color ||
                            (l.function === "insulation"
                              ? "#facc15"
                              : l.function === "structure"
                              ? "#64748b"
                              : l.function === "finish1"
                              ? "#f1f5f9"
                              : "#94a3b8"),
                        }}
                        title={`${l.name} (${l.function}): ${l.thicknessMm}mm`}
                        className="h-full rounded-lg flex items-center justify-center overflow-hidden text-[9px] font-mono text-zinc-950 font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all hover:brightness-110"
                      >
                        {l.thicknessMm >= 20 ? `${l.thicknessMm}` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Layer Rows */}
                <div className="space-y-2 pt-1">
                  {(formData.layers || []).map((layer, idx) => (
                    <div
                      key={layer.id || idx}
                      className="rounded-xl border border-black/[0.06] dark:border-white/10 bg-black/[0.02] dark:bg-black/30 p-2.5 space-y-2 backdrop-blur-sm transition-all hover:border-black/15 dark:hover:border-white/20"
                    >
                      <div className="flex items-center gap-2">
                        {/* Function Select */}
                        <select
                          value={layer.function}
                          onChange={(e) => {
                            const fn = e.target.value as WallLayerFunction;
                            const defaultColor =
                              fn === "insulation"
                                ? "#fef08a"
                                : fn === "structure"
                                ? "#8e9196"
                                : fn === "finish1"
                                ? "#f8fafc"
                                : fn === "finish2"
                                ? "#e2e8f0"
                                : fn === "substrate"
                                ? "#cbd5e1"
                                : "#94a3b8";
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, function: fn, color: l.color || defaultColor } : l
                            );
                            setFormData({ ...formData, layers: updated });
                          }}
                          className="h-8 rounded-lg border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/50 px-2.5 text-xs text-zinc-900 dark:text-white focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none flex-1 min-w-0"
                        >
                          <option value="finish1" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Finish 1 (Interior)</option>
                          <option value="substrate" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Substrate</option>
                          <option value="structure" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Structure</option>
                          <option value="core" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Core Cavity</option>
                          <option value="insulation" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Thermal Insulation</option>
                          <option value="finish2" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Finish 2 (Exterior)</option>
                        </select>

                        {/* Thickness Stepper */}
                        <div className="flex items-center rounded-lg border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/50 overflow-hidden h-8">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(5, layer.thicknessMm - 5);
                              const updated = (formData.layers || []).map((l, i) =>
                                i === idx ? { ...l, thicknessMm: val } : l
                              );
                              const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                              setFormData({ ...formData, layers: updated, thicknessMm: total });
                            }}
                            className="px-2 h-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={layer.thicknessMm}
                            min={1}
                            max={1000}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              const updated = (formData.layers || []).map((l, i) =>
                                i === idx ? { ...l, thicknessMm: val } : l
                              );
                              const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                              setFormData({ ...formData, layers: updated, thicknessMm: total });
                            }}
                            className="w-14 bg-transparent text-center font-mono text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(1000, layer.thicknessMm + 5);
                              const updated = (formData.layers || []).map((l, i) =>
                                i === idx ? { ...l, thicknessMm: val } : l
                              );
                              const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                              setFormData({ ...formData, layers: updated, thicknessMm: total });
                            }}
                            className="px-2 h-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-colors"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-zinc-500 font-mono pr-2">mm</span>
                        </div>

                        {/* Color Picker */}
                        <input
                          type="color"
                          value={layer.color || "#94a3b8"}
                          onChange={(e) => {
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, color: e.target.value } : l
                            );
                            setFormData({ ...formData, layers: updated });
                          }}
                          title="Layer Color"
                          className="h-8 w-8 rounded-lg border border-black/10 dark:border-white/15 bg-transparent p-0 cursor-pointer shrink-0 overflow-hidden"
                        />

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.layers || []).filter((_, i) => i !== idx);
                            const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                            setFormData({ ...formData, layers: updated, thicknessMm: total });
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all shrink-0 active:scale-95"
                          title="Remove Layer"
                        >
                          <LuTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Material Name Input */}
                      <input
                        type="text"
                        value={layer.material}
                        onChange={(e) => {
                          const updated = (formData.layers || []).map((l, i) =>
                            i === idx ? { ...l, material: e.target.value, name: e.target.value } : l
                          );
                          setFormData({ ...formData, layers: updated });
                        }}
                        placeholder="Material name / preset..."
                        className="w-full h-7 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/40 px-2.5 text-[11px] text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dimensions */}
          {activeTab === "dimensions" && (
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-4 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-3 ios-card-anim">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs shadow-sm">
                  <LuSlidersHorizontal className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Dimensional Specifications</span>
              </div>

              {formData.thicknessMm !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Thickness:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.thicknessMm}
                      disabled={formData.category === "Wall" && Boolean(formData.layers && formData.layers.length > 0)}
                      onChange={(e) => setFormData({ ...formData, thicknessMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none disabled:opacity-60"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.widthMm !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Width:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.widthMm}
                      onChange={(e) => setFormData({ ...formData, widthMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.heightMm !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Height:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.heightMm}
                      onChange={(e) => setFormData({ ...formData, heightMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.depthMm !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Depth:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.depthMm}
                      onChange={(e) => setFormData({ ...formData, depthMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.diameterMm !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Diameter:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.diameterMm}
                      onChange={(e) => setFormData({ ...formData, diameterMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.sillHeightMm !== undefined && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">Sill Height:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={formData.sillHeightMm}
                      onChange={(e) => setFormData({ ...formData, sillHeightMm: Number(e.target.value) })}
                      className="w-24 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-300 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono">mm</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Material & Function */}
          {activeTab === "materials" && (
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-4 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-3 ios-card-anim">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs shadow-sm">
                  <LuCheck className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Material & Construction Class</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Default Material:</span>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  className="w-48 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 shadow-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Structural Function:</span>
                <select
                  value={formData.functionType}
                  onChange={(e) => setFormData({ ...formData, functionType: e.target.value as any })}
                  className="w-40 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/50 px-2.5 text-xs text-zinc-900 dark:text-white shadow-sm focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                >
                  <option value="Interior" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Interior</option>
                  <option value="Exterior" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Exterior</option>
                  <option value="Structural" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Structural</option>
                  <option value="Non-Bearing" className="bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">Non-Bearing</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: Physics & Ratings */}
          {activeTab === "physics" && (
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-4 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-3 ios-card-anim">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs shadow-sm">
                  <LuInfo className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Thermal & Engineering Ratings</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Thermal Conductivity (U/K):</span>
                <input
                  type="text"
                  value={formData.thermalConductivity || "0.35 W/mK"}
                  onChange={(e) => setFormData({ ...formData, thermalConductivity: e.target.value })}
                  className="w-36 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs text-purple-700 dark:text-purple-300 shadow-sm focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">Fire Safety Class:</span>
                <input
                  type="text"
                  value={formData.fireRating || "F90-A"}
                  onChange={(e) => setFormData({ ...formData, fireRating: e.target.value })}
                  className="w-32 h-8 rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-black/40 px-2.5 text-right font-mono text-xs text-purple-700 dark:text-purple-300 shadow-sm focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Action Bottom Bar */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06] dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.05] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-95 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-zinc-950 shadow-[0_4px_14px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
            >
              <LuCheck className="h-4 w-4" />
              <span>Apply Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
