/**
 * IFC loading + parsing (client-side only via web-ifc WASM).
 *
 * Property / PSet names are configurable — Revit IFC exports often use custom
 * shared parameters. Adjust these constants to match your export mapping.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as WebIFC from "web-ifc";
import type { Floor, LoadedModel, Room, RoomVentilation } from "./types";
import { emptyVentilation } from "./ventilation";
import { mergeDuplicateFloors, reassignUpperSlabsToNextFloor, pruneEmptyFloors } from "./floorFilter";
import { debugLog } from "./debugLog";

/** Prefer these PSet names when looking up heat-load / temperature values. */
export const HEAT_LOAD_PSET_NAMES = [
  "Ergebnisse der Analyse",
  "Energieanalyse",
  "Berechnete Raum",
  "Berechneter Raum",
  "Pset_SpaceHeatingLoad",
  "Pset_SpaceThermalLoad",
  "Pset_SpaceThermalRequirements",
  "BaseQuantities",
];

export const HEAT_LOAD_PROP_NAMES = [
  "Heizlast/m²",
  "Heizlast/m2",
  "Heizlast_m2",
  "Heizlast W",
  "Heizlast",
  "Heizlastdichte",
  "Spezifische Heizlast",
  "spez. Heizlast",
  "SC_Raum_spezifischeHeizlast",
  "spezifischeHeizlast",
  "HeatingLoad",
  "HeatLoad",
  "HeatLoadPerArea",
  "SpecificHeatLoad",
  "HeatingLoadPerArea",
  "HL",
  "qH",
  "QH",
];

export const TEMPERATURE_PSET_NAMES = [
  "HLS",
  "Energieanalyse",
  "Andere",
  "Berechnete Raum",
  "Berechneter Raum",
  "Pset_SpaceThermalRequirements",
  "Pset_SpaceComfort",
  "Pset_SpaceHVACDesign",
  "Pset_SpaceHeatingLoad",
];

/**
 * Room air temperature — prefer SimCalc / Revit names from this project's IFC.
 * Avoid bare "Temp" first: it substring-matches *Temperatur* on many unrelated props.
 */
export const TEMPERATURE_PROP_NAMES = [
  "SC_Raum_Temperatur",
  "CAx_Raum_Temperatur",
  "Raum_Temperatur",
  "RaumTemperatur",
  "SC_Raum_StandardTemperatur",
  "Solltemperatur",
  "Raumtemperatur",
  "Temp",
  "Temperature",
  "DesignTemperature",
  "RoomTemperature",
  "ThermalComfortTemperature",
  "HeatingDesignTemperature",
  "T_Soll",
  "TSoll",
];

/**
 * Solar Computer cooling / summer analysis temperatures (°C).
 * Prefer operative max, then air max — ignore zero placeholders.
 */
export const COOL_TEMPERATURE_PROP_NAMES = [
  "SC_Raum_Temperatur_operativ_MAX_2078",
  "SC_Raum_Temperatur_operativ_MAX_6020",
  "SC_Raum_Temperatur_operativ_MAX",
  "SC_Raum_Temperatur_MAX_2078",
  "SC_Raum_Temperatur_MAX_6020",
  "SC_Raum_Temperatur_MAX",
  "Temperatur_operativ_MAX",
  "Temperatur_MAX",
];

export const ABSOLUTE_HEIZLAST_PROP_NAMES = [
  "Heizlast W",
  "HeizlastW",
  "Heizlast_W",
  "Bemessungslast Heizung",
  "SC_Raum_Heizlast",
  "Heizlast",
];

export const HEAT_DENSITY_PROP_NAMES = [
  "Heizlast/m²",
  "Heizlast/m2",
  "Heizlast_m2",
  "SC_Raum_spezifischeHeizlast",
  "spezifischeHeizlast",
  "Spezifische Heizlast",
  "Heizlastdichte",
  "HeatLoadPerArea",
  "SpecificHeatLoad",
];

/** Cooling density W/m² — Revit / SimCalc export names. */
export const COOL_DENSITY_PROP_NAMES = [
  "Kühllast W/m²",
  "Kühllast W/m2",
  "Kühllast/m²",
  "Kühllast/m2",
  "Kühllast_m2",
  "Kuehllast W/m²",
  "Kuehllast W/m2",
  "Kuehllast/m²",
  "Kuehllast/m2",
  "SC_Raum_spezifischeKuehllast",
  "SC_Raum_spezifischeKühllast",
  "spezifischeKühllast",
  "spezifischeKuehllast",
  "Kühllastdichte",
  "CoolingLoadPerArea",
  "SpecificCoolingLoad",
];

export const ABSOLUTE_KUHLLAST_PROP_NAMES = [
  "Kühllast W",
  "KühllastW",
  "Kühllast_W",
  "Kuehllast W",
  "KuehllastW",
  "Bemessungslast Kühlung",
  "Bemessungslast Kuehlung",
  "SC_Raum_Kuehllast",
  "SC_Raum_Kühllast",
  "Kühllast",
  "Kuehllast",
  "CoolingLoad",
];

export const VENTILATION_HEAT_LOSS_PROP_NAMES = [
  "SC_Raum_Lüftungswärmeverlust",
  "SC_Raum_Lueftungswaermeverlust",
  "Lüftungswärmeverlust",
];

export const ABLUFT_VOLUME_PROP_NAMES = [
  "SC_Raum_Abluftvolumenstrom_12831",
  "SC_Raum_Abluftvolumenstrom",
  "Angegebener Abluftluftstrom",
  "Tatsächlicher Abluftstrom",
];

export const ZULUFT_VOLUME_PROP_NAMES = [
  "SC_Raum_Zuluftvolumenstrom_12831",
  "SC_Raum_Zuluftvolumenstrom",
  "Angegebener Zuluftstrom",
  "Tatsächlicher Zuluftstrom",
];

export const OVERFLOW_VOLUME_PROP_NAMES = [
  "SC_Raum_Überstromvolumenstrom_12831",
  "SC_Raum_Ueberstromvolumenstrom_12831",
];

export const ALD_VOLUME_PROP_NAMES = [
  "SC_Raum_ALDVolumenstrom",
];

export const ZONE_ALD_VOLUME_PROP_NAMES = [
  "SC_LüftungszoneALDVolumenstrom",
  "SC_LueftungszoneALDVolumenstrom",
];

export const VENT_SYSTEM_PROP_NAMES = [
  "SC_Raum_LüftungssystemVorhanden",
  "SC_Raum_LueftungssystemVorhanden",
];

export const ZONE_NAME_PROP_NAMES = [
  "SC_Raum_Zonenname",
];

export const VENT_ZONE_NAME_PROP_NAMES = [
  "SC_Lüftungszonenname",
  "SC_Lueftungszonenname",
];

export const ROOM_ART_PROP_NAMES = [
  "SC_H73KEY_RaumArt",
];

