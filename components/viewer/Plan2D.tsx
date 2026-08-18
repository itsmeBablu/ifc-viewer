"use client";

/**
 * Plan2D — top-down orthographic 2D floor-plan renderer, a lighter sibling of
 * Viewer3D used for plan-style views. Clones the shared IFC shell (from
 * `useModelScene`) into its own scene, renders flat room overlays colored by
 * the active `colorMode`/`dataViewMode` (heizlast, kuhllast, luftung,
 * temperature), and isolates the `selectedFloor`.
 *
 * Reads room/legend/filter state from useAppStore; drives
 * `setHoveredRoom`/`setSelectedRoomId` on pointer hover/click (no camera fly —
 * selection only, panning/zoom handled by OrbitControls in ortho mode).
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { heizlastToColor, kuhllastToColor, luftungToColor, temperatureToColor, type CustomLegendColors } from "@/lib/colorMapping";
import { roomTemperatureForView } from "@/lib/roomLoad";
import { roomVentilationColorValue } from "@/lib/ventilation";
import { canHover } from "@/lib/canHover";
import { isRoomPickAllowed } from "@/lib/pickAllowed";
import { roomPassesFilter } from "@/lib/roomFilter";
import { frameBoundingBoxOrtho } from "@/lib/flyTo";
import type { Room } from "@/lib/types";
import { THEME_COLORS } from "@/lib/themeColors";
import { useAppStore, useEffectiveColorPalette } from "@/store/useAppStore";
import { useModelScene } from "./ModelSceneContext";
import type { DataViewMode } from "@/lib/dataViewMode";

type Props = {
  onPointerMove?: (x: number, y: number) => void;
  className?: string;
};

function roomColor(
  room: Room,
  mode: "heizlast" | "temperature",
  dataViewMode: DataViewMode,
  palette: string,
  heizlastRange: number[],
  kuhllastRange: number[],
  luftungRange: number[],
  temperatureRange: number[],
  customLegendColors?: CustomLegendColors,
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
 * Thermal-gradient selection outline for the 2D plan view.
 */
const THERMAL_OUTLINE_PALETTE = [
  new THREE.Color("#0050ff"),
  new THREE.Color("#1f8a70"),
  new THREE.Color("#4caf50"),
  new THREE.Color("#ffdc00"),
  new THREE.Color("#ff8c00"),
  new THREE.Color("#dc0000"),
];

