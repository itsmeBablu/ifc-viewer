import type * as THREE from "three";

export type VentilationFlowRole =
  | "supply"
  | "extract"
  | "overflow"
  | "neutral";

/** Solar Computer / Revit ventilation values per room. */
export type RoomVentilation = {
  /** Extract air volume m³/h. */
  abluftVolume: number;
  /** Supply air volume m³/h. */
  zuluftVolume: number;
  /** Overflow / transfer volume m³/h (e.g. bathroom). */
  overflowVolume: number;
  /** ALD room volume flow m³/h. */
  aldVolume: number;
  /** SC_Raum_ALDVorhanden — outdoor air inlet present. */
  hasAld: boolean;
  /** Ventilation heat loss (Lüftungswärmeverlust) W. */
  ventilationHeatLoss: number;
  /** Mechanical extract (Abluftgerät) present. */
  hasVentSystem: boolean;
  /** False when SC Konditionierung RLT = "keine Luftaufbereitung" (e.g. Aufzug). */
  hasAirTreatment: boolean;
  isSupplyRoom: boolean;
  isExtractRoom: boolean;
  isOverflowRoom: boolean;
  /** Nutzungszone e.g. WG 1. */
  zoneName: string;
  /** Lüftungszone e.g. Erdgeschoss - WG 1. */
  ventilationZoneName: string;
  zoneAldVolume: number;
  zoneNumber: number;
  roomArt: string;
  /** Count of Abluft outlets (SC_Raum_Abluftauslässe) — local extract device. */
  abluftOutlets: number;
};

export type Room = {
  id: string;
  name: string;
  number: string;
  /** Specific heat load for coloring (W/m²). */
  heatLoad: number;
  /** Absolute Heizlast parameter from IFC (typically W), if present. */
  heizlast: number | null;
  /** Specific cooling load for coloring (W/m²) — Solar Computer signed (often negative). */
  coolLoad: number;
  /** Absolute Kühllast from IFC (W, signed), if present. */
  kuhllast: number | null;
  /** Heating / setpoint temperature °C (SC_Raum_Temperatur). */
  temperature: number;
  /**
   * Cooling analysis temperature °C from Solar Computer
   * (operative/max summer temps). Null when missing or 0.
   */
  coolTemperature: number | null;
  /**
   * Clear / room height in meters from Revit (SC_Raum_Höhe / Lichte Höhe).
   * Null when missing.
   */
  height: number | null;
  ventilation: RoomVentilation;
  floorId: string;
  expressId: number;
  geometry: THREE.BufferGeometry;
};

export type Floor = {
  id: string;
  name: string;
  elevation: number;
  expressId: number;
  /** Mean IFC room clear height (m) on this storey, when available. */
  typicalHeight?: number;
};

export type ModelEntry = {
  id: string;
  label: string;
  ifcPath: string;
};

export type SavedView = {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  floorId: string | null;
  /** Saved while presentation (exploded) layout was active. */
  inPresentation?: boolean;
  /** Isolated single floor in presentation when saved. */
  presentationIsolate?: boolean;
  /** Paper size for PDF export of this view. */
  pageFormat?: import("./presentationLayout").PageFormat;
};

export type ColorMode = "heizlast" | "temperature";

export type RenderMode =
  | "light"
  | "fullColor"
  | "wireframe"
  | "texture"
  | "realistic";

export type ElementProperty = {
  name: string;
  value: string;
  pset?: string;
};

export type SelectedElement = {
  expressId: number;
  globalId: string;
  typeName: string;
  name: string;
  floorId: string | null;
  kind: "room" | "component";
  roomId: string | null;
  /** IFC material name (IfcRelAssociatesMaterial), null when the file has none. */
  materialName: string | null;
  properties: ElementProperty[];
};

export type LoadedModel = {
  floors: Floor[];
  rooms: Room[];
  shellGroup: THREE.Group;
};
