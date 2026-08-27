"use client";

/**
 * Viewer3D — the core Three.js scene component: loads the IFC shell and room
 * overlays (cloned from `useModelScene`) into a perspective scene with
 * OrbitControls, a view cube, PMREM environment lighting and shadows, and
 * imperatively exposes camera pose / fly-to / fit / capture via
 * `WerkzeugViewer3DHandle` (`ref`) for ViewerApp, the toolbar and saved views.
 *
 * Reacts to a large slice of useAppStore: `renderMode` + `lighting` (drives
 * `applyRenderMode`, which also branches on `toolMode` — Werkzeug hides all
 * room/space overlays and forces full element opacity, BIMvision-style),
 * `colorMode`/`dataViewMode` + legend ranges/palette (room overlay + shell
 * coloring, including a side-by-side "compare both modes" twin scene),
 * `selectedFloor` + `sliceProgress` (horizontal clip-plane slicing via
 * `ClipSliceController`), `isPresentationView`/`presentationLayoutMode`/
 * `presentationIsolate` (the exploded floor-grid/stack layout with
 * GSAP-tweened offsets and iso camera framing), ventilation markers
 * (`dataViewMode === "luftung"`, also suppressed while `bauteilMode` is on),
 * and `toolMode`/`hiddenElementIds`/`isolatedElementIds` (Werkzeug per-element
 * visibility + edge outlines from the IFC structure tree).
 *
 * Also owns pointer-based hover/select picking (raycasting against room
 * meshes, Schnitthöhe clip caps, and shell meshes, with room-vs-element
 * resolution and `isRoomPickAllowed` gating) and view-cube snap navigation.
 * This file is intentionally large (~2500 lines) — treat this header as an
 * orientation map, not an exhaustive spec.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { MOUSE } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { heizlastToColor, kuhllastToColor, luftungToColor, temperatureToColor, legendStopsForMode } from "@/lib/colorMapping";
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
import type { CustomLegendColors, LegendColorMode } from "@/lib/colorMapping";
import { DEFAULT_SCENE_BG, findScenePreset, parseGradientLerp, resolveSceneBackground, updateSkyGradientTexture } from "@/lib/sceneSky";
import type { DataViewMode } from "@/lib/dataViewMode";
import { ViewCube, VIEW_CUBE_LAYOUT } from "@/lib/viewCube";
import {
  applyGridSnap,
  enhanceHitWithVertexSnap,
  pickMarkupSurface,
} from "@/lib/markupSnap";
import { fromMm, snapToNearbyAabb, toMm } from "@/lib/markupUnits";
import { MarkupSceneLayer } from "@/components/tools/MarkupSceneLayer";
import { FirstPersonWalkthroughController } from "@/lib/firstPersonWalkthrough";
import QuadViewOverlays from "@/components/tools/QuadViewOverlays";
import {
  applySlotToCameras,
  captureSlotFromCamera,
  createDefaultQuadSlots,
  fitSlotToBox,
  isAbsoluteOrthoPreset,
  ndcInQuad,
  poseSlotFromBox,
  quadIndexFromClient,
  quadWebGLRect,
  type QuadIndex,
  type QuadSlotPose,
} from "@/lib/quadView";
import {
  pushWerkzeugHistory,
  suspendWerkzeugHistory,
} from "@/lib/werkzeugHistory";
import LayoutSceneLayer from "@/components/tools/LayoutSceneLayer";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { MATERIAL_DRAG_MIME, useMaterialStore } from "@/store/materialStore";
import { getHatchCanvasTexture } from "@/lib/hatchPatterns";
import {
  nearestOffsetOnWallMm,
  nearestParallelFaceGapMm,
  snapPlanPointToWalls,
  snapWallEndpointMm,
  wallTranslated,
  wallWithFaceGapTo,
  type SelectedElementRef,
} from "@/lib/layoutDrawing";
import { isShapeTool } from "@/components/tools/MarkupIcons";
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
import { useModelScene } from "./WerkzeugModelSceneContext";

export type WerkzeugViewer3DHandle = {
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

function projectPointToClient(
  pt: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const v = pt.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + ((v.x + 1) / 2) * rect.width,
    y: rect.top + ((-v.y + 1) / 2) * rect.height,
  };
}

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
    if (o instanceof THREE.Mesh) {
      const mat = o.material;
      if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uAngle) {
        gsap.killTweensOf(mat.uniforms.uAngle);
      }
      mat.dispose();
      o.geometry.dispose();
    }
    o.parent?.remove(o);
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

/**
 * Thermal-gradient selection outline: a single BackSide ring with a slowly rotating
 * conic gradient through 6 sampled stops of the active legend.
 */
function attachThermalSelectionOutline(mesh: THREE.Mesh, colors: THREE.Color[]) {
  clearSelectionOutlines(mesh);
  const geom = mesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox;
  if (!box || box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());

  // Clone and center geometry locally so polar angle works around (0,0) center
  const localGeom = geom.clone();
  localGeom.center();

  const inflate = 1.12;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColors:  { value: colors },
      uCount:   { value: colors.length },
      uAngle:   { value: 0 },
      uOpacity: { value: 0.85 }, // little transparency
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3  uColors[6];
      uniform int   uCount;
      uniform float uAngle;
      uniform float uOpacity;
      varying vec3  vLocalPos;
      #define PI 3.14159265359
      void main() {
        float angle = atan(vLocalPos.z, vLocalPos.x) + uAngle;
        float t = fract((angle + PI) / (2.0 * PI));
        float loopT = t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0;
        float seg = loopT * float(uCount - 1);
        int idx = int(floor(seg));
        if (idx >= uCount - 1) idx = uCount - 2;
        float localT = seg - float(idx);
        vec3 c = mix(uColors[idx], uColors[idx + 1], localT);
        gl_FragColor = vec4(c, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    clipping: true,
  });

  const ring = new THREE.Mesh(localGeom, mat);
  ring.scale.setScalar(inflate);
  ring.position.copy(center);
  ring.userData.isSelectionOutline = true;
  ring.renderOrder = (mesh.renderOrder ?? 0) + 22;
  mesh.add(ring);

  // Faster rotation around the room
  gsap.to(mat.uniforms.uAngle, {
    value: Math.PI * 2,
    duration: 5.5,
    repeat: -1,
    ease: "none",
  });
}

