import * as THREE from "three";
import type { HatchStyle } from "@/store/materialStore";

const textureCache = new Map<string, THREE.CanvasTexture>();
const svgUriCache = new Map<string, string>();

export interface HatchPresetMeta {
  id: HatchStyle;
  label: string;
  category: "Parquet & Wood" | "Tiles & Masonry" | "Metals & Facades" | "Stone & Terrazzo" | "Acoustics & Glass" | "Standard CAD";
  glyph: string;
  description: string;
}

export const HATCH_PRESETS_METADATA: HatchPresetMeta[] = [
  // Parquet & Wood
  { id: "herringbone", label: "French Herringbone", category: "Parquet & Wood", glyph: "⫽", description: "Classic 90° interlocking parquet boards" },
  { id: "chevron", label: "Chevron Parquet", category: "Parquet & Wood", glyph: "≫", description: "45° mitered continuous chevron planks" },
  { id: "wood", label: "Wood Grain", category: "Parquet & Wood", glyph: "≋", description: "Natural undulating timber grain" },
  { id: "timber-cut", label: "Timber End-Grain", category: "Parquet & Wood", glyph: "◎", description: "Annual growth rings & medullary rays" },
  { id: "basketweave", label: "Basketweave Parquet", category: "Parquet & Wood", glyph: "▦", description: "Woven orthogonal multi-slat blocks" },

  // Tiles & Masonry
  { id: "brick", label: "Running Bond Brick", category: "Tiles & Masonry", glyph: "▤", description: "Standard architectural staggered brickwork" },
  { id: "subway-tile", label: "Beveled Subway Tile", category: "Tiles & Masonry", glyph: "▭", description: "Offset glazed tiles with 3D perimeter bevels" },
  { id: "hex-tile", label: "Hexagonal Honeycomb", category: "Tiles & Masonry", glyph: "⬡", description: "Tessellated geometric porcelain hexagons" },
  { id: "fish-scale", label: "Fish Scale / Scallop", category: "Tiles & Masonry", glyph: "⌒", description: "Art Deco overlapping scallop fan tiles" },
  { id: "penny-round", label: "Penny Round Mosaic", category: "Tiles & Masonry", glyph: "◍", description: "Circular ceramic mosaic tiles with grout matrix" },
  { id: "tile", label: "Ceramic Grid Tile", category: "Tiles & Masonry", glyph: "▦", description: "Square porcelain floor & wall tiles" },
  { id: "checker", label: "Checker Plate / Tile", category: "Tiles & Masonry", glyph: "▩", description: "Alternating contrast checkerboard" },

  // Stone & Terrazzo
  { id: "marble", label: "Calacatta Marble Veining", category: "Stone & Terrazzo", glyph: "⌇", description: "Organic branching natural marble veins" },
  { id: "terrazzo", label: "Venetian Terrazzo", category: "Stone & Terrazzo", glyph: "❖", description: "Embedded multi-tonal marble & quartz chips" },
  { id: "granite", label: "Crystalline Granite", category: "Stone & Terrazzo", glyph: "⁘", description: "Multi-tonal crystalline mineral flecks" },
  { id: "stone", label: "Ashlar Stone Blocks", category: "Stone & Terrazzo", glyph: "▨", description: "Irregular dimensional masonry blocks" },
  { id: "concrete", label: "Cast Concrete Aggregate", category: "Stone & Terrazzo", glyph: "∴", description: "Stippled concrete matrix with coarse aggregate" },
  { id: "reinforced-concrete", label: "Reinforced Concrete", category: "Stone & Terrazzo", glyph: "⁜", description: "Aggregate matrix with rebar crosshatch" },
  { id: "stucco", label: "Scraped Stucco Render", category: "Stone & Terrazzo", glyph: "∷", description: "Fine Mediterranean plaster stipple" },

  // Metals & Facades
  { id: "perforated-metal", label: "Perforated Metal Panel", category: "Metals & Facades", glyph: "◌", description: "Staggered circular laser-cut perforations" },
  { id: "expanded-mesh", label: "Expanded Diamond Mesh", category: "Metals & Facades", glyph: "◇", description: "Diamond architectural steel lattice" },
  { id: "diamond-plate", label: "Industrial Diamond Plate", category: "Metals & Facades", glyph: "⬗", description: "Embossed raised dual-tread lozenges" },
  { id: "standing-seam", label: "Standing Seam Metal", category: "Metals & Facades", glyph: "║", description: "Vertical zinc / copper architectural seams" },
  { id: "steel", label: "Structural Steel Section", category: "Metals & Facades", glyph: "╳", description: "Standard 45° structural crosshatch" },

  // Acoustics & Glass
  { id: "acoustic-slat", label: "Acoustic Wood Slat", category: "Acoustics & Glass", glyph: "⫼", description: "Precision timber slats with acoustic felt gaps" },
  { id: "fluted-wood", label: "Fluted Wood Ribs", category: "Acoustics & Glass", glyph: "⫽", description: "3D vertical fluted acoustic wall paneling" },
  { id: "reeded-glass", label: "Reeded / Fluted Glass", category: "Acoustics & Glass", glyph: "⌇", description: "Semi-cylindrical vertical privacy reeds" },
  { id: "glass", label: "Architectural Glass Glaze", category: "Acoustics & Glass", glyph: "⧉", description: "Triple reflection glint diagonals" },
  { id: "insulation", label: "Batt Thermal Insulation", category: "Acoustics & Glass", glyph: "〽", description: "Architectural S-wave batting loops" },
  { id: "zigzag", label: "Accordion Insulation", category: "Acoustics & Glass", glyph: "⚡", description: "Rigid insulation zigzag pattern" },

  // Standard CAD
  { id: "solid", label: "Solid Color", category: "Standard CAD", glyph: "■", description: "Flat tone without pattern" },
  { id: "horizontal", label: "Horizontal Lines", category: "Standard CAD", glyph: "≡", description: "Uniform horizontal drafting lines" },
  { id: "vertical", label: "Vertical Lines", category: "Standard CAD", glyph: "|||", description: "Uniform vertical drafting lines" },
  { id: "diagonal", label: "Diagonal 45°", category: "Standard CAD", glyph: "///", description: "Single 45° drafting crosshatch" },
  { id: "cross", label: "Diagonal Cross 45°", category: "Standard CAD", glyph: "XXX", description: "Double 45° crosshatch" },
  { id: "grid", label: "Square Grid", category: "Standard CAD", glyph: "▦", description: "Orthogonal drafting grid" },
  { id: "dots", label: "Regular Dot Grid", category: "Standard CAD", glyph: "⠿", description: "Precision dot matrix" },
  { id: "sand", label: "Sand / Granular Fill", category: "Standard CAD", glyph: "⠂", description: "Fine granular stipple" },
  { id: "earth", label: "Earth / Soil Strata", category: "Standard CAD", glyph: "≋", description: "Compacted earth 3-line clusters" },
  { id: "gravel", label: "Gravel / River Stones", category: "Standard CAD", glyph: "⬡", description: "Rounded pebble aggregate fill" },
  { id: "gypsum", label: "Gypsum Plaster Poche", category: "Standard CAD", glyph: "∷", description: "Fine acoustic drywall pinholes" },
  { id: "membrane", label: "Vapor Barrier Membrane", category: "Standard CAD", glyph: "---", description: "Waterproof membrane with lap joints" },
];