const _thermalGradientShader = {
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3  uColors[6];
    uniform int   uCount;
    uniform float uMin;
    uniform float uMax;
    uniform int   uAxis;
    uniform float uOpacity;
    varying vec3  vPos;
    void main() {
      float coord = uAxis == 0 ? vPos.x : uAxis == 1 ? vPos.y : vPos.z;
      float t = clamp((coord - uMin) / (uMax - uMin), 0.0, 1.0);
      float seg = t * float(uCount - 1);
      int idx = int(floor(seg));
      if (idx >= uCount - 1) idx = uCount - 2;
      float localT = seg - float(idx);
      vec3 c = mix(uColors[idx], uColors[idx + 1], localT);
      gl_FragColor = vec4(c, uOpacity);
    }
  `,
};

function attachThermalSelectionOutline(mesh: THREE.Mesh) {
  clearSelectionOutlines(mesh);
  const geom = mesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox;
  if (!box || box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  let axis = 0;
  if (size.y >= size.x && size.y >= size.z) axis = 1;
  else if (size.z >= size.x && size.z >= size.y) axis = 2;

  const inflate = 1.08;
  const worldMin = axis === 0 ? box.min.x : axis === 1 ? box.min.y : box.min.z;
  const worldMax = axis === 0 ? box.max.x : axis === 1 ? box.max.y : box.max.z;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColors:  { value: THERMAL_OUTLINE_PALETTE },
      uCount:   { value: THERMAL_OUTLINE_PALETTE.length },
      uMin:     { value: worldMin },
      uMax:     { value: worldMax },
      uAxis:    { value: axis },
      uOpacity: { value: 0.92 },
    },
    vertexShader: _thermalGradientShader.vertexShader,
    fragmentShader: _thermalGradientShader.fragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.scale.setScalar(inflate);
  ring.position.copy(center).multiplyScalar(1 - inflate);
  ring.userData.isSelectionOutline = true;
  ring.renderOrder = (mesh.renderOrder ?? 0) + 22;
  mesh.add(ring);
}

export default function Plan2D({ onPointerMove, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const shellCloneRef = useRef<THREE.Group | null>(null);
  const overlaysRef = useRef<THREE.Group | null>(null);
  const roomMeshById = useRef<Map<string, THREE.Mesh>>(new Map());
  const raycaster = useRef(new THREE.Raycaster());
  const pointerNdc = useRef(new THREE.Vector2());

  const { shellGroup, rooms } = useModelScene();
  const colorMode = useAppStore((s) => s.colorMode);
  const dataViewMode = useAppStore((s) => s.dataViewMode);
  const selectedFloor = useAppStore((s) => s.selectedFloor);
  const selectedRoomId = useAppStore((s) => s.selectedRoomId);
  const activeFilter = useAppStore((s) => s.activeFilter);
  const setHoveredRoom = useAppStore((s) => s.setHoveredRoom);
  const setSelectedRoomId = useAppStore((s) => s.setSelectedRoomId);
  const roomsFromStore = useAppStore((s) => s.rooms);
  const floors = useAppStore((s) => s.floors);
  const selectedFloorObj = floors.find((f) => f.id === selectedFloor);
  const activeColorPalette = useEffectiveColorPalette();
  const heizlastRange = useAppStore((s) => s.heizlastRange);
  const kuhllastRange = useAppStore((s) => s.kuhllastRange);
  const luftungRange = useAppStore((s) => s.luftungRange);
  const temperatureRange = useAppStore((s) => s.temperatureRange);
  const coolingTemperatureRange = useAppStore((s) => s.coolingTemperatureRange);
  const activeTemperatureRange =
    dataViewMode === "kuhllast" ? coolingTemperatureRange : temperatureRange;
  const customLegendColors = useAppStore((s) => s.customLegendColors);

  const colorTheme = useAppStore((s) => s.colorTheme);

  const fitOrtho = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const overlays = overlaysRef.current;
    const shell = shellCloneRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3();
    let has = false;
    const consider = (obj: THREE.Object3D) => {
      if (!obj.visible) return;
      const b = new THREE.Box3().setFromObject(obj);
      if (!b.isEmpty()) {
        box.union(b);
        has = true;
      }
    };
    if (overlays) consider(overlays);
    if (shell) consider(shell);
    if (!has) return;

    const { position, target, zoom } = frameBoundingBoxOrtho(box, camera);
    camera.position.copy(position);
    controls.target.copy(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    controls.update();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      THEME_COLORS[colorTheme].sceneBackground,
    );

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 5000);
    camera.position.set(0, 100, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "block h-full w-full touch-none";

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.1);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(20, 40, 10);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableRotate = false;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.2;
    controls.maxZoom = 40;

    const overlays = new THREE.Group();
    scene.add(overlays);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    overlaysRef.current = overlays;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const aspect = w / h;
      const frustum = 20;
      camera.left = (-frustum * aspect) / 2;
      camera.right = (frustum * aspect) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = new THREE.Color(
      THEME_COLORS[colorTheme].sceneBackground,
    );
  }, [colorTheme]);

  useEffect(() => {
    const scene = sceneRef.current;
    const overlays = overlaysRef.current;
    if (!scene || !overlays) return;

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
      const child = overlays.children[0] as THREE.Mesh;
      overlays.remove(child);
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material)?.dispose();
    }
    roomMeshById.current.clear();

    if (shellGroup) {
      const clone = shellGroup.clone(true);
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.material = new THREE.MeshStandardMaterial({
            color: 0xd5d8de,
            roughness: 0.85,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        }
      });
      scene.add(clone);
      shellCloneRef.current = clone;
    }

    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    for (const room of sourceRooms) {
      if (!room.geometry || room.geometry.attributes.position == null) continue;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(
          roomColor(
            room,
            colorMode,
            dataViewMode,
            activeColorPalette,
            heizlastRange,
            kuhllastRange,
            luftungRange,
            activeTemperatureRange,
            customLegendColors,
          ),
        ),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(room.geometry, material);
      mesh.userData.roomId = room.id;
      mesh.userData.floorId = room.floorId;
      overlays.add(mesh);
      roomMeshById.current.set(room.id, mesh);
    }

    requestAnimationFrame(() => fitOrtho());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellGroup, rooms, roomsFromStore]);

  useEffect(() => {
    const sourceRooms = rooms.length ? rooms : roomsFromStore;
    const byId = new Map(sourceRooms.map((r) => [r.id, r]));
    for (const [id, mesh] of roomMeshById.current) {
      const room = byId.get(id);
      if (!room) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(
        roomColor(
          room,
          colorMode,
          dataViewMode,
          activeColorPalette,
          heizlastRange,
          kuhllastRange,
          luftungRange,
            activeTemperatureRange,
          customLegendColors,
        ),
      );
    }
  }, [
    colorMode,
    dataViewMode,
    rooms,
    roomsFromStore,
    activeColorPalette,
    heizlastRange,
    kuhllastRange,
    luftungRange,
    activeTemperatureRange,
    customLegendColors,
  ]);

  useEffect(() => {
    // When a specific floor is selected, hide the shell clone entirely so that
    // walls/slabs from upper floors don't occlude rooms on lower floors in the
    // top-down orthographic view.  Only show room overlay meshes for the
    // selected floor — this allows the raycaster to pick rooms on any floor.
    if (shellCloneRef.current) {
      shellCloneRef.current.visible = selectedFloor == null;
    }
    overlaysRef.current?.children.forEach((child) => {
      const floorId = child.userData.floorId as string | undefined;
      if (!floorId) {
        child.visible = true;
        return;
      }
      child.visible = selectedFloor == null || floorId === selectedFloor;
    });
    requestAnimationFrame(() => fitOrtho());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloor, shellGroup, rooms]);

  useEffect(() => {
    const byId = new Map(
      (rooms.length ? rooms : roomsFromStore).map((r) => [r.id, r]),
    );
    for (const [id, mesh] of roomMeshById.current) {
      clearSelectionOutlines(mesh);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const room = byId.get(id);
      const passes =
        !activeFilter || !room || roomPassesFilter(room, activeFilter);
      const isSel = id === selectedRoomId;
      mat.opacity = !passes ? 0.1 : 0.65;
      if (room && passes) {
        const hasRoomSelection = Boolean(selectedRoomId);
        if (hasRoomSelection) {
          if (isSel) {
            const hex = roomColor(
              room,
              colorMode,
              dataViewMode,
              activeColorPalette,
              heizlastRange,
              kuhllastRange,
              luftungRange,
              activeTemperatureRange,
              customLegendColors,
            );
            mat.color.set(hex);
            mesh.renderOrder = 8;
          } else {
            mat.color.setHex(0xb0b0b0);
            mesh.renderOrder = 2;
          }
        } else {
          const hex = roomColor(
            room,
            colorMode,
            dataViewMode,
            activeColorPalette,
            heizlastRange,
            kuhllastRange,
            luftungRange,
            activeTemperatureRange,
            customLegendColors,
          );
          mat.color.set(hex);
          mesh.renderOrder = 2;
        }
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mesh.renderOrder = 2;
      }
    }
  }, [
    selectedRoomId,
    activeFilter,
    rooms,
    roomsFromStore,
    activeColorPalette,
    heizlastRange,
    kuhllastRange,
    luftungRange,
    dataViewMode,
    colorMode,
    activeTemperatureRange,
    customLegendColors,
  ]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;

    const pickRoom = (clientX: number, clientY: number): Room | null => {
      const camera = cameraRef.current;
      const overlays = overlaysRef.current;
      if (!camera || !overlays) return null;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointerNdc.current, camera);
      // Only intersect visible room meshes (active floor isolation)
      const visibleRooms = overlays.children.filter((child) => child.visible);
      const hits = raycaster.current.intersectObjects(visibleRooms, false);
      if (!hits.length) return null;
      const roomId = hits[0].object.userData.roomId as string | undefined;
      if (!roomId) return null;
      return (
        rooms.find((r) => r.id === roomId) ??
        roomsFromStore.find((r) => r.id === roomId) ??
        null
      );
    };

    const onMove = (e: PointerEvent) => {
      onPointerMove?.(e.clientX, e.clientY);
      if (!canHover()) {
        setHoveredRoom(null);
        canvas.style.cursor = "grab";
        return;
      }
      const room = pickRoom(e.clientX, e.clientY);
      setHoveredRoom(room);
      canvas.style.cursor = room ? "pointer" : "grab";
    };

    const onLeave = () => setHoveredRoom(null);

    let pointerDownX = 0;
    let pointerDownY = 0;
    let suppressNextClick = false;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      suppressNextClick = false;
    };

    const onClick = (e: PointerEvent) => {
      if (suppressNextClick) return;
      const dx = Math.abs(e.clientX - pointerDownX);
      const dy = Math.abs(e.clientY - pointerDownY);
      if (dx > 6 || dy > 6) return; // Ignore pick on camera pan/drag

      const room = pickRoom(e.clientX, e.clientY);
      if (room && isRoomPickAllowed(room.id, room.floorId)) {
        setSelectedRoomId(room.id);
      } else {
        setSelectedRoomId(null);
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("click", onClick);
    };
  }, [onPointerMove, rooms, roomsFromStore, setHoveredRoom, setSelectedRoomId]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {selectedFloorObj && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
          {selectedFloorObj.name}
        </div>
      )}
    </div>
  );
}
