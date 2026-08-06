"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { MOUSE } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { heizlastToColor, kuhllastToColor, luftungToColor, temperatureToColor } from "@/lib/colorMapping";
import { roomTemperatureForView } from "@/lib/roomLoad";
import { flyTo, frameBoundingBox } from "@/lib/flyTo";
import { animateProgress, gsapEase } from "@/lib/gsapMotion";
import gsap from "gsap";
import { getElementDetails } from "@/lib/ifcClient";
import { debugLog } from "@/lib/debugLog";
import { runSceneWork } from "@/lib/sceneWork";
import { canHover } from "@/lib/canHover";
import { effectiveSelectedRoomId, isRoomPickAllowed } from "@/lib/pickAllowed";
import { isCompactMobileViewport } from "@/lib/layoutTokens";
import type { CustomLegendColors } from "@/lib/colorMapping";
import { DEFAULT_SCENE_BG, findScenePreset, parseGradientLerp, resolveSceneBackground, updateSkyGradientTexture } from "@/lib/sceneSky";
import type { DataViewMode } from "@/lib/dataViewMode";
import { ViewCube, VIEW_CUBE_LAYOUT } from "@/lib/viewCube";
import {
  ClipSliceController,
  floorWorldYBounds,
} from "@/lib/clipSlice";
import {
  floorGridSlots,
  PRESENTATION_GAP_X,
  PRESENTATION_GAP_Y,
  PRESENTATION_GAP_Y_STACK,
  PRESENTATION_GAP_Y_STACK_FEW,
  resolvePresentationLayout,
  sortFloorsByElevation,
} from "@/lib/presentationLayout";
import { roomPassesFilter } from "@/lib/roomFilter";
import {
  roomInVentilationZone,
  roomVentilationColorValue,
  roomVentilationZoneKey,
} from "@/lib/ventilation";
import {
  buildVentilationMarkers,
  disposeVentilationMarkers,
  syncVentilationMarkerPresentationOffsets,
  syncVentilationMarkerVisibility,
  syncVentilationMarkerZone,
  type VentilationMarkerLayer,
} from "@/lib/ventilationMarkers";
import { buildElementEdges } from "@/lib/ifcEdges";
import {
  applyIfcSurface,
  classifyIfcSurface,
  createIfcMaterial,
  readIfcSurface,
  type IfcSurface,
} from "@/lib/ifcMaterials";
import type { RenderMode, Room } from "@/lib/types";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import { useModelScene } from "./ModelSceneContext";

export type Viewer3DHandle = {
  getCameraPose: () => {
    position: [number, number, number];
    target: [number, number, number];
  };
  flyToPose: (
    position: [number, number, number],
    target: [number, number, number],
    duration?: number,
  ) => Promise<void>;
  fitVisible: () => void;
  /** Search-only: fly camera to frame a room mesh (does zoom). */
  flyToRoom: (roomId: string) => Promise<void>;
  /** Capture PNG; scale>1 renders at higher resolution for PDF. */
  captureViewport: (opts?: { scale?: number }) => string | null;
};

type Props = {
  onPointerMove?: (x: number, y: number) => void;
  onPointerLeave?: () => void;
  className?: string;
};

function roomColorHex(
  room: Room,
  mode: "heizlast" | "temperature",
  palette?: string,
  heizlastRange?: number[],
  temperatureRange?: number[],
  dataViewMode: DataViewMode = "heizlast",
  kuhllastRange?: number[],
  customLegendColors?: CustomLegendColors,
  luftungRange?: number[],
): string {
  if (mode === "temperature") {
    return temperatureToColor(
      roomTemperatureForView(room, dataViewMode),
      palette,
      temperatureRange,
      customLegendColors?.temperature,
    );
  }
  if (dataViewMode === "luftung") {
    return luftungToColor(
      roomVentilationColorValue(room),
      palette,
      luftungRange,
      customLegendColors?.luftung,
    );
  }
  if (dataViewMode === "kuhllast") {
    return kuhllastToColor(
      room.coolLoad,
      palette,
      kuhllastRange,
      customLegendColors?.kuhllast,
    );
  }
  return heizlastToColor(
    room.heatLoad,
    palette,
    heizlastRange,
    customLegendColors?.heizlast,
  );
}

/** Per-color material templates — always return a CLONE so rooms never share GPU state. */
function createOverlayMaterialCache() {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return {
    get(hex: string): THREE.MeshStandardMaterial {
      const key = hex.toLowerCase();
      let proto = cache.get(key);
      if (!proto) {
        proto = new THREE.MeshStandardMaterial({
          color: new THREE.Color(hex),
          transparent: true,
          opacity: 0.75,
          roughness: 1,
          metalness: 0,
          envMapIntensity: 0,
          // depthWrite true stops transparent painter-sort flicker while orbiting
          depthWrite: true,
          depthTest: true,
          side: THREE.FrontSide,
          flatShading: true,
        });
        proto.userData.baseColorHex = hex;
        cache.set(key, proto);
      }
      const mat = proto.clone();
      mat.userData.baseColorHex = hex;
      return mat;
    },
    clear() {
      for (const mat of cache.values()) mat.dispose();
      cache.clear();
    },
  };
}

function isOverlayRoomMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return (
    obj instanceof THREE.Mesh &&
    obj.userData.kind === "room" &&
    !obj.userData.isClipStencil &&
    !obj.userData.isClipCap &&
    !obj.userData.isSelectionOutline &&
    obj.material instanceof THREE.MeshStandardMaterial
  );
}

function isShellMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return (
    obj instanceof THREE.Mesh &&
    obj.userData.kind !== "room" &&
    !obj.userData.isClipStencil &&
    !obj.userData.isClipCap &&
    !obj.userData.isSelectionOutline &&
    obj.material instanceof THREE.MeshStandardMaterial
  );
}

/** Walk object + parents for room / element pick ids. */
function pickIdsFromObject(obj: THREE.Object3D): {
  roomId?: string;
  expressId?: number;
  floorId?: string | null;
} {
  let roomId = obj.userData.roomId as string | undefined;
  let expressId = obj.userData.expressId as number | undefined;
  let floorId = (obj.userData.floorId as string | undefined) ?? undefined;
  let node: THREE.Object3D | null = obj.parent;
  while (node) {
    if (roomId == null && node.userData.roomId != null) {
      roomId = node.userData.roomId as string;
    }
    if (expressId == null && node.userData.expressId != null) {
      expressId = node.userData.expressId as number;
    }
    if (floorId == null && node.userData.floorId != null) {
      floorId = node.userData.floorId as string;
    }
    node = node.parent;
  }
  return { roomId, expressId, floorId: floorId ?? null };
}

function clearSelectionOutlines(root: THREE.Object3D | null | undefined) {
  if (!root) return;
  const toRemove: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.isSelectionOutline) toRemove.push(o);
  });
  for (const o of toRemove) {
    o.parent?.remove(o);
    if (o instanceof THREE.Mesh) {
      (o.material as THREE.Material).dispose();
    }
  }
}

/**
 * Back-face shell outline scaled around the geometry bbox center.
 * IFC room meshes keep world coords in the buffer (mesh.position ≈ 0), so a
 * plain scale expands from the origin and misaligns the highlight.
 */
function attachAlignedOutline(
  mesh: THREE.Mesh,
  color: THREE.ColorRepresentation,
  inflate = 1.07,
  opacity = 0.95,
  clearFirst = true,
) {
  if (clearFirst) clearSelectionOutlines(mesh);
  const geom = mesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox;
  if (!box || box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.BackSide,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    clippingPlanes: [],
    clipShadows: false,
  });
  const outline = new THREE.Mesh(geom, mat);
  outline.scale.setScalar(inflate);
  outline.position.copy(center).multiplyScalar(1 - inflate);
  outline.userData.isSelectionOutline = true;
  outline.renderOrder = (mesh.renderOrder ?? 0) + 20;
  mesh.add(outline);
}

/** Color-matched rim — shared by basic 3D and presentation selection. */
function attachColorOutline(mesh: THREE.Mesh, hex: string) {
  attachAlignedOutline(mesh, hex, 1.09, 0.92, true);
}

function applySurfaceOpacity(
  mat: THREE.MeshStandardMaterial,
  opacity: number,
  /** When translucent, whether to write depth (rooms usually yes, shell usually no). */
  depthWriteWhenTranslucent = false,
) {
  const opaque = opacity >= 0.995;
  mat.opacity = opaque ? 1 : Math.max(0, opacity);
  mat.transparent = !opaque;
  mat.depthWrite = opaque || depthWriteWhenTranslucent;
}