export const ABLUFT_OUTLETS_PROP_NAMES = [
  "SC_Raum_Abluftauslässe",
  "SC_Raum_Abluftauslaesse",
];

const WASM_PATH = "/wasm/";

type OpenIfcHandle = { api: WebIFC.IfcAPI; modelID: number };

/** Survive Next/HMR so selection can still query properties after reload. */
function getOpenHandle(): OpenIfcHandle | null {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { __ifcOpenHandle?: OpenIfcHandle | null })
      .__ifcOpenHandle ?? null
  );
}

function setOpenHandle(handle: OpenIfcHandle | null): void {
  (globalThis as unknown as { __ifcOpenHandle?: OpenIfcHandle | null }).__ifcOpenHandle =
    handle;
}

export function closeActiveIfcModel(): void {
  const openHandle = getOpenHandle();
  if (!openHandle) return;
  try {
    openHandle.api.CloseModel(openHandle.modelID);
  } catch {
    // ignore
  }
  setOpenHandle(null);
}

export type LoadProgress = {
  phase: "fetch" | "parse" | "geometry" | "properties" | "done";
  progress: number; // 0..1, or -1 for indeterminate
  message: string;
};

type ProgressCallback = (p: LoadProgress) => void;

let apiPromise: Promise<WebIFC.IfcAPI> | null = null;

async function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new WebIFC.IfcAPI();
      // Prefer absolute URL so Next.js routing never rewrites the wasm fetch.
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      api.SetWasmPath(origin ? `${origin}${WASM_PATH}` : WASM_PATH, true);
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

function readString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "value" in value) {
    const v = (value as { value: unknown }).value;
    return v == null ? "" : String(v);
  }
  return String(value);
}

function readNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    // "20°C", "20,0 W/m²", "200 W"
    const m = value.replace(/\u00a0/g, " ").match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const n = parseFloat(m[0].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return readNumber((value as { value: unknown }).value);
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = readString(value).trim().toLowerCase();
  if (s === "true" || s === "ja" || s === "yes" || s === "1" || s === ".t.")
    return true;
  if (s === "false" || s === "nein" || s === "no" || s === "0" || s === ".f.")
    return false;
  return null;
}

function extractExactNamedString(
  flat: { pset: string; name: string; value: unknown }[],
  exactNames: string[],
): string {
  const keys = exactNames.map((n) => compactPropKey(n));
  for (const key of keys) {
    for (const item of flat) {
      if (compactPropKey(item.name) !== key) continue;
      const s = readString(item.value).trim();
      if (s) return s;
    }
  }
  return "";
}

function extractExactNamedBoolean(
  flat: { pset: string; name: string; value: unknown }[],
  exactNames: string[],
): boolean {
  const keys = exactNames.map((n) => compactPropKey(n));
  for (const key of keys) {
    for (const item of flat) {
      if (compactPropKey(item.name) !== key) continue;
      const b = readBoolean(item.value);
      if (b != null) return b;
    }
  }
  return false;
}

function extractVentilationProps(
  flat: { pset: string; name: string; value: unknown }[],
): RoomVentilation {
  const v = emptyVentilation();
  v.abluftVolume =
    extractExactNamedNumeric(flat, ABLUFT_VOLUME_PROP_NAMES) ?? 0;
  v.zuluftVolume =
    extractExactNamedNumeric(flat, ZULUFT_VOLUME_PROP_NAMES) ?? 0;
  v.overflowVolume =
    extractExactNamedNumeric(flat, OVERFLOW_VOLUME_PROP_NAMES) ?? 0;
  v.aldVolume = extractExactNamedNumeric(flat, ALD_VOLUME_PROP_NAMES) ?? 0;
  v.hasAld = extractExactNamedBoolean(flat, [
    "SC_Raum_ALDVorhanden",
  ]);
  v.ventilationHeatLoss =
    extractExactNamedNumeric(flat, VENTILATION_HEAT_LOSS_PROP_NAMES) ?? 0;
  v.hasVentSystem = extractExactNamedBoolean(flat, VENT_SYSTEM_PROP_NAMES);
  v.zoneName = extractExactNamedString(flat, ZONE_NAME_PROP_NAMES);
  v.ventilationZoneName = extractExactNamedString(
    flat,
    VENT_ZONE_NAME_PROP_NAMES,
  );
  v.zoneAldVolume =
    extractExactNamedNumeric(flat, ZONE_ALD_VOLUME_PROP_NAMES) ?? 0;
  v.zoneNumber =
    extractExactNamedNumeric(flat, ["SC_Raum_Zonennummer"]) ?? 0;
  v.roomArt = extractExactNamedString(flat, ROOM_ART_PROP_NAMES);
  v.abluftOutlets =
    extractExactNamedNumeric(flat, ABLUFT_OUTLETS_PROP_NAMES) ?? 0;
  v.isSupplyRoom = extractExactNamedBoolean(flat, [
    "IBV_L47_Raum_IstZuluftraum",
  ]);
  v.isExtractRoom = extractExactNamedBoolean(flat, [
    "IBV_L47_Raum_IstAbluftraum",
  ]);
  v.isOverflowRoom = extractExactNamedBoolean(flat, [
    "IBV_L47_Raum_IstÜberströmmungsraum",
    "IBV_L47_Raum_IstUeberstroemungsraum",
  ]);
  const rltConditioning = extractExactNamedString(flat, [
    "SC_Raum_18599_Konditionierung_RLT",
  ]);
  v.hasAirTreatment = !/keine\s*luftaufbereitung/i.test(rltConditioning);
  return v;
}

/** Match IFC property names; treat Raum_Temperatur ≈ Raumtemperatur. */
function propNameMatches(name: string, candidates: string[]): boolean {
  const n = name.trim().toLowerCase();
  const nCompact = n.replace(/[_\s/-]+/g, "").replace(/²/g, "2");
  return candidates.some((c) => {
    const cl = c.toLowerCase();
    const cCompact = cl.replace(/[_\s/-]+/g, "").replace(/²/g, "2");
    return n === cl || n.includes(cl) || nCompact === cCompact || nCompact.includes(cCompact);
  });
}

