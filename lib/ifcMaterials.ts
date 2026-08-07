import * as THREE from "three";
import * as WebIFC from "web-ifc";
import { debugLog } from "./debugLog";

/**
 * IFC surface appearance.
 *
 * web-ifc only hands us a flat RGBA per placed geometry, which renders every
 * element as the same dull plastic. Real IFC viewers look right because glass
 * is glazed, metal is specular and concrete is matte — so we resolve the IFC
 * material name (from IfcRelAssociatesMaterial, following the type when the
 * material sits on IfcWallType & friends) and map it onto PBR presets.
 */

export type IfcSurfaceClass =
  | "glass"
  | "metal"
  | "wood"
  | "concrete"
  | "masonry"
  | "plaster"
  | "insulation"
  | "stone"
  | "roofing"
  | "textile"
  | "plastic"
  | "water"
  | "generic";

export type IfcSurface = {
  colorHex: string;
  opacity: number;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  /** Thin / transparent geometry reads wrong when backfaces are culled. */
  doubleSide: boolean;
  surfaceClass: IfcSurfaceClass;
};

type SurfacePreset = Omit<IfcSurface, "colorHex" | "opacity" | "surfaceClass"> & {
  /** Cap on opacity — glazing stays see-through even if the IFC says opaque. */
  maxOpacity?: number;
};

const PRESETS: Record<IfcSurfaceClass, SurfacePreset> = {
  glass: {
    roughness: 0.06,
    metalness: 0.0,
    envMapIntensity: 1.5,
    doubleSide: true,
    // Floor so glazing never drops out against sky / light backgrounds.
    maxOpacity: 0.55,
  },
  metal: {
    roughness: 0.3,
    metalness: 0.85,
    envMapIntensity: 1.25,
    doubleSide: false,
  },
  wood: {
    roughness: 0.62,
    metalness: 0.02,
    envMapIntensity: 0.5,
    doubleSide: false,
  },
  concrete: {
    roughness: 0.93,
    metalness: 0.0,
    envMapIntensity: 0.28,
    doubleSide: false,
  },
  masonry: {
    roughness: 0.87,
    metalness: 0.0,
    envMapIntensity: 0.32,
    doubleSide: false,
  },
  plaster: {
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.22,
    doubleSide: false,
  },
  insulation: {
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.12,
    doubleSide: false,
  },
  stone: {
    roughness: 0.38,
    metalness: 0.02,
    envMapIntensity: 0.85,
    doubleSide: false,
  },
  roofing: {
    roughness: 0.68,
    metalness: 0.12,
    envMapIntensity: 0.5,
    doubleSide: true,
  },
  textile: {
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.1,
    doubleSide: false,
  },
  plastic: {
    roughness: 0.45,
    metalness: 0.02,
    envMapIntensity: 0.65,
    doubleSide: false,
  },
  water: {
    roughness: 0.08,
    metalness: 0.0,
    envMapIntensity: 1.3,
    doubleSide: true,
    maxOpacity: 0.55,
  },
  generic: {
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.42,
    doubleSide: false,
  },
};

/** German + English keywords — IFC material names in DACH files are German. */
const MATERIAL_KEYWORDS: [IfcSurfaceClass, string[]][] = [
  ["glass", ["glas", "glass", "verglas", "glazing", "isolierglas", "float"]],
  [
    "metal",
    [
      "metall", "metal", "stahl", "steel", "alu", "aluminium", "aluminum",
      "zink", "zinc", "kupfer", "copper", "messing", "brass", "bronze",
      "edelstahl", "chrom", "chrome", "eisen", "iron", "titan", "blech",
    ],
  ],
  [
    "wood",
    [
      "holz", "wood", "timber", "eiche", "oak", "fichte", "spruce", "kiefer",
      "pine", "buche", "beech", "esche", "ash", "parkett", "parquet",
      "laminat", "laminate", "osb", "sperrholz", "plywood", "mdf", "furnier",
      "brett", "balken", "leim",
    ],
  ],
  [
    "concrete",
    ["beton", "concrete", "stahlbeton", "reinforced", "estrich", "screed", "zement", "cement"],
  ],
  [
    "masonry",
    [
      "mauerwerk", "masonry", "ziegel", "brick", "klinker", "kalksandstein",
      "porenbeton", "ytong", "block", "hohlblock", "lehm",
    ],
  ],
  [
    "plaster",
    [
      "putz", "plaster", "gips", "gypsum", "stucco", "spachtel", "anstrich",
      "farbe", "paint", "rigips", "trockenbau", "drywall", "kalk", "lime",
    ],
  ],
  [
    "insulation",
    [
      "dämmung", "daemmung", "dammung", "insulation", "mineralwolle",
      "steinwolle", "glaswolle", "styropor", "eps", "xps", "pur", "pir",
      "wolle", "wool", "isolier",
    ],
  ],
  [
    "stone",
    [
      "fliese", "tile", "kachel", "keramik", "ceramic", "stein", "stone",
      "granit", "granite", "marmor", "marble", "naturstein", "schiefer",
      "slate", "sandstein", "kalkstein", "terrazzo",
    ],
  ],
  [
    "roofing",
    ["dachbahn", "roofing", "bitumen", "dachpappe", "abdichtung", "membran", "membrane", "eindeckung"],
  ],
  ["textile", ["teppich", "carpet", "textil", "textile", "stoff", "fabric", "filz", "felt"]],
  [
    "plastic",
    [
      "kunststoff", "plastic", "pvc", "polyethylen", "polypropylen",
      "acryl", "acrylic", "plexi", "epoxid", "epoxy", "gummi", "rubber",
      "linoleum", "vinyl",
    ],
  ],
  ["water", ["wasser", "water"]],
];

