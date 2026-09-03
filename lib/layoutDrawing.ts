/**
 * Layout drawing (levels / walls / doors / windows) — mm-based site sketch
 * data, independent of IFC shell but shareable under the same project key.
 */

import { type ReferenceUnderlay, underlayUvToWorld } from "./referenceUnderlay";

export const DEFAULT_LEVEL_HEIGHT_MM = 3000;
export const DEFAULT_WALL_THICKNESS_MM = 200;
export const DEFAULT_DOOR_WIDTH_MM = 900;
export const DEFAULT_DOOR_HEIGHT_MM = 2100;
export const DEFAULT_WINDOW_WIDTH_MM = 1200;
export const DEFAULT_WINDOW_HEIGHT_MM = 1400;
export const DEFAULT_WINDOW_SILL_MM = 900;

export type LayoutLevel = {
  id: string;
  projectId: string;
  name: string;
  /** Elevation of this storey floor, mm. */
  elevationMm: number;
  /** Floor-to-floor / wall default height for this level, mm. */
  heightMm: number;
  createdAt: number;
};

export type LayoutWall = {
  id: string;
  projectId: string;
  levelId: string;
  /** Optional upper level constraint; height is its elevation minus base level. */
  topLevelId?: string;
  /** Plan X/Z in mm (Y-up scene: X → X, Y → Z). */
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  thicknessMm: number;
  heightMm: number;
  createdAt: number;
  // -- Section 5: Curved wall (arc) --------------------------------------
  /** If true, wall follows an arc defined by arcCenter + arcRadius. */
  curved?: boolean;
  arcCenterXmm?: number;
  arcCenterYmm?: number;
  arcRadiusMm?: number;
  arcStartAngleDeg?: number;
  arcEndAngleDeg?: number;
  color?: string;
  /** Preset or custom material-library id. */
  material?: string;
  // -- Layered Wall Assemblies -------------------------------------------
  wallTypeId?: string;
  layers?: WallLayer[];
};

export type LayoutDoor = {
  id: string;
  projectId: string;
  wallId: string;
  /** Offset along wall from start, mm. */
  positionMm: number;
  widthMm: number;
  heightMm: number;
  /** Which jamb the hinge sits on (along the wall). */
  hinge: "start" | "end";
  /** Which side of the wall the leaf swings into (+1 / −1). */
  swing: 1 | -1;
  createdAt: number;
  // -- Section 6: Door style, head shape, color --------------------------
  style?: "wood" | "metal" | "glass" | "double";
  headShape?: "flat" | "arched" | "triangular";
  color?: string;
  material?: string;
};

export type LayoutWindow = {
  id: string;
  projectId: string;
  wallId: string;
  positionMm: number;
  widthMm: number;
  heightMm: number;
  /** Sill height above level floor, mm. */
  sillHeightMm: number;
  createdAt: number;
  // -- Section 6: Head shape + color -------------------------------------
  headShape?: "flat" | "arched" | "triangular";
  color?: string;
  material?: string;
};

/** Horizontal slab — floor plate or roof plate. */
export type LayoutSlab = {
  id: string;
  projectId: string;
  levelId: string;
  kind: "floor" | "roof";
  // -- Legacy rectangle fields (kept for backwards compatibility) ---------
  /** Plan rectangle AABB (mm). Computed from boundary if polygon mode. */
  minXmm: number;
  minYmm: number;
  maxXmm: number;
  maxYmm: number;
  /** Slab thickness mm. */
  thicknessMm: number;
  /**
   * Vertical offset from level elevation (mm).
   * Floor: usually 0. Roof: typically level heightMm.
   */
  elevationOffsetMm: number;
  createdAt: number;
  // -- Section 7: Sketch-based polygon boundary + holes ------------------
  /** Outer boundary polygon (plan mm). When present, supersedes the AABB. */
  boundary?: { xMm: number; yMm: number }[];
  /** Inner hole polygons (plan mm). */
  holes?: { xMm: number; yMm: number }[][];
  // -- Section 8: Roof per-edge slope control ----------------------------
  edgeSlopes?: { edgeIdx: number; pitchDeg: number; isSloped: boolean }[];
  /** Boundary was inferred from an enclosed wall region and follows wall edits. */
  autoBoundaryFromWalls?: boolean;
  // -- Section 9: Material & color ---------------------------------------
  color?: string;
  /** Preset or custom material-library id. */
  material?: string;
};

export const DEFAULT_SLAB_THICKNESS_MM = 200;

export function normalizeDoor(
  d: LayoutDoor & { hinge?: "start" | "end"; swing?: 1 | -1 },
): LayoutDoor {
  return {
    ...d,
    hinge: d.hinge === "end" ? "end" : "start",
    swing: d.swing === -1 ? -1 : 1,
  };
}

export type LayoutSketchLine = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  /** Drafting appearance. Boundary sketches override the display color to blue. */
  color?: string;
  thicknessPx?: number;
  pattern?: "solid" | "dashed" | "dotted" | "dash-dot";
  dashSizeMm?: number;
  gapSizeMm?: number;
  createdAt: number;
  curved?: boolean;
  arcCenterXmm?: number;
  arcCenterYmm?: number;
  arcRadiusMm?: number;
  arcStartAngleDeg?: number;
  arcEndAngleDeg?: number;
};

export type WallLayerFunction = "finish1" | "substrate" | "insulation" | "structure" | "core" | "finish2" | "membrane";

export type WallLayer = {
  id: string;
  name: string;
  function: WallLayerFunction;
  material: string;
  thicknessMm: number;
  color?: string;
};

export type WallType = {
  id: string;
  name: string;
  layers: WallLayer[];
  totalThicknessMm: number;
};

export type LayoutColumn = {
  id: string;
  projectId: string;
  levelId: string;
  topLevelId?: string;
  xMm: number;
  yMm: number;
  profile: "rect" | "circle";
  widthMm: number;
  depthMm: number;
  heightMm?: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutBeam = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  widthMm: number;
  depthMm: number;
  elevationOffsetMm: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutGridLine = {
  id: string;
  projectId: string;
  label: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  visibleLevels?: string[];
  createdAt: number;
};

export type StairShapeType = "straight" | "l-shape" | "u-shape" | "spiral";

export type LayoutStair = {
  id: string;
  projectId: string;
  levelId: string;
  /** Optional upper level constraint; rise is top level elevation minus base level. */
  topLevelId?: string;
  baseOffsetMm?: number;
  topOffsetMm?: number;
  stairType: StairShapeType;
  stairTypeId?: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  /** Second point / landing point for L-shape (turn vertex) or U-shape */
  landingXmm?: number;
  landingYmm?: number;
  turnDirection?: "left" | "right";
  widthMm: number;
  targetRiserHeightMm: number;
  treadDepthMm: number;
  nosingDepthMm?: number;
  hasRailingLeft?: boolean;
  hasRailingRight?: boolean;
  railingHeightMm?: number;
  railingStyle?: "standard" | "glass" | "pipe";
  // Spiral stair specific
  outerRadiusMm?: number;
  innerRadiusMm?: number;
  spiralAngleDeg?: number;
  color?: string;
  material?: string;
  treadMaterial?: string;
  stringerMaterial?: string;
  createdAt: number;
};

export type LayoutRamp = {
  id: string;
  projectId: string;
  levelId: string;
  topLevelId?: string;
  baseOffsetMm?: number;
  topOffsetMm?: number;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  landingXmm?: number;
  landingYmm?: number;
  widthMm: number;
  thicknessMm: number;
  hasRailingLeft?: boolean;
  hasRailingRight?: boolean;
  railingHeightMm?: number;
  railingStyle?: "standard" | "glass" | "pipe";
  maxSlopeRatio?: number; // e.g. 12 for 1:12
  color?: string;
  material?: string;
  createdAt: number;
};

export type DuctShape = "rectangular" | "round" | "oval";
export type DuctSystemType = "supply" | "extract" | "exhaust" | "outdoor" | "return";

export interface MepConnector {
  id: string;
  name: string;
  type: "duct" | "pipe" | "electrical" | "data";
  systemType?: string;
  relXmm: number; // offset relative to equipment center along width
  relYmm: number; // offset relative to equipment center along depth
  relZmm: number; // offset relative to equipment base elevation
  dir: [number, number, number]; // normal vector [dx, dy, dz]
  sizeMm?: number; // diameter for round pipe/duct
  widthMm?: number; // width for rect/oval duct
  heightMm?: number; // height for rect/oval duct
}

export type LayoutDuct = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationMm?: number;
  elevationOffsetMm?: number; // legacy alias
  shape: DuctShape;
  widthMm?: number; // for rectangular/oval
  heightMm?: number; // for rectangular/oval
  diameterMm?: number; // for round
  systemType: DuctSystemType;
  flowM3h?: number;
  velocityMs?: number;
  insulationThicknessMm?: number;
  isFlex?: boolean;
  isPlaceholder?: boolean;
  material?: string;
  color?: string;
  startConnectorId?: string;
  endConnectorId?: string;
  connectedStartEquipmentId?: string;
  connectedEndEquipmentId?: string;
  createdAt: number;
};

export type PipeSystemType =
  | "hydronic_supply"
  | "hydronic_return"
  | "domestic_cold"
  | "domestic_hot"
  | "sanitary_waste"
  | "fire_protection"
  | "gas";

export type LayoutPipe = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationMm?: number;
  elevationOffsetMm?: number;
  diameterMm: number; // outer diameter mm (e.g. 15, 22, 28, 35, 42, 54, 76, 108)
  systemType: PipeSystemType;
  slopePercent?: number; // for drainage / sanitary waste
  insulationThicknessMm?: number;
  isPlaceholder?: boolean;
  material?: string;
  color?: string;
  startConnectorId?: string;
  endConnectorId?: string;
  connectedStartEquipmentId?: string;
  connectedEndEquipmentId?: string;
  createdAt: number;
};

export type CableTrayType = "ladder" | "perforated" | "wire_mesh" | "conduit";

export type LayoutCableTray = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationMm?: number;
  elevationOffsetMm?: number;
  widthMm: number; // e.g. 100, 150, 200, 300, 400
  heightMm: number; // e.g. 50, 60, 100
  trayType: CableTrayType;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutWire = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationMm?: number;
  wireGauge?: string; // e.g. "3x1.5mm²", "5x2.5mm²"
  voltage?: number; // e.g. 230, 400
  systemType?: "power" | "lighting" | "data" | "control";
  circuitId?: string;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutWorkPlane = {
  id: string;
  name: string;
  originXmm: number;
  originYmm: number;
  elevationMm: number;
  slopeDeg?: number;
  rotationDeg?: number;
  isActive: boolean;
};

export type MepEquipmentCategory =
  | "diffuser_supply"
  | "diffuser_extract"
  | "diffuser_overflow"
  | "air_terminal"
  | "panel"
  | "socket"
  | "light"
  | "lighting_fixture"
  | "sprinkler"
  | "radiator"
  | "fan_coil"
  | "ac_unit"
  | "chiller"
  | "boiler"
  | "heat_pump"
  | "sink"
  | "toilet"
  | "generic_component";

