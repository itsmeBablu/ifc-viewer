import type { ElementTypeDefinition } from "@/components/tools/EditTypeDialog";

const types: ElementTypeDefinition[] = [
  { id: "window-single-hung", name: "Single-hung window", category: "Window", widthMm: 1000, heightMm: 1400, sillHeightMm: 900, windowOperation: "single-hung", material: "Wood", functionType: "Exterior" },
  { id: "window-casement", name: "Casement window", category: "Window", widthMm: 900, heightMm: 1400, sillHeightMm: 900, windowOperation: "casement", material: "Wood", functionType: "Exterior" },
  { id: "window-sliding", name: "Sliding window", category: "Window", widthMm: 1600, heightMm: 1200, sillHeightMm: 900, windowOperation: "sliding", material: "Aluminium", functionType: "Exterior" },
  { id: "door-double", name: "Double hinged door · 1800 × 2100", category: "Door", widthMm: 1800, heightMm: 2100, doorStyle: "double", material: "Wood", functionType: "Interior" },
  { id: "door-glass", name: "Glass door · 900 × 2100", category: "Door", widthMm: 900, heightMm: 2100, doorStyle: "glass", material: "Glass", functionType: "Interior" },
  { id: "door-sliding", name: "Sliding door · 1800 × 2100", category: "Door", widthMm: 1800, heightMm: 2100, doorStyle: "sliding", material: "Glass", functionType: "Interior" },
  { id: "door-garage", name: "Sectional garage door · 2500 × 2250", category: "Door", widthMm: 2500, heightMm: 2250, doorStyle: "garage", material: "Steel", functionType: "Exterior" },
  { id: "door-steel", name: "Steel door · 1000 × 2100", category: "Door", widthMm: 1000, heightMm: 2100, doorStyle: "metal", material: "Steel", functionType: "Exterior" },
  { id: "window-two-sash", name: "Two-sash window · 1200 × 1400", category: "Window", widthMm: 1200, heightMm: 1400, sashCount: 2, sillHeightMm: 900, material: "Aluminium", functionType: "Exterior" },
  { id: "window-four-sash", name: "Four-sash window · 2400 × 1400", category: "Window", widthMm: 2400, heightMm: 1400, sashCount: 4, sillHeightMm: 900, material: "Aluminium", functionType: "Exterior" },
  { id: "window-round", name: "Round window · 1000", category: "Window", widthMm: 1000, heightMm: 1000, headShape: "round", sashCount: 1, sillHeightMm: 1200, material: "Aluminium", functionType: "Exterior" },
  { id: "window-arched", name: "Arched window · 1200 × 1800", category: "Window", widthMm: 1200, heightMm: 1800, headShape: "arched", sashCount: 2, sillHeightMm: 600, material: "Wood", functionType: "Exterior" },
  { id: "column-concrete", name: "Concrete column · 300 × 300", category: "Column", widthMm: 300, depthMm: 300, structuralProfile: "rect", material: "Concrete", functionType: "Structural" },
  { id: "column-round", name: "Round concrete column · Ø400", category: "Column", widthMm: 400, depthMm: 400, structuralProfile: "circle", material: "Concrete", functionType: "Structural" },
  { id: "column-steel", name: "Steel I-column · 200 × 200", category: "Column", widthMm: 200, depthMm: 200, structuralProfile: "i", material: "Steel", functionType: "Structural" },
  { id: "beam-concrete", name: "Concrete beam · 250 × 500", category: "Beam", widthMm: 250, depthMm: 500, structuralProfile: "rect", material: "Concrete", functionType: "Structural" },
  { id: "beam-steel", name: "Steel I-beam · 150 × 300", category: "Beam", widthMm: 150, depthMm: 300, structuralProfile: "i", material: "Steel", functionType: "Structural" },
  { id: "beam-timber", name: "Timber beam · 160 × 320", category: "Beam", widthMm: 160, depthMm: 320, structuralProfile: "rect", material: "Wood", functionType: "Structural" },
  { id: "stair-straight-wood", name: "Straight stair · Timber · 1000", category: "Stair", widthMm: 1000, material: "Wood", functionType: "Interior" },
  { id: "stair-straight-concrete", name: "Straight stair · Concrete · 1200", category: "Stair", widthMm: 1200, material: "Concrete", functionType: "Interior" },
  { id: "stair-lshape-wood", name: "L-shaped stair · Landing · 1000", category: "Stair", widthMm: 1000, material: "Wood", functionType: "Interior" },
  { id: "stair-ushape-concrete", name: "U-shaped stair · Half turn · 1100", category: "Stair", widthMm: 1100, material: "Concrete", functionType: "Interior" },
  { id: "stair-spiral-steel", name: "Spiral stair · Steel & glass · 1800", category: "Stair", widthMm: 1800, material: "Steel", functionType: "Interior" },
  { id: "tray-200", name: "Cable tray · 200 × 60", category: "CableTray", widthMm: 200, heightMm: 60, material: "Steel", functionType: "Interior" },
  { id: "tray-400", name: "Cable tray · 400 × 100", category: "CableTray", widthMm: 400, heightMm: 100, material: "Steel", functionType: "Interior" },
];
export const EXTRA_ELEMENT_TYPES: Record<string, ElementTypeDefinition> = Object.fromEntries(types.map((t) => [t.id, t]));
export const TOOL_TYPE_CATEGORY: Partial<Record<string, ElementTypeDefinition["category"]>> = {
  wall: "Wall", door: "Door", window: "Window", floor: "Floor", roof: "Roof", stair: "Stair", ramp: "Ramp", column: "Column", beam: "Beam", duct: "Duct", flex_duct: "Duct", mep_placeholder: "Duct", pipe: "Pipe", cabletray: "CableTray",
};