/** Fallback by IFC entity when the file carries no material name. */
const TYPE_CLASS: [IfcSurfaceClass, string[]][] = [
  ["glass", ["ifcwindow", "ifcplate", "ifccurtainwall", "ifcmirror"]],
  [
    "metal",
    [
      "ifcrailing", "ifcpipesegment", "ifcpipefitting", "ifcductsegment",
      "ifcductfitting", "ifcflowfitting", "ifcflowterminal",
      "ifcflowsegment", "ifcflowcontroller", "ifcflowmovingdevice",
      "ifcairterminal", "ifccablecarrier", "ifcreinforcing", "ifcfastener",
      "ifcvalve", "ifcpump", "ifcboiler", "ifcradiator", "ifcunitaryequipment",
    ],
  ],
  ["wood", ["ifcdoor", "ifcfurnish", "ifcfurniture"]],
  ["concrete", ["ifcslab", "ifcbeam", "ifccolumn", "ifcfooting", "ifcpile", "ifcstair", "ifcramp"]],
  ["masonry", ["ifcwall"]],
  ["roofing", ["ifcroof"]],
  ["plaster", ["ifccovering"]],
];

function matchKeyword(
  haystack: string,
  table: [IfcSurfaceClass, string[]][],
): IfcSurfaceClass | null {
  for (const [surfaceClass, words] of table) {
    for (const word of words) {
      if (haystack.includes(word)) return surfaceClass;
    }
  }
  return null;
}

export type ClassifyInput = {
  colorHex: string;
  /** IFC alpha, 1 = opaque. */
  opacity: number;
  typeName?: string | null;
  materialName?: string | null;
};

export function classifyIfcSurface(input: ClassifyInput): IfcSurface {
  const material = (input.materialName ?? "").toLowerCase();
  const type = (input.typeName ?? "").toLowerCase();

  let surfaceClass =
    matchKeyword(material, MATERIAL_KEYWORDS) ??
    matchKeyword(type, TYPE_CLASS) ??
    null;

  // A translucent surface with no better clue is glazing in practice.
  if (!surfaceClass && input.opacity < 0.92) surfaceClass = "glass";
  surfaceClass ??= "generic";

  const preset = PRESETS[surfaceClass];
  const opacity = Math.max(
    0.05,
    Math.min(preset.maxOpacity ?? 1, input.opacity),
  );

  return {
    colorHex: input.colorHex,
    opacity,
    roughness: preset.roughness,
    metalness: preset.metalness,
    envMapIntensity: preset.envMapIntensity,
    doubleSide: preset.doubleSide,
    surfaceClass,
  };
}

/** Stable key so identical surfaces can share a material instance. */
export function ifcSurfaceKey(surface: IfcSurface): string {
  return [
    surface.colorHex,
    surface.opacity.toFixed(3),
    surface.surfaceClass,
  ].join("|");
}

/**
 * Creates the render material for a surface. Base PBR values are copied into
 * userData so shading modes can restore them instead of guessing constants.
 */