function vectorToArray(vec: WebIFC.Vector<number>): number[] {
  const out: number[] = [];
  const size = vec.size();
  for (let i = 0; i < size; i++) out.push(vec.get(i));
  return out;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** web-ifc FlatMesh/IfcGeometry.delete() is not always present at runtime. */
function safeDelete(obj: { delete?: () => void } | null | undefined): void {
  if (obj && typeof obj.delete === "function") {
    try {
      obj.delete();
    } catch {
      // ignore WASM dispose failures
    }
  }
}

function placedGeometryToBuffer(
  api: WebIFC.IfcAPI,
  modelID: number,
  placed: WebIFC.PlacedGeometry,
): THREE.BufferGeometry | null {
  const geom = api.GetGeometry(modelID, placed.geometryExpressID);
  try {
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const indices = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
    if (!verts.length || !indices.length) return null;

    const positions = new Float32Array((verts.length / 6) * 3);
    const normals = new Float32Array((verts.length / 6) * 3);

    for (let i = 0, j = 0; i < verts.length; i += 6, j += 3) {
      positions[j] = verts[i];
      positions[j + 1] = verts[i + 1];
      positions[j + 2] = verts[i + 2];
      normals[j] = verts[i + 3];
      normals[j + 1] = verts[i + 4];
      normals[j + 2] = verts[i + 5];
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    buffer.setIndex(new THREE.BufferAttribute(indices, 1));

    const matrix = new THREE.Matrix4().fromArray(placed.flatTransformation);
    buffer.applyMatrix4(matrix);
    return buffer;
  } finally {
    safeDelete(geom);
  }
}

function mergePlacedGeometries(
  api: WebIFC.IfcAPI,
  modelID: number,
  mesh: WebIFC.FlatMesh,
): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const geos = mesh.geometries;
  const count = geos.size();

  for (let i = 0; i < count; i++) {
    const placed = geos.get(i);
    const part = placedGeometryToBuffer(api, modelID, placed);
    if (part) parts.push(part);
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

function buildContainmentMap(api: WebIFC.IfcAPI, modelID: number): Map<number, number> {
  const map = new Map<number, number>();
  const relIds = vectorToArray(
    api.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE),
  );

  for (const relId of relIds) {
    const rel = api.GetLine(modelID, relId);
    const relating = rel?.RelatingStructure?.value as number | undefined;
    const related = rel?.RelatedElements as Array<{ value: number }> | undefined;
    if (!relating || !related) continue;
    for (const el of related) {
      if (el?.value != null) map.set(el.value, relating);
    }
  }

  return map;
}

/**
 * Spaces are usually linked to storeys via IfcRelAggregates, not ContainedIn.
 * Returns map: childExpressId → parentExpressId (e.g. space → storey).
 */
function buildAggregationMap(
  api: WebIFC.IfcAPI,
  modelID: number,
): Map<number, number> {
  const map = new Map<number, number>();
  const relIds = vectorToArray(
    api.GetLineIDsWithType(modelID, WebIFC.IFCRELAGGREGATES),
  );

  for (const relId of relIds) {
    const rel = api.GetLine(modelID, relId);
    const relating = rel?.RelatingObject?.value as number | undefined;
    const related = rel?.RelatedObjects as Array<{ value: number }> | undefined;
    if (!relating || !related) continue;
    for (const el of related) {
      if (el?.value != null) map.set(el.value, relating);
    }
  }

  return map;
}

function normalizeRoomKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^raum\s+/i, "");
}

/** Best-effort world origin from a product line's ObjectPlacement (flattened). */
function extractPlacementOrigin(line: {
  ObjectPlacement?: unknown;
}): THREE.Vector3 | null {
  try {
    const placement = line.ObjectPlacement as
      | {
          RelativePlacement?: {
            Location?: { Coordinates?: Array<number | { value?: number }> };
          };
          PlacementRelTo?: unknown;
        }
      | undefined;
    if (!placement) return null;

    const walk = (
      p: typeof placement | undefined,
      acc: THREE.Vector3,
    ): THREE.Vector3 => {
      if (!p) return acc;
      const coords = p.RelativePlacement?.Location?.Coordinates;
      if (coords && coords.length >= 3) {
        const x = typeof coords[0] === "number" ? coords[0] : Number(coords[0]?.value ?? 0);
        const y = typeof coords[1] === "number" ? coords[1] : Number(coords[1]?.value ?? 0);
        const z = typeof coords[2] === "number" ? coords[2] : Number(coords[2]?.value ?? 0);
        acc.add(new THREE.Vector3(x, y, z));
      }
      const parent = p.PlacementRelTo as typeof placement | undefined;
      if (parent) return walk(parent, acc);
      return acc;
    };

    return walk(placement, new THREE.Vector3());
  } catch {
    return null;
  }
}

/** True when A∩B covers most of the smaller box — duplicate room/shell volumes. */
function boxesOverlapHeavily(a: THREE.Box3, b: THREE.Box3): boolean {
  const inter = a.clone().intersect(b);
  if (inter.isEmpty()) return false;
  const iSize = inter.getSize(new THREE.Vector3());
  const interVol = Math.max(0, iSize.x) * Math.max(0, iSize.y) * Math.max(0, iSize.z);
  if (interVol <= 1e-8) return false;
  const aSize = a.getSize(new THREE.Vector3());
  const bSize = b.getSize(new THREE.Vector3());
  const aVol = Math.max(1e-9, aSize.x * aSize.y * aSize.z);
  const bVol = Math.max(1e-9, bSize.x * bSize.y * bSize.z);
  return interVol / Math.min(aVol, bVol) > 0.55;
}

function ifcColorToHex(c: { x: number; y: number; z: number }): number {
  const r = Math.round(Math.min(1, Math.max(0, c.x)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.y)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.z)) * 255);
  // Near-black IFC defaults → soft structural gray so elements stay readable
  if (r + g + b < 12) return 0xb8bec8;
  return (r << 16) | (g << 8) | b;
}

function ingestFlatMesh(
  api: WebIFC.IfcAPI,
  modelID: number,
  mesh: WebIFC.FlatMesh,
  spaceIdSet: Set<number>,
  spaceGeoms: Map<number, THREE.BufferGeometry>,
  shellGeoms: {
    geom: THREE.BufferGeometry;
    expressId: number;
    floorId: string;
    colorHex: number;
  }[],
  containment: Map<number, number>,
  storeyGuidByExpress: Map<number, string>,
  floors: Floor[],
): void {
  const expressID = mesh.expressID;

  if (spaceIdSet.has(expressID)) {
    const geom = mergePlacedGeometries(api, modelID, mesh);
    if (!geom) return;
    const prev = spaceGeoms.get(expressID);
    if (prev) prev.dispose();
    spaceGeoms.set(expressID, geom);
    return;
  }

  const storeyExpress = containment.get(expressID);
  const floorId =
    (storeyExpress != null
      ? storeyGuidByExpress.get(storeyExpress)
      : undefined) ?? floors[0].id;

  // Keep IFC material colors: one shell piece per placed geometry
  const geos = mesh.geometries;
  const count = geos.size();
  for (let i = 0; i < count; i++) {
    const placed = geos.get(i);
    const geom = placedGeometryToBuffer(api, modelID, placed);
    if (!geom) continue;
    shellGeoms.push({
      geom,
      expressId: expressID,
      floorId,
      colorHex: ifcColorToHex(placed.color),
    });
  }
}

