"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MATERIAL_DRAG_MIME = "application/x-vstudio-material";

export type HatchStyle =
  | "solid"
  | "horizontal"
  | "vertical"
  | "diagonal"
  | "cross"
  | "grid"
  | "dots"
  | "sand"
  | "earth"
  | "brick"
  | "tile"
  | "checker"
  | "steel"
  | "zigzag"
  | "wood"
  | "concrete"
  | "reinforced-concrete"
  | "insulation"
  | "gypsum"
  | "stone"
  | "timber-cut"
  | "glass"
  | "gravel"
  | "membrane";

export type MaterialPreviewShape = "sphere" | "cube" | "cylinder" | "fabric";

export type MaterialDefinition = {
  id: string;
  name: string;
  category: "Masonry" | "Concrete" | "Wood" | "Glass" | "Metal" | "Roofing" | "Flooring" | "Plastics" | "Fabrics" | "MEP" | "Finishes" | "Custom";
  color: string;
  roughness: number; // 0..1
  metalness: number; // 0..1
  opacity: number; // 0..1
  transmission?: number; // 0..1 (for glass/refraction)
  hatchStyle: HatchStyle;
  hatchScaleMm?: number; // 50..1000, default 200
  tilingScale?: number; // 0.1..10, default 1.0
  bumpScale?: number; // 0..2, default 0.2
  clearcoat?: number; // 0..1
  clearcoatRoughness?: number; // 0..1
  ior?: number; // 1..2.5
  emissive?: string;
  emissiveIntensity?: number; // 0..5
  isPreset?: boolean;
};