export type LayoutMepEquipment = {
  id: string;
  projectId: string;
  levelId: string;
  category: MepEquipmentCategory;
  xMm: number;
  yMm: number;
  elevationMm?: number;
  elevationOffsetMm?: number;
  rotationDeg: number;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  flowM3h?: number;
  airflowM3h?: number;
  powerWatts?: number;
  coolingWatts?: number;
  connectedHostId?: string;
  connectors?: MepConnector[];
  name?: string;
  material?: string;
  color?: string;
  createdAt: number;
};

/**
 * Returns list of world-coordinate connectors for equipment, rotating with rotationDeg.
 */
export function getEquipmentConnectors(
  item: LayoutMepEquipment,
): Array<MepConnector & { worldXmm: number; worldYmm: number; worldZmm: number }> {
  const rad = ((item.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const w = item.widthMm ?? (
    item.category === "radiator" ? 1000 :
    item.category === "fan_coil" ? 900 :
    item.category === "ac_unit" ? 850 :
    item.category === "chiller" || item.category === "heat_pump" ? 1400 :
    item.category === "boiler" ? 650 :
    item.category === "toilet" ? 380 :
    item.category === "sink" ? 600 :
    item.category === "panel" ? 550 :
    item.category === "socket" ? 80 :
    item.category === "air_terminal" || item.category === "diffuser_supply" || item.category === "diffuser_extract" ? 600 :
    item.category === "lighting_fixture" || item.category === "light" ? 600 :
    item.category === "sprinkler" ? 80 : 400
  );
  const h = item.heightMm ?? (
    item.category === "radiator" ? 600 :
    item.category === "fan_coil" ? 250 :
    item.category === "ac_unit" ? 290 :
    item.category === "chiller" || item.category === "heat_pump" ? 1100 :
    item.category === "boiler" ? 1400 :
    item.category === "toilet" ? 780 :
    item.category === "sink" ? 850 :
    item.category === "panel" ? 800 :
    item.category === "socket" ? 80 :
    item.category === "air_terminal" || item.category === "diffuser_supply" || item.category === "diffuser_extract" ? 120 :
    item.category === "lighting_fixture" || item.category === "light" ? 80 :
    item.category === "sprinkler" ? 100 : 400
  );
  const d = item.depthMm ?? (
    item.category === "radiator" ? 100 :
    item.category === "fan_coil" ? 600 :
    item.category === "ac_unit" ? 210 :
    item.category === "chiller" || item.category === "heat_pump" ? 700 :
    item.category === "boiler" ? 650 :
    item.category === "toilet" ? 650 :
    item.category === "sink" ? 480 :
    item.category === "panel" ? 220 :
    item.category === "socket" ? 45 :
    item.category === "air_terminal" || item.category === "diffuser_supply" || item.category === "diffuser_extract" ? 600 :
    item.category === "lighting_fixture" || item.category === "light" ? 600 :
    item.category === "sprinkler" ? 80 : 400
  );

  const baseConnectors: MepConnector[] = item.connectors?.length
    ? item.connectors
    : item.category === "toilet"
    ? [
        {
          id: `${item.id}-c-cold`,
          name: "Cold Water Supply",
          type: "pipe",
          systemType: "domestic_cold",
          relXmm: -120,
          relYmm: -d / 2,
          relZmm: 600,
          dir: [0, -1, 0],
          sizeMm: 15,
        },
        {
          id: `${item.id}-c-waste`,
          name: "Sanitary Waste Outlet",
          type: "pipe",
          systemType: "sanitary_waste",
          relXmm: 0,
          relYmm: -d / 2 + 100,
          relZmm: 120,
          dir: [0, -1, 0],
          sizeMm: 100,
        },
      ]
    : item.category === "sink"
    ? [
        {
          id: `${item.id}-c-cold`,
          name: "Cold Water Supply",
          type: "pipe",
          systemType: "domestic_cold",
          relXmm: -80,
          relYmm: -d / 2,
          relZmm: 550,
          dir: [0, -1, 0],
          sizeMm: 15,
        },
        {
          id: `${item.id}-c-hot`,
          name: "Hot Water Supply",
          type: "pipe",
          systemType: "domestic_hot",
          relXmm: 80,
          relYmm: -d / 2,
          relZmm: 550,
          dir: [0, -1, 0],
          sizeMm: 15,
        },
        {
          id: `${item.id}-c-waste`,
          name: "Sanitary Waste Drain",
          type: "pipe",
          systemType: "sanitary_waste",
          relXmm: 0,
          relYmm: -d / 2,
          relZmm: 500,
          dir: [0, -1, 0],
          sizeMm: 40,
        },
      ]
    : item.category === "boiler"
    ? [
        {
          id: `${item.id}-c-cold`,
          name: "Cold Feed",
          type: "pipe",
          systemType: "domestic_cold",
          relXmm: -w / 2,
          relYmm: 0,
          relZmm: 150,
          dir: [-1, 0, 0],
          sizeMm: 22,
        },
        {
          id: `${item.id}-c-hot`,
          name: "Hot Supply",
          type: "pipe",
          systemType: "domestic_hot",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: h - 150,
          dir: [1, 0, 0],
          sizeMm: 22,
        },
        {
          id: `${item.id}-c-flow`,
          name: "Heating Flow (Vorlauf)",
          type: "pipe",
          systemType: "hydronic_supply",
          relXmm: -w / 2,
          relYmm: 0,
          relZmm: h - 250,
          dir: [-1, 0, 0],
          sizeMm: 28,
        },
        {
          id: `${item.id}-c-ret`,
          name: "Heating Return (Rücklauf)",
          type: "pipe",
          systemType: "hydronic_return",
          relXmm: -w / 2,
          relYmm: 0,
          relZmm: 350,
          dir: [-1, 0, 0],
          sizeMm: 28,
        },
      ]
    : item.category === "chiller" || item.category === "heat_pump"
    ? [
        {
          id: `${item.id}-c-flow`,
          name: "Hydronic Flow",
          type: "pipe",
          systemType: "hydronic_supply",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: 350,
          dir: [1, 0, 0],
          sizeMm: 35,
        },
        {
          id: `${item.id}-c-ret`,
          name: "Hydronic Return",
          type: "pipe",
          systemType: "hydronic_return",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: 650,
          dir: [1, 0, 0],
          sizeMm: 35,
        },
        {
          id: `${item.id}-c-elec`,
          name: "Power Supply",
          type: "electrical",
          relXmm: -w / 2 + 100,
          relYmm: 0,
          relZmm: h - 150,
          dir: [0, 0, 1],
        },
      ]
    : item.category === "panel"
    ? [
        {
          id: `${item.id}-c-main`,
          name: "Mains Electrical Infeed",
          type: "electrical",
          relXmm: 0,
          relYmm: 0,
          relZmm: h,
          dir: [0, 0, 1],
        },
      ]
    : item.category === "socket"
    ? [
        {
          id: `${item.id}-c-elec`,
          name: "Branch Power Feed",
          type: "electrical",
          relXmm: 0,
          relYmm: 0,
          relZmm: h / 2,
          dir: [0, 0, 1],
        },
      ]
    : item.category === "radiator"
    ? [
        {
          id: `${item.id}-c-flow`,
          name: "Heating Flow (Vorlauf)",
          type: "pipe",
          systemType: "hydronic_supply",
          relXmm: -w / 2,
          relYmm: 0,
          relZmm: h - 80,
          dir: [-1, 0, 0],
          sizeMm: 15,
        },
        {
          id: `${item.id}-c-ret`,
          name: "Heating Return (Rücklauf)",
          type: "pipe",
          systemType: "hydronic_return",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: 80,
          dir: [1, 0, 0],
          sizeMm: 15,
        },
      ]
    : item.category === "fan_coil" || item.category === "ac_unit"
    ? [
        {
          id: `${item.id}-c-sa`,
          name: "Supply Air (Zuluft)",
          type: "duct",
          systemType: "supply",
          relXmm: 0,
          relYmm: d / 2,
          relZmm: h / 2,
          dir: [0, 1, 0],
          widthMm: Math.round(w * 0.7),
          heightMm: Math.round(h * 0.6),
        },
        {
          id: `${item.id}-c-ra`,
          name: "Return Air (Abluft)",
          type: "duct",
          systemType: "extract",
          relXmm: 0,
          relYmm: -d / 2,
          relZmm: h / 2,
          dir: [0, -1, 0],
          widthMm: Math.round(w * 0.7),
          heightMm: Math.round(h * 0.6),
        },
        {
          id: `${item.id}-c-cw-sup`,
          name: "Chilled Water Supply",
          type: "pipe",
          systemType: "hydronic_supply",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: 80,
          dir: [1, 0, 0],
          sizeMm: 22,
        },
        {
          id: `${item.id}-c-cw-ret`,
          name: "Chilled Water Return",
          type: "pipe",
          systemType: "hydronic_return",
          relXmm: w / 2,
          relYmm: 0,
          relZmm: 160,
          dir: [1, 0, 0],
          sizeMm: 22,
        },
        {
          id: `${item.id}-c-drain`,
          name: "Condensate Drain",
          type: "pipe",
          systemType: "sanitary_waste",
          relXmm: w / 2 - 30,
          relYmm: 0,
          relZmm: 0,
          dir: [0, 0, -1],
          sizeMm: 20,
        },
      ]
    : item.category === "diffuser_supply" || item.category === "diffuser_extract"
    ? [
        {
          id: `${item.id}-c-top`,
          name: item.category === "diffuser_supply" ? "Supply Inlet" : "Extract Outlet",
          type: "duct",
          systemType: item.category === "diffuser_supply" ? "supply" : "extract",
          relXmm: 0,
          relYmm: 0,
          relZmm: 100,
          dir: [0, 0, 1],
          sizeMm: 160,
        },
      ]
    : [
        {
          id: `${item.id}-c-elec`,
          name: "Power Connection",
          type: "electrical",
          relXmm: 0,
          relYmm: 0,
          relZmm: h / 2,
          dir: [0, 0, 1],
        },
      ];

  const baseElev = item.elevationMm ?? item.elevationOffsetMm ?? 0;

  return baseConnectors.map((c) => {
    // 2D rotation of (relXmm, relYmm) around item center
    // Note: in 2D plan, X is horizontal, Y is vertical
    const rotX = c.relXmm * cos - c.relYmm * sin;
    const rotY = c.relXmm * sin + c.relYmm * cos;

    return {
      ...c,
      worldXmm: item.xMm + rotX,
      worldYmm: item.yMm + rotY,
      worldZmm: baseElev + c.relZmm,
    };
  });
}

export type MepSnapResult = {
  point: { xMm: number; yMm: number; zMm?: number };
  snapped: boolean;
  targetKind?: "connector" | "duct_endpoint" | "pipe_endpoint" | "tray_endpoint" | "duct_centerline" | "pipe_centerline";
  targetId?: string;
  systemType?: string;
};

export function snapMepPoint(
  point: { xMm: number; yMm: number },
  mepKind: "duct" | "pipe" | "cabletray" | "wire" | "equipment",
  equipment: LayoutMepEquipment[],
  ducts: LayoutDuct[],
  pipes: LayoutPipe[],
  cableTrays: LayoutCableTray[],
  toleranceMm = 350,
): MepSnapResult {
  // 1. Check equipment connectors matching MEP kind
  for (const eq of equipment) {
    const conns = getEquipmentConnectors(eq);
    for (const c of conns) {
      const match =
        (mepKind === "duct" && c.type === "duct") ||
        (mepKind === "pipe" && c.type === "pipe") ||
        (mepKind === "wire" && (c.type === "electrical" || c.type === "data")) ||
        (mepKind === "equipment");
      if (match) {
        const dist = Math.hypot(point.xMm - c.worldXmm, point.yMm - c.worldYmm);
        if (dist <= toleranceMm) {
          return {
            point: { xMm: Math.round(c.worldXmm), yMm: Math.round(c.worldYmm), zMm: c.worldZmm },
            snapped: true,
            targetKind: "connector",
            targetId: c.id,
            systemType: c.systemType,
          };
        }
      }
    }
  }

  // 2. Check existing ducts
  if (mepKind === "duct" || mepKind === "equipment") {
    for (const duct of ducts) {
      const dStart = Math.hypot(point.xMm - duct.startXmm, point.yMm - duct.startYmm);
      if (dStart <= toleranceMm) {
        return {
          point: { xMm: duct.startXmm, yMm: duct.startYmm, zMm: duct.elevationMm },
          snapped: true,
          targetKind: "duct_endpoint",
          targetId: duct.id,
          systemType: duct.systemType,
        };
      }
      const dEnd = Math.hypot(point.xMm - duct.endXmm, point.yMm - duct.endYmm);
      if (dEnd <= toleranceMm) {
        return {
          point: { xMm: duct.endXmm, yMm: duct.endYmm, zMm: duct.elevationMm },
          snapped: true,
          targetKind: "duct_endpoint",
          targetId: duct.id,
          systemType: duct.systemType,
        };
      }
      const perp = distPointSeg(point.xMm, point.yMm, duct.startXmm, duct.startYmm, duct.endXmm, duct.endYmm);
      if (perp.dist <= toleranceMm && perp.t >= 0.05 && perp.t <= 0.95) {
        return {
          point: { xMm: Math.round(perp.x), yMm: Math.round(perp.y), zMm: duct.elevationMm },
          snapped: true,
          targetKind: "duct_centerline",
          targetId: duct.id,
          systemType: duct.systemType,
        };
      }
    }
  }

  // 3. Check existing pipes
  if (mepKind === "pipe" || mepKind === "equipment") {
    for (const pipe of pipes) {
      const pStart = Math.hypot(point.xMm - pipe.startXmm, point.yMm - pipe.startYmm);
      if (pStart <= toleranceMm) {
        return {
          point: { xMm: pipe.startXmm, yMm: pipe.startYmm, zMm: pipe.elevationMm },
          snapped: true,
          targetKind: "pipe_endpoint",
          targetId: pipe.id,
          systemType: pipe.systemType,
        };
      }
      const pEnd = Math.hypot(point.xMm - pipe.endXmm, point.yMm - pipe.endYmm);
      if (pEnd <= toleranceMm) {
        return {
          point: { xMm: pipe.endXmm, yMm: pipe.endYmm, zMm: pipe.elevationMm },
          snapped: true,
          targetKind: "pipe_endpoint",
          targetId: pipe.id,
          systemType: pipe.systemType,
        };
      }
      const perp = distPointSeg(point.xMm, point.yMm, pipe.startXmm, pipe.startYmm, pipe.endXmm, pipe.endYmm);
      if (perp.dist <= toleranceMm && perp.t >= 0.05 && perp.t <= 0.95) {
        return {
          point: { xMm: Math.round(perp.x), yMm: Math.round(perp.y), zMm: pipe.elevationMm },
          snapped: true,
          targetKind: "pipe_centerline",
          targetId: pipe.id,
          systemType: pipe.systemType,
        };
      }
    }
  }

  // 4. Check existing cable trays
  if (mepKind === "cabletray") {
    for (const tray of cableTrays) {
      const tStart = Math.hypot(point.xMm - tray.startXmm, point.yMm - tray.startYmm);
      if (tStart <= toleranceMm) {
        return {
          point: { xMm: tray.startXmm, yMm: tray.startYmm, zMm: tray.elevationMm },
          snapped: true,
          targetKind: "tray_endpoint",
          targetId: tray.id,
        };
      }
      const tEnd = Math.hypot(point.xMm - tray.endXmm, point.yMm - tray.endYmm);
      if (tEnd <= toleranceMm) {
        return {
          point: { xMm: tray.endXmm, yMm: tray.endYmm, zMm: tray.elevationMm },
          snapped: true,
          targetKind: "tray_endpoint",
          targetId: tray.id,
        };
      }
    }
  }

  return { point: { ...point }, snapped: false };
}

export type SelectedElementRef = {
  kind:
    | "wall"
    | "door"
    | "window"
    | "slab"
    | "placement"
    | "column"
    | "beam"
    | "line"
    | "grid"
    | "group"
    | "stair"
    | "ramp"
    | "duct"
    | "pipe"
    | "cabletray"
    | "equipment"
    | "wire"
    | "section";
  id: string;
};

export type LayoutGroup = {
  id: string;
  projectId: string;
  name: string;
  elementRefs: SelectedElementRef[];
  createdAt: number;
};

export type LayoutToolId =
  | "wall"
  | "door"
  | "window"
  | "floor"
  | "roof"
  | "column"
  | "beam"
  | "grid"
  | "lines"
  | "trim"
  | "stair"
  | "ramp"
  | "section"
  | "duct"
  | "flex_duct"
  | "mep_placeholder"
  | "pipe"
  | "cabletray"
  | "wire"
  | "equipment"
  | "workplane";

export const DEFAULT_STAIR_WIDTH_MM = 1000;
export const DEFAULT_STAIR_RISER_MM = 175;
export const DEFAULT_STAIR_TREAD_MM = 280;
export const DEFAULT_STAIR_NOSING_MM = 25;
export const DEFAULT_RAMP_WIDTH_MM = 1200;
export const DEFAULT_RAMP_THICKNESS_MM = 150;
export const DEFAULT_RAILING_HEIGHT_MM = 900;

export const DEFAULT_DUCT_WIDTH_MM = 250;
export const DEFAULT_DUCT_HEIGHT_MM = 150;
export const DEFAULT_DUCT_DIAMETER_MM = 160;
export const DEFAULT_DUCT_ELEVATION_MM = 2600;

export const DEFAULT_PIPE_DIAMETER_MM = 32;
export const DEFAULT_PIPE_ELEVATION_MM = 2700;

export const DEFAULT_CABLE_TRAY_WIDTH_MM = 200;
export const DEFAULT_CABLE_TRAY_HEIGHT_MM = 60;
export const DEFAULT_CABLE_TRAY_ELEVATION_MM = 2800;

export const MEP_SYSTEM_COLORS = {
  duct_supply: "#06b6d4", // Cyan
  duct_extract: "#eab308", // Yellow
  duct_exhaust: "#ea580c", // Orange
  duct_outdoor: "#10b981", // Emerald
  pipe_hydronic_supply: "#ef4444", // Red
  pipe_hydronic_return: "#3b82f6", // Blue
  pipe_domestic_cold: "#0ea5e9", // Sky Blue
  pipe_domestic_hot: "#f43f5e", // Rose
  pipe_sanitary_waste: "#8b5cf6", // Purple
  pipe_gas: "#eab308", // Amber
  cabletray: "#64748b", // Slate
  equipment_supply: "#06b6d4",
  equipment_extract: "#eab308",
  equipment_overflow: "#10b981",
  equipment_electrical: "#f59e0b",
  equipment_plumbing: "#3b82f6",
} as const;

/**
 * Derive total rise (mm) from level elevation constraints + offsets.
 */
export function deriveRiseMm(
  levels: LayoutLevel[],
  baseLevelId: string,
  topLevelId?: string,
  baseOffsetMm = 0,
  topOffsetMm = 0,
  fallbackRiseMm = DEFAULT_LEVEL_HEIGHT_MM,
): number {
  const baseLevel = levels.find((l) => l.id === baseLevelId);
  const baseElev = (baseLevel?.elevationMm ?? 0) + (baseOffsetMm || 0);

  if (topLevelId) {
    const topLevel = levels.find((l) => l.id === topLevelId);
    if (topLevel) {
      const topElev = topLevel.elevationMm + (topOffsetMm || 0);
      const diff = topElev - baseElev;
      if (Math.abs(diff) >= 100) return Math.abs(diff);
    }
  }

  // If no top level specified, use base level height
  const levelHeight = baseLevel?.heightMm ?? fallbackRiseMm;
  return Math.max(100, levelHeight + (topOffsetMm || 0) - (baseOffsetMm || 0));
}

/**
 * Calculate stair metrics (riser count, actual riser height, actual tread count, stride formula 2R + T).
 */
export function calculateStairMetrics(
  totalRiseMm: number,
  targetRiserMm = DEFAULT_STAIR_RISER_MM,
  targetTreadMm = DEFAULT_STAIR_TREAD_MM,
) {
  const riserCount = Math.max(1, Math.round(totalRiseMm / Math.max(50, targetRiserMm)));
  const actualRiserMm = totalRiseMm / riserCount;
  const treadCount = Math.max(1, riserCount - 1);
  const totalRunLengthMm = treadCount * targetTreadMm;
  const strideValue = 2 * actualRiserMm + targetTreadMm; // 2R + T rule (ideal: 620-640mm)

  const warnings: string[] = [];
  if (actualRiserMm > 200) {
    warnings.push(`Riser height (${Math.round(actualRiserMm)}mm) exceeds recommended max 200mm.`);
  } else if (actualRiserMm < 140) {
    warnings.push(`Riser height (${Math.round(actualRiserMm)}mm) is below standard min 140mm.`);
  }

  if (targetTreadMm < 250) {
    warnings.push(`Tread depth (${Math.round(targetTreadMm)}mm) is below minimum 250mm.`);
  }

  if (strideValue < 600 || strideValue > 660) {
    warnings.push(`2R + T (${Math.round(strideValue)}mm) is outside ideal comfort range (620–640mm).`);
  }

  return {
    riserCount,
    actualRiserMm,
    treadCount,
    totalRunLengthMm,
    strideValue,
    isComfortable: warnings.length === 0,
    warnings,
  };
}

/**
 * Calculate ramp metrics (slope ratio 1:N, slope percentage, angle, ADA accessibility warning).
 */
export function calculateRampMetrics(
  totalRiseMm: number,
  runLengthMm: number,
) {
  const length = Math.max(10, runLengthMm);
  const slope = totalRiseMm / length;
  const slopeRatio = slope > 0 ? 1 / slope : Infinity;
  const slopePercent = slope * 100;
  const slopeAngleDeg = (Math.atan(slope) * 180) / Math.PI;

  const warnings: string[] = [];
  if (slopeRatio < 12) {
    warnings.push(
      `Slope 1:${slopeRatio.toFixed(1)} (${slopePercent.toFixed(1)}%) is steeper than recommended 1:12 (8.3%) max slope.`,
    );
  }

  return {
    slope,
    slopeRatio,
    slopePercent,
    slopeAngleDeg,
    exceedsMaxSlope: slopeRatio < 12,
    warnings,
  };
}

/**
 * Trim or extend two walls so they meet cleanly at their intersection point,
 * preserving the portions closest to clickPt1 and clickPt2 (Revit / AutoCAD standard).
 */
export function trimWallPair(
  w1: LayoutWall,
  clickPt1: { xMm: number; yMm: number },
  w2: LayoutWall,
  clickPt2: { xMm: number; yMm: number },
): {
  wall1Patch: Partial<LayoutWall>;
  wall2Patch: Partial<LayoutWall>;
} | null {
  if (w1.curved || w2.curved) return null;
  const hit = lineLineIntersection(
    w1.startXmm,
    w1.startYmm,
    w1.endXmm,
    w1.endYmm,
    w2.startXmm,
    w2.startYmm,
    w2.endXmm,
    w2.endYmm,
  );
  if (!hit) return null;

  // Retain the side that was actually picked. Comparing distances to the two
  // endpoints gives the wrong result when the intersection lies beyond a wall.
  const pickedSide = (wall: LayoutWall, point: { xMm: number; yMm: number }) => {
    const dx = wall.endXmm - wall.startXmm;
    const dy = wall.endYmm - wall.startYmm;
    const hitT = ((hit.x - wall.startXmm) * dx + (hit.y - wall.startYmm) * dy) /
      Math.max(dx * dx + dy * dy, 1e-9);
    const clickT = ((point.xMm - wall.startXmm) * dx + (point.yMm - wall.startYmm) * dy) /
      Math.max(dx * dx + dy * dy, 1e-9);
    return clickT <= hitT ? "start" : "end";
  };
  const side1 = pickedSide(w1, clickPt1);
  const wall1Patch: Partial<LayoutWall> =
    side1 === "start"
      ? { endXmm: Math.round(hit.x), endYmm: Math.round(hit.y) }
      : { startXmm: Math.round(hit.x), startYmm: Math.round(hit.y) };

  // For w2: keep endpoint closer to clickPt2, move other endpoint to hit
  const side2 = pickedSide(w2, clickPt2);
  const wall2Patch: Partial<LayoutWall> =
    side2 === "start"
      ? { endXmm: Math.round(hit.x), endYmm: Math.round(hit.y) }
      : { startXmm: Math.round(hit.x), startYmm: Math.round(hit.y) };

  return { wall1Patch, wall2Patch };
}

export type LayoutPresets = {
  wallThicknessMm: number[];
  doorSizes: { widthMm: number; heightMm: number }[];
  windowSizes: { widthMm: number; heightMm: number; sillHeightMm: number }[];
};

export const EMPTY_LAYOUT_PRESETS: LayoutPresets = {
  wallThicknessMm: [DEFAULT_WALL_THICKNESS_MM],
  doorSizes: [{ widthMm: DEFAULT_DOOR_WIDTH_MM, heightMm: DEFAULT_DOOR_HEIGHT_MM }],
  windowSizes: [
    {
      widthMm: DEFAULT_WINDOW_WIDTH_MM,
      heightMm: DEFAULT_WINDOW_HEIGHT_MM,
      sillHeightMm: DEFAULT_WINDOW_SILL_MM,
    },
  ],
};

export function newLayoutId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function wallLengthMm(w: LayoutWall): number {
  if (w.curved && w.arcRadiusMm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const deltaAngle = Math.abs(w.arcEndAngleDeg - w.arcStartAngleDeg);
    return w.arcRadiusMm * (deltaAngle * Math.PI) / 180;
  }
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  return Math.hypot(dx, dy);
}

export function wallAngleRad(w: LayoutWall): number {
  if (w.curved && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    // Tangent angle at the midpoint of the arc
    const midAngleDeg = (w.arcStartAngleDeg + w.arcEndAngleDeg) / 2;
    const midAngleRad = (midAngleDeg * Math.PI) / 180;
    return midAngleRad + Math.PI / 2; // Tangent direction
  }
  return Math.atan2(w.endYmm - w.startYmm, w.endXmm - w.startXmm);
}

export function wallAngleAtPositionRad(w: LayoutWall, positionMm: number): number {
  if (w.curved && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const len = wallLengthMm(w);
    const t = len > 0 ? Math.max(0, Math.min(1, positionMm / len)) : 0;
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const angle = startRad + (endRad - startRad) * t;
    return angle + Math.PI / 2;
  }
  return Math.atan2(w.endYmm - w.startYmm, w.endXmm - w.startXmm);
}

export function wallAngleDeg(w: LayoutWall): number {
  return (wallAngleRad(w) * 180) / Math.PI;
}

/** Keep start fixed; set length along current direction (min 50 mm). */
export function wallWithLengthFromStart(
  w: LayoutWall,
  lengthMm: number,
): Pick<LayoutWall, "endXmm" | "endYmm"> {
  const len = Math.max(50, lengthMm);
  const ang = wallAngleRad(w);
  return {
    endXmm: Math.round(w.startXmm + Math.cos(ang) * len),
    endYmm: Math.round(w.startYmm + Math.sin(ang) * len),
  };
}

/** Keep end fixed; set length by moving start. */
export function wallWithLengthFromEnd(
  w: LayoutWall,
  lengthMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm"> {
  const len = Math.max(50, lengthMm);
  const ang = wallAngleRad(w);
  return {
    startXmm: Math.round(w.endXmm - Math.cos(ang) * len),
    startYmm: Math.round(w.endYmm - Math.sin(ang) * len),
  };
}

/** Translate whole wall in plan mm (X → scene X, Y → scene Z). */
export function wallTranslated(
  w: LayoutWall,
  dxMm: number,
  dyMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: Math.round(w.startXmm + dxMm),
    startYmm: Math.round(w.startYmm + dyMm),
    endXmm: Math.round(w.endXmm + dxMm),
    endYmm: Math.round(w.endYmm + dyMm),
  };
}

/** Rotate about midpoint by delta degrees. */
export function wallRotatedAboutCenter(
  w: LayoutWall,
  deltaDeg: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const cx = (w.startXmm + w.endXmm) / 2;
  const cy = (w.startYmm + w.endYmm) / 2;
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: Math.round(cx + dx * cos - dy * sin),
      y: Math.round(cy + dx * sin + dy * cos),
    };
  };
  const s = rot(w.startXmm, w.startYmm);
  const e = rot(w.endXmm, w.endYmm);
  return { startXmm: s.x, startYmm: s.y, endXmm: e.x, endYmm: e.y };
}