export function createIfcMaterial(
  surface: IfcSurface,
): THREE.MeshStandardMaterial {
  const transparent = surface.opacity < 0.995;
  const mat = new THREE.MeshStandardMaterial({
    color: surface.colorHex,
    roughness: surface.roughness,
    metalness: surface.metalness,
    envMapIntensity: surface.envMapIntensity,
    transparent,
    opacity: surface.opacity,
    // Glazing must not occlude what is behind it in the depth buffer.
    depthWrite: !transparent,
    side: surface.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  mat.userData.baseColorHex = surface.colorHex;
  mat.userData.ifcSurface = surface;
  return mat;
}

/** Reset a material to its IFC appearance after a shading mode changed it. */
export function applyIfcSurface(
  mat: THREE.MeshStandardMaterial,
  surface: IfcSurface,
  /** Global Elements opacity slider — scales, never brightens. */
  opacityScale = 1,
): void {
  const opacity = Math.max(0.02, Math.min(1, surface.opacity * opacityScale));
  const transparent = opacity < 0.995;
  mat.color.set(surface.colorHex);
  mat.roughness = surface.roughness;
  mat.metalness = surface.metalness;
  mat.envMapIntensity = surface.envMapIntensity;
  mat.opacity = opacity;
  mat.transparent = transparent;
  mat.depthWrite = !transparent;
  mat.side = surface.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  mat.emissive.setHex(0x000000);
  mat.emissiveIntensity = 0;
  mat.wireframe = false;
  mat.needsUpdate = true;
}

export function readIfcSurface(
  mat: THREE.MeshStandardMaterial,
): IfcSurface | null {
  return (mat.userData.ifcSurface as IfcSurface | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// IFC material name extraction
// ---------------------------------------------------------------------------

function vectorToArray(vec: WebIFC.Vector<number>): number[] {
  const out: number[] = [];
  const size = vec.size();
  for (let i = 0; i < size; i++) out.push(vec.get(i));
  return out;
}

function readName(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return readName((value as { value: unknown }).value);
  }
  return "";
}

type Line = Record<string, unknown> | null;

function safeLine(api: WebIFC.IfcAPI, modelID: number, id: number): Line {
  try {
    return api.GetLine(modelID, id) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function refValue(value: unknown): number | null {
  const v = (value as { value?: unknown } | undefined)?.value;
  return typeof v === "number" ? v : null;
}

function refList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const entry of value) {
    const id = refValue(entry);
    if (id != null) out.push(id);
  }
  return out;
}

/**
 * Walks IfcMaterial / MaterialLayerSet(Usage) / MaterialList /
 * MaterialProfileSet / MaterialConstituentSet down to a usable name.
 */
function resolveMaterialName(
  api: WebIFC.IfcAPI,
  modelID: number,
  id: number,
  depth = 0,
): string {
  if (depth > 5) return "";
  const line = safeLine(api, modelID, id);
  if (!line) return "";

  const direct = readName(line.Name);
  if (direct) return direct;

  const setName = readName(line.LayerSetName);
  if (setName) return setName;

  // IfcMaterialLayerSetUsage → IfcMaterialLayerSet
  const forLayerSet = refValue(line.ForLayerSet);
  if (forLayerSet != null) {
    const name = resolveMaterialName(api, modelID, forLayerSet, depth + 1);
    if (name) return name;
  }

  // Layer / profile / constituent sets: name after the thickest-first entry.
  for (const key of [
    "MaterialLayers",
    "MaterialProfiles",
    "MaterialConstituents",
    "Materials",
  ]) {
    for (const childId of refList(line[key])) {
      const child = safeLine(api, modelID, childId);
      if (!child) continue;
      const childName = readName(child.Name);
      if (childName) return childName;
      const nested = refValue(child.Material) ?? refValue(child.Profile);
      if (nested != null) {
        const name = resolveMaterialName(api, modelID, nested, depth + 1);
        if (name) return name;
      }
    }
  }

  const material = refValue(line.Material);
  if (material != null) {
    return resolveMaterialName(api, modelID, material, depth + 1);
  }

  return "";
}

/**
 * expressId → IFC material name, for products and for the types they use
 * (most authoring tools attach the material to IfcWallType, not the wall).
 */
export function buildIfcMaterialNameMap(
  api: WebIFC.IfcAPI,
  modelID: number,
): Map<number, string> {
  const byObject = new Map<number, string>();

  let relIds: number[] = [];
  try {
    relIds = vectorToArray(
      api.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL),
    );
  } catch (err) {
    debugLog("ifcMaterials", "IfcRelAssociatesMaterial query failed", "warn", err);
    return byObject;
  }
  debugLog(
    "ifcMaterials",
    `IfcRelAssociatesMaterial relations: ${relIds.length}`,
    relIds.length ? "ok" : "warn",
  );

  const nameCache = new Map<number, string>();
  for (const relId of relIds) {
    const rel = safeLine(api, modelID, relId);
    if (!rel) continue;
    const materialId = refValue(rel.RelatingMaterial);
    if (materialId == null) continue;

    let name = nameCache.get(materialId);
    if (name == null) {
      name = resolveMaterialName(api, modelID, materialId);
      nameCache.set(materialId, name);
    }
    if (!name) continue;

    for (const objectId of refList(rel.RelatedObjects)) {
      byObject.set(objectId, name);
    }
  }

  // Inherit from the element type when the instance has no own material.
  try {
    const typeRels = vectorToArray(
      api.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYTYPE),
    );
    for (const relId of typeRels) {
      const rel = safeLine(api, modelID, relId);
      if (!rel) continue;
      const typeId = refValue(rel.RelatingType);
      if (typeId == null) continue;
      const typeName = byObject.get(typeId);
      if (!typeName) continue;
      for (const objectId of refList(rel.RelatedObjects)) {
        if (!byObject.has(objectId)) byObject.set(objectId, typeName);
      }
    }
  } catch {
    // type inheritance is optional
  }

  return byObject;
}
