import * as THREE from "three";
import type { Floor, Room } from "./types";
import {
  DEFAULT_LUFTUNG_RANGE,
  heizlastToColor,
  kuhllastToColor,
  luftungToColor,
  resolveColorPalette,
  temperatureToColor,
} from "./colorMapping";
import { roomTemperatureForView } from "./roomLoad";
import { roomVentilationColorValue } from "./ventilation";
import { THEME_COLORS } from "./themeColors";
import { useAppStore } from "@/store/useAppStore";

type CacheKey = string;

const snapshotCache = new Map<CacheKey, string>();

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getRenderer(width: number, height: number): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
      stencil: true,
    });
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.localClippingEnabled = true;
  }
  sharedRenderer.setSize(width, height, false);
  sharedRenderer.setPixelRatio(1);
  sharedRenderer.setClearColor(0x000000, 0);
  return sharedRenderer;
}

/**
 * Simple 2D plan of the selected floor:
 * - Isolates that floor's shell + room geometries
 * - Cuts at mid-height so the plan reads as a clean floor plate
 * - Flat uncolored MeshBasic materials (layout-style)
 */
export function renderFloorSnapshot(
  shellGroup: THREE.Group | null,
  floor: Floor,
  floors: Floor[],
  modelKey: string,
  rooms: Room[] = [],
  size = 640,
  selectedRoomId: string | null = null,
): string | null {
  const {
    activeColorPalette,
    heizlastRange,
    kuhllastRange,
    luftungRange,
    dataViewMode,
    colorMode,
    compareBothModes,
    temperatureRange,
    coolingTemperatureRange,
    colorTheme,
    customLegendColors,
  } = useAppStore.getState();
  const palette = resolveColorPalette(colorTheme, activeColorPalette);
  const activeTempRange =
    dataViewMode === "kuhllast" ? coolingTemperatureRange : temperatureRange;

  const snapshotColorMode = compareBothModes ? "heizlast" : colorMode;

  const roomPlanColor = (room: Room): string => {
    if (dataViewMode === "luftung") {
      return luftungToColor(
        roomVentilationColorValue(room),
        palette,
        luftungRange,
        customLegendColors.luftung,
      );
    }
    if (snapshotColorMode === "temperature") {
      return temperatureToColor(
        roomTemperatureForView(room, dataViewMode),
        palette,
        activeTempRange,
        customLegendColors.temperature,
      );
    }
    if (dataViewMode === "kuhllast") {
      return kuhllastToColor(
        room.coolLoad,
        palette,
        kuhllastRange,
        customLegendColors.kuhllast,
      );
    }
    return heizlastToColor(
      room.heatLoad,
      palette,
      heizlastRange,
      customLegendColors.heizlast,
    );
  };

  const range =
    snapshotColorMode === "temperature"
      ? activeTempRange
      : dataViewMode === "kuhllast"
        ? kuhllastRange
        : dataViewMode === "luftung"
          ? luftungRange
          : heizlastRange;
  const customKey = JSON.stringify(customLegendColors);
  const cacheKey = `${modelKey}::${floor.id}::${size}::selected=${
    selectedRoomId ?? "none"
  }::view=${dataViewMode}::color=${snapshotColorMode}::theme=${colorTheme}::palette=${palette}::range=${range
    .map((v) => (Number.isFinite(v) ? v.toFixed(4) : "x"))
    .join(",")}::custom=${customKey}::v9`;
  const cached = snapshotCache.get(cacheKey);
  if (cached) return cached;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME_COLORS[colorTheme].sceneBackground);

  const planGroup = new THREE.Group();
  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x6b7280,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });
  const roomMats: THREE.Material[] = [];
  const roomMatFor = (room: Room) => {
    const mat = new THREE.MeshBasicMaterial({
      color: roomPlanColor(room),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: room.id === selectedRoomId ? 0.9 : 0.55,
      depthWrite: false,
    });
    roomMats.push(mat);
    return mat;
  };

  const box = new THREE.Box3();
  let hasGeom = false;

  const addMesh = (
    geometry: THREE.BufferGeometry,
    matrixWorld: THREE.Matrix4 | null,
    mat: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(geometry, mat);
    if (matrixWorld) mesh.applyMatrix4(matrixWorld);
    planGroup.add(mesh);
    const meshBox = new THREE.Box3().setFromObject(mesh);
    if (!meshBox.isEmpty()) {
      box.union(meshBox);
      hasGeom = true;
    }
  };

  // 1) Shell pieces tagged to this floor
  if (shellGroup) {
    shellGroup.updateMatrixWorld(true);
    shellGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData.floorId !== floor.id) return;
      if (!obj.geometry) return;
      addMesh(obj.geometry, obj.matrixWorld, wallMat);
    });
  }

  // 2) Room overlays for this floor (covers room-only IFCs with no shell)
  for (const room of rooms) {
    if (room.floorId !== floor.id) continue;
    if (!room.geometry || room.geometry.attributes.position == null) continue;
    addMesh(
      room.geometry,
      null,
      roomMatFor(room),
    );
  }

  // 3) Elevation-band fallback if nothing tagged
  if (!hasGeom && shellGroup) {
    const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
    const idx = sorted.findIndex((f) => f.id === floor.id);
    let minY = floor.elevation;
    let maxY =
      idx >= 0 && sorted[idx + 1]
        ? sorted[idx + 1].elevation
        : floor.elevation + 4.5;
    if (Math.abs(minY) > 100 || Math.abs(maxY) > 100) {
      minY /= 1000;
      maxY /= 1000;
    }
    shellGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData.floorId) return; // already considered tagged
      const meshBox = new THREE.Box3().setFromObject(obj);
      if (meshBox.isEmpty()) return;
      const cy = (meshBox.min.y + meshBox.max.y) / 2;
      if (cy < minY - 0.5 || cy >= maxY) return;
      addMesh(obj.geometry, obj.matrixWorld, wallMat);
    });
  }

  if (!hasGeom) {
    wallMat.dispose();
    for (const mat of roomMats) mat.dispose();
    return null;
  }

  // Mid-height horizontal clip for a clean plan cut
  const size3 = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const midY = box.min.y + Math.max(size3.y, 0.1) * 0.5;
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), midY);
  wallMat.clippingPlanes = [clipPlane];
  for (const mat of roomMats) {
    mat.clippingPlanes = [clipPlane];
  }

  scene.add(planGroup);

  // Frame to model footprint (X×Z) with a small margin — not a forced square.
  const pad = 1.04;
  const worldW = Math.max(size3.x, 0.1) * pad;
  const worldD = Math.max(size3.z, 0.1) * pad;
  const camera = new THREE.OrthographicCamera(
    -worldW / 2,
    worldW / 2,
    worldD / 2,
    -worldD / 2,
    0.1,
    5000,
  );
  camera.position.set(center.x, midY + Math.max(size3.y, 2) + 40, center.z);
  camera.up.set(0, 0, -1);
  camera.lookAt(center.x, midY, center.z);
  camera.updateProjectionMatrix();

  const maxPx = size;
  let outW: number;
  let outH: number;
  if (worldW >= worldD) {
    outW = maxPx;
    outH = Math.max(64, Math.round(maxPx * (worldD / worldW)));
  } else {
    outH = maxPx;
    outW = Math.max(64, Math.round(maxPx * (worldW / worldD)));
  }

  const renderer = getRenderer(outW, outH);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  wallMat.dispose();
  for (const mat of roomMats) mat.dispose();
  // Dispose only cloned scene meshes' refs — geometries are shared, don't dispose
  while (planGroup.children.length) {
    planGroup.remove(planGroup.children[0]);
  }

  snapshotCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export function clearFloorSnapshots(modelKey?: string): void {
  if (!modelKey) {
    snapshotCache.clear();
    return;
  }
  for (const key of snapshotCache.keys()) {
    if (key.startsWith(`${modelKey}::`)) snapshotCache.delete(key);
  }
}
