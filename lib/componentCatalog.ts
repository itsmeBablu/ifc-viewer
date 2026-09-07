import type { MepEquipmentCategory } from "./layoutDrawing";

export type ComponentPreset = {
  id: string; name: string; room: string; category: MepEquipmentCategory;
  widthMm: number; depthMm: number; heightMm: number; elevationMm: number;
};
const furniture = (id: string, name: string, room: string, widthMm: number, depthMm: number, heightMm: number): ComponentPreset => ({ id, name, room, category: "furniture", widthMm, depthMm, heightMm, elevationMm: 0 });
const mep = (id: MepEquipmentCategory, name: string, room: string, widthMm: number, depthMm: number, heightMm: number, elevationMm = 0): ComponentPreset => ({ id: `mep-${id}`, name, room, category: id, widthMm, depthMm, heightMm, elevationMm });

export const COMPONENT_CATALOG: ComponentPreset[] = [
  furniture("sofa-2", "Two-seat sofa", "Living room", 1800, 850, 800),
  furniture("sofa-3", "Three-seat sofa", "Living room", 2400, 900, 800),
  furniture("armchair", "Armchair", "Living room", 850, 850, 850),
  furniture("coffee-table", "Coffee table", "Living room", 1100, 600, 420),
  furniture("tv-cabinet", "TV cabinet", "Living room", 1600, 400, 500),
  furniture("bookcase", "Bookcase", "Living room", 1000, 350, 2000),
  furniture("bed-single", "Single bed", "Bedroom", 1000, 2100, 900),
  furniture("bed-double", "Double bed", "Bedroom", 1800, 2100, 1000),
  furniture("bedside", "Bedside cabinet", "Bedroom", 450, 400, 550),
  furniture("wardrobe", "Wardrobe", "Bedroom", 1800, 600, 2200),
  furniture("dining-chair", "Dining chair", "Dining room", 480, 520, 850),
  furniture("dining-table", "Dining table", "Dining room", 1800, 900, 750),
  furniture("round-table", "Round dining table", "Dining room", 1200, 1200, 750),
  furniture("bar-stool", "Bar stool", "Dining room", 420, 420, 750),
  furniture("desk", "Desk", "Basic furniture", 1400, 700, 750),
  furniture("office-chair", "Office chair", "Basic furniture", 600, 600, 1000),
  furniture("kitchen-base", "Base cabinet · 600", "Kitchen", 600, 600, 900),
  furniture("kitchen-drawers", "Drawer cabinet · 600", "Kitchen", 600, 600, 900),
  furniture("kitchen-wall", "Wall cabinet · 600", "Kitchen", 600, 350, 720),
  furniture("kitchen-sink", "Sink cabinet · 800", "Kitchen", 800, 600, 900),
  furniture("kitchen-hob", "Hob and oven · 600", "Kitchen", 600, 600, 900),
  furniture("kitchen-fridge", "Tall refrigerator", "Kitchen", 600, 650, 2000),
  furniture("kitchen-straight", "Straight kitchen set · 3 m", "Kitchen", 3000, 600, 900),
  furniture("kitchen-l", "L-shaped kitchen set", "Kitchen", 3000, 1800, 900),
  furniture("kitchen-island", "Kitchen island", "Kitchen", 1800, 900, 900),
  furniture("bath-vanity", "Vanity with basin", "Bathroom", 800, 500, 850),
  furniture("bath-tub", "Bathtub", "Bathroom", 800, 1700, 600),
  furniture("bath-shower", "Shower tray and screen", "Bathroom", 900, 900, 2000),
  { ...mep("toilet", "Toilet", "Bathroom", 380, 700, 800), id: "bath-toilet" },
  mep("air_terminal", "Ceiling air terminal", "HVAC", 600, 600, 120, 2600),
  mep("diffuser_supply", "Supply diffuser", "HVAC", 300, 300, 100, 2600),
  mep("diffuser_extract", "Extract grille", "HVAC", 300, 300, 100, 2600),
  mep("fan_coil", "Fan coil", "HVAC", 900, 600, 250, 2400),
  mep("ac_unit", "Wall AC unit", "HVAC", 850, 210, 290, 2200),
  mep("radiator", "Panel radiator", "Heating", 1000, 100, 600, 150),
  mep("boiler", "Boiler", "Heating", 600, 600, 1600),
  mep("heat_pump", "Heat pump", "Heating", 1200, 500, 1000),
  mep("chiller", "Chiller", "HVAC", 1600, 800, 1200),
  mep("sink", "Wash basin", "Plumbing", 600, 500, 850),
  mep("toilet", "Toilet", "Plumbing", 380, 700, 800),
  mep("sprinkler", "Sprinkler", "Plumbing", 80, 80, 100, 2600),
  mep("panel", "Distribution panel", "Electrical", 600, 180, 900, 1200),
  mep("socket", "Socket outlet", "Electrical", 80, 40, 80, 300),
  mep("lighting_fixture", "Ceiling light", "Electrical", 600, 600, 80, 2700),
];

export function componentPreset(id?: string) { return COMPONENT_CATALOG.find((item) => item.id === id); }
export function isArchitecturalComponent(id?: string) { return Boolean(id && !id.startsWith("mep-")); }