function getHighlightColors(
  room: Room | null | undefined,
  dataViewMode: string,
  colorPaletteId: string,
  heizlastRange: number[],
  kuhllastRange: number[],
  luftungRange: number[],
  activeTemperatureRange: number[],
  customLegendColors: CustomLegendColors | null | undefined,
): THREE.Color[] {
  let targetMode = dataViewMode;
  if (dataViewMode === "heizlast") {
    targetMode = "temperature";
  } else if (dataViewMode === "temperature") {
    targetMode = "heizlast";
  }

  let mode: LegendColorMode = "heizlast";
  let range = heizlastRange;
  let overrides = customLegendColors?.heizlast;
  let val = room?.heatLoad ?? 0;

  if (targetMode === "kuhllast") {
    mode = "kuhllast";
    range = kuhllastRange;
    overrides = customLegendColors?.kuhllast;
    val = room?.coolLoad ?? 0;
  } else if (targetMode === "luftung") {
    mode = "luftung";
    range = luftungRange;
    overrides = customLegendColors?.luftung;
    val = room?.heatLoad ?? 0;
  } else if (targetMode === "temperature") {
    mode = "temperature";
    range = activeTemperatureRange;
    overrides = customLegendColors?.temperature;
    val = room ? roomTemperatureForView(room, "temperature" as DataViewMode) : 20;
  }

  const stops = legendStopsForMode(mode, colorPaletteId, range, overrides);
  if (!stops || !stops.length) {
    return [
      new THREE.Color("#0050ff"),
      new THREE.Color("#1f8a70"),
      new THREE.Color("#4caf50"),
      new THREE.Color("#ffdc00"),
      new THREE.Color("#ff8c00"),
      new THREE.Color("#dc0000"),
    ];
  }

  const sampleColor = (t: number): THREE.Color => {
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (stops.length - 1);
    const idx = Math.floor(scaled);
    const f = scaled - idx;
    if (idx >= stops.length - 1) return new THREE.Color(stops[stops.length - 1].color);
    const c1 = new THREE.Color(stops[idx].color);
    const c2 = new THREE.Color(stops[idx + 1].color);
    return c1.clone().lerp(c2, f);
  };

  const first = range[0];
  const last = range[range.length - 1];
  const span = last - first;
  const tCenter = span === 0 ? 0.5 : Math.max(0, Math.min(1, (val - first) / span));

  const startT = Math.max(0, Math.min(0.5, tCenter - 0.25));
  const endT = Math.min(1, Math.max(0.5, tCenter + 0.25));

  const colors: THREE.Color[] = [];
  for (let i = 0; i < 6; i++) {
    const t = startT + (endT - startT) * (i / 5);
    colors.push(sampleColor(t));
  }
  return colors;
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
  const elementOpacity = lighting?.elementTransparency ?? (inTool ? 1 : 0.8);
  const colorAmt = lighting?.color ?? 1;

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
          const glassColor = fill.clone();
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

const WerkzeugViewer3D = forwardRef<WerkzeugViewer3DHandle, Props>(function WerkzeugViewer3D(
  { onPointerMove, onPointerLeave, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const perspectiveCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls<
    THREE.PerspectiveCamera | THREE.OrthographicCamera
  > | null>(null);
  const shellCloneRef = useRef<THREE.Group | null>(null);
  const overlaysRef = useRef<THREE.Group | null>(null);
  const compareRootRef = useRef<THREE.Group | null>(null);
  const helpersRef = useRef<THREE.Group | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const viewCubeRef = useRef<ViewCube | null>(null);

  useEffect(() => {
    const reposition = (event: Event) => {
      const edge = (event as CustomEvent<"top" | "bottom">).detail;
      viewCubeRef.current?.setMargins({
        marginTop: edge === "top" ? 78 : 16,
        marginRight: 16,
      });
    };
    window.addEventListener("werkzeug-ipad-toolbar-dock", reposition);
    return () => window.removeEventListener("werkzeug-ipad-toolbar-dock", reposition);
  }, []);
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
  const markupLayerRef = useRef<MarkupSceneLayer | null>(null);
  const layoutLayerRef = useRef<LayoutSceneLayer | null>(null);
  const traceHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traceHoverSeqRef = useRef(0);
  const lastNotePinTokenRef = useRef(0);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const transformDraggingRef = useRef(false);
  const suppressTransformReleaseClickRef = useRef(false);
  const walkthroughRef = useRef<FirstPersonWalkthroughController | null>(null);
  const persistGizmoRef = useRef<() => void>(() => {});
  /** Drag wall endpoint / wall move / unlocked underlay move. */
  const wallEditDragRef = useRef<{
    mode: "endpoint" | "move" | "underlay";
    wallId?: string;
    underlayId?: string;
    end?: "start" | "end";
    lastXmm: number;
    lastYmm: number;
  } | null>(null);
  const orthoFrustumRef = useRef(20);
  const activeViewPresetRef = useRef<string>("free");
  const quadSlotsRef = useRef<QuadSlotPose[]>(createDefaultQuadSlots());
  const preparePointerRayRef = useRef<
    (clientX: number, clientY: number) => THREE.Camera | null
  >(() => null);
  const activateQuadIndexRef = useRef<(index: QuadIndex) => void>(() => {});
  const applyPresetRef = useRef<((preset: string) => void) | null>(null);
  const centerOrbitOnSelectionRef = useRef<((animate?: boolean) => void) | null>(null);
  const fitAllQuadsToBoxRef = useRef<(box: THREE.Box3) => void>(() => {});

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
  const activeModelId = useAppStore((s) => s.activeModelId);
  const activeModelLabel = useAppStore((s) => s.activeModelLabel);
  const bauteilMode = false;
  const hiddenElementIds = useAppStore((s) => s.hiddenElementIds);
  const isolatedElementIds = useAppStore((s) => s.isolatedElementIds);
  const toolRevealToken = useAppStore((s) => s.toolRevealToken);
  const toolSelectedExpressId = useAppStore((s) => s.toolSelectedExpressId);
  const notePinToken = useToolMarkupStore((s) => s.notePinToken);
  const markupFloorIdForLayout = useToolMarkupStore((s) => s.markupFloorId);

  const fitToVisible = (durationMs = 850) => {
    const controls = controlsRef.current;
    const overlays = overlaysRef.current;
    const shell = shellCloneRef.current;
    if (!controls) return;

    // In Werkzeug ortho views: reframe the same preset (keep Top when floors change).
    const inTool = useAppStore.getState().toolMode;
    const preset = useToolMarkupStore.getState().viewPreset;
    if (inTool && preset !== "free") {
      if (applyPresetRef.current) {
        applyPresetRef.current(preset);
      } else {
        useToolMarkupStore.getState().setViewPreset(preset);
      }
      return;
    }

    const camera = perspectiveCameraRef.current;
    if (!camera) return;

    if (cameraRef.current !== camera) {
      cameraRef.current = camera;
      controls.object = camera;
      controls.enableRotate = true;
      const tc = transformControlsRef.current;
      if (tc) {
        (tc as TransformControls & { camera: THREE.Camera }).camera = camera;
      }
    }

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
    if (layoutLayerRef.current?.group) {
      layoutLayerRef.current.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.visible) {
          if (
            !o.userData.isLayoutGround &&
            !o.userData.isLayoutUnderlay &&
            !o.userData.isLayoutLevelSlab
          ) {
            const b = new THREE.Box3().setFromObject(o);
            if (!b.isEmpty() && Number.isFinite(b.min.x)) {
              box.union(b);
              has = true;
            }
          }
        }
      });
    }

    if (!has) {
      const gridSpan = 52;
      const fov = (camera.fov * Math.PI) / 180;
      const aspect = camera.aspect || 1.6;
      const vDist = (gridSpan * 0.72) / Math.tan(fov / 2);
      const hDist = (gridSpan * 0.72) / (Math.tan(fov / 2) * Math.min(aspect, 1.2));
      const dist = Math.max(vDist, hDist, 68);

      const dir = new THREE.Vector3(1, 0.82, 1).normalize();
      const pos = new THREE.Vector3(0, 0, 0).add(dir.multiplyScalar(dist));
      const tgt = new THREE.Vector3(0, 0, 0);

      void flyTo(camera, controls, pos, tgt, durationMs);
      return;
    }
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
    const { position, target } = frameBoundingBox(box, camera, 1.25, {
      keepDirection: keepDirection.lengthSq() > 0.01 ? keepDirection : new THREE.Vector3(1, 0.75, 1),
    });
    void flyTo(camera, controls, position, target, durationMs);
  };

  useImperativeHandle(ref, () => ({
    getCameraPose: () => {
      const camera = perspectiveCameraRef.current ?? cameraRef.current;
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
      const camera = perspectiveCameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      if (cameraRef.current !== camera) {
        cameraRef.current = camera;
        controls.object = camera;
        controls.enableRotate = true;
      }
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
      const camera = perspectiveCameraRef.current;
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

  const centerOrbitOnSelection = (animate = true) => {
    const camera = perspectiveCameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || cameraRef.current !== camera) return;

    const layoutLayer = layoutLayerRef.current;
    const shellClone = shellCloneRef.current;
    const box = new THREE.Box3();
    let found = false;

    const layout = useLayoutDrawingStore.getState();
    const selList = layout.selectedElements || [];
    const selIds = new Set(selList.map((e) => e.id));
    if (layout.selectedWallId) selIds.add(layout.selectedWallId);
    if (layout.selectedDoorId) selIds.add(layout.selectedDoorId);
    if (layout.selectedWindowId) selIds.add(layout.selectedWindowId);
    if (layout.selectedSlabId) selIds.add(layout.selectedSlabId);
    if (layout.selectedColumnId) selIds.add(layout.selectedColumnId);
    if (layout.selectedBeamId) selIds.add(layout.selectedBeamId);
    if (layout.selectedGridLineId) selIds.add(layout.selectedGridLineId);
    if (layout.selectedSketchLineId) selIds.add(layout.selectedSketchLineId);

    if (layoutLayer && selIds.size > 0) {
      layoutLayer.group.traverse((o) => {
        if (
          (o.userData?.layoutWallId && selIds.has(o.userData.layoutWallId)) ||
          (o.userData?.layoutDoorId && selIds.has(o.userData.layoutDoorId)) ||
          (o.userData?.layoutWindowId && selIds.has(o.userData.layoutWindowId)) ||
          (o.userData?.layoutSlabId && selIds.has(o.userData.layoutSlabId)) ||
          (o.userData?.layoutColumnId && selIds.has(o.userData.layoutColumnId)) ||
          (o.userData?.layoutBeamId && selIds.has(o.userData.layoutBeamId)) ||
          (o.userData?.layoutGridId && selIds.has(o.userData.layoutGridId)) ||
          (o.userData?.layoutSketchLineId && selIds.has(o.userData.layoutSketchLineId))
        ) {
          if (o instanceof THREE.Mesh || o instanceof THREE.Group) {
            const b = new THREE.Box3().setFromObject(o);
            if (!b.isEmpty() && Number.isFinite(b.min.x)) {
              box.union(b);
              found = true;
            }
          }
        }
      });
    }

    if (!found) {
      const app = useAppStore.getState();
      if (app.selectedRoomId) {
        const roomMesh = roomMeshById.current.get(app.selectedRoomId);
        if (roomMesh) {
          const b = new THREE.Box3().setFromObject(roomMesh);
          if (!b.isEmpty() && Number.isFinite(b.min.x)) {
            box.union(b);
            found = true;
          }
        }
      } else if (app.toolSelectedExpressId != null || app.selectedElement?.expressID != null) {
        const expressId = app.toolSelectedExpressId ?? app.selectedElement?.expressID;
        if (shellClone && expressId != null) {
          shellClone.traverse((o) => {
            if (o.userData?.expressId === expressId || o.userData?.expressID === expressId) {
              const b = new THREE.Box3().setFromObject(o);
              if (!b.isEmpty() && Number.isFinite(b.min.x)) {
                box.union(b);
                found = true;
              }
            }
          });
        }
      }
    }

    if (found && !box.isEmpty() && Number.isFinite(box.min.x)) {
      const center = box.getCenter(new THREE.Vector3());
      if (controls.target.distanceTo(center) < 0.02) return;
      if (animate) {
        gsap.to(controls.target, {
          x: center.x,
          y: center.y,
          z: center.z,
          duration: 0.3,
          ease: "power2.out",
          onUpdate: () => controls.update(),
        });
      } else {
        controls.target.copy(center);
        controls.update();
      }
    }
  };
  centerOrbitOnSelectionRef.current = centerOrbitOnSelection;

  useEffect(() => {
    const unsub = useLayoutDrawingStore.subscribe((s, prev) => {
      if (
        s.selectedWallId !== prev.selectedWallId ||
        s.selectedDoorId !== prev.selectedDoorId ||
        s.selectedWindowId !== prev.selectedWindowId ||
        s.selectedSlabId !== prev.selectedSlabId ||
        s.selectedColumnId !== prev.selectedColumnId ||
        s.selectedBeamId !== prev.selectedBeamId ||
        s.selectedGridLineId !== prev.selectedGridLineId ||
        s.selectedSketchLineId !== prev.selectedSketchLineId ||
        s.selectedElements !== prev.selectedElements
      ) {
        centerOrbitOnSelectionRef.current?.(true);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useAppStore.subscribe((s, prev) => {
      if (
        s.selectedRoomId !== prev.selectedRoomId ||
        s.toolSelectedExpressId !== prev.toolSelectedExpressId ||
        s.selectedElement !== prev.selectedElement
      ) {
        centerOrbitOnSelectionRef.current?.(true);
      }
    });
    return unsub;
  }, []);

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
    const ortho = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 5000);
    ortho.position.copy(camera.position);
    perspectiveCameraRef.current = camera;
    orthoCameraRef.current = ortho;

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
    const initialDock = document.documentElement.dataset.werkzeugDock;
    if (initialDock) viewCube.setMargins({ marginTop: initialDock === "top" ? 78 : 16, marginRight: initialDock === "right" ? 78 : 16 });

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

    const controls = new OrbitControls<
      THREE.PerspectiveCamera | THREE.OrthographicCamera
    >(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.85;
    controls.maxPolarAngle = Math.PI; // allow full orbit — avoids horizon clipping flicker
    // Right-click opens the context menu — do not pan on button 2.
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      // Right-drag pans; short right-click opens context menu (see ViewerContextMenu).
      RIGHT: MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.85);
    transform.enabled = false;
    const transformHelper = transform.getHelper();
    transformHelper.visible = false;
    transform.addEventListener("dragging-changed", (event) => {
      const dragging = Boolean(
        (event as unknown as { value: boolean }).value,
      );
      transformDraggingRef.current = dragging;
      controls.enabled = !dragging;
      if (dragging) {
        suppressTransformReleaseClickRef.current = true;
        pushWerkzeugHistory();
        suspendWerkzeugHistory(true);
      } else {
        // Persist while history is still suspended so the drag is one undo step.
        requestAnimationFrame(() => {
          persistGizmoRef.current();
          suspendWerkzeugHistory(false);
        });
      }
    });
    scene.add(transformHelper);
    transformControlsRef.current = transform;

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

    const markup = new MarkupSceneLayer();
    markup.attach(scene, container);
    markup.onNoteClick = (id) => {
      useToolMarkupStore.getState().selectNote(id);
    };
    markupLayerRef.current = markup;

    const layoutLayer = new LayoutSceneLayer();
    layoutLayer.setRenderMode(useAppStore.getState().renderMode);
    scene.add(layoutLayer.group);
    layoutLayerRef.current = layoutLayer;

    walkthroughRef.current = new FirstPersonWalkthroughController(
      camera,
      renderer.domElement,
    );

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const frustum = orthoFrustumRef.current;
      ortho.left = (-frustum * aspect) / 2;
      ortho.right = (frustum * aspect) / 2;
      ortho.top = frustum / 2;
      ortho.bottom = -frustum / 2;
      ortho.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      viewCube.updateViewport(w, h);
      markupLayerRef.current?.setSize(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const tick = () => {
      const now = performance.now();
      lastTickRef.current = now;
      const sz = new THREE.Vector2();
      renderer.getSize(sz);
      const markup = markupLayerRef.current;
      const tcHelper = transformControlsRef.current?.getHelper();
      const quadOn =
        useAppStore.getState().toolMode &&
        useToolMarkupStore.getState().quadView;

      if (quadOn) {
        const activeIdx = useToolMarkupStore.getState()
          .quadActiveIndex as QuadIndex;
        const slots = quadSlotsRef.current;
        // Update controls first, then capture — keeps each quadrant independent.
        controls.update();
        const liveCam = cameraRef.current;
        if (liveCam && slots[activeIdx]) {
          captureSlotFromCamera(slots[activeIdx], liveCam, controls.target);
          if (liveCam instanceof THREE.OrthographicCamera) {
            orthoFrustumRef.current = slots[activeIdx].frustum;
          }
        }

        renderer.setScissorTest(true);
        renderer.setViewport(0, 0, sz.x, sz.y);
        renderer.setScissor(0, 0, sz.x, sz.y);
        renderer.clear();

        for (let i = 0; i < 4; i++) {
          const index = i as QuadIndex;
          const rect = quadWebGLRect(index, sz.x, sz.y);
          const aspect = rect.w / Math.max(1, rect.h);
          const cam = applySlotToCameras(slots[index], aspect, camera, ortho);
          // Top pane → CAD door/window symbols; others → solid 3D boxes.
          layoutLayerRef.current?.setPlanMode(
            slots[index].preset === "top",
          );
          if (tcHelper) {
            tcHelper.visible =
              Boolean(transformControlsRef.current?.object) &&
              index === activeIdx;
          }
          renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
          renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
          renderer.render(scene, cam);
        }
        // Restore display mode for the active pane (picking / labels).
        layoutLayerRef.current?.setPlanMode(
          slots[activeIdx].preset === "top",
        );

        const aRect = quadWebGLRect(activeIdx, sz.x, sz.y);
        const aAspect = aRect.w / Math.max(1, aRect.h);
        const activeCam = applySlotToCameras(
          slots[activeIdx],
          aAspect,
          camera,
          ortho,
        );
        cameraRef.current = activeCam;
        controls.object = activeCam;
        const abs = isAbsoluteOrthoPreset(slots[activeIdx].preset);
        controls.enableRotate = !abs;
        controls.screenSpacePanning = abs;
        controls.target.copy(slots[activeIdx].target);
        if (tcHelper) {
          tcHelper.visible = Boolean(transformControlsRef.current?.object);
        }
        const tc = transformControlsRef.current;
        if (tc) {
          (tc as TransformControls & { camera: THREE.Camera }).camera =
            activeCam;
        }

        renderer.setScissorTest(false);
        markup?.render(activeCam);
      } else {
        const activeCam = cameraRef.current ?? camera;
        if (walkthroughRef.current?.enabled) {
          walkthroughRef.current.update();
        } else {
          controls.update();
        }
        // Keep Top/N/S/O/W locked to absolute axes (CAD-style).
        if (
          activeCam instanceof THREE.OrthographicCamera &&
          isAbsoluteOrthoPreset(activeViewPresetRef.current as import("@/lib/toolMarkup").MarkupViewPreset)
        ) {
          const preset = activeViewPresetRef.current;
          const t = controls.target;
          const dist = Math.max(activeCam.position.distanceTo(t), 1);
          if (preset === "top") {
            activeCam.up.set(0, 0, -1);
            activeCam.position.set(t.x, t.y + dist, t.z + 0.001);
          } else {
            activeCam.up.set(0, 1, 0);
            if (preset === "north") activeCam.position.set(t.x, t.y, t.z + dist);
            else if (preset === "south")
              activeCam.position.set(t.x, t.y, t.z - dist);
            else if (preset === "east")
              activeCam.position.set(t.x + dist, t.y, t.z);
            else activeCam.position.set(t.x - dist, t.y, t.z);
          }
          activeCam.lookAt(t);
        }
        if (activeCam instanceof THREE.PerspectiveCamera) {
          viewCube.syncFromCamera(activeCam, controls.target);
        }
        if (tcHelper) {
          tcHelper.visible = Boolean(transformControlsRef.current?.object);
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, sz.x, sz.y);
        renderer.render(scene, activeCam);
        markup?.render(activeCam);
        viewCube.updateViewport(sz.x, sz.y);
        if (activeCam instanceof THREE.PerspectiveCamera) {
          viewCube.render(renderer);
        }
      }
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
      transformControlsRef.current?.detach();
      transformControlsRef.current?.dispose();
      transformControlsRef.current = null;
      markupLayerRef.current?.detach(scene);
      markupLayerRef.current = null;
      layoutLayerRef.current?.dispose();
      if (layoutLayerRef.current) scene.remove(layoutLayerRef.current.group);
      layoutLayerRef.current = null;
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

    if (dataViewMode !== "luftung" || bauteilMode) return;

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
  }, [dataViewMode, bauteilMode, rooms, roomsFromStore, markerVisibleFloorId]);

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
    const camera = perspectiveCameraRef.current;
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
    const camera = perspectiveCameraRef.current;
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
    layoutLayerRef.current?.setRenderMode(renderMode);
    clipRef.current?.rebindMaterials();
    // Rebuild so Schnitthöhe caps pick up new space/element opacity
    clipRef.current?.rebuildCaps();
    applySelectionHighlightRef.current();

    const sun = sunRef.current;
    const ambient = ambientRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (toolMode) {
      if (renderMode === "light") {
        if (sun) {
          sun.intensity = 0.25 + lighting.shadow * 0.75;
          sun.castShadow = lighting.shadow > 0.35;
        }
        if (ambient) ambient.intensity = 0.85 + lighting.indirectLight * 0.75;
        if (renderer) {
          renderer.toneMappingExposure = 1.35;
          renderer.shadowMap.enabled = false;
        }
      } else if (renderMode === "realistic") {
        if (sun) {
          sun.intensity = 0.65 + lighting.shadow * 1.65;
          sun.castShadow = lighting.shadow > 0.05;
        }
        if (ambient) ambient.intensity = 0.3 + lighting.indirectLight * 1.05;
        if (renderer) {
          renderer.toneMappingExposure = 0.9 + lighting.indirectLight * 0.65;
          renderer.shadowMap.enabled = lighting.shadow > 0.05;
        }
      } else {
        // fullColor / wireframe
        if (sun) {
          sun.intensity = 0.45 + lighting.shadow * 1.25;
          sun.castShadow = renderMode !== "wireframe" && lighting.shadow > 0.05;
        }
        if (ambient) ambient.intensity = 0.45 + lighting.indirectLight * 0.85;
        if (renderer) {
          renderer.toneMappingExposure = 1.15;
          renderer.shadowMap.enabled = renderMode !== "wireframe";
        }
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

  // Live 3D material update subscription
  useEffect(() => {
    const unsub = useMaterialStore.subscribe(() => {
      layoutLayerRef.current?.refreshMaterials();
    });
    return () => unsub();
  }, []);

  // Desktop drag/drop and touch-friendly paint mode for layout materials.
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const assignAt = (clientX: number, clientY: number, materialId: string) => {
      const material = useMaterialStore.getState().getMaterial(materialId);
      const camera = cameraRef.current;
      const layer = layoutLayerRef.current;
      if (!material || !camera || !layer) return false;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(pointerNdc.current, camera);
      const hit = layer.pickLayout(raycaster.current);
      const store = useLayoutDrawingStore.getState();
      const patch = { material: material.id, color: material.color };
      let assigned = false;
      if (hit && "id" in hit) {
        if (hit.kind === "wall" || hit.kind === "wall-endpoint") void store.updateWall(hit.id, patch);
        else if (hit.kind === "slab") void store.updateSlab(hit.id, patch);
        else if (hit.kind === "door") void store.updateDoor(hit.id, patch);
        else if (hit.kind === "window") void store.updateWindow(hit.id, patch);
        else if (hit.kind === "column") void store.updateColumn(hit.id, patch);
        else if (hit.kind === "beam") void store.updateBeam(hit.id, patch);
        else return false;
        assigned = true;
      }
      if (!assigned && shellCloneRef.current) {
        const ifcHit = raycaster.current
          .intersectObject(shellCloneRef.current, true)
          .find((entry) => entry.object instanceof THREE.Mesh);
        const mesh = ifcHit?.object;
        if (mesh instanceof THREE.Mesh) {
          const previous = mesh.material;
          const next = new THREE.MeshPhysicalMaterial({
            color: material.color,
            roughness: material.roughness,
            metalness: material.metalness,
            opacity: material.opacity,
            transparent:
              material.opacity < 0.99 || (material.transmission ?? 0) > 0,
            transmission: material.transmission ?? 0,
            clearcoat: material.clearcoat ?? 0,
            clearcoatRoughness: material.clearcoatRoughness ?? 0.1,
            ior: material.ior ?? 1.5,
            emissive: material.emissive ?? "#000000",
            emissiveIntensity: material.emissiveIntensity ?? 0,
          });
          const hatch = getHatchCanvasTexture(
            material.hatchStyle,
            "#27272a",
            material.color,
            material.hatchScaleMm ?? 200,
          );
          if (hatch) {
            next.map = hatch.clone();
            const repeat = (material.tilingScale ?? 1) /
              Math.max(0.025, (material.hatchScaleMm ?? 200) / 1000);
            next.map.repeat.set(repeat, repeat);
            next.map.needsUpdate = true;
          }
          mesh.material = next;
          mesh.userData.vstudioMaterialId = material.id;
          const oldMaterials = Array.isArray(previous) ? previous : [previous];
          for (const old of oldMaterials) old?.dispose();
          assigned = true;
        }
      }
      if (!assigned) return false;
      useToolMarkupStore.getState().setDragSnapHint({
        text: `${material.name} assigned`,
        clientX,
        clientY,
      });
      window.setTimeout(() => useToolMarkupStore.getState().setDragSnapHint(null), 1200);
      return true;
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(MATERIAL_DRAG_MIME)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    };
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(MATERIAL_DRAG_MIME)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onDrop = (event: DragEvent) => {
      const raw = event.dataTransfer?.getData(MATERIAL_DRAG_MIME) || "";
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      assignAt(event.clientX, event.clientY, raw);
    };
    const onPaint = (event: PointerEvent) => {
      const materialId = useMaterialStore.getState().paintMaterialId;
      if (!materialId) return;
      if (assignAt(event.clientX, event.clientY, materialId)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    canvas.addEventListener("dragenter", onDragEnter);
    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop", onDrop);
    canvas.addEventListener("pointerdown", onPaint, true);
    return () => {
      canvas.removeEventListener("dragenter", onDragEnter);
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop", onDrop);
      canvas.removeEventListener("pointerdown", onPaint, true);
    };
  }, []);

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
    // visibility again.
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

    const floorFilter = selectedFloor;
    const apply = (obj: THREE.Object3D) => {
      if (skip(obj)) return;
      const expressId = obj.userData.expressId as number | undefined;
      if (expressId == null) return;
      const isolated = isolatedElementIds;
      const floorId = obj.userData.floorId as string | undefined;
      const floorOk =
        floorFilter == null || !floorId || floorId === floorFilter;
      obj.visible =
        floorOk &&
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

  // Load / sync Werkzeug markup for the active model.
  useEffect(() => {
    const key =
      activeModelId ??
      (activeModelLabel ? `label:${activeModelLabel}` : null);
    void useToolMarkupStore.getState().loadForModel(key);
    void useLayoutDrawingStore
      .getState()
      .loadForProject(key, Boolean(key?.startsWith("empty:")));
  }, [activeModelId, activeModelLabel]);

  useEffect(() => {
    markupLayerRef.current?.setVisible(toolMode);
    const layout = layoutLayerRef.current;
    if (layout) layout.group.visible = toolMode;
  }, [toolMode]);

  useEffect(() => {
    const handleLevelHighlight = (event: Event) => {
      layoutLayerRef.current?.setLevelHighlight(
        Boolean((event as CustomEvent<boolean>).detail),
      );
    };
    window.addEventListener("werkzeug-level-highlight", handleLevelHighlight);
    return () => window.removeEventListener("werkzeug-level-highlight", handleLevelHighlight);
  }, []);

  useEffect(() => {
    const layer = markupLayerRef.current;
    if (!layer) return;
    const unsub = useToolMarkupStore.subscribe((s) => {
      // Don't rebuild from store mid-drag — that resets the mesh to the old pose.
      if (transformDraggingRef.current) return;
      if (suppressTransformReleaseClickRef.current) {
        suppressTransformReleaseClickRef.current = false;
        return;
      }
      if (transformControlsRef.current?.axis) return;
      layer.syncPlacements(s.placements, s.selectedPlacementId);
      layer.syncNotes(s.notes, s.selectedNoteId);
      for (const p of s.placements) {
        const mesh = layer.getMesh(p.id);
        if (!mesh) continue;
        mesh.visible =
          s.markupFloorId == null ||
          p.floorId == null ||
          p.floorId === s.markupFloorId;
      }
    });
    const s = useToolMarkupStore.getState();
    layer.syncPlacements(s.placements, s.selectedPlacementId);
    layer.syncNotes(s.notes, s.selectedNoteId);
    layer.syncMeasurements(s.measurements, s.measureDraft, null);
    return unsub;
  }, [toolMode, activeModelId, activeModelLabel]);

  // Sync layout walls / doors / windows → live 3D.
  useEffect(() => {
    const layer = layoutLayerRef.current;
    if (!layer || !toolMode) return;
    const sync = () => {
      const s = useLayoutDrawingStore.getState();
      const markupFloor = useToolMarkupStore.getState().markupFloorId;
      const activeLevel =
        s.levels.find((l) => l.id === markupFloor) ?? s.levels[0] ?? null;

      const ms = useToolMarkupStore.getState();
      const isPlanView = ms.quadView
        ? ms.quadPresets[ms.quadActiveIndex] === "top"
        : ms.viewPreset === "top";

      if (isPlanView && (s.isEmptyProject || s.armedLayoutTool || s.wallDraw || s.slabDraw || s.walls.length || s.slabs.length)) {
        layer.ensureGround(activeLevel?.elevationMm ?? 0);
      } else {
        layer.hideGround();
      }

      // Top/plan: respect active floor filter. 3D: always show every level.
      const showAllLevels = !isPlanView || markupFloor == null;
      const sel = s.selectedElements || [];
      const selWallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
      if (s.selectedWallId) selWallIds.add(s.selectedWallId);
      const selDoorIds = new Set(sel.filter((e) => e.kind === "door").map((e) => e.id));
      if (s.selectedDoorId) selDoorIds.add(s.selectedDoorId);
      const selWinIds = new Set(sel.filter((e) => e.kind === "window").map((e) => e.id));
      if (s.selectedWindowId) selWinIds.add(s.selectedWindowId);
      const selSlabIds = new Set(sel.filter((e) => e.kind === "slab").map((e) => e.id));
      if (s.selectedSlabId) selSlabIds.add(s.selectedSlabId);
      const selColIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
      const selBeamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));
      const selGridIds = new Set(sel.filter((e) => e.kind === "grid").map((e) => e.id));

      layer.sync(s.levels, s.walls, s.doors, s.windows, s.slabs, {
        activeLevelId: markupFloor,
        selectedWallId: s.selectedWallId,
        selectedDoorId: s.selectedDoorId,
        selectedWindowId: s.selectedWindowId,
        selectedSlabId: s.selectedSlabId,
        selectedWallIds: selWallIds,
        selectedDoorIds: selDoorIds,
        selectedWindowIds: selWinIds,
        selectedSlabIds: selSlabIds,
        showAllLevels,
        planMode: isPlanView,
      });
      layer.syncColumns(s.columns || [], s.levels, {
        activeLevelId: markupFloor,
        selectedColumnIds: selColIds,
        showAllLevels,
      });
      layer.syncBeams(s.beams || [], s.levels, {
        activeLevelId: markupFloor,
        selectedBeamIds: selBeamIds,
        showAllLevels,
      });
      layer.syncGridLines(s.gridLines || [], s.levels, {
        activeLevelId: markupFloor,
        selectedGridLineIds: selGridIds,
        showAllLevels,
        fallbackElevMm: activeLevel?.elevationMm ?? 0,
      });
      layer.syncUnderlays(isPlanView ? s.underlays : [], s.levels, {
        activeLevelId: markupFloor,
        showAllLevels,
        selectedUnderlayId: s.selectedUnderlayId,
        calibratePoints:
          s.calibrateUnderlayId != null ? s.calibratePoints : [],
        floorElevationMm: Object.fromEntries(
          useAppStore
            .getState()
            .floors.map((f) => [f.id, Math.round(f.elevation * 1000)]),
        ),
      });
      layer.syncLevelSlabs(s.levels, s.walls, isPlanView);
      if (helpersRef.current) {
        helpersRef.current.visible = !isPlanView;
      }
      if (s.wallDraw) {
        const lvl =
          s.levels.find((l) => l.id === s.wallDraw!.levelId) ?? activeLevel;
        const top = s.levels.find((l) => l.id === s.draftWallTopLevelId);
        const previewHeightMm = top && lvl && top.elevationMm > lvl.elevationMm
          ? top.elevationMm - lvl.elevationMm
          : s.draftWallHeightMm;
        layer.setWallPreview(
          s.wallDraw.points,
          s.wallDraw.cursor,
          lvl?.elevationMm ?? 0,
          s.wallDraw.snapType ?? null,
          s.draftWallThicknessMm,
          previewHeightMm,
        );
      } else {
        layer.setWallPreview([], null, 0);
      }
      if (s.slabDraw?.start && s.slabDraw.cursor) {
        const lvl =
          s.levels.find((l) => l.id === s.slabDraw!.levelId) ?? activeLevel;
        const elev = lvl?.elevationMm ?? 0;
        const offset =
          s.slabDraw.kind === "roof"
            ? (lvl?.heightMm ?? 3000)
            : 0;
        layer.setSlabPreview(
          s.slabDraw.start,
          s.slabDraw.cursor,
          elev + offset,
          s.draftSlabThicknessMm,
          s.slabDraw.kind,
        );
      } else {
        layer.setSlabPreview(null, null, 0, 200, "floor");
      }
      // Sync Lines sketch layer
      layer.syncSketch(
        s.sketchLines || [],
        s.sketchDraw,
        s.gapHighlightPoints || [],
        s.levels || [],
        s.selectedSketchLineId,
        activeLevel?.elevationMm ?? 0,
        s.sketchTargetKind,
      );
      if (
        s.armedLayoutTool !== "column" &&
        s.armedLayoutTool !== "beam" &&
        s.armedLayoutTool !== "grid"
      ) {
        layer.setStructuralPreview(null, null, null, 0, 3000, 300, 300);
      }
      const tp = s.tracePreview;
      const cand = tp?.candidates[tp.index] ?? null;
      if (cand && !s.wallDraw) {
        const lvl =
          s.levels.find((l) => l.id === tp!.levelId) ?? activeLevel;
        layer.setTracePreview(
          cand,
          lvl?.elevationMm ?? 0,
          lvl?.heightMm ?? 3000,
        );
      } else {
        layer.setTracePreview(null, 0, 3000);
      }
    };
    const unsubLayout = useLayoutDrawingStore.subscribe(sync);
    const unsubMarkup = useToolMarkupStore.subscribe((s, prev) => {
      if (
        s.viewPreset !== prev.viewPreset ||
        s.quadView !== prev.quadView ||
        s.quadActiveIndex !== prev.quadActiveIndex ||
        s.quadPresets !== prev.quadPresets
      ) {
        sync();
      }
    });
    sync();
    return () => {
      unsubLayout();
      unsubMarkup();
    };
  }, [toolMode, activeModelId, activeModelLabel, markupFloorIdForLayout]);

  const walkthroughMode = useToolMarkupStore((s) => s.walkthroughMode);
  const setWalkthroughMode = useToolMarkupStore((s) => s.setWalkthroughMode);

  useEffect(() => {
    const wt = walkthroughRef.current;
    const controls = controlsRef.current;
    if (!wt) return;

    if (walkthroughMode) {
      if (controls) controls.enabled = false;
      const floorId = useToolMarkupStore.getState().markupFloorId;
      const floor = useAppStore.getState().floors.find((f) => f.id === floorId);
      const elevM = floor?.elevation ?? 0;
      wt.activate(elevM);
    } else {
      wt.deactivate();
      if (controls) controls.enabled = true;
    }
  }, [walkthroughMode]);

  useEffect(() => {
    if (!toolMode) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "Tab") {
        const layout = useLayoutDrawingStore.getState();
        if (
          !typing &&
          layout.tracePreview &&
          layout.tracePreview.candidates.length > 1 &&
          (layout.armedLayoutTool === "wall" ||
            layout.armedLayoutTool === "door" ||
            layout.armedLayoutTool === "window")
        ) {
          e.preventDefault();
          layout.cycleTraceCandidate(e.shiftKey ? -1 : 1);
          return;
        }
      }
      if (e.key === "Escape") {
        if (wallEditDragRef.current) {
          wallEditDragRef.current = null;
          suspendWerkzeugHistory(false);
          useToolMarkupStore.getState().setDragSnapHint(null);
          const controls = controlsRef.current;
          if (controls && !useAppStore.getState().viewerContextMenuOpen) {
            controls.enabled = true;
          }
        }
        const ms = useToolMarkupStore.getState();
        if (ms.measureMode) {
          if (ms.measureDraft) {
            ms.clearMeasureDraft();
            return;
          }
          if (ms.measurements.length) {
            ms.clearMeasurements();
            return;
          }
          ms.setMeasureMode(false);
          return;
        }
        useToolMarkupStore.getState().setArmedTool(null);
        useToolMarkupStore.getState().cancelPendingNote();
        useToolMarkupStore.getState().clearSelection();
        useToolMarkupStore.getState().setCubeDraw(null);
        const layout = useLayoutDrawingStore.getState();
        if (layout.calibrateUnderlayId) layout.cancelCalibrateUnderlay();
        if (layout.tracePreview) layout.clearTracePreview();
        if (layout.wallDraw) layout.finishWallDraw();
        else if (layout.slabDraw) layout.cancelSlabDraw();
        else layout.setArmedLayoutTool(null);
        layout.clearLayoutSelection();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        const layout = useLayoutDrawingStore.getState();
        if (layout.selectedWallId) {
          e.preventDefault();
          void layout.deleteWall(layout.selectedWallId);
          return;
        }
        if (layout.selectedDoorId) {
          e.preventDefault();
          void layout.deleteDoor(layout.selectedDoorId);
          return;
        }
        if (layout.selectedWindowId) {
          e.preventDefault();
          void layout.deleteWindow(layout.selectedWindowId);
          return;
        }
        if (layout.selectedSlabId) {
          e.preventDefault();
          void layout.deleteSlab(layout.selectedSlabId);
          return;
        }
        if (layout.selectedElements.length) {
          e.preventDefault();
          void layout.deleteSelected();
          return;
        }
        const s = useToolMarkupStore.getState();
        if (s.selectedPlacementId) {
          e.preventDefault();
          void s.deletePlacement(s.selectedPlacementId);
          return;
        }
        if (s.selectedNoteId) {
          e.preventDefault();
          void s.deleteNote(s.selectedNoteId);
          return;
        }
      }
      if (
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        const layout = useLayoutDrawingStore.getState();
        const wall = layout.walls.find((w) => w.id === layout.selectedWallId);
        if (wall) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : e.altKey ? 1000 : 100;
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          void layout.updateWall(wall.id, wallTranslated(wall, dx, dy));
          return;
        }
        if (layout.selectedElements.length) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : e.altKey ? 1000 : 100;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          void layout.moveSelected(dx, dy);
          return;
        }
      }
      if (e.key === "i" || e.key === "I") {
        if (e.altKey || e.shiftKey) {
          e.preventDefault();
          useAppStore.getState().resetElementVisibility();
          return;
        }
        const id = useAppStore.getState().toolSelectedExpressId;
        if (id != null) {
          e.preventDefault();
          useAppStore.getState().isolateElements([id]);
          useAppStore.getState().requestToolReveal(id);
        }
      }
      if (e.key === "g" || e.key === "G") {
        useToolMarkupStore.getState().setTransformMode("translate");
      }
      if (e.key === "r" || e.key === "R") {
        useToolMarkupStore.getState().setTransformMode("rotate");
      }
      if (e.key === "t" || e.key === "T") {
        useToolMarkupStore.getState().setTransformMode("scale");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolMode]);

  // Attach TransformControls to the selected markup mesh.
  useEffect(() => {
    const tc = transformControlsRef.current;
    const layer = markupLayerRef.current;
    if (!tc || !layer) return;

    const sync = () => {
      const s = useToolMarkupStore.getState();
      const helper = tc.getHelper();
      if (!toolMode || !s.selectedPlacementId) {
        tc.detach();
        helper.visible = false;
        tc.enabled = false;
        return;
      }
      const mesh = layer.getMesh(s.selectedPlacementId);
      if (!mesh) {
        tc.detach();
        helper.visible = false;
        tc.enabled = false;
        return;
      }
      tc.attach(mesh);
      tc.setMode(s.transformMode);
      helper.visible = true;
      tc.enabled = true;
    };

    sync();
    const unsub = useToolMarkupStore.subscribe(sync);
    return () => {
      unsub();
      tc.detach();
      tc.getHelper().visible = false;
      tc.enabled = false;
    };
  }, [toolMode, activeModelId]);

  // Persist transform after gizmo drag; optional face snap on translate.
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    persistGizmoRef.current = () => {
      const obj = tc.object as THREE.Object3D | undefined;
      if (!obj?.userData.markupId) return;
      const id = obj.userData.markupId as string;
      const store = useToolMarkupStore.getState();
      const current = store.placements.find((p) => p.id === id);
      if (!current) return;

      let posX = obj.position.x;
      let posY = obj.position.y;
      let posZ = obj.position.z;
      const rotX = obj.rotation.x;
      const rotY = obj.rotation.y;
      const rotZ = obj.rotation.z;

      let sizeX = current.sizeX;
      let sizeY = current.sizeY;
      let sizeZ = current.sizeZ;
      if (store.transformMode === "scale") {
        sizeX = Math.max(0.05, current.sizeX * obj.scale.x);
        sizeY = Math.max(0.05, current.sizeY * obj.scale.y);
        sizeZ = Math.max(0.05, current.sizeZ * obj.scale.z);
        obj.scale.set(1, 1, 1);
      }

      // Face snap on release only when SNAP is on — never force Y to floor.
      if (
        store.snapToFaces &&
        store.transformMode === "translate" &&
        shellCloneRef.current
      ) {
        const ray = raycaster.current;
        ray.set(
          new THREE.Vector3(posX, posY + 0.05, posZ),
          new THREE.Vector3(0, -1, 0),
        );
        const roots = [
          shellCloneRef.current,
          markupLayerRef.current?.group,
        ].filter(Boolean) as THREE.Object3D[];
        const surface = pickMarkupSurface(ray, roots);
        if (
          surface &&
          surface.object !== obj &&
          !surface.object.userData?.isMarkupPlacement
        ) {
          // Only snap Y onto nearby surface (within 2m), keep XY from the drag.
          if (Math.abs(surface.point.y - posY) < 2) {
            posY = surface.point.y + surface.normal.y * 0.015;
          }
        }
      }
      if (store.gridSnap && store.transformMode === "translate") {
        const g = applyGridSnap(
          new THREE.Vector3(posX, posY, posZ),
          store.gridSize,
          ["x", "z"],
        );
        posX = g.x;
        posZ = g.z;
        obj.position.set(posX, posY, posZ);
      }

      if (store.transformMode === "translate") {
        const moving = new THREE.Box3().setFromObject(obj);
        const targets: THREE.Box3[] = [];
        shellCloneRef.current?.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || !o.visible) return;
          if (o.userData.isClipCap || o.userData.isClipStencil) return;
          targets.push(new THREE.Box3().setFromObject(o));
        });
        markupLayerRef.current?.group.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || o === obj) return;
          if (!o.userData.isMarkupPlacement) return;
          targets.push(new THREE.Box3().setFromObject(o));
        });
        const snapped = snapToNearbyAabb(moving, targets, 0.12);
        if (snapped) {
          posX = snapped.x;
          posZ = snapped.z;
          obj.position.set(posX, posY, posZ);
        }
      }

      void store.updatePlacement(id, {
        posX,
        posY,
        posZ,
        rotX,
        rotY,
        rotZ,
        sizeX,
        sizeY,
        sizeZ,
      });
    };

    return () => {
      persistGizmoRef.current = () => {};
    };
  }, [toolMode]);

  // Camera presets — orthographic Top/N/S/O/W vs free perspective 3D.
  useEffect(() => {
    const sceneBox = () => {
      const box = new THREE.Box3();
      const shell = shellCloneRef.current;
      if (shell) box.setFromObject(shell);

      const layoutLayer = layoutLayerRef.current;
      if (layoutLayer) {
        layoutLayer.group.traverse((o) => {
          if (o instanceof THREE.Mesh && o.visible) {
            if (
              !o.userData.isLayoutGround &&
              !o.userData.isLayoutUnderlay &&
              !o.userData.isLayoutLevelSlab
            ) {
              box.expandByObject(o);
            }
          }
        });
      }

      if (box.isEmpty() || !Number.isFinite(box.min.x)) {
        box.setFromCenterAndSize(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(52, 6, 52),
        );
      }
      return box;
    };

    const bindActiveSlotToControls = (index: QuadIndex) => {
      const persp = perspectiveCameraRef.current;
      const ortho = orthoCameraRef.current;
      const controls = controlsRef.current;
      const tc = transformControlsRef.current;
      const renderer = rendererRef.current;
      const slot = quadSlotsRef.current[index];
      if (!persp || !ortho || !controls || !renderer || !slot) return;
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const aspect = useToolMarkupStore.getState().quadView
        ? w / 2 / Math.max(1, h / 2)
        : w / Math.max(1, h);
      const cam = applySlotToCameras(slot, aspect || 1, persp, ortho);
      cameraRef.current = cam;
      controls.object = cam;
      const abs = isAbsoluteOrthoPreset(slot.preset);
      controls.enableRotate = !abs;
      controls.screenSpacePanning = abs;
      controls.target.copy(slot.target);
      controls.update();
      orthoFrustumRef.current = slot.frustum;
      activeViewPresetRef.current = slot.preset;
      if (tc) {
        (tc as TransformControls & { camera: THREE.Camera }).camera = cam;
      }
    };

    activateQuadIndexRef.current = (index) => {
      const store = useToolMarkupStore.getState();
      if (store.quadActiveIndex !== index) {
        store.setQuadActiveIndex(index);
      }
      bindActiveSlotToControls(index);
    };

    preparePointerRayRef.current = (clientX, clientY) => {
      const persp = perspectiveCameraRef.current;
      const ortho = orthoCameraRef.current;
      const renderer = rendererRef.current;
      if (!persp || !ortho || !renderer) return cameraRef.current;
      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const store = useToolMarkupStore.getState();
      if (!(useAppStore.getState().toolMode && store.quadView)) {
        pointerNdc.current.x =
          ((clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.current.y =
          -((clientY - rect.top) / rect.height) * 2 + 1;
        return cameraRef.current;
      }
      const index = quadIndexFromClient(clientX, clientY, rect);
      activateQuadIndexRef.current(index);
      ndcInQuad(clientX, clientY, rect, index, pointerNdc.current);
      return cameraRef.current;
    };

    fitAllQuadsToBoxRef.current = (box) => {
      for (const slot of quadSlotsRef.current) {
        fitSlotToBox(slot, box, 0.65);
      }
      const idx = useToolMarkupStore.getState().quadActiveIndex as QuadIndex;
      bindActiveSlotToControls(idx);
      useToolMarkupStore.getState().bumpQuadPoseToken();
    };

    const initQuadSlots = () => {
      const box = sceneBox();
      const presets = useToolMarkupStore.getState().quadPresets;
      const slots = createDefaultQuadSlots(presets);
      for (let i = 0; i < 4; i++) {
        poseSlotFromBox(slots[i], box, presets[i], 1.35);
      }
      quadSlotsRef.current = slots;
      bindActiveSlotToControls(
        useToolMarkupStore.getState().quadActiveIndex as QuadIndex,
      );
    };

    const applyPreset = (preset: string) => {
      const persp = perspectiveCameraRef.current;
      const ortho = orthoCameraRef.current;
      const controls = controlsRef.current;
      const tc = transformControlsRef.current;
      const renderer = rendererRef.current;
      if (!persp || !ortho || !controls || !renderer) return;

      const box = sceneBox();
      const store = useToolMarkupStore.getState();
      if (store.quadView && useAppStore.getState().toolMode) {
        const idx = store.quadActiveIndex as QuadIndex;
        const slot = quadSlotsRef.current[idx];
        if (slot) {
          poseSlotFromBox(
            slot,
            box,
            preset as import("@/lib/toolMarkup").MarkupViewPreset,
            1.35,
          );
          bindActiveSlotToControls(idx);
        }
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 8);
      const dist = span * 1.35;
      const eyeY = center.y + size.y * 0.2;
      const aspect =
        renderer.domElement.clientWidth /
          Math.max(1, renderer.domElement.clientHeight) || 1;

      const useOrtho = preset !== "free";
      activeViewPresetRef.current = preset;

      if (useOrtho) {
        const frustum = Math.max(span * 1.15, 8);
        orthoFrustumRef.current = frustum;
        ortho.left = (-frustum * aspect) / 2;
        ortho.right = (frustum * aspect) / 2;
        ortho.top = frustum / 2;
        ortho.bottom = -frustum / 2;
        ortho.near = 0.1;
        ortho.far = 5000;
        ortho.updateProjectionMatrix();

        if (preset === "top") {
          ortho.position.set(center.x, center.y + dist, center.z + 0.001);
          ortho.up.set(0, 0, -1);
        } else if (preset === "north") {
          ortho.position.set(center.x, eyeY, center.z + dist);
          ortho.up.set(0, 1, 0);
        } else if (preset === "south") {
          ortho.position.set(center.x, eyeY, center.z - dist);
          ortho.up.set(0, 1, 0);
        } else if (preset === "east") {
          ortho.position.set(center.x + dist, eyeY, center.z);
          ortho.up.set(0, 1, 0);
        } else {
          ortho.position.set(center.x - dist, eyeY, center.z);
          ortho.up.set(0, 1, 0);
        }
        ortho.lookAt(center);
        cameraRef.current = ortho;
        controls.object = ortho;
        controls.enableRotate = false;
        controls.screenSpacePanning = true;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        controls.target.copy(center);
        controls.touches = {
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
        controls.mouseButtons = {
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        };
        if (tc) {
          (tc as TransformControls & { camera: THREE.Camera }).camera = ortho;
        }
      } else {
        persp.up.set(0, 1, 0);
        persp.position.set(
          center.x + dist * 0.7,
          center.y + dist * 0.55,
          center.z + dist * 0.7,
        );
        persp.lookAt(center);
        persp.updateProjectionMatrix();
        cameraRef.current = persp;
        controls.object = persp;
        controls.enableRotate = true;
        controls.screenSpacePanning = false;
        controls.target.copy(center);
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
        controls.mouseButtons = {
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        };
        if (tc) {
          (tc as TransformControls & { camera: THREE.Camera }).camera = persp;
        }
      }
      controls.update();
    };

    const unsub = useToolMarkupStore.subscribe((s, prev) => {
      if (!toolMode) return;
      if (s.quadView !== prev.quadView) {
        if (s.quadView) initQuadSlots();
        else applyPreset(s.viewPreset);
        return;
      }
      if (s.quadView && s.quadPoseToken !== prev.quadPoseToken) {
        const box = sceneBox();
        for (let i = 0; i < 4; i++) {
          const slot = quadSlotsRef.current[i];
          if (!slot) continue;
          if (slot.preset !== s.quadPresets[i]) {
            poseSlotFromBox(slot, box, s.quadPresets[i], 1.35);
          }
        }
        bindActiveSlotToControls(s.quadActiveIndex as QuadIndex);
        return;
      }
      if (s.viewPresetToken === prev.viewPresetToken) return;
      applyPreset(s.viewPreset);
    });

    // Apply current preset when entering Werkzeug.
    if (toolMode) {
      const st = useToolMarkupStore.getState();
      if (st.quadView) initQuadSlots();
      else applyPreset(st.viewPreset);
    } else {
      // Leave Werkzeug → restore free orbit perspective.
      useToolMarkupStore.getState().setQuadView(false);
      const persp = perspectiveCameraRef.current;
      const controls = controlsRef.current;
      const tc = transformControlsRef.current;
      if (persp && controls) {
        persp.up.set(0, 1, 0);
        cameraRef.current = persp;
        controls.object = persp;
        controls.enableRotate = true;
        if (tc && "camera" in tc) {
          (tc as TransformControls & { camera: THREE.Camera }).camera = persp;
        }
      }
      activeViewPresetRef.current = "free";
    }

    applyPresetRef.current = applyPreset;

    return () => {
      applyPresetRef.current = null;
      unsub();
    };
  }, [toolMode]);

  // Live element-to-element + distance snap while dragging a markup shape.
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc || !toolMode) return;

    const onChange = () => {
      if (!transformDraggingRef.current) return;
      const store = useToolMarkupStore.getState();
      if (store.transformMode !== "translate") return;
      const obj = tc.object as THREE.Object3D | undefined;
      if (!obj?.userData.markupId) return;

      const moving = new THREE.Box3().setFromObject(obj);
      const targets: THREE.Box3[] = [];
      shellCloneRef.current?.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !o.visible) return;
        if (o.userData.isClipCap || o.userData.isClipStencil) return;
        targets.push(new THREE.Box3().setFromObject(o));
      });
      markupLayerRef.current?.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !o.visible) return;
        if (o === obj || o.userData.isMarkupPreview) return;
        if (!o.userData.isMarkupPlacement) return;
        targets.push(new THREE.Box3().setFromObject(o));
      });

      const snapped = snapToNearbyAabb(moving, targets, 0.1);
      if (snapped) {
        obj.position.x = snapped.x;
        obj.position.z = snapped.z;
      }

      // Nearest planar gap for HUD (mm).
      let bestGap = Infinity;
      const mc = moving.getCenter(new THREE.Vector3());
      for (const t of targets) {
        if (t.isEmpty()) continue;
        const tc2 = t.getCenter(new THREE.Vector3());
        const gapX = Math.min(
          Math.abs(moving.min.x - t.max.x),
          Math.abs(moving.max.x - t.min.x),
        );
        const gapZ = Math.min(
          Math.abs(moving.min.z - t.max.z),
          Math.abs(moving.max.z - t.min.z),
        );
        const gap = Math.min(gapX, gapZ);
        if (gap < bestGap && gap < 2) bestGap = gap;
        void tc2;
        void mc;
      }
      if (bestGap < Infinity) {
        store.setDragSnapHint({
          text: `${Math.round(toMm(bestGap))} mm`,
        });
      } else {
        store.setDragSnapHint(null);
      }
    };

    const onDrag = (event: { value?: boolean }) => {
      const dragging = Boolean(
        (event as unknown as { value: boolean }).value,
      );
      if (!dragging) {
        useToolMarkupStore.getState().setDragSnapHint(null);
      }
    };

    tc.addEventListener("objectChange", onChange);
    tc.addEventListener("dragging-changed", onDrag as never);
    return () => {
      tc.removeEventListener("objectChange", onChange);
      tc.removeEventListener("dragging-changed", onDrag as never);
      useToolMarkupStore.getState().setDragSnapHint(null);
    };
  }, [toolMode]);

  // Werkzeug: frame the element picked in the structure tree.
  useEffect(() => {
    if (!toolMode || toolRevealToken === 0 || toolSelectedExpressId == null) {
      return;
    }
    const camera = perspectiveCameraRef.current;
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

  // Werkzeug: Pin note command — attach notice to current IFC/shape selection.
  useEffect(() => {
    if (!toolMode) return;
    if (notePinToken === 0 || notePinToken === lastNotePinTokenRef.current) {
      return;
    }
    lastNotePinTokenRef.current = notePinToken;

    const markup = useToolMarkupStore.getState();
    const placementId = markup.selectedPlacementId;
    const expressId = useAppStore.getState().toolSelectedExpressId;
    const layer = markupLayerRef.current;

    if (placementId && layer) {
      const mesh = layer.getMesh(placementId);
      if (mesh) {
        const p = new THREE.Vector3();
        mesh.getWorldPosition(p);
        const place = markup.placements.find((x) => x.id === placementId);
        markup.beginNoteAt(
          { x: p.x, y: p.y + 0.12, z: p.z },
          {
            placementId,
            expressId: null,
            elementName: place?.label || place?.type || `Shape`,
            floorId: place?.floorId ?? markup.markupFloorId,
          },
        );
      }
      return;
    }

    if (expressId == null) {
      markup.setArmedTool("note");
      markup.setNotePlaceHint("markupNotePinHint");
      return;
    }

    const box = new THREE.Box3();
    let found = false;
    const consider = (obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
      if (obj.userData.expressId !== expressId) return;
      const b = new THREE.Box3().setFromObject(obj);
      if (b.isEmpty()) return;
      box.union(b);
      found = true;
    };
    shellCloneRef.current?.traverse(consider);
    overlaysRef.current?.traverse(consider);
    if (!found) {
      markup.setArmedTool("note");
      markup.setNotePlaceHint("markupNotePinHint");
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const el = useAppStore.getState().selectedElement;
    markup.beginNoteAt(
      { x: center.x, y: box.max.y + 0.08, z: center.z },
      {
        expressId,
        placementId: null,
        elementName: el?.name ?? `Element #${expressId}`,
        floorId: el?.floorId ?? markup.markupFloorId,
      },
    );
  }, [notePinToken, toolMode]);

  // Basic 3D: zoom to visible (isolated) floor when floor selection changes.
  useEffect(() => {
    if (isPresentationView || floorFocusToken === 0) return;
    const id = requestAnimationFrame(() => fitToVisible(850));
    return () => cancelAnimationFrame(id);
     
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
      const inTool = useAppStore.getState().toolMode;
      const toolExpress = useAppStore.getState().toolSelectedExpressId;
      // In Werkzeug, tree/3D pick sets toolSelectedExpressId sync — prefer it
      // over a still-loading or stale selectedElement.expressId.
      const selectedExpress = inTool
        ? (toolExpress ?? selectedEl?.expressId ?? null)
        : (selectedEl?.expressId ?? null);
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
          : isSel
            ? 1.0
            : zoneFocus && !inZone
              ? 0.12
              : baseOpacity;

        applySurfaceOpacity(mat, nextOpacity, true);

        const baseHex =
          (mesh.userData.colorHex as string | undefined) ??
          (mesh.userData.baseColorHex as string | undefined) ??
          `#${mat.color.getHexString()}`;

        // Keep room colour untouched for both selected and non-selected rooms.
        // Only add a thermal-palette outline around the selected room.
        if (lightMode) {
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
          const colors = getHighlightColors(
            room,
            dataViewMode,
            activeColorPalette,
            heizlastRange,
            kuhllastRange,
            luftungRange,
            activeTemperatureRange,
            customLegendColors,
          );
          attachThermalSelectionOutline(mesh, colors);
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
        let mat = obj.material as THREE.MeshStandardMaterial;
        // IFC meshes often share materials — clone so one selection doesn't
        // tint / clear emissive on every wall that reuses the same mat.
        if (!mat.userData.selectionClone) {
          mat = mat.clone();
          mat.userData.selectionClone = true;
          if (!mat.userData.baseColorHex) {
            mat.userData.baseColorHex = `#${mat.color.getHexString()}`;
          }
          obj.material = mat;
        }
        const isSel =
          selectedExpress != null &&
          obj.userData.expressId === selectedExpress;
        const baseHex =
          (obj.userData.colorHex as string | undefined) ??
          (mat.userData.baseColorHex as string | undefined) ??
          `#${mat.color.getHexString()}`;
        // Werkzeug: light amber emissive + outline even without a room selection.
        if (isSel) {
          mat.color.set(baseHex);
          if (inTool) {
            attachAlignedOutline(obj, 0xf59e0b, 1.04, 0.9);
            mat.color.lerp(new THREE.Color(0xfbbf24), 0.18);
            mat.emissive.setHex(0xfbbf24);
            mat.emissiveIntensity = 0.55;
          } else {
            attachColorOutline(obj, baseHex);
            mat.emissive.setHex(0xf59e0b);
            mat.emissiveIntensity = 0.25;
          }
          obj.renderOrder = 8;
        } else {
          mat.color.set(baseHex);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          obj.renderOrder = 0;
        }
        mat.needsUpdate = true;
      });
    };

    applySelectionHighlightRef.current = apply;
    apply();
  }, [
    selectedRoomId,
    selectedElement,
    toolSelectedExpressId,
    toolMode,
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
    let marqueeActive = false;
    let marqueeStartX = 0;
    let marqueeStartY = 0;
    let draftBeamStart: { xMm: number; yMm: number } | null = null;
    let draftGridStart: { xMm: number; yMm: number } | null = null;
    /** Selected wall / unlocked underlay — promote to move-drag after threshold. */
    let pendingWallMoveId: string | null = null;
    let pendingUnderlayMoveId: string | null = null;

    const endWallEditDrag = () => {
      const drag = wallEditDragRef.current;
      if (!drag) return;
      wallEditDragRef.current = null;
      const controls = controlsRef.current;
      if (controls && !useAppStore.getState().viewerContextMenuOpen) {
        controls.enabled = true;
      }
      if (drag.mode === "move" && drag.wallId) {
        const layout = useLayoutDrawingStore.getState();
        const wall = layout.walls.find((w) => w.id === drag.wallId);
        const ms = useToolMarkupStore.getState();
        if (wall && ms.snapToFaces) {
          const nearest = nearestParallelFaceGapMm(wall, layout.walls);
          if (nearest) {
            const snapped = Math.round(nearest.faceGapMm / 50) * 50;
            if (Math.abs(snapped - nearest.faceGapMm) <= 40) {
              const other = layout.walls.find((w) => w.id === nearest.otherId);
              if (other) {
                void layout.updateWall(
                  wall.id,
                  wallWithFaceGapTo(wall, other, snapped),
                );
              }
            }
          }
        }
      }
      suspendWerkzeugHistory(false);
      useToolMarkupStore.getState().setDragSnapHint(null);
    };

    const planMmFromPointer = (
      clientX: number,
      clientY: number,
    ): { xMm: number; yMm: number } | null => {
      const cam = preparePointerRayRef.current(clientX, clientY);
      if (!cam) return null;
      raycaster.current.setFromCamera(pointerNdc.current, cam);
      const layout = useLayoutDrawingStore.getState();
      const markupFloor = useToolMarkupStore.getState().markupFloorId;
      const level =
        layout.levels.find((l) => l.id === markupFloor) ??
        layout.levels[0] ??
        null;
      const floorElev =
        markupFloor != null
          ? useAppStore
              .getState()
              .floors.find((f) => f.id === markupFloor)?.elevation
          : undefined;
      const elevMm =
        level?.elevationMm ??
        (floorElev != null ? Math.round(floorElev * 1000) : 0);
      const y = fromMm(elevMm);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
      const pt = new THREE.Vector3();
      if (!raycaster.current.ray.intersectPlane(plane, pt)) {
        const lh = layoutLayerRef.current?.pickLayout(raycaster.current);
        if (lh?.kind === "ground" || lh?.kind === "underlay") pt.copy(lh.point);
        else return null;
      }
      let p = pt;
      const ms = useToolMarkupStore.getState();
      if (ms.gridSnap) p = applyGridSnap(p, ms.gridSize, ["x", "z"]);
      return { xMm: Math.round(toMm(p.x)), yMm: Math.round(toMm(p.z)) };
    };

    const pickHit = (clientX: number, clientY: number) => {
      const camera = preparePointerRayRef.current(clientX, clientY);
      if (!camera) return null;

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
        // Drop stale inspector payload until getElementDetails resolves.
        setSelectedElement(null);
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
      if (inTool) {
        // Allow picking any IFC element in Werkzeug; only rooms respect floor filter.
        if (roomId && !isRoomPickAllowed(roomId, resolvedFloor)) {
          return;
        }
      } else if (!isRoomPickAllowed(roomId, resolvedFloor)) {
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
            if (
              !inTool &&
              !isRoomPickAllowed(detailRoomId, detailFloor)
            ) {
              return;
            }
            if (
              inTool &&
              detailRoomId &&
              !isRoomPickAllowed(detailRoomId, detailFloor)
            ) {
              return;
            }

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
      if ((e.buttons & 1) === 1 && (!suppressNextClick || marqueeActive)) {
        if (marqueeActive) {
          const dx = e.clientX - marqueeStartX;
          const dy = e.clientY - marqueeStartY;
          if (dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
            const controls = controlsRef.current;
            if (controls) controls.enabled = false;
            useLayoutDrawingStore.getState().setMarqueeBox({
              startX: marqueeStartX,
              startY: marqueeStartY,
              currentX: e.clientX,
              currentY: e.clientY,
              isCrossing: e.clientX < marqueeStartX,
            });
            suppressNextClick = true;
          }
        }
        const dx = e.clientX - pointerDownX;
        const dy = e.clientY - pointerDownY;
        if (dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
          suppressNextClick = true;
          if (
            !wallEditDragRef.current &&
            useAppStore.getState().toolMode
          ) {
            const plan = planMmFromPointer(e.clientX, e.clientY);
            if (plan && pendingWallMoveId) {
              pushWerkzeugHistory();
              suspendWerkzeugHistory(true);
              wallEditDragRef.current = {
                mode: "move",
                wallId: pendingWallMoveId,
                lastXmm: plan.xMm,
                lastYmm: plan.yMm,
              };
              const controls = controlsRef.current;
              if (controls) controls.enabled = false;
              pendingWallMoveId = null;
            } else if (plan && pendingUnderlayMoveId) {
              pushWerkzeugHistory();
              suspendWerkzeugHistory(true);
              wallEditDragRef.current = {
                mode: "underlay",
                underlayId: pendingUnderlayMoveId,
                lastXmm: plan.xMm,
                lastYmm: plan.yMm,
              };
              const controls = controlsRef.current;
              if (controls) controls.enabled = false;
              pendingUnderlayMoveId = null;
            }
          }
        }
      }

      const wallDrag = wallEditDragRef.current;
      if (wallDrag && (e.buttons & 1) === 1) {
        const plan = planMmFromPointer(e.clientX, e.clientY);
        if (plan) {
          const layout = useLayoutDrawingStore.getState();
          if (wallDrag.mode === "underlay" && wallDrag.underlayId) {
            const u = layout.underlays.find((x) => x.id === wallDrag.underlayId);
            if (u && !u.locked) {
              const dx = plan.xMm - wallDrag.lastXmm;
              const dy = plan.yMm - wallDrag.lastYmm;
              if (dx || dy) {
                void layout.updateUnderlay(u.id, {
                  offsetXmm: Math.round(u.offsetXmm + dx),
                  offsetYmm: Math.round(u.offsetYmm + dy),
                });
                wallEditDragRef.current = {
                  ...wallDrag,
                  lastXmm: plan.xMm,
                  lastYmm: plan.yMm,
                };
                useToolMarkupStore.getState().setDragSnapHint({
                  text: `Plan Δ ${dx} · ${dy} mm`,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }
            }
          } else {
            const wall = layout.walls.find((w) => w.id === wallDrag.wallId);
            if (wall) {
              if (wallDrag.mode === "endpoint" && wallDrag.end) {
                const fixed = wallDrag.end === "start"
                  ? { xMm: wall.endXmm, yMm: wall.endYmm }
                  : { xMm: wall.startXmm, yMm: wall.startYmm };
                const objectSnap = snapPlanPointToWalls(
                  plan,
                  layout.walls.filter((candidate) => candidate.id !== wall.id),
                  wall.levelId,
                  140,
                  layout.planSnapModes,
                  fixed,
                );
                const polarSnap = snapWallEndpointMm(fixed, plan);
                const endpoint = objectSnap.type ? objectSnap.point : polarSnap.point;
                const patch =
                  wallDrag.end === "start"
                    ? { startXmm: endpoint.xMm, startYmm: endpoint.yMm }
                    : { endXmm: endpoint.xMm, endYmm: endpoint.yMm };
                void layout.updateWall(wall.id, patch);
                const sx = patch.startXmm ?? wall.startXmm;
                const sy = patch.startYmm ?? wall.startYmm;
                const ex = patch.endXmm ?? wall.endXmm;
                const ey = patch.endYmm ?? wall.endYmm;
                const len = Math.round(Math.hypot(ex - sx, ey - sy));
                useToolMarkupStore.getState().setDragSnapHint({
                  text: `${len} mm${objectSnap.type ? ` · ${objectSnap.type}` : polarSnap.snapped ? " · polar" : ""}`,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              } else if (wallDrag.mode === "move") {
                const dx = plan.xMm - wallDrag.lastXmm;
                const dy = plan.yMm - wallDrag.lastYmm;
                if (dx || dy) {
                  void layout.updateWall(wall.id, wallTranslated(wall, dx, dy));
                  wallEditDragRef.current = {
                    ...wallDrag,
                    lastXmm: plan.xMm,
                    lastYmm: plan.yMm,
                  };
                  useToolMarkupStore.getState().setDragSnapHint({
                    text: `Δ ${dx} · ${dy} mm`,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                }
              }
            }
          }
        }
        canvas.style.cursor = "grabbing";
        return;
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

      // Live cube footprint / note snap indicator while a tool is armed.
      if (useAppStore.getState().toolMode) {
        preparePointerRayRef.current(e.clientX, e.clientY);
        const layoutStore = useLayoutDrawingStore.getState();
        const layoutLayer = layoutLayerRef.current;
        const cam = cameraRef.current;
        if (layoutStore.wallDraw && cam && layoutLayer) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const hit = layoutLayer.pickLayout(raycaster.current);
          let pt: THREE.Vector3 | null =
            hit?.kind === "ground" || hit?.kind === "underlay"
              ? hit.point
              : null;
          if (!pt) {
            const roots: THREE.Object3D[] = [layoutLayer.group];
            if (shellCloneRef.current) roots.push(shellCloneRef.current);
            const surface = pickMarkupSurface(raycaster.current, roots);
            pt = surface?.point ?? null;
          }
          if (pt) {
            const ms = useToolMarkupStore.getState();
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "z"]);
            layoutStore.updateWallCursor({
              xMm: toMm(pt.x),
              yMm: toMm(pt.z),
            });
            const after = useLayoutDrawingStore.getState().wallDraw;
            if (after?.lengthMm != null) {
              const parts = [`${Math.round(after.lengthMm)} mm`];
              if (after.angleDeg != null) {
                parts.push(
                  `${after.angleDeg}°${after.angleSnapped ? " ✦" : ""}`,
                );
              }
              ms.setDragSnapHint({
                text: parts.join(" · "),
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }
          }
          useToolMarkupStore.getState().setSceneHoverTip(null);
          canvas.style.cursor = "crosshair";
          return;
        }

        if (layoutStore.sketchDraw && cam && layoutLayer) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const hit = layoutLayer.pickLayout(raycaster.current);
          let pt: THREE.Vector3 | null =
            hit?.kind === "ground" || hit?.kind === "underlay"
              ? hit.point
              : null;
          if (!pt) {
            const roots: THREE.Object3D[] = [layoutLayer.group];
            if (shellCloneRef.current) roots.push(shellCloneRef.current);
            const surface = pickMarkupSurface(raycaster.current, roots);
            pt = surface?.point ?? null;
          }
          if (!pt) {
            const ms = useToolMarkupStore.getState();
            const activeLvl =
              layoutStore.levels.find((l) => l.id === ms.markupFloorId) ??
              layoutStore.levels[0];
            const levelElevMm = activeLvl?.elevationMm ?? 0;
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
            const targetPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
              pt = targetPt;
            }
          }
          if (pt) {
            const ms = useToolMarkupStore.getState();
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "z"]);
            layoutStore.updateSketchLineCursor({
              xMm: toMm(pt.x),
              yMm: toMm(pt.z),
            });
            const after = useLayoutDrawingStore.getState().sketchDraw;
            if (after?.lengthMm != null) {
              const parts = [`${Math.round(after.lengthMm)} mm`];
              if (after.angleDeg != null) {
                parts.push(
                  `${after.angleDeg}°${after.angleSnapped ? " ✦" : ""}`,
                );
              }
              ms.setDragSnapHint({
                text: parts.join(" · "),
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }
          }
          useToolMarkupStore.getState().setSceneHoverTip(null);
          canvas.style.cursor = "crosshair";
          return;
        }

        if (
          (layoutStore.armedLayoutTool === "column" ||
            layoutStore.armedLayoutTool === "beam" ||
            layoutStore.armedLayoutTool === "grid") &&
          cam &&
          layoutLayer
        ) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const hit = layoutLayer.pickLayout(raycaster.current);
          let pt: THREE.Vector3 | null =
            hit?.kind === "ground" || hit?.kind === "underlay" ? hit.point : null;
          if (!pt) {
            const roots: THREE.Object3D[] = [layoutLayer.group];
            if (shellCloneRef.current) roots.push(shellCloneRef.current);
            pt = pickMarkupSurface(raycaster.current, roots)?.point ?? null;
          }
          const ms = useToolMarkupStore.getState();
          const level = layoutStore.levels.find((l) => l.id === ms.markupFloorId) ?? layoutStore.levels[0];
          if (!pt) {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(level?.elevationMm ?? 0));
            const targetPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(plane, targetPt)) pt = targetPt;
          }
          if (pt) {
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "z"]);
            const cursor = { xMm: toMm(pt.x), yMm: toMm(pt.z) };
            const kind = layoutStore.armedLayoutTool;
            layoutLayer.setStructuralPreview(
              kind,
              cursor,
              kind === "beam" ? draftBeamStart : kind === "grid" ? draftGridStart : null,
              level?.elevationMm ?? 0,
              level?.heightMm ?? 3000,
              kind === "column" ? layoutStore.draftColumnWidthMm : layoutStore.draftBeamWidthMm,
              kind === "column" ? layoutStore.draftColumnDepthMm : layoutStore.draftBeamDepthMm,
            );
            const start = kind === "beam" ? draftBeamStart : kind === "grid" ? draftGridStart : null;
            ms.setDragSnapHint({
              text: start ? `${Math.round(Math.hypot(cursor.xMm - start.xMm, cursor.yMm - start.yMm))} mm · click to place` : kind === "column" ? "Click to place column" : "Click first point",
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }
          ms.setSceneHoverTip(null);
          canvas.style.cursor = "crosshair";
          return;
        }

        // Tier 2: hover auto-trace preview for wall / door / window
        if (
          (layoutStore.armedLayoutTool === "wall" ||
            layoutStore.armedLayoutTool === "door" ||
            layoutStore.armedLayoutTool === "window") &&
          !layoutStore.wallDraw &&
          cam &&
          layoutLayer
        ) {
          const camRay =
            preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const hit = layoutLayer.pickLayout(raycaster.current);
          let pt: THREE.Vector3 | null =
            hit?.kind === "ground" || hit?.kind === "underlay"
              ? hit.point
              : null;
          if (!pt) {
            const roots: THREE.Object3D[] = [layoutLayer.group];
            if (shellCloneRef.current) roots.push(shellCloneRef.current);
            const surface = pickMarkupSurface(raycaster.current, roots);
            pt = surface?.point ?? null;
          }
          // Plane intersect fallback so hover works even without ground mesh
          if (!pt && camRay) {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const activeLevel =
              layoutStore.levels.find(
                (l) =>
                  l.id ===
                  (useToolMarkupStore.getState().markupFloorId ??
                    layoutStore.levels[0]?.id),
              ) ?? layoutStore.levels[0];
            if (activeLevel) {
              plane.constant = -fromMm(activeLevel.elevationMm);
            }
            const hitPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(plane, hitPt)) {
              pt = hitPt;
            }
          }
          if (pt) {
            const ms = useToolMarkupStore.getState();
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "z"]);
            const plan = { xMm: toMm(pt.x), yMm: toMm(pt.z) };
            let levelId =
              ms.markupFloorId ?? layoutStore.levels[0]?.id ?? null;
            let underlayId: string | null =
              hit?.kind === "underlay" ? hit.id : null;
            if (underlayId) {
              const u = layoutStore.underlays.find((x) => x.id === underlayId);
              if (u) levelId = u.levelId;
            } else if (!levelId && layoutStore.underlays[0]) {
              levelId = layoutStore.underlays[0].levelId;
              underlayId = layoutStore.underlays[0].id;
            }
            const tool = layoutStore.armedLayoutTool;
            if (
              levelId &&
              (tool === "wall" || tool === "door" || tool === "window")
            ) {
              if (traceHoverTimerRef.current) {
                clearTimeout(traceHoverTimerRef.current);
              }
              useToolMarkupStore.getState().setDragSnapHint({
                text: "…",
                clientX: e.clientX,
                clientY: e.clientY,
              });
              const seq = ++traceHoverSeqRef.current;
              const lvl = levelId;
              const uid = underlayId;
              traceHoverTimerRef.current = setTimeout(() => {
                void useLayoutDrawingStore
                  .getState()
                  .refreshTracePreview(lvl, tool, plan, uid)
                  .then(() => {
                    if (seq !== traceHoverSeqRef.current) return;
                    const tp = useLayoutDrawingStore.getState().tracePreview;
                    const cand = tp?.candidates[tp.index];
                    if (cand) {
                      const n = tp!.candidates.length;
                      const conf = cand.confidence >= 0.55 ? "✦" : "·";
                      const method =
                        cand.method === "arc"
                          ? "arc"
                          : cand.method === "gap"
                            ? "gap"
                            : cand.method === "window-gap"
                              ? "win"
                              : "";
                      useToolMarkupStore.getState().setDragSnapHint({
                        text: `${cand.kind}${method ? `/${method}` : ""} ${Math.round(cand.widthMm ?? cand.thicknessMm)}mm ${conf}  Tab ${tp!.index + 1}/${n}`,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      });
                    } else {
                      useToolMarkupStore.getState().setDragSnapHint({
                        text:
                          tool === "wall"
                            ? "no match — draw manually"
                            : "need existing wall nearby",
                        clientX: e.clientX,
                        clientY: e.clientY,
                      });
                    }
                  });
              }, 80);
            }
          }
          canvas.style.cursor = "crosshair";
          useToolMarkupStore.getState().setSceneHoverTip(null);
          return;
        }

        if (
          (layoutStore.slabDraw ||
            layoutStore.armedLayoutTool === "floor" ||
            layoutStore.armedLayoutTool === "roof") &&
          cam &&
          layoutLayer
        ) {
          const camRay =
            preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const hit = layoutLayer.pickLayout(raycaster.current);
          let pt: THREE.Vector3 | null =
            hit?.kind === "ground" || hit?.kind === "underlay"
              ? hit.point
              : null;
          if (!pt) {
            const roots: THREE.Object3D[] = [layoutLayer.group];
            if (shellCloneRef.current) roots.push(shellCloneRef.current);
            const surface = pickMarkupSurface(raycaster.current, roots);
            pt = surface?.point ?? null;
          }
          if (!pt) {
            const ms = useToolMarkupStore.getState();
            const activeLvl =
              layoutStore.levels.find((l) => l.id === ms.markupFloorId) ??
              layoutStore.levels[0];
            const levelElevMm = activeLvl?.elevationMm ?? 0;
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
            const targetPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
              pt = targetPt;
            }
          }
          if (pt) {
            const ms = useToolMarkupStore.getState();
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "z"]);
            const plan = { xMm: toMm(pt.x), yMm: toMm(pt.z) };
            if (layoutStore.slabDraw) {
              layoutStore.updateSlabCursor(plan);
              const draw = useLayoutDrawingStore.getState().slabDraw;
              if (draw?.start && draw.cursor) {
                const w = Math.abs(draw.cursor.xMm - draw.start.xMm);
                const d = Math.abs(draw.cursor.yMm - draw.start.yMm);
                ms.setDragSnapHint({
                  text: `${Math.round(w)} × ${Math.round(d)} mm`,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }
            }
          }
          useToolMarkupStore.getState().setSceneHoverTip(null);
          canvas.style.cursor = "crosshair";
          setHoveredRoom(null);
          return;
        }

        // Door / window armed — show offset along wall under cursor
        if (
          (layoutStore.armedLayoutTool === "door" ||
            layoutStore.armedLayoutTool === "window") &&
          cam &&
          layoutLayer
        ) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const layoutHit = layoutLayer.pickLayout(raycaster.current);
          if (layoutHit?.kind === "wall") {
            const wall = layoutStore.walls.find((w) => w.id === layoutHit.id);
            if (wall) {
              const roots: THREE.Object3D[] = [layoutLayer.group];
              if (shellCloneRef.current) roots.push(shellCloneRef.current);
              const surface = pickMarkupSurface(raycaster.current, roots);
              if (surface) {
                let p = surface.point.clone();
                const ms = useToolMarkupStore.getState();
                if (ms.gridSnap) p = applyGridSnap(p, ms.gridSize, ["x", "z"]);
                const posMm = nearestOffsetOnWallMm(
                  wall,
                  toMm(p.x),
                  toMm(p.z),
                );
                ms.setDragSnapHint({
                  text: `${Math.round(posMm)} mm`,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
              }
            }
            canvas.style.cursor = "crosshair";
          } else {
            useToolMarkupStore.getState().setDragSnapHint(null);
            canvas.style.cursor = "not-allowed";
          }
          setHoveredRoom(null);
          useToolMarkupStore.getState().setSceneHoverTip(null);
          return;
        }

        if (
          layoutStore.armedLayoutTool ||
          useToolMarkupStore.getState().armedTool ||
          useToolMarkupStore.getState().measureMode
        ) {
          canvas.style.cursor = "crosshair";
        }

        // Hover tooltip (debounced lightly via rAF + last text)
        if (cam && !layoutStore.armedLayoutTool) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          let tipText: string | null = null;
          const layoutHit = layoutLayer?.pickLayout(raycaster.current);
          if (layoutHit?.kind === "wall") {
            const wall = layoutStore.walls.find((w) => w.id === layoutHit.id);
            if (wall) tipText = `Wand — ${wall.thicknessMm}mm`;
          } else if (layoutHit?.kind === "door") {
            const door = layoutStore.doors.find((d) => d.id === layoutHit.id);
            if (door) tipText = `Tür — ${door.widthMm}mm`;
          } else if (layoutHit?.kind === "window") {
            const win = layoutStore.windows.find((w) => w.id === layoutHit.id);
            if (win)
              tipText = `Fenster — ${win.widthMm}mm × ${win.heightMm}mm`;
          } else {
            const markup = markupLayerRef.current;
            if (markup) {
              const picked = markup.pickMarkup(raycaster.current);
              if (picked?.kind === "placement") {
                const p = useToolMarkupStore
                  .getState()
                  .placements.find((x) => x.id === picked.id);
                if (p) {
                  tipText = `${p.type} — ${Math.round(toMm(p.sizeX))}×${Math.round(toMm(p.sizeY))}×${Math.round(toMm(p.sizeZ))}mm`;
                }
              }
            }
            if (!tipText) {
              const roomHit = pickHit(e.clientX, e.clientY);
              if (roomHit) {
                const ids = pickIdsFromObject(roomHit.object);
                const el = useAppStore.getState().selectedElement;
                if (ids.expressId != null) {
                  tipText =
                    el?.expressId === ids.expressId && el.name
                      ? `${el.typeName ?? "IFC"} — ${el.name}`
                      : `IFC #${ids.expressId}`;
                } else if (ids.roomId) {
                  const room =
                    rooms.find((r) => r.id === ids.roomId) ??
                    roomsFromStore.find((r) => r.id === ids.roomId);
                  if (room) tipText = room.name || room.id;
                }
              }
            }
          }
          if (tipText) {
            useToolMarkupStore.getState().setSceneHoverTip({
              text: tipText,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          } else {
            useToolMarkupStore.getState().setSceneHoverTip(null);
          }
        }

        const ms = useToolMarkupStore.getState();
        const layer = markupLayerRef.current;
        if (ms.measureMode && cam && layer) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const roots: THREE.Object3D[] = [];
          if (shellCloneRef.current) roots.push(shellCloneRef.current);
          roots.push(layer.group);
          const layoutLayer = layoutLayerRef.current;
          if (layoutLayer) roots.push(layoutLayer.group);
          let surface = pickMarkupSurface(raycaster.current, roots);
          if (surface && ms.snapToFaces) {
            surface = enhanceHitWithVertexSnap(
              surface,
              raycaster.current,
              0.35,
            );
          }
          let pt = surface?.snappedVertex ?? surface?.point ?? null;
          if (!pt && layoutLayer) {
            const lh = layoutLayer.pickLayout(raycaster.current);
            if (lh?.kind === "ground" || lh?.kind === "underlay") {
              pt = lh.point.clone();
            }
          }
          if (pt) {
            if (ms.gridSnap) pt = applyGridSnap(pt, ms.gridSize, ["x", "y", "z"]);
            layer.setSnapIndicator(pt);
            layer.syncMeasurements(
              ms.measurements,
              ms.measureDraft,
              ms.measureDraft
                ? { x: pt.x, y: pt.y, z: pt.z }
                : null,
            );
            canvas.style.cursor = "crosshair";
          } else {
            layer.setSnapIndicator(null);
            layer.syncMeasurements(ms.measurements, ms.measureDraft, null);
            canvas.style.cursor = "default";
          }
          setHoveredRoom(null);
          return;
        }
        if (ms.armedTool && cam && layer) {
          const camRay = preparePointerRayRef.current(e.clientX, e.clientY) ?? cam;
          if (!camRay) return;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const roots: THREE.Object3D[] = [];
          if (shellCloneRef.current) roots.push(shellCloneRef.current);
          roots.push(layer.group);
          const layoutLyr = layoutLayerRef.current;
          if (layoutLyr) roots.push(layoutLyr.group);
          let surface = pickMarkupSurface(raycaster.current, roots);
          if (!surface) {
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const groundPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(groundPlane, groundPt)) {
              surface = {
                point: groundPt,
                normal: new THREE.Vector3(0, 1, 0),
                object: layoutLyr?.group ?? layer.group,
                distance: raycaster.current.ray.origin.distanceTo(groundPt),
                snappedVertex: null,
              };
            }
          }
          if (surface && ms.armedTool === "note") {
            surface = enhanceHitWithVertexSnap(
              surface,
              raycaster.current,
              0.3,
            );
            layer.setSnapIndicator(surface.snappedVertex ?? surface.point);
          } else {
            layer.setSnapIndicator(null);
          }
          if (surface && ms.cubeDraw?.phase === "footprint") {
            let p = surface.point.clone();
            if (ms.gridSnap) p = applyGridSnap(p, ms.gridSize, ["x", "z"]);
            ms.setCubeDraw({
              ...ms.cubeDraw,
              current: { x: p.x, y: p.y, z: p.z },
            });
            layer.setCubeDrawPreview(
              ms.cubeDraw.start,
              { x: p.x, y: p.y, z: p.z },
              ms.cubeDraw.height,
            );
            const w = Math.abs(p.x - ms.cubeDraw.start.x);
            const d = Math.abs(p.z - ms.cubeDraw.start.z);
            ms.setDragSnapHint({
              text: `${Math.round(toMm(w))} × ${Math.round(toMm(d))} mm`,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          } else if (ms.cubeDraw?.phase === "height") {
            const start = ms.cubeDraw.start;
            const end = ms.cubeDraw.footprintEnd ?? ms.cubeDraw.current;
            let h = 0.5;
            // Prefer screen-Y drag (works in Top ortho — vertical plane rays don't).
            // ~20 mm per pixel, always 50 mm steps so the third click feels snappy.
            if (ms.cubeDraw.heightScreenY != null) {
              const dy = ms.cubeDraw.heightScreenY - e.clientY; // drag up = taller
              h = Math.max(0.05, dy * 0.02);
            }
            // In elevation / 3D, also use world Y when the ray hits above the floor.
            if (ms.viewPreset !== "top" && surface) {
              const fromY = Math.max(0.05, Math.abs(surface.point.y - start.y));
              h = Math.max(h, fromY);
            }
            h = Math.max(0.05, Math.round(h / 0.05) * 0.05);
            ms.setCubeDraw({ ...ms.cubeDraw, height: h, current: end });
            layer.setCubeDrawPreview(start, end, h);
            ms.setDragSnapHint({
              text: `${Math.round(toMm(h))} mm`,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          } else if (!ms.cubeDraw) {
            layer.setCubeDrawPreview(null, null);
            if (surface && ms.snapToFaces) {
              const snapped = enhanceHitWithVertexSnap(
                surface,
                raycaster.current,
                0.3,
              );
              if (snapped.snappedVertex) {
                const dist = snapped.point.distanceTo(snapped.snappedVertex);
                ms.setDragSnapHint({
                  text:
                    dist < 1e-4
                      ? "0 mm ✦"
                      : `${Math.round(toMm(dist))} mm ✦`,
                  clientX: e.clientX,
                  clientY: e.clientY,
                });
                layer.setSnapIndicator(snapped.snappedVertex);
              } else {
                ms.setDragSnapHint(null);
              }
            } else {
              ms.setDragSnapHint(null);
            }
          }
          canvas.style.cursor = surface ? "crosshair" : "default";
          setHoveredRoom(null);
          return;
        }
        layer?.setSnapIndicator(null);
        layer?.setCubeDrawPreview(null, null);
      }

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
      if (transformDraggingRef.current) return;
      const cube = viewCubeRef.current;
      const camera = perspectiveCameraRef.current;
      const controls = controlsRef.current;
      if (cube && camera && controls && cube.containsClientPoint(e.clientX, e.clientY, canvas)) {
        const zone = cube.pick(e.clientX, e.clientY, canvas);
        if (zone) {
          e.preventDefault();
          e.stopPropagation();
          if (cameraRef.current !== camera) {
            cameraRef.current = camera;
            controls.object = camera;
            controls.enableRotate = true;
          }
          void cube.snapMainCamera(zone, camera, controls, 600);
        }
        return;
      }

      const hit = pickHit(e.clientX, e.clientY);
      const viewMode = useAppStore.getState().dataViewMode;
      const inToolNow = useAppStore.getState().toolMode;

      if (inToolNow) {
        const markupStore = useToolMarkupStore.getState();
        const layer = markupLayerRef.current;
        const camera = cameraRef.current;
        if (camera && layer && markupStore.measureMode) {
          const camRay =
            preparePointerRayRef.current(e.clientX, e.clientY) ?? camera;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);
          const roots: THREE.Object3D[] = [];
          if (shellCloneRef.current) roots.push(shellCloneRef.current);
          roots.push(layer.group);
          const layoutLayer = layoutLayerRef.current;
          if (layoutLayer) roots.push(layoutLayer.group);
          let surface = pickMarkupSurface(raycaster.current, roots);
          if (surface && markupStore.snapToFaces) {
            surface = enhanceHitWithVertexSnap(
              surface,
              raycaster.current,
              0.35,
            );
          }
          let pt = surface?.snappedVertex ?? surface?.point ?? null;
          if (!pt && layoutLayer) {
            const lh = layoutLayer.pickLayout(raycaster.current);
            if (lh?.kind === "ground" || lh?.kind === "underlay") {
              pt = lh.point.clone();
            }
          }
          if (pt) {
            if (markupStore.gridSnap) {
              pt = applyGridSnap(pt, markupStore.gridSize, ["x", "y", "z"]);
            }
            markupStore.addMeasurePoint({ x: pt.x, y: pt.y, z: pt.z });
            const after = useToolMarkupStore.getState();
            layer.syncMeasurements(after.measurements, after.measureDraft, null);
          }
          return;
        }
        if (camera && layer) {
          const camRay =
            preparePointerRayRef.current(e.clientX, e.clientY) ?? camera;
          raycaster.current.setFromCamera(pointerNdc.current, camRay);

          // Layout drawing: walls / doors / windows
          const layoutStore = useLayoutDrawingStore.getState();
          const layoutLayer = layoutLayerRef.current;
          if (layoutLayer && layoutStore.projectId) {
            const layoutHit = layoutLayer.pickLayout(raycaster.current);
            const planPointFromHit = (pt: THREE.Vector3) => {
              let p = pt.clone();
              if (markupStore.gridSnap) {
                p = applyGridSnap(p, markupStore.gridSize, ["x", "z"]);
              }
              return { xMm: toMm(p.x), yMm: toMm(p.z) };
            };

            if (layoutStore.armedLayoutTool === "wall") {
              // Tier 2: confirm hover candidate
              if (
                !layoutStore.wallDraw &&
                layoutStore.tracePreview?.candidates.length
              ) {
                void layoutStore.confirmTraceCandidate().then((created) => {
                  if (!created) return;
                  useToolMarkupStore.getState().setDragSnapHint({
                    text:
                      "thicknessMm" in created
                        ? `${created.thicknessMm} mm ✦`
                        : "ok ✦",
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                });
                return;
              }
              let plan: { xMm: number; yMm: number } | null = null;
              if (layoutHit?.kind === "ground" || layoutHit?.kind === "underlay") {
                plan = planPointFromHit(layoutHit.point);
              } else {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (plan) {
                let levelId =
                  markupStore.markupFloorId ??
                  layoutStore.levels[0]?.id ??
                  null;
                if (!levelId) {
                  levelId = "default-level";
                }
                if (levelId) {
                  if (!layoutStore.wallDraw) {
                    layoutStore.beginWallDraw(levelId, plan);
                  } else if (e.detail >= 2) {
                    void layoutStore.addWallPoint(plan).then((wall) => {
                      if (wall) {
                        useToolMarkupStore.getState().setDragSnapHint({
                          text: `${wall.thicknessMm} mm ✦`,
                          clientX: e.clientX,
                          clientY: e.clientY,
                        });
                      }
                      layoutStore.finishWallDraw();
                    });
                  } else {
                    void layoutStore.addWallPoint(plan).then((wall) => {
                      if (!wall) return;
                      const draft =
                        useLayoutDrawingStore.getState().draftWallThicknessMm;
                      if (wall.thicknessMm === draft) {
                        useToolMarkupStore.getState().setDragSnapHint({
                          text: `${wall.thicknessMm} mm ✦`,
                          clientX: e.clientX,
                          clientY: e.clientY,
                        });
                      }
                    });
                  }
                  return;
                }
              }
            }

            if (
              layoutStore.armedLayoutTool === "floor" ||
              layoutStore.armedLayoutTool === "roof"
            ) {
              let plan: { xMm: number; yMm: number } | null = null;
              if (
                layoutHit?.kind === "ground" ||
                layoutHit?.kind === "underlay"
              ) {
                plan = planPointFromHit(layoutHit.point);
              } else {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (plan) {
                let levelId =
                  markupStore.markupFloorId ??
                  layoutStore.levels[0]?.id ??
                  null;
                if (!levelId) {
                  levelId = "default-level";
                }
                const kind = layoutStore.armedLayoutTool;
                if (levelId && (kind === "floor" || kind === "roof")) {
                  if (!layoutStore.slabDraw) {
                    layoutStore.beginSlabDraw(kind, levelId);
                  }
                  void layoutStore.addSlabCorner(plan);
                  return;
                }
              }
            }

            if (layoutStore.armedLayoutTool === "lines") {
              let plan: { xMm: number; yMm: number } | null = null;
              if (
                layoutHit?.kind === "ground" ||
                layoutHit?.kind === "underlay"
              ) {
                plan = planPointFromHit(layoutHit.point);
              }
              if (!plan) {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (!plan) {
                const activeLvl =
                  layoutStore.levels.find((l) => l.id === markupStore.markupFloorId) ??
                  layoutStore.levels[0];
                const levelElevMm = activeLvl?.elevationMm ?? 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
                const targetPt = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
                  plan = planPointFromHit(targetPt);
                }
              }
              if (!plan) {
                const activeLvl =
                  layoutStore.levels.find((l) => l.id === markupStore.markupFloorId) ??
                  layoutStore.levels[0];
                const levelElevMm = activeLvl?.elevationMm ?? 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
                const targetPt = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
                  plan = planPointFromHit(targetPt);
                }
              }
              if (plan) {
                const levelId =
                  markupStore.markupFloorId ??
                  layoutStore.levels[0]?.id ??
                  "default-level";
                if (!layoutStore.sketchDraw) {
                  layoutStore.beginSketchLineDraw(levelId, plan);
                } else if (e.detail >= 2) {
                  void layoutStore.addSketchLinePoint(plan).then(() => {
                    layoutStore.finishSketchLineDraw();
                  });
                } else {
                  void layoutStore.addSketchLinePoint(plan);
                }
                return;
              }
            }

            if (layoutStore.armedLayoutTool === "column") {
              let plan: { xMm: number; yMm: number } | null = null;
              if (layoutHit?.kind === "ground" || layoutHit?.kind === "underlay") {
                plan = planPointFromHit(layoutHit.point);
              } else {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (!plan) {
                const activeLvl =
                  layoutStore.levels.find((l) => l.id === markupStore.markupFloorId) ??
                  layoutStore.levels[0];
                const levelElevMm = activeLvl?.elevationMm ?? 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
                const targetPt = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
                  plan = planPointFromHit(targetPt);
                }
              }
              if (plan) {
                const levelId =
                  markupStore.markupFloorId ??
                  layoutStore.levels[0]?.id ??
                  "default-level";
                void layoutStore.addColumn({
                  levelId,
                  xMm: plan.xMm,
                  yMm: plan.yMm,
                  widthMm: layoutStore.draftColumnWidthMm,
                  depthMm: layoutStore.draftColumnDepthMm,
                  profile: "rect",
                });
                return;
              }
            }

            if (layoutStore.armedLayoutTool === "beam") {
              let plan: { xMm: number; yMm: number } | null = null;
              if (layoutHit?.kind === "ground" || layoutHit?.kind === "underlay") {
                plan = planPointFromHit(layoutHit.point);
              } else {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (!plan) {
                const activeLvl =
                  layoutStore.levels.find((l) => l.id === markupStore.markupFloorId) ??
                  layoutStore.levels[0];
                const levelElevMm = activeLvl?.elevationMm ?? 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
                const targetPt = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
                  plan = planPointFromHit(targetPt);
                }
              }
              if (plan) {
                const levelId =
                  markupStore.markupFloorId ??
                  layoutStore.levels[0]?.id ??
                  "default-level";
                if (!draftBeamStart) {
                  draftBeamStart = plan;
                } else {
                  void layoutStore.addBeam({
                    levelId,
                    startXmm: draftBeamStart.xMm,
                    startYmm: draftBeamStart.yMm,
                    endXmm: plan.xMm,
                    endYmm: plan.yMm,
                    widthMm: layoutStore.draftBeamWidthMm,
                    depthMm: layoutStore.draftBeamDepthMm,
                    elevationOffsetMm: 0,
                  });
                  draftBeamStart = null;
                }
                return;
              }
            }

            if (layoutStore.armedLayoutTool === "grid") {
              let plan: { xMm: number; yMm: number } | null = null;
              if (layoutHit?.kind === "ground" || layoutHit?.kind === "underlay") {
                plan = planPointFromHit(layoutHit.point);
              } else {
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) plan = planPointFromHit(surface.point);
              }
              if (!plan) {
                const activeLvl =
                  layoutStore.levels.find((l) => l.id === markupStore.markupFloorId) ??
                  layoutStore.levels[0];
                const levelElevMm = activeLvl?.elevationMm ?? 0;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fromMm(levelElevMm));
                const targetPt = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(plane, targetPt)) {
                  plan = planPointFromHit(targetPt);
                }
              }
              if (plan) {
                if (!draftGridStart) {
                  draftGridStart = plan;
                } else {
                  const count = layoutStore.gridLines.length + 1;
                  const label = String.fromCharCode(64 + count);
                  void layoutStore.addGridLine({
                    label,
                    startXmm: draftGridStart.xMm,
                    startYmm: draftGridStart.yMm,
                    endXmm: plan.xMm,
                    endYmm: plan.yMm,
                  });
                  draftGridStart = null;
                }
                return;
              }
            }

            if (
              layoutStore.armedLayoutTool === "door" ||
              layoutStore.armedLayoutTool === "window"
            ) {
              if (layoutStore.tracePreview?.candidates.length) {
                void layoutStore.confirmTraceCandidate();
                return;
              }
              const wallId: string | null =
                layoutHit?.kind === "wall" ? layoutHit.id : null;
              let posMm = 0;
              if (wallId) {
                const wall = layoutStore.walls.find((w) => w.id === wallId);
                if (wall && layoutHit?.kind === "wall") {
                  // Approximate from ray vs wall midpoint — better: ground/shell hit
                  const roots: THREE.Object3D[] = [layoutLayer.group];
                  if (shellCloneRef.current) roots.push(shellCloneRef.current);
                  const surface = pickMarkupSurface(raycaster.current, roots);
                  if (surface) {
                    const plan = planPointFromHit(surface.point);
                    posMm = nearestOffsetOnWallMm(wall, plan.xMm, plan.yMm);
                  }
                }
              }
              if (wallId) {
                if (layoutStore.armedLayoutTool === "door") {
                  void layoutStore.placeDoorOnWall(wallId, posMm);
                } else {
                  void layoutStore.placeWindowOnWall(wallId, posMm);
                }
                return;
              }
            }

            if (layoutStore.armedLayoutTool === "trim") {
              const wallId = layoutHit?.kind === "wall" ? layoutHit.id : null;
              if (wallId) {
                let plan = { xMm: 0, yMm: 0 };
                const roots: THREE.Object3D[] = [layoutLayer.group];
                if (shellCloneRef.current) roots.push(shellCloneRef.current);
                const surface = pickMarkupSurface(raycaster.current, roots);
                if (surface) {
                  plan = planPointFromHit(surface.point);
                } else {
                  const wall = layoutStore.walls.find((w) => w.id === wallId);
                  if (wall) {
                    plan = {
                      xMm: Math.round((wall.startXmm + wall.endXmm) / 2),
                      yMm: Math.round((wall.startYmm + wall.endYmm) / 2),
                    };
                  }
                }

                if (!layoutStore.trimFirstPick) {
                  layoutStore.setTrimFirstPick({ wallId, clickPointMm: plan });
                  layoutStore.selectWall(wallId);
                } else {
                  void layoutStore.trimWalls(
                    layoutStore.trimFirstPick.wallId,
                    layoutStore.trimFirstPick.clickPointMm,
                    wallId,
                    plan,
                  );
                }
                return;
              }
            }

            // Select / pin note on layout elements
            if (!layoutStore.armedLayoutTool && layoutHit) {
              if (
                layoutStore.calibrateUnderlayId &&
                (layoutHit.kind === "underlay" ||
                  layoutHit.kind === "ground")
              ) {
                const pt =
                  layoutHit.kind === "underlay" || layoutHit.kind === "ground"
                    ? layoutHit.point
                    : null;
                if (pt) {
                  layoutStore.addCalibratePoint({
                    xMm: toMm(pt.x),
                    yMm: toMm(pt.z),
                  });
                }
                return;
              }
              if (layoutHit.kind === "wall-endpoint") {
                layoutStore.selectWall(layoutHit.id);
                return;
              }
              if (layoutHit.kind === "underlay") {
                if (markupStore.armedTool === "note") {
                  const u = layoutStore.underlays.find(
                    (x) => x.id === layoutHit.id,
                  );
                  markupStore.beginNoteAt(
                    {
                      x: layoutHit.point.x,
                      y: layoutHit.point.y,
                      z: layoutHit.point.z,
                    },
                    {
                      underlayId: layoutHit.id,
                      elementName: u?.sourceName ?? "Reference",
                      floorId: u?.levelId ?? null,
                    },
                  );
                  return;
                }
                layoutStore.selectUnderlay(layoutHit.id);
                return;
              }
              if (layoutHit.kind === "wall") {
                if (markupStore.armedTool === "note") {
                  const wall = layoutStore.walls.find(
                    (w) => w.id === layoutHit.id,
                  );
                  const roots: THREE.Object3D[] = [layoutLayer.group];
                  const surface = pickMarkupSurface(raycaster.current, roots);
                  const p = surface?.point ?? new THREE.Vector3();
                  markupStore.beginNoteAt(
                    { x: p.x, y: p.y, z: p.z },
                    {
                      wallId: layoutHit.id,
                      elementName: "Wall",
                      floorId: wall?.levelId ?? null,
                    },
                  );
                  return;
                }
                layoutStore.selectElement(
                  { kind: "wall", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "door") {
                if (markupStore.armedTool === "note") {
                  const door = layoutStore.doors.find(
                    (d) => d.id === layoutHit.id,
                  );
                  const roots: THREE.Object3D[] = [layoutLayer.group];
                  const surface = pickMarkupSurface(raycaster.current, roots);
                  const p = surface?.point ?? new THREE.Vector3();
                  markupStore.beginNoteAt(
                    { x: p.x, y: p.y, z: p.z },
                    {
                      doorId: layoutHit.id,
                      elementName: "Door",
                      floorId: null,
                      wallId: door?.wallId ?? null,
                    },
                  );
                  return;
                }
                layoutStore.selectElement(
                  { kind: "door", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "window") {
                if (markupStore.armedTool === "note") {
                  const win = layoutStore.windows.find(
                    (w) => w.id === layoutHit.id,
                  );
                  const roots: THREE.Object3D[] = [layoutLayer.group];
                  const surface = pickMarkupSurface(raycaster.current, roots);
                  const p = surface?.point ?? new THREE.Vector3();
                  markupStore.beginNoteAt(
                    { x: p.x, y: p.y, z: p.z },
                    {
                      windowId: layoutHit.id,
                      elementName: "Window",
                      wallId: win?.wallId ?? null,
                    },
                  );
                  return;
                }
                layoutStore.selectElement(
                  { kind: "window", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "slab") {
                layoutStore.selectElement(
                  { kind: "slab", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "column") {
                layoutStore.selectElement(
                  { kind: "column", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "beam") {
                layoutStore.selectElement(
                  { kind: "beam", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "grid") {
                layoutStore.selectElement(
                  { kind: "grid", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
              if (layoutHit.kind === "sketch-line") {
                layoutStore.selectElement(
                  { kind: "line", id: layoutHit.id },
                  e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
                );
                return;
              }
            }
          }

          // Dedicated surface pick — never use analysis cut-plane hits
          // (those can return point (0,0,0) and dump every shape at origin).
          const roots: THREE.Object3D[] = [];
          if (shellCloneRef.current) roots.push(shellCloneRef.current);
          roots.push(layer.group);
          const layoutLyr = layoutLayerRef.current;
          if (layoutLyr) roots.push(layoutLyr.group);
          let surface = pickMarkupSurface(raycaster.current, roots);
          if (!surface) {
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const groundPt = new THREE.Vector3();
            if (raycaster.current.ray.intersectPlane(groundPlane, groundPt)) {
              surface = {
                point: groundPt,
                normal: new THREE.Vector3(0, 1, 0),
                object: layoutLyr?.group ?? layer.group,
                distance: raycaster.current.ray.origin.distanceTo(groundPt),
                snappedVertex: null,
              };
            }
          }

          const armed = markupStore.armedTool;
          if (armed && surface) {
            if (armed === "note") {
              surface = enhanceHitWithVertexSnap(
                surface,
                raycaster.current,
                0.3,
              );
            }
            let p = surface.point.clone();
            // Sit slightly along the face normal so shapes don't z-fight.
            p.addScaledVector(surface.normal, 0.015);
            if (markupStore.gridSnap) {
              p = applyGridSnap(p, markupStore.gridSize, ["x", "z"]);
            }

            let rot = { x: 0, y: 0, z: 0 };
            if (markupStore.snapToFaces) {
              const quat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                surface.normal.clone().normalize(),
              );
              const euler = new THREE.Euler().setFromQuaternion(quat);
              rot = { x: euler.x, y: euler.y, z: euler.z };
            }

            const ids = pickIdsFromObject(surface.object);
            const floorId =
              markupStore.markupFloorId ?? ids.floorId ?? null;

            // Cube: 1st click corner · 2nd click width/depth · 3rd click height
            if (armed === "cube") {
              if (!markupStore.cubeDraw) {
                markupStore.setCubeDraw({
                  start: { x: p.x, y: p.y, z: p.z },
                  current: { x: p.x, y: p.y, z: p.z },
                  footprintEnd: null,
                  phase: "footprint",
                  height: 0.5,
                  heightScreenY: null,
                });
                return;
              }
              if (markupStore.cubeDraw.phase === "footprint") {
                markupStore.setCubeDraw({
                  ...markupStore.cubeDraw,
                  current: { x: p.x, y: p.y, z: p.z },
                  footprintEnd: { x: p.x, y: p.y, z: p.z },
                  phase: "height",
                  heightScreenY: e.clientY,
                  height: 0.5,
                });
                layer.setCubeDrawPreview(
                  markupStore.cubeDraw.start,
                  { x: p.x, y: p.y, z: p.z },
                  0.5,
                );
                return;
              }
              if (markupStore.cubeDraw.phase === "height") {
                const start = markupStore.cubeDraw.start;
                const end =
                  markupStore.cubeDraw.footprintEnd ??
                  markupStore.cubeDraw.current;
                let h = markupStore.cubeDraw.height;
                if (markupStore.cubeDraw.heightScreenY != null) {
                  const dy =
                    markupStore.cubeDraw.heightScreenY - e.clientY;
                  h = Math.max(0.05, dy * 0.02);
                }
                if (markupStore.viewPreset !== "top") {
                  h = Math.max(h, Math.abs(p.y - start.y));
                }
                h = Math.max(0.05, Math.round(h / 0.05) * 0.05);
                const w = Math.max(0.05, Math.abs(end.x - start.x));
                const d = Math.max(0.05, Math.abs(end.z - start.z));
                const cx = (end.x + start.x) / 2;
                const cz = (end.z + start.z) / 2;
                const cy = start.y + h / 2;
                void markupStore.placeShape(
                  "cube",
                  { x: cx, y: cy, z: cz },
                  {
                    floorId,
                    rot: { x: 0, y: 0, z: 0 },
                    sizeX: w,
                    sizeY: h,
                    sizeZ: d,
                  },
                );
                markupStore.setCubeDraw(null);
                layer.setCubeDrawPreview(null, null);
                return;
              }
            }

            if (armed === "note") {
              const markupId =
                (surface.object.userData.markupId as string | undefined) ??
                null;
              const expressId = ids.expressId ?? null;
              if (!markupId && expressId == null) {
                markupStore.setNotePlaceHint("markupNoteMustAttach");
                return;
              }
              const elName =
                useAppStore.getState().selectedElement?.name ??
                (markupId
                  ? `Shape ${markupId.slice(0, 8)}`
                  : expressId != null
                    ? `Element #${expressId}`
                    : null);
              markupStore.beginNoteAt(
                { x: p.x, y: p.y, z: p.z },
                {
                  expressId,
                  placementId: markupId,
                  elementName: elName,
                  floorId,
                },
              );
            } else if (isShapeTool(armed) && armed !== "cube") {
              void markupStore.placeShape(
                armed,
                { x: p.x, y: p.y, z: p.z },
                { floorId, rot },
              );
            }
            return;
          }

          if (armed === "note" && !surface) {
            markupStore.setNotePlaceHint("markupNoteMustAttach");
            return;
          }

          const picked = layer.pickMarkup(raycaster.current);
          if (picked?.kind === "placement") {
            markupStore.selectPlacement(picked.id);
            return;
          }
          const noteId = layer.noteIdNearRay(
            raycaster.current,
            markupStore.notes,
          );
          if (noteId) {
            markupStore.selectNote(noteId);
            return;
          }

          if (!armed) {
            markupStore.clearSelection();
            layoutStore.clearSelection();
            useAppStore.getState().setSelectedElement(null);
            markupStore.setCubeDraw(null);
            // Select IFC element under cursor (surface pick, not cut-plane hit).
            if (surface) {
              applyPickSelection({
                distance: surface.distance,
                point: surface.point,
                object: surface.object,
                face: null,
                faceIndex: 0,
                uv: undefined,
              } as THREE.Intersection);
              return;
            }
          }
        }
      }

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

    let lastTapTime = 0;
    const handleDblClickOrTap = (clientX: number, clientY: number) => {
      const camera = preparePointerRayRef.current(clientX, clientY) ?? perspectiveCameraRef.current;
      if (!camera) return;
      raycaster.current.setFromCamera(pointerNdc.current, camera);

      const layoutLayer = layoutLayerRef.current;
      const layoutStore = useLayoutDrawingStore.getState();
      const markupStore = useToolMarkupStore.getState();

      // 1. Try to pick layout element
      if (layoutLayer && useAppStore.getState().toolMode) {
        const lh = layoutLayer.pickLayout(raycaster.current);
        if (
          lh &&
          lh.kind !== "ground" &&
          lh.kind !== "underlay" &&
          lh.kind !== "wall-endpoint"
        ) {
          // Select layout element
          layoutStore.clearSelection();
          useAppStore.getState().setSelectedElement(null);
          layoutStore.selectElement({
            kind: lh.kind as any,
            id: lh.id,
          });

          // Compute bounding box for layout element by traversing the layout group
          const box = new THREE.Box3();
          let framed = false;
          layoutLayer.group.traverse((o) => {
            if (
              (lh.kind === "wall" && o.userData?.layoutWallId === lh.id) ||
              (lh.kind === "door" && o.userData?.layoutDoorId === lh.id) ||
              (lh.kind === "window" && o.userData?.layoutWindowId === lh.id) ||
              (lh.kind === "slab" && o.userData?.layoutSlabId === lh.id) ||
              (lh.kind === "column" && o.userData?.layoutColumnId === lh.id) ||
              (lh.kind === "beam" && o.userData?.layoutBeamId === lh.id) ||
              (lh.kind === "grid" && o.userData?.layoutGridId === lh.id) ||
              (lh.kind === "sketch-line" && o.userData?.layoutSketchLineId === lh.id)
            ) {
              box.expandByObject(o);
              framed = true;
            }
          });

          if (framed && !box.isEmpty() && Number.isFinite(box.min.x)) {
            const controls = controlsRef.current;
            if (controls) {
              const { position, target } = frameBoundingBox(box, camera, 1.4);
              void flyTo(camera, controls, position, target, 850);
              return;
            }
          }
        }
      }

      // 2. Try standard pickHit (for IFC model components / rooms)
      const hit = pickHit(clientX, clientY);
      if (hit && hit.object) {
        if (useAppStore.getState().dataViewMode === "luftung") {
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

        // Default layout element framing (QuadView check)
        if (
          useAppStore.getState().toolMode &&
          useToolMarkupStore.getState().quadView
        ) {
          const markupLayer = markupLayerRef.current;
          const box = new THREE.Box3();
          let framed = false;

          if (markupLayer) {
            const picked = markupLayer.pickMarkup(raycaster.current);
            if (picked?.kind === "placement") {
              markupStore.selectPlacement(picked.id);
              const mesh = markupLayer.getMesh(picked.id);
              if (mesh) {
                box.setFromObject(mesh);
                framed = true;
              }
            }
          }

          if (!framed && hit) {
            applyPickSelection(hit);
            box.setFromObject(hit.object);
            framed = Number.isFinite(box.min.x);
          }

          if (!framed) {
            const shell = shellCloneRef.current;
            if (shell) box.setFromObject(shell);
          }
          if (!box.isEmpty()) fitAllQuadsToBoxRef.current(box);
          return;
        }

        // Standard 3D element focus
        applyPickSelection(hit);
        const box = new THREE.Box3().setFromObject(hit.object);
        if (!box.isEmpty() && Number.isFinite(box.min.x)) {
          const controls = controlsRef.current;
          if (controls) {
            const { position, target } = frameBoundingBox(box, camera, 1.4);
            void flyTo(camera, controls, position, target, 850);
            return;
          }
        }
      }

      // 3. Clicked empty space -> Fit visible scene
      const presentation = useAppStore.getState().isPresentationView;
      fitToVisible(presentation ? 2000 : 850);
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      handleDblClickOrTap(e.clientX, e.clientY);
    };

    let lastTapX = 0;
    let lastTapY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        const now = performance.now();
        const dist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
        if (now - lastTapTime < 350 && dist < 40) {
          e.preventDefault();
          handleDblClickOrTap(e.clientX, e.clientY);
          lastTapTime = 0;
          lastTapX = 0;
          lastTapY = 0;
          return;
        }
        lastTapTime = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
      if (
        useAppStore.getState().toolMode &&
        useToolMarkupStore.getState().quadView
      ) {
        preparePointerRayRef.current(e.clientX, e.clientY);
      }
      if (e.button === 0) {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
        suppressNextClick = false;
        pendingWallMoveId = null;
        pendingUnderlayMoveId = null;

        if (
          useAppStore.getState().toolMode &&
          !transformDraggingRef.current
        ) {
          const layoutStore = useLayoutDrawingStore.getState();
          const markupStore = useToolMarkupStore.getState();
          if (
            !layoutStore.armedLayoutTool &&
            !layoutStore.wallDraw &&
            !layoutStore.calibrateUnderlayId &&
            !markupStore.armedTool &&
            !markupStore.measureMode
          ) {
            const cam = preparePointerRayRef.current(e.clientX, e.clientY);
            const layoutLayer = layoutLayerRef.current;
              if (e.ctrlKey || e.metaKey) {
                // Control-drag always starts a box selection window (both in 2D and 3D)
                marqueeActive = true;
                marqueeStartX = e.clientX;
                marqueeStartY = e.clientY;
                const controls = controlsRef.current;
                if (controls) controls.enabled = false;
                return;
              }
              raycaster.current.setFromCamera(pointerNdc.current, cam);
              const hit = layoutLayer.pickLayout(raycaster.current);
              if (hit?.kind === "wall-endpoint") {
                const plan = planMmFromPointer(e.clientX, e.clientY);
                layoutStore.selectWall(hit.id);
                pushWerkzeugHistory();
                suspendWerkzeugHistory(true);
                wallEditDragRef.current = {
                  mode: "endpoint",
                  wallId: hit.id,
                  end: hit.end,
                  lastXmm: plan?.xMm ?? 0,
                  lastYmm: plan?.yMm ?? 0,
                };
                const controls = controlsRef.current;
                if (controls) controls.enabled = false;
                suppressNextClick = true;
              } else if (
                hit?.kind === "wall" &&
                layoutStore.selectedWallId === hit.id
              ) {
                pendingWallMoveId = hit.id;
              } else if (hit?.kind === "underlay") {
                layoutStore.selectUnderlay(hit.id);
                const u = layoutStore.underlays.find((x) => x.id === hit.id);
                if (u && !u.locked) pendingUnderlayMoveId = hit.id;
              } else if (!hit && activeViewPresetRef.current !== "free") {
                // In 2D ortho/plan mode only: empty canvas drag starts marquee box selection
                marqueeActive = true;
                marqueeStartX = e.clientX;
                marqueeStartY = e.clientY;
                const controls = controlsRef.current;
                if (controls) controls.enabled = false;
              }
          }
        }
      }
      const cube = viewCubeRef.current;
      const controls = controlsRef.current;
      if (cube?.containsClientPoint(e.clientX, e.clientY, canvas) && controls) {
        controls.enabled = false;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pendingWallMoveId = null;
      pendingUnderlayMoveId = null;
      if (wallEditDragRef.current) endWallEditDrag();

      if (marqueeActive) {
        marqueeActive = false;
        const box = useLayoutDrawingStore.getState().marqueeBox;
        if (box) {
          useLayoutDrawingStore.getState().setMarqueeBox(null);
          suppressNextClick = true;
          const minX = Math.min(box.startX, box.currentX);
          const maxX = Math.max(box.startX, box.currentX);
          const minY = Math.min(box.startY, box.currentY);
          const maxY = Math.max(box.startY, box.currentY);

          const cam = preparePointerRayRef.current(e.clientX, e.clientY);
          if (cam) {
            const layout = useLayoutDrawingStore.getState();
            const matched: SelectedElementRef[] = [];

            const isPtInBox = (pt: { x: number; y: number }) =>
              pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;

            const testPoints = (pts: THREE.Vector3[]) => {
              const screenPts = pts.map((p) => projectPointToClient(p, cam, canvas));
              if (box.isCrossing) {
                return screenPts.some(isPtInBox);
              } else {
                return screenPts.length > 0 && screenPts.every(isPtInBox);
              }
            };

            for (const w of layout.walls) {
              const lvl = layout.levels.find((l) => l.id === w.levelId);
              const elev = fromMm(lvl?.elevationMm ?? 0);
              const p1 = new THREE.Vector3(fromMm(w.startXmm), elev, fromMm(w.startYmm));
              const p2 = new THREE.Vector3(fromMm(w.endXmm), elev, fromMm(w.endYmm));
              if (testPoints([p1, p2])) matched.push({ kind: "wall", id: w.id });
            }
            const openingPoint = (wallId: string, positionMm: number) => {
              const wall = layout.walls.find((item) => item.id === wallId);
              if (!wall) return null;
              const length = Math.hypot(wall.endXmm - wall.startXmm, wall.endYmm - wall.startYmm) || 1;
              const t = Math.max(0, Math.min(1, positionMm / length));
              const lvl = layout.levels.find((item) => item.id === wall.levelId);
              return new THREE.Vector3(
                fromMm(wall.startXmm + (wall.endXmm - wall.startXmm) * t),
                fromMm(lvl?.elevationMm ?? 0),
                fromMm(wall.startYmm + (wall.endYmm - wall.startYmm) * t),
              );
            };
            for (const door of layout.doors) {
              const point = openingPoint(door.wallId, door.positionMm);
              if (point && testPoints([point])) matched.push({ kind: "door", id: door.id });
            }
            for (const win of layout.windows) {
              const point = openingPoint(win.wallId, win.positionMm);
              if (point && testPoints([point])) matched.push({ kind: "window", id: win.id });
            }
            for (const sl of layout.slabs) {
              const lvl = layout.levels.find((l) => l.id === sl.levelId);
              const elev = fromMm(lvl?.elevationMm ?? 0);
              const pts = [
                new THREE.Vector3(fromMm(sl.minXmm), elev, fromMm(sl.minYmm)),
                new THREE.Vector3(fromMm(sl.maxXmm), elev, fromMm(sl.minYmm)),
                new THREE.Vector3(fromMm(sl.maxXmm), elev, fromMm(sl.maxYmm)),
                new THREE.Vector3(fromMm(sl.minXmm), elev, fromMm(sl.maxYmm)),
              ];
              if (testPoints(pts)) matched.push({ kind: "slab", id: sl.id });
            }
            for (const col of layout.columns) {
              const lvl = layout.levels.find((l) => l.id === col.levelId);
              const elev = fromMm(lvl?.elevationMm ?? 0);
              const p = new THREE.Vector3(fromMm(col.xMm), elev, fromMm(col.yMm));
              if (testPoints([p])) matched.push({ kind: "column", id: col.id });
            }
            for (const b of layout.beams) {
              const lvl = layout.levels.find((l) => l.id === b.levelId);
              const elev = fromMm(lvl?.elevationMm ?? 0);
              const p1 = new THREE.Vector3(fromMm(b.startXmm), elev, fromMm(b.startYmm));
              const p2 = new THREE.Vector3(fromMm(b.endXmm), elev, fromMm(b.endYmm));
              if (testPoints([p1, p2])) matched.push({ kind: "beam", id: b.id });
            }
            for (const g of layout.gridLines) {
              const p1 = new THREE.Vector3(fromMm(g.startXmm), 0, fromMm(g.startYmm));
              const p2 = new THREE.Vector3(fromMm(g.endXmm), 0, fromMm(g.endYmm));
              if (testPoints([p1, p2])) matched.push({ kind: "grid", id: g.id });
            }
            for (const l of layout.sketchLines) {
              const p1 = new THREE.Vector3(fromMm(l.startXmm), 0, fromMm(l.startYmm));
              const p2 = new THREE.Vector3(fromMm(l.endXmm), 0, fromMm(l.endYmm));
              if (testPoints([p1, p2])) matched.push({ kind: "line", id: l.id });
            }

            layout.selectMultiple(matched, e.shiftKey || e.ctrlKey || e.metaKey ? "add" : "replace");
          }
        }
      }

      const controls = controlsRef.current;
      if (controls && !useAppStore.getState().viewerContextMenuOpen) {
        controls.enabled = true;
      }
    };

    const onContextPick = (event: Event) => {
      const detail = (event as CustomEvent<{ clientX: number; clientY: number }>).detail;
      if (!detail) return;
      const camera = preparePointerRayRef.current(detail.clientX, detail.clientY);
      if (!camera) return;
      raycaster.current.setFromCamera(pointerNdc.current, camera);

      const layoutStore = useLayoutDrawingStore.getState();
      const markupStore = useToolMarkupStore.getState();
      const layoutHit = layoutLayerRef.current?.pickLayout(raycaster.current);
      const layoutKind = layoutHit?.kind === "wall-endpoint"
        ? "wall"
        : layoutHit?.kind === "sketch-line"
          ? "line"
          : layoutHit?.kind;
      if (
        layoutHit &&
        "id" in layoutHit &&
        layoutKind &&
        ["wall", "door", "window", "slab", "column", "beam", "grid", "line"].includes(layoutKind)
      ) {
        markupStore.clearSelection();
        useAppStore.getState().setSelectedElement(null);
        layoutStore.selectElement({
          kind: layoutKind as "wall" | "door" | "window" | "slab" | "column" | "beam" | "grid" | "line",
          id: layoutHit.id,
        });
        return;
      }

      const pickedMarkup = markupLayerRef.current?.pickMarkup(raycaster.current);
      if (pickedMarkup?.kind === "placement") {
        layoutStore.clearSelection();
        useAppStore.getState().setSelectedElement(null);
        markupStore.selectPlacement(pickedMarkup.id);
        return;
      }

      layoutStore.clearSelection();
      markupStore.clearSelection();
      useAppStore.getState().setSelectedElement(null);
      const hit = pickHit(detail.clientX, detail.clientY);
      if (hit) applyPickSelection(hit);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("werkzeug-context-pick", onContextPick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("werkzeug-context-pick", onContextPick);
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

  const marqueeBox = useLayoutDrawingStore((s) => s.marqueeBox);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`} data-viewer-root>
      <QuadViewOverlays />
      {marqueeBox && (
        <div
          className="pointer-events-none fixed z-[999]"
          style={{
            left: Math.min(marqueeBox.startX, marqueeBox.currentX),
            top: Math.min(marqueeBox.startY, marqueeBox.currentY),
            width: Math.abs(marqueeBox.currentX - marqueeBox.startX),
            height: Math.abs(marqueeBox.currentY - marqueeBox.startY),
            backgroundColor: marqueeBox.isCrossing
              ? "rgba(34, 197, 94, 0.15)"
              : "rgba(59, 130, 246, 0.15)",
            borderColor: marqueeBox.isCrossing
              ? "rgba(34, 197, 94, 0.85)"
              : "rgba(59, 130, 246, 0.85)",
            borderWidth: 1.5,
            borderStyle: marqueeBox.isCrossing ? "dashed" : "solid",
          }}
        />
      )}
    </div>
  );
});

export default WerkzeugViewer3D;