function flattenProps(psets: unknown[]): { pset: string; name: string; value: unknown }[] {
  const out: { pset: string; name: string; value: unknown }[] = [];
  for (const pset of psets) {
    const ps = pset as {
      Name?: { value?: string };
      HasProperties?: unknown[];
      Quantities?: unknown[];
    };
    const psetName = readString(ps.Name);

    for (const prop of ps.HasProperties ?? []) {
      const p = prop as {
        Name?: { value?: string };
        NominalValue?: unknown;
        LengthValue?: unknown;
        AreaValue?: unknown;
        VolumeValue?: unknown;
        HasProperties?: unknown[];
      };
      // Nested property sets (rare)
      if (Array.isArray(p.HasProperties)) {
        out.push(...flattenProps([p]));
        continue;
      }
      const name = readString(p.Name);
      const value =
        p.NominalValue ?? p.LengthValue ?? p.AreaValue ?? p.VolumeValue ?? null;
      if (name) out.push({ pset: psetName, name, value });
    }

    // Element quantities (Revit sometimes puts loads here)
    for (const q of ps.Quantities ?? []) {
      const qq = q as {
        Name?: { value?: string };
        LengthValue?: unknown;
        AreaValue?: unknown;
        VolumeValue?: unknown;
        CountValue?: unknown;
        WeightValue?: unknown;
        TimeValue?: unknown;
      };
      const name = readString(qq.Name);
      const value =
        qq.LengthValue ??
        qq.AreaValue ??
        qq.VolumeValue ??
        qq.CountValue ??
        qq.WeightValue ??
        qq.TimeValue ??
        null;
      if (name) out.push({ pset: psetName, name, value });
    }
  }
  return out;
}

/** Compact key for exact export-name matching (Heizlast W → heizlastw). */
function compactPropKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/²/g, "2")
    .replace(/[_\s/-]+/g, "");
}

/**
 * Exact match against export names (order matters).
 * Used for: "Heizlast/m²", "Heizlast W", "Temp"
 */
function extractExactNamedNumeric(
  flat: { pset: string; name: string; value: unknown }[],
  exactNames: string[],
): number | null {
  const keys = exactNames.map((n) => compactPropKey(n));
  for (const key of keys) {
    for (const item of flat) {
      if (compactPropKey(item.name) !== key) continue;
      const num = readNumber(item.value);
      if (num != null) return num;
    }
  }
  return null;
}

function fuzzyHeatLoadDensity(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("heizlast/m") ||
    n.includes("heizlast_m") ||
    n.includes("spezifischeheizlast") ||
    n.includes("heizlastdichte") ||
    n.includes("heatloadperarea") ||
    n.includes("specificheatload") ||
    (n.includes("heizlast") &&
      (n.includes("spezif") || n.includes("dichte") || n.includes("/m")))
  );
}

function fuzzyHeatLoad(name: string): boolean {
  const n = name.toLowerCase();
  if (fuzzyHeatLoadDensity(name)) return true;
  return (
    n.includes("heatload") ||
    n.includes("heat_load") ||
    n.includes("heatingload") ||
    (n.includes("heat") && n.includes("load")) ||
    (n.includes("w/m") && n.includes("heat")) ||
    n === "qh" ||
    n === "hl"
  );
}

/** Absolute Heizlast (W) — not density (W/m²). */
function extractAbsoluteHeizlast(
  flat: { pset: string; name: string; value: unknown }[],
): number | null {
  const fromNamed = extractExactNamedNumeric(flat, ABSOLUTE_HEIZLAST_PROP_NAMES);
  if (fromNamed != null) return fromNamed;

  const preferExact: number[] = [];
  const preferFuzzy: number[] = [];
  for (const item of flat) {
    const n = compactPropKey(item.name);
    if (
      n.includes("spezifisch") ||
      n.includes("dichte") ||
      n.includes("perarea") ||
      n.includes("/m") ||
      n.includes("m2") ||
      n.includes("werte") // e.g. Heizlastwerte = enum string
    ) {
      continue;
    }
    const num = readNumber(item.value);
    if (num == null) continue;
    if (
      n === "heizlast" ||
      n === "heizlastw" ||
      n === "sc_raum_heizlast" ||
      n === "bemessungslastheizung" ||
      n.endsWith(".heizlast")
    ) {
      preferExact.push(num);
    } else if (
      (n.includes("heizlast") || n === "heatingload" || n === "heatload") &&
      !n.includes("spezif")
    ) {
      preferFuzzy.push(num);
    } else if (n.includes("bemessungslast") && n.includes("heizung")) {
      preferExact.push(num);
    }
  }
  return preferExact[0] ?? preferFuzzy[0] ?? null;
}

function fuzzyCoolLoadDensity(name: string): boolean {
  const n = compactPropKey(name);
  return (
    n.includes("kuehllastm") ||
    n.includes("kuehllastwm2") ||
    n.includes("spezifischekuehllast") ||
    n.includes("kuehllastdichte") ||
    n.includes("coolingloadperarea") ||
    n.includes("specificcoolingload") ||
    (n.includes("kuehllast") &&
      (n.includes("spezif") || n.includes("dichte") || n.includes("m2")))
  );
}

/** Absolute Kühllast (W) — not density (W/m²). */
function extractAbsoluteKuhllast(
  flat: { pset: string; name: string; value: unknown }[],
): number | null {
  const fromNamed = extractExactNamedNumeric(flat, ABSOLUTE_KUHLLAST_PROP_NAMES);
  if (fromNamed != null) return fromNamed;

  const preferExact: number[] = [];
  const preferFuzzy: number[] = [];
  for (const item of flat) {
    const n = compactPropKey(item.name);
    if (
      n.includes("spezifisch") ||
      n.includes("dichte") ||
      n.includes("perarea") ||
      n.includes("m2") ||
      n.includes("werte")
    ) {
      continue;
    }
    const num = readNumber(item.value);
    if (num == null) continue;
    if (
      n === "kuehllast" ||
      n === "kuehllastw" ||
      n === "sc_raum_kuehllast" ||
      n === "bemessungslastkuehlung" ||
      n === "coolingload" ||
      n.endsWith(".kuehllast")
    ) {
      preferExact.push(num);
    } else if (n.includes("kuehllast") || n.includes("coolingload")) {
      preferFuzzy.push(num);
    } else if (n.includes("bemessungslast") && n.includes("kuehl")) {
      preferExact.push(num);
    }
  }
  return preferExact[0] ?? preferFuzzy[0] ?? null;
}