/** Nudge perpendicular to wall (+ = left of start→end direction). */
export function wallOffsetPerpendicular(
  w: LayoutWall,
  distanceMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const ang = wallAngleRad(w);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  return wallTranslated(w, nx * distanceMm, ny * distanceMm);
}

/** Flip start/end (reverses hinge reference along wall). */
export function wallFlipped(
  w: LayoutWall,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: w.endXmm,
    startYmm: w.endYmm,
    endXmm: w.startXmm,
    endYmm: w.startYmm,
  };
}

// -- Beam geometry helpers -------------------------------------------------

export function beamLengthMm(b: LayoutBeam): number {
  return Math.hypot(b.endXmm - b.startXmm, b.endYmm - b.startYmm);
}

export function beamAngleDeg(b: LayoutBeam): number {
  return (
    (Math.atan2(b.endYmm - b.startYmm, b.endXmm - b.startXmm) * 180) / Math.PI
  );
}

/** Keep start fixed; set length along current direction (min 50 mm). */
export function beamWithLengthFromStart(
  b: LayoutBeam,
  lengthMm: number,
): Pick<LayoutBeam, "endXmm" | "endYmm"> {
  const len = Math.max(50, lengthMm);
  const dx = b.endXmm - b.startXmm;
  const dy = b.endYmm - b.startYmm;
  const len0 = Math.hypot(dx, dy);
  const ux = len0 > 1e-9 ? dx / len0 : 1;
  const uy = len0 > 1e-9 ? dy / len0 : 0;
  return {
    endXmm: Math.round(b.startXmm + ux * len),
    endYmm: Math.round(b.startYmm + uy * len),
  };
}