export const SEED_MATERIALS: MaterialDefinition[] = [
  // Concrete / Masonry
  {
    id: "concrete",
    name: "Concrete C25/30",
    category: "Concrete",
    color: "#878683",
    roughness: 0.85,
    metalness: 0.05,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "concrete",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "reinforced-concrete",
    name: "Reinforced Concrete (Stahlbeton)",
    category: "Concrete",
    color: "#71717a",
    roughness: 0.88,
    metalness: 0.05,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "reinforced-concrete",
    hatchScaleMm: 180,
    tilingScale: 1.0,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "brick",
    name: "Clay Brick Masonry",
    category: "Masonry",
    color: "#a0522d",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "brick",
    hatchScaleMm: 250,
    tilingScale: 1.0,
    bumpScale: 0.5,
    isPreset: true,
  },
  {
    id: "sandstone",
    name: "Sandstone Ashlar",
    category: "Masonry",
    color: "#d4b996",
    roughness: 0.88,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "stone",
    hatchScaleMm: 300,
    tilingScale: 1.0,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "granite",
    name: "Granite Paving",
    category: "Masonry",
    color: "#475569",
    roughness: 0.6,
    metalness: 0.1,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "tile",
    hatchScaleMm: 150,
    tilingScale: 1.0,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "gravel-bed",
    name: "Drainage Gravel (Kies)",
    category: "Masonry",
    color: "#94a3b8",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "gravel",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.5,
    isPreset: true,
  },

  // Wood
  {
    id: "wood",
    name: "Natural Timber Pine",
    category: "Wood",
    color: "#8b5a2b",
    roughness: 0.7,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "wood",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.25,
    isPreset: true,
  },
  {
    id: "oak-hardwood",
    name: "Oak Hardwood Parquet",
    category: "Wood",
    color: "#b47a45",
    roughness: 0.55,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "diagonal",
    hatchScaleMm: 150,
    tilingScale: 1.2,
    bumpScale: 0.3,
    isPreset: true,
  },
  {
    id: "walnut",
    name: "Dark Walnut Panel",
    category: "Wood",
    color: "#4a3324",
    roughness: 0.6,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "timber-cut",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.2,
    isPreset: true,
  },

  // Insulation & Drywall
  {
    id: "thermal-insulation",
    name: "Mineral Wool Insulation (Dämmung)",
    category: "Finishes",
    color: "#fef08a",
    roughness: 0.98,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "insulation",
    hatchScaleMm: 160,
    tilingScale: 1.0,
    bumpScale: 0.6,
    isPreset: true,
  },
  {
    id: "gypsum-board",
    name: "Gypsum Drywall (Gipskarton)",
    category: "Finishes",
    color: "#f1f5f9",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "gypsum",
    hatchScaleMm: 120,
    tilingScale: 1.0,
    bumpScale: 0.1,
    isPreset: true,
  },

  // Glass
  {
    id: "glass",
    name: "Clear Architectural Glazing",
    category: "Glass",
    color: "#bae6fd",
    roughness: 0.05,
    metalness: 0.1,
    opacity: 0.35,
    transmission: 0.92,
    hatchStyle: "glass",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.0,
    isPreset: true,
  },
  {
    id: "frosted-glass",
    name: "Frosted Privacy Glass",
    category: "Glass",
    color: "#e0f2fe",
    roughness: 0.45,
    metalness: 0.05,
    opacity: 0.65,
    transmission: 0.75,
    hatchStyle: "dots",
    hatchScaleMm: 100,
    tilingScale: 1.0,
    bumpScale: 0.1,
    isPreset: true,
  },
  {
    id: "bronze-glass",
    name: "Tinted Bronze Glass",
    category: "Glass",
    color: "#78350f",
    roughness: 0.08,
    metalness: 0.2,
    opacity: 0.45,
    transmission: 0.85,
    hatchStyle: "diagonal",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.0,
    isPreset: true,
  },

  // Metal
  {
    id: "metal",
    name: "Anodized Aluminium",
    category: "Metal",
    color: "#94a3b8",
    roughness: 0.25,
    metalness: 0.9,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "cross",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.1,
    isPreset: true,
  },
  {
    id: "dark-steel",
    name: "Dark Structural Steel",
    category: "Metal",
    color: "#27272a",
    roughness: 0.35,
    metalness: 0.85,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "steel",
    hatchScaleMm: 150,
    tilingScale: 1.0,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "copper",
    name: "Patinated Copper Cladding",
    category: "Metal",
    color: "#b45309",
    roughness: 0.4,
    metalness: 0.8,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "membrane",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.3,
    isPreset: true,
  },

  // Roofing
  {
    id: "terracotta-roof-tile",
    name: "Clay Roof Tile (Terracotta)",
    category: "Roofing",
    color: "#c2410c",
    roughness: 0.82,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "zigzag",
    hatchScaleMm: 150,
    tilingScale: 1.0,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "slate-roof-tile",
    name: "Anthracite Slate Tile",
    category: "Roofing",
    color: "#334155",
    roughness: 0.65,
    metalness: 0.1,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "tile",
    hatchScaleMm: 180,
    tilingScale: 1.0,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "standing-seam-zinc",
    name: "Standing Seam Zinc Roof",
    category: "Roofing",
    color: "#64748b",
    roughness: 0.35,
    metalness: 0.85,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "vertical",
    hatchScaleMm: 300,
    tilingScale: 1.0,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "flat-roof-bitumen",
    name: "Bituminous Flat Roof Gravel",
    category: "Roofing",
    color: "#475569",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "gravel",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.5,
    isPreset: true,
  },

  // Flooring
  {
    id: "ceramic-floor-tile",
    name: "Porcelain Floor Tile 60x60",
    category: "Flooring",
    color: "#e2e8f0",
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 0.4,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "tile",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.15,
    isPreset: true,
  },
  {
    id: "polished-concrete-floor",
    name: "Industrial Polished Concrete",
    category: "Flooring",
    color: "#94a3b8",
    roughness: 0.22,
    metalness: 0.1,
    clearcoat: 0.5,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "concrete",
    hatchScaleMm: 250,
    tilingScale: 1.0,
    bumpScale: 0.1,
    isPreset: true,
  },
  {
    id: "carrara-marble",
    name: "Carrara White Marble",
    category: "Flooring",
    color: "#f8fafc",
    roughness: 0.15,
    metalness: 0.05,
    clearcoat: 0.7,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "grid",
    hatchScaleMm: 300,
    tilingScale: 1.0,
    bumpScale: 0.08,
    isPreset: true,
  },
  {
    id: "acoustic-carpet",
    name: "Acoustic Carpet Tile",
    category: "Flooring",
    color: "#64748b",
    roughness: 0.98,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "checker",
    hatchScaleMm: 120,
    tilingScale: 1.0,
    bumpScale: 0.4,
    isPreset: true,
  },

  // Plastics & Polymers
  {
    id: "abs-plastic-matte",
    name: "Matte ABS Engineering Plastic",
    category: "Plastics",
    color: "#475569",
    roughness: 0.65,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "acrylic-gloss-blue",
    name: "High-Gloss Color Acrylic",
    category: "Plastics",
    color: "#0284c7",
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.85,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "polycarbonate-sheet",
    name: "Translucent Polycarbonate",
    category: "Plastics",
    color: "#e0f2fe",
    roughness: 0.28,
    metalness: 0.05,
    opacity: 0.65,
    transmission: 0.75,
    hatchStyle: "diagonal",
    hatchScaleMm: 80,
    isPreset: true,
  },

  // Fabrics & Textiles
  {
    id: "acoustic-linen-fabric",
    name: "Acoustic Linen Wall Fabric",
    category: "Fabrics",
    color: "#d6d3d1",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "cross",
    hatchScaleMm: 60,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "charcoal-upholstery",
    name: "Charcoal Woven Upholstery",
    category: "Fabrics",
    color: "#27272a",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "checker",
    hatchScaleMm: 60,
    bumpScale: 0.4,
    isPreset: true,
  },

  // MEP Components & Systems
  {
    id: "galvanized-duct-steel",
    name: "Galvanized Sheet Steel (Ducts)",
    category: "MEP",
    color: "#94a3b8",
    roughness: 0.28,
    metalness: 0.85,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "cross",
    hatchScaleMm: 150,
    bumpScale: 0.15,
    isPreset: true,
  },
  {
    id: "aluminum-flex-duct",
    name: "Flexible Aluminum Air Duct",
    category: "MEP",
    color: "#cbd5e1",
    roughness: 0.35,
    metalness: 0.9,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "zigzag",
    hatchScaleMm: 80,
    bumpScale: 0.3,
    isPreset: true,
  },
  {
    id: "copper-water-pipe",
    name: "Polished Copper Pipe",
    category: "MEP",
    color: "#b45309",
    roughness: 0.22,
    metalness: 0.92,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "pex-pipe-cold",
    name: "PEX Cold Water Pipe (Blue)",
    category: "MEP",
    color: "#2563eb",
    roughness: 0.38,
    metalness: 0.05,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "pex-pipe-hot",
    name: "PEX Hot Water Pipe (Red)",
    category: "MEP",
    color: "#dc2626",
    roughness: 0.38,
    metalness: 0.05,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "pvc-drainage-pipe",
    name: "PVC Sanitary Waste Pipe (Gray)",
    category: "MEP",
    color: "#64748b",
    roughness: 0.48,
    metalness: 0.05,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "pvc-cable-sheath",
    name: "PVC Electrical Cable Sheath",
    category: "MEP",
    color: "#18181b",
    roughness: 0.6,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "sanitary-porcelain",
    name: "Vitreous China Porcelain (WC/Sink)",
    category: "MEP",
    color: "#ffffff",
    roughness: 0.1,
    metalness: 0.04,
    clearcoat: 0.85,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "chrome-polished",
    name: "Mirror Chrome Fitting (Faucet)",
    category: "MEP",
    color: "#f1f5f9",
    roughness: 0.04,
    metalness: 0.98,
    clearcoat: 0.95,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },
  {
    id: "brass-valve-fitting",
    name: "Machined Yellow Brass Valve",
    category: "MEP",
    color: "#d97706",
    roughness: 0.25,
    metalness: 0.88,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 100,
    isPreset: true,
  },

  // Finishes / Plaster
  {
    id: "plaster",
    name: "Smooth White Plaster",
    category: "Finishes",
    color: "#f8fafc",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "sand",
    hatchScaleMm: 150,
    tilingScale: 1.0,
    bumpScale: 0.1,
    isPreset: true,
  },
  {
    id: "stucco",
    name: "Warm Gray Stucco",
    category: "Finishes",
    color: "#e2e8f0",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "dots",
    hatchScaleMm: 120,
    tilingScale: 1.0,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "charcoal-paint",
    name: "Charcoal Matte Paint",
    category: "Finishes",
    color: "#18181b",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "solid",
    hatchScaleMm: 200,
    tilingScale: 1.0,
    bumpScale: 0.05,
    isPreset: true,
  },
];