function fuzzyTemperature(name: string): boolean {
  const n = name.toLowerCase().trim().replace(/\s+/g, "");
  // Prefer explicit room setpoint names — skip frost/ventilation/aux temps
  if (
    n.includes("frost") ||
    n.includes("abluft") ||
    n.includes("zuluft") ||
    n.includes("überstrom") ||
    n.includes("ueberstrom") ||
    n.includes("nutzung_temperatur") ||
    n.includes("stütz") ||
    n.includes("stuetz") ||
    n.includes("temperaturabfall") ||
    n.includes("temperaturfrei")
  ) {
    return false;
  }
  if (
    n === "temp" ||
    n === "sc_raum_temperatur" ||
    n === "cax_raum_temperatur" ||
    n === "sc_raum_standardtemperatur"
  ) {
    return true;
  }
  return (
    n.includes("solltemperatur") ||
    n.endsWith("raum_temperatur") ||
    n.endsWith("raumtemperatur") ||
    (n.includes("raum") && n.includes("temperatur") && !n.includes("zone"))
  );
}

function extractNumericProp(
  psets: unknown[],
  preferredPsets: string[],
  propNames: string[],
  fuzzy?: (name: string) => boolean,
): number | null {
  const preferred = new Set(preferredPsets.map((p) => p.toLowerCase()));
  const flat = flattenProps(psets);

  const tryList = (list: typeof flat): number | null => {
    for (const item of list) {
      if (!propNameMatches(item.name, propNames) && !(fuzzy?.(item.name) ?? false)) {
        continue;
      }
      const num = readNumber(item.value);
      if (num != null) return num;
    }
    return null;
  };

  const preferredItems = flat.filter((i) => preferred.has(i.pset.toLowerCase()));
  return tryList(preferredItems) ?? tryList(flat);
}

async function extractSpaceProps(
  api: WebIFC.IfcAPI,
  modelID: number,
  expressId: number,
): Promise<{
  heatLoad: number;
  heizlast: number | null;
  coolLoad: number;
  kuhllast: number | null;
  temperature: number;
  coolTemperature: number | null;
  height: number | null;
  number: string;
  ventilation: RoomVentilation;
  propDump: string[];
}> {
  let heatLoad = 0;
  let heizlast: number | null = null;
  let coolLoad = 0;
  let kuhllast: number | null = null;
  let temperature = 20;
  let coolTemperature: number | null = null;
  let height: number | null = null;
  let number = "";
  let ventilation = emptyVentilation();
  const propDump: string[] = [];

  try {
    const psets = await api.properties.getPropertySets(modelID, expressId, true);
    const flat = flattenProps(psets);
    for (const item of flat) {
      propDump.push(`${item.pset}.${item.name}=${readString(item.value)}`);
    }

    // This IFC (SimCalc / Revit):
    //   SC_Raum_spezifischeHeizlast → W/m²
    //   Bemessungslast Heizung      → W
    //   Kühllast W/m² / Kühllast W → cooling (often negative in Solar Computer)
    //   SC_Raum_Temperatur → heating setpoint °C
    //   SC_Raum_Temperatur_operativ_MAX_* / _MAX_* → cooling analysis °C
    heatLoad =
      extractExactNamedNumeric(flat, HEAT_DENSITY_PROP_NAMES) ??
      extractNumericProp(
        psets,
        [
          "Ergebnisse der Analyse",
          ...HEAT_LOAD_PSET_NAMES,
        ],
        HEAT_DENSITY_PROP_NAMES,
        fuzzyHeatLoadDensity,
      ) ??
      0;

    heizlast =
      extractExactNamedNumeric(flat, ABSOLUTE_HEIZLAST_PROP_NAMES) ??
      extractAbsoluteHeizlast(flat);

    coolLoad =
      extractExactNamedNumeric(flat, COOL_DENSITY_PROP_NAMES) ??
      extractNumericProp(
        psets,
        [
          "Ergebnisse der Analyse",
          ...HEAT_LOAD_PSET_NAMES,
        ],
        COOL_DENSITY_PROP_NAMES,
        fuzzyCoolLoadDensity,
      ) ??
      0;
    // Solar Computer / Revit: cooling is negative (e.g. -38.94 W/m²). Keep sign.

    kuhllast =
      extractExactNamedNumeric(flat, ABSOLUTE_KUHLLAST_PROP_NAMES) ??
      extractAbsoluteKuhllast(flat);
    // Absolute Kühllast W is also signed in Solar Computer (e.g. -145).

    temperature =
      extractExactNamedNumeric(flat, [
        "SC_Raum_Temperatur",
        "CAx_Raum_Temperatur",
        "SC_Raum_StandardTemperatur",
        "Temp",
      ]) ??
      extractNumericProp(
        psets,
        TEMPERATURE_PSET_NAMES,
        TEMPERATURE_PROP_NAMES,
        fuzzyTemperature,
      ) ??
      20;

    const rawCoolTemp =
      extractExactNamedNumeric(flat, COOL_TEMPERATURE_PROP_NAMES) ??
      extractNumericProp(
        psets,
        ["Ergebnisse der Analyse", ...TEMPERATURE_PSET_NAMES],
        COOL_TEMPERATURE_PROP_NAMES,
      );
    // Solar Computer uses 0 as empty placeholder for unused analysis runs.
    if (rawCoolTemp != null && Number.isFinite(rawCoolTemp) && rawCoolTemp > 0) {
      coolTemperature = rawCoolTemp;
    }

    const rawHeight =
      extractExactNamedNumeric(flat, [
        "SC_Raum_Höhe",
        "SC_Raum_Hoehe",
        "Lichte Höhe",
        "Lichte Hoehe",
        "Unbounded Height",
        "Clear Height",
      ]) ?? null;
    // Revit often exports mm (e.g. 2549.9); treat values > 20 as mm → m.
    if (rawHeight != null && Number.isFinite(rawHeight) && rawHeight > 0) {
      height = rawHeight > 20 ? rawHeight / 1000 : rawHeight;
    }

    for (const item of flat) {
      const name = item.name.toLowerCase();
      if (
        name === "number" ||
        name === "numbering" ||
        name === "raumnummer" ||
        name === "roomnumber" ||
        name === "mark" ||
        name === "nummer"
      ) {
        number = readString(item.value);
      }
    }

    ventilation = extractVentilationProps(flat);
  } catch {
    // Property lookup can fail on incomplete exports — keep defaults.
  }

  return {
    heatLoad,
    heizlast,
    coolLoad,
    kuhllast,
    temperature,
    coolTemperature,
    height,
    number,
    ventilation,
    propDump,
  };
}

export type IfcSource = string | File | ArrayBuffer | Uint8Array;

async function resolveIfcBytes(
  source: IfcSource,
  report: (p: LoadProgress) => void,
): Promise<Uint8Array> {
  if (typeof source === "string") {
    report({ phase: "fetch", progress: 0, message: "Downloading IFC…" });
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch IFC (${response.status}): ${source}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    report({ phase: "fetch", progress: 1, message: "Download complete" });
    return buffer;
  }

  if (source instanceof File) {
    report({ phase: "fetch", progress: 0, message: `Reading ${source.name}…` });
    const ab = await source.arrayBuffer();
    const buffer = new Uint8Array(ab);
    if (buffer.byteLength === 0) {
      throw new Error(`IFC file is empty: ${source.name}`);
    }
    report({ phase: "fetch", progress: 1, message: "File read complete" });
    return buffer;
  }

  report({ phase: "fetch", progress: 1, message: "Using provided buffer…" });
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}