/** Keep end fixed; set length by moving start. */
export function beamWithLengthFromEnd(
  b: LayoutBeam,
  lengthMm: number,
): Pick<LayoutBeam, "startXmm" | "startYmm"> {
  const len = Math.max(50, lengthMm);
  const dx = b.endXmm - b.startXmm;
  const dy = b.endYmm - b.startYmm;
  const len0 = Math.hypot(dx, dy);
  const ux = len0 > 1e-9 ? dx / len0 : 1;
  const uy = len0 > 1e-9 ? dy / len0 : 0;
  return {
    startXmm: Math.round(b.endXmm - ux * len),
    startYmm: Math.round(b.endYmm - uy * len),
  };
}

/** Translate whole beam in plan mm (X → scene X, Y → scene Z). */
export function beamTranslated(
  b: LayoutBeam,
  dxMm: number,
  dyMm: number,
): Pick<LayoutBeam, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: Math.round(b.startXmm + dxMm),
    startYmm: Math.round(b.startYmm + dyMm),
    endXmm: Math.round(b.endXmm + dxMm),
    endYmm: Math.round(b.endYmm + dyMm),
  };
}

/** Rotate both endpoints about the beam midpoint by delta degrees. */
export function beamRotatedAboutCenter(
  b: LayoutBeam,
  deltaDeg: number,
): Pick<LayoutBeam, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const cx = (b.startXmm + b.endXmm) / 2;
  const cy = (b.startYmm + b.endYmm) / 2;
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: Math.round(cx + dx * cos - dy * sin),
      y: Math.round(cy + dx * sin + dy * cos),
    };
  };
  const s = rot(b.startXmm, b.startYmm);
  const e = rot(b.endXmm, b.endYmm);
  return { startXmm: s.x, startYmm: s.y, endXmm: e.x, endYmm: e.y };
}

// -- Column geometry helpers -----------------------------------------------

/** Translate a column in plan mm (X → scene X, Y → scene Z). */
export function columnTranslated(
  c: LayoutColumn,
  dxMm: number,
  dyMm: number,
): Pick<LayoutColumn, "xMm" | "yMm"> {
  return { xMm: Math.round(c.xMm + dxMm), yMm: Math.round(c.yMm + dyMm) };
}