type MaterialState = {
  materials: MaterialDefinition[];
  selectedMaterialId: string | null;
  editorOpen: boolean;
  editingMaterial: MaterialDefinition | null;
  paintMaterialId: string | null;

  // Actions
  setSelectedMaterialId: (id: string | null) => void;
  setEditorOpen: (open: boolean) => void;
  setEditingMaterial: (mat: MaterialDefinition | null) => void;
  setPaintMaterialId: (id: string | null) => void;
  addMaterial: (mat: Omit<MaterialDefinition, "id">) => MaterialDefinition;
  updateMaterial: (id: string, updates: Partial<MaterialDefinition>) => void;
  deleteMaterial: (id: string) => void;
  getMaterial: (idOrName?: string) => MaterialDefinition | null;
};

export const useMaterialStore = create<MaterialState>()(
  persist(
    (set, get) => ({
      materials: SEED_MATERIALS,
      selectedMaterialId: "concrete",
      editorOpen: false,
      editingMaterial: null,
      paintMaterialId: null,

      setSelectedMaterialId: (id) => set({ selectedMaterialId: id }),
      setEditorOpen: (open) => set({ editorOpen: open }),
      setEditingMaterial: (mat) => set({ editingMaterial: mat }),
      setPaintMaterialId: (id) => set({ paintMaterialId: id }),

      addMaterial: (mat) => {
        const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newMat: MaterialDefinition = { ...mat, id, isPreset: false };
        set((state) => ({
          materials: [...state.materials, newMat],
          selectedMaterialId: id,
        }));
        return newMat;
      },

      updateMaterial: (id, updates) => {
        set((state) => ({
          materials: state.materials.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      deleteMaterial: (id) => {
        set((state) => ({
          materials: state.materials.filter((m) => m.id !== id || m.isPreset),
          selectedMaterialId:
            state.selectedMaterialId === id ? "concrete" : state.selectedMaterialId,
        }));
      },

      getMaterial: (idOrName) => {
        if (!idOrName) return null;
        const state = get();
        const found = state.materials.find(
          (m) =>
            m.id.toLowerCase() === idOrName.toLowerCase() ||
            m.name.toLowerCase() === idOrName.toLowerCase()
        );
        return found ?? null;
      },
    }),
    {
      name: "vstudio-materials-storage",
      partialize: (state) => ({
        materials: state.materials,
      }),
    }
  )
);