function applyRenderMode(
  mode: RenderMode,
  shell: THREE.Group | null,
  overlays: THREE.Group | null,
  showRoomOverlays: boolean,
  lighting?: {
    spaceTransparency: number;
    elementTransparency: number;
    color: number;
  },
) {
  const wire = mode === "wireframe";
  const light = mode === "light";
  const textureOnly = mode === "texture";
  const shellEmpty = !shell || shell.children.length === 0;
  const inTool = useAppStore.getState().toolMode;
  // Werkzeug matches BIMvision-style IFC viewing: hide analysis rooms, show
  // the shell in the file's own default colors with strong shaded meshes.
  const spaceOpacity = inTool
    ? 0
    : (lighting?.spaceTransparency ?? 0.8);
  const elementOpacity = inTool ? 1 : (lighting?.elementTransparency ?? 0.8);
  const colorAmt = inTool ? 1 : (lighting?.color ?? 1);

  if (overlays) {
    // Texture normally hides overlays; if shell was culled (room-only IFC), show gray volumes
    overlays.visible =
      !inTool &&
      ((showRoomOverlays && !textureOnly) || (textureOnly && shellEmpty));
    if (!inTool) {
    overlays.traverse((obj) => {
      // Skip stencil-cap helper meshes parented under rooms
      if (!isOverlayRoomMesh(obj)) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      const baseHex =
        (mat.userData.baseColorHex as string | undefined) ??
        `#${mat.color.getHexString()}`;
      mat.wireframe = wire;
      mat.envMapIntensity = 0;
      mat.metalness = 0;
      mat.depthTest = true;
      mat.flatShading = true;
      mat.side = THREE.FrontSide;

      if (textureOnly && shellEmpty) {
        mat.color.setHex(0xc5cad3);
        mat.emissive?.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.roughness = 1;
        applySurfaceOpacity(mat, 1, true);
      } else if (light) {
        const c = new THREE.Color(baseHex).lerp(new THREE.Color(0xd0d4dc), 1 - colorAmt);
        mat.color.copy(c);
        mat.roughness = 1;
        mat.emissive.copy(c);
        mat.emissiveIntensity = 0.35 * colorAmt;
        applySurfaceOpacity(mat, spaceOpacity, true);
      } else {
        const c = new THREE.Color(baseHex).lerp(new THREE.Color(0xb8bec8), 1 - colorAmt);
        mat.color.copy(c);
        mat.roughness = 1;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        applySurfaceOpacity(mat, spaceOpacity, true);
      }
      mat.needsUpdate = true;
    });
    }
  }

  if (shell) {
    shell.visible = true;
    shell.traverse((obj) => {
      if (!isShellMesh(obj)) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      const surface = readIfcSurface(mat);
      const baseHex =
        (obj.userData.colorHex as string | undefined) ??
        surface?.colorHex ??
        (mat.userData.baseColorHex as string | undefined) ??
        `#${mat.color.getHexString()}`;
      const rawOpacity =
        typeof obj.userData.ifcOpacity === "number"
          ? (obj.userData.ifcOpacity as number)
          : (surface?.opacity ?? 1);

      if (inTool) {
        // Solid colorful BIM mesh (BIMvision-like). Glass must stay readable —
        // too-low alpha + depthWrite makes windows disappear against the sky.
        const fill = new THREE.Color(baseHex);
        const surfaceClass = surface?.surfaceClass;
        const isGlass =
          surfaceClass === "glass" ||
          rawOpacity < 0.92;

        mat.wireframe = false;
        mat.flatShading = false;
        mat.depthTest = true;

        if (isGlass) {
          // Keep a visible glazing fill (never near-invisible).
          let glassColor = fill.clone();
          const lum =
            0.2126 * glassColor.r +
            0.7152 * glassColor.g +
            0.0722 * glassColor.b;
          if (lum > 0.82 || (fill.r + fill.g + fill.b) < 0.08) {
            // Clear / missing IFC glass color → cool visible tint.
            glassColor.setRGB(0.45, 0.72, 0.9);
          }
          const opacity = Math.max(
            0.48,
            Math.min(0.78, rawOpacity < 0.05 ? 0.55 : rawOpacity),
          );
          mat.color.copy(glassColor);
          mat.roughness = 0.06;
          mat.metalness = 0;
          mat.envMapIntensity = 1.5;
          mat.emissive.copy(glassColor).multiplyScalar(0.1);
          mat.emissiveIntensity = 1;
          mat.opacity = opacity;
          mat.transparent = true;
          // Transparent glass must not write depth or it punches holes / vanishes.
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
        } else {
          mat.color.copy(fill);
          mat.roughness = 0.45;
          mat.metalness = 0.06;
          mat.envMapIntensity = 0.9;
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          mat.opacity = 1;
          mat.transparent = false;
          mat.depthWrite = true;
          mat.side = THREE.FrontSide;
        }
        mat.needsUpdate = true;
        return;
      }

      if (light) {
        // Study look: flat, desaturated, no reflections.
        const c = new THREE.Color(baseHex).lerp(
          new THREE.Color(0xd0d4dc),
          1 - colorAmt,
        );
        mat.color.copy(c);
        mat.roughness = 1;
        mat.metalness = 0;
        mat.envMapIntensity = 0;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.side = THREE.FrontSide;
        applySurfaceOpacity(mat, elementOpacity, false);
        mat.wireframe = wire;
        mat.needsUpdate = true;
        return;
      }

      // Every other mode starts from the element's real IFC appearance —
      // glass stays glazed, metal specular, concrete matte.
      if (surface) {
        applyIfcSurface(mat, surface, elementOpacity);
      } else {
        mat.color.set(baseHex);
        mat.roughness = 0.8;
        mat.metalness = 0.04;
        mat.envMapIntensity = 0.35;
        mat.side = THREE.FrontSide;
        applySurfaceOpacity(mat, elementOpacity, false);
      }

      if (mode === "realistic") {
        mat.envMapIntensity = (surface?.envMapIntensity ?? 0.4) * 1.7;
        mat.roughness = Math.max(0.04, (surface?.roughness ?? 0.8) * 0.82);
      } else if (textureOnly) {
        // Texture = pure IFC colors, no analysis tint and no gloss boost.
        mat.envMapIntensity = (surface?.envMapIntensity ?? 0.4) * 0.75;
      }

      if (colorAmt < 1) {
        mat.color.lerp(new THREE.Color(0xb8bec8), 1 - colorAmt);
      }
      mat.wireframe = wire;
      mat.needsUpdate = true;
    });
  }
}