/**
 * Load an IFC from a public path, File, or ArrayBuffer and extract floors,
 * colored room spaces, and a building shell group that keeps IFC material colors.
 */
export async function loadIfcModel(
  source: IfcSource,
  onProgress?: ProgressCallback,
): Promise<LoadedModel> {
  const report = (p: LoadProgress) => {
    onProgress?.(p);
    debugLog(
      "ifcClient",
      `${p.phase}: ${p.message}`,
      "info",
      { progress: p.progress },
    );
  };

  const sourceKind =
    typeof source === "string"
      ? `path:${source}`
      : source instanceof File
        ? `file:${source.name} (${source.size} bytes)`
        : `buffer:${source.byteLength} bytes`;
  debugLog("ifcClient", `loadIfcModel start — ${sourceKind}`, "info");

  try {
    const buffer = await resolveIfcBytes(source, report);
    debugLog("ifcClient", `bytes ready: ${buffer.byteLength}`, "ok");

    report({ phase: "parse", progress: -1, message: "Opening model in WASM…" });
    closeActiveIfcModel();
    const api = await getIfcApi();
    debugLog("ifcClient", "WASM IfcAPI ready", "ok");

    const modelID = api.OpenModel(buffer);
    if (modelID < 0) {
      throw new Error("web-ifc failed to open the IFC model");
    }
    setOpenHandle({ api, modelID });
    debugLog("ifcClient", `OpenModel ok — modelID=${modelID}`, "ok");

    try {
      await yieldToMain();

      report({ phase: "properties", progress: 0.1, message: "Reading storeys…" });
      const containment = buildContainmentMap(api, modelID);
      const aggregation = buildAggregationMap(api, modelID);
      debugLog(
        "ifcClient",
        `containment map: ${containment.size} elements, aggregates: ${aggregation.size}`,
        "info",
      );

      const storeyIds = vectorToArray(
        api.GetLineIDsWithType(modelID, WebIFC.IFCBUILDINGSTOREY),
      );
      const floors: Floor[] = [];
      const storeyGuidByExpress = new Map<number, string>();

      for (const sid of storeyIds) {
        const line = api.GetLine(modelID, sid);
        const id = readString(line.GlobalId) || `storey-${sid}`;
        const name =
          readString(line.Name) || readString(line.LongName) || `Storey ${sid}`;
        const elevation = readNumber(line.Elevation) ?? 0;
        storeyGuidByExpress.set(sid, id);
        floors.push({ id, name, elevation, expressId: sid });
      }
      floors.sort((a, b) => a.elevation - b.elevation);

      if (floors.length === 0) {
        floors.push({
          id: "default-floor",
          name: "All levels",
          elevation: 0,
          expressId: -1,
        });
      }
      debugLog("ifcClient", `floors: ${floors.length}`, "ok", floors.map((f) => f.name));

      const spaceIds = vectorToArray(
        api.GetLineIDsWithType(modelID, WebIFC.IFCSPACE),
      );
      const spaceIdSet = new Set(spaceIds);
      const rooms: Room[] = [];
      const spaceGeoms = new Map<number, THREE.BufferGeometry>();
      const shellGeoms: {
        geom: THREE.BufferGeometry;
        expressId: number;
        floorId: string;
        colorHex: number;
      }[] = [];

      report({ phase: "geometry", progress: 0, message: "Extracting geometry…" });
      debugLog("ifcClient", `IfcSpace count: ${spaceIds.length}`, "info");

      let meshIndex = 0;
      let meshTotal = 1;
      let meshErrors = 0;

      const takeMesh = (mesh: WebIFC.FlatMesh, index: number, total: number) => {
        meshIndex = index;
        meshTotal = Math.max(total, 1);
        try {
          ingestFlatMesh(
            api,
            modelID,
            mesh,
            spaceIdSet,
            spaceGeoms,
            shellGeoms,
            containment,
            storeyGuidByExpress,
            floors,
          );
        } catch (err) {
          meshErrors += 1;
          if (meshErrors <= 3) {
            debugLog("ifcClient", `mesh #${index} failed`, "warn", err);
          }
        } finally {
          safeDelete(mesh);
        }
      };

      // Building shell + any product meshes that happen to be spaces
      api.StreamAllMeshes(modelID, takeMesh);

      // Revit spaces often have Body representation that StreamAllMeshes skips —
      // pull them explicitly by ID and by type.
      if (spaceIds.length > 0) {
        try {
          api.StreamMeshes(modelID, spaceIds, takeMesh);
        } catch (err) {
          debugLog("ifcClient", "StreamMeshes(spaces) failed", "warn", err);
        }
        try {
          api.StreamAllMeshesWithTypes(modelID, [WebIFC.IFCSPACE], takeMesh);
        } catch (err) {
          debugLog(
            "ifcClient",
            "StreamAllMeshesWithTypes(IFCSPACE) failed",
            "warn",
            err,
          );
        }
      }

      // Per-space GetFlatMesh fallback for any still missing
      let flatMeshHits = 0;
      for (const sid of spaceIds) {
        if (spaceGeoms.has(sid)) continue;
        try {
          const flat = api.GetFlatMesh(modelID, sid);
          if (!flat) continue;
          try {
            const geom = mergePlacedGeometries(api, modelID, flat);
            if (geom) {
              spaceGeoms.set(sid, geom);
              flatMeshHits += 1;
            }
          } finally {
            safeDelete(flat);
          }
        } catch {
          // no tessellation for this space
        }
      }

      // Fallback: Revit often exports room volumes as IfcBuildingElementProxy
      // with the same Name/Number as the IfcSpace — reclaim those shell meshes.
      if (spaceGeoms.size < spaceIds.length && shellGeoms.length > 0) {
        const keyToSpace = new Map<string, number>();
        for (const sid of spaceIds) {
          if (spaceGeoms.has(sid)) continue;
          try {
            const line = api.GetLine(modelID, sid);
            const keys = [
              readString(line.Name),
              readString(line.LongName),
              readString(line.Tag),
            ]
              .map(normalizeRoomKey)
              .filter(Boolean);
            for (const k of keys) {
              if (!keyToSpace.has(k)) keyToSpace.set(k, sid);
            }
          } catch {
            // skip
          }
        }

        const remaining: typeof shellGeoms = [];
        let proxyMatched = 0;
        for (const piece of shellGeoms) {
          let matchedSpace: number | null = null;
          try {
            const typeCode = api.GetLineType(modelID, piece.expressId);
            const typeName = api.GetNameFromTypeCode(typeCode) ?? "";
            const isProxyLike =
              typeCode === WebIFC.IFCBUILDINGELEMENTPROXY ||
              typeName.toLowerCase().includes("proxy") ||
              typeName.toLowerCase().includes("covering") ||
              typeName.toLowerCase().includes("furnishing");

            if (isProxyLike) {
              const line = api.GetLine(modelID, piece.expressId);
              const keys = [
                readString(line.Name),
                readString(line.LongName),
                readString(line.Tag),
                readString(line.ObjectType),
              ]
                .map(normalizeRoomKey)
                .filter(Boolean);
              for (const k of keys) {
                const sid = keyToSpace.get(k);
                if (sid != null && !spaceGeoms.has(sid)) {
                  matchedSpace = sid;
                  break;
                }
              }
            }
          } catch {
            // keep as shell
          }

          if (matchedSpace != null) {
            const prev = spaceGeoms.get(matchedSpace);
            if (prev) prev.dispose();
            spaceGeoms.set(matchedSpace, piece.geom);
            proxyMatched += 1;
          } else {
            remaining.push(piece);
          }
        }
        shellGeoms.length = 0;
        shellGeoms.push(...remaining);
        if (proxyMatched > 0) {
          debugLog(
            "ifcClient",
            `matched ${proxyMatched} proxy/volume mesh(es) to IfcSpace by name`,
            "ok",
          );
        }
      }

      // Spatial fallback: assign unmatched proxy-like shell meshes to nearest space
      // placement when name matching left spaces without geometry.
      if (spaceGeoms.size < spaceIds.length && shellGeoms.length > 0) {
        const unmatchedSpaces = spaceIds.filter((id) => !spaceGeoms.has(id));
        const spaceOrigins = new Map<number, THREE.Vector3>();
        for (const sid of unmatchedSpaces) {
          try {
            const line = api.GetLine(modelID, sid, true);
            const origin = extractPlacementOrigin(line);
            if (origin) spaceOrigins.set(sid, origin);
          } catch {
            // skip
          }
        }

        if (spaceOrigins.size > 0) {
          const usedSpaces = new Set<number>();

          const candidates = shellGeoms
            .map((piece) => {
              let proxyLike = false;
              try {
                const typeCode = api.GetLineType(modelID, piece.expressId);
                const typeName =
                  api.GetNameFromTypeCode(typeCode)?.toLowerCase() ?? "";
                proxyLike =
                  typeCode === WebIFC.IFCBUILDINGELEMENTPROXY ||
                  typeName.includes("proxy") ||
                  typeName.includes("space");
              } catch {
                proxyLike = false;
              }
              piece.geom.computeBoundingBox();
              const center = new THREE.Vector3();
              piece.geom.boundingBox?.getCenter(center);
              return { piece, center, proxyLike };
            })
            .filter((c) => c.proxyLike);

          if (candidates.length > 0) {
            const claimed = new Set<number>();
            let spatialMatched = 0;

            for (const { piece, center } of candidates) {
              let bestId: number | null = null;
              let bestDist = Infinity;
              for (const [sid, origin] of spaceOrigins) {
                if (usedSpaces.has(sid)) continue;
                const d = center.distanceToSquared(origin);
                if (d < bestDist) {
                  bestDist = d;
                  bestId = sid;
                }
              }
              const maxDist = 8; // metres
              if (bestId != null && bestDist <= maxDist * maxDist) {
                const prev = spaceGeoms.get(bestId);
                if (prev) prev.dispose();
                spaceGeoms.set(bestId, piece.geom);
                usedSpaces.add(bestId);
                claimed.add(piece.expressId);
                spatialMatched += 1;
              }
            }

            const remaining = shellGeoms.filter(
              (p) => !claimed.has(p.expressId),
            );
            shellGeoms.length = 0;
            shellGeoms.push(...remaining);
            if (spatialMatched > 0) {
              debugLog(
                "ifcClient",
                `matched ${spatialMatched} shell mesh(es) to IfcSpace by proximity`,
                "ok",
              );
            }
          }
        }
      }

      // Always strip shell meshes that heavily overlap room volumes — otherwise
      // Full Color shows coplanar translucent shell + overlays (white z-fight lines).
      if (spaceGeoms.size > 0 && shellGeoms.length > 0) {
        const roomBoxes: THREE.Box3[] = [];
        for (const geom of spaceGeoms.values()) {
          geom.computeBoundingBox();
          if (geom.boundingBox && !geom.boundingBox.isEmpty()) {
            roomBoxes.push(geom.boundingBox.clone());
          }
        }

        const kept: typeof shellGeoms = [];
        let culled = 0;
        for (const piece of shellGeoms) {
          piece.geom.computeBoundingBox();
          const box = piece.geom.boundingBox;
          const overlaps =
            box != null &&
            !box.isEmpty() &&
            roomBoxes.some((rb) => boxesOverlapHeavily(box, rb));
          if (overlaps) {
            piece.geom.dispose();
            culled += 1;
          } else {
            kept.push(piece);
          }
        }
        shellGeoms.length = 0;
        shellGeoms.push(...kept);
        if (culled > 0) {
          debugLog(
            "ifcClient",
            `culled ${culled} shell mesh(es) overlapping room volumes (z-fight fix)`,
            "ok",
          );
        }
      }

      debugLog(
        "ifcClient",
        `geometry stream done — meshes≈${meshTotal}, spacesWithGeom=${spaceGeoms.size}, shellParts=${shellGeoms.length}, flatMeshHits=${flatMeshHits}, meshErrors=${meshErrors}`,
        meshErrors || spaceGeoms.size === 0 ? "warn" : "ok",
      );

      report({
        phase: "geometry",
        progress: Math.min(1, meshIndex / meshTotal),
        message: "Building room meshes…",
      });
      await yieldToMain();

      report({
        phase: "properties",
        progress: 0.4,
        message: "Reading space properties…",
      });

      let processed = 0;
      let sampleLogged = false;
      for (const spaceExpressId of spaceIds) {
        processed++;
        if (processed % 8 === 0) {
          report({
            phase: "properties",
            progress: 0.4 + 0.5 * (processed / Math.max(spaceIds.length, 1)),
            message: `Reading spaces (${processed}/${spaceIds.length})…`,
          });
          await yieldToMain();
        }

        const line = api.GetLine(modelID, spaceExpressId);
        const globalId = readString(line.GlobalId) || `space-${spaceExpressId}`;
        const name =
          readString(line.LongName) ||
          readString(line.Name) ||
          `Room ${spaceExpressId}`;
        const tagNumber = readString(line.Name) || readString(line.Tag);
        const props = await extractSpaceProps(api, modelID, spaceExpressId);

        if (!sampleLogged && props.propDump.length) {
          sampleLogged = true;
          debugLog(
            "ifcClient",
            `sample space props (${props.propDump.length})`,
            "info",
            props.propDump.slice(0, 40),
          );
          debugLog(
            "ifcClient",
            `parsed heatLoad=${props.heatLoad} heizlast=${props.heizlast} coolLoad=${props.coolLoad} kuhllast=${props.kuhllast} temperature=${props.temperature} coolTemp=${props.coolTemperature}`,
            props.heatLoad === 0 || props.heizlast == null ? "warn" : "ok",
          );
        }

        const geom = spaceGeoms.get(spaceExpressId);
        if (!geom) continue;

        const storeyExpress =
          aggregation.get(spaceExpressId) ?? containment.get(spaceExpressId);
        const floorId =
          (storeyExpress != null
            ? storeyGuidByExpress.get(storeyExpress)
            : undefined) ?? floors[0].id;

        rooms.push({
          id: globalId,
          name,
          number: props.number || tagNumber,
          heatLoad: props.heatLoad,
          heizlast: props.heizlast,
          coolLoad: props.coolLoad,
          kuhllast: props.kuhllast,
          temperature: props.temperature,
          coolTemperature: props.coolTemperature,
          height: props.height,
          ventilation: props.ventilation,
          floorId,
          expressId: spaceExpressId,
          geometry: geom,
        });
      }

      // Unify ContainedIn (walls/doors/windows) + Aggregates (spaces) storeys.
      const mergedFloors = mergeDuplicateFloors(floors, rooms, shellGeoms);
      floors.length = 0;
      floors.push(...mergedFloors);
      debugLog(
        "ifcClient",
        `floors after merge: ${floors.length}`,
        "ok",
        floors.map((f) => f.name),
      );

      // Prefer Revit room clear-height as storey pitch metadata when available.
      for (const floor of floors) {
        const heights = rooms
          .filter((r) => r.floorId === floor.id && r.height != null && r.height! > 0)
          .map((r) => r.height!);
        if (heights.length) {
          floor.typicalHeight =
            heights.reduce((a, b) => a + b, 0) / heights.length;
        }
      }

      // Bottom slab + walls stay; ceiling / top slab moves to the next storey.
      reassignUpperSlabsToNextFloor(floors, shellGeoms, (piece) => {
        try {
          const typeCode = api.GetLineType(modelID, piece.expressId);
          const typeName =
            (api.GetNameFromTypeCode(typeCode) ?? "").toLowerCase();
          return (
            typeCode === WebIFC.IFCSLAB ||
            typeName.includes("slab") ||
            typeName.includes("floor") ||
            typeName.includes("footing") ||
            typeName.includes("decke") ||
            typeName.includes("bodenplatte") ||
            typeName.includes("boden")
          );
        } catch {
          return false;
        }
      });

      const keptFloors = pruneEmptyFloors(floors, rooms, shellGeoms);
      floors.length = 0;
      floors.push(...keptFloors);
      debugLog(
        "ifcClient",
        `floors after prune empty: ${floors.length}`,
        "ok",
        floors.map((f) => f.name),
      );

      const heatValues = rooms.map((r) => r.heatLoad);
      const coolValues = rooms.map((r) => r.coolLoad);
      const minH = heatValues.length ? Math.min(...heatValues) : 0;
      const maxH = heatValues.length ? Math.max(...heatValues) : 0;
      const minC = coolValues.length ? Math.min(...coolValues) : 0;
      const maxC = coolValues.length ? Math.max(...coolValues) : 0;
      debugLog(
        "ifcClient",
        `rooms built: ${rooms.length} — Heizlast ${minH}…${maxH} · Kühllast ${minC}…${maxC}`,
        maxH === 0 && rooms.length > 0 ? "warn" : "ok",
      );

      report({
        phase: "geometry",
        progress: 0.95,
        message: "Assembling building shell…",
      });
      await yieldToMain();

      const shellGroup = new THREE.Group();
      shellGroup.name = "building-shell";

      for (const piece of shellGeoms) {
        const mat = new THREE.MeshStandardMaterial({
          color: piece.colorHex,
          roughness: 0.75,
          metalness: 0.05,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        });
        mat.userData.baseColorHex = `#${piece.colorHex.toString(16).padStart(6, "0")}`;
        const meshObj = new THREE.Mesh(piece.geom, mat);
        meshObj.castShadow = true;
        meshObj.receiveShadow = true;
        meshObj.userData.floorId = piece.floorId;
        meshObj.userData.expressId = piece.expressId;
        meshObj.userData.colorHex = mat.userData.baseColorHex;
        shellGroup.add(meshObj);
      }

      const coord = api.GetCoordinationMatrix(modelID);
      if (coord && coord.length === 16) {
        const m = new THREE.Matrix4().fromArray(coord);
        shellGroup.applyMatrix4(m);
        for (const room of rooms) {
          room.geometry.applyMatrix4(m);
        }
      }

      report({ phase: "done", progress: 1, message: "Ready" });
      debugLog(
        "ifcClient",
        `load complete — floors=${floors.length} rooms=${rooms.length} shellChildren=${shellGroup.children.length}`,
        "ok",
      );
      return { floors, rooms, shellGroup };
    } catch (err) {
      closeActiveIfcModel();
      throw err;
    }
  } catch (err) {
    debugLog("ifcClient", "loadIfcModel failed", "error", err);
    throw err;
  }
}