/** Unit normal in plan (+ = left of start→end). */
export function wallUnitPerp(w: LayoutWall): { nx: number; ny: number } {
  const ang = wallAngleRad(w);
  return { nx: -Math.sin(ang), ny: Math.cos(ang) };
}

export function wallsAreParallel(
  a: LayoutWall,
  b: LayoutWall,
  tolDeg = 8,
): boolean {
  let d = Math.abs(wallAngleDeg(a) - wallAngleDeg(b)) % 180;
  if (d > 90) d = 180 - d;
  return d <= tolDeg;
}

/** Signed centerline-to-centerline gap along A's normal. */
export function parallelWallCenterGapMm(a: LayoutWall, b: LayoutWall): number {
  const { nx, ny } = wallUnitPerp(a);
  const acx = (a.startXmm + a.endXmm) / 2;
  const acy = (a.startYmm + a.endYmm) / 2;
  const bcx = (b.startXmm + b.endXmm) / 2;
  const bcy = (b.startYmm + b.endYmm) / 2;
  return (bcx - acx) * nx + (bcy - acy) * ny;
}

/**
 * Nearest parallel wall face-to-face gap (mm, absolute).
 * Face gap ≈ |center gap| − (thicknessA + thicknessB) / 2.
 */
export function nearestParallelFaceGapMm(
  wall: LayoutWall,
  walls: LayoutWall[],
): { otherId: string; faceGapMm: number; signedCenterGapMm: number } | null {
  let best: {
    otherId: string;
    faceGapMm: number;
    signedCenterGapMm: number;
  } | null = null;
  for (const other of walls) {
    if (other.id === wall.id) continue;
    if (other.levelId !== wall.levelId) continue;
    if (!wallsAreParallel(wall, other)) continue;
    const signed = parallelWallCenterGapMm(wall, other);
    const face =
      Math.abs(signed) - (wall.thicknessMm + other.thicknessMm) / 2;
    if (!best || Math.abs(face) < Math.abs(best.faceGapMm)) {
      best = {
        otherId: other.id,
        faceGapMm: Math.round(face),
        signedCenterGapMm: signed,
      };
    }
  }
  return best;
}

/**
 * Move `wall` so its face-to-face gap to `other` becomes `targetFaceGapMm`
 * (preserves which side the other wall is on).
 */
export function wallWithFaceGapTo(
  wall: LayoutWall,
  other: LayoutWall,
  targetFaceGapMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const signed = parallelWallCenterGapMm(wall, other);
  const side = signed >= 0 ? 1 : -1;
  const desiredCenter =
    side *
    (Math.max(0, targetFaceGapMm) +
      (wall.thicknessMm + other.thicknessMm) / 2);
  const delta = desiredCenter - signed;
  return wallOffsetPerpendicular(wall, delta);
}

export type WallCenterlineMm = {
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
};

const JOIN_EPS_MM = 350;

export type PlanSnapType =
  | "endpoint"
  | "midpoint"
  | "center"
  | "node"
  | "quadrant"
  | "intersection"
  | "apparent"
  | "insertion"
  | "perpendicular"
  | "extension"
  | "tangent"
  | "nearest"
  | "parallel";

export type PlanSnapModes = Record<PlanSnapType, boolean>;
export const DEFAULT_PLAN_SNAP_MODES: PlanSnapModes = {
  endpoint: true, midpoint: true, center: true, node: false, quadrant: true,
  intersection: true, apparent: true, insertion: true, perpendicular: true,
  extension: true, tangent: true, nearest: true, parallel: true,
};

export type PlanSnapResult = {
  point: { xMm: number; yMm: number };
  type: PlanSnapType | null;
  wallId?: string;
};

function lineLineIntersection(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-9) return null; // parallel
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  return { x: ax + t * rX, y: ay + t * rY };
}

function distPointSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number; x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    return { dist: Math.hypot(px - ax, py - ay), t: 0, x: ax, y: ay };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { dist: Math.hypot(px - x, py - y), t, x, y };
}

/**
 * CAD plan snap shared by wall drawing and slab boundary picking.
 * Priority is endpoint -> intersection -> midpoint -> perpendicular projection.
 */