/**
 * Generates clean, seamless, high-end vector SVG markup for architectural hatching patterns.
 */
export function getHatchSvgString(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff",
  size = 64
): string {
  const stroke = strokeColor || "#3f3f46";
  const bg = bgColor || "#ffffff";

  let innerSvg = "";

  switch (hatchStyle) {
    // ----------------------------------------------------
    // HIGH-END PARQUET & WOOD PATTERNS
    // ----------------------------------------------------
    case "herringbone": {
      // 90° interlocking herringbone boards with subtle tonal shifts and crisp joints
      const half = size / 2;
      const quarter = size / 4;
      innerSvg = `
        <rect x="0" y="0" width="${half}" height="${quarter}" fill="${stroke}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.2" />
        <rect x="${half}" y="${quarter}" width="${half}" height="${quarter}" fill="${stroke}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.2" />
        <rect x="0" y="${half}" width="${half}" height="${quarter}" fill="${stroke}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.2" />
        <rect x="${half}" y="${half + quarter}" width="${half}" height="${quarter}" fill="${stroke}" fill-opacity="0.08" stroke="${stroke}" stroke-width="1.2" />

        <rect x="${quarter}" y="0" width="${quarter}" height="${half}" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="1.2" />
        <rect x="${half + quarter}" y="${quarter}" width="${quarter}" height="${half}" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="1.2" />
        <rect x="${quarter}" y="${half}" width="${quarter}" height="${half}" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="1.2" />
        <rect x="0" y="${half + quarter}" width="${quarter}" height="${quarter}" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="1.2" />

        <line x1="0" y1="0" x2="${size}" y2="0" stroke="${stroke}" stroke-width="1.2" />
        <line x1="0" y1="${size}" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="1.2" />
        <line x1="0" y1="0" x2="0" y2="${size}" stroke="${stroke}" stroke-width="1.2" />
        <line x1="${size}" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="1.2" />
      `;
      break;
    }

    case "chevron": {
      // 45° mitered chevron planks meeting at central vertical spine
      const half = size / 2;
      const step = size / 4;
      innerSvg = `
        <!-- Central spine joint -->
        <line x1="${half}" y1="0" x2="${half}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <!-- Chevron V-planks with alternating tone -->
        <path d="M 0,0 L ${half},${step} L ${size},0" stroke="${stroke}" stroke-width="1.5" fill="${stroke}" fill-opacity="0.06" />
        <path d="M 0,${step} L ${half},${step * 2} L ${size},${step}" stroke="${stroke}" stroke-width="1.5" fill="${stroke}" fill-opacity="0.16" />
        <path d="M 0,${step * 2} L ${half},${step * 3} L ${size},${step * 2}" stroke="${stroke}" stroke-width="1.5" fill="${stroke}" fill-opacity="0.06" />
        <path d="M 0,${step * 3} L ${half},${size} L ${size},${step * 3}" stroke="${stroke}" stroke-width="1.5" fill="${stroke}" fill-opacity="0.16" />
        <path d="M 0,${size} L ${half},${size + step} L ${size},${size}" stroke="${stroke}" stroke-width="1.5" fill="none" />
      `;
      break;
    }

    case "basketweave": {
      const half = size / 2;
      innerSvg = `
        <!-- Top-Left: 3 horizontal slats -->
        <g stroke="${stroke}" stroke-width="1.2">
          <rect x="0" y="0" width="${half}" height="${half}" fill="${stroke}" fill-opacity="0.08" />
          <line x1="0" y1="${half / 3}" x2="${half}" y2="${half / 3}" />
          <line x1="0" y1="${(half * 2) / 3}" x2="${half}" y2="${(half * 2) / 3}" />
          <!-- Top-Right: 3 vertical slats -->
          <rect x="${half}" y="0" width="${half}" height="${half}" fill="${stroke}" fill-opacity="0.18" />
          <line x1="${half + half / 3}" y1="0" x2="${half + half / 3}" y2="${half}" />
          <line x1="${half + (half * 2) / 3}" y1="0" x2="${half + (half * 2) / 3}" y2="${half}" />
          <!-- Bottom-Left: 3 vertical slats -->
          <rect x="0" y="${half}" width="${half}" height="${half}" fill="${stroke}" fill-opacity="0.18" />
          <line x1="${half / 3}" y1="${half}" x2="${half / 3}" y2="${size}" />
          <line x1="${(half * 2) / 3}" y1="${half}" x2="${(half * 2) / 3}" y2="${size}" />
          <!-- Bottom-Right: 3 horizontal slats -->
          <rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${stroke}" fill-opacity="0.08" />
          <line x1="${half}" y1="${half + half / 3}" x2="${size}" y2="${half + half / 3}" />
          <line x1="${half}" y1="${half + (half * 2) / 3}" x2="${size}" y2="${half + (half * 2) / 3}" />
          <!-- Block divider borders -->
          <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke-width="2" />
        </g>
      `;
      break;
    }

    case "wood": {
      innerSvg = `
        <path d="M 0,${size * 0.18} Q ${size * 0.3},${size * 0.38} ${size},${size * 0.12}" stroke="${stroke}" stroke-width="2" fill="none" />
        <path d="M 0,${size * 0.45} Q ${size * 0.65},${size * 0.28} ${size},${size * 0.55}" stroke="${stroke}" stroke-width="1.8" fill="none" />
        <path d="M 0,${size * 0.78} Q ${size * 0.4},${size * 0.95} ${size},${size * 0.72}" stroke="${stroke}" stroke-width="2" fill="none" />
        <path d="M 0,${size * 0.95} Q ${size * 0.25},${size * 0.85} ${size},${size * 0.98}" stroke="${stroke}" stroke-width="1.2" opacity="0.6" fill="none" />
        <path d="M ${size * 0.4},${size * 0.55} C ${size * 0.45},${size * 0.52} ${size * 0.55},${size * 0.52} ${size * 0.58},${size * 0.58}" stroke="${stroke}" stroke-width="1.2" opacity="0.5" fill="none" />
      `;
      break;
    }

    case "timber-cut": {
      const cx = size * 0.4;
      const cy = size * 0.45;
      innerSvg = `
        <!-- Annual growth rings -->
        <circle cx="${cx}" cy="${cy}" r="${size * 0.12}" stroke="${stroke}" stroke-width="1.5" fill="none" />
        <circle cx="${cx}" cy="${cy}" r="${size * 0.25}" stroke="${stroke}" stroke-width="1.8" fill="none" />
        <circle cx="${cx}" cy="${cy}" r="${size * 0.38}" stroke="${stroke}" stroke-width="2.2" fill="none" />
        <circle cx="${cx}" cy="${cy}" r="${size * 0.52}" stroke="${stroke}" stroke-width="2.5" fill="none" />
        <circle cx="${cx}" cy="${cy}" r="${size * 0.68}" stroke="${stroke}" stroke-width="2.8" fill="none" />
        <!-- Radial shrinkage check / ray -->
        <line x1="${cx}" y1="${cy}" x2="${cx + size * 0.55}" y2="${cy + size * 0.3}" stroke="${stroke}" stroke-width="1.8" />
        <line x1="${cx}" y1="${cy}" x2="${cx - size * 0.35}" y2="${cy - size * 0.25}" stroke="${stroke}" stroke-width="1.2" opacity="0.7" />
      `;
      break;
    }

    // ----------------------------------------------------
    // HIGH-END TILES & MOSAICS
    // ----------------------------------------------------
    case "hex-tile": {
      // Tessellated regular hexagons with grout joints and facet fill
      const w = size;
      const h = size;
      innerSvg = `
        <g stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round">
          <!-- Center hexagon -->
          <polygon points="${w * 0.5},${h * 0.2} ${w * 0.8},${h * 0.35} ${w * 0.8},${h * 0.65} ${w * 0.5},${h * 0.8} ${w * 0.2},${h * 0.65} ${w * 0.2},${h * 0.35}" fill="${stroke}" fill-opacity="0.08" />
          <!-- Corner radiating grout connectors -->
          <line x1="${w * 0.5}" y1="${h * 0.2}" x2="${w * 0.5}" y2="0" />
          <line x1="${w * 0.5}" y1="${h * 0.8}" x2="${w * 0.5}" y2="${h}" />
          <line x1="${w * 0.8}" y1="${h * 0.35}" x2="${w}" y2="${h * 0.25}" />
          <line x1="${w * 0.8}" y1="${h * 0.65}" x2="${w}" y2="${h * 0.75}" />
          <line x1="${w * 0.2}" y1="${h * 0.35}" x2="0" y2="${h * 0.25}" />
          <line x1="${w * 0.2}" y1="${h * 0.65}" x2="0" y2="${h * 0.75}" />
          <!-- Edge facets -->
          <path d="M 0,0 L ${w * 0.2},${h * 0.1} L 0,${h * 0.2}" fill="${stroke}" fill-opacity="0.14" />
          <path d="M ${w},0 L ${w * 0.8},${h * 0.1} L ${w},${h * 0.2}" fill="${stroke}" fill-opacity="0.14" />
          <path d="M 0,${h} L ${w * 0.2},${h * 0.9} L 0,${h * 0.8}" fill="${stroke}" fill-opacity="0.14" />
          <path d="M ${w},${h} L ${w * 0.8},${h * 0.9} L ${w},${h * 0.8}" fill="${stroke}" fill-opacity="0.14" />
        </g>
      `;
      break;
    }

    case "subway-tile": {
      const halfH = size / 2;
      const halfW = size / 2;
      innerSvg = `
        <g stroke="${stroke}" stroke-width="1.8">
          <!-- Outer masonry grout joints -->
          <line x1="0" y1="0" x2="${size}" y2="0" />
          <line x1="0" y1="${halfH}" x2="${size}" y2="${halfH}" />
          <line x1="0" y1="${size}" x2="${size}" y2="${size}" />
          <line x1="${halfW}" y1="0" x2="${halfW}" y2="${halfH}" />
          <line x1="0" y1="${halfH}" x2="0" y2="${size}" />
          <line x1="${size}" y1="${halfH}" x2="${size}" y2="${size}" />

          <!-- High-end 3D Bevel inner highlight frames -->
          <rect x="3" y="3" width="${halfW - 6}" height="${halfH - 6}" fill="${stroke}" fill-opacity="0.06" stroke="${stroke}" stroke-width="0.8" opacity="0.6" />
          <rect x="${halfW + 3}" y="3" width="${halfW - 6}" height="${halfH - 6}" fill="${stroke}" fill-opacity="0.06" stroke="${stroke}" stroke-width="0.8" opacity="0.6" />
          <rect x="3" y="${halfH + 3}" width="${size - 6}" height="${halfH - 6}" fill="${stroke}" fill-opacity="0.06" stroke="${stroke}" stroke-width="0.8" opacity="0.6" />
        </g>
      `;
      break;
    }

    case "fish-scale": {
      // Art Deco Scalloped fan tiles
      const r = size / 2;
      innerSvg = `
        <g stroke="${stroke}" stroke-width="1.8" fill="${stroke}" fill-opacity="0.07">
          <!-- Top row arcs -->
          <path d="M -${r * 0.5},0 A ${r},${r} 0 0,1 ${r * 0.5},0" />
          <path d="M ${r * 0.5},0 A ${r},${r} 0 0,1 ${size + r * 0.5},0" />
          <!-- Middle row arcs -->
          <path d="M 0,${r} A ${r},${r} 0 0,1 ${size},${r}" />
          <!-- Bottom row arcs -->
          <path d="M -${r * 0.5},${size} A ${r},${r} 0 0,1 ${r * 0.5},${size}" />
          <path d="M ${r * 0.5},${size} A ${r},${r} 0 0,1 ${size + r * 0.5},${size}" />
        </g>
      `;
      break;
    }

    case "penny-round": {
      const rad = size * 0.16;
      innerSvg = `
        <g fill="${stroke}" fill-opacity="0.22" stroke="${stroke}" stroke-width="1.5">
          <circle cx="${size * 0.25}" cy="${size * 0.25}" r="${rad}" />
          <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${rad}" />
          <circle cx="${size * 0.5}" cy="${size * 0.75}" r="${rad}" />
          <circle cx="0" cy="${size * 0.75}" r="${rad}" />
          <circle cx="${size}" cy="${size * 0.75}" r="${rad}" />
        </g>
        <!-- Tile center glints -->
        <circle cx="${size * 0.23}" cy="${size * 0.23}" r="${rad * 0.3}" fill="#ffffff" opacity="0.6" />
        <circle cx="${size * 0.73}" cy="${size * 0.23}" r="${rad * 0.3}" fill="#ffffff" opacity="0.6" />
        <circle cx="${size * 0.48}" cy="${size * 0.73}" r="${rad * 0.3}" fill="#ffffff" opacity="0.6" />
      `;
      break;
    }

    // ----------------------------------------------------
    // HIGH-END STONE, TERRAZZO & MARBLE
    // ----------------------------------------------------
    case "marble": {
      // Natural organic branching Calacatta / Carrara veins
      innerSvg = `
        <!-- Main dramatic diagonal vein -->
        <path d="M 0,${size * 0.76} C ${size * 0.22},${size * 0.88} ${size * 0.38},${size * 0.48} ${size * 0.62},${size * 0.44} C ${size * 0.78},${size * 0.4} ${size * 0.88},${size * 0.16} ${size},0" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.8" />
        <!-- Soft feather shadow under main vein -->
        <path d="M 0,${size * 0.76} C ${size * 0.22},${size * 0.88} ${size * 0.38},${size * 0.48} ${size * 0.62},${size * 0.44} C ${size * 0.78},${size * 0.4} ${size * 0.88},${size * 0.16} ${size},0" stroke="${stroke}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.12" />

        <!-- Secondary tributary vein -->
        <path d="M ${size * 0.38},${size * 0.48} C ${size * 0.48},${size * 0.64} ${size * 0.58},${size * 0.82} ${size * 0.84},${size * 0.9} L ${size},${size * 0.94}" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.6" />

        <!-- Fine capillary micro-veins -->
        <path d="M ${size * 0.62},${size * 0.44} C ${size * 0.7},${size * 0.32} ${size * 0.76},${size * 0.24} ${size * 0.86},${size * 0.22}" stroke="${stroke}" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.45" />
        <path d="M 0,${size * 0.26} C ${size * 0.12},${size * 0.2} ${size * 0.18},${size * 0.08} ${size * 0.3},${size * 0.04}" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.5" />
        <path d="M ${size * 0.16},${size * 0.92} C ${size * 0.3},${size * 0.98} ${size * 0.42},${size * 0.96} ${size * 0.48},${size * 0.92}" stroke="${stroke}" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.35" />
      `;
      break;
    }

    case "terrazzo": {
      // Venetian Terrazzo: Curated multi-colored organic chips & pebbles
      innerSvg = `
        <!-- Large marble & basalt chips -->
        <polygon points="${size * 0.18},${size * 0.12} ${size * 0.28},${size * 0.08} ${size * 0.32},${size * 0.2} ${size * 0.22},${size * 0.24}" fill="${stroke}" fill-opacity="0.8" />
        <polygon points="${size * 0.68},${size * 0.14} ${size * 0.82},${size * 0.2} ${size * 0.76},${size * 0.32} ${size * 0.62},${size * 0.26}" fill="${stroke}" fill-opacity="0.45" />
        <polygon points="${size * 0.42},${size * 0.42} ${size * 0.54},${size * 0.38} ${size * 0.58},${size * 0.52} ${size * 0.44},${size * 0.58}" fill="${stroke}" fill-opacity="0.9" />
        <polygon points="${size * 0.12},${size * 0.62} ${size * 0.24},${size * 0.58} ${size * 0.28},${size * 0.72} ${size * 0.16},${size * 0.76}" fill="${stroke}" fill-opacity="0.5" />
        <polygon points="${size * 0.75},${size * 0.66} ${size * 0.9},${size * 0.62} ${size * 0.88},${size * 0.8} ${size * 0.72},${size * 0.78}" fill="${stroke}" fill-opacity="0.85" />
        <polygon points="${size * 0.38},${size * 0.82} ${size * 0.5},${size * 0.78} ${size * 0.46},${size * 0.94} ${size * 0.34},${size * 0.9}" fill="${stroke}" fill-opacity="0.4" />

        <!-- Contrasting white quartz chips with micro-borders -->
        <polygon points="${size * 0.54},${size * 0.12} ${size * 0.62},${size * 0.18} ${size * 0.56},${size * 0.26}" fill="#ffffff" fill-opacity="0.85" stroke="${stroke}" stroke-width="0.8" />
        <polygon points="${size * 0.08},${size * 0.36} ${size * 0.16},${size * 0.42} ${size * 0.1},${size * 0.48}" fill="#ffffff" fill-opacity="0.85" stroke="${stroke}" stroke-width="0.8" />
        <polygon points="${size * 0.86},${size * 0.4} ${size * 0.94},${size * 0.46} ${size * 0.88},${size * 0.52}" fill="#ffffff" fill-opacity="0.85" stroke="${stroke}" stroke-width="0.8" />

        <!-- Fine terrazzo aggregate dots -->
        <circle cx="${size * 0.35}" cy="${size * 0.32}" r="2" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.64}" cy="${size * 0.55}" r="2.2" fill="${stroke}" fill-opacity="0.7" />
        <circle cx="${size * 0.28}" cy="${size * 0.85}" r="1.8" fill="${stroke}" fill-opacity="0.5" />
        <circle cx="${size * 0.85}" cy="${size * 0.1}" r="1.5" fill="${stroke}" fill-opacity="0.6" />
      `;
      break;
    }

    case "granite": {
      innerSvg = `
        <g fill="${stroke}">
          <circle cx="${size * 0.15}" cy="${size * 0.2}" r="2" opacity="0.8" />
          <circle cx="${size * 0.4}" cy="${size * 0.15}" r="1.5" opacity="0.5" />
          <circle cx="${size * 0.65}" cy="${size * 0.25}" r="2.5" opacity="0.9" />
          <circle cx="${size * 0.85}" cy="${size * 0.18}" r="1.8" opacity="0.6" />
          <circle cx="${size * 0.25}" cy="${size * 0.45}" r="2.2" opacity="0.7" />
          <circle cx="${size * 0.5}" cy="${size * 0.5}" r="3" opacity="0.95" />
          <circle cx="${size * 0.78}" cy="${size * 0.42}" r="1.6" opacity="0.5" />
          <circle cx="${size * 0.12}" cy="${size * 0.75}" r="2.8" opacity="0.85" />
          <circle cx="${size * 0.38}" cy="${size * 0.82}" r="1.8" opacity="0.6" />
          <circle cx="${size * 0.62}" cy="${size * 0.72}" r="2.4" opacity="0.75" />
          <circle cx="${size * 0.9}" cy="${size * 0.85}" r="2" opacity="0.9" />
        </g>
        <!-- Crystalline quartz flakes -->
        <polygon points="${size * 0.3},${size * 0.3} ${size * 0.34},${size * 0.32} ${size * 0.32},${size * 0.36}" fill="#ffffff" opacity="0.8" stroke="${stroke}" stroke-width="0.5" />
        <polygon points="${size * 0.7},${size * 0.6} ${size * 0.74},${size * 0.62} ${size * 0.72},${size * 0.66}" fill="#ffffff" opacity="0.8" stroke="${stroke}" stroke-width="0.5" />
      `;
      break;
    }

    case "stucco": {
      innerSvg = `
        <g fill="${stroke}" opacity="0.35">
          ${[
            [0.1, 0.1], [0.35, 0.08], [0.6, 0.12], [0.88, 0.06],
            [0.2, 0.28], [0.45, 0.22], [0.72, 0.3], [0.92, 0.24],
            [0.08, 0.5], [0.32, 0.48], [0.55, 0.44], [0.82, 0.52],
            [0.18, 0.7], [0.42, 0.68], [0.68, 0.65], [0.94, 0.72],
            [0.12, 0.9], [0.38, 0.88], [0.62, 0.92], [0.85, 0.86]
          ].map(([x, y], i) => `
            <circle cx="${size * x}" cy="${size * y}" r="${1.2 + (i % 3) * 0.6}" />
          `).join("")}
        </g>
        <!-- Fine scrape trowel strokes -->
        <path d="M ${size * 0.15},${size * 0.35} Q ${size * 0.25},${size * 0.38} ${size * 0.4},${size * 0.34}" stroke="${stroke}" stroke-width="0.8" opacity="0.4" fill="none" />
        <path d="M ${size * 0.55},${size * 0.75} Q ${size * 0.65},${size * 0.78} ${size * 0.8},${size * 0.74}" stroke="${stroke}" stroke-width="0.8" opacity="0.4" fill="none" />
      `;
      break;
    }

    // ----------------------------------------------------
    // HIGH-END METALS & FACADES
    // ----------------------------------------------------
    case "perforated-metal": {
      const r = size * 0.11;
      innerSvg = `
        <g>
          <!-- Staggered circular perforations with inner shadow depth ring -->
          ${[
            [size * 0.25, size * 0.25],
            [size * 0.75, size * 0.25],
            [size * 0.5, size * 0.75],
            [0, size * 0.75],
            [size, size * 0.75],
            [size * 0.5, -size * 0.25],
            [size * 0.5, size * 1.25],
          ].map(([cx, cy]) => `
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="${stroke}" fill-opacity="0.85" />
            <circle cx="${cx}" cy="${cy}" r="${r * 0.75}" fill="#000000" fill-opacity="0.5" />
            <path d="M ${cx - r * 0.6},${cy - r * 0.6} A ${r},${r} 0 0,1 ${cx + r * 0.6},${cy - r * 0.6}" stroke="#ffffff" stroke-width="1.2" opacity="0.5" fill="none" />
          `).join("")}
        </g>
      `;
      break;
    }

    case "expanded-mesh": {
      const half = size / 2;
      innerSvg = `
        <g stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round">
          <!-- Diamond rhomboid expanded metal lattice -->
          <polygon points="${half},0 ${size},${half} ${half},${size} 0,${half}" />
          <polygon points="${half},${size * 0.15} ${size * 0.85},${half} ${half},${size * 0.85} ${size * 0.15},${half}" fill="${stroke}" fill-opacity="0.08" stroke-width="1.2" />
          <line x1="0" y1="0" x2="${half}" y2="${half}" stroke-width="1.5" />
          <line x1="${size}" y1="0" x2="${half}" y2="${half}" stroke-width="1.5" />
          <line x1="0" y1="${size}" x2="${half}" y2="${half}" stroke-width="1.5" />
          <line x1="${size}" y1="${size}" x2="${half}" y2="${half}" stroke-width="1.5" />
        </g>
      `;
      break;
    }

    case "diamond-plate": {
      const half = size / 2;
      innerSvg = `
        <g fill="${stroke}" stroke="${stroke}" stroke-width="0.8">
          <!-- Angled diamond tread pair 1 (top-left) -->
          <path d="M ${size * 0.15},${size * 0.35} C ${size * 0.2},${size * 0.25} ${size * 0.3},${size * 0.25} ${size * 0.35},${size * 0.35} C ${size * 0.3},${size * 0.45} ${size * 0.2},${size * 0.45} Z" fill-opacity="0.75" />
          <!-- Angled diamond tread pair 2 (bottom-right) -->
          <path d="M ${half + size * 0.15},${half + size * 0.35} C ${half + size * 0.2},${half + size * 0.25} ${half + size * 0.3},${half + size * 0.25} ${half + size * 0.35},${half + size * 0.35} C ${half + size * 0.3},${half + size * 0.45} ${half + size * 0.2},${half + size * 0.45} Z" fill-opacity="0.75" />
          <!-- Perpendicular diamond tread pair 3 (top-right) -->
          <path d="M ${half + size * 0.35},${size * 0.15} C ${half + size * 0.45},${size * 0.2} ${half + size * 0.45},${size * 0.3} ${half + size * 0.35},${size * 0.35} C ${half + size * 0.25},${size * 0.3} ${half + size * 0.25},${size * 0.2} Z" fill-opacity="0.75" />
          <!-- Perpendicular diamond tread pair 4 (bottom-left) -->
          <path d="M ${size * 0.35},${half + size * 0.15} C ${size * 0.45},${half + size * 0.2} ${size * 0.45},${half + size * 0.3} ${size * 0.35},${half + size * 0.35} C ${size * 0.25},${half + size * 0.3} ${size * 0.25},${half + size * 0.2} Z" fill-opacity="0.75" />
        </g>
      `;
      break;
    }

    case "standing-seam": {
      const half = size / 2;
      innerSvg = `
        <!-- Vertical architectural standing seam profile -->
        <rect x="0" y="0" width="6" height="${size}" fill="${stroke}" fill-opacity="0.85" />
        <line x1="6" y1="0" x2="6" y2="${size}" stroke="#000000" stroke-width="1.2" opacity="0.6" />
        <line x1="1" y1="0" x2="1" y2="${size}" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />

        <rect x="${half}" y="0" width="6" height="${size}" fill="${stroke}" fill-opacity="0.85" />
        <line x1="${half + 6}" y1="0" x2="${half + 6}" y2="${size}" stroke="#000000" stroke-width="1.2" opacity="0.6" />
        <line x1="${half + 1}" y1="0" x2="${half + 1}" y2="${size}" stroke="#ffffff" stroke-width="1.2" opacity="0.7" />

        <!-- Flat panel subtle oil-canning reflection lines -->
        <line x1="${size * 0.25}" y1="0" x2="${size * 0.25}" y2="${size}" stroke="${stroke}" stroke-width="0.8" opacity="0.2" />
        <line x1="${size * 0.75}" y1="0" x2="${size * 0.75}" y2="${size}" stroke="${stroke}" stroke-width="0.8" opacity="0.2" />
      `;
      break;
    }

    // ----------------------------------------------------
    // HIGH-END ACOUSTICS & GLASS
    // ----------------------------------------------------
    case "acoustic-slat":
    case "fluted-wood": {
      const count = 4;
      const slatW = (size / count) * 0.72;
      const gapW = (size / count) * 0.28;
      const step = size / count;
      innerSvg = `
        <g>
          ${Array.from({ length: count }).map((_, i) => {
            const x = i * step;
            return `
              <!-- Slat Face -->
              <rect x="${x}" y="0" width="${slatW}" height="${size}" fill="${stroke}" fill-opacity="0.18" />
              <!-- Highlight Left Edge -->
              <line x1="${x}" y1="0" x2="${x}" y2="${size}" stroke="#ffffff" stroke-width="1.2" opacity="0.5" />
              <!-- Slat Right Edge Line -->
              <line x1="${x + slatW}" y1="0" x2="${x + slatW}" y2="${size}" stroke="${stroke}" stroke-width="1.5" />
              <!-- Dark Acoustic Gap -->
              <rect x="${x + slatW}" y="0" width="${gapW}" height="${size}" fill="${stroke}" fill-opacity="0.9" />
              <!-- Shadow within gap -->
              <line x1="${x + slatW}" y1="0" x2="${x + slatW}" y2="${size}" stroke="#000000" stroke-width="1.5" opacity="0.7" />
            `;
          }).join("")}
        </g>
      `;
      break;
    }

    case "reeded-glass": {
      const count = 6;
      const step = size / count;
      innerSvg = `
        <g>
          ${Array.from({ length: count }).map((_, i) => {
            const x = i * step;
            return `
              <!-- Reed semi-cylindrical gradient highlight & shadow -->
              <rect x="${x}" y="0" width="${step * 0.5}" height="${size}" fill="#ffffff" fill-opacity="0.4" />
              <rect x="${x + step * 0.5}" y="0" width="${step * 0.5}" height="${size}" fill="${stroke}" fill-opacity="0.3" />
              <line x1="${x + step * 0.25}" y1="0" x2="${x + step * 0.25}" y2="${size}" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
              <line x1="${x + step}" y1="0" x2="${x + step}" y2="${size}" stroke="${stroke}" stroke-width="1.8" />
            `;
          }).join("")}
        </g>
      `;
      break;
    }

    case "glass": {
      innerSvg = `
        <g stroke="${stroke}" stroke-linecap="round">
          <!-- Triple glint diagonal architectural glass lines -->
          <line x1="${size * 0.15}" y1="${size * 0.6}" x2="${size * 0.6}" y2="${size * 0.15}" stroke-width="3" opacity="0.75" />
          <line x1="${size * 0.25}" y1="${size * 0.7}" x2="${size * 0.7}" y2="${size * 0.25}" stroke-width="1.5" opacity="0.5" />
          <line x1="${size * 0.35}" y1="${size * 0.8}" x2="${size * 0.8}" y2="${size * 0.35}" stroke-width="2.2" opacity="0.65" />
          <!-- Subtle white highlight bounce -->
          <line x1="${size * 0.17}" y1="${size * 0.58}" x2="${size * 0.58}" y2="${size * 0.17}" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />
        </g>
      `;
      break;
    }

    // ----------------------------------------------------
    // STANDARD ARCHITECTURAL CAD PATTERNS
    // ----------------------------------------------------
    case "horizontal":
      innerSvg = `
        <line x1="0" y1="${size * 0.25}" x2="${size}" y2="${size * 0.25}" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size * 0.75}" x2="${size}" y2="${size * 0.75}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "vertical":
      innerSvg = `
        <line x1="${size * 0.25}" y1="0" x2="${size * 0.25}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size * 0.75}" y1="0" x2="${size * 0.75}" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "diagonal":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="-${size * 0.5}" y1="${size * 0.5}" x2="${size * 0.5}" y2="${size * 1.5}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size * 0.5}" y1="-${size * 0.5}" x2="${size * 1.5}" y2="${size * 0.5}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "cross":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size}" y1="0" x2="0" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "grid":
    case "tile":
    case "checker":
      innerSvg = `
        <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="2" />
      `;
      if (hatchStyle === "checker") {
        innerSvg += `<rect x="0" y="0" width="${size / 2}" height="${size / 2}" fill="${stroke}" fill-opacity="0.35" />`;
        innerSvg += `<rect x="${size / 2}" y="${size / 2}" width="${size / 2}" height="${size / 2}" fill="${stroke}" fill-opacity="0.35" />`;
      }
      break;

    case "brick":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="0" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size / 2}" stroke="${stroke}" stroke-width="2" />
        <line x1="0" y1="${size / 2}" x2="0" y2="${size}" stroke="${stroke}" stroke-width="2" />
        <line x1="${size}" y1="${size / 2}" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "concrete":
    case "reinforced-concrete":
      innerSvg = `
        <circle cx="${size * 0.2}" cy="${size * 0.3}" r="3" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.7}" cy="${size * 0.25}" r="2" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.4}" cy="${size * 0.75}" r="4" fill="${stroke}" fill-opacity="0.6" />
        <circle cx="${size * 0.85}" cy="${size * 0.8}" r="2.5" fill="${stroke}" fill-opacity="0.6" />
        <polygon points="${size * 0.5},${size * 0.1} ${size * 0.58},${size * 0.2} ${size * 0.45},${size * 0.22}" fill="${stroke}" fill-opacity="0.7" />
        <polygon points="${size * 0.15},${size * 0.6} ${size * 0.28},${size * 0.65} ${size * 0.2},${size * 0.75}" fill="${stroke}" fill-opacity="0.7" />
      `;
      if (hatchStyle === "reinforced-concrete") {
        innerSvg += `
          <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2" stroke-dasharray="4,4" />
        `;
      }
      break;

    case "insulation":
      innerSvg = `
        <path d="M 0,${size / 2} C ${size * 0.25},0 ${size * 0.25},${size} ${size * 0.5},${size / 2} C ${size * 0.75},0 ${size * 0.75},${size} ${size},${size / 2}" stroke="${stroke}" stroke-width="2.5" fill="none" />
      `;
      break;

    case "zigzag":
      innerSvg = `
        <path d="M 0,${size * 0.25} L ${size * 0.25},${size * 0.75} L ${size * 0.5},${size * 0.25} L ${size * 0.75},${size * 0.75} L ${size},${size * 0.25}" stroke="${stroke}" stroke-width="2.5" fill="none" stroke-linejoin="round" />
      `;
      break;

    case "stone":
      innerSvg = `
        <rect x="2" y="2" width="${size * 0.5 - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
        <rect x="${size * 0.5 + 2}" y="2" width="${size * 0.5 - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
        <rect x="2" y="${size * 0.5 + 2}" width="${size - 4}" height="${size * 0.5 - 4}" fill="none" stroke="${stroke}" stroke-width="2" />
      `;
      break;

    case "steel":
      innerSvg = `
        <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${stroke}" stroke-width="2.5" />
        <line x1="4" y1="0" x2="${size + 4}" y2="${size}" stroke="${stroke}" stroke-width="1" />
        <line x1="-${size * 0.5}" y1="${size * 0.5}" x2="${size * 0.5}" y2="${size * 1.5}" stroke="${stroke}" stroke-width="2.5" />
        <line x1="${size * 0.5}" y1="-${size * 0.5}" x2="${size * 1.5}" y2="${size * 0.5}" stroke="${stroke}" stroke-width="2.5" />
      `;
      break;

    case "earth":
      innerSvg = `
        <g stroke="${stroke}" stroke-width="1.8">
          <line x1="${size * 0.1}" y1="${size * 0.2}" x2="${size * 0.3}" y2="${size * 0.2}" />
          <line x1="${size * 0.12}" y1="${size * 0.26}" x2="${size * 0.28}" y2="${size * 0.26}" />
          <line x1="${size * 0.15}" y1="${size * 0.32}" x2="${size * 0.25}" y2="${size * 0.32}" />

          <line x1="${size * 0.6}" y1="${size * 0.6}" x2="${size * 0.8}" y2="${size * 0.6}" />
          <line x1="${size * 0.62}" y1="${size * 0.66}" x2="${size * 0.78}" y2="${size * 0.66}" />
          <line x1="${size * 0.65}" y1="${size * 0.72}" x2="${size * 0.75}" y2="${size * 0.72}" />
        </g>
        <circle cx="${size * 0.7}" cy="${size * 0.25}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.25}" cy="${size * 0.7}" r="1.5" fill="${stroke}" />
      `;
      break;

    case "gravel":
      innerSvg = `
        <g stroke="${stroke}" stroke-width="1.5" fill="${stroke}" fill-opacity="0.15">
          <polygon points="${size * 0.2},${size * 0.2} ${size * 0.32},${size * 0.18} ${size * 0.35},${size * 0.28} ${size * 0.22},${size * 0.32}" />
          <polygon points="${size * 0.65},${size * 0.3} ${size * 0.78},${size * 0.25} ${size * 0.82},${size * 0.38} ${size * 0.68},${size * 0.42}" />
          <polygon points="${size * 0.35},${size * 0.65} ${size * 0.5},${size * 0.6} ${size * 0.52},${size * 0.74} ${size * 0.38},${size * 0.78}" />
          <polygon points="${size * 0.72},${size * 0.75} ${size * 0.85},${size * 0.72} ${size * 0.86},${size * 0.86} ${size * 0.74},${size * 0.88}" />
        </g>
      `;
      break;

    case "sand":
      innerSvg = `
        <g fill="${stroke}">
          ${[
            [0.15, 0.2], [0.35, 0.12], [0.65, 0.22], [0.85, 0.15],
            [0.22, 0.45], [0.48, 0.38], [0.75, 0.48], [0.92, 0.4],
            [0.12, 0.72], [0.38, 0.68], [0.62, 0.78], [0.88, 0.7],
            [0.28, 0.9], [0.55, 0.88], [0.8, 0.92]
          ].map(([x, y], i) => `<circle cx="${size * x}" cy="${size * y}" r="${1 + (i % 2) * 0.8}" />`).join("")}
        </g>
      `;
      break;

    case "gypsum":
      innerSvg = `
        <g fill="${stroke}" opacity="0.7">
          ${[
            [0.2, 0.2], [0.5, 0.15], [0.8, 0.25],
            [0.35, 0.45], [0.65, 0.4], [0.9, 0.55],
            [0.15, 0.75], [0.45, 0.7], [0.75, 0.85]
          ].map(([x, y]) => `<circle cx="${size * x}" cy="${size * y}" r="1.4" />`).join("")}
        </g>
      `;
      break;

    case "membrane":
      innerSvg = `
        <line x1="0" y1="${size * 0.5}" x2="${size}" y2="${size * 0.5}" stroke="${stroke}" stroke-width="3" stroke-dasharray="8,4" />
        <line x1="${size * 0.2}" y1="${size * 0.4}" x2="${size * 0.25}" y2="${size * 0.6}" stroke="${stroke}" stroke-width="1.5" />
        <line x1="${size * 0.6}" y1="${size * 0.4}" x2="${size * 0.65}" y2="${size * 0.6}" stroke="${stroke}" stroke-width="1.5" />
      `;
      break;

    default:
      innerSvg = `
        <circle cx="${size * 0.25}" cy="${size * 0.25}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.75}" cy="${size * 0.75}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.75}" cy="${size * 0.25}" r="1.5" fill="${stroke}" />
        <circle cx="${size * 0.25}" cy="${size * 0.75}" r="1.5" fill="${stroke}" />
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}" />
    ${innerSvg}
  </svg>`;
}

