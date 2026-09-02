"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LuX, LuCheck, LuSlidersHorizontal, LuInfo, LuPlus, LuTrash2, LuLayers } from "react-icons/lu";
import { useAppStore } from "@/store/useAppStore";
import type { WallLayer, WallLayerFunction } from "@/lib/layoutDrawing";
import UnifiedButton from "@/components/common/UnifiedButton";

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
  // German Standard Wall Types (Bauteile: GEG & Altbau)
  "wall-de-aw-365": {
    id: "wall-de-aw-365",
    name: "AW 36.5cm Poroton / Porenbeton (GEG Standard)",
    category: "Wall",
    thicknessMm: 365,
    heightMm: 3000,
    material: "Poroton T8 / Porenbeton",
    functionType: "Exterior",
    thermalConductivity: "0.18 W/m²K (U)",
    fireRating: "F90-A",
    layers: [
      { id: "l1", name: "Gips-Innenputz", function: "finish1", material: "Gipsputz", thicknessMm: 15, color: "#f8fafc" },
      { id: "l2", name: "Poroton T8 Mauerwerk", function: "structure", material: "Poroton Brick", thicknessMm: 335, color: "#ea580c" },
      { id: "l3", name: "Kalk-Zement-Außenputz", function: "finish2", material: "Außenputz", thicknessMm: 15, color: "#e2e8f0" },
    ],
  },
  "wall-de-aw-wdvs-300": {
    id: "wall-de-aw-wdvs-300",
    name: "AW 30cm WDVS EPS + Kalksandstein (Modern)",
    category: "Wall",
    thicknessMm: 300,
    heightMm: 3000,
    material: "Kalksandstein & EPS Dämmung",
    functionType: "Exterior",
    thermalConductivity: "0.16 W/m²K (U)",
    fireRating: "F90-A",
    layers: [
      { id: "l1", name: "Gipsputz Innen", function: "finish1", material: "Gipsputz", thicknessMm: 15, color: "#f8fafc" },
      { id: "l2", name: "Kalksandstein KS 12", function: "structure", material: "Kalksandstein", thicknessMm: 175, color: "#cbd5e1" },
      { id: "l3", name: "EPS WDVS Dämmung", function: "insulation", material: "EPS Rigid Board", thicknessMm: 100, color: "#fef08a" },
      { id: "l4", name: "Armierungsputz / Stucco", function: "finish2", material: "Außenputz", thicknessMm: 10, color: "#94a3b8" },
    ],
  },
  "wall-de-iw-240": {
    id: "wall-de-iw-240",
    name: "IW 24cm Tragsystem Kalksandstein (Schallschutz)",
    category: "Wall",
    thicknessMm: 240,
    heightMm: 3000,
    material: "Kalksandstein KS 20",
    functionType: "Interior",
    thermalConductivity: "1.10 W/m²K (U)",
    fireRating: "F180-A",
    layers: [
      { id: "l1", name: "Gipsputz Links", function: "finish1", material: "Gipsputz", thicknessMm: 15, color: "#f8fafc" },
      { id: "l2", name: "Kalksandstein Schwer", function: "structure", material: "Kalksandstein", thicknessMm: 210, color: "#cbd5e1" },
      { id: "l3", name: "Gipsputz Rechts", function: "finish2", material: "Gipsputz", thicknessMm: 15, color: "#f8fafc" },
    ],
  },
  "wall-de-iw-115": {
    id: "wall-de-iw-115",
    name: "IW 11.5cm Nichttragende Zwischenwand",
    category: "Wall",
    thicknessMm: 115,
    heightMm: 3000,
    material: "Porenbeton / Gips-Wandbauplatte",
    functionType: "Interior",
    thermalConductivity: "0.85 W/m²K (U)",
    fireRating: "F60",
    layers: [
      { id: "l1", name: "Dünnbettputz", function: "finish1", material: "Gipsputz", thicknessMm: 5, color: "#f8fafc" },
      { id: "l2", name: "Porenbeton Wandbauplatte", function: "structure", material: "Porenbeton", thicknessMm: 105, color: "#e2e8f0" },
      { id: "l3", name: "Dünnbettputz", function: "finish2", material: "Gipsputz", thicknessMm: 5, color: "#f8fafc" },
    ],
  },
  "wall-de-kw-300": {
    id: "wall-de-kw-300",
    name: "KW 30cm Kellerwand Beton C30/37 + Perimeterdämmung",
    category: "Wall",
    thicknessMm: 300,
    heightMm: 3000,
    material: "Stahlbeton & XPS Perimeterdämmung",
    functionType: "Exterior",
    thermalConductivity: "0.22 W/m²K (U)",
    fireRating: "F120-A",
    layers: [
      { id: "l1", name: "Stahlbeton WU-Beton", function: "structure", material: "Reinforced Concrete", thicknessMm: 240, color: "#64748b" },
      { id: "l2", name: "Bitumen Dickbeschichtung", function: "membrane", material: "Bitumen Membrane", thicknessMm: 10, color: "#1e293b" },
      { id: "l3", name: "XPS Perimeterdämmung", function: "insulation", material: "XPS Rigid Insulation", thicknessMm: 50, color: "#38bdf8" },
    ],
  },
  "wall-de-altbau-380": {
    id: "wall-de-altbau-380",
    name: "Altbau Vollziegel 38cm (Historisches Mauerwerk)",
    category: "Wall",
    thicknessMm: 380,
    heightMm: 3200,
    material: "Historischer Vollziegel & Kalkmörtel",
    functionType: "Exterior",
    thermalConductivity: "1.20 W/m²K (U)",
    fireRating: "F180-A",
    layers: [
      { id: "l1", name: "Historischer Kalkputz", function: "finish1", material: "Kalkputz", thicknessMm: 20, color: "#fef3c7" },
      { id: "l2", name: "Vollziegelmauerwerk Reichsformat", function: "structure", material: "Solid Brick Altbau", thicknessMm: 340, color: "#b91c1c" },
      { id: "l3", name: "Kalk-Außenputz", function: "finish2", material: "Kalk-Zement", thicknessMm: 20, color: "#fef3c7" },
    ],
  },
  "wall-de-altbau-500": {
    id: "wall-de-altbau-500",
    name: "Altbau Bruchstein / Ziegel 50cm (Historisch)",
    category: "Wall",
    thicknessMm: 500,
    heightMm: 3400,
    material: "Bruchstein & Vollziegel",
    functionType: "Exterior",
    thermalConductivity: "1.45 W/m²K (U)",
    fireRating: "F180-A",
    layers: [
      { id: "l1", name: "Kalkputz", function: "finish1", material: "Kalkputz", thicknessMm: 25, color: "#fef3c7" },
      { id: "l2", name: "Bruchstein-Mischmauerwerk", function: "structure", material: "Natural Stone & Brick", thicknessMm: 450, color: "#78716c" },
      { id: "l3", name: "Kalkputz Außen", function: "finish2", material: "Kalkputz", thicknessMm: 25, color: "#fef3c7" },
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
  const isDark = useAppStore((s) => s.colorTheme === "dark");
  const [formData, setFormData] = useState<ElementTypeDefinition>({ ...typeDef });
  const [dialogWidth, setDialogWidth] = useState<number>(480);
  const [activeTab, setActiveTab] = useState<"layers" | "dimensions" | "materials" | "physics">(
    typeDef.category === "Wall" ? "layers" : "dimensions"
  );
  
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(480);

  // Update form state live in place when selection changes
  useEffect(() => {
    setFormData({ ...typeDef });
    if (typeDef.category === "Wall") {
      setActiveTab("layers");
    } else {
      setActiveTab("dimensions");
    }
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

  // Width Resize Handler
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = dialogWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - resizeStartXRef.current;
      const next = Math.min(840, Math.max(340, resizeStartWidthRef.current + delta));
      setDialogWidth(next);
    };

    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dialogWidth]);

  if (!isOpen) return null;

  const isMep = ["Duct", "Pipe", "CableTray", "Heater", "Cooling", "Equipment"].includes(formData.category);
  const accentColor = isMep ? "text-sky-400" : "text-yellow-400";
  const accentBg = isMep ? "bg-sky-400" : "bg-yellow-400";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const inputClass = `h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] font-mono text-[var(--text-strong)] focus:outline-none transition-colors ${
    isMep ? "focus:border-sky-400" : "focus:border-yellow-400"
  }`;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${isDark ? "bg-black/70" : "bg-black/35"} backdrop-blur-md animate-in fade-in duration-150 select-none`}>
      {/* Resizable Studio Modal */}
      <div
        style={{ width: dialogWidth, maxWidth: "96vw", maxHeight: "90vh" }}
        className="relative flex flex-col rounded-xl border border-[var(--panel-divider)] bg-[var(--surface-card)] text-[var(--text-strong)] shadow-2xl backdrop-blur-2xl overflow-hidden transition-all"
      >
        {/* Right Border Resize Handle */}
        <div
          onMouseDown={onResizeMouseDown}
          className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:${accentBg} transition-colors`}
          title="Drag to resize dialog width"
        />

        {/* Studio Header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--panel-divider)] px-2.5 bg-[var(--surface-overlay)]/60">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className={`h-2 w-2 rounded-full ${accentBg} shrink-0 shadow-[0_0_6px_rgba(250,204,21,0.5)]`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate shrink-0">
              Type Properties:
            </span>
            <span className="font-semibold text-xs text-[var(--text-strong)] truncate" title={formData.name}>
              {formData.name}...
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--glass-inset-bg)] hover:text-[var(--text-strong)] transition-colors shrink-0"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Compact Tab Switcher */}
        <div className="px-2 pt-1.5 pb-1 border-b border-[var(--panel-divider)]/40 bg-[var(--surface-overlay)]/30">
          <div className="flex gap-1 p-0.5 rounded-lg border border-[var(--panel-divider)] bg-[var(--surface-overlay)]">
            {formData.category === "Wall" && (
              <button
                type="button"
                onClick={() => setActiveTab("layers")}
                className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1 truncate ${
                  activeTab === "layers"
                    ? `${accentBg} text-zinc-950 font-bold shadow-sm`
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                <LuLayers className="h-3 w-3 shrink-0" />
                <span className="truncate">Layers...</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("dimensions")}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1 truncate ${
                activeTab === "dimensions"
                  ? `${accentBg} text-zinc-950 font-bold shadow-sm`
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuSlidersHorizontal className="h-3 w-3 shrink-0" />
              <span className="truncate">Dimensions...</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1 truncate ${
                activeTab === "materials"
                  ? `${accentBg} text-zinc-950 font-bold shadow-sm`
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuCheck className="h-3 w-3 shrink-0" />
              <span className="truncate">Materials...</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("physics")}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-1 truncate ${
                activeTab === "physics"
                  ? `${accentBg} text-zinc-950 font-bold shadow-sm`
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              <LuInfo className="h-3 w-3 shrink-0" />
              <span className="truncate">Ratings...</span>
            </button>
          </div>
        </div>

        {/* Compact Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-2.5 space-y-2 thin-scroll text-xs"
        >
          {/* TAB 1: Compound Layers (Wall) */}
          {activeTab === "layers" && formData.category === "Wall" && (
            <div className="space-y-2">
              {/* Type Name */}
              <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Type Name:
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full h-7 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] font-semibold text-[var(--text-strong)] focus:outline-none ${
                    isMep ? "focus:border-sky-400" : "focus:border-yellow-400"
                  }`}
                />
              </div>

              {/* Cross-Section Visualizer */}
              <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Compound Structure ({formData.thicknessMm || 200} mm)
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
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--panel-divider)] text-[10px] font-bold hover:${accentBg} hover:text-zinc-950 transition-all`}
                  >
                    <LuPlus className="h-3 w-3" />
                    <span>Add Layer</span>
                  </button>
                </div>

                {/* Layer Cross-Section Bar */}
                {formData.layers && formData.layers.length > 0 && (
                  <div className="relative flex h-5 w-full overflow-hidden rounded border border-[var(--panel-divider)] p-0.5 gap-0.5 bg-[var(--glass-inset-bg)]">
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
                        className="h-full rounded-sm flex items-center justify-center overflow-hidden text-[8px] font-mono text-zinc-950 font-bold"
                      >
                        {l.thicknessMm >= 25 ? `${l.thicknessMm}` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Compact Layer Rows */}
                <div className="space-y-1 pt-1">
                  {(formData.layers || []).map((layer, idx) => (
                    <div
                      key={layer.id || idx}
                      className="rounded border border-[var(--panel-divider)] p-1.5 space-y-1 bg-[var(--surface-overlay)]/70"
                    >
                      <div className="flex items-center gap-1.5">
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
                          className="h-6 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-1.5 text-[10px] text-[var(--text-strong)] flex-1 min-w-0"
                        >
                          <option value="finish1">Finish 1 (Interior)</option>
                          <option value="substrate">Substrate</option>
                          <option value="structure">Structure Core</option>
                          <option value="core">Core Cavity</option>
                          <option value="insulation">Thermal Insulation</option>
                          <option value="finish2">Finish 2 (Exterior)</option>
                        </select>

                        <div className="flex items-center rounded border border-[var(--panel-divider)] overflow-hidden h-6 bg-[var(--surface-card)]">
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
                            className="px-1.5 h-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
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
                            className={`w-10 bg-transparent text-center font-mono text-[10px] font-bold ${accentColor}`}
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
                            className="px-1.5 h-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                          >
                            +
                          </button>
                          <span className="text-[9px] text-[var(--text-muted)] font-mono pr-1">mm</span>
                        </div>

                        <input
                          type="color"
                          value={layer.color || "#94a3b8"}
                          onChange={(e) => {
                            const updated = (formData.layers || []).map((l, i) =>
                              i === idx ? { ...l, color: e.target.value } : l
                            );
                            setFormData({ ...formData, layers: updated });
                          }}
                          className="h-6 w-6 rounded border border-[var(--panel-divider)] bg-transparent p-0 cursor-pointer shrink-0"
                          title="Layer Poche Color"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.layers || []).filter((_, i) => i !== idx);
                            const total = updated.reduce((s, l) => s + l.thicknessMm, 0);
                            setFormData({ ...formData, layers: updated, thicknessMm: total });
                          }}
                          className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                          title="Remove Layer"
                        >
                          <LuTrash2 className="h-3 w-3" />
                        </button>
                      </div>

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
                        className="w-full h-6 rounded border border-[var(--panel-divider)] bg-[var(--surface-card)] px-2 text-[10px] text-[var(--text-strong)] truncate"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dimensions */}
          {activeTab === "dimensions" && (
            <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
                Dimensional Parameters:
              </div>

              {formData.thicknessMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]" title="Wall / Slab Thickness">
                    Thickness:
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.thicknessMm}
                      disabled={formData.category === "Wall" && Boolean(formData.layers && formData.layers.length > 0)}
                      onChange={(e) => setFormData({ ...formData, thicknessMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.widthMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Width:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.widthMm}
                      onChange={(e) => setFormData({ ...formData, widthMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.heightMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Height:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.heightMm}
                      onChange={(e) => setFormData({ ...formData, heightMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.depthMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Depth:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.depthMm}
                      onChange={(e) => setFormData({ ...formData, depthMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.diameterMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Diameter (Ø):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.diameterMm}
                      onChange={(e) => setFormData({ ...formData, diameterMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.sillHeightMm !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Sill Height:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.sillHeightMm}
                      onChange={(e) => setFormData({ ...formData, sillHeightMm: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">mm</span>
                  </div>
                </div>
              )}

              {formData.powerWatts !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Heating Power:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.powerWatts}
                      onChange={(e) => setFormData({ ...formData, powerWatts: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">W</span>
                  </div>
                </div>
              )}

              {formData.coolingWatts !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Cooling Capacity:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.coolingWatts}
                      onChange={(e) => setFormData({ ...formData, coolingWatts: Number(e.target.value) })}
                      className={`${inputClass} w-20 text-right ${accentColor}`}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">W</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Material & Function */}
          {activeTab === "materials" && (
            <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
                Material & Function:
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-[var(--text-body)] truncate max-w-[120px]">Material:</span>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  className="h-7 w-44 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] text-[var(--text-strong)] truncate text-right"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-[var(--text-body)] truncate max-w-[120px]">Function:</span>
                <select
                  value={formData.functionType}
                  onChange={(e) => setFormData({ ...formData, functionType: e.target.value as any })}
                  className="h-7 min-w-36 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-[11px] text-[var(--text-strong)]"
                >
                  <option value="Interior">Interior</option>
                  <option value="Exterior">Exterior</option>
                  <option value="Structural">Structural</option>
                  <option value="Non-Bearing">Non-Bearing</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: Physics & Ratings */}
          {activeTab === "physics" && (
            <div className="rounded-lg border border-[var(--panel-divider)] p-2 bg-[var(--surface-overlay)]/40 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--panel-divider)]/40">
                Physical Specifications & Ratings:
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Thermal U/K:</span>
                <input
                  type="text"
                  value={formData.thermalConductivity || "0.35 W/mK"}
                  onChange={(e) => setFormData({ ...formData, thermalConductivity: e.target.value })}
                  className="h-7 w-32 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-right font-mono text-[11px] text-[var(--text-strong)] truncate"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-[var(--text-body)] truncate max-w-[140px]">Fire Rating:</span>
                <input
                  type="text"
                  value={formData.fireRating || "F90"}
                  onChange={(e) => setFormData({ ...formData, fireRating: e.target.value })}
                  className="h-7 w-28 rounded border border-[var(--panel-divider)] bg-[var(--surface-overlay)] px-2 text-right font-mono text-[11px] text-[var(--text-strong)] truncate"
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
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
              className={isMep ? "!bg-sky-500 !text-white !border-sky-600" : "!bg-yellow-400 !text-zinc-950 !border-yellow-500"}
            >
              Apply
            </UnifiedButton>
          </div>
        </form>
      </div>
    </div>
  );
}
