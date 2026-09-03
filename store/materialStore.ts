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
  | "subway-tile"
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
  | "membrane"
  // High-End Architectural Patterns
  | "herringbone"
  | "chevron"
  | "hex-tile"
  | "terrazzo"
  | "marble"
  | "fluted-wood"
  | "acoustic-slat"
  | "perforated-metal"
  | "expanded-mesh"
  | "diamond-plate"
  | "basketweave"
  | "reeded-glass"
  | "standing-seam"
  | "stucco"
  | "granite"
  | "fish-scale"
  | "penny-round";

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
  // ==========================================
  // 0. HIGH-END ARCHITECTURAL & INTERIOR SPEC
  // ==========================================
  {
    id: "marble-calacatta-gold",
    name: "Italian Calacatta Gold Marble",
    category: "Masonry",
    color: "#f8fafc",
    roughness: 0.15,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    ior: 1.55,
    opacity: 1.0,
    hatchStyle: "marble",
    hatchScaleMm: 400,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "marble-nero-marquina",
    name: "Nero Marquina Black Marble",
    category: "Masonry",
    color: "#18181b",
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    ior: 1.56,
    opacity: 1.0,
    hatchStyle: "marble",
    hatchScaleMm: 350,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "terrazzo-venetian-white",
    name: "Venetian Micro-Terrazzo (Bianco)",
    category: "Flooring",
    color: "#f1f5f9",
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.8,
    opacity: 1.0,
    hatchStyle: "terrazzo",
    hatchScaleMm: 240,
    bumpScale: 0.25,
    isPreset: true,
  },
  {
    id: "parquet-french-herringbone",
    name: "French Oak Herringbone Parquet",
    category: "Wood",
    color: "#c29b68",
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.25,
    opacity: 1.0,
    hatchStyle: "herringbone",
    hatchScaleMm: 180,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "parquet-smoked-chevron",
    name: "Smoked Walnut Chevron Parquet",
    category: "Wood",
    color: "#5c4033",
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.3,
    opacity: 1.0,
    hatchStyle: "chevron",
    hatchScaleMm: 200,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "tile-hex-mosaic-carrara",
    name: "Carrara Hexagonal Honeycomb Tile",
    category: "Finishes",
    color: "#e2e8f0",
    roughness: 0.25,
    metalness: 0.02,
    clearcoat: 0.65,
    opacity: 1.0,
    hatchStyle: "hex-tile",
    hatchScaleMm: 120,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "tile-subway-artisan",
    name: "Artisan Handcrafted Subway Tile",
    category: "Finishes",
    color: "#f8fafc",
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.85,
    opacity: 1.0,
    hatchStyle: "subway-tile",
    hatchScaleMm: 150,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "acoustic-wood-slat-panel",
    name: "Fluted Oak Acoustic Slat Panel",
    category: "Wood",
    color: "#b4824d",
    roughness: 0.65,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "acoustic-slat",
    hatchScaleMm: 140,
    bumpScale: 0.6,
    isPreset: true,
  },
  {
    id: "facade-perforated-bronze",
    name: "Architectural Perforated Bronze Panel",
    category: "Metal",
    color: "#a16207",
    roughness: 0.32,
    metalness: 0.88,
    opacity: 1.0,
    hatchStyle: "perforated-metal",
    hatchScaleMm: 90,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "facade-standing-seam-zinc",
    name: "Anthracite Standing Seam Zinc",
    category: "Roofing",
    color: "#334155",
    roughness: 0.45,
    metalness: 0.65,
    opacity: 1.0,
    hatchStyle: "standing-seam",
    hatchScaleMm: 300,
    bumpScale: 0.5,
    isPreset: true,
  },
  {
    id: "glass-fluted-reeded",
    name: "Architectural Reeded / Fluted Glass",
    category: "Glass",
    color: "#e2e8f0",
    roughness: 0.1,
    metalness: 0.05,
    opacity: 0.55,
    transmission: 0.88,
    ior: 1.52,
    hatchStyle: "reeded-glass",
    hatchScaleMm: 80,
    bumpScale: 0.55,
    isPreset: true,
  },
  {
    id: "metal-expanded-diamond-mesh",
    name: "Expanded Steel Diamond Mesh",
    category: "Metal",
    color: "#27272a",
    roughness: 0.5,
    metalness: 0.85,
    opacity: 1.0,
    hatchStyle: "expanded-mesh",
    hatchScaleMm: 100,
    bumpScale: 0.5,
    isPreset: true,
  },
  {
    id: "tile-fish-scale-emerald",
    name: "Emerald Scallop / Fish Scale Tile",
    category: "Finishes",
    color: "#065f46",
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 0.9,
    opacity: 1.0,
    hatchStyle: "fish-scale",
    hatchScaleMm: 130,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "plaster-stucco-mediterranean",
    name: "Fine Mediterranean Scraped Stucco",
    category: "Finishes",
    color: "#fef3c7",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "stucco",
    hatchScaleMm: 160,
    bumpScale: 0.4,
    isPreset: true,
  },

  // ==========================================
  // 1. MASONRY & STONE
  // ==========================================
  {
    id: "brick",
    name: "Clay Brick Masonry (Running Bond)",
    category: "Masonry",
    color: "#9f4325",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "brick",
    hatchScaleMm: 250,
    bumpScale: 0.5,
    isPreset: true,
  },
  {
    id: "brick-clinker-dark",
    name: "Dark Charcoal Clinker Brick",
    category: "Masonry",
    color: "#292524",
    roughness: 0.85,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "brick",
    hatchScaleMm: 220,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "brick-whitewashed",
    name: "Whitewashed Brick Façade",
    category: "Masonry",
    color: "#f5f5f4",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "brick",
    hatchScaleMm: 250,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "cmu-concrete-block",
    name: "Concrete Masonry Unit (CMU Block)",
    category: "Masonry",
    color: "#78716c",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "grid",
    hatchScaleMm: 300,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "sandstone",
    name: "Sandstone Ashlar Blocks",
    category: "Masonry",
    color: "#d4b996",
    roughness: 0.88,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "stone",
    hatchScaleMm: 300,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "granite",
    name: "Flamed Grey Granite",
    category: "Masonry",
    color: "#475569",
    roughness: 0.65,
    metalness: 0.1,
    opacity: 1.0,
    hatchStyle: "stone",
    hatchScaleMm: 200,
    bumpScale: 0.3,
    isPreset: true,
  },
  {
    id: "stone-travertine-honed",
    name: "Honed Roman Travertine (No Pattern)",
    category: "Masonry",
    color: "#e2d7c5",
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.2,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "stone-limestone-beige",
    name: "Jura Limestone Matte (No Pattern)",
    category: "Masonry",
    color: "#ebdcc9",
    roughness: 0.6,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "stone-basalt-honed",
    name: "Honed Volcanic Basalt (No Pattern)",
    category: "Masonry",
    color: "#272a30",
    roughness: 0.55,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },

  // ==========================================
  // 2. CONCRETE & PRECAST
  // ==========================================
  {
    id: "concrete",
    name: "Concrete C25/30 (Cast-In-Place)",
    category: "Concrete",
    color: "#8e9196",
    roughness: 0.85,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "concrete",
    hatchScaleMm: 200,
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
    hatchStyle: "reinforced-concrete",
    hatchScaleMm: 180,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "concrete-board-formed",
    name: "Board-Formed Timber Concrete",
    category: "Concrete",
    color: "#787672",
    roughness: 0.8,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "wood",
    hatchScaleMm: 150,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "concrete-smooth-precast",
    name: "Architectural Precast Concrete (No Pattern)",
    category: "Concrete",
    color: "#b8b9ba",
    roughness: 0.6,
    metalness: 0.02,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "concrete-white-architectural",
    name: "Smooth White Concrete (No Pattern)",
    category: "Concrete",
    color: "#f1f1ee",
    roughness: 0.5,
    metalness: 0.02,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "concrete-dark-anthracite",
    name: "Pigmented Anthracite Concrete (No Pattern)",
    category: "Concrete",
    color: "#383a40",
    roughness: 0.65,
    metalness: 0.02,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },

  // ==========================================
  // 3. WOOD & TIMBER
  // ==========================================
  {
    id: "wood",
    name: "Natural Pine Timber",
    category: "Wood",
    color: "#b4824d",
    roughness: 0.7,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "wood",
    hatchScaleMm: 200,
    bumpScale: 0.25,
    isPreset: true,
  },
  {
    id: "oak-hardwood",
    name: "White Oak Parquet",
    category: "Wood",
    color: "#ba8b57",
    roughness: 0.55,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "diagonal",
    hatchScaleMm: 150,
    bumpScale: 0.3,
    isPreset: true,
  },
  {
    id: "walnut",
    name: "American Dark Walnut",
    category: "Wood",
    color: "#4a3324",
    roughness: 0.6,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "wood",
    hatchScaleMm: 200,
    bumpScale: 0.2,
    isPreset: true,
  },
  {
    id: "wood-teak-decking",
    name: "Exterior Teak Slat Decking",
    category: "Wood",
    color: "#8a5833",
    roughness: 0.65,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "vertical",
    hatchScaleMm: 120,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "wood-birch-plywood",
    name: "Scandinavian Birch Plywood (No Pattern)",
    category: "Wood",
    color: "#e5d3b6",
    roughness: 0.45,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "wood-painted-white-satin",
    name: "Satin White Painted Wood (No Pattern)",
    category: "Wood",
    color: "#fcfcfc",
    roughness: 0.25,
    metalness: 0.0,
    clearcoat: 0.35,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "wood-painted-black-matte",
    name: "Matte Black Stained Timber (No Pattern)",
    category: "Wood",
    color: "#1c1c1e",
    roughness: 0.65,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },

  // ==========================================
  // 4. METALS & FAÇADE
  // ==========================================
  {
    id: "metal",
    name: "Anodized Silver Aluminium (No Pattern)",
    category: "Metal",
    color: "#c2c7cf",
    roughness: 0.25,
    metalness: 0.9,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "metal-powder-coated-anthracite",
    name: "Powder-Coated Anthracite RAL 7016 (No Pattern)",
    category: "Metal",
    color: "#2b303a",
    roughness: 0.45,
    metalness: 0.3,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "metal-powder-coated-white",
    name: "Powder-Coated White RAL 9016 (No Pattern)",
    category: "Metal",
    color: "#f8fafc",
    roughness: 0.2,
    metalness: 0.1,
    clearcoat: 0.5,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "dark-steel",
    name: "Structural Dark Steel",
    category: "Metal",
    color: "#27272a",
    roughness: 0.35,
    metalness: 0.85,
    opacity: 1.0,
    hatchStyle: "steel",
    hatchScaleMm: 150,
    isPreset: true,
  },
  {
    id: "metal-stainless-brushed",
    name: "Brushed Stainless Steel AISI 304",
    category: "Metal",
    color: "#cbd5e1",
    roughness: 0.28,
    metalness: 0.92,
    opacity: 1.0,
    hatchStyle: "horizontal",
    hatchScaleMm: 80,
    isPreset: true,
  },
  {
    id: "metal-chrome-mirror",
    name: "Mirror Polished Chrome (No Pattern)",
    category: "Metal",
    color: "#f8fafc",
    roughness: 0.02,
    metalness: 0.98,
    clearcoat: 0.98,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "metal-brass-satin",
    name: "Architectural Satin Brass (No Pattern)",
    category: "Metal",
    color: "#d4af37",
    roughness: 0.22,
    metalness: 0.88,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "copper",
    name: "Corten Weathering Steel",
    category: "Metal",
    color: "#94461c",
    roughness: 0.82,
    metalness: 0.35,
    opacity: 1.0,
    hatchStyle: "sand",
    hatchScaleMm: 180,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "metal-expanded-grille",
    name: "Expanded Metal Façade Mesh",
    category: "Metal",
    color: "#475569",
    roughness: 0.4,
    metalness: 0.85,
    opacity: 1.0,
    hatchStyle: "cross",
    hatchScaleMm: 100,
    isPreset: true,
  },

  // ==========================================
  // 5. GLASS & GLAZING
  // ==========================================
  {
    id: "glass",
    name: "Clear Architectural Double Glazing (No Pattern)",
    category: "Glass",
    color: "#c8e8f5",
    roughness: 0.03,
    metalness: 0.08,
    opacity: 0.35,
    transmission: 0.95,
    clearcoat: 1.0,
    ior: 1.52,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "glass-low-iron-starphire",
    name: "Ultra-Clear Low-Iron Glass (No Pattern)",
    category: "Glass",
    color: "#f0f9ff",
    roughness: 0.01,
    metalness: 0.05,
    opacity: 0.25,
    transmission: 0.98,
    clearcoat: 1.0,
    ior: 1.52,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "glass-solar-grey-tint",
    name: "Solar Control Grey Glass (No Pattern)",
    category: "Glass",
    color: "#334155",
    roughness: 0.05,
    metalness: 0.15,
    opacity: 0.55,
    transmission: 0.7,
    clearcoat: 1.0,
    ior: 1.54,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "frosted-glass",
    name: "Satinato Acid-Etched Frosted Glass (No Pattern)",
    category: "Glass",
    color: "#e0f2fe",
    roughness: 0.42,
    metalness: 0.05,
    opacity: 0.65,
    transmission: 0.8,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "glass-fluted-reeded",
    name: "Fluted / Reeded Ribbed Glass",
    category: "Glass",
    color: "#dbeafe",
    roughness: 0.15,
    metalness: 0.08,
    opacity: 0.5,
    transmission: 0.88,
    hatchStyle: "vertical",
    hatchScaleMm: 60,
    isPreset: true,
  },

  // ==========================================
  // 6. ROOFING
  // ==========================================
  {
    id: "terracotta-roof-tile",
    name: "Clay Roof Tile (Terracotta)",
    category: "Roofing",
    color: "#c2410c",
    roughness: 0.82,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "zigzag",
    hatchScaleMm: 150,
    bumpScale: 0.45,
    isPreset: true,
  },
  {
    id: "slate-roof-tile",
    name: "Anthracite Natural Slate Tile",
    category: "Roofing",
    color: "#334155",
    roughness: 0.65,
    metalness: 0.1,
    opacity: 1.0,
    hatchStyle: "tile",
    hatchScaleMm: 180,
    bumpScale: 0.35,
    isPreset: true,
  },
  {
    id: "standing-seam-zinc",
    name: "Standing Seam Titanium Zinc Roof",
    category: "Roofing",
    color: "#64748b",
    roughness: 0.35,
    metalness: 0.85,
    opacity: 1.0,
    hatchStyle: "vertical",
    hatchScaleMm: 300,
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
    hatchStyle: "gravel",
    hatchScaleMm: 200,
    bumpScale: 0.5,
    isPreset: true,
  },
  {
    id: "roof-epdm-membrane-black",
    name: "EPDM Waterproofing Membrane (No Pattern)",
    category: "Roofing",
    color: "#18181b",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },

  // ==========================================
  // 7. FLOORING
  // ==========================================
  {
    id: "ceramic-floor-tile",
    name: "Porcelain Floor Tile 60x60",
    category: "Flooring",
    color: "#e2e8f0",
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 0.4,
    opacity: 1.0,
    hatchStyle: "tile",
    hatchScaleMm: 200,
    bumpScale: 0.15,
    isPreset: true,
  },
  {
    id: "floor-terrazzo-venetian",
    name: "Venetian Terrazzo Aggregate",
    category: "Flooring",
    color: "#d6d3d1",
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.5,
    opacity: 1.0,
    hatchStyle: "dots",
    hatchScaleMm: 100,
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
    hatchStyle: "grid",
    hatchScaleMm: 300,
    bumpScale: 0.08,
    isPreset: true,
  },
  {
    id: "polished-concrete-floor",
    name: "Seamless Polished Concrete Floor (No Pattern)",
    category: "Flooring",
    color: "#94a3b8",
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 0.6,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "floor-epoxy-white-gloss",
    name: "Seamless White Gloss Epoxy Resin (No Pattern)",
    category: "Flooring",
    color: "#ffffff",
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 0.9,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "acoustic-carpet",
    name: "Commercial Acoustic Carpet Tile",
    category: "Flooring",
    color: "#475569",
    roughness: 0.98,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "checker",
    hatchScaleMm: 120,
    bumpScale: 0.4,
    isPreset: true,
  },

  // ==========================================
  // 8. PLASTICS & POLYMERS
  // ==========================================
  {
    id: "abs-plastic-matte",
    name: "Matte ABS Engineering Plastic (No Pattern)",
    category: "Plastics",
    color: "#475569",
    roughness: 0.65,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "acrylic-gloss-blue",
    name: "High-Gloss Color Acrylic (No Pattern)",
    category: "Plastics",
    color: "#0284c7",
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.85,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "polycarbonate-sheet",
    name: "Translucent Polycarbonate Canopy",
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

  // ==========================================
  // 9. FABRICS & ACOUSTICS
  // ==========================================
  {
    id: "acoustic-linen-fabric",
    name: "Acoustic Linen Wall Fabric",
    category: "Fabrics",
    color: "#d6d3d1",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
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
    hatchStyle: "checker",
    hatchScaleMm: 60,
    bumpScale: 0.4,
    isPreset: true,
  },
  {
    id: "fabric-curtain-sheer",
    name: "Voile Sheer White Curtain (No Pattern)",
    category: "Fabrics",
    color: "#ffffff",
    roughness: 0.9,
    metalness: 0.0,
    opacity: 0.45,
    transmission: 0.55,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "fabric-leather-saddle-tan",
    name: "Architectural Saddle Leather (No Pattern)",
    category: "Fabrics",
    color: "#8c4b22",
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.25,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },

  // ==========================================
  // 10. FINISHES & INSULATION
  // ==========================================
  {
    id: "plaster",
    name: "Smooth White Interior Plaster (No Pattern)",
    category: "Finishes",
    color: "#f8fafc",
    roughness: 0.95,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "stucco",
    name: "Textured Exterior Stucco Render",
    category: "Finishes",
    color: "#e2e8f0",
    roughness: 0.92,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "sand",
    hatchScaleMm: 120,
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
    hatchStyle: "gypsum",
    hatchScaleMm: 120,
    isPreset: true,
  },
  {
    id: "thermal-insulation",
    name: "Mineral Wool Insulation (Dämmung)",
    category: "Finishes",
    color: "#fef08a",
    roughness: 0.98,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "insulation",
    hatchScaleMm: 160,
    bumpScale: 0.6,
    isPreset: true,
  },

  // ==========================================
  // 11. MEP, HVAC & SANITARY
  // ==========================================
  {
    id: "galvanized-duct-steel",
    name: "Galvanized Sheet Steel (Ductwork)",
    category: "MEP",
    color: "#94a3b8",
    roughness: 0.28,
    metalness: 0.85,
    opacity: 1.0,
    hatchStyle: "cross",
    hatchScaleMm: 150,
    bumpScale: 0.15,
    isPreset: true,
  },
  {
    id: "aluminum-flex-duct",
    name: "Corrugated Flexible Aluminum Duct",
    category: "MEP",
    color: "#cbd5e1",
    roughness: 0.35,
    metalness: 0.9,
    opacity: 1.0,
    hatchStyle: "zigzag",
    hatchScaleMm: 80,
    bumpScale: 0.3,
    isPreset: true,
  },
  {
    id: "copper-water-pipe",
    name: "Polished Copper Potable Pipe (No Pattern)",
    category: "MEP",
    color: "#b8682e",
    roughness: 0.18,
    metalness: 0.94,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "pex-pipe-cold",
    name: "PEX Cold Potable Pipe - Blue (No Pattern)",
    category: "MEP",
    color: "#2563eb",
    roughness: 0.38,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "pex-pipe-hot",
    name: "PEX Heating Pipe - Red (No Pattern)",
    category: "MEP",
    color: "#dc2626",
    roughness: 0.38,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "pvc-drainage-pipe",
    name: "PVC Sanitary Soil & Waste Pipe (No Pattern)",
    category: "MEP",
    color: "#64748b",
    roughness: 0.48,
    metalness: 0.05,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "pvc-cable-sheath",
    name: "PVC Electrical Cable Sheath (No Pattern)",
    category: "MEP",
    color: "#18181b",
    roughness: 0.6,
    metalness: 0.0,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "sanitary-porcelain",
    name: "Vitreous China Gloss Porcelain (No Pattern)",
    category: "MEP",
    color: "#ffffff",
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 0.9,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "chrome-polished",
    name: "Mirror Chrome Faucet Fixture (No Pattern)",
    category: "MEP",
    color: "#f1f5f9",
    roughness: 0.03,
    metalness: 0.98,
    clearcoat: 0.98,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "brass-valve-fitting",
    name: "Machined Yellow Brass Valve (No Pattern)",
    category: "MEP",
    color: "#d97706",
    roughness: 0.25,
    metalness: 0.88,
    opacity: 1.0,
    hatchStyle: "solid",
    isPreset: true,
  },
  {
    id: "mep-radiator-powder-white",
    name: "Powder-Coated White Radiator (No Pattern)",
    category: "MEP",
    color: "#f8fafc",
    roughness: 0.35,
    metalness: 0.1,
    clearcoat: 0.3,
    opacity: 1.0,
    hatchStyle: "solid",
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
        const found =
          state.materials.find(
            (m) =>
              m.id.toLowerCase() === idOrName.toLowerCase() ||
              m.name.toLowerCase() === idOrName.toLowerCase()
          ) ??
          SEED_MATERIALS.find(
            (m) =>
              m.id.toLowerCase() === idOrName.toLowerCase() ||
              m.name.toLowerCase() === idOrName.toLowerCase()
          );
        return found ?? null;
      },
    }),
    {
      name: "vstudio-materials-storage-v2",
      partialize: (state) => ({
        materials: state.materials,
      }),
    }
  )
);