export async function getElementDetails(
  expressId: number,
  floorId: string | null = null,
  roomId: string | null = null,
): Promise<import("./types").SelectedElement | null> {
  const openHandle = getOpenHandle();
  if (!openHandle) {
    debugLog("ifcClient", "getElementDetails: no open model", "warn");
    return null;
  }
  const { api, modelID } = openHandle;
  try {
    const line = api.GetLine(modelID, expressId, true);
    const typeCode = api.GetLineType(modelID, expressId);
    const typeName =
      typeof api.GetNameFromTypeCode === "function"
        ? api.GetNameFromTypeCode(typeCode)
        : `Type ${typeCode}`;
    const globalId = readString(line?.GlobalId) || `id-${expressId}`;
    const name =
      readString(line?.LongName) ||
      readString(line?.Name) ||
      readString(line?.Tag) ||
      typeName;

    const psets = await api.properties.getPropertySets(modelID, expressId, true);
    const flat = flattenProps(psets);
    const properties = flat.map((p) => ({
      name: p.name,
      value: readString(p.value),
      pset: p.pset,
    }));

    const kind = roomId ? "room" : "component";
    return {
      expressId,
      globalId,
      typeName: String(typeName),
      name,
      floorId,
      kind,
      roomId,
      properties,
    };
  } catch (err) {
    debugLog("ifcClient", `getElementDetails failed #${expressId}`, "error", err);
    return null;
  }
}

export function disposeLoadedModel(model: LoadedModel | null | undefined): void {
  if (!model) return;
  for (const room of model.rooms) {
    room.geometry.dispose();
  }
  model.shellGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
  // Keep WASM model open for property queries until next load replaces it.
}
