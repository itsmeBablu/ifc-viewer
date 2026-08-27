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
  category: "Masonry" | "Concrete" | "Wood" | "Glass" | "Metal" | "Finishes" | "Custom";
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
