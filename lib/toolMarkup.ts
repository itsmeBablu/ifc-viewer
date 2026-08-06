import * as THREE from "three";

/** Discrete markup units — designed for later per-object sync. */
export type MarkupShapeType =
  | "cube"
  | "sphere"
  | "cylinder"
  | "cone"
  | "torus"
  | "capsule"
  | "pyramid";

export type MarkupToolId = MarkupShapeType | "note";

export type MarkupPlacement = {
  id: string;
  modelKey: string;
  type: MarkupShapeType;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  /** Cube: W/D/H · Cylinder/Cone: diameter, height, (unused) · Sphere: radius · Torus: major, tube · Capsule: radius, length · Pyramid: base, height */
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  color: string;
  label: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MarkupNote = {
  id: string;
  modelKey: string;
  posX: number;
  posY: number;
  posZ: number;
  text: string;
  author: string | null;
  createdAt: number;
  updatedAt: number;
};

export const DEFAULT_MARKUP_COLOR = "#F59E0B";

/** Default dimensions in meters — typical BIM markup scale. */
export const DEFAULT_SHAPE_SIZES: Record<
  MarkupShapeType,
  { sizeX: number; sizeY: number; sizeZ: number }
> = {
  cube: { sizeX: 0.5, sizeY: 0.5, sizeZ: 0.5 },
  sphere: { sizeX: 0.25, sizeY: 0.25, sizeZ: 0.25 },
  cylinder: { sizeX: 0.2, sizeY: 1.0, sizeZ: 0.2 },
  cone: { sizeX: 0.4, sizeY: 0.6, sizeZ: 0.4 },
  torus: { sizeX: 0.35, sizeY: 0.08, sizeZ: 0.35 },
  capsule: { sizeX: 0.12, sizeY: 0.7, sizeZ: 0.12 },
  pyramid: { sizeX: 0.5, sizeY: 0.5, sizeZ: 0.5 },
};

/** Color palette like common 3D DCC tools. */
export const MARKUP_COLOR_PALETTE: string[] = [
  "#F59E0B", // amber
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#78716C", // stone
  "#FFFFFF", // white
  "#1C1917", // near-black
];

export const MARKUP_SHAPE_TOOLS: MarkupShapeType[] = [
  "cube",
  "sphere",
  "cylinder",
  "cone",
  "torus",
  "capsule",
  "pyramid",
];

export function newMarkupId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createShapeGeometry(
  type: MarkupShapeType,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): THREE.BufferGeometry {
  switch (type) {
    case "cube":
      return new THREE.BoxGeometry(
        Math.max(0.01, sizeX),
        Math.max(0.01, sizeY),
        Math.max(0.01, sizeZ),
      );
    case "sphere": {
      const r = Math.max(0.01, sizeX);
      return new THREE.SphereGeometry(r, 24, 16);
    }
    case "cylinder": {
      const r = Math.max(0.01, sizeX / 2);
      return new THREE.CylinderGeometry(r, r, Math.max(0.01, sizeY), 24);
    }
    case "cone": {
      const r = Math.max(0.01, sizeX / 2);
      return new THREE.ConeGeometry(r, Math.max(0.01, sizeY), 24);
    }
    case "torus": {
      const major = Math.max(0.02, sizeX);
      const tube = Math.max(0.005, sizeY);
      return new THREE.TorusGeometry(major, tube, 12, 36);
    }
    case "capsule": {
      const r = Math.max(0.01, sizeX);
      const length = Math.max(0.01, sizeY);
      return new THREE.CapsuleGeometry(r, length, 6, 12);
    }
    case "pyramid": {
      const base = Math.max(0.01, sizeX) / 2;
      return new THREE.ConeGeometry(base, Math.max(0.01, sizeY), 4);
    }
    default:
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
  }
}

export function createPlacementMesh(
  placement: MarkupPlacement,
): THREE.Mesh {
  const geom = createShapeGeometry(
    placement.type,
    placement.sizeX,
    placement.sizeY,
    placement.sizeZ,
  );
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(placement.color),
    roughness: 0.45,
    metalness: 0.08,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(placement.posX, placement.posY, placement.posZ);
  mesh.rotation.set(placement.rotX, placement.rotY, placement.rotZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isMarkupPlacement = true;
  mesh.userData.markupId = placement.id;
  mesh.userData.markupType = placement.type;
  return mesh;
}

export function rebuildPlacementMesh(
  mesh: THREE.Mesh,
  placement: MarkupPlacement,
): void {
  const old = mesh.geometry;
  mesh.geometry = createShapeGeometry(
    placement.type,
    placement.sizeX,
    placement.sizeY,
    placement.sizeZ,
  );
  old.dispose();
  mesh.position.set(placement.posX, placement.posY, placement.posZ);
  mesh.rotation.set(placement.rotX, placement.rotY, placement.rotZ);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.color.set(placement.color);
  mat.needsUpdate = true;
}

/** Size field labels per shape — for the properties panel. */
export function sizeFieldsFor(
  type: MarkupShapeType,
): { key: "sizeX" | "sizeY" | "sizeZ"; label: string; min: number; max: number; step: number }[] {
  switch (type) {
    case "cube":
      return [
        { key: "sizeX", label: "W", min: 0.05, max: 5, step: 0.05 },
        { key: "sizeY", label: "H", min: 0.05, max: 5, step: 0.05 },
        { key: "sizeZ", label: "D", min: 0.05, max: 5, step: 0.05 },
      ];
    case "sphere":
      return [{ key: "sizeX", label: "R", min: 0.05, max: 3, step: 0.05 }];
    case "cylinder":
    case "cone":
      return [
        { key: "sizeX", label: "Ø", min: 0.05, max: 3, step: 0.05 },
        { key: "sizeY", label: "H", min: 0.05, max: 5, step: 0.05 },
      ];
    case "torus":
      return [
        { key: "sizeX", label: "R", min: 0.05, max: 3, step: 0.05 },
        { key: "sizeY", label: "Tube", min: 0.01, max: 1, step: 0.01 },
      ];
    case "capsule":
      return [
        { key: "sizeX", label: "R", min: 0.05, max: 2, step: 0.05 },
        { key: "sizeY", label: "L", min: 0.05, max: 5, step: 0.05 },
      ];
    case "pyramid":
      return [
        { key: "sizeX", label: "Base", min: 0.05, max: 5, step: 0.05 },
        { key: "sizeY", label: "H", min: 0.05, max: 5, step: 0.05 },
      ];
  }
}
