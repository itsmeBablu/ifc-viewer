"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HatchStyle =
  | "solid"
  | "diagonal"
  | "cross"
  | "dots"
  | "brick"
  | "zigzag"
  | "wood"
  | "concrete";

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
  isPreset?: boolean;
};

export const SEED_MATERIALS: MaterialDefinition[] = [
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
    isPreset: true,
  },
  {
    id: "brick",
    name: "Clay Brick Coursing",
    category: "Masonry",
    color: "#a0522d",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "brick",
    isPreset: true,
  },
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
    isPreset: true,
  },
  {
    id: "glass",
    name: "Clear Architectural Glazing",
    category: "Glass",
    color: "#bae6fd",
    roughness: 0.08,
    metalness: 0.1,
    opacity: 0.35,
    transmission: 0.92,
    hatchStyle: "diagonal",
    isPreset: true,
  },
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
    isPreset: true,
  },
  {
    id: "plaster",
    name: "Smooth White Plaster",
    category: "Finishes",
    color: "#f8fafc",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    transmission: 0.0,
    hatchStyle: "dots",
    isPreset: true,
  },
];

type MaterialState = {
  materials: MaterialDefinition[];
  selectedMaterialId: string | null;
  editorOpen: boolean;
  editingMaterial: MaterialDefinition | null;

  // Actions
  setSelectedMaterialId: (id: string | null) => void;
  setEditorOpen: (open: boolean) => void;
  setEditingMaterial: (mat: MaterialDefinition | null) => void;
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

      setSelectedMaterialId: (id) => set({ selectedMaterialId: id }),
      setEditorOpen: (open) => set({ editorOpen: open }),
      setEditingMaterial: (mat) => set({ editingMaterial: mat }),

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