export function snapPlanPointToWalls(
  point: { xMm: number; yMm: number },
  walls: LayoutWall[],
  levelId: string,
  toleranceMm = 350,
  modes: PlanSnapModes = DEFAULT_PLAN_SNAP_MODES,
  from?: { xMm: number; yMm: number } | null,
  underlays?: ReferenceUnderlay[],
): PlanSnapResult {
  const levelWalls = walls.filter((w) => w.levelId === levelId);
  const straight = levelWalls.filter((w) => !w.curved);
  const candidates: Array<{
    point: { xMm: number; yMm: number };
    type: PlanSnapType;
    wallId?: string;
    priority: number;
    distance: number;
  }> = [];
  const add = (
    xMm: number,
    yMm: number,
    type: PlanSnapType,
    priority: number,
    wallId?: string,
  ) => {
    const distance = Math.hypot(point.xMm - xMm, point.yMm - yMm);
    if (distance <= toleranceMm) {
      candidates.push({
        point: { xMm: Math.round(xMm), yMm: Math.round(yMm) },
        type,
        wallId,
        priority,
        distance,
      });
    }
  };

  for (const wall of levelWalls) {
    if (modes.endpoint) {
      add(wall.startXmm, wall.startYmm, "endpoint", 0, wall.id);
      add(wall.endXmm, wall.endYmm, "endpoint", 0, wall.id);
    }
    if (modes.node) {
      add(wall.startXmm, wall.startYmm, "node", 1, wall.id);
      add(wall.endXmm, wall.endYmm, "node", 1, wall.id);
    }
    if (wall.curved && wall.arcCenterXmm != null && wall.arcCenterYmm != null && wall.arcRadiusMm != null) {
      const cx = wall.arcCenterXmm, cy = wall.arcCenterYmm, r = wall.arcRadiusMm;
      if (modes.center) add(cx, cy, "center", 1, wall.id);
      if (modes.quadrant) for (const [qx, qy] of [[cx + r, cy], [cx - r, cy], [cx, cy + r], [cx, cy - r]]) add(qx, qy, "quadrant", 2, wall.id);
      const vx = point.xMm - cx, vy = point.yMm - cy, vl = Math.hypot(vx, vy) || 1;
      if (modes.nearest) add(cx + vx / vl * r, cy + vy / vl * r, "nearest", 6, wall.id);
      if (modes.tangent && from) {
        const fx = from.xMm - cx, fy = from.yMm - cy, d = Math.hypot(fx, fy);
        if (d > r) { const a = Math.atan2(fy, fx), off = Math.acos(r / d); for (const ta of [a + off, a - off]) add(cx + Math.cos(ta) * r, cy + Math.sin(ta) * r, "tangent", 3, wall.id); }
      }
      continue;
    }
    const projected = distPointSeg(point.xMm, point.yMm, wall.startXmm, wall.startYmm, wall.endXmm, wall.endYmm);
    if (modes.midpoint)
      add(
        (wall.startXmm + wall.endXmm) / 2,
        (wall.startYmm + wall.endYmm) / 2,
        "midpoint",
        2,
        wall.id,
      );
    // Layout walls are parametric objects; their centerline origin is their
    // insertion/base point (openings and placed objects use the same concept).
    if (modes.insertion) add(
      (wall.startXmm + wall.endXmm) / 2,
      (wall.startYmm + wall.endYmm) / 2,
      "insertion",
      3,
      wall.id,
    );
    if (modes.nearest && projected.t > 0.01 && projected.t < 0.99) add(projected.x, projected.y, "nearest", 6, wall.id);
    if (modes.perpendicular && from) {
      const perp = distPointSeg(from.xMm, from.yMm, wall.startXmm, wall.startYmm, wall.endXmm, wall.endYmm);
      if (perp.t > 0.01 && perp.t < 0.99) add(perp.x, perp.y, "perpendicular", 3, wall.id);
    }
    // AutoCAD-style extension snap: use the unbounded wall line outside its
    // endpoints, while keeping the same finite aperture tolerance.
    const dx = wall.endXmm - wall.startXmm;
    const dy = wall.endYmm - wall.startYmm;
    const len2 = dx * dx + dy * dy;
    if (len2 > 1e-9) {
      const t = ((point.xMm - wall.startXmm) * dx + (point.yMm - wall.startYmm) * dy) / len2;
      if (modes.extension && (t < -0.01 || t > 1.01)) {
        add(wall.startXmm + t * dx, wall.startYmm + t * dy, "extension", 4, wall.id);
      }
    }
    // Wall boundary face lines (outer & inner edges for exact wall thickness & face snapping)
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const halfThick = (wall.thicknessMm || 200) / 2;
      const nx = (-dy / len) * halfThick;
      const ny = (dx / len) * halfThick;

      for (const side of [1, -1]) {
        const sx = wall.startXmm + nx * side;
        const sy = wall.startYmm + ny * side;
        const ex = wall.endXmm + nx * side;
        const ey = wall.endYmm + ny * side;

        if (modes.endpoint || modes.node) {
          add(sx, sy, "endpoint", 0, wall.id);
          add(ex, ey, "endpoint", 0, wall.id);
        }
        if (modes.midpoint) {
          add((sx + ex) / 2, (sy + ey) / 2, "midpoint", 2, wall.id);
        }
        const projFace = distPointSeg(point.xMm, point.yMm, sx, sy, ex, ey);
        if (modes.nearest && projFace.t >= 0 && projFace.t <= 1) {
          add(projFace.x, projFace.y, "nearest", 4, wall.id);
        }
        if (modes.perpendicular && from) {
          const perpFace = distPointSeg(from.xMm, from.yMm, sx, sy, ex, ey);
          if (perpFace.t >= 0 && perpFace.t <= 1) {
            add(perpFace.x, perpFace.y, "perpendicular", 2, wall.id);
          }
        }
      }
    }
    if (modes.parallel && from) {
      const a = Math.atan2(dy, dx), len = Math.hypot(point.xMm - from.xMm, point.yMm - from.yMm);
      for (const pa of [a, a + Math.PI]) add(from.xMm + Math.cos(pa) * len, from.yMm + Math.sin(pa) * len, "parallel", 5, wall.id);
    }
  }

  // Evaluate DWG / reference underlays vector line segments
  if (underlays && underlays.length > 0) {
    const underlaySegs: { ax: number; ay: number; bx: number; by: number }[] = [];
    for (const u of underlays) {
      if (u.levelId !== levelId || !u.snapSegments?.length) continue;
      for (const s of u.snapSegments) {
        const a = underlayUvToWorld(u, s.u0, s.v0);
        const b = underlayUvToWorld(u, s.u1, s.v1);
        underlaySegs.push({ ax: a.xMm, ay: a.yMm, bx: b.xMm, by: b.yMm });
      }
    }

    for (let i = 0; i < underlaySegs.length; i++) {
      const seg = underlaySegs[i];
      const midX = (seg.ax + seg.bx) / 2;
      const midY = (seg.ay + seg.by) / 2;
      const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
      if (Math.hypot(point.xMm - midX, point.yMm - midY) > segLen / 2 + toleranceMm + 100) {
        continue;
      }

      if (modes.endpoint || modes.node) {
        add(seg.ax, seg.ay, "endpoint", 0);
        add(seg.bx, seg.by, "endpoint", 0);
      }
      if (modes.midpoint) {
        add(midX, midY, "midpoint", 2);
      }
      const projected = distPointSeg(point.xMm, point.yMm, seg.ax, seg.ay, seg.bx, seg.by);
      if (modes.nearest && projected.t > 0.01 && projected.t < 0.99) {
        add(projected.x, projected.y, "nearest", 6);
      }
      if (modes.perpendicular && from) {
        const perp = distPointSeg(from.xMm, from.yMm, seg.ax, seg.ay, seg.bx, seg.by);
        if (perp.t > 0.01 && perp.t < 0.99) add(perp.x, perp.y, "perpendicular", 4);
      }
      if (modes.intersection) {
        for (let j = i + 1; j < Math.min(underlaySegs.length, i + 25); j++) {
          const segB = underlaySegs[j];
          const hit = lineLineIntersection(
            seg.ax, seg.ay, seg.bx, seg.by,
            segB.ax, segB.ay, segB.bx, segB.by,
          );
          if (hit) {
            const onA = distPointSeg(hit.x, hit.y, seg.ax, seg.ay, seg.bx, seg.by);
            const onB = distPointSeg(hit.x, hit.y, segB.ax, segB.ay, segB.bx, segB.by);
            if (onA.dist <= 5 && onB.dist <= 5) {
              add(hit.x, hit.y, "intersection", 1);
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < straight.length; i++) {
    for (let j = i + 1; j < straight.length; j++) {
      const a = straight[i];
      const b = straight[j];
      const hit = lineLineIntersection(
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (!hit) continue;
      const onA = distPointSeg(
        hit.x,
        hit.y,
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
      );
      const onB = distPointSeg(
        hit.x,
        hit.y,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (modes.intersection && onA.dist <= 1 && onB.dist <= 1) {
        add(hit.x, hit.y, "intersection", 1);
      } else if (modes.apparent) {
        add(hit.x, hit.y, "apparent", 4);
      }
    }
  }

  // The aperture is proximity-led. Priority only breaks near-equal candidates;
  // otherwise a distant endpoint makes the cursor feel sticky and imprecise.
  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority);
  const best = candidates[0];
  return best
    ? { point: best.point, type: best.type, wallId: best.wallId }
    : { point: { ...point }, type: null };
}

/**
 * Extend wall centerlines to clean L / T joints (miter at intersection).
 * Recalculate whenever walls change — used by LayoutSceneLayer mesh build.
 */
export function joinedWallCenterlines(
  walls: LayoutWall[],
): Map<string, WallCenterlineMm> {
  const result = new Map<string, WallCenterlineMm>();
  for (const w of walls) {
    result.set(w.id, {
      startXmm: w.startXmm,
      startYmm: w.startYmm,
      endXmm: w.endXmm,
      endYmm: w.endYmm,
    });
  }

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      if (a.levelId !== b.levelId) continue;
      const hit = lineLineIntersection(
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (!hit) continue;

      const endsA: Array<"start" | "end"> = ["start", "end"];
      const endsB: Array<"start" | "end"> = ["start", "end"];
      const maxThickness = Math.max(JOIN_EPS_MM, a.thicknessMm, b.thicknessMm);

      // L-corner: both walls have an endpoint near each other
      for (const ea of endsA) {
        const ax = ea === "start" ? a.startXmm : a.endXmm;
        const ay = ea === "start" ? a.startYmm : a.endYmm;
        for (const eb of endsB) {
          const bx = eb === "start" ? b.startXmm : b.endXmm;
          const by = eb === "start" ? b.startYmm : b.endYmm;
          if (Math.hypot(ax - bx, ay - by) > maxThickness) continue;
          // Intersection should lie near the shared corner
          if (Math.hypot(hit.x - ax, hit.y - ay) > maxThickness * 2.5) continue;
          const ra = result.get(a.id)!;
          const rb = result.get(b.id)!;
          if (ea === "start") {
            ra.startXmm = hit.x;
            ra.startYmm = hit.y;
          } else {
            ra.endXmm = hit.x;
            ra.endYmm = hit.y;
          }
          if (eb === "start") {
            rb.startXmm = hit.x;
            rb.startYmm = hit.y;
          } else {
            rb.endXmm = hit.x;
            rb.endYmm = hit.y;
          }
        }
      }

      // T-junction: endpoint of one wall sits mid-segment on the other
      const joinTol = Math.max(a.thicknessMm, b.thicknessMm) * 0.9 + 50;
      for (const [stem, through] of [
        [a, b],
        [b, a],
      ] as const) {
        for (const which of ["start", "end"] as const) {
          const px = which === "start" ? stem.startXmm : stem.endXmm;
          const py = which === "start" ? stem.startYmm : stem.endYmm;
          const near = distPointSeg(
            px,
            py,
            through.startXmm,
            through.startYmm,
            through.endXmm,
            through.endYmm,
          );
          if (near.dist <= joinTol && near.t >= 0.001 && near.t <= 0.999) {
            const rStem = result.get(stem.id)!;
            if (which === "start") {
              rStem.startXmm = near.x;
              rStem.startYmm = near.y;
            } else {
              rStem.endXmm = near.x;
              rStem.endYmm = near.y;
            }
          }
        }
      }
    }
  }

  return result;
}

export type WallMiterOffsets = {
  startOffsetLeftMm: number;
  startOffsetRightMm: number;
  endOffsetLeftMm: number;
  endOffsetRightMm: number;
  startJoined?: boolean;
  endJoined?: boolean;
};

/**
 * Multi-wall junction solver for 2, 3, 4, or 5+ walls meeting at any angle.
 * Computes exact mitered boundary line intersections for seamless corner joins.
 */
export function solveWallJunctions(
  walls: LayoutWall[],
  centerlines?: Map<string, WallCenterlineMm>,
): Map<string, WallMiterOffsets> {
  const offsets = new Map<string, WallMiterOffsets>();
  for (const w of walls) {
    offsets.set(w.id, {
      startOffsetLeftMm: 0,
      startOffsetRightMm: 0,
      endOffsetLeftMm: 0,
      endOffsetRightMm: 0,
      startJoined: false,
      endJoined: false,
    });
  }

  // Group straight walls by level
  const levels = new Set(walls.map((w) => w.levelId));
  for (const levelId of levels) {
    const levelWalls = walls.filter((w) => w.levelId === levelId && !w.curved);
    if (levelWalls.length < 2) continue;

    type EndpointRef = {
      wall: LayoutWall;
      end: "start" | "end";
      xMm: number;
      yMm: number;
      dirX: number;
      dirY: number;
      angle: number;
      halfThick: number;
    };

    const endpoints: EndpointRef[] = [];
    for (const w of levelWalls) {
      const cl = centerlines?.get(w.id) ?? {
        startXmm: w.startXmm,
        startYmm: w.startYmm,
        endXmm: w.endXmm,
        endYmm: w.endYmm,
      };
      const dx = cl.endXmm - cl.startXmm;
      const dy = cl.endYmm - cl.startYmm;
      const len = Math.hypot(dx, dy);
      if (len < 10) continue;
      const ux = dx / len;
      const uy = dy / len;
      const halfThick = (w.thicknessMm || 200) / 2;

      // At start, direction pointing into the wall away from start is (+ux, +uy)
      endpoints.push({
        wall: w,
        end: "start",
        xMm: cl.startXmm,
        yMm: cl.startYmm,
        dirX: ux,
        dirY: uy,
        angle: Math.atan2(uy, ux),
        halfThick,
      });

      // At end, direction pointing into the wall away from end is (-ux, -uy)
      endpoints.push({
        wall: w,
        end: "end",
        xMm: cl.endXmm,
        yMm: cl.endYmm,
        dirX: -ux,
        dirY: -uy,
        angle: Math.atan2(-uy, -ux),
        halfThick,
      });
    }

    // Cluster endpoints into junction nodes. Use transitive clustering so a
    // slightly noisy multi-wall node is still solved as one junction.
    const visited = new Set<number>();
    for (let i = 0; i < endpoints.length; i++) {
      if (visited.has(i)) continue;
      const cluster: EndpointRef[] = [endpoints[i]];
      visited.add(i);

      for (let cursor = 0; cursor < cluster.length; cursor++) {
        const seed = cluster[cursor];
        for (let j = 0; j < endpoints.length; j++) {
          if (visited.has(j)) continue;
          const candidate = endpoints[j];
          const d = Math.hypot(
            seed.xMm - candidate.xMm,
            seed.yMm - candidate.yMm,
          );
          const tolerance = Math.max(
            JOIN_EPS_MM,
            Math.min(180, (seed.halfThick + candidate.halfThick) * 0.75),
          );
          if (d <= tolerance) {
            cluster.push(candidate);
            visited.add(j);
          }
        }
      }

      if (cluster.length < 2) continue;

      for (const item of cluster) {
        const off = offsets.get(item.wall.id);
        if (off) {
          if (item.end === "start") off.startJoined = true;
          else off.endJoined = true;
        }
      }

      // Sort cluster radially by angle
      cluster.sort((a, b) => a.angle - b.angle);

      // Shared node point
      const nodeX = cluster.reduce((sum, e) => sum + e.xMm, 0) / cluster.length;
      const nodeY = cluster.reduce((sum, e) => sum + e.yMm, 0) / cluster.length;

      const N = cluster.length;
      for (let k = 0; k < N; k++) {
        const curr = cluster[k];
        const next = cluster[(k + 1) % N];

        if (curr.wall.id === next.wall.id) continue;

        // Curr left edge: normal is (-dirY, +dirX)
        const leftP1x = nodeX - curr.dirY * curr.halfThick;
        const leftP1y = nodeY + curr.dirX * curr.halfThick;
        const leftP2x = leftP1x + curr.dirX * 1000;
        const leftP2y = leftP1y + curr.dirY * 1000;

        // Next right edge: normal is (+dirY, -dirX)
        const rightP1x = nodeX + next.dirY * next.halfThick;
        const rightP1y = nodeY - next.dirX * next.halfThick;
        const rightP2x = rightP1x + next.dirX * 1000;
        const rightP2y = rightP1y + next.dirY * 1000;

        const hit = lineLineIntersection(leftP1x, leftP1y, leftP2x, leftP2y, rightP1x, rightP1y, rightP2x, rightP2y);
        if (hit) {
          const projCurr = (hit.x - nodeX) * curr.dirX + (hit.y - nodeY) * curr.dirY;
          const projNext = (hit.x - nodeX) * next.dirX + (hit.y - nodeY) * next.dirY;

          const maxMiterCurr = curr.halfThick * 3;
          const maxMiterNext = next.halfThick * 3;

          const clampedCurr = Math.max(-maxMiterCurr, Math.min(maxMiterCurr, projCurr));
          const clampedNext = Math.max(-maxMiterNext, Math.min(maxMiterNext, projNext));

          const offCurr = offsets.get(curr.wall.id);
          if (offCurr) {
            if (curr.end === "start") {
              offCurr.startOffsetLeftMm = clampedCurr;
            } else {
              offCurr.endOffsetRightMm = clampedCurr;
            }
          }

          const offNext = offsets.get(next.wall.id);
          if (offNext) {
            if (next.end === "start") {
              offNext.startOffsetRightMm = clampedNext;
            } else {
              offNext.endOffsetLeftMm = clampedNext;
            }
          }
        }
      }
    }

    // Flag T-junction stem wall endpoints as joined and calculate trim offsets so 3D meshes do not overlap
    for (const w of levelWalls) {
      for (const other of levelWalls) {
        if (w.id === other.id) continue;
        const off = offsets.get(w.id);
        if (!off) continue;
        const halfThickOther = (other.thicknessMm || 200) / 2;
        const joinTol = Math.max(w.thicknessMm || 200, other.thicknessMm || 200) * 1.2 + 50;

        const distStart = distPointSeg(
          w.startXmm,
          w.startYmm,
          other.startXmm,
          other.startYmm,
          other.endXmm,
          other.endYmm,
        );
        if (distStart.dist <= joinTol && distStart.t >= 0.001 && distStart.t <= 0.999) {
          off.startJoined = true;
          const dxW = w.endXmm - w.startXmm;
          const dyW = w.endYmm - w.startYmm;
          const lenW = Math.hypot(dxW, dyW) || 1;
          const uxW = dxW / lenW;
          const uyW = dyW / lenW;

          const dxO = other.endXmm - other.startXmm;
          const dyO = other.endYmm - other.startYmm;
          const lenO = Math.hypot(dxO, dyO) || 1;
          const uxO = dxO / lenO;
          const uyO = dyO / lenO;

          const sinAngle = Math.abs(uxW * uyO - uyW * uxO);
          const trimDist = sinAngle > 0.1 ? halfThickOther / sinAngle : halfThickOther;

          off.startOffsetLeftMm = Math.max(off.startOffsetLeftMm, trimDist);
          off.startOffsetRightMm = Math.max(off.startOffsetRightMm, trimDist);
        }

        const distEnd = distPointSeg(
          w.endXmm,
          w.endYmm,
          other.startXmm,
          other.startYmm,
          other.endXmm,
          other.endYmm,
        );
        if (distEnd.dist <= joinTol && distEnd.t >= 0.001 && distEnd.t <= 0.999) {
          off.endJoined = true;
          const dxW = w.startXmm - w.endXmm;
          const dyW = w.startYmm - w.endYmm;
          const lenW = Math.hypot(dxW, dyW) || 1;
          const uxW = dxW / lenW;
          const uyW = dyW / lenW;

          const dxO = other.endXmm - other.startXmm;
          const dyO = other.endYmm - other.startYmm;
          const lenO = Math.hypot(dxO, dyO) || 1;
          const uxO = dxO / lenO;
          const uyO = dyO / lenO;

          const sinAngle = Math.abs(uxW * uyO - uyW * uxO);
          const trimDist = sinAngle > 0.1 ? halfThickOther / sinAngle : halfThickOther;

          off.endOffsetLeftMm = Math.max(off.endOffsetLeftMm, trimDist);
          off.endOffsetRightMm = Math.max(off.endOffsetRightMm, trimDist);
        }
      }
    }
  }

  return offsets;
}

/** Point along wall at offset mm from start (clamped). */
export function pointOnWallMm(
  w: LayoutWall,
  offsetMm: number,
): { xMm: number; yMm: number } {
  const len = wallLengthMm(w);
  const t = len > 0 ? Math.max(0, Math.min(1, offsetMm / len)) : 0;
  if (w.curved && w.arcRadiusMm != null && w.arcCenterXmm != null && w.arcCenterYmm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const angle = startRad + (endRad - startRad) * t;
    return {
      xMm: Math.round(w.arcCenterXmm + w.arcRadiusMm * Math.cos(angle)),
      yMm: Math.round(w.arcCenterYmm + w.arcRadiusMm * Math.sin(angle)),
    };
  }
  return {
    xMm: Math.round(w.startXmm + (w.endXmm - w.startXmm) * t),
    yMm: Math.round(w.startYmm + (w.endYmm - w.startYmm) * t),
  };
}

/** Nearest offset along wall to a plan point (mm). */
export function nearestOffsetOnWallMm(
  w: LayoutWall,
  xMm: number,
  yMm: number,
): number {
  if (w.curved && w.arcRadiusMm != null && w.arcCenterXmm != null && w.arcCenterYmm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const dx = xMm - w.arcCenterXmm;
    const dy = yMm - w.arcCenterYmm;
    const angleRad = Math.atan2(dy, dx);
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const diff = ((angleRad - startRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const totalDiff = endRad - startRad;
    let t = 0;
    if (Math.abs(totalDiff) > 1e-5) {
      t = Math.max(0, Math.min(1, diff / totalDiff));
    }
    return t * wallLengthMm(w);
  }
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return 0;
  const t = ((xMm - w.startXmm) * dx + (yMm - w.startYmm) * dy) / len2;
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * Math.sqrt(len2);
}

/** Cardinal & polar tracking angles (degrees) for drawing assist. */
export const WALL_CARDINAL_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * Computes circle center, radius, start angle, and end angle from 3 points on an arc:
 * p1 (start), p2 (mid / bulge point), p3 (end).
 */
export function computeArcFromThreePoints(
  p1: { xMm: number; yMm: number },
  p2: { xMm: number; yMm: number },
  p3: { xMm: number; yMm: number },
): {
  arcCenterXmm: number;
  arcCenterYmm: number;
  arcRadiusMm: number;
  arcStartAngleDeg: number;
  arcEndAngleDeg: number;
} | null {
  const temp = p2.xMm * p2.xMm + p2.yMm * p2.yMm;
  const bc = (p1.xMm * p1.xMm + p1.yMm * p1.yMm - temp) / 2;
  const cd = (temp - p3.xMm * p3.xMm - p3.yMm * p3.yMm) / 2;
  const det = (p1.xMm - p2.xMm) * (p2.yMm - p3.yMm) - (p2.xMm - p3.xMm) * (p1.yMm - p2.yMm);
  if (Math.abs(det) < 1e-6) return null; // Collinear points

  const cx = (bc * (p2.yMm - p3.yMm) - cd * (p1.yMm - p2.yMm)) / det;
  const cy = ((p1.xMm - p2.xMm) * cd - (p2.xMm - p3.xMm) * bc) / det;
  const radius = Math.hypot(p1.xMm - cx, p1.yMm - cy);

  let a1 = (Math.atan2(p1.yMm - cy, p1.xMm - cx) * 180) / Math.PI;
  let a3 = (Math.atan2(p3.yMm - cy, p3.xMm - cx) * 180) / Math.PI;

  a1 = ((a1 % 360) + 360) % 360;
  a3 = ((a3 % 360) + 360) % 360;

  return {
    arcCenterXmm: Math.round(cx),
    arcCenterYmm: Math.round(cy),
    arcRadiusMm: Math.round(radius),
    arcStartAngleDeg: Math.round(a1 * 10) / 10,
    arcEndAngleDeg: Math.round(a3 * 10) / 10,
  };
}

/**
 * Snap a draft endpoint toward 0/45/90/135/180/225/270/315° relative to `from`, or to the
 * previous segment direction when `prevFrom` is set.
 * Also snaps to equal lengths of nearby walls/lines and aligned axes.
 */
export function snapWallEndpointMm(
  from: { xMm: number; yMm: number },
  to: { xMm: number; yMm: number },
  opts?: {
    prevFrom?: { xMm: number; yMm: number } | null;
    toleranceDeg?: number;
    existingLengths?: number[];
    alignmentPoints?: { xMm: number; yMm: number }[];
  },
): {
  point: { xMm: number; yMm: number };
  angleDeg: number;
  snapped: boolean;
  equalLengthMm?: number | null;
  alignedAxis?: "x" | "y" | "xy" | null;
} {
  const tolerance = opts?.toleranceDeg ?? 6;
  let dx = to.xMm - from.xMm;
  let dy = to.yMm - from.yMm;
  let len = Math.hypot(dx, dy);
  if (len < 1e-3) {
    return { point: { ...to }, angleDeg: 0, snapped: false };
  }

  // 1. Equal length snap (Revit style)
  let equalLengthMm: number | null = null;
  if (opts?.existingLengths && opts.existingLengths.length > 0) {
    for (const targetLen of opts.existingLengths) {
      if (targetLen > 150 && Math.abs(len - targetLen) <= 150) {
        equalLengthMm = targetLen;
        len = targetLen;
        break;
      }
    }
  }

  // 2. Alignment tracking
  let alignedAxis: "x" | "y" | "xy" | null = null;
  const snappedTo = { ...to };
  if (opts?.alignmentPoints && opts.alignmentPoints.length > 0) {
    for (const pt of opts.alignmentPoints) {
      const matchX = Math.abs(to.xMm - pt.xMm) <= 120;
      const matchY = Math.abs(to.yMm - pt.yMm) <= 120;
      if (matchX && matchY) {
        snappedTo.xMm = pt.xMm;
        snappedTo.yMm = pt.yMm;
        alignedAxis = "xy";
        break;
      } else if (matchX && alignedAxis !== "y") {
        snappedTo.xMm = pt.xMm;
        alignedAxis = "x";
      } else if (matchY && alignedAxis !== "x") {
        snappedTo.yMm = pt.yMm;
        alignedAxis = "y";
      }
    }
  }

  if (alignedAxis) {
    dx = snappedTo.xMm - from.xMm;
    dy = snappedTo.yMm - from.yMm;
    len = Math.hypot(dx, dy);
  }

  let baseRad = 0;
  if (opts?.prevFrom) {
    baseRad = Math.atan2(
      from.yMm - opts.prevFrom.yMm,
      from.xMm - opts.prevFrom.xMm,
    );
  }

  const absRad = Math.atan2(dy, dx);
  const relDeg = ((absRad - baseRad) * 180) / Math.PI;
  const norm = ((relDeg % 360) + 360) % 360;

  let best: number = WALL_CARDINAL_DEG[0];
  let bestDelta = 999;
  for (const c of WALL_CARDINAL_DEG) {
    let d = Math.abs(norm - c);
    if (d > 180) d = 360 - d;
    if (d < bestDelta) {
      bestDelta = d;
      best = c;
    }
  }

  if (bestDelta <= tolerance && !alignedAxis) {
    const snappedRelRad = (best * Math.PI) / 180;
    const snappedAbsRad = baseRad + snappedRelRad;
    return {
      point: {
        xMm: Math.round(from.xMm + Math.cos(snappedAbsRad) * len),
        yMm: Math.round(from.yMm + Math.sin(snappedAbsRad) * len),
      },
      angleDeg: Math.round(best),
      snapped: true,
      equalLengthMm,
      alignedAxis: null,
    };
  }

  return {
    point: {
      xMm: Math.round(snappedTo.xMm),
      yMm: Math.round(snappedTo.yMm),
    },
    angleDeg: Math.round(norm),
    snapped: Boolean(alignedAxis || equalLengthMm != null),
    equalLengthMm,
    alignedAxis,
  };
}

export function rememberNumber(list: number[], value: number, max = 8): number[] {
  const v = Math.round(value);
  const next = [v, ...list.filter((x) => x !== v)];
  return next.slice(0, max);
}

export function rememberDoorSize(
  list: { widthMm: number; heightMm: number }[],
  widthMm: number,
  heightMm: number,
  max = 8,
): { widthMm: number; heightMm: number }[] {
  const w = Math.round(widthMm);
  const h = Math.round(heightMm);
  const next = [
    { widthMm: w, heightMm: h },
    ...list.filter((x) => !(x.widthMm === w && x.heightMm === h)),
  ];
  return next.slice(0, max);
}

export function rememberWindowSize(
  list: { widthMm: number; heightMm: number; sillHeightMm: number }[],
  widthMm: number,
  heightMm: number,
  sillHeightMm: number,
  max = 8,
): { widthMm: number; heightMm: number; sillHeightMm: number }[] {
  const w = Math.round(widthMm);
  const h = Math.round(heightMm);
  const s = Math.round(sillHeightMm);
  const next = [
    { widthMm: w, heightMm: h, sillHeightMm: s },
    ...list.filter(
      (x) =>
        !(x.widthMm === w && x.heightMm === h && x.sillHeightMm === s),
    ),
  ];
  return next.slice(0, max);
}

/** Empty-project model key prefix. */
export const EMPTY_PROJECT_PREFIX = "empty:";

export function isEmptyProjectKey(modelKey: string | null): boolean {
  return Boolean(modelKey?.startsWith(EMPTY_PROJECT_PREFIX));
}

export function emptyProjectKey(name: string): string {
  const safe = name.trim().replace(/[^\w.-]+/g, "_") || "project";
  return `${EMPTY_PROJECT_PREFIX}${safe}`;
}

export type LayoutRoomVentilation = {
  abluftVolume: number; // Extract flow m³/h
  zuluftVolume: number; // Supply flow m³/h
  overflowVolume: number; // Überströmung m³/h
  aldVolume: number; // Outdoor air inlet m³/h
  roomArt: string; // DIN / SC RaumArt code (e.g. "204" Bad, "200" Wohnen)
  flowRole: "supply" | "extract" | "overflow" | "neutral";
  ventilationHeatLossWatts?: number;
};

export type LayoutRoom = {
  id: string;
  projectId: string;
  levelId: string;
  name: string;
  number: string;
  areaSqM: number;
  boundaryPoints: { xMm: number; yMm: number }[];
  tagPosMm: { xMm: number; yMm: number };
  ventilation?: LayoutRoomVentilation;
  createdAt: number;
};

/**
 * Propose recommended airflow (m³/h) and flow role based on room name or type
 */
export function estimateRoomVentilation(name: string, areaSqM: number): LayoutRoomVentilation {
  const lower = name.toLowerCase();
  const baseRatePerM2 = 1.2; // approx 1.2 m³/h per m²
  if (lower.includes("bad") || lower.includes("wc") || lower.includes("toilet") || lower.includes("bath")) {
    return {
      abluftVolume: Math.max(40, Math.round(areaSqM * 10)),
      zuluftVolume: 0,
      overflowVolume: 0,
      aldVolume: 0,
      roomArt: "204",
      flowRole: "extract",
      ventilationHeatLossWatts: Math.round(areaSqM * 25),
    };
  }
  if (lower.includes("küche") || lower.includes("kueche") || lower.includes("kitchen") || lower.includes("kochen")) {
    return {
      abluftVolume: Math.max(45, Math.round(areaSqM * 6)),
      zuluftVolume: 0,
      overflowVolume: 0,
      aldVolume: 0,
      roomArt: "205",
      flowRole: "extract",
      ventilationHeatLossWatts: Math.round(areaSqM * 20),
    };
  }
  if (lower.includes("flur") || lower.includes("korridor") || lower.includes("diele") || lower.includes("hall") || lower.includes("gang")) {
    return {
      abluftVolume: 0,
      zuluftVolume: 0,
      overflowVolume: Math.max(20, Math.round(areaSqM * 3)),
      aldVolume: 0,
      roomArt: "201",
      flowRole: "overflow",
      ventilationHeatLossWatts: Math.round(areaSqM * 10),
    };
  }
  // Living / bedroom / general supply
  const flow = Math.max(30, Math.round(areaSqM * baseRatePerM2 * 2.5));
  return {
    abluftVolume: 0,
    zuluftVolume: flow,
    overflowVolume: 0,
    aldVolume: 0,
    roomArt: "200",
    flowRole: "supply",
    ventilationHeatLossWatts: Math.round(areaSqM * 18),
  };
}

/**
 * Standard duct sizing based on flow volume (m³/h) and recommended velocity (m/s)
 * Q = A * v => A = Q / (3600 * v)
 */
export function calculateDuctSizing(flowM3h: number, velocityMs = 3.0): {
  roundDiameterMm: number;
  rectWidthMm: number;
  rectHeightMm: number;
  actualVelocityMs: number;
} {
  const safeFlow = Math.max(10, flowM3h);
  const requiredAreaM2 = safeFlow / (3600 * Math.max(0.5, velocityMs));
  // Round diameter D = sqrt(4 * A / PI)
  const exactDiaMm = Math.sqrt((4 * requiredAreaM2) / Math.PI) * 1000;
  const standardRound = [80, 100, 125, 150, 160, 200, 250, 315, 355, 400, 450, 500];
  const roundDiameterMm = standardRound.find((d) => d >= exactDiaMm) ?? 500;

  // Rectangular standard: aspect ratio ~ 1.5 - 2.0
  const standardRectHeights = [100, 150, 200, 250, 300];
  let rectHeightMm = 150;
  let rectWidthMm = 200;
  for (const h of standardRectHeights) {
    const w = (requiredAreaM2 * 1e6) / h;
    if (w >= h && w <= h * 3) {
      rectHeightMm = h;
      rectWidthMm = Math.ceil(w / 50) * 50; // round up to 50mm
      break;
    }
  }
  const rectAreaM2 = (rectWidthMm * rectHeightMm) * 1e-6;
  const actualVelocityMs = Number((safeFlow / (3600 * rectAreaM2)).toFixed(2));

  return { roundDiameterMm, rectWidthMm, rectHeightMm, actualVelocityMs };
}


/** Compute polygon area in m² from mm vertices using Shoelace formula */
export function computePolygonAreaSqM(points: { xMm: number; yMm: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p1.xMm * p2.yMm - p2.xMm * p1.yMm);
  }
  return Math.abs(sum) * 0.5 * 1e-6;
}

/** Ray-wall intersection helper */
function raySegmentIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; x: number; y: number } | null {
  const v1x = ox - x1;
  const v1y = oy - y1;
  const v2x = x2 - x1;
  const v2y = y2 - y1;
  const v3x = -dy;
  const v3y = dx;

  const dot = v2x * v3x + v2y * v3y;
  if (Math.abs(dot) < 1e-6) return null;

  const t1 = (v2x * v1y - v2y * v1x) / dot;
  const t2 = (v1x * v3x + v1y * v3y) / dot;

  if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
    return { dist: t1, x: ox + dx * t1, y: oy + dy * t1 };
  }
  return null;
}

/** Detect enclosed room polygon around seed point (px, py) using radial ray-casting */
export function detectEnclosedRoomBoundary(
  px: number,
  py: number,
  walls: LayoutWall[]
): { boundary: { xMm: number; yMm: number }[]; areaSqM: number } | null {
  if (walls.length < 3) {
    // Default 4x4m room boundary if not enclosed by walls
    const half = 2000;
    const boundary = [
      { xMm: px - half, yMm: py - half },
      { xMm: px + half, yMm: py - half },
      { xMm: px + half, yMm: py + half },
      { xMm: px - half, yMm: py + half },
    ];
    return { boundary, areaSqM: computePolygonAreaSqM(boundary) };
  }

  const numRays = 24;
  const hits: { xMm: number; yMm: number }[] = [];

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let closestDist = Infinity;
    let closestHit: { x: number; y: number } | null = null;

    for (const w of walls) {
      const hit = raySegmentIntersect(px, py, dx, dy, w.startXmm, w.startYmm, w.endXmm, w.endYmm);
      if (hit && hit.dist < closestDist && hit.dist > 10) {
        closestDist = hit.dist;
        closestHit = { x: hit.x, y: hit.y };
      }
    }

    if (closestHit && closestDist < 30000) {
      hits.push({ xMm: closestHit.x, yMm: closestHit.y });
    }
  }

  if (hits.length >= 3) {
    const area = computePolygonAreaSqM(hits);
    if (area > 1 && area < 10000) {
      return { boundary: hits, areaSqM: area };
    }
  }

  // Fallback room boundary 4x4m
  const half = 2000;
  const boundary = [
    { xMm: px - half, yMm: py - half },
    { xMm: px + half, yMm: py - half },
    { xMm: px + half, yMm: py + half },
    { xMm: px - half, yMm: py + half },
  ];
  return { boundary, areaSqM: computePolygonAreaSqM(boundary) };
}

// ---------------------------------------------------------------------------
// Sheet Composition & Title Block (Section 7)
// ---------------------------------------------------------------------------

export type SheetSize = "A1" | "A2" | "A3" | "A4";

export const SHEET_DIMENSIONS_MM: Record<SheetSize, { widthMm: number; heightMm: number }> = {
  A1: { widthMm: 841, heightMm: 594 },
  A2: { widthMm: 594, heightMm: 420 },
  A3: { widthMm: 420, heightMm: 297 },
  A4: { widthMm: 297, heightMm: 210 },
};

export type SheetViewport = {
  id: string;
  viewType: "floor_plan" | "3d_view" | "elevation";
  levelId?: string;
  name: string;
  scale: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type LayoutSheet = {
  id: string;
  projectId: string;
  sheetNumber: string;
  sheetName: string;
  sheetSize: SheetSize;
  projectName: string;
  clientName?: string;
  author: string;
  checker?: string;
  date: string;
  scale: string;
  revisions: { rev: string; desc: string; date: string }[];
  viewports: SheetViewport[];
  createdAt: number;
};