const Viewer3D = forwardRef<Viewer3DHandle, Props>(function Viewer3D(
  { onPointerMove, onPointerLeave, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const shellCloneRef = useRef<THREE.Group | null>(null);
  const overlaysRef = useRef<THREE.Group | null>(null);
  const compareRootRef = useRef<THREE.Group | null>(null);
  const helpersRef = useRef<THREE.Group | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const viewCubeRef = useRef<ViewCube | null>(null);
  const clipRef = useRef<ClipSliceController | null>(null);
  const roomMeshById = useRef<Map<string, THREE.Mesh>>(new Map());
  const roomMeshTwinById = useRef<Map<string, THREE.Mesh>>(new Map());
  const materialCacheRef = useRef(createOverlayMaterialCache());
  const twinMaterialCacheRef = useRef(createOverlayMaterialCache());
  const raycaster = useRef(new THREE.Raycaster());
  const pointerNdc = useRef(new THREE.Vector2());
  const presentationCamRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);
  const explodeTweenRef = useRef<gsap.core.Tween | null>(null);
  const compareTweenRef = useRef<gsap.core.Tween | null>(null);
  const wasPresentationRef = useRef(false);
  const skyTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const applySelectionHighlightRef = useRef<() => void>(() => {});
  const ventilationMarkersRef = useRef<VentilationMarkerLayer | null>(null);
  const lastTickRef = useRef(performance.now());

  const { shellGroup, rooms } = useModelScene();
  const colorMode = useAppStore((s) => s.colorMode);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const isLoadingModel = useAppStore((s) => s.isLoadingModel);
  const activeColorPalette = useEffectiveColorPalette();
  const colorTheme = useAppStore((s) => s.colorTheme);
  const customLegendColors = useAppStore((s) => s.customLegendColors);
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const luftungRange = useAppStore((s) => s.luftungRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const coolingTemperatureRange = useAppStore((s) => s.coolingTemperatureRange);
  const activeTemperatureRange =
    dataViewMode === "kuhllast" ? coolingTemperatureRange : temperatureRange;
  const renderMode = useAppStore((s) => s.renderMode);
  const lighting = useAppStore((s) => s.lighting);
  const sceneBackground = useAppStore((s) => s.sceneBackground);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const isPresentationView = useAppStore((s) => s.isPresentationView);
  const presentationLayoutMode = useAppStore((s) => s.presentationLayoutMode);
  const presentationIsolate = useAppStore((s) => s.presentationIsolate);
  const presentationFloorId = useAppStore((s) => s.presentationFloorId);
  const selectedVentilationZoneKey = useAppStore(
    (s) => s.selectedVentilationZoneKey,
  );
  const ventilationZoneFocusToken = useAppStore(
    (s) => s.ventilationZoneFocusToken,
  );
  const roomFocusToken = useAppStore((s) => s.roomFocusToken);
  const floorFocusToken = useAppStore((s) => s.floorFocusToken);
  const viewerContextMenuOpen = useAppStore((s) => s.viewerContextMenuOpen);
  const setSelectedVentilationZoneKey = useAppStore(
    (s) => s.setSelectedVentilationZoneKey,
  );
  const requestRoomFocus = useAppStore((s) => s.requestRoomFocus);
  const compareBothModes = useAppStore((s) => s.compareBothModes);
  const sliceProgress = useAppStore((s) => s.sliceProgress);
  const floors = useAppStore((s) => s.floors);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const activeFilter = useAppStore((s) => s.activeFilter);
  const selectedElement = useAppStore((s) => s.selectedElement);
  const setHoveredRoom = useAppStore((s) => s.setHoveredRoom);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const setSelectedElement = useAppStore((s) => s.setSelectedElement);
  const setLeftPanelOpen = useAppStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);
  const roomsFromStore = useAppStore((s) => s.rooms);
  const toolMode = useAppStore((s) => s.toolMode);
  const hiddenElementIds = useAppStore((s) => s.hiddenElementIds);
  const isolatedElementIds = useAppStore((s) => s.isolatedElementIds);
  const toolRevealToken = useAppStore((s) => s.toolRevealToken);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);

  const fitToVisible = (durationMs = 850) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const overlays = overlaysRef.current;
    const shell = shellCloneRef.current;
    if (!camera || !controls) return;

    // Ensure explode / compare offsets are in world matrices before measuring
    overlays?.updateWorldMatrix(true, true);
    shell?.updateWorldMatrix(true, true);
    compareRootRef.current?.updateWorldMatrix(true, true);

    const box = new THREE.Box3();
    let has = false;

    const consider = (obj: THREE.Object3D | null | undefined) => {
      if (!obj?.visible) return;
      const b = new THREE.Box3().setFromObject(obj);
      if (!b.isEmpty()) {
        box.union(b);
        has = true;
      }
    };

    if (overlays) consider(overlays);
    if (shell) consider(shell);
    if (compareRootRef.current) consider(compareRootRef.current);

    if (!has) return;
    const presentation = useAppStore.getState().isPresentationView;
    // Basic view: keep orbit rotation. Presentation: isometric framing that fits screen.
    if (presentation) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);

      const elev = (32 * Math.PI) / 180;
      const az = (38 * Math.PI) / 180;
      const dir = new THREE.Vector3(
        Math.cos(elev) * Math.sin(az),
        Math.sin(elev),
        Math.cos(elev) * Math.cos(az),
      ).normalize();

      const vFov = (camera.fov * Math.PI) / 180;
      // Side panels + header shrink the usable viewport — fit to a tighter aspect
      const usableAspect = Math.max(0.55, camera.aspect * 0.72);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * usableAspect);

      // Fit AABB height / width AND bounding sphere (tall stacks need all three)
      const pad = 1.55;
      const distH = (size.y * 0.5) / Math.tan(vFov / 2);
      const distW =
        (Math.max(size.x, size.z) * 0.5) / Math.tan(hFov / 2);
      const distSphere = Math.max(
        sphere.radius / Math.sin(vFov / 2),
        sphere.radius / Math.sin(hFov / 2),
      );
      const dist = Math.max(distH, distW, distSphere, 1) * pad;

      const isoPos = center.clone().add(dir.multiplyScalar(dist));
      void flyTo(camera, controls, isoPos, center, durationMs);
      return;
    }
    const keepDirection = camera.position.clone().sub(controls.target);
    const { position, target } = frameBoundingBox(box, camera, 1.35, {
      keepDirection,
    });
    void flyTo(camera, controls, position, target, durationMs);
  };

  useImperativeHandle(ref, () => ({
    getCameraPose: () => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) {
        return { position: [0, 0, 0], target: [0, 0, 0] };
      }
      return {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      };
    },
    flyToPose: async (position, target, duration = 800) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      await flyTo(
        camera,
        controls,
        new THREE.Vector3(...position),
        new THREE.Vector3(...target),
        duration,
      );
    },
    fitVisible: fitToVisible,
    flyToRoom: async (roomId: string) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const mesh = roomMeshById.current.get(roomId);
      if (!camera || !controls || !mesh) return;
      mesh.visible = true;
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return;
      const { position, target } = frameBoundingBox(box, camera, 1.55);
      await flyTo(camera, controls, position, target, 900);
    },
    captureViewport: (opts) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;
      const scale = Math.max(1, Math.min(4, opts?.scale ?? 1));
      const el = renderer.domElement;
      const prevW = el.width;
      const prevH = el.height;
      const cssW = el.clientWidth || prevW;
      const cssH = el.clientHeight || prevH;
      try {
        if (scale > 1) {
          renderer.setPixelRatio(1);
          renderer.setSize(cssW * scale, cssH * scale, false);
        }
        renderer.render(scene, camera);
        return el.toDataURL("image/png");
      } catch {
        return null;
      } finally {
        if (scale > 1) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setSize(cssW, cssH, false);
          renderer.render(scene, camera);
        }
      }
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const initialBg = resolveSceneBackground(
      useAppStore.getState().sceneBackground || DEFAULT_SCENE_BG,
    );
    scene.background = initialBg;
    if (initialBg instanceof THREE.CanvasTexture) {
      skyTextureRef.current = initialBg;
    }

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    camera.position.set(20, 20, 20);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      stencil: true,
      // Needed so PDF export can read pixels after render()
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "block h-full w-full touch-none";

    const viewCube = new ViewCube();
    viewCubeRef.current = viewCube;

    const clip = new ClipSliceController();
    clip.attach(scene);
    clipRef.current = clip;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    ambientRef.current = ambient;

    const sun = new THREE.DirectionalLight(0xfff5e8, 1.1);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 250;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0002;
    scene.add(sun);
    sunRef.current = sun;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI; // allow full orbit — avoids horizon clipping flicker
    // Right-click opens the context menu — do not pan on button 2.
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      // Right-drag pans; short right-click opens context menu (see ViewerContextMenu).
      RIGHT: MOUSE.PAN,
    };

    const overlays = new THREE.Group();
    overlays.name = "room-overlays";
    scene.add(overlays);

    const compareRoot = new THREE.Group();
    compareRoot.name = "compare-twin";
    compareRoot.visible = false;
    scene.add(compareRoot);

    const helpers = new THREE.Group();
    helpers.name = "empty-helpers";
    const grid = new THREE.GridHelper(50, 50, 0xa8adb8, 0xc8cdd6);
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of gridMats) {
      m.transparent = true;
      m.opacity = 0.55;
    }
    helpers.add(grid);
    helpers.add(new THREE.AxesHelper(4));
    scene.add(helpers);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    overlaysRef.current = overlays;
    compareRootRef.current = compareRoot;
    helpersRef.current = helpers;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      viewCube.updateViewport(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const tick = () => {
      controls.update();
      viewCube.syncFromCamera(camera, controls.target);
      const now = performance.now();
      lastTickRef.current = now;
      const sz = new THREE.Vector2();
      renderer.getSize(sz);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, sz.x, sz.y);
      renderer.render(scene, camera);
      viewCube.updateViewport(sz.x, sz.y);
      viewCube.render(renderer);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.environment?.dispose();
      materialCacheRef.current.clear();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      viewCube.dispose();
      clip.dispose();
      viewCubeRef.current = null;
      clipRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      overlaysRef.current = null;
      compareRootRef.current = null;
      helpersRef.current = null;
      sunRef.current = null;
      ambientRef.current = null;
    };
    // Remount when view-cube layout changes (HMR keeps the old instance otherwise).
  }, [VIEW_CUBE_LAYOUT.revision]);

  // Build shell + room overlays
  useEffect(() => {
    const scene = sceneRef.current;
    const overlays = overlaysRef.current;
    if (!scene || !overlays) return;

    materialCacheRef.current.clear();
    materialCacheRef.current = createOverlayMaterialCache();
    clipRef.current?.clear();

    if (shellCloneRef.current) {
      scene.remove(shellCloneRef.current);
      shellCloneRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      shellCloneRef.current = null;
    }

    while (overlays.children.length) {
      const child = overlays.children[0];
      overlays.remove(child);
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    }
    roomMeshById.current.clear();

    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    const hasModel = Boolean(shellGroup) || sourceRooms.length > 0;

    if (helpersRef.current) {
      helpersRef.current.visible = !hasModel;
    }

    if (shellGroup) {
      const clone = shellGroup.clone(true);
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const src = obj.material as THREE.MeshStandardMaterial;
          const baseHex =
            (obj.userData.colorHex as string | undefined) ??
            (src.userData.baseColorHex as string | undefined) ??
            `#${src.color.getHexString()}`;
          const rawOpacity =
            typeof obj.userData.ifcOpacity === "number"
              ? (obj.userData.ifcOpacity as number)
              : 1;
          // Object3D.clone() deep-copies userData, so the classified surface
          // survives; older models without one get classified on the fly.
          const surface =
            (obj.userData.ifcSurface as IfcSurface | undefined) ??
            classifyIfcSurface({
              colorHex: baseHex,
              opacity: rawOpacity,
              typeName: obj.userData.ifcTypeName as string | undefined,
              materialName: obj.userData.ifcMaterialName as string | undefined,
            });
          const mat = createIfcMaterial(surface);
          obj.userData.colorHex = baseHex;
          obj.userData.ifcOpacity = rawOpacity;
          obj.userData.ifcSurface = surface;
          obj.material = mat;
          obj.castShadow = surface.surfaceClass !== "glass";
          obj.receiveShadow = true;
        }
      });
      scene.add(clone);
      shellCloneRef.current = clone;
    }

    let logged = 0;
    for (const room of sourceRooms) {
      if (!room.geometry || room.geometry.attributes.position == null) continue;
      const hex = roomColorHex(
        room,
        colorMode,
        activeColorPalette,
        heizlastRange,
        activeTemperatureRange,
        dataViewMode,
        kuhllastRange,
        customLegendColors,
        luftungRange,
      );
      if (logged < 8) {
        debugLog(
          "Viewer3D",
          `color ${room.name}: ${hex} (H=${room.heatLoad}, C=${room.coolLoad}, T=${room.temperature})`,
          "info",
        );
        logged += 1;
      }
      const material = materialCacheRef.current.get(hex);
      const mesh = new THREE.Mesh(room.geometry, material);
      mesh.userData.roomId = room.id;
      mesh.userData.floorId = room.floorId;
      mesh.userData.expressId = room.expressId;
      mesh.userData.kind = "room";
      mesh.userData.colorHex = hex;
      mesh.renderOrder = 2;
      overlays.add(mesh);
      roomMeshById.current.set(room.id, mesh);
    }

    applyRenderMode(
      useAppStore.getState().renderMode,
      shellCloneRef.current,
      overlays,
      true,
      useAppStore.getState().lighting,
    );

    // Floor-scoped clip registration happens in the selectedFloor effect
    clipRef.current?.clear();

    if (hasModel) {
      requestAnimationFrame(() => fitToVisible());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellGroup, rooms, roomsFromStore]);

  const markerVisibleFloorId =
    isPresentationView && presentationIsolate && presentationFloorId
      ? presentationFloorId
      : !isPresentationView && selectedFloor
        ? selectedFloor
        : null;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    disposeVentilationMarkers(ventilationMarkersRef.current);
    ventilationMarkersRef.current = null;
    const existing = scene.getObjectByName("ventilation-markers");
    if (existing) scene.remove(existing);

    if (dataViewMode !== "luftung") return;

    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    const endWork = runSceneWork(() => {
      const layer = buildVentilationMarkers(sourceRooms);
      syncVentilationMarkerPresentationOffsets(layer, roomMeshById.current);
      syncVentilationMarkerVisibility(layer, markerVisibleFloorId);
      scene.add(layer.group);
      ventilationMarkersRef.current = layer;
    });

    return () => {
      endWork();
      disposeVentilationMarkers(ventilationMarkersRef.current);
      ventilationMarkersRef.current = null;
      const markers = scene.getObjectByName("ventilation-markers");
      if (markers) scene.remove(markers);
    };
  }, [dataViewMode, rooms, roomsFromStore, markerVisibleFloorId]);

  useEffect(() => {
    syncVentilationMarkerPresentationOffsets(
      ventilationMarkersRef.current,
      roomMeshById.current,
    );
    syncVentilationMarkerVisibility(
      ventilationMarkersRef.current,
      markerVisibleFloorId,
    );
    syncVentilationMarkerZone(
      ventilationMarkersRef.current,
      rooms.length ? rooms : roomsFromStore,
      selectedVentilationZoneKey,
      selectedRoomId,
      markerVisibleFloorId,
    );
  }, [
    markerVisibleFloorId,
    selectedVentilationZoneKey,
    selectedRoomId,
    rooms,
    roomsFromStore,
    isPresentationView,
    presentationLayoutMode,
    presentationIsolate,
  ]);

  useEffect(() => {
    if (dataViewMode !== "luftung" || !selectedVentilationZoneKey) return;
    if (!useAppStore.getState().autoFocusSelection) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    const zoneRooms = sourceRooms.filter((r) =>
      roomInVentilationZone(r, selectedVentilationZoneKey),
    );
    const box = new THREE.Box3();
    for (const room of zoneRooms) {
      const mesh = roomMeshById.current.get(room.id);
      if (mesh) box.expandByObject(mesh);
    }
    if (box.isEmpty()) return;
    const { position, target } = frameBoundingBox(box, camera, 1.32);
    void flyTo(camera, controls, position, target, 1150);
  }, [
    ventilationZoneFocusToken,
    selectedVentilationZoneKey,
    dataViewMode,
    rooms,
    roomsFromStore,
  ]);

  useEffect(() => {
    if (!roomFocusToken) return;
    if (!useAppStore.getState().autoFocusSelection) return;
    const roomId = useAppStore.getState().selectedRoomId;
    if (!roomId) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const mesh = roomMeshById.current.get(roomId);
    if (!camera || !controls || !mesh) return;
    mesh.visible = true;
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return;
    const { position, target } = frameBoundingBox(box, camera, 1.55);
    void flyTo(camera, controls, position, target, 900);
    // Only react to focus requests — not every selectedRoomId change.
  }, [roomFocusToken]);

  // Heizlast + Temperature compare: twin copy (temp colors) offset from primary (heizlast)
  useEffect(() => {
    const scene = sceneRef.current;
    const root = compareRootRef.current;
    const overlays = overlaysRef.current;
    if (!scene || !root) return;

    const clearTwin = () => {
      while (root.children.length) {
        const child = root.children[0];
        root.remove(child);
        child.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const mat = o.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
          }
        });
      }
      roomMeshTwinById.current.clear();
      twinMaterialCacheRef.current.clear();
      root.visible = false;
      root.position.set(0, 0, 0);
    };

    if (!compareBothModes) {
      compareTweenRef.current?.kill();
      const applyOffCompare = () => {
        clearTwin();
        const sourceRooms = rooms.length ? rooms : roomsFromStore;
        const byId = new Map(sourceRooms.map((r) => [r.id, r]));
        materialCacheRef.current.clear();
        materialCacheRef.current = createOverlayMaterialCache();
        for (const [id, mesh] of roomMeshById.current) {
          const room = byId.get(id);
          if (!room) continue;
          const hex = roomColorHex(
            room,
            colorMode,
            activeColorPalette,
            heizlastRange,
            activeTemperatureRange,
            dataViewMode,
            kuhllastRange,
            customLegendColors,
            luftungRange,
          );
          mesh.material = materialCacheRef.current.get(hex);
          mesh.userData.colorHex = hex;
        }
        applyRenderMode(
          renderMode,
          shellCloneRef.current,
          overlays,
          true,
          lighting,
        );
      };
      if (isPresentationView) {
        applyOffCompare();
        requestAnimationFrame(() => fitToVisible(1800));
        return () => {
          compareTweenRef.current?.kill();
        };
      }
      const endWork = runSceneWork(applyOffCompare);
      return endWork;
    }

    clearTwin();
    twinMaterialCacheRef.current = createOverlayMaterialCache();
    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    const byId = new Map(sourceRooms.map((r) => [r.id, r]));

    // Primary overlays → Heizlast
    materialCacheRef.current.clear();
    materialCacheRef.current = createOverlayMaterialCache();
    for (const [id, mesh] of roomMeshById.current) {
      const room = byId.get(id);
      if (!room) continue;
      const hex = roomColorHex(
        room,
        "heizlast",
        activeColorPalette,
        heizlastRange,
        activeTemperatureRange,
        dataViewMode,
        kuhllastRange,
        customLegendColors,
        luftungRange,
      );
      mesh.material = materialCacheRef.current.get(hex);
      mesh.userData.colorHex = hex;
    }
    applyRenderMode(
      renderMode,
      shellCloneRef.current,
      overlays,
      true,
      lighting,
    );

    // Twin overlays → Temperature (same geometry)
    const twinOverlays = new THREE.Group();
    twinOverlays.name = "compare-overlays-temp";
    for (const room of sourceRooms) {
      if (!room.geometry || room.geometry.attributes.position == null) continue;
      const hex = roomColorHex(
        room,
        "temperature",
        activeColorPalette,
        heizlastRange,
        activeTemperatureRange,
        dataViewMode,
        kuhllastRange,
        customLegendColors,
        luftungRange,
      );
      const material = twinMaterialCacheRef.current.get(hex);
      const mesh = new THREE.Mesh(room.geometry, material);
      mesh.userData.roomId = room.id;
      mesh.userData.floorId = room.floorId;
      mesh.userData.expressId = room.expressId;
      mesh.userData.kind = "room";
      mesh.userData.colorHex = hex;
      mesh.userData.compareTwin = true;
      mesh.renderOrder = 2;
      twinOverlays.add(mesh);
      roomMeshTwinById.current.set(room.id, mesh);
    }
    applyRenderMode(renderMode, null, twinOverlays, true, lighting);
    root.add(twinOverlays);

    // Twin shell (so each "object" reads as a full floor/building)
    if (shellCloneRef.current) {
      const shellTwin = shellCloneRef.current.clone(true);
      shellTwin.name = "compare-shell-temp";
      shellTwin.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const src = obj.material as THREE.MeshStandardMaterial;
          const mat = src.clone();
          obj.material = mat;
          obj.userData.compareTwin = true;
        }
      });
      root.add(shellTwin);
      applyRenderMode(renderMode, shellTwin, null, true, lighting);
    }

    root.visible = true;

    // Place twin: stacked below (floor view) or beside (presentation) — smooth slide
    compareTweenRef.current?.kill();
    const measure = new THREE.Box3();
    if (overlays) {
      overlays.updateWorldMatrix(true, true);
      measure.expandByObject(overlays);
    }
    if (shellCloneRef.current) {
      shellCloneRef.current.updateWorldMatrix(true, true);
      measure.expandByObject(shellCloneRef.current);
    }
    const size = measure.isEmpty()
      ? new THREE.Vector3(10, 4, 10)
      : measure.getSize(new THREE.Vector3());

    const endX = isPresentationView ? Math.max(size.x, size.z, 1) * 1.45 : 0;
    const endY = isPresentationView ? 0 : -(Math.max(size.y, 1) * 1.55);
    root.position.set(0, 0, 0);

    const slideMs = 1400;
    const fitMs = isPresentationView ? 2000 : 1600;
    root.position.set(0, 0, 0);

    const slide = { x: 0, y: 0 };
    compareTweenRef.current = gsap.to(slide, {
      x: endX,
      y: endY,
      duration: slideMs / 1000,
      ease: gsapEase.ios,
      onUpdate: () => {
        root.position.set(slide.x, slide.y, 0);
      },
      onComplete: () => {
        root.position.set(endX, endY, 0);
        fitToVisible(fitMs);
      },
    });

    return () => {
      compareTweenRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compareBothModes,
    isPresentationView,
    shellGroup,
    rooms,
    roomsFromStore,
    activeColorPalette,
    dataViewMode,
    heizlastRange,
    kuhllastRange,
    activeTemperatureRange,
    renderMode,
    lighting,
    colorMode,
  ]);

  // Rebuild overlay materials when colorMode changes (skipped logic when compare owns colors)
  useEffect(() => {
    if (compareBothModes) return;
    return runSceneWork(() => {
      const sourceRooms = rooms.length ? rooms : roomsFromStore;
      const byId = new Map(sourceRooms.map((r) => [r.id, r]));
      materialCacheRef.current.clear();
      materialCacheRef.current = createOverlayMaterialCache();

      for (const [id, mesh] of roomMeshById.current) {
        const room = byId.get(id);
        if (!room) continue;
        const hex = roomColorHex(
          room,
          colorMode,
          activeColorPalette,
          heizlastRange,
          activeTemperatureRange,
          dataViewMode,
          kuhllastRange,
          customLegendColors,
          luftungRange,
        );
        const prev = mesh.material;
        mesh.material = materialCacheRef.current.get(hex);
        mesh.userData.colorHex = hex;
        if (prev && prev !== mesh.material) {
          if (Array.isArray(prev)) prev.forEach((m) => m.dispose());
          else prev.dispose();
        }
      }
      applyRenderMode(
        renderMode,
        shellCloneRef.current,
        overlaysRef.current,
        true,
        lighting,
      );
      clipRef.current?.rebindMaterials();
      clipRef.current?.rebuildCaps();
      applySelectionHighlightRef.current();
    });
  }, [colorMode, dataViewMode, activeColorPalette, colorTheme, customLegendColors, heizlastRange, kuhllastRange, luftungRange, activeTemperatureRange, rooms, roomsFromStore, renderMode, lighting, compareBothModes]);

  // Render mode + lighting
  useEffect(() => {
    applyRenderMode(
      renderMode,
      shellCloneRef.current,
      overlaysRef.current,
      true,
      lighting,
    );
    clipRef.current?.rebindMaterials();
    // Rebuild so Schnitthöhe caps pick up new space/element opacity
    clipRef.current?.rebuildCaps();
    applySelectionHighlightRef.current();

    const sun = sunRef.current;
    const ambient = ambientRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (toolMode) {
      // Strong studio lighting so IFC default colors pop (BIMvision-like).
      if (sun) {
        sun.intensity = 1.45;
        sun.castShadow = true;
      }
      if (ambient) {
        ambient.intensity = 0.95;
      }
      if (renderer) {
        renderer.toneMappingExposure = 1.25;
        renderer.shadowMap.enabled = true;
      }
    } else {
      if (sun) {
        sun.intensity = 0.2 + lighting.shadow * 1.6;
        sun.castShadow = lighting.shadow > 0.05;
      }
      if (ambient) {
        ambient.intensity = 0.15 + lighting.indirectLight * 0.7;
      }
      if (renderer) {
        renderer.toneMappingExposure = 0.75 + lighting.indirectLight * 0.7;
        renderer.shadowMap.enabled = lighting.shadow > 0.05;
      }
    }
    if (scene) {
      // Indirect scales each material's own reflectivity — a flat value here
      // would erase the difference between glass, metal and concrete.
      // Werkzeug sets envMapIntensity in applyRenderMode itself.
      if (!toolMode) {
        shellCloneRef.current?.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          if (renderMode === "light") return;
          const mat = obj.material as THREE.MeshStandardMaterial;
          const surface = readIfcSurface(mat);
          const base = surface?.envMapIntensity ?? 0.4;
          const modeBoost = renderMode === "realistic" ? 1.7 : 1;
          mat.envMapIntensity =
            base * modeBoost * (0.55 + lighting.indirectLight * 0.95);
          mat.needsUpdate = true;
        });
      }
    }
  }, [renderMode, lighting, toolMode]);

  // 3D viewport background — solid or sky gradient
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existingTex = skyTextureRef.current;

    const lerpGrad = parseGradientLerp(sceneBackground);
    if (lerpGrad) {
      if (existingTex) {
        updateSkyGradientTexture(existingTex, lerpGrad.top, lerpGrad.bottom);
        scene.background = existingTex;
        return;
      }
      const tex = resolveSceneBackground(sceneBackground);
      if (tex instanceof THREE.CanvasTexture) {
        skyTextureRef.current = tex;
        scene.background = tex;
      }
      return;
    }

    const bg = resolveSceneBackground(sceneBackground);
    if (bg instanceof THREE.CanvasTexture) {
      const preset = findScenePreset(sceneBackground);
      if (existingTex && preset?.gradient) {
        updateSkyGradientTexture(
          existingTex,
          preset.gradient.top,
          preset.gradient.bottom,
        );
        scene.background = existingTex;
        return;
      }
      existingTex?.dispose();
      skyTextureRef.current = bg;
      scene.background = bg;
      return;
    }

    existingTex?.dispose();
    skyTextureRef.current = null;
    scene.background = bg;
  }, [sceneBackground]);

  // Single slice path (basic view only) — skipped in Presentation / compare
  useEffect(() => {
    return runSceneWork(() => {
      const clip = clipRef.current;

      if (isPresentationView || compareBothModes) {
        if (compareBothModes && clip) {
          clip.clear();
          clip.setEnabled(false);
          clip.setCapsEnabled(false);
        }
        if (compareBothModes && !isPresentationView) {
          const applyFloorVisibility = (obj: THREE.Object3D) => {
            const floorId = obj.userData.floorId as string | undefined;
            if (!floorId) {
              obj.visible = true;
              return;
            }
            obj.visible = selectedFloor == null || floorId === selectedFloor;
          };
          shellCloneRef.current?.traverse((obj) => {
            if (obj instanceof THREE.Mesh) applyFloorVisibility(obj);
          });
          overlaysRef.current?.children.forEach((child) =>
            applyFloorVisibility(child),
          );
          compareRootRef.current?.traverse((obj) => {
            if (obj instanceof THREE.Mesh) applyFloorVisibility(obj);
          });
        }
        return;
      }

      const applyFloorVisibility = (obj: THREE.Object3D) => {
        const floorId = obj.userData.floorId as string | undefined;
        if (!floorId) {
          obj.visible = true;
          return;
        }
        obj.visible = selectedFloor == null || floorId === selectedFloor;
      };

      shellCloneRef.current?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) applyFloorVisibility(obj);
      });
      overlaysRef.current?.children.forEach((child) =>
        applyFloorVisibility(child),
      );
      compareRootRef.current?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) applyFloorVisibility(obj);
      });

      if (!clip) return;

      clip.setOrientation("horizontal");

      if (!selectedFloor) {
        clip.clear();
        clip.setEnabled(false);
        clip.setCapsEnabled(false);
        return;
      }

      const floorMeshes: THREE.Mesh[] = [];
      shellCloneRef.current?.traverse((o) => {
        if (isShellMesh(o) && o.userData.floorId === selectedFloor) {
          floorMeshes.push(o);
        }
      });
      overlaysRef.current?.traverse((o) => {
        if (isOverlayRoomMesh(o) && o.userData.floorId === selectedFloor) {
          floorMeshes.push(o);
        }
      });

      for (const m of floorMeshes) m.visible = true;

      const bounds = floorWorldYBounds(selectedFloor, [
        shellCloneRef.current,
        overlaysRef.current,
      ]);
      const t = useAppStore.getState().sliceProgress;
      const heightY = bounds
        ? bounds.yMin + t * Math.max(0.05, bounds.yMax - bounds.yMin)
        : 0;

      clip.setHeight(heightY);
      clip.setMeshes(floorMeshes);
      clip.setEnabled(true);
      clip.setCapsEnabled(true);
      clip.rebuildCaps();
      clip.setHeight(heightY);
      applySelectionHighlightRef.current();

      debugLog(
        "Viewer3D",
        `rebuildSliceCaps floor=${selectedFloor} n=${floorMeshes.length} y=${heightY.toFixed(2)}`,
        floorMeshes.length ? "ok" : "warn",
      );
    });
    // Keep camera pose when switching floors — user can Fit model manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFloor,
    colorMode,
    activeColorPalette,
    dataViewMode,
    heizlastRange,
    kuhllastRange,
    activeTemperatureRange,
    floors,
    shellGroup,
    rooms,
    roomsFromStore,
    isPresentationView,
    compareBothModes,
  ]);

  // Werkzeug: per-element visibility from the IFC structure tree. Declared after
  // the floor/slice effect so it always has the last word on mesh.visible.
  const wasToolModeRef = useRef(false);
  useEffect(() => {
    const shell = shellCloneRef.current;
    const overlays = overlaysRef.current;
    if (!shell && !overlays) return;

    const skip = (obj: THREE.Object3D) =>
      !(obj instanceof THREE.Mesh) ||
      obj.userData.isClipStencil ||
      obj.userData.isClipCap ||
      obj.userData.isSelectionOutline;

    // Leaving Werkzeug: un-hide everything so the floor/presentation effects own
    // visibility again (tool mode always leaves selectedFloor cleared).
    if (!toolMode) {
      if (!wasToolModeRef.current) return;
      wasToolModeRef.current = false;
      const restore = (obj: THREE.Object3D) => {
        if (!skip(obj)) obj.visible = true;
      };
      shell?.traverse(restore);
      overlays?.traverse(restore);
      return;
    }
    wasToolModeRef.current = true;

    const apply = (obj: THREE.Object3D) => {
      if (skip(obj)) return;
      const expressId = obj.userData.expressId as number | undefined;
      if (expressId == null) return;
      const isolated = isolatedElementIds;
      obj.visible =
        !hiddenElementIds.has(expressId) &&
        (isolated == null || isolated.has(expressId));
    };

    if (overlays) overlays.visible = !toolMode;
    shell?.traverse(apply);
    if (!toolMode) overlays?.traverse(apply);
    else if (overlays) {
      // Keep room meshes out of the way entirely — web-ifc shows the shell only.
      overlays.traverse((obj) => {
        if (!skip(obj)) obj.visible = false;
      });
    }
  }, [
    toolMode,
    hiddenElementIds,
    isolatedElementIds,
    selectedFloor,
    renderMode,
    lighting,
    shellGroup,
    rooms,
    roomsFromStore,
  ]);

  // Werkzeug only: dense black mesh edges drawn on top so the whole model reads.
  useEffect(() => {
    if (!toolMode) return;
    const shell = shellCloneRef.current;
    if (!shell) return;
    const overlay = buildElementEdges(shell, {
      color: 0x000000,
      thresholdAngle: 12,
    });
    return () => overlay.dispose();
  }, [toolMode, shellGroup, rooms, roomsFromStore]);

  // Entering / leaving Werkzeug swaps the whole visible set — reframe it.
  useEffect(() => {
    const id = requestAnimationFrame(() => fitToVisible(700));
    return () => cancelAnimationFrame(id);
  }, [toolMode]);

  // Werkzeug: frame the element picked in the structure tree.
  useEffect(() => {
    if (!toolMode || toolRevealToken === 0 || toolSelectedExpressId == null) {
      return;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3();
    let found = false;
    const consider = (obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
      if (obj.userData.expressId !== toolSelectedExpressId) return;
      const b = new THREE.Box3().setFromObject(obj);
      if (b.isEmpty()) return;
      box.union(b);
      found = true;
    };
    shellCloneRef.current?.traverse(consider);
    overlaysRef.current?.traverse(consider);
    if (!found) return;

    const keepDirection = camera.position.clone().sub(controls.target);
    const pose = frameBoundingBox(box, camera, 2.2, { keepDirection });
    void flyTo(camera, controls, pose.position, pose.target, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolRevealToken]);

  // Basic 3D: zoom to visible (isolated) floor when floor selection changes.
  useEffect(() => {
    if (isPresentationView || floorFocusToken === 0) return;
    const id = requestAnimationFrame(() => fitToVisible(850));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorFocusToken, isPresentationView]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enabled = !viewerContextMenuOpen;
  }, [viewerContextMenuOpen]);

  // Instant plane/cap height while dragging — basic view only
  useEffect(() => {
    if (isPresentationView || compareBothModes) return;
    const clip = clipRef.current;
    if (!clip || !selectedFloor) return;
    const bounds = floorWorldYBounds(selectedFloor, [
      shellCloneRef.current,
      overlaysRef.current,
    ]);
    if (!bounds) return;
    const span = Math.max(0.05, bounds.yMax - bounds.yMin);
    clip.setHeight(bounds.yMin + sliceProgress * span);
  }, [selectedFloor, sliceProgress, floors, shellGroup, rooms, isPresentationView, compareBothModes]);

  // Presentation View: explode floors + vertical half-cut + iso camera
  useEffect(() => {
    const clip = clipRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!clip || !camera || !controls) return;

    explodeTweenRef.current?.kill();

    const collectFloorMeshes = () => {
      const map = new Map<string, THREE.Mesh[]>();
      const add = (o: THREE.Object3D) => {
        if (!(o instanceof THREE.Mesh)) return;
        if (o.userData.isClipStencil || o.userData.isSelectionOutline) return;
        if (o.userData.isClipCap) return;
        const fid = o.userData.floorId as string | undefined;
        if (!fid) return;
        if (!map.has(fid)) map.set(fid, []);
        map.get(fid)!.push(o);
      };
      shellCloneRef.current?.traverse(add);
      overlaysRef.current?.traverse(add);
      compareRootRef.current?.traverse(add);
      return map;
    };

    const applyExplode = (t: number) => {
      const byFloor = collectFloorMeshes();
      const sorted = sortFloorsByElevation(floors).filter(
        (f) => (byFloor.get(f.id)?.length ?? 0) > 0,
      );
      const layout = resolvePresentationLayout(
        sorted.length,
        useAppStore.getState().presentationLayoutMode,
      );
      const isolate = useAppStore.getState().presentationIsolate;
      const isolateId = useAppStore.getState().presentationFloorId;

      // Strip offsets, measure each floor bbox / center
      type FloorMeas = {
        id: string;
        center: THREE.Vector3;
        size: THREE.Vector3;
      };
      const measured: FloorMeas[] = [];
      let maxW = 0.01;
      let maxH = 0.01;

      for (const f of sorted) {
        const meshes = byFloor.get(f.id) ?? [];
        for (const mesh of meshes) {
          const offY = (mesh.userData.presentationOffsetY as number) ?? 0;
          const offX = (mesh.userData.presentationOffsetX as number) ?? 0;
          if (offY) mesh.position.y -= offY;
          if (offX) mesh.position.x -= offX;
        }
        const box = new THREE.Box3();
        for (const mesh of meshes) box.expandByObject(mesh);
        for (const mesh of meshes) {
          const offY = (mesh.userData.presentationOffsetY as number) ?? 0;
          const offX = (mesh.userData.presentationOffsetX as number) ?? 0;
          if (offY) mesh.position.y += offY;
          if (offX) mesh.position.x += offX;
        }
        if (box.isEmpty()) {
          measured.push({
            id: f.id,
            center: new THREE.Vector3(),
            size: new THREE.Vector3(1, 1, 1),
          });
          continue;
        }
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        maxW = Math.max(maxW, size.x, size.z);
        maxH = Math.max(maxH, size.y);
        measured.push({ id: f.id, center, size });
      }

      const gapY =
        sorted.length < 4
          ? PRESENTATION_GAP_Y_STACK_FEW
          : layout === "stack" || sorted.length < 5
            ? PRESENTATION_GAP_Y_STACK
            : PRESENTATION_GAP_Y;
      const slotW = maxW * (1 + PRESENTATION_GAP_X);
      // Equal center pitch — same generous spacing as last push.
      const slotH = maxH * (1 + gapY);
      const slots = layout === "grid" ? floorGridSlots(sorted.length) : null;
      const origin = measured[0]?.center.clone() ?? new THREE.Vector3();

      for (let i = 0; i < sorted.length; i++) {
        const m = measured[i];
        let targetX = 0;
        let targetY = 0;

        if (isolate && isolateId) {
          // Keep floors in place relative to origin when isolating
          targetX = 0;
          targetY = 0;
        } else if (layout === "stack") {
          const desiredY = origin.y + i * slotH;
          targetY = (desiredY - m.center.y) * t;
          targetX = 0;
        } else {
          const slot = slots![i];
          const rowPad = ((slot.maxCols - slot.colsInRow) * slotW) / 2;
          const desiredX = origin.x + slot.col * slotW + rowPad;
          const desiredY = origin.y + slot.row * slotH;
          targetX = (desiredX - m.center.x) * t;
          targetY = (desiredY - m.center.y) * t;
        }

        const meshes = byFloor.get(sorted[i].id) ?? [];
        for (const mesh of meshes) {
          const prevY = (mesh.userData.presentationOffsetY as number) ?? 0;
          const prevX = (mesh.userData.presentationOffsetX as number) ?? 0;
          mesh.position.y += targetY - prevY;
          mesh.position.x += targetX - prevX;
          mesh.userData.presentationOffsetY = targetY;
          mesh.userData.presentationOffsetX = targetX;
        }
      }
      syncVentilationMarkerPresentationOffsets(
        ventilationMarkersRef.current,
        roomMeshById.current,
      );
      return slotH;
    };

    const collectAllMeshes = () => {
      const all: THREE.Mesh[] = [];
      collectFloorMeshes().forEach((arr) => all.push(...arr));
      return all;
    };

    const applyIsolateVisibility = () => {
      const isolate = useAppStore.getState().presentationIsolate;
      const isolateId = useAppStore.getState().presentationFloorId;
      const setVis = (obj: THREE.Object3D) => {
        if (!(obj instanceof THREE.Mesh) || !obj.userData.floorId) return;
        if (!isolate || !isolateId) {
          obj.visible = true;
        } else {
          obj.visible = obj.userData.floorId === isolateId;
        }
      };
      shellCloneRef.current?.traverse(setVis);
      overlaysRef.current?.children.forEach(setVis);
      compareRootRef.current?.traverse(setVis);
    };

    const flyIso = (durationMs = 2000) => {
      fitToVisible(durationMs);
    };

    let refreshTimer: number | null = null;

    if (isPresentationView) {
      const entering = !wasPresentationRef.current;
      wasPresentationRef.current = true;

      if (entering) {
        presentationCamRef.current = {
          position: camera.position.toArray() as [number, number, number],
          target: controls.target.toArray() as [number, number, number],
        };
      }

      clip.setOrientation("horizontal");
      clip.clear();
      clip.setEnabled(false);
      clip.setCapsEnabled(false);

      applyIsolateVisibility();

      if (!entering) {
        const gap = applyExplode(1);
        applyIsolateVisibility();
        const comparing = useAppStore.getState().compareBothModes;
        const delay = comparing ? 1600 : 50;
        refreshTimer = window.setTimeout(() => {
          applyExplode(1);
          applyIsolateVisibility();
          flyIso(1800);
        }, delay);
        debugLog(
          "Viewer3D",
          `presentation refresh n=${collectAllMeshes().length} gap=${gap.toFixed(2)} layout=${presentationLayoutMode}`,
          "ok",
        );
      } else {
        let lastGap = 0;
        let flew = false;
        explodeTweenRef.current = animateProgress({
          duration: 1.6,
          ease: gsapEase.explode,
          onUpdate: (e) => {
            lastGap = applyExplode(e);
            applyIsolateVisibility();
            if (!flew && e >= 0.4) {
              flew = true;
              flyIso(1600);
            }
          },
          onComplete: () => {
            applyExplode(1);
            applyIsolateVisibility();
            requestAnimationFrame(() => flyIso(1800));
            debugLog(
              "Viewer3D",
              `presentation n=${collectAllMeshes().length} gap=${lastGap.toFixed(2)} layout=${presentationLayoutMode}`,
              "ok",
            );
          },
        });
      }
    } else if (wasPresentationRef.current) {
      wasPresentationRef.current = false;

      clip.setOrientation("horizontal");
      clip.clear();
      clip.setEnabled(false);
      clip.setCapsEnabled(false);

      const startOffsets = new Map<
        THREE.Mesh,
        { y: number; x: number }
      >();
      collectFloorMeshes().forEach((arr) => {
        for (const m of arr) {
          startOffsets.set(m, {
            y: (m.userData.presentationOffsetY as number) ?? 0,
            x: (m.userData.presentationOffsetX as number) ?? 0,
          });
        }
      });

      explodeTweenRef.current = animateProgress({
        duration: 1.2,
        ease: gsapEase.explode,
        onUpdate: (e) => {
          const t = 1 - e;
          startOffsets.forEach((startOff, mesh) => {
            const targetY = startOff.y * t;
            const targetX = startOff.x * t;
            const prevY = (mesh.userData.presentationOffsetY as number) ?? 0;
            const prevX = (mesh.userData.presentationOffsetX as number) ?? 0;
            mesh.position.y += targetY - prevY;
            mesh.position.x += targetX - prevX;
            mesh.userData.presentationOffsetY = targetY;
            mesh.userData.presentationOffsetX = targetX;
            if (e >= 1) {
              delete mesh.userData.presentationOffsetY;
              delete mesh.userData.presentationOffsetX;
            }
          });
          syncVentilationMarkerPresentationOffsets(
            ventilationMarkersRef.current,
            roomMeshById.current,
          );
        },
        onComplete: () => {
          const saved = presentationCamRef.current;
          if (saved) {
            void flyTo(
              camera,
              controls,
              new THREE.Vector3(...saved.position),
              new THREE.Vector3(...saved.target),
              1200,
            );
            presentationCamRef.current = null;
          } else {
            requestAnimationFrame(() => fitToVisible());
          }
        },
      });
    }

    return () => {
      explodeTweenRef.current?.kill();
      if (refreshTimer != null) window.clearTimeout(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPresentationView,
    presentationLayoutMode,
    presentationIsolate,
    presentationFloorId,
    compareBothModes,
    floors,
    shellGroup,
    rooms,
  ]);

  // Outline + opacity for selected room (basic + presentation) — no camera zoom
  useEffect(() => {
    const apply = () => {
      const baseOpacity = useAppStore.getState().lighting.spaceTransparency;
      const selectedRoom = useAppStore.getState().selectedRoomId;
      const selectedEl = useAppStore.getState().selectedElement;
      const selectedExpress = selectedEl?.expressId ?? null;
      const selectedElRoomId = selectedEl?.roomId ?? null;
      const lightMode = useAppStore.getState().renderMode === "light";
      const filter = useAppStore.getState().activeFilter;
      const roomList = useAppStore.getState().rooms;
      const viewMode = useAppStore.getState().dataViewMode;
      const zoneKey = useAppStore.getState().selectedVentilationZoneKey;
      const zoneFocus = viewMode === "luftung" && Boolean(zoneKey);
      const byId = new Map(roomList.map((r) => [r.id, r]));

      // Resolve an id that actually exists on a room mesh — otherwise a stale /
      // mismatched selectedRoomId would fade every room to 10% with no highlight.
      let resolvedId: string | null = selectedRoom;
      const meshHas = (id: string | null | undefined) =>
        Boolean(id && roomMeshById.current.has(id));

      if (!meshHas(resolvedId) && meshHas(selectedElRoomId)) {
        resolvedId = selectedElRoomId;
      }
      if (!meshHas(resolvedId) && selectedExpress != null) {
        for (const [id, mesh] of roomMeshById.current) {
          if (mesh.userData.expressId === selectedExpress) {
            resolvedId = id;
            break;
          }
        }
      }
      if (!meshHas(resolvedId) && selectedRoom) {
        const byExpress = roomList.find(
          (r) =>
            r.id === selectedRoom ||
            r.expressId === selectedExpress ||
            (selectedElRoomId != null && r.id === selectedElRoomId),
        );
        if (byExpress && meshHas(byExpress.id)) resolvedId = byExpress.id;
      }
      if (!meshHas(resolvedId)) resolvedId = null;

      const scopedSelection = effectiveSelectedRoomId(resolvedId);
      if (scopedSelection !== resolvedId) {
        resolvedId = scopedSelection;
        if (!scopedSelection && selectedRoom) {
          useAppStore.getState().setSelectedRoomId(null);
          useAppStore.getState().setSelectedElement(null);
        }
      }

      // Heal store if we found the real mesh id
      if (resolvedId && resolvedId !== selectedRoom) {
        useAppStore.getState().setSelectedRoomId(resolvedId);
      }

      const hasRoomSelection = Boolean(resolvedId);
      const SEL_OPACITY = 0.8;
      const OTHER_OPACITY = 0.1;
      const OTHER_GRAY = 0xa8aeb8;
      const colorAmt = useAppStore.getState().lighting.color ?? 1;

      const styleRoomMesh = (id: string, mesh: THREE.Mesh) => {
        clearSelectionOutlines(mesh);
        let mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat.userData.selectionClone) {
          mat = mat.clone();
          mat.userData.selectionClone = true;
          mesh.material = mat;
        }
        const isSel =
          hasRoomSelection &&
          (id === resolvedId ||
            mesh.userData.roomId === resolvedId ||
            (selectedExpress != null &&
              mesh.userData.expressId === selectedExpress));
        const room = byId.get(id);
        const passes = !filter || !room || roomPassesFilter(room, filter);
        const inZone =
          !zoneFocus ||
          !room ||
          roomInVentilationZone(room, zoneKey);

        const nextOpacity = !passes
          ? 0.1
          : hasRoomSelection
            ? isSel
              ? SEL_OPACITY
              : OTHER_OPACITY
            : zoneFocus && !inZone
              ? 0.12
              : baseOpacity;

        applySurfaceOpacity(mat, nextOpacity, true);

        const baseHex =
          (mesh.userData.colorHex as string | undefined) ??
          (mesh.userData.baseColorHex as string | undefined) ??
          `#${mat.color.getHexString()}`;

        if (hasRoomSelection && passes) {
          // Selected keeps load color; others go gray (all shading / Modell options).
          if (isSel) {
            mat.color.set(baseHex);
            mat.emissive.set(baseHex);
            mat.emissiveIntensity = lightMode ? 0.4 : 0.55;
          } else {
            mat.color.setHex(OTHER_GRAY);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        } else if (lightMode) {
          const c = new THREE.Color(baseHex).lerp(
            new THREE.Color(0xd0d4dc),
            1 - colorAmt,
          );
          mat.color.copy(c);
          mat.emissive.copy(c);
          mat.emissiveIntensity = 0.35 * colorAmt;
        } else {
          mat.color.set(baseHex);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }

        if (isSel && passes) {
          attachColorOutline(mesh, baseHex);
          mesh.renderOrder = 8;
        } else {
          mesh.renderOrder = 2;
        }
        mat.needsUpdate = true;
      };

      for (const [id, mesh] of roomMeshById.current) {
        styleRoomMesh(id, mesh);
      }
      for (const [id, mesh] of roomMeshTwinById.current) {
        styleRoomMesh(id, mesh);
      }

      clipRef.current?.setExcludedSelection({
        roomId: resolvedId,
        expressId: hasRoomSelection ? selectedExpress : null,
      });
      clipRef.current?.syncAllCapAppearance();

      shellCloneRef.current?.traverse((obj) => {
        if (!isShellMesh(obj)) return;
        clearSelectionOutlines(obj);
        const mat = obj.material as THREE.MeshStandardMaterial;
        const isSel =
          hasRoomSelection && obj.userData.expressId === selectedExpress;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        if (isSel) {
          const hex =
            (obj.userData.colorHex as string | undefined) ??
            `#${mat.color.getHexString()}`;
          attachColorOutline(obj, hex);
        }
        mat.needsUpdate = true;
      });
    };

    applySelectionHighlightRef.current = apply;
    apply();
  }, [
    selectedRoomId,
    selectedElement,
    lighting.spaceTransparency,
    isPresentationView,
    activeColorPalette,
    activeFilter,
    rooms,
    roomsFromStore,
    compareBothModes,
    presentationIsolate,
    presentationFloorId,
    dataViewMode,
    selectedVentilationZoneKey,
  ]);

  // Pointer: select only — no camera flyTo
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;

    /** Skip room pick when this click ends an orbit/pan drag. */
    const DRAG_PX = 6;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let suppressNextClick = false;

    const pickHit = (clientX: number, clientY: number) => {
      const camera = cameraRef.current;
      if (!camera) return null;

      const rect = canvas.getBoundingClientRect();
      pointerNdc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointerNdc.current, camera);

      const clip = clipRef.current;
      const caps = clip?.getCapsGroup();
      const capsOn = Boolean(caps?.visible);

      // 1) Direct hit on Schnitthöhe caps (room fills) — most reliable for picking
      if (capsOn && caps) {
        const capHits = raycaster.current
          .intersectObjects(caps.children, true)
          .filter(
            (h) =>
              h.object.userData.isClipCap ||
              h.object.parent?.userData.isClipCap,
          );
        for (const hit of capHits) {
          let ids = pickIdsFromObject(hit.object);
          if (ids.roomId == null) {
            const src = clip?.getSourceMeshForCap(hit.object);
            if (src) ids = pickIdsFromObject(src);
          }
          if (ids.roomId != null && isRoomPickAllowed(ids.roomId, ids.floorId)) {
            const mesh =
              roomMeshById.current.get(ids.roomId) ??
              clip?.getSourceMeshForCap(hit.object);
            if (mesh) {
              return {
                object: mesh,
                distance: hit.distance,
                point: hit.point.clone(),
                face: null,
                faceIndex: 0,
                uv: undefined,
              } as THREE.Intersection;
            }
          }
        }
      }

      // 2) Footprint pick at cut plane (works even if cap mesh is hard to hit)
      if (capsOn && clip) {
        const roomMeshes: THREE.Mesh[] = [];
        overlaysRef.current?.traverse((o) => {
          if (!isOverlayRoomMesh(o) || !o.visible) return;
          const ids = pickIdsFromObject(o);
          if (isRoomPickAllowed(ids.roomId, ids.floorId)) roomMeshes.push(o);
        });
        const roomMesh = clip.pickRoomMeshAtCut(raycaster.current, roomMeshes);
        if (roomMesh) {
          const ids = pickIdsFromObject(roomMesh);
          if (isRoomPickAllowed(ids.roomId, ids.floorId)) {
            return {
              object: roomMesh,
              distance: 0,
              point: new THREE.Vector3(),
              face: null,
              faceIndex: 0,
              uv: undefined,
            } as THREE.Intersection;
          }
        }
      }

      const targets: THREE.Object3D[] = [];
      const addVisibleRooms = (root: THREE.Object3D | null | undefined) => {
        root?.traverse((o) => {
          if (isOverlayRoomMesh(o) && o.visible) targets.push(o);
        });
      };
      addVisibleRooms(overlaysRef.current);
      if (useAppStore.getState().compareBothModes) {
        addVisibleRooms(compareRootRef.current);
      }

      const presentation = useAppStore.getState().isPresentationView;
      // Shell roofs/walls block room hits from above in presentation — pick rooms only.
      if (!capsOn && !presentation && shellCloneRef.current) {
        targets.push(shellCloneRef.current);
      }

      const hits = raycaster.current.intersectObjects(targets, true);
      const usable = hits.filter(
        (h) =>
          !h.object.userData.isClipStencil &&
          !h.object.userData.isSelectionOutline &&
          !h.object.userData.isClipCap,
      );
      if (!usable.length) return null;

      const resolveIds = (obj: THREE.Object3D) => pickIdsFromObject(obj);

      const closest = usable[0].distance;
      const near = usable.filter((h) => h.distance <= closest + 0.25);
      const roomHit =
        near.find((h) => resolveIds(h.object).roomId != null) ??
        usable.find((h) => resolveIds(h.object).roomId != null) ??
        null;
      const chosen = roomHit ?? usable[0];

      const ids = resolveIds(chosen.object);
      if (
        ids.roomId != null &&
        !isRoomPickAllowed(ids.roomId, ids.floorId ?? null)
      ) {
        return null;
      }
      if (ids.roomId != null) chosen.object.userData.roomId = ids.roomId;
      if (ids.expressId != null) chosen.object.userData.expressId = ids.expressId;
      if (ids.floorId != null) chosen.object.userData.floorId = ids.floorId;

      return chosen;
    };

    const applyPickSelection = (hit: THREE.Intersection | null) => {
      const inTool = useAppStore.getState().toolMode;
      if (!hit) {
        setSelectedRoomId(null);
        setSelectedElement(null);
        if (inTool) useAppStore.getState().setToolSelectedExpressId(null);
        return;
      }
      const ids = pickIdsFromObject(hit.object);
      let roomId = ids.roomId ?? null;
      const expressId = ids.expressId;
      const floorId = ids.floorId ?? null;
      if (inTool) {
        useAppStore.getState().setToolSelectedExpressId(expressId ?? null);
      }

      // Resolve room by expressId when pick only has the space mesh id
      if (!roomId && expressId != null) {
        const match =
          useAppStore.getState().rooms.find((r) => r.expressId === expressId) ??
          null;
        if (match) roomId = match.id;
      }

      const resolvedFloor =
        floorId ??
        (roomId
          ? useAppStore.getState().rooms.find((r) => r.id === roomId)?.floorId
          : null) ??
        null;
      if (!isRoomPickAllowed(roomId, resolvedFloor)) {
        return;
      }

      if (roomId) {
        if (useAppStore.getState().autoFocusSelection) {
          useAppStore.getState().requestRoomFocus(roomId);
        } else {
          setSelectedRoomId(roomId);
        }
        setHoveredRoom(null);
      } else setSelectedRoomId(null);

      if (expressId != null) {
        void (async () => {
          const details = await getElementDetails(
            expressId,
            floorId,
            roomId ?? null,
          );
          if (details) {
            const detailRoomId = details.roomId ?? roomId;
            const detailFloor =
              details.floorId ??
              floorId ??
              (detailRoomId
                ? useAppStore.getState().rooms.find((r) => r.id === detailRoomId)
                    ?.floorId
                : null) ??
              null;
            if (!isRoomPickAllowed(detailRoomId, detailFloor)) return;

            setSelectedElement(details);
            useAppStore.getState().bumpScenePickToken();
            // Keep room id in sync with element details (highlight key)
            if (details.roomId) {
              setSelectedRoomId(details.roomId);
            } else if (roomId) {
              setSelectedRoomId(roomId);
            }
            // Mobile / compact layout: keep panels closed; user opens options explicitly.
            if (!isCompactMobileViewport()) {
              if (!inTool) setLeftPanelOpen(true);
              setRightPanelOpen(true);
              if (useAppStore.getState().isPresentationView) {
                useAppStore.getState().setPresentationRoomsOpen(true);
              }
            }
            const room =
              (details.roomId ?? roomId) != null
                ? useAppStore
                    .getState()
                    .rooms.find((r) => r.id === (details.roomId ?? roomId))
                : undefined;
            const keyProps = details.properties.filter((p) => {
              const n = p.name.toLowerCase().replace(/\s+/g, "");
              return (
                n.includes("heizlast") ||
                n.includes("kuehllast") ||
                n.includes("kühllast") ||
                n.includes("cooling") ||
                n === "temp" ||
                n.includes("temperatur") ||
                n.includes("heatload")
              );
            });
            debugLog(
              "Viewer3D",
              `selected ${details.typeName}: ${details.name}`,
              "ok",
              {
                expressId,
                globalId: details.globalId,
                roomId: details.roomId ?? roomId,
                extracted: room
                  ? {
                      heatLoad: room.heatLoad,
                      heizlast: room.heizlast,
                      coolLoad: room.coolLoad,
                      kuhllast: room.kuhllast,
                      temperature: room.temperature,
                      coolTemperature: room.coolTemperature,
                    }
                  : null,
                keyProps,
                allProperties: details.properties.map(
                  (p) => `${p.pset ?? "?"}.${p.name}=${p.value}`,
                ),
              },
            );
          }
        })();
      }
    };

    const onMove = (e: PointerEvent) => {
      if ((e.buttons & 1) === 1 && !suppressNextClick) {
        const dx = e.clientX - pointerDownX;
        const dy = e.clientY - pointerDownY;
        if (dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
          suppressNextClick = true;
        }
      }
      onPointerMove?.(e.clientX, e.clientY);
      const cube = viewCubeRef.current;
      if (cube?.containsClientPoint(e.clientX, e.clientY, canvas)) {
        cube.updateHover(e.clientX, e.clientY, canvas);
        canvas.style.cursor = "pointer";
        setHoveredRoom(null);
        return;
      }
      cube?.clearHover();
      const hit = pickHit(e.clientX, e.clientY);
      if (!hit) {
        setHoveredRoom(null);
        canvas.style.cursor = "default";
        return;
      }
      const roomId = pickIdsFromObject(hit.object).roomId;
      if (roomId && canHover()) {
        const room =
          rooms.find((r) => r.id === roomId) ??
          roomsFromStore.find((r) => r.id === roomId) ??
          null;
        if (room && isRoomPickAllowed(room.id, room.floorId)) {
          setHoveredRoom(room);
        } else {
          setHoveredRoom(null);
        }
      } else {
        setHoveredRoom(null);
      }
      canvas.style.cursor = "pointer";
    };

    const onLeave = () => {
      viewCubeRef.current?.clearHover();
      setHoveredRoom(null);
      canvas.style.cursor = "default";
      onPointerLeave?.();
    };

    const onClick = (e: PointerEvent) => {
      // Orbit / pan release lands as a click — do not change room selection.
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      const cube = viewCubeRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (cube && camera && controls && cube.containsClientPoint(e.clientX, e.clientY, canvas)) {
        const zone = cube.pick(e.clientX, e.clientY, canvas);
        if (zone) {
          e.preventDefault();
          e.stopPropagation();
          void cube.snapMainCamera(zone, camera, controls, 600);
        }
        return;
      }

      const hit = pickHit(e.clientX, e.clientY);
      const viewMode = useAppStore.getState().dataViewMode;

      if (viewMode === "luftung") {
        if (!hit) {
          setSelectedVentilationZoneKey(null);
          setSelectedRoomId(null);
          setSelectedElement(null);
          return;
        }
        const { roomId } = pickIdsFromObject(hit.object);
        const room =
          roomId != null
            ? (rooms.find((r) => r.id === roomId) ??
              roomsFromStore.find((r) => r.id === roomId))
            : undefined;
        if (
          roomId &&
          room &&
          isRoomPickAllowed(room.id, room.floorId)
        ) {
          setSelectedVentilationZoneKey(roomVentilationZoneKey(room));
          setSelectedRoomId(null);
          setSelectedElement(null);
          setHoveredRoom(null);
        }
        return;
      }

      applyPickSelection(hit);
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      const hit = pickHit(e.clientX, e.clientY);
      if (hit && useAppStore.getState().dataViewMode === "luftung") {
        const { roomId } = pickIdsFromObject(hit.object);
        const room =
          roomId != null
            ? (rooms.find((r) => r.id === roomId) ??
              roomsFromStore.find((r) => r.id === roomId))
            : undefined;
        if (
          roomId &&
          room &&
          isRoomPickAllowed(room.id, room.floorId)
        ) {
          const zoneKey = roomVentilationZoneKey(room);
          if (
            useAppStore.getState().selectedVentilationZoneKey !== zoneKey
          ) {
            setSelectedVentilationZoneKey(zoneKey);
          }
          applyPickSelection(hit);
          if (useAppStore.getState().autoFocusSelection) {
            requestRoomFocus(roomId);
          }
          return;
        }
      }
      const presentation = useAppStore.getState().isPresentationView;
      fitToVisible(presentation ? 2000 : 850);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
        suppressNextClick = false;
      }
      const cube = viewCubeRef.current;
      const controls = controlsRef.current;
      if (cube?.containsClientPoint(e.clientX, e.clientY, canvas) && controls) {
        controls.enabled = false;
      }
    };
    const onPointerUp = () => {
      const controls = controlsRef.current;
      if (controls && !useAppStore.getState().viewerContextMenuOpen) {
        controls.enabled = true;
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
    };
  }, [
    onPointerMove,
    onPointerLeave,
    rooms,
    roomsFromStore,
    setHoveredRoom,
    setSelectedRoomId,
    setSelectedElement,
    setSelectedVentilationZoneKey,
    requestRoomFocus,
    setLeftPanelOpen,
    setRightPanelOpen,
  ]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`} data-viewer-root />
  );
});

export default Viewer3D;