/**
 * Returns a SVG Data-URI string for vector background rendering.
 */
export function getHatchSvgDataUri(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff"
): string {
  const key = `${hatchStyle}_${strokeColor}_${bgColor}`;
  if (svgUriCache.has(key)) return svgUriCache.get(key)!;

  const svgStr = getHatchSvgString(hatchStyle, strokeColor, bgColor);
  const encoded = encodeURIComponent(svgStr);
  const uri = `data:image/svg+xml;charset=utf-8,${encoded}`;
  svgUriCache.set(key, uri);
  return uri;
}

/**
 * Creates or retrieves a cached CanvasTexture with high-DPI vector-rendered architectural hatch patterns.
 */
export function getHatchCanvasTexture(
  hatchStyle: HatchStyle,
  strokeColor = "#3f3f46",
  bgColor = "#ffffff",
  scaleMm = 200
): THREE.CanvasTexture | null {
  if (!hatchStyle || hatchStyle === "solid") {
    return null;
  }

  const cacheKey = `${hatchStyle}_${strokeColor}_${bgColor}_${scaleMm}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  if (typeof document === "undefined") {
    const dummy = new THREE.CanvasTexture({} as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement("canvas");
  const size = 512; // High DPI vector render
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Background fill
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Micro surface tactile texture
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    switch (hatchStyle) {
      case "horizontal":
        for (let y = 32; y < size; y += 64) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }
        break;

      case "vertical":
        for (let x = 32; x < size; x += 64) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }
        break;

      case "diagonal":
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + size, size);
          ctx.stroke();
        }
        break;

      case "cross":
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
        }
        break;

      case "grid":
      case "tile":
      case "checker": {
        const step = hatchStyle === "tile" ? 128 : 96;
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 6;
        for (let p = 0; p <= size; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        for (let p = 2; p <= size; p += step) {
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        }
        if (hatchStyle === "checker") {
          ctx.fillStyle = strokeColor;
          ctx.globalAlpha = 0.22;
          for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
              if ((x / step + y / step) % 2 === 0) ctx.fillRect(x, y, step, step);
            }
          }
          ctx.globalAlpha = 1;
        }
        break;
      }

      case "subway-tile":
      case "brick": {
        const rowH = hatchStyle === "subway-tile" ? 48 : 64;
        const colW = rowH * 2;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let r = 0; r < size; r += rowH) {
          ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(size, r); ctx.stroke();
          const offset = (r / rowH) % 2 === 0 ? 0 : colW / 2;
          for (let c = offset; c <= size; c += colW) {
            ctx.beginPath(); ctx.moveTo(c, r); ctx.lineTo(c, r + rowH); ctx.stroke();
            if (hatchStyle === "subway-tile") {
              ctx.strokeRect(c + 4, r + 4, colW - 8, rowH - 8);
            }
          }
        }
        break;
      }

      case "herringbone": {
        const hStep = 64;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        for (let y = 0; y < size; y += hStep) {
          for (let x = 0; x < size; x += hStep) {
            ctx.strokeRect(x, y, hStep / 2, hStep / 4);
            ctx.strokeRect(x + hStep / 4, y, hStep / 4, hStep / 2);
          }
        }
        break;
      }

      case "chevron": {
        const half = size / 2;
        const cStep = 64;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half, size); ctx.stroke();
        for (let y = -cStep; y < size + cStep; y += cStep) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(half, y + cStep / 2);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
        break;
      }

      case "marble": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, size * 0.75);
        ctx.bezierCurveTo(size * 0.25, size * 0.9, size * 0.4, size * 0.45, size * 0.65, size * 0.4);
        ctx.bezierCurveTo(size * 0.8, size * 0.35, size * 0.9, size * 0.15, size, 0);
        ctx.stroke();

        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(size * 0.4, size * 0.45);
        ctx.bezierCurveTo(size * 0.5, size * 0.65, size * 0.6, size * 0.8, size * 0.85, size * 0.9);
        ctx.stroke();
        break;
      }

      case "terrazzo": {
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < 70; i++) {
          const x = (i * 97 + 13) % size;
          const y = (i * 139 + 37) % size;
          const s = 6 + (i % 8);
          ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
          ctx.fillRect(x, y, s, s);
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "acoustic-slat":
      case "fluted-wood": {
        const slatW = 32;
        const gapW = 16;
        for (let x = 0; x < size; x += (slatW + gapW)) {
          ctx.fillStyle = strokeColor;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(x, 0, slatW, size);
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x + slatW, 0, gapW, size);
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "perforated-metal": {
        ctx.fillStyle = strokeColor;
        const pStep = 64;
        for (let y = 32; y < size; y += pStep) {
          const offset = (y / pStep) % 2 === 0 ? 0 : 32;
          for (let x = offset; x < size; x += pStep) {
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case "concrete": {
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 180; i++) {
          const x = (i * 73 + 23) % size;
          const y = (i * 113 + 47) % size;
          const r = 2.0 + ((i * 17) % 6);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 48; i++) {
          const x = (i * 97 + 39) % size;
          const y = (i * 149 + 83) % size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 12, y - 8);
          ctx.lineTo(x + 8, y + 10);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "wood": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let y = 20; y < size; y += 44) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(size * 0.3, y + 28, size * 0.7, y - 24, size, y + 8);
          ctx.stroke();
        }
        break;
      }

      case "reinforced-concrete": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        for (let i = -size; i < size * 2; i += 64) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < 80; i++) {
          const x = (i * 83 + 37) % size;
          const y = (i * 137 + 61) % size;
          ctx.beginPath(); ctx.arc(x, y, 3.5 + (i % 4), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case "insulation": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 5;
        for (let x = 0; x <= size; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 32, size * 0.35, x - 32, size * 0.65, x + 48, size);
          ctx.bezierCurveTo(x + 128, size * 0.65, x + 64, size * 0.35, x + 96, 0);
          ctx.stroke();
        }
        break;
      }

      case "stone": {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 5;
        const stoneBlocks = [
          [16, 24, 200, 100], [232, 20, 260, 108],
          [12, 140, 140, 112], [164, 144, 180, 104], [356, 140, 140, 112],
          [20, 268, 240, 104], [276, 264, 220, 112],
          [12, 388, 160, 108], [184, 392, 190, 100], [384, 388, 116, 108],
        ];
        for (const [x, y, w, h] of stoneBlocks) {
          ctx.strokeRect(x, y, w, h);
        }
        break;
      }

      default: {
        ctx.fillStyle = strokeColor;
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 100; i++) {
          ctx.fillRect((i * 73) % size, (i * 113) % size, 4, 4);
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = Math.max(0.5, Math.min(50, 1000 / scaleMm));
  texture.repeat.set(repeat, repeat);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}
