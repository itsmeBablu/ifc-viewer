/**
 * Imperative Three.js layer for layout walls / doors / windows (live 3D).
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  joinedWallCenterlines,
  solveWallJunctions,
  pointOnWallMm,
  wallAngleRad,
  wallAngleAtPositionRad,
  type LayoutBeam,
  type LayoutColumn,
  type LayoutDoor,
  type LayoutGridLine,
  type LayoutLevel,
  type LayoutRamp,
  type LayoutSlab,
  type LayoutSketchLine,
  type LayoutStair,
  type LayoutWall,
  type LayoutWindow,
  type LayoutDuct,
  type LayoutPipe,
  type LayoutCableTray,
  type LayoutMepEquipment,
  type LayoutWire,
  type LayoutWorkPlane,
  type WallCenterlineMm,
  type WallMiterOffsets,
  type WallLayer,
  type WallLayerFunction,
  calculateRampMetrics,
  calculateStairMetrics,
  deriveRiseMm,
  getEquipmentConnectors,
  MEP_SYSTEM_COLORS,
} from "@/lib/layoutDrawing";
import {
  underlayHeightMm,
  underlayWidthMm,
  resolveUnderlayCalibration,
  type ReferenceUnderlay,
} from "@/lib/referenceUnderlay";
import { fromMm } from "@/lib/markupUnits";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useMaterialStore } from "@/store/materialStore";
import { getHatchCanvasTexture } from "@/lib/hatchPatterns";
import { DEFAULT_ELEMENT_TYPES } from "./EditTypeDialog";
import type { RenderMode } from "@/lib/types";

const WALL_COLOR = 0xcfd4dc;
const WALL_SEL = 0xfacc15;
const DOOR_COLOR = 0x78716c;
const WINDOW_COLOR = 0x38bdf8;
const FLOOR_COLOR = 0xa8a29e;
const FLOOR_SEL = 0xfacc15;
const ROOF_COLOR = 0x78716c;
const ROOF_SEL = 0xfacc15;
const STAIR_TREAD_COLOR = 0xd4a373;
const STAIR_SEL = 0xfacc15;
const RAMP_COLOR = 0x94a3b8;
const RAMP_SEL = 0xfacc15;

export default class LayoutSceneLayer {
  readonly group = new THREE.Group();
  private currentRenderMode: RenderMode = "fullColor";
  private wallMeshes = new Map<string, THREE.Group>();
  private doorMeshes = new Map<string, THREE.Group>();
  private windowMeshes = new Map<string, THREE.Group>();
  private slabMeshes = new Map<string, THREE.Mesh>();
  private columnMeshes = new Map<string, THREE.Mesh>();
  private beamMeshes = new Map<string, THREE.Mesh>();
  private gridMeshes = new Map<string, THREE.Group>();
  private stairMeshes = new Map<string, THREE.Group>();
  private rampMeshes = new Map<string, THREE.Group>();
  private ductMeshes = new Map<string, THREE.Mesh>();
  private pipeMeshes = new Map<string, THREE.Mesh>();
  private cableTrayMeshes = new Map<string, THREE.Mesh>();
  private equipmentMeshes = new Map<string, THREE.Group>();
  private wireMeshes = new Map<string, THREE.Group>();
  private workPlaneGroup = new THREE.Group();
  private previewLine: THREE.Group | null = null;
  private slabPreview: THREE.Group | null = null;
  private stairPreview: THREE.Group | null = null;
  private rampPreview: THREE.Group | null = null;
  private tracePreviewGroup: THREE.Group | null = null;
  private ground: THREE.Mesh | null = null;
  private levelSlabs = new Map<string, THREE.Mesh>();
  private underlayMeshes = new Map<string, THREE.Mesh>();
  private underlayTextures = new Map<string, THREE.Texture>();
  private underlayEdges = new Map<string, THREE.LineSegments>();
  private mepDimmingMaterialState = new WeakMap<
    THREE.Material,
    { opacity: number; transparent: boolean; depthWrite: boolean }
  >();
  private endpointGroup = new THREE.Group();
  private endpointStart: THREE.Mesh | null = null;
  private endpointEnd: THREE.Mesh | null = null;
  private sketchGroup = new THREE.Group();
  private structuralPreview = new THREE.Group();
  private mepPreview = new THREE.Group();

  onWallClick: ((id: string) => void) | null = null;
  onDoorClick: ((id: string) => void) | null = null;
  onWindowClick: ((id: string) => void) | null = null;

  constructor() {
    this.group.name = "layout-drawing-layer";
    this.endpointGroup.name = "layout-wall-endpoints";
    this.sketchGroup.name = "layout-sketch-lines";
    this.structuralPreview.name = "layout-structural-preview";
    this.mepPreview.name = "layout-mep-preview";
    this.workPlaneGroup.name = "layout-workplane-group";
    this.group.add(this.endpointGroup);
    this.group.add(this.sketchGroup);
    this.group.add(this.structuralPreview);
    this.group.add(this.mepPreview);
    this.group.add(this.workPlaneGroup);
  }

  setStructuralPreview(
    kind: "column" | "beam" | "grid" | null,
    cursor: { xMm: number; yMm: number } | null,
    start: { xMm: number; yMm: number } | null,
    elevationMm: number,
    levelHeightMm: number,
    widthMm: number,
    depthMm: number,
  ) {
    this.clearGroupContents(this.structuralPreview);
    if (!kind || !cursor) return;
    const yellow = 0xfacc15;
    if (kind === "column") {
      const height = fromMm(levelHeightMm);
      const geometry = new THREE.BoxGeometry(fromMm(widthMm), height, fromMm(depthMm));
      const material = new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(fromMm(cursor.xMm), fromMm(elevationMm) + height / 2, fromMm(cursor.yMm));
      mesh.renderOrder = 140;
      this.structuralPreview.add(mesh);
      return;
    }
    if (!start) return;
    const dx = fromMm(cursor.xMm - start.xMm), dz = fromMm(cursor.yMm - start.yMm);
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return;
    const y = kind === "beam"
      ? fromMm(elevationMm + levelHeightMm) - fromMm(depthMm) / 2
      : fromMm(elevationMm) + 0.1;
    const geometry = new THREE.BoxGeometry(length, kind === "beam" ? fromMm(depthMm) : 0.035, kind === "beam" ? fromMm(widthMm) : 0.065);
    const material = new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: kind === "beam" ? 0.58 : 0.95, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(fromMm((start.xMm + cursor.xMm) / 2), y, fromMm((start.yMm + cursor.yMm) / 2));
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.renderOrder = 140;
    this.structuralPreview.add(mesh);
  }

  ensureGround(elevationMm = 0) {
    if (!this.ground) {
      const geo = new THREE.PlaneGeometry(200, 200);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe7e5e4,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.ground = new THREE.Mesh(geo, mat);
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.name = "layout-ground";
      this.ground.userData.isLayoutGround = true;
      this.group.add(this.ground);
    }
    this.ground.position.y = fromMm(elevationMm);
    this.ground.visible = true;
  }

  syncLevelSlabs(levels: LayoutLevel[], walls: LayoutWall[], visible: boolean) {
    const keep = new Set(levels.map((l) => l.id));
    for (const [id, mesh] of this.levelSlabs) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.levelSlabs.delete(id);
      }
    }
    // Footprint from walls, or a default pad.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const w of walls) {
      minX = Math.min(minX, w.startXmm, w.endXmm);
      maxX = Math.max(maxX, w.startXmm, w.endXmm);
      minY = Math.min(minY, w.startYmm, w.endYmm);
      maxY = Math.max(maxY, w.startYmm, w.endYmm);
    }
    const pad = 2000;
    if (!Number.isFinite(minX)) {
      minX = -5000;
      maxX = 5000;
      minY = -5000;
      maxY = 5000;
    } else {
      minX -= pad;
      maxX += pad;
      minY -= pad;
      maxY += pad;
    }
    const sizeX = fromMm(Math.max(2000, maxX - minX));
    const sizeZ = fromMm(Math.max(2000, maxY - minY));
    const cx = fromMm((minX + maxX) / 2);
    const cz = fromMm((minY + maxY) / 2);

    for (const level of levels) {
      let mesh = this.levelSlabs.get(level.id);
      if (!mesh) {
        const geo = new THREE.BoxGeometry(1, fromMm(40), 1);
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.isLayoutLevelSlab = true;
        mesh.userData.layoutLevelId = level.id;
        mesh.renderOrder = -2;
        this.levelSlabs.set(level.id, mesh);
        this.group.add(mesh);
      }
      mesh.scale.set(sizeX, 1, sizeZ);
      mesh.position.set(cx, fromMm(level.elevationMm) + fromMm(20), cz);
      // Level datum pads are plan-editing helpers, not model geometry.
      mesh.visible = visible;
    }
  }

  hideGround() {
    if (this.ground) this.ground.visible = false;
  }

  sync(
    levels: LayoutLevel[],
    walls: LayoutWall[],
    doors: LayoutDoor[],
    windows: LayoutWindow[],
    slabs: LayoutSlab[],
    opts: {
      activeLevelId: string | null;
      selectedWallId: string | null;
      selectedDoorId: string | null;
      selectedWindowId: string | null;
      selectedSlabId: string | null;
      selectedWallIds?: Set<string>;
      selectedDoorIds?: Set<string>;
      selectedWindowIds?: Set<string>;
      selectedSlabIds?: Set<string>;
      showAllLevels: boolean;
      /** Top/plan view — CAD door/window symbols instead of 3D boxes. */
      planMode?: boolean;
    },
  ) {
    const planMode = Boolean(opts.planMode);
    this.isPlanModeActive = planMode;
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const wallKeep = new Set(walls.map((w) => w.id));
    for (const [id, grp] of this.wallMeshes) {
      if (!wallKeep.has(id)) {
        this.disposeGroup(grp);
        this.wallMeshes.delete(id);
      }
    }
    const joins = joinedWallCenterlines(walls);
    const miterJoins = solveWallJunctions(walls, joins);
    for (const wall of walls) {
      const level = levelById.get(wall.levelId);
      const elev = level?.elevationMm ?? 0;
      const visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        wall.levelId === opts.activeLevelId;
      const cl = joins.get(wall.id) ?? wall;
      const miter = miterJoins.get(wall.id);
      const wallDoors = doors.filter((d) => d.wallId === wall.id);
      const wallWindows = windows.filter((w) => w.wallId === wall.id);
      let grp = this.wallMeshes.get(wall.id);
      if (!grp) {
        grp = this.createWallMesh(wall, elev, cl, wallDoors, wallWindows, miter);
        this.wallMeshes.set(wall.id, grp);
        this.group.add(grp);
      } else {
        this.updateWallMesh(grp, wall, elev, cl, wallDoors, wallWindows, miter);
      }
      grp.visible = visible;
      const isWallSelected = wall.id === opts.selectedWallId || Boolean(opts.selectedWallIds?.has(wall.id));
      const layers = this.resolveWallLayers(wall);
      let layerIdx = 0;
      grp.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.isWallLayer) {
          const layer = layers[layerIdx++] || {
            id: "l-def",
            name: "Structure",
            function: "structure" as const,
            material: wall.material || "Concrete",
            thicknessMm: wall.thicknessMm || 200,
            color: wall.color,
          };
          if (child.material instanceof THREE.MeshStandardMaterial) {
            this.applyWallLayerMaterial(child.material, layer, wall, isWallSelected, this.currentRenderMode);
          }
        }
      });
      this.setMeshSelectionOutline(grp, isWallSelected);
    }

    const doorKeep = new Set(doors.map((d) => d.id));
    for (const [id, g] of this.doorMeshes) {
      if (!doorKeep.has(id)) {
        this.disposeGroup(g);
        this.doorMeshes.delete(id);
      }
    }
    for (const door of doors) {
      const wall = walls.find((w) => w.id === door.wallId);
      if (!wall) continue;
      const level = levelById.get(wall.levelId);
      const elev = level?.elevationMm ?? 0;
      const visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        wall.levelId === opts.activeLevelId;
      let g = this.doorMeshes.get(door.id);
      if (!g) {
        g = this.createOpeningGroup("Door", DOOR_COLOR);
        g.userData.layoutDoorId = door.id;
        this.doorMeshes.set(door.id, g);
        this.group.add(g);
      }
      // this.stripOpeningLabels(g);
      this.syncDoorPlanSymbol(g, wall, door, elev, planMode);
      g.visible = visible;
      const isDoorSelected = door.id === opts.selectedDoorId || Boolean(opts.selectedDoorIds?.has(door.id));
      this.tintOpening(g, isDoorSelected);
    }

    const winKeep = new Set(windows.map((w) => w.id));
    for (const [id, g] of this.windowMeshes) {
      if (!winKeep.has(id)) {
        this.disposeGroup(g);
        this.windowMeshes.delete(id);
      }
    }
    for (const win of windows) {
      const wall = walls.find((w) => w.id === win.wallId);
      if (!wall) continue;
      const level = levelById.get(wall.levelId);
      const elev = level?.elevationMm ?? 0;
      const visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        wall.levelId === opts.activeLevelId;
      let g = this.windowMeshes.get(win.id);
      if (!g) {
        g = this.createOpeningGroup("Window", WINDOW_COLOR);
        g.userData.layoutWindowId = win.id;
        this.windowMeshes.set(win.id, g);
        this.group.add(g);
      }
      // this.stripOpeningLabels(g);
      this.syncWindowPlanSymbol(g, wall, win, elev, planMode);
      g.visible = visible;
      const isWinSelected = win.id === opts.selectedWindowId || Boolean(opts.selectedWindowIds?.has(win.id));
      this.tintOpening(g, isWinSelected);
    }

    const slabKeep = new Set(slabs.map((s) => s.id));
    for (const [id, mesh] of this.slabMeshes) {
      if (!slabKeep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.slabMeshes.delete(id);
      }
    }
    for (const slab of slabs) {
      const level = levelById.get(slab.levelId);
      const elev = level?.elevationMm ?? 0;
      const visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        slab.levelId === opts.activeLevelId;
      let mesh = this.slabMeshes.get(slab.id);
      if (!mesh) {
        mesh = this.createSlabMesh(slab, elev);
        this.slabMeshes.set(slab.id, mesh);
        this.group.add(mesh);
      } else {
        this.updateSlabMesh(mesh, slab, elev);
      }
      mesh.visible = visible;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSlabSelected = slab.id === opts.selectedSlabId || Boolean(opts.selectedSlabIds?.has(slab.id));
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      const defaultColor = slab.kind === "roof" ? ROOF_COLOR : FLOOR_COLOR;
      this.applyMaterialAndColor(mat, slab.color, slab.material);
      if (!slab.color && !slab.material) {
        mat.color.setHex(defaultColor);
      }
      this.setMeshSelectionOutline(mesh, isSlabSelected);
    }

    this.syncEndpointHandles(
      walls.find((w) => w.id === opts.selectedWallId) ?? null,
      levelById,
      opts,
    );
  }

  syncColumns(
    columns: LayoutColumn[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedColumnIds: Set<string>;
      showAllLevels: boolean;
    },
  ) {
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const keep = new Set(columns.map((c) => c.id));
    for (const [id, mesh] of this.columnMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.columnMeshes.delete(id);
      }
    }

    for (const col of columns) {
      const level = levelById.get(col.levelId);
      const elev = level?.elevationMm ?? 0;
      const height = fromMm(col.heightMm ?? level?.heightMm ?? 3000);
      const isSelected = opts.selectedColumnIds.has(col.id);
      const w = fromMm(col.widthMm);
      const d = fromMm(col.depthMm);

      let mesh = this.columnMeshes.get(col.id);
      if (!mesh) {
        const geo =
          col.profile === "circle"
            ? new THREE.CylinderGeometry(w / 2, w / 2, height, 20)
            : new THREE.BoxGeometry(w, height, d);

        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x94a3b8,
          roughness: 0.5,
          metalness: 0.1,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.layoutColumnId = col.id;
        mesh.userData.kind = "column";
        this.columnMeshes.set(col.id, mesh);
        this.group.add(mesh);
      }

      const geometryKey = `${col.profile}:${col.widthMm}:${col.depthMm}:${height}`;
      if (mesh.userData.geometryKey !== geometryKey) {
        mesh.geometry.dispose();
        mesh.geometry = col.profile === "circle"
          ? new THREE.CylinderGeometry(w / 2, w / 2, height, 20)
          : new THREE.BoxGeometry(w, height, d);
        mesh.userData.geometryKey = geometryKey;
      }

      mesh.position.set(fromMm(col.xMm), fromMm(elev) + height / 2, fromMm(col.yMm));
      mesh.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        col.levelId === opts.activeLevelId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      this.applyMaterialAndColor(mat, col.color, col.material);
      if (!col.color && !col.material) mat.color.setHex(0x94a3b8);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      this.setMeshSelectionOutline(mesh, isSelected);
    }
  }

  syncBeams(
    beams: LayoutBeam[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedBeamIds: Set<string>;
      showAllLevels: boolean;
    },
  ) {
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const keep = new Set(beams.map((b) => b.id));
    for (const [id, mesh] of this.beamMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.beamMeshes.delete(id);
      }
    }

    for (const beam of beams) {
      const level = levelById.get(beam.levelId);
      const elev = level?.elevationMm ?? 0;
      const isSelected = opts.selectedBeamIds.has(beam.id);

      const dx = fromMm(beam.endXmm - beam.startXmm);
      const dz = fromMm(beam.endYmm - beam.startYmm);
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;

      const w = fromMm(beam.widthMm);
      const d = fromMm(beam.depthMm);

      let mesh = this.beamMeshes.get(beam.id);
      if (!mesh) {
        const geo = new THREE.BoxGeometry(len, d, w);
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x64748b,
          roughness: 0.4,
          metalness: 0.2,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.layoutBeamId = beam.id;
        mesh.userData.kind = "beam";
        this.beamMeshes.set(beam.id, mesh);
        this.group.add(mesh);
      }

      const geometryKey = `${len}:${beam.widthMm}:${beam.depthMm}`;
      if (mesh.userData.geometryKey !== geometryKey) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(len, d, w);
        mesh.userData.geometryKey = geometryKey;
      }

      mesh.position.set(
        fromMm((beam.startXmm + beam.endXmm) / 2),
        fromMm(elev + (level?.heightMm ?? 3000) + beam.elevationOffsetMm) - d / 2,
        fromMm((beam.startYmm + beam.endYmm) / 2),
      );
      mesh.rotation.y = -Math.atan2(dz, dx);
      mesh.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        beam.levelId === opts.activeLevelId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      this.applyMaterialAndColor(mat, beam.color, beam.material);
      if (!beam.color && !beam.material) mat.color.setHex(0x64748b);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      this.setMeshSelectionOutline(mesh, isSelected);
    }
  }

  syncGridLines(
    gridLines: LayoutGridLine[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedGridLineIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(gridLines.map((g) => g.id));
    for (const [id, grp] of this.gridMeshes) {
      if (!keep.has(id)) {
        this.disposeGroup(grp);
        this.group.remove(grp);
        this.gridMeshes.delete(id);
      }
    }

    const y = fromMm(opts.fallbackElevMm) + 0.05;

    for (const grid of gridLines) {
      const isSelected = opts.selectedGridLineIds.has(grid.id);
      const col = isSelected ? 0xfacc15 : 0x3b82f6;

      let grp = this.gridMeshes.get(grid.id);
      if (grp) {
        this.disposeGroup(grp);
        grp.clear();
      } else {
        grp = new THREE.Group();
        grp.name = `grid-${grid.id}`;
        grp.userData.layoutGridId = grid.id;
        this.gridMeshes.set(grid.id, grp);
        this.group.add(grp);
      }

      const p1 = new THREE.Vector3(fromMm(grid.startXmm), y, fromMm(grid.startYmm));
      const p2 = new THREE.Vector3(fromMm(grid.endXmm), y, fromMm(grid.endYmm));

      // Grid line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineDashedMaterial({
        color: col,
        dashSize: 0.4,
        gapSize: 0.2,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      lineMesh.computeLineDistances();
      lineMesh.renderOrder = 110;
      grp.add(lineMesh);

      // Bubble tag at endpoints
      for (const pt of [p1, p2]) {
        const bubbleGeo = new THREE.CircleGeometry(0.35, 24);
        bubbleGeo.rotateX(-Math.PI / 2);
        const bubbleMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
        bubble.position.copy(pt);
        bubble.renderOrder = 112;
        grp.add(bubble);

        // Ring around bubble
        const ringGeo = new THREE.RingGeometry(0.32, 0.36, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: col,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pt);
        ring.position.y += 0.002;
        ring.renderOrder = 113;
        grp.add(ring);
      }
    }
  }

  syncStairs(
    stairs: LayoutStair[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedStairIds: Set<string>;
      showAllLevels: boolean;
      planMode?: boolean;
    },
  ) {
    const keep = new Set(stairs.map((s) => s.id));
    for (const [id, grp] of this.stairMeshes) {
      if (!keep.has(id)) {
        this.disposeGroup(grp);
        this.group.remove(grp);
        this.stairMeshes.delete(id);
      }
    }

    const planMode = Boolean(opts.planMode ?? this.isPlanModeActive);

    for (const stair of stairs) {
      const isSelected = opts.selectedStairIds.has(stair.id);
      const isVisible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        stair.levelId === opts.activeLevelId ||
        stair.topLevelId === opts.activeLevelId;

      let grp = this.stairMeshes.get(stair.id);
      if (grp) {
        this.clearGroupContents(grp);
      } else {
        grp = new THREE.Group();
        grp.name = `stair-${stair.id}`;
        grp.userData.layoutStairId = stair.id;
        grp.userData.kind = "stair";
        this.stairMeshes.set(stair.id, grp);
        this.group.add(grp);
      }

      this.buildStairGeometry(grp, stair, levels, isSelected, planMode);
      grp.visible = isVisible;
    }
  }

  syncRamps(
    ramps: LayoutRamp[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedRampIds: Set<string>;
      showAllLevels: boolean;
      planMode?: boolean;
    },
  ) {
    const keep = new Set(ramps.map((r) => r.id));
    for (const [id, grp] of this.rampMeshes) {
      if (!keep.has(id)) {
        this.disposeGroup(grp);
        this.group.remove(grp);
        this.rampMeshes.delete(id);
      }
    }

    const planMode = Boolean(opts.planMode ?? this.isPlanModeActive);

    for (const ramp of ramps) {
      const isSelected = opts.selectedRampIds.has(ramp.id);
      const isVisible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        ramp.levelId === opts.activeLevelId ||
        ramp.topLevelId === opts.activeLevelId;

      let grp = this.rampMeshes.get(ramp.id);
      if (grp) {
        this.clearGroupContents(grp);
      } else {
        grp = new THREE.Group();
        grp.name = `ramp-${ramp.id}`;
        grp.userData.layoutRampId = ramp.id;
        grp.userData.kind = "ramp";
        this.rampMeshes.set(ramp.id, grp);
        this.group.add(grp);
      }

      this.buildRampGeometry(grp, ramp, levels, isSelected, planMode);
      grp.visible = isVisible;
    }
  }

  syncUnderlays(
    underlays: ReferenceUnderlay[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      showAllLevels: boolean;
      selectedUnderlayId: string | null;
      calibratePoints?: { xMm: number; yMm: number }[];
      /** Extra elevations (mm) for IFC floors that aren't layout levels. */
      floorElevationMm?: Record<string, number>;
    },
  ) {
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const keep = new Set(underlays.map((u) => u.id));
    for (const [id, mesh] of this.underlayMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.underlayMeshes.delete(id);
        const tex = this.underlayTextures.get(id);
        if (tex) {
          tex.dispose();
          this.underlayTextures.delete(id);
        }
        const edge = this.underlayEdges.get(id);
        if (edge) {
          this.group.remove(edge);
          edge.geometry.dispose();
          (edge.material as THREE.Material).dispose();
          this.underlayEdges.delete(id);
        }
      }
    }
    for (const u of underlays) {
      const level = levelById.get(u.levelId);
      const elev =
        level?.elevationMm ??
        opts.floorElevationMm?.[u.levelId] ??
        0;
      const show =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        u.levelId === opts.activeLevelId;
      let mesh = this.underlayMeshes.get(u.id);
      if (!mesh) {
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: u.opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = -2;
        mesh.userData.isLayoutUnderlay = true;
        mesh.userData.layoutUnderlayId = u.id;
        this.underlayMeshes.set(u.id, mesh);
        this.group.add(mesh);
        this.loadUnderlayTexture(u.id, u.imageDataUrl, mat);

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            depthTest: false,
          }),
        );
        edges.renderOrder = -1;
        edges.visible = false;
        edges.userData.isUnderlayEdge = true;
        this.underlayEdges.set(u.id, edges);
        this.group.add(edges);
      } else {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = u.opacity;
        if (mesh.userData.imageDataUrl !== u.imageDataUrl) {
          this.loadUnderlayTexture(u.id, u.imageDataUrl, mat);
        }
      }
      const cal = resolveUnderlayCalibration(u, u.levelId);
      const w = fromMm(underlayWidthMm(u, u.levelId));
      const h = fromMm(underlayHeightMm(u, u.levelId));
      mesh.scale.set(w, h, 1);
      mesh.position.set(
        fromMm(cal.offsetXmm),
        fromMm(elev) - 0.004,
        fromMm(cal.offsetYmm),
      );
      mesh.rotation.set(-Math.PI / 2, 0, (-cal.rotationDeg * Math.PI) / 180);
      mesh.visible = show;
      mesh.userData.layoutUnderlayId = u.id;
      mesh.userData.locked = u.locked;
      const selected = u.id === opts.selectedUnderlayId;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = selected ? Math.min(1, u.opacity + 0.1) : u.opacity;

      const edge = this.underlayEdges.get(u.id);
      if (edge) {
        edge.position.copy(mesh.position);
        edge.rotation.copy(mesh.rotation);
        edge.scale.copy(mesh.scale);
        edge.visible = show && selected;
        const em = edge.material as THREE.LineBasicMaterial;
        em.color.setHex(u.locked ? 0x94a3b8 : 0xf59e0b);
      }
    }

    this.syncCalibrateMarkers(
      opts.calibratePoints ?? [],
      levels,
      opts.activeLevelId,
      opts.floorElevationMm,
    );
  }

  private calibrateMarkers: THREE.Mesh[] = [];

  private syncCalibrateMarkers(
    points: { xMm: number; yMm: number }[],
    levels: LayoutLevel[],
    activeLevelId: string | null,
    floorElevationMm?: Record<string, number>,
  ) {
    while (this.calibrateMarkers.length > points.length) {
      const m = this.calibrateMarkers.pop()!;
      this.group.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    const elev =
      levels.find((l) => l.id === activeLevelId)?.elevationMm ??
      (activeLevelId ? floorElevationMm?.[activeLevelId] : undefined) ??
      0;
    points.forEach((p, i) => {
      let m = this.calibrateMarkers[i];
      if (!m) {
        const geo = new THREE.SphereGeometry(fromMm(80), 12, 10);
        const mat = new THREE.MeshBasicMaterial({
          color: i === 0 ? 0x22c55e : 0xef4444,
          depthTest: false,
        });
        m = new THREE.Mesh(geo, mat);
        m.renderOrder = 25;
        m.userData.isCalibrateMarker = true;
        this.calibrateMarkers.push(m);
        this.group.add(m);
      }
      m.position.set(fromMm(p.xMm), fromMm(elev) + 0.05, fromMm(p.yMm));
      m.visible = true;
    });
  }

  private loadUnderlayTexture(
    id: string,
    dataUrl: string,
    mat: THREE.MeshBasicMaterial,
  ) {
    const prev = this.underlayTextures.get(id);
    if (prev) prev.dispose();
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.underlayTextures.set(id, tex);
      mat.map = tex;
      mat.needsUpdate = true;
      const mesh = this.underlayMeshes.get(id);
      if (mesh) mesh.userData.imageDataUrl = dataUrl;
    });
  }

  private ensureEndpointMeshes() {
    if (this.endpointStart && this.endpointEnd) return;
    const make = (end: "start" | "end") => {
      const geo = new THREE.SphereGeometry(fromMm(36), 14, 12);
      const mat = new THREE.MeshPhysicalMaterial({
        color: end === "start" ? 0x38bdf8 : 0xf472b6,
        emissive: end === "start" ? 0x0ea5e9 : 0xdb2777,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.2,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 120;
      mesh.userData.layoutWallEndpoint = end;
      mesh.userData.isLayoutEndpoint = true;
      this.endpointGroup.add(mesh);
      return mesh;
    };
    this.endpointStart = make("start");
    this.endpointEnd = make("end");
  }

  private syncEndpointHandles(
    wall: LayoutWall | null,
    levelById: Map<string, LayoutLevel>,
    opts: {
      activeLevelId: string | null;
      showAllLevels: boolean;
    },
  ) {
    this.ensureEndpointMeshes();
    if (!wall || !this.endpointStart || !this.endpointEnd) {
      this.endpointGroup.visible = false;
      return;
    }
    const visible =
      opts.showAllLevels ||
      opts.activeLevelId == null ||
      wall.levelId === opts.activeLevelId;
    if (!visible) {
      this.endpointGroup.visible = false;
      return;
    }
    const elev = levelById.get(wall.levelId)?.elevationMm ?? 0;
    const y = fromMm(elev) + fromMm(wall.heightMm) * 0.55;
    this.endpointStart.position.set(
      fromMm(wall.startXmm),
      y,
      fromMm(wall.startYmm),
    );
    this.endpointEnd.position.set(fromMm(wall.endXmm), y, fromMm(wall.endYmm));
    this.endpointStart.userData.layoutWallId = wall.id;
    this.endpointEnd.userData.layoutWallId = wall.id;
    this.endpointGroup.visible = true;
  }

  setWallPreview(
    points: { xMm: number; yMm: number }[],
    cursor: { xMm: number; yMm: number } | null,
    elevationMm: number,
    snapType: string | null = null,
    thicknessMm = 200,
    heightMm = 3000,
  ) {
    if (this.previewLine) {
      this.disposeGroup(this.previewLine);
      this.group.remove(this.previewLine);
      this.previewLine = null;
    }
    if (points.length === 0) return;
    const pts = [...points];
    if (cursor) pts.push(cursor);
    if (pts.length < 2) return;

    const g = new THREE.Group();
    g.name = "layout-wall-preview";

    const y = fromMm(elevationMm) + 0.08;
    const col = 0xfacc15;
    const RIBBON_W = 0.08;
    const RIBBON_H = 0.04;

    const positions: THREE.Vector3[] = [];
    for (const p of pts) {
      positions.push(new THREE.Vector3(fromMm(p.xMm), y, fromMm(p.yMm)));
    }

    // Full-size live wall volume for the currently drafted segment.
    if (cursor && points.length) {
      const start = points[points.length - 1];
      const dxMm = cursor.xMm - start.xMm;
      const dzMm = cursor.yMm - start.yMm;
      const lengthMm = Math.hypot(dxMm, dzMm);
      if (lengthMm >= 10) {
        const length = fromMm(lengthMm);
        const thickness = fromMm(Math.max(50, thicknessMm));
        const height = fromMm(Math.max(50, heightMm));
        const angle = Math.atan2(dzMm, dxMm);
        const volumeGeo = new THREE.BoxGeometry(length, height, thickness);
        const volumeMat = new THREE.MeshPhysicalMaterial({
          color: 0x60a5fa,
          transparent: true,
          opacity: 0.34,
          roughness: 0.65,
          metalness: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const volume = new THREE.Mesh(volumeGeo, volumeMat);
        volume.position.set(
          fromMm((start.xMm + cursor.xMm) / 2),
          fromMm(elevationMm) + height / 2,
          fromMm((start.yMm + cursor.yMm) / 2),
        );
        volume.rotation.y = -angle;
        volume.renderOrder = 145;
        volume.userData.isLayoutPreview = true;
        g.add(volume);

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(volumeGeo),
          new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.95 }),
        );
        edges.position.copy(volume.position);
        edges.rotation.copy(volume.rotation);
        edges.renderOrder = 146;
        g.add(edges);

        // Dashed footprint on the active level plane: two wall faces plus caps.
        const nx = -Math.sin(angle) * thickness / 2;
        const nz = Math.cos(angle) * thickness / 2;
        const sx = fromMm(start.xMm), sz = fromMm(start.yMm);
        const ex = fromMm(cursor.xMm), ez = fromMm(cursor.yMm);
        const floorY = fromMm(elevationMm) + 0.018;
        const footprint = [
          new THREE.Vector3(sx + nx, floorY, sz + nz),
          new THREE.Vector3(ex + nx, floorY, ez + nz),
          new THREE.Vector3(ex - nx, floorY, ez - nz),
          new THREE.Vector3(sx - nx, floorY, sz - nz),
          new THREE.Vector3(sx + nx, floorY, sz + nz),
        ];
        const guideMat = new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 0.16, gapSize: 0.09, depthTest: false });
        const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(footprint), guideMat);
        outline.computeLineDistances();
        outline.renderOrder = 165;
        g.add(outline);
        const center = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sx, floorY + 0.003, sz),
            new THREE.Vector3(ex, floorY + 0.003, ez),
          ]),
          guideMat.clone(),
        );
        center.computeLineDistances();
        center.renderOrder = 166;
        g.add(center);
      }
    }

    // 1. Centerline basic line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(positions);
    const lineMat = new THREE.LineBasicMaterial({ color: col, linewidth: 2 });
    const lineMesh = new THREE.Line(lineGeo, lineMat);
    lineMesh.renderOrder = 150;
    lineMesh.frustumCulled = false;
    g.add(lineMesh);

    // 2. Ribbon segments for 2D/3D plan view visibility
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        const segGeo = new THREE.BoxGeometry(len, RIBBON_H, RIBBON_W * 2);
        const segMat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
        });
        const segMesh = new THREE.Mesh(segGeo, segMat);
        segMesh.position.set((p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2);
        segMesh.rotation.y = -Math.atan2(dz, dx);
        segMesh.renderOrder = 151;
        segMesh.frustumCulled = false;
        g.add(segMesh);
      }
    }

    // 3. Node discs
    for (const pt of positions) {
      const discGeo = new THREE.CircleGeometry(0.06, 16);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.copy(pt);
      disc.position.y = y + 0.005;
      disc.renderOrder = 152;
      disc.frustumCulled = false;
      g.add(disc);
    }

    // Acquired OSNAP marker: high-contrast and always visible over geometry.
    if (cursor && snapType) {
      const snap = positions[positions.length - 1];
      const marker = new THREE.Group();
      marker.position.set(snap.x, y + 0.025, snap.z);
      const color = snapType === "intersection" ? 0xff4fd8 : 0x22d3ee;
      const ringGeo = new THREE.RingGeometry(0.095, 0.135, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, material);
      ring.renderOrder = 170;
      marker.add(ring);
      const crossGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(0.18, 0, 0),
        new THREE.Vector3(0, 0, -0.18), new THREE.Vector3(0, 0, 0.18),
      ]);
      const cross = new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({ color, depthTest: false }));
      cross.renderOrder = 171;
      marker.add(cross);
      marker.userData.snapType = snapType;
      g.add(marker);
    }

    this.previewLine = g;
    this.group.add(g);
  }



  /**
   * Tier 2 auto-trace hover preview — highlighted wall box (and opening mark).
   */
  setTracePreview(
    candidate: {
      kind: "wall" | "door" | "window";
      startXmm: number;
      startYmm: number;
      endXmm: number;
      endYmm: number;
      thicknessMm: number;
      positionMm?: number;
      widthMm?: number;
      confidence: number;
    } | null,
    elevationMm: number,
    heightMm: number,
  ) {
    if (this.tracePreviewGroup) {
      this.disposeGroup(this.tracePreviewGroup);
      this.tracePreviewGroup = null;
    }
    if (!candidate) return;

    const dx = candidate.endXmm - candidate.startXmm;
    const dy = candidate.endYmm - candidate.startYmm;
    const len = Math.hypot(dx, dy);
    if (len < 50) return;

    const confident = candidate.confidence >= 0.55;
    const color =
      candidate.kind === "door"
        ? confident
          ? 0xf59e0b
          : 0xd97706
        : candidate.kind === "window"
          ? confident
            ? 0x38bdf8
            : 0x0284c7
          : confident
            ? 0x22c55e
            : 0xa3e635;

    const g = new THREE.Group();
    g.name = "layout-trace-preview";
    g.userData.isLayoutPreview = true;
    g.renderOrder = 20;

    const thick = fromMm(Math.max(candidate.thicknessMm, 120));
    const height = fromMm(Math.min(Math.max(heightMm * 0.35, 600), 1800));
    const wallGeo = new THREE.BoxGeometry(fromMm(len), height, thick);
    const wallMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: confident ? 0.55 : 0.4,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(wallGeo, wallMat);
    const angle = Math.atan2(dy, dx);
    mesh.position.set(
      fromMm((candidate.startXmm + candidate.endXmm) / 2),
      fromMm(elevationMm) + height / 2,
      fromMm((candidate.startYmm + candidate.endYmm) / 2),
    );
    mesh.rotation.y = -angle;
    mesh.renderOrder = 21;
    g.add(mesh);

    // Bright centerline on top
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        fromMm(candidate.startXmm),
        fromMm(elevationMm) + height + 0.05,
        fromMm(candidate.startYmm),
      ),
      new THREE.Vector3(
        fromMm(candidate.endXmm),
        fromMm(elevationMm) + height + 0.05,
        fromMm(candidate.endYmm),
      ),
    ]);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        depthTest: false,
      }),
    );
    line.renderOrder = 22;
    g.add(line);

    if (
      (candidate.kind === "door" || candidate.kind === "window") &&
      candidate.positionMm != null &&
      candidate.widthMm != null
    ) {
      const t = candidate.positionMm / len;
      const ux = dx / len;
      const uy = dy / len;
      const half = candidate.widthMm / 2;
      const cx = candidate.startXmm + ux * candidate.positionMm;
      const cy = candidate.startYmm + uy * candidate.positionMm;
      const openGeo = new THREE.BoxGeometry(
        fromMm(candidate.widthMm),
        fromMm(Math.min(candidate.kind === "door" ? 2100 : 1400, heightMm)),
        fromMm(Math.max(candidate.thicknessMm + 40, 80)),
      );
      const openMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const open = new THREE.Mesh(openGeo, openMat);
      open.position.set(
        fromMm(cx),
        fromMm(elevationMm) +
          fromMm(candidate.kind === "window" ? 900 : 0) +
          fromMm(candidate.kind === "door" ? 1050 : 700),
        fromMm(cy),
      );
      open.rotation.y = -angle;
      g.add(open);
      void half;
      void t;
    }

    this.tracePreviewGroup = g;
    this.group.add(g);
  }

  setSlabPreview(
    start: { xMm: number; yMm: number } | null,
    cursor: { xMm: number; yMm: number } | null,
    elevationMm: number,
    thicknessMm: number,
    kind: "floor" | "roof",
  ) {
    if (this.slabPreview) {
      this.disposeGroup(this.slabPreview);
      this.group.remove(this.slabPreview);
      this.slabPreview = null;
    }
    if (!start || !cursor) return;
    const minX = Math.min(start.xMm, cursor.xMm);
    const maxX = Math.max(start.xMm, cursor.xMm);
    const minY = Math.min(start.yMm, cursor.yMm);
    const maxY = Math.max(start.yMm, cursor.yMm);
    if (maxX - minX < 10 || maxY - minY < 10) return;

    const g = new THREE.Group();
    g.name = "layout-slab-preview";

    const x1 = fromMm(minX);
    const x2 = fromMm(maxX);
    const z1 = fromMm(minY);
    const z2 = fromMm(maxY);
    const w = x2 - x1;
    const d = z2 - z1;
    const t = fromMm(Math.max(50, thicknessMm));
    const topY = fromMm(elevationMm) + (kind === "roof" ? 0 : t) + 0.02;

    // 1. Semi-transparent volume box
    const geo = new THREE.BoxGeometry(w, t, d);
    const mat = new THREE.MeshPhysicalMaterial({
      color: kind === "roof" ? ROOF_COLOR : FLOOR_COLOR,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const boxMesh = new THREE.Mesh(geo, mat);
    boxMesh.position.set(
      (x1 + x2) / 2,
      fromMm(elevationMm) + (kind === "roof" ? -t / 2 : t / 2),
      (z1 + z2) / 2,
    );
    boxMesh.userData.isLayoutPreview = true;
    g.add(boxMesh);

    // 2. Bright yellow perimeter drawing line on the top surface
    const perimeterPts = [
      new THREE.Vector3(x1, topY, z1),
      new THREE.Vector3(x2, topY, z1),
      new THREE.Vector3(x2, topY, z2),
      new THREE.Vector3(x1, topY, z2),
      new THREE.Vector3(x1, topY, z1),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(perimeterPts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      linewidth: 2,
    });
    const lineMesh = new THREE.Line(lineGeo, lineMat);
    lineMesh.renderOrder = 150;
    lineMesh.frustumCulled = false;
    g.add(lineMesh);

    // 3. Thick flat boundary ribbons for top view visibility
    const col = 0xfacc15;
    const RIBBON_W = 0.06;
    const RIBBON_H = 0.02;

    const makeRibbonSegment = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.001) return;
      const segGeo = new THREE.BoxGeometry(len, RIBBON_H, RIBBON_W * 2);
      const segMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set((p1.x + p2.x) / 2, topY, (p1.z + p2.z) / 2);
      segMesh.rotation.y = -Math.atan2(dz, dx);
      segMesh.renderOrder = 151;
      segMesh.frustumCulled = false;
      g.add(segMesh);
    };

    makeRibbonSegment(perimeterPts[0], perimeterPts[1]);
    makeRibbonSegment(perimeterPts[1], perimeterPts[2]);
    makeRibbonSegment(perimeterPts[2], perimeterPts[3]);
    makeRibbonSegment(perimeterPts[3], perimeterPts[4]);

    // 4. Corner dots (discs in XZ plane at 4 corners)
    for (const pt of [perimeterPts[0], perimeterPts[1], perimeterPts[2], perimeterPts[3]]) {
      const discGeo = new THREE.CircleGeometry(0.08, 16);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.copy(pt);
      disc.position.y = topY + 0.005;
      disc.renderOrder = 152;
      disc.frustumCulled = false;
      g.add(disc);
    }

    this.slabPreview = g;
    this.group.add(g);
  }

  setStairPreview(
    start: { xMm: number; yMm: number } | null,
    cursor: { xMm: number; yMm: number } | null,
    elevationMm: number,
    levelHeightMm: number,
    widthMm: number,
    targetRiserMm: number,
    treadDepthMm: number,
    stairType: import("@/lib/layoutDrawing").StairShapeType = "straight",
  ) {
    if (this.stairPreview) {
      this.disposeGroup(this.stairPreview);
      this.group.remove(this.stairPreview);
      this.stairPreview = null;
    }
    if (!start || !cursor) return;

    const dxMm = cursor.xMm - start.xMm;
    const dzMm = cursor.yMm - start.yMm;
    const lengthMm = Math.hypot(dxMm, dzMm);
    if (lengthMm < 50) return;

    const g = new THREE.Group();
    g.name = "layout-stair-preview";
    g.userData.isLayoutPreview = true;

    const dummyStair: LayoutStair = {
      id: "preview-stair",
      projectId: "",
      levelId: "preview-level",
      stairType,
      startXmm: start.xMm,
      startYmm: start.yMm,
      endXmm: cursor.xMm,
      endYmm: cursor.yMm,
      widthMm,
      targetRiserHeightMm: targetRiserMm,
      treadDepthMm,
      nosingDepthMm: 25,
      hasRailingLeft: true,
      hasRailingRight: true,
      createdAt: Date.now(),
    };

    const dummyLevel: LayoutLevel = {
      id: "preview-level",
      projectId: "",
      name: "Preview",
      elevationMm,
      heightMm: levelHeightMm,
      createdAt: Date.now(),
    };

    this.buildStairGeometry(g, dummyStair, [dummyLevel], true, false);

    g.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.transparent = true;
        child.material.opacity = 0.6;
        child.material.depthWrite = false;
      }
    });

    this.stairPreview = g;
    this.group.add(g);
  }

  setRampPreview(
    start: { xMm: number; yMm: number } | null,
    cursor: { xMm: number; yMm: number } | null,
    elevationMm: number,
    levelHeightMm: number,
    widthMm: number,
    thicknessMm: number,
  ) {
    if (this.rampPreview) {
      this.disposeGroup(this.rampPreview);
      this.group.remove(this.rampPreview);
      this.rampPreview = null;
    }
    if (!start || !cursor) return;

    const dxMm = cursor.xMm - start.xMm;
    const dzMm = cursor.yMm - start.yMm;
    const lengthMm = Math.hypot(dxMm, dzMm);
    if (lengthMm < 50) return;

    const g = new THREE.Group();
    g.name = "layout-ramp-preview";
    g.userData.isLayoutPreview = true;

    const dummyRamp: LayoutRamp = {
      id: "preview-ramp",
      projectId: "",
      levelId: "preview-level",
      startXmm: start.xMm,
      startYmm: start.yMm,
      endXmm: cursor.xMm,
      endYmm: cursor.yMm,
      widthMm,
      thicknessMm,
      hasRailingLeft: true,
      hasRailingRight: true,
      createdAt: Date.now(),
    };

    const dummyLevel: LayoutLevel = {
      id: "preview-level",
      projectId: "",
      name: "Preview",
      elevationMm,
      heightMm: levelHeightMm,
      createdAt: Date.now(),
    };

    this.buildRampGeometry(g, dummyRamp, [dummyLevel], true, false);

    g.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.transparent = true;
        child.material.opacity = 0.6;
        child.material.depthWrite = false;
      }
    });

    this.rampPreview = g;
    this.group.add(g);
  }

  private buildStairGeometry(
    root: THREE.Group,
    stair: LayoutStair,
    levels: LayoutLevel[],
    isSelected: boolean,
    planMode: boolean,
  ) {
    const baseLevel = levels.find((l) => l.id === stair.levelId);
    const baseElevMm = (baseLevel?.elevationMm ?? 0) + (stair.baseOffsetMm || 0);
    const totalRiseMm = deriveRiseMm(
      levels,
      stair.levelId,
      stair.topLevelId,
      stair.baseOffsetMm,
      stair.topOffsetMm,
    );
    const metrics = calculateStairMetrics(
      totalRiseMm,
      stair.targetRiserHeightMm,
      stair.treadDepthMm,
    );
    const { riserCount, actualRiserMm } = metrics;
    const treadDepthMm = stair.treadDepthMm || 280;
    const widthMm = stair.widthMm || 1000;
    const nosingMm = stair.nosingDepthMm ?? 25;
    const railingHeightMm = stair.railingHeightMm ?? 900;
    const hasRailLeft = stair.hasRailingLeft !== false;
    const hasRailRight = stair.hasRailingRight !== false;

    const baseElevM = fromMm(baseElevMm);
    const widthM = fromMm(widthMm);
    const riserM = fromMm(actualRiserMm);
    const treadM = fromMm(treadDepthMm);
    const nosingM = fromMm(nosingMm);
    const railHM = fromMm(railingHeightMm);

    const treadMat = new THREE.MeshStandardMaterial({
      color: isSelected ? STAIR_SEL : (stair.color ? parseInt(stair.color.replace("#", ""), 16) : STAIR_TREAD_COLOR),
      roughness: 0.6,
      metalness: 0.1,
    });
    const riserMat = new THREE.MeshStandardMaterial({
      color: isSelected ? STAIR_SEL : 0xf1f5f9,
      roughness: 0.7,
      metalness: 0.05,
    });
    const stringerMat = new THREE.MeshStandardMaterial({
      color: isSelected ? STAIR_SEL : 0x475569,
      roughness: 0.5,
      metalness: 0.3,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: isSelected ? STAIR_SEL : 0x1e293b,
      roughness: 0.3,
      metalness: 0.8,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: isSelected ? STAIR_SEL : 0x334155,
      roughness: 0.4,
      metalness: 0.7,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
    });

    const dxMm = stair.endXmm - stair.startXmm;
    const dzMm = stair.endYmm - stair.startYmm;
    const lengthMm = Math.hypot(dxMm, dzMm);
    const angle = Math.atan2(dzMm, dxMm);
    const startM = new THREE.Vector3(fromMm(stair.startXmm), baseElevM, fromMm(stair.startYmm));

    if (stair.stairType === "spiral") {
      this.buildSpiralStair(
        root,
        stair,
        startM,
        riserCount,
        actualRiserMm,
        totalRiseMm,
        treadMat,
        postMat,
        railMat,
        isSelected,
        planMode,
      );
      return;
    }

    if (stair.stairType === "l-shape") {
      this.buildLShapeStair(
        root,
        stair,
        startM,
        levels,
        riserCount,
        actualRiserMm,
        totalRiseMm,
        widthMm,
        treadDepthMm,
        nosingMm,
        treadMat,
        riserMat,
        stringerMat,
        postMat,
        railMat,
        glassMat,
        isSelected,
        planMode,
      );
      return;
    }

    if (stair.stairType === "u-shape") {
      this.buildUShapeStair(
        root,
        stair,
        startM,
        levels,
        riserCount,
        actualRiserMm,
        totalRiseMm,
        widthMm,
        treadDepthMm,
        nosingMm,
        treadMat,
        riserMat,
        stringerMat,
        postMat,
        railMat,
        glassMat,
        isSelected,
        planMode,
      );
      return;
    }

    // Straight stair
    const stepCount = Math.max(1, riserCount);
    const runTotalLengthM = fromMm(Math.max(lengthMm, (stepCount - 1) * treadDepthMm));
    const stepRunM = (stepCount > 1 ? runTotalLengthM / (stepCount - 1) : treadM);

    if (planMode) {
      this.buildStraightStairPlanSymbol(
        root,
        stair,
        startM,
        angle,
        stepCount,
        stepRunM,
        widthM,
        isSelected,
      );
      return;
    }

    const stairFlight = new THREE.Group();
    stairFlight.position.copy(startM);
    stairFlight.rotation.y = -angle;

    // Steps (Risers + Treads)
    for (let i = 0; i < stepCount; i++) {
      const stepY = i * riserM;
      const stepX = i * stepRunM;

      const riserGeo = new THREE.BoxGeometry(0.02, riserM, widthM);
      const riserMesh = new THREE.Mesh(riserGeo, riserMat);
      riserMesh.position.set(stepX, stepY + riserM / 2, 0);
      stairFlight.add(riserMesh);

      const treadBoardLen = stepRunM + nosingM;
      const treadGeo = new THREE.BoxGeometry(treadBoardLen, 0.03, widthM);
      const treadMesh = new THREE.Mesh(treadGeo, treadMat);
      treadMesh.position.set(stepX + treadBoardLen / 2 - nosingM, stepY + riserM - 0.015, 0);
      stairFlight.add(treadMesh);
    }

    // Side stringers
    const stringerThick = 0.04;
    const stringerHeight = 0.2;
    const totalRiseM = fromMm(totalRiseMm);
    const slopeLenM = Math.hypot(runTotalLengthM, totalRiseM);
    const slopeAngle = Math.atan2(totalRiseM, runTotalLengthM);

    for (const side of [-1, 1]) {
      const stringerGeo = new THREE.BoxGeometry(slopeLenM, stringerHeight, stringerThick);
      const stringerMesh = new THREE.Mesh(stringerGeo, stringerMat);
      stringerMesh.position.set(
        runTotalLengthM / 2,
        totalRiseM / 2 - 0.05,
        side * (widthM / 2 + stringerThick / 2),
      );
      stringerMesh.rotation.z = slopeAngle;
      stairFlight.add(stringerMesh);
    }

    // Auto-generated Railings
    if (hasRailLeft || hasRailRight) {
      for (const side of [-1, 1]) {
        if (side === -1 && !hasRailLeft) continue;
        if (side === 1 && !hasRailRight) continue;
        const zOffset = side * (widthM / 2 - 0.03);

        const handrailGeo = new THREE.CylinderGeometry(0.02, 0.02, slopeLenM, 12);
        handrailGeo.rotateZ(-Math.PI / 2 + slopeAngle);
        const handrailMesh = new THREE.Mesh(handrailGeo, railMat);
        handrailMesh.position.set(
          runTotalLengthM / 2,
          totalRiseM / 2 + railHM,
          zOffset,
        );
        stairFlight.add(handrailMesh);

        const postSpacingSteps = Math.max(1, Math.floor(stepCount / Math.min(stepCount, 5)));
        for (let i = 0; i < stepCount; i += postSpacingSteps) {
          const px = i * stepRunM;
          const py = (i + 1) * riserM;
          const postGeo = new THREE.CylinderGeometry(0.012, 0.012, railHM, 8);
          const postMesh = new THREE.Mesh(postGeo, postMat);
          postMesh.position.set(px, py + railHM / 2 - 0.02, zOffset);
          stairFlight.add(postMesh);
        }
        const topPostGeo = new THREE.CylinderGeometry(0.012, 0.012, railHM, 8);
        const topPostMesh = new THREE.Mesh(topPostGeo, postMat);
        topPostMesh.position.set(runTotalLengthM, totalRiseM + railHM / 2 - 0.02, zOffset);
        stairFlight.add(topPostMesh);

        if (stair.railingStyle === "glass") {
          const glassPanelGeo = new THREE.BoxGeometry(slopeLenM * 0.95, railHM * 0.75, 0.01);
          const glassMesh = new THREE.Mesh(glassPanelGeo, glassMat);
          glassMesh.position.set(
            runTotalLengthM / 2,
            totalRiseM / 2 + railHM * 0.45,
            zOffset,
          );
          glassMesh.rotation.z = slopeAngle;
          stairFlight.add(glassMesh);
        }
      }
    }

    const pickGeo = new THREE.BoxGeometry(runTotalLengthM + 0.1, totalRiseM + 0.1, widthM + 0.1);
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pickMesh = new THREE.Mesh(pickGeo, pickMat);
    pickMesh.position.set(runTotalLengthM / 2, totalRiseM / 2, 0);
    pickMesh.userData.layoutStairId = stair.id;
    stairFlight.add(pickMesh);

    root.add(stairFlight);
  }

  private buildSpiralStair(
    root: THREE.Group,
    stair: LayoutStair,
    startM: THREE.Vector3,
    riserCount: number,
    actualRiserMm: number,
    totalRiseMm: number,
    treadMat: THREE.Material,
    postMat: THREE.Material,
    railMat: THREE.Material,
    isSelected: boolean,
    planMode: boolean,
  ) {
    const totalRiseM = fromMm(totalRiseMm);
    const riserM = fromMm(actualRiserMm);
    const totalAngleDeg = stair.spiralAngleDeg ?? 360;
    const totalAngleRad = (totalAngleDeg * Math.PI) / 180;
    const outerRadiusM = fromMm(stair.outerRadiusMm ?? (stair.widthMm ? stair.widthMm / 2 + 100 : 900));
    const innerRadiusM = fromMm(stair.innerRadiusMm ?? 100);
    const railHM = fromMm(stair.railingHeightMm ?? 900);

    const group = new THREE.Group();
    group.position.copy(startM);

    if (planMode) {
      const centerDiscGeo = new THREE.CircleGeometry(innerRadiusM, 24);
      centerDiscGeo.rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(centerDiscGeo, new THREE.MeshBasicMaterial({ color: 0x64748b, depthTest: false }));
      disc.position.y = 0.02;
      group.add(disc);

      const outerRingGeo = new THREE.RingGeometry(outerRadiusM - 0.02, outerRadiusM, 32);
      outerRingGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(outerRingGeo, new THREE.MeshBasicMaterial({ color: isSelected ? STAIR_SEL : 0x18181b, depthTest: false }));
      ring.position.y = 0.02;
      group.add(ring);

      const lineMat = new THREE.LineBasicMaterial({ color: isSelected ? STAIR_SEL : 0x475569, depthTest: false });
      for (let i = 0; i <= riserCount; i++) {
        const theta = (i / riserCount) * totalAngleRad;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const p1 = new THREE.Vector3(innerRadiusM * cos, 0.025, innerRadiusM * sin);
        const p2 = new THREE.Vector3(outerRadiusM * cos, 0.025, outerRadiusM * sin);
        const lGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lMesh = new THREE.Line(lGeo, lineMat);
        group.add(lMesh);
      }
      root.add(group);
      return;
    }

    // 3D Central Column Pole
    const poleGeo = new THREE.CylinderGeometry(innerRadiusM, innerRadiusM, totalRiseM, 24);
    const poleMesh = new THREE.Mesh(poleGeo, postMat);
    poleMesh.position.set(0, totalRiseM / 2, 0);
    group.add(poleMesh);

    // Helical Wedge Steps
    const dTheta = totalAngleRad / riserCount;
    const handrailPts: THREE.Vector3[] = [];

    for (let i = 0; i < riserCount; i++) {
      const thetaStart = i * dTheta;
      const thetaEnd = (i + 1) * dTheta + 0.04;
      const stepY = i * riserM;

      const wedgeShape = new THREE.Shape();
      const x0 = innerRadiusM * Math.cos(thetaStart);
      const z0 = innerRadiusM * Math.sin(thetaStart);
      wedgeShape.moveTo(x0, z0);
      wedgeShape.absarc(0, 0, innerRadiusM, thetaStart, thetaEnd, false);
      wedgeShape.lineTo(outerRadiusM * Math.cos(thetaEnd), outerRadiusM * Math.sin(thetaEnd));
      wedgeShape.absarc(0, 0, outerRadiusM, thetaEnd, thetaStart, true);
      wedgeShape.closePath();

      const treadGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.035, bevelEnabled: false });
      treadGeo.rotateX(Math.PI / 2);
      const treadMesh = new THREE.Mesh(treadGeo, treadMat);
      treadMesh.position.set(0, stepY + riserM, 0);
      group.add(treadMesh);

      const midTheta = thetaStart + dTheta * 0.8;
      const bx = (outerRadiusM - 0.03) * Math.cos(midTheta);
      const bz = (outerRadiusM - 0.03) * Math.sin(midTheta);
      const postGeo = new THREE.CylinderGeometry(0.012, 0.012, railHM, 8);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(bx, stepY + riserM + railHM / 2, bz);
      group.add(post);

      handrailPts.push(new THREE.Vector3(bx, stepY + riserM + railHM, bz));
    }

    if (handrailPts.length >= 2 && stair.hasRailingRight !== false) {
      const curve = new THREE.CatmullRomCurve3(handrailPts);
      const tubeGeo = new THREE.TubeGeometry(curve, riserCount * 4, 0.02, 8, false);
      const railMesh = new THREE.Mesh(tubeGeo, railMat);
      group.add(railMesh);
    }

    root.add(group);
  }

  private buildLShapeStair(
    root: THREE.Group,
    stair: LayoutStair,
    startM: THREE.Vector3,
    levels: LayoutLevel[],
    riserCount: number,
    actualRiserMm: number,
    totalRiseMm: number,
    widthMm: number,
    treadDepthMm: number,
    nosingMm: number,
    treadMat: THREE.Material,
    riserMat: THREE.Material,
    stringerMat: THREE.Material,
    postMat: THREE.Material,
    railMat: THREE.Material,
    glassMat: THREE.Material,
    isSelected: boolean,
    planMode: boolean,
  ) {
    const widthM = fromMm(widthMm);
    const riserM = fromMm(actualRiserMm);
    const treadM = fromMm(treadDepthMm);
    const nosingM = fromMm(nosingMm);

    const count1 = Math.max(1, Math.floor(riserCount / 2));
    const count2 = Math.max(1, riserCount - count1);
    const run1LengthM = count1 * treadM;
    const isLeft = stair.turnDirection === "left";
    const turnSign = isLeft ? 1 : -1;

    const dxMm = stair.endXmm - stair.startXmm;
    const dzMm = stair.endYmm - stair.startYmm;
    const angle1 = Math.atan2(dzMm, dxMm);

    const group = new THREE.Group();
    group.position.copy(startM);
    group.rotation.y = -angle1;

    if (planMode) {
      const lineMat = new THREE.LineBasicMaterial({ color: isSelected ? STAIR_SEL : 0x18181b, depthTest: false });

      for (let i = 0; i <= count1; i++) {
        const x = i * treadM;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.02, -widthM / 2),
          new THREE.Vector3(x, 0.02, widthM / 2),
        ]);
        group.add(new THREE.Line(geo, lineMat));
      }

      const landX1 = run1LengthM;
      const landX2 = run1LengthM + widthM;
      const landGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(landX1, 0.02, -widthM / 2),
        new THREE.Vector3(landX2, 0.02, -widthM / 2),
        new THREE.Vector3(landX2, 0.02, widthM / 2 + (isLeft ? widthM : -widthM)),
        new THREE.Vector3(landX1, 0.02, widthM / 2 + (isLeft ? widthM : -widthM)),
        new THREE.Vector3(landX1, 0.02, -widthM / 2),
      ]);
      group.add(new THREE.Line(landGeo, lineMat));

      root.add(group);
      return;
    }

    for (let i = 0; i < count1; i++) {
      const stepY = i * riserM;
      const stepX = i * treadM;

      const riserGeo = new THREE.BoxGeometry(0.02, riserM, widthM);
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(stepX, stepY + riserM / 2, 0);
      group.add(riser);

      const treadLen = treadM + nosingM;
      const treadGeo = new THREE.BoxGeometry(treadLen, 0.03, widthM);
      const tread = new THREE.Mesh(treadGeo, treadMat);
      tread.position.set(stepX + treadLen / 2 - nosingM, stepY + riserM - 0.015, 0);
      group.add(tread);
    }

    const landY = count1 * riserM;
    const landGeo = new THREE.BoxGeometry(widthM, 0.05, widthM);
    const landMesh = new THREE.Mesh(landGeo, treadMat);
    landMesh.position.set(run1LengthM + widthM / 2, landY - 0.025, 0);
    group.add(landMesh);

    const run2Group = new THREE.Group();
    run2Group.position.set(run1LengthM + widthM / 2, landY, 0);
    run2Group.rotation.y = turnSign * (Math.PI / 2);

    for (let i = 0; i < count2; i++) {
      const stepY = i * riserM;
      const stepX = (i + 1) * treadM;

      const riserGeo = new THREE.BoxGeometry(0.02, riserM, widthM);
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(stepX - treadM / 2, stepY + riserM / 2, 0);
      run2Group.add(riser);

      const treadLen = treadM + nosingM;
      const treadGeo = new THREE.BoxGeometry(treadLen, 0.03, widthM);
      const tread = new THREE.Mesh(treadGeo, treadMat);
      tread.position.set(stepX, stepY + riserM - 0.015, 0);
      run2Group.add(tread);
    }
    group.add(run2Group);

    root.add(group);
  }

  private buildUShapeStair(
    root: THREE.Group,
    stair: LayoutStair,
    startM: THREE.Vector3,
    levels: LayoutLevel[],
    riserCount: number,
    actualRiserMm: number,
    totalRiseMm: number,
    widthMm: number,
    treadDepthMm: number,
    nosingMm: number,
    treadMat: THREE.Material,
    riserMat: THREE.Material,
    stringerMat: THREE.Material,
    postMat: THREE.Material,
    railMat: THREE.Material,
    glassMat: THREE.Material,
    isSelected: boolean,
    planMode: boolean,
  ) {
    const widthM = fromMm(widthMm);
    const riserM = fromMm(actualRiserMm);
    const treadM = fromMm(treadDepthMm);
    const nosingM = fromMm(nosingMm);
    const gapM = 0.15;

    const count1 = Math.max(1, Math.floor(riserCount / 2));
    const count2 = Math.max(1, riserCount - count1);
    const run1LengthM = count1 * treadM;
    const isLeft = stair.turnDirection === "left";
    const sideOffset = (widthM + gapM) * (isLeft ? 1 : -1);

    const dxMm = stair.endXmm - stair.startXmm;
    const dzMm = stair.endYmm - stair.startYmm;
    const angle1 = Math.atan2(dzMm, dxMm);

    const group = new THREE.Group();
    group.position.copy(startM);
    group.rotation.y = -angle1;

    if (planMode) {
      const lineMat = new THREE.LineBasicMaterial({ color: isSelected ? STAIR_SEL : 0x18181b, depthTest: false });

      for (let i = 0; i <= count1; i++) {
        const x = i * treadM;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.02, -widthM / 2),
          new THREE.Vector3(x, 0.02, widthM / 2),
        ]);
        group.add(new THREE.Line(geo, lineMat));
      }

      const landX = run1LengthM;
      const landGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(landX, 0.02, -widthM / 2),
        new THREE.Vector3(landX + widthM, 0.02, -widthM / 2),
        new THREE.Vector3(landX + widthM, 0.02, -widthM / 2 + sideOffset + widthM),
        new THREE.Vector3(landX, 0.02, -widthM / 2 + sideOffset + widthM),
        new THREE.Vector3(landX, 0.02, -widthM / 2),
      ]);
      group.add(new THREE.Line(landGeo, lineMat));

      for (let i = 0; i <= count2; i++) {
        const x = run1LengthM - i * treadM;
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.02, -widthM / 2 + sideOffset),
          new THREE.Vector3(x, 0.02, widthM / 2 + sideOffset),
        ]);
        group.add(new THREE.Line(geo, lineMat));
      }

      root.add(group);
      return;
    }

    for (let i = 0; i < count1; i++) {
      const stepY = i * riserM;
      const stepX = i * treadM;

      const riserGeo = new THREE.BoxGeometry(0.02, riserM, widthM);
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(stepX, stepY + riserM / 2, 0);
      group.add(riser);

      const treadLen = treadM + nosingM;
      const treadGeo = new THREE.BoxGeometry(treadLen, 0.03, widthM);
      const tread = new THREE.Mesh(treadGeo, treadMat);
      tread.position.set(stepX + treadLen / 2 - nosingM, stepY + riserM - 0.015, 0);
      group.add(tread);
    }

    const landY = count1 * riserM;
    const landWidth = widthM * 2 + gapM;
    const landGeo = new THREE.BoxGeometry(widthM, 0.05, landWidth);
    const landMesh = new THREE.Mesh(landGeo, treadMat);
    landMesh.position.set(run1LengthM + widthM / 2, landY - 0.025, sideOffset / 2);
    group.add(landMesh);

    for (let i = 0; i < count2; i++) {
      const stepY = landY + i * riserM;
      const stepX = run1LengthM - i * treadM;

      const riserGeo = new THREE.BoxGeometry(0.02, riserM, widthM);
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(stepX, stepY + riserM / 2, sideOffset);
      group.add(riser);

      const treadLen = treadM + nosingM;
      const treadGeo = new THREE.BoxGeometry(treadLen, 0.03, widthM);
      const tread = new THREE.Mesh(treadGeo, treadMat);
      tread.position.set(stepX - treadLen / 2 + nosingM, stepY + riserM - 0.015, sideOffset);
      group.add(tread);
    }

    root.add(group);
  }

  private buildStraightStairPlanSymbol(
    root: THREE.Group,
    stair: LayoutStair,
    startM: THREE.Vector3,
    angle: number,
    stepCount: number,
    stepRunM: number,
    widthM: number,
    isSelected: boolean,
  ) {
    const group = new THREE.Group();
    group.position.copy(startM);
    group.rotation.y = -angle;

    const runLenM = Math.max(0.1, (stepCount - 1) * stepRunM);
    const halfW = widthM / 2;
    const cutStep = Math.max(1, Math.floor(stepCount * 0.55));
    const cutXM = cutStep * stepRunM;

    const solidMat = new THREE.LineBasicMaterial({
      color: isSelected ? STAIR_SEL : 0x18181b,
      depthTest: false,
    });
    const dashedMat = new THREE.LineDashedMaterial({
      color: isSelected ? STAIR_SEL : 0x94a3b8,
      dashSize: 0.12,
      gapSize: 0.06,
      depthTest: false,
    });

    const boundaryGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, -halfW),
      new THREE.Vector3(runLenM, 0.02, -halfW),
      new THREE.Vector3(runLenM, 0.02, halfW),
      new THREE.Vector3(0, 0.02, halfW),
      new THREE.Vector3(0, 0.02, -halfW),
    ]);
    group.add(new THREE.Line(boundaryGeo, solidMat));

    for (let i = 0; i < stepCount; i++) {
      const x = i * stepRunM;
      const isAboveCut = i > cutStep;
      const stepGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.02, -halfW),
        new THREE.Vector3(x, 0.02, halfW),
      ]);
      const stepLine = new THREE.Line(stepGeo, isAboveCut ? dashedMat : solidMat);
      if (isAboveCut) stepLine.computeLineDistances();
      group.add(stepLine);
    }

    const breakOffset = 0.08;
    for (const d of [-breakOffset, breakOffset]) {
      const bx = cutXM + d;
      const breakGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(bx - 0.15, 0.025, -halfW - 0.05),
        new THREE.Vector3(bx + 0.15, 0.025, halfW + 0.05),
      ]);
      group.add(new THREE.Line(breakGeo, solidMat));
    }

    const dotGeo = new THREE.CircleGeometry(0.04, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMesh = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x2563eb, depthTest: false }));
    dotMesh.position.set(0.08, 0.025, 0);
    group.add(dotMesh);

    const arrowEndXM = runLenM - 0.05;
    const arrowLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.08, 0.025, 0),
      new THREE.Vector3(arrowEndXM, 0.025, 0),
    ]);
    group.add(new THREE.Line(arrowLineGeo, new THREE.LineBasicMaterial({ color: 0x2563eb, depthTest: false })));

    const headGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(arrowEndXM - 0.15, 0.025, -0.08),
      new THREE.Vector3(arrowEndXM, 0.025, 0),
      new THREE.Vector3(arrowEndXM - 0.15, 0.025, 0.08),
    ]);
    group.add(new THREE.Line(headGeo, new THREE.LineBasicMaterial({ color: 0x2563eb, depthTest: false })));

    root.add(group);
  }

  private buildRampGeometry(
    root: THREE.Group,
    ramp: LayoutRamp,
    levels: LayoutLevel[],
    isSelected: boolean,
    planMode: boolean,
  ) {
    const baseLevel = levels.find((l) => l.id === ramp.levelId);
    const baseElevMm = (baseLevel?.elevationMm ?? 0) + (ramp.baseOffsetMm || 0);
    const totalRiseMm = deriveRiseMm(
      levels,
      ramp.levelId,
      ramp.topLevelId,
      ramp.baseOffsetMm,
      ramp.topOffsetMm,
    );
    const dxMm = ramp.endXmm - ramp.startXmm;
    const dzMm = ramp.endYmm - ramp.startYmm;
    const runLengthMm = Math.hypot(dxMm, dzMm);

    const widthMm = ramp.widthMm || 1200;
    const thicknessMm = ramp.thicknessMm || 150;
    const widthM = fromMm(widthMm);
    const thickM = fromMm(thicknessMm);
    const baseElevM = fromMm(baseElevMm);
    const totalRiseM = fromMm(totalRiseMm);
    const runLenM = fromMm(Math.max(100, runLengthMm));
    const slopeLenM = Math.hypot(runLenM, totalRiseM);
    const slopeAngle = Math.atan2(totalRiseM, runLenM);
    const angle = Math.atan2(dzMm, dxMm);
    const railHM = fromMm(ramp.railingHeightMm ?? 900);

    const startM = new THREE.Vector3(fromMm(ramp.startXmm), baseElevM, fromMm(ramp.startYmm));
    const group = new THREE.Group();
    group.position.copy(startM);
    group.rotation.y = -angle;

    if (planMode) {
      const lineMat = new THREE.LineBasicMaterial({ color: isSelected ? RAMP_SEL : 0x18181b, depthTest: false });
      const halfW = widthM / 2;
      const borderGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.02, -halfW),
        new THREE.Vector3(runLenM, 0.02, -halfW),
        new THREE.Vector3(runLenM, 0.02, halfW),
        new THREE.Vector3(0, 0.02, halfW),
        new THREE.Vector3(0, 0.02, -halfW),
      ]);
      group.add(new THREE.Line(borderGeo, lineMat));

      const arrowPts = [
        new THREE.Vector3(0.1, 0.025, 0),
        new THREE.Vector3(runLenM - 0.1, 0.025, 0),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arrowPts), new THREE.LineBasicMaterial({ color: 0x0284c7, depthTest: false })));

      const headPts = [
        new THREE.Vector3(runLenM - 0.25, 0.025, -0.1),
        new THREE.Vector3(runLenM - 0.1, 0.025, 0),
        new THREE.Vector3(runLenM - 0.25, 0.025, 0.1),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(headPts), new THREE.LineBasicMaterial({ color: 0x0284c7, depthTest: false })));

      root.add(group);
      return;
    }

    // 3D Ramp Solid Sloped Slab
    const rampMat = new THREE.MeshStandardMaterial({
      color: isSelected ? RAMP_SEL : (ramp.color ? parseInt(ramp.color.replace("#", ""), 16) : RAMP_COLOR),
      roughness: 0.8,
      metalness: 0.1,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: isSelected ? RAMP_SEL : 0x334155,
      roughness: 0.3,
      metalness: 0.8,
    });

    const slabGeo = new THREE.BoxGeometry(slopeLenM, thickM, widthM);
    const slabMesh = new THREE.Mesh(slabGeo, rampMat);
    slabMesh.position.set(
      runLenM / 2,
      totalRiseM / 2 - thickM / 2,
      0,
    );
    slabMesh.rotation.z = slopeAngle;
    group.add(slabMesh);

    // Curbs on left and right edge
    const curbHeight = 0.06;
    const curbThick = 0.05;
    for (const side of [-1, 1]) {
      const curbGeo = new THREE.BoxGeometry(slopeLenM, curbHeight, curbThick);
      const curbMesh = new THREE.Mesh(curbGeo, rampMat);
      curbMesh.position.set(
        runLenM / 2,
        totalRiseM / 2 + curbHeight / 2,
        side * (widthM / 2 - curbThick / 2),
      );
      curbMesh.rotation.z = slopeAngle;
      group.add(curbMesh);
    }

    // Railings
    if (ramp.hasRailingLeft !== false || ramp.hasRailingRight !== false) {
      for (const side of [-1, 1]) {
        if (side === -1 && ramp.hasRailingLeft === false) continue;
        if (side === 1 && ramp.hasRailingRight === false) continue;

        const zOffset = side * (widthM / 2 - 0.03);

        const topRailGeo = new THREE.CylinderGeometry(0.02, 0.02, slopeLenM, 12);
        topRailGeo.rotateZ(-Math.PI / 2 + slopeAngle);
        const topRail = new THREE.Mesh(topRailGeo, railMat);
        topRail.position.set(runLenM / 2, totalRiseM / 2 + railHM, zOffset);
        group.add(topRail);

        const midRailGeo = new THREE.CylinderGeometry(0.015, 0.015, slopeLenM, 12);
        midRailGeo.rotateZ(-Math.PI / 2 + slopeAngle);
        const midRail = new THREE.Mesh(midRailGeo, railMat);
        midRail.position.set(runLenM / 2, totalRiseM / 2 + railHM * 0.75, zOffset);
        group.add(midRail);

        const postCount = Math.max(3, Math.ceil(runLenM / 1.2));
        for (let i = 0; i <= postCount; i++) {
          const t = i / postCount;
          const px = t * runLenM;
          const py = t * totalRiseM;
          const postGeo = new THREE.CylinderGeometry(0.015, 0.015, railHM, 8);
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(px, py + railHM / 2, zOffset);
          group.add(post);
        }
      }
    }

    const pickGeo = new THREE.BoxGeometry(runLenM + 0.1, totalRiseM + thickM + 0.2, widthM + 0.1);
    const pickMesh = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pickMesh.position.set(runLenM / 2, totalRiseM / 2, 0);
    pickMesh.userData.layoutRampId = ramp.id;
    group.add(pickMesh);

    root.add(group);
  }

  pickLayout(
    raycaster: THREE.Raycaster,
  ):
    | { kind: "wall-endpoint"; id: string; end: "start" | "end" }
    | { kind: "wall"; id: string }
    | { kind: "door"; id: string }
    | { kind: "window"; id: string }
    | { kind: "slab"; id: string }
    | { kind: "column"; id: string }
    | { kind: "beam"; id: string }
    | { kind: "grid"; id: string }
    | { kind: "sketch-line"; id: string }
    | { kind: "stair"; id: string }
    | { kind: "ramp"; id: string }
    | { kind: "duct"; id: string }
    | { kind: "pipe"; id: string }
    | { kind: "cabletray"; id: string }
    | { kind: "equipment"; id: string }
    | { kind: "underlay"; id: string; point: THREE.Vector3; uv?: THREE.Vector2 }
    | { kind: "ground"; point: THREE.Vector3 }
    | null {
    const layoutState = useLayoutDrawingStore.getState();
    const architectureLocked = layoutState.mepModeActive && layoutState.mepArchitectureLocked;

    if (!architectureLocked && this.endpointGroup.visible) {
      const epHits = raycaster.intersectObjects(
        this.endpointGroup.children,
        false,
      );
      for (const h of epHits) {
        const end = h.object.userData.layoutWallEndpoint as
          | "start"
          | "end"
          | undefined;
        const id = h.object.userData.layoutWallId as string | undefined;
        if (end && id) return { kind: "wall-endpoint", id, end };
      }
    }
    const hits = raycaster.intersectObjects(this.group.children, true);
    for (const h of hits) {
      // Skip hidden CAD/solid sibling so Top picks the symbol, 3D the box.
      if (!h.object.visible) continue;
      if (h.object.userData.isLayoutEndpoint) continue;
      if (h.object.userData.isCalibrateMarker) continue;
      let o: THREE.Object3D | null = h.object;
      let hidden = false;
      while (o) {
        if (!o.visible) {
          hidden = true;
          break;
        }
        o = o.parent;
      }
      if (hidden) continue;
      o = h.object;
      while (o) {
        if (o.userData.layoutDuctId)
          return { kind: "duct", id: o.userData.layoutDuctId as string };
        if (o.userData.layoutPipeId)
          return { kind: "pipe", id: o.userData.layoutPipeId as string };
        if (o.userData.layoutCableTrayId)
          return { kind: "cabletray", id: o.userData.layoutCableTrayId as string };
        if (o.userData.layoutEquipmentId)
          return { kind: "equipment", id: o.userData.layoutEquipmentId as string };

        // Architecture is reference-only by default in MEP mode. The toolbar
        // override restores normal picking without affecting MEP selection.
        if (!architectureLocked) {
          if (o.userData.layoutWallEndpoint && o.userData.layoutWallId) {
            return {
              kind: "wall-endpoint",
              id: o.userData.layoutWallId as string,
              end: o.userData.layoutWallEndpoint as "start" | "end",
            };
          }
          if (o.userData.layoutWallId)
            return { kind: "wall", id: o.userData.layoutWallId as string };
          if (o.userData.layoutDoorId)
            return { kind: "door", id: o.userData.layoutDoorId as string };
          if (o.userData.layoutWindowId)
            return { kind: "window", id: o.userData.layoutWindowId as string };
          if (o.userData.layoutSlabId)
            return { kind: "slab", id: o.userData.layoutSlabId as string };
          if (o.userData.layoutColumnId)
            return { kind: "column", id: o.userData.layoutColumnId as string };
          if (o.userData.layoutBeamId)
            return { kind: "beam", id: o.userData.layoutBeamId as string };
          if (o.userData.layoutStairId)
            return { kind: "stair", id: o.userData.layoutStairId as string };
          if (o.userData.layoutRampId)
            return { kind: "ramp", id: o.userData.layoutRampId as string };
        }

        if (o.userData.layoutGridId)
          return { kind: "grid", id: o.userData.layoutGridId as string };
        if (o.userData.layoutSketchLineId)
          return { kind: "sketch-line", id: o.userData.layoutSketchLineId as string };

        if (o.userData.isLayoutUnderlay && o.userData.layoutUnderlayId) {
          return {
            kind: "underlay",
            id: o.userData.layoutUnderlayId as string,
            point: h.point.clone(),
            uv: h.uv?.clone(),
          };
        }
        if (o.userData.isLayoutGround)
          return { kind: "ground", point: h.point.clone() };
        o = o.parent;
      }
    }
    return null;
  }

  syncSketch(
    lines: LayoutSketchLine[],
    draw: { levelId: string; points: { xMm: number; yMm: number }[]; cursor: { xMm: number; yMm: number } | null } | null,
    gapPoints: { xMm: number; yMm: number }[] = [],
    levels: LayoutLevel[] = [],
    selectedLineId: string | null = null,
    fallbackElevMm: number = 0,
    targetKind: "floor" | "roof" | null = null,
  ) {
    // This is a persistent child of `group`. Removing it here orphaned every
    // newly-created line from the scene graph, which made Lines invisible.
    this.clearGroupContents(this.sketchGroup);

    const levelMap = new Map(levels.map((lvl) => [lvl.id, lvl.elevationMm]));
    const boundaryBlue = 0x2563eb;
    const draftingGray = 0x374151;
    const selectedCyan = 0x38bdf8;
    const gapRed = 0xef4444;
    // Ribbon dimensions: width visible from top, height visible from side
    const RIBBON_H = 0.006;

    const makeSegMat = (col: number, emissiveI: number) =>
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    const makeSegment = (
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      y: number,
      col: number,
      emI: number,
      lineId: string | null,
      renderOrd: number,
      style?: Pick<LayoutSketchLine, "thicknessPx" | "pattern" | "dashSizeMm" | "gapSizeMm">,
    ) => {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.001) return;

      if ((style?.pattern ?? "solid") === "solid") {
        const ribbonWidth = Math.max(0.008, (style?.thicknessPx ?? 1) * 0.006);
        const segGeo = new THREE.BoxGeometry(segLen, RIBBON_H * 2, ribbonWidth);
        const segMat = makeSegMat(col, emI);
        const segMesh = new THREE.Mesh(segGeo, segMat);
        segMesh.position.set((p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2);
        segMesh.rotation.y = -Math.atan2(dz, dx);
        if (lineId) segMesh.userData.layoutSketchLineId = lineId;
        segMesh.renderOrder = renderOrd;
        segMesh.frustumCulled = false;
        this.sketchGroup.add(segMesh);
      }

      // Complementary THREE.Line on top for guaranteed 1px visibility at any zoom
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const pattern = style?.pattern ?? "solid";
      const lineMat = pattern === "solid"
        ? new THREE.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 1 })
        : new THREE.LineDashedMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: 1, dashSize: fromMm(pattern === "dotted" ? 45 : style?.dashSizeMm ?? 250), gapSize: fromMm(style?.gapSizeMm ?? 140) });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      if (pattern !== "solid") lineMesh.computeLineDistances();
      lineMesh.renderOrder = renderOrd + 1;
      lineMesh.frustumCulled = false;
      if (lineId) lineMesh.userData.layoutSketchLineId = lineId;
      this.sketchGroup.add(lineMesh);
    };

    // 1. Render placed sketch lines on ALL floors
    for (const l of lines) {
      const isSelected = l.id === selectedLineId;
      const parsed = l.color ? Number.parseInt(l.color.replace("#", ""), 16) : draftingGray;
      const col = isSelected ? selectedCyan : targetKind ? boundaryBlue : parsed;
      const elevMm = levelMap.get(l.levelId) ?? fallbackElevMm;
      const y = fromMm(elevMm) + 0.08;

      if (l.curved && l.arcCenterXmm != null && l.arcCenterYmm != null && l.arcRadiusMm != null && l.arcStartAngleDeg != null && l.arcEndAngleDeg != null) {
        const cx = fromMm(l.arcCenterXmm);
        const cz = fromMm(l.arcCenterYmm);
        const r = fromMm(l.arcRadiusMm);
        const a1 = (l.arcStartAngleDeg * Math.PI) / 180;
        const a2 = (l.arcEndAngleDeg * Math.PI) / 180;
        let sweep = a2 - a1;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep < -Math.PI) sweep += 2 * Math.PI;
        const SEG_COUNT = 24;
        const arcPts: THREE.Vector3[] = [];
        for (let i = 0; i <= SEG_COUNT; i++) {
          const ang = a1 + sweep * (i / SEG_COUNT);
          arcPts.push(new THREE.Vector3(cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r));
        }
        for (let i = 0; i < arcPts.length - 1; i++) {
          makeSegment(arcPts[i], arcPts[i + 1], y, col, isSelected ? 0.95 : 0.75, l.id, 100, targetKind ? { thicknessPx: 2, pattern: "solid" } : l);
        }
      } else {
        makeSegment(p1, p2, y, col, isSelected ? 0.95 : 0.75, l.id, 100, targetKind ? { thicknessPx: 2, pattern: "solid" } : l);
      }

      // Node dots — flat disc (CircleGeometry in XZ plane)
      for (const pt of [p1, p2]) {
        const discGeo = new THREE.CircleGeometry(0.06, 16);
        discGeo.rotateX(-Math.PI / 2); // lay flat in XZ
        const discMat = new THREE.MeshBasicMaterial({
          color: col,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
          depthWrite: false,
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.copy(pt);
        disc.position.y = y + 0.005; // just above ribbon
        disc.userData.layoutSketchLineId = l.id;
        disc.renderOrder = 102;
        disc.frustumCulled = false;
        this.sketchGroup.add(disc);
      }
    }

    // 2. Render in-progress drawing chain and rubberband cursor line
    if (draw && draw.points.length > 0) {
      const drawElevMm = levelMap.get(draw.levelId) ?? fallbackElevMm;
      const drawY = fromMm(drawElevMm) + 0.09;
      const pts = [...draw.points];
      if (draw.cursor) pts.push(draw.cursor);

      if (pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const p1 = new THREE.Vector3(fromMm(a.xMm), drawY, fromMm(a.yMm));
          const p2 = new THREE.Vector3(fromMm(b.xMm), drawY, fromMm(b.yMm));
          const isRubberband = i === pts.length - 2 && draw.cursor != null;
          const col = targetKind ? 0x3b82f6 : isRubberband ? 0x6b7280 : draftingGray;
          makeSegment(p1, p2, drawY, col, isRubberband ? 0.9 : 0.7, null, 105);
        }
      }

      // Draw-in-progress node dots
      for (const dp of draw.points) {
        const discGeo = new THREE.CircleGeometry(0.05, 14);
        discGeo.rotateX(-Math.PI / 2);
        const discMat = new THREE.MeshBasicMaterial({
          color: targetKind ? 0x2563eb : draftingGray,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
          depthWrite: false,
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.set(fromMm(dp.xMm), drawY + 0.005, fromMm(dp.yMm));
        disc.renderOrder = 107;
        disc.frustumCulled = false;
        this.sketchGroup.add(disc);
      }
    }

    // 3. Render glowing gap markers if any
    for (const gp of gapPoints) {
      const gapGeo = new THREE.CircleGeometry(0.07, 16);
      gapGeo.rotateX(-Math.PI / 2);
      const gapMat = new THREE.MeshBasicMaterial({
        color: gapRed,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      });
      const gapMesh = new THREE.Mesh(gapGeo, gapMat);
      gapMesh.position.set(fromMm(gp.xMm), fromMm(fallbackElevMm) + 0.1, fromMm(gp.yMm));
      gapMesh.renderOrder = 110;
      gapMesh.frustumCulled = false;
      this.sketchGroup.add(gapMesh);
    }
  }

  dispose() {
    for (const grp of this.wallMeshes.values()) this.disposeGroup(grp);
    for (const g of this.doorMeshes.values()) this.disposeGroup(g);
    for (const g of this.windowMeshes.values()) this.disposeGroup(g);
    for (const mesh of this.slabMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.columnMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.beamMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const grp of this.gridMeshes.values()) this.disposeGroup(grp);
    for (const grp of this.stairMeshes.values()) this.disposeGroup(grp);
    for (const grp of this.rampMeshes.values()) this.disposeGroup(grp);
    this.wallMeshes.clear();
    this.doorMeshes.clear();
    this.windowMeshes.clear();
    this.slabMeshes.clear();
    this.columnMeshes.clear();
    this.beamMeshes.clear();
    this.gridMeshes.clear();
    this.stairMeshes.clear();
    this.rampMeshes.clear();
    for (const mesh of this.levelSlabs.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.levelSlabs.clear();
    this.disposeGroup(this.endpointGroup);
    this.endpointGroup.clear();
    this.disposeGroup(this.sketchGroup);
    this.sketchGroup.clear();
    for (const [id, mesh] of this.underlayMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.underlayMeshes.delete(id);
    }
    for (const tex of this.underlayTextures.values()) tex.dispose();
    this.underlayTextures.clear();
    for (const [id, edge] of this.underlayEdges) {
      edge.geometry.dispose();
      (edge.material as THREE.Material).dispose();
      this.underlayEdges.delete(id);
    }
    for (const m of this.calibrateMarkers) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.calibrateMarkers = [];
    for (const ep of [this.endpointStart, this.endpointEnd]) {
      if (!ep) continue;
      ep.geometry.dispose();
      (ep.material as THREE.Material).dispose();
    }
    this.endpointStart = null;
    this.endpointEnd = null;
    this.endpointGroup.clear();
    if (this.previewLine) {
      this.disposeGroup(this.previewLine);
      this.previewLine = null;
    }
    if (this.slabPreview) {
      this.disposeGroup(this.slabPreview);
      this.slabPreview = null;
    }
    if (this.stairPreview) {
      this.disposeGroup(this.stairPreview);
      this.stairPreview = null;
    }
    if (this.rampPreview) {
      this.disposeGroup(this.rampPreview);
      this.rampPreview = null;
    }
    if (this.tracePreviewGroup) {
      this.disposeGroup(this.tracePreviewGroup);
      this.tracePreviewGroup = null;
    }
    if (this.ground) {
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose();
    }
    this.group.clear();
  }

  private buildSlabGeometry(slab: LayoutSlab): THREE.BufferGeometry {
    const boundary = slab.boundary && slab.boundary.length >= 3 ? slab.boundary : [
      { xMm: slab.minXmm, yMm: slab.minYmm },
      { xMm: slab.maxXmm, yMm: slab.minYmm },
      { xMm: slab.maxXmm, yMm: slab.maxYmm },
      { xMm: slab.minXmm, yMm: slab.maxYmm },
    ];

    if (slab.kind === "roof" && !slab.holes?.length) {
      const roof = this.buildPitchedRoofGeometry(slab, boundary);
      if (roof) return roof;
    }

    const shape = new THREE.Shape();
    shape.moveTo(fromMm(boundary[0].xMm), fromMm(boundary[0].yMm));
    for (let i = 1; i < boundary.length; i++) {
      shape.lineTo(fromMm(boundary[i].xMm), fromMm(boundary[i].yMm));
    }
    shape.closePath();

    if (slab.holes) {
      for (const hole of slab.holes) {
        if (hole.length < 3) continue;
        const holePath = new THREE.Path();
        holePath.moveTo(fromMm(hole[0].xMm), fromMm(hole[0].yMm));
        for (let i = 1; i < hole.length; i++) {
          holePath.lineTo(fromMm(hole[i].xMm), fromMm(hole[i].yMm));
        }
        holePath.closePath();
        shape.holes.push(holePath);
      }
    }

    const thickness = fromMm(Math.max(50, slab.thicknessMm));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });

    // Section 8: Roof per-edge slope controls
    if (slab.kind === "roof") {
      const pos = geo.attributes.position;
      const distPointToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      };

      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);

        // Only warp vertices on the top face of extrusion (vz ~ thickness)
        if (vz > thickness * 0.9) {
          let minDist = Infinity;
          let pitchDeg = 30; // default pitch
          let isSloped = false;

          for (let j = 0; j < boundary.length; j++) {
            const p1 = boundary[j];
            const p2 = boundary[(j + 1) % boundary.length];
            const dVal = distPointToSegment(vx, vy, fromMm(p1.xMm), fromMm(p1.yMm), fromMm(p2.xMm), fromMm(p2.yMm));
            if (dVal < minDist) {
              minDist = dVal;
              const slopeInfo = slab.edgeSlopes?.find((s) => s.edgeIdx === j);
              isSloped = slopeInfo ? slopeInfo.isSloped : true; // default sloped
              pitchDeg = slopeInfo ? slopeInfo.pitchDeg : 30;
            }
          }

          if (isSloped) {
            const pitchRad = (pitchDeg * Math.PI) / 180;
            pos.setZ(i, vz + minDist * Math.tan(pitchRad));
          }
        }
      }
      geo.computeVertexNormals();
    }

    // World-metric UVs for slabs so hatch patterns tile without stretching
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    if (pos && uvs) {
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        uvs.setXY(i, vx, vy);
      }
      uvs.needsUpdate = true;
    }

    return geo;
  }

  /** Build an explicit watertight hip roof with a real ridge/apex vertex. */
  private buildPitchedRoofGeometry(
    slab: LayoutSlab,
    boundary: { xMm: number; yMm: number }[],
  ): THREE.BufferGeometry | null {
    if (boundary.length < 3) return null;
    let turnSign = 0;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const c = boundary[(i + 2) % boundary.length];
      const cross =
        (b.xMm - a.xMm) * (c.yMm - b.yMm) -
        (b.yMm - a.yMm) * (c.xMm - b.xMm);
      if (Math.abs(cross) < 1e-3) continue;
      const sign = Math.sign(cross);
      if (turnSign && sign !== turnSign) return null;
      turnSign = sign;
    }

    let points = boundary.map(
      (point) => new THREE.Vector2(fromMm(point.xMm), fromMm(point.yMm)),
    );
    if (turnSign < 0) points = points.reverse();
    const center = points.reduce(
      (sum, point) => sum.add(point),
      new THREE.Vector2(),
    ).multiplyScalar(1 / points.length);
    const distanceToEdge = (p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) => {
      const ab = b.clone().sub(a);
      const lenSq = ab.lengthSq();
      const t = lenSq > 0
        ? THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / lenSq, 0, 1)
        : 0;
      return p.distanceTo(a.clone().addScaledVector(ab, t));
    };
    const minRun = Math.min(
      ...points.map((point, index) =>
        distanceToEdge(center, point, points[(index + 1) % points.length]),
      ),
    );
    const pitchedEdges = slab.edgeSlopes?.filter((edge) => edge.isSloped) ?? [];
    const pitchDeg = pitchedEdges.length
      ? pitchedEdges.reduce((sum, edge) => sum + edge.pitchDeg, 0) / pitchedEdges.length
      : 30;
    const rise = Math.max(0.05, minRun * Math.tan(THREE.MathUtils.degToRad(pitchDeg)));
    const eaveZ = fromMm(Math.max(50, slab.thicknessMm));
    const positions: number[] = [];
    const pushTriangle = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
    ) => positions.push(...a, ...b, ...c);

    const triangles = THREE.ShapeUtils.triangulateShape(points, []);
    for (const triangle of triangles) {
      const [a, b, c] = triangle.map((index) => points[index]);
      pushTriangle([c.x, c.y, 0], [b.x, b.y, 0], [a.x, a.y, 0]);
    }

    const apex: [number, number, number] = [center.x, center.y, eaveZ + rise];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      pushTriangle([a.x, a.y, eaveZ], [b.x, b.y, eaveZ], apex);
      pushTriangle([a.x, a.y, 0], [b.x, b.y, 0], [b.x, b.y, eaveZ]);
      pushTriangle([a.x, a.y, 0], [b.x, b.y, eaveZ], [a.x, a.y, eaveZ]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const uv: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      uv.push(positions[i], positions[i + 1]);
    }
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private createSlabMesh(slab: LayoutSlab, elevMm: number): THREE.Mesh {
    const geo = this.buildSlabGeometry(slab);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
      opacity: 0.85,
    });
    this.applyMaterialAndColor(mat, slab.color, slab.material);
    if (!slab.color && !slab.material) {
      mat.color.setHex(slab.kind === "roof" ? ROOF_COLOR : FLOOR_COLOR);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.layoutSlabId = slab.id;
    mesh.userData.kind = "layout-slab";
    this.updateSlabMesh(mesh, slab, elevMm);
    return mesh;
  }

  private updateSlabMesh(
    mesh: THREE.Mesh,
    slab: LayoutSlab,
    elevMm: number,
  ) {
    mesh.geometry.dispose();
    mesh.geometry = this.buildSlabGeometry(slab);

    const thickness = fromMm(Math.max(50, slab.thicknessMm));
    
    // Position mesh and rotate extrusion: Extrusion local Z maps to global Y pointing up
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(-Math.PI / 2, 0, 0);

    const baseY = fromMm(elevMm + slab.elevationOffsetMm);
    if (slab.kind === "roof") {
      mesh.position.y = baseY;
    } else {
      mesh.position.y = baseY - thickness;
    }
    mesh.userData.layoutSlabId = slab.id;
  }

  setRenderMode(mode: RenderMode) {
    this.currentRenderMode = mode;
    this.refreshMaterials();
  }

  refreshMaterials() {
    const state = useLayoutDrawingStore.getState();
    const mode = this.currentRenderMode;

    const isWireframe = mode === "wireframe";

    for (const [id, grp] of this.wallMeshes) {
      const wall = state.walls.find((w) => w.id === id);
      const isSelected = wall ? (wall.id === state.selectedWallId || Boolean(state.selectedWallIds?.has(wall.id))) : false;
      if (wall) {
        const layers = this.resolveWallLayers(wall);
        let layerIdx = 0;
        grp.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isWallLayer) {
            const layer = layers[layerIdx++] || {
              id: "l-def",
              name: "Structure",
              function: "structure" as const,
              material: wall.material || "Concrete",
              thicknessMm: wall.thicknessMm || 200,
              color: wall.color,
            };
            if (child.material instanceof THREE.MeshStandardMaterial) {
              this.applyWallLayerMaterial(child.material, layer, wall, isSelected, this.currentRenderMode);
            }
          }
        });
      }
      this.updateWireframeEdges(grp, isWireframe);
    }
    for (const [id, mesh] of this.slabMeshes) {
      const slab = state.slabs.find((s) => s.id === id);
      if (slab && mesh.material instanceof THREE.MeshStandardMaterial) {
        if (slab.id === state.selectedSlabId) {
          mesh.material.color.setHex(slab.kind === "roof" ? ROOF_SEL : FLOOR_SEL);
          mesh.material.emissive.setHex(0x92400e);
          mesh.material.emissiveIntensity = 0.25;
        } else {
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0;
          this.applyMaterialAndColor(mesh.material, slab.color, slab.material);
        }
        mesh.material.needsUpdate = true;
      }
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const [id, mesh] of this.columnMeshes) {
      const column = state.columns.find((item) => item.id === id);
      if (column && mesh.material instanceof THREE.MeshStandardMaterial) {
        this.applyMaterialAndColor(mesh.material, column.color, column.material);
        if (!column.color && !column.material) mesh.material.color.setHex(0x94a3b8);
        mesh.material.needsUpdate = true;
      }
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const [id, mesh] of this.beamMeshes) {
      const beam = state.beams.find((item) => item.id === id);
      if (beam && mesh.material instanceof THREE.MeshStandardMaterial) {
        this.applyMaterialAndColor(mesh.material, beam.color, beam.material);
        if (!beam.color && !beam.material) mesh.material.color.setHex(0x64748b);
        mesh.material.needsUpdate = true;
      }
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const [id, g] of this.doorMeshes) {
      const door = state.doors.find((d) => d.id === id);
      const wall = door ? state.walls.find((w) => w.id === door.wallId) : null;
      if (door && wall) {
        const level = state.levels.find((l) => l.id === wall.levelId);
        const elev = level?.elevationMm ?? 0;
        this.placeOpening(g, wall, door.positionMm, door.widthMm, door.heightMm, elev, 0);
      }
      this.updateWireframeEdges(g, isWireframe);
    }
    for (const [id, g] of this.windowMeshes) {
      const win = state.windows.find((w) => w.id === id);
      const wall = win ? state.walls.find((w) => w.id === win.wallId) : null;
      if (win && wall) {
        const level = state.levels.find((l) => l.id === wall.levelId);
        const elev = level?.elevationMm ?? 0;
        this.placeOpening(g, wall, win.positionMm, win.widthMm, win.heightMm, elev, win.sillHeightMm);
      }
      this.updateWireframeEdges(g, isWireframe);
    }
    for (const grp of this.equipmentMeshes.values()) {
      this.updateWireframeEdges(grp, isWireframe);
    }
    for (const mesh of this.ductMeshes.values()) {
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const mesh of this.pipeMeshes.values()) {
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const mesh of this.cableTrayMeshes.values()) {
      this.updateWireframeEdges(mesh, isWireframe);
    }
    for (const grp of this.stairMeshes.values()) {
      this.updateWireframeEdges(grp, isWireframe);
    }
    for (const grp of this.rampMeshes.values()) {
      this.updateWireframeEdges(grp, isWireframe);
    }
  }

  private updateWireframeEdges(mesh: THREE.Object3D, isWireframe: boolean) {
    if (mesh instanceof THREE.Mesh) {
      let edges = mesh.getObjectByName("quad-edges") as THREE.LineSegments | undefined;
      if (!isWireframe) {
        if (edges) edges.visible = false;
        if (mesh.material instanceof THREE.Material) {
          mesh.material.wireframe = false;
          mesh.material.visible = true;
        }
        return;
      }

      if (!edges || edges.userData.geometryKey !== mesh.geometry.uuid) {
        if (edges) {
          mesh.remove(edges);
          edges.geometry.dispose();
          (edges.material as THREE.Material).dispose();
        }
        const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 20);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x0f172a,
          depthTest: true,
        });
        edges = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.name = "quad-edges";
        edges.userData.geometryKey = mesh.geometry.uuid;
        mesh.add(edges);
      }
      edges.visible = true;
      if (mesh.material instanceof THREE.Material) {
        mesh.material.wireframe = false;
        mesh.material.transparent = true;
        mesh.material.opacity = 0.12;
      }
    } else if (mesh instanceof THREE.Group) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name !== "quad-edges") {
          this.updateWireframeEdges(child, isWireframe);
        }
      });
    }
  }

  private applyMaterialAndColor(
    mat: THREE.MeshStandardMaterial,
    colorStr?: string,
    matType?: string,
  ) {
    // Reset defaults first
    mat.roughness = 0.85;
    mat.metalness = 0.05;
    mat.transparent = false;
    mat.opacity = 1.0;
    if (mat.map?.userData.vstudioMaterialClone) mat.map.dispose();
    mat.map = null;
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.transmission = 0;
      mat.clearcoat = 0;
      mat.clearcoatRoughness = 0.1;
      mat.ior = 1.5;
    }
    mat.wireframe = this.currentRenderMode === "wireframe";

    // 1. Light (Clay / Pastel tint) mode: clean soft matte materials tinted with material colors
    if (this.currentRenderMode === "light") {
      mat.roughness = 0.96;
      mat.metalness = 0.0;
      mat.wireframe = false;
      mat.map = null;
      const lightCol = colorStr || customMat?.color || (
        matType === "brick" ? "#fed7aa" :
        matType === "wood" ? "#fde68a" :
        matType === "glass" ? "#e0f2fe" :
        matType === "metal" ? "#e2e8f0" :
        matType === "concrete" ? "#d4d4d8" :
        "#f1f5f9"
      );
      mat.color.setStyle(lightCol);
      return;
    }

    const customMat = useMaterialStore.getState().getMaterial(matType);

    // 2. Full Color (Shaded) mode: ONE thick gray color for all materials like thick Lambert style
    if (this.currentRenderMode === "fullColor") {
      mat.roughness = 0.95;
      mat.metalness = 0.0;
      mat.color.setHex(0x8e95a0); // Consistent thick architectural Lambert gray
      return;
    }

    // 3. Realistic mode: render-quality PBR materials with high-res textures, bump, clearcoat, reflection
    if (customMat) {
      mat.roughness = customMat.roughness;
      mat.metalness = customMat.metalness;
      mat.opacity = customMat.opacity;
      mat.transparent =
        customMat.opacity < 0.99 ||
        Boolean(customMat.transmission && customMat.transmission > 0);
      mat.emissive.setStyle(customMat.emissive ?? "#000000");
      mat.emissiveIntensity = customMat.emissiveIntensity ?? 0;
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.transmission = customMat.transmission ?? 0;
        mat.clearcoat = customMat.clearcoat ?? (customMat.category === "Flooring" || customMat.category === "Glass" ? 0.6 : 0);
        mat.clearcoatRoughness = customMat.clearcoatRoughness ?? 0.08;
        mat.ior = customMat.ior ?? (customMat.category === "Glass" ? 1.52 : 1.45);
        mat.thickness = (customMat.transmission ?? 0) > 0 ? 0.15 : 0;
      }

      const effectiveColor = customMat.color || colorStr || "#cfd4dc";
      mat.color.setStyle(effectiveColor);

      const hatchStyle = customMat.hatchStyle && customMat.hatchStyle !== "solid"
        ? customMat.hatchStyle
        : (this.currentRenderMode === "realistic" ? "concrete" : null);

      if (hatchStyle) {
        const strokeColor = "#1f2937";
        const tex = getHatchCanvasTexture(
          hatchStyle,
          strokeColor,
          effectiveColor,
          customMat.hatchScaleMm || 200,
        );
        if (tex) {
          const materialTexture = tex.clone();
          materialTexture.wrapS = THREE.RepeatWrapping;
          materialTexture.wrapT = THREE.RepeatWrapping;
          const scaleM = (customMat.hatchScaleMm || 200) / 1000;
          const tiling = customMat.tilingScale ?? 1;
          materialTexture.repeat.set(tiling / scaleM, tiling / scaleM);
          materialTexture.userData.vstudioMaterialClone = true;
          materialTexture.needsUpdate = true;
          mat.map = materialTexture;
        }
      }
      return;
    }

    let baseColor = 0xcfd4dc; // default crisp architectural gray wall
    if (matType === "concrete") {
      baseColor = 0x9ca3af;
      mat.roughness = 0.85;
    } else if (matType === "brick") {
      baseColor = 0xa0522d;
      mat.roughness = 0.9;
    } else if (matType === "wood") {
      baseColor = 0x8b5a2b;
      mat.roughness = 0.7;
    } else if (matType === "glass") {
      baseColor = 0xe0f2fe;
      mat.roughness = 0.1;
      mat.metalness = 0.1;
      mat.transparent = true;
      mat.opacity = 0.3;
    } else if (matType === "metal") {
      baseColor = 0x94a3b8;
      mat.roughness = 0.2;
      mat.metalness = 0.9;
    } else if (matType === "plaster") {
      baseColor = 0xf8fafc;
      mat.roughness = 0.95;
    }

    if (colorStr) {
      mat.color.setStyle(colorStr);
    } else {
      mat.color.setHex(baseColor);
    }

    if (this.currentRenderMode === "realistic" && matType !== "glass") {
      const hatchType = matType === "brick" ? "brick" : matType === "wood" ? "diagonal" : "concrete";
      const hexStr = "#" + (colorStr ? colorStr.replace("#", "") : baseColor.toString(16).padStart(6, "0"));
      const tex = getHatchCanvasTexture(hatchType, "#374151", hexStr, 200);
      if (tex) {
        const materialTexture = tex.clone();
        materialTexture.wrapS = THREE.RepeatWrapping;
        materialTexture.wrapT = THREE.RepeatWrapping;
        materialTexture.repeat.set(5, 5);
        materialTexture.userData.vstudioMaterialClone = true;
        materialTexture.needsUpdate = true;
        mat.map = materialTexture;
      }
    }
  }

  resolveWallLayers(wall: LayoutWall): WallLayer[] {
    if (wall.layers && wall.layers.length > 0) return wall.layers;
    if (wall.wallTypeId) {
      const wt =
        useLayoutDrawingStore.getState().wallTypes.find((t) => t.id === wall.wallTypeId) ??
        DEFAULT_ELEMENT_TYPES[wall.wallTypeId];
      if (wt?.layers && wt.layers.length > 0) return wt.layers;
    }
    const t = wall.thicknessMm || 200;
    if (t >= 280) {
      return [
        { id: "l-int", name: "Interior Plaster", function: "finish1", material: "Plaster", thicknessMm: 15, color: "#f8fafc" },
        { id: "l-str", name: "Concrete Core", function: "structure", material: wall.material || "Concrete Core", thicknessMm: t - 130, color: "#8e9196" },
        { id: "l-ins", name: "Mineral Wool Insulation", function: "insulation", material: "Mineral Wool", thicknessMm: 100, color: "#fef08a" },
        { id: "l-ext", name: "Exterior Render", function: "finish2", material: "Stucco Render", thicknessMm: 15, color: "#e2e8f0" },
      ];
    } else if (t === 100 || t === 125) {
      return [
        { id: "l-g1", name: "Gypsum Board", function: "finish1", material: "Gypsum Board", thicknessMm: 12.5, color: "#f1f5f9" },
        { id: "l-cav", name: "Stud Cavity", function: "core", material: "Stud Cavity", thicknessMm: t - 25, color: "#cbd5e1" },
        { id: "l-g2", name: "Gypsum Board", function: "finish2", material: "Gypsum Board", thicknessMm: 12.5, color: "#f1f5f9" },
      ];
    } else {
      return [
        { id: "l-int", name: "Interior Finish", function: "finish1", material: "Plaster", thicknessMm: 15, color: "#f8fafc" },
        { id: "l-str", name: "Structural Core", function: "structure", material: wall.material || "Concrete", thicknessMm: Math.max(10, t - 30), color: wall.color || "#8e9196" },
        { id: "l-ext", name: "Exterior Finish", function: "finish2", material: "Plaster", thicknessMm: 15, color: "#f1f5f9" },
      ];
    }
  }

  applyWallLayerMaterial(
    mat: THREE.MeshStandardMaterial,
    layer: WallLayer,
    wall: LayoutWall,
    isSelected: boolean,
    renderMode: RenderMode,
  ) {
    // Reset defaults first
    mat.roughness = 0.85;
    mat.metalness = 0.05;
    mat.transparent = false;
    mat.opacity = 1.0;
    if (mat.map?.userData.vstudioMaterialClone) mat.map.dispose();
    mat.map = null;
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.transmission = 0;
      mat.clearcoat = 0;
      mat.clearcoatRoughness = 0.1;
      mat.ior = 1.5;
    }
    mat.wireframe = renderMode === "wireframe";

    if (isSelected) {
      mat.color.setHex(WALL_SEL);
      mat.emissive.setHex(0x92400e);
      mat.emissiveIntensity = 0.25;
      return;
    }

    // 1. Light (Clay / Pastel tint) mode: clean soft matte materials tinted per layer function
    if (renderMode === "light") {
      mat.roughness = 0.96;
      mat.metalness = 0.0;
      mat.wireframe = false;
      mat.map = null;
      const lightCol =
        layer.color ||
        (layer.function === "insulation" ? "#fef08a" :
         layer.function === "structure" ? "#d4d4d8" :
         layer.function === "finish1" ? "#f8fafc" :
         layer.function === "finish2" ? "#fed7aa" :
         layer.function === "core" ? "#cbd5e1" :
         "#e2e8f0");
      mat.color.setStyle(lightCol);
      return;
    }

    // 2. Full Color (Shaded) mode: ONE unified thick architectural Lambert style with subtle layer value differences
    if (renderMode === "fullColor") {
      mat.roughness = 0.95;
      mat.metalness = 0.0;
      if (layer.color && layer.color !== "#94a3b8") {
        mat.color.setStyle(layer.color);
      } else {
        // Subtle tonal variations of thick architectural Lambert gray
        const shadedTone =
          layer.function === "structure" ? 0x8e95a0 :
          layer.function === "insulation" ? 0xb4bac5 :
          layer.function === "finish1" ? 0xcbd0d9 :
          layer.function === "finish2" ? 0x747b87 :
          layer.function === "core" ? 0x848b96 :
          0x9fa6b2;
        mat.color.setHex(shadedTone);
      }
      return;
    }

    // 3. Realistic mode: render-quality PBR materials with high-res textures, bump, clearcoat, reflection
    const matKey = layer.material || wall.material;
    let customMat = useMaterialStore.getState().getMaterial(matKey);

    // Fallback keyword matching if not a direct ID
    if (!customMat) {
      const lower = `${layer.material} ${layer.name}`.toLowerCase();
      if (lower.includes("insul")) customMat = useMaterialStore.getState().getMaterial("thermal-insulation");
      else if (lower.includes("brick")) customMat = useMaterialStore.getState().getMaterial("brick");
      else if (lower.includes("plaster")) customMat = useMaterialStore.getState().getMaterial("plaster");
      else if (lower.includes("gypsum") || lower.includes("drywall")) customMat = useMaterialStore.getState().getMaterial("gypsum-board");
      else if (lower.includes("stucco") || lower.includes("render")) customMat = useMaterialStore.getState().getMaterial("stucco");
      else if (lower.includes("concrete")) customMat = useMaterialStore.getState().getMaterial("concrete");
      else if (lower.includes("wood")) customMat = useMaterialStore.getState().getMaterial("wood");
    }

    if (customMat) {
      mat.roughness = customMat.roughness;
      mat.metalness = customMat.metalness;
      mat.opacity = customMat.opacity;
      mat.transparent = customMat.opacity < 0.99 || Boolean(customMat.transmission && customMat.transmission > 0);
      mat.emissive.setStyle(customMat.emissive ?? "#000000");
      mat.emissiveIntensity = customMat.emissiveIntensity ?? 0;
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.transmission = customMat.transmission ?? 0;
        mat.clearcoat = customMat.clearcoat ?? 0;
        mat.clearcoatRoughness = customMat.clearcoatRoughness ?? 0.08;
        mat.ior = customMat.ior ?? 1.5;
        mat.thickness = (customMat.transmission ?? 0) > 0 ? 0.15 : 0;
      }

      const effectiveColor = layer.color || customMat.color || wall.color || "#cfd4dc";
      mat.color.setStyle(effectiveColor);

      const hatchStyle = customMat.hatchStyle && customMat.hatchStyle !== "solid"
        ? customMat.hatchStyle
        : (layer.function === "insulation" ? "zigzag" : layer.function === "structure" ? "concrete" : "solid");

      if (hatchStyle && hatchStyle !== "solid") {
        const strokeColor = "#1f2937";
        const tex = getHatchCanvasTexture(
          hatchStyle,
          strokeColor,
          effectiveColor,
          customMat.hatchScaleMm || 200,
        );
        if (tex) {
          const materialTexture = tex.clone();
          materialTexture.wrapS = THREE.RepeatWrapping;
          materialTexture.wrapT = THREE.RepeatWrapping;
          const scaleM = (customMat.hatchScaleMm || 200) / 1000;
          const tiling = customMat.tilingScale ?? 1;
          materialTexture.repeat.set(tiling / scaleM, tiling / scaleM);
          materialTexture.userData.vstudioMaterialClone = true;
          materialTexture.needsUpdate = true;
          mat.map = materialTexture;
        }
      }
      return;
    }

    // Default realistic fallback per function
    if (layer.function === "insulation") {
      mat.color.setHex(0xfef08a);
      mat.roughness = 0.95;
      const tex = getHatchCanvasTexture("zigzag", "#451a03", "#fef08a", 150);
      if (tex) {
        const mt = tex.clone();
        mt.wrapS = THREE.RepeatWrapping;
        mt.wrapT = THREE.RepeatWrapping;
        mt.repeat.set(4, 4);
        mt.userData.vstudioMaterialClone = true;
        mt.needsUpdate = true;
        mat.map = mt;
      }
    } else if (layer.function === "structure") {
      mat.color.setHex(0x8e9196);
      mat.roughness = 0.85;
      const tex = getHatchCanvasTexture("concrete", "#18181b", "#8e9196", 200);
      if (tex) {
        const mt = tex.clone();
        mt.wrapS = THREE.RepeatWrapping;
        mt.wrapT = THREE.RepeatWrapping;
        mt.repeat.set(4, 4);
        mt.userData.vstudioMaterialClone = true;
        mt.needsUpdate = true;
        mat.map = mt;
      }
    } else if (layer.function === "finish1") {
      mat.color.setHex(0xf8fafc);
      mat.roughness = 0.95;
    } else if (layer.function === "finish2") {
      mat.color.setHex(0xe2e8f0);
      mat.roughness = 0.88;
      const tex = getHatchCanvasTexture("sand", "#334155", "#e2e8f0", 180);
      if (tex) {
        const mt = tex.clone();
        mt.wrapS = THREE.RepeatWrapping;
        mt.wrapT = THREE.RepeatWrapping;
        mt.repeat.set(4, 4);
        mt.userData.vstudioMaterialClone = true;
        mt.needsUpdate = true;
        mat.map = mt;
      }
    } else {
      mat.color.setStyle(layer.color || wall.color || "#94a3b8");
      mat.roughness = 0.85;
    }
  }

  private buildWallLayerGeometry(
    wall: LayoutWall,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter: WallMiterOffsets | undefined,
    zOffsetM: number,
    layerThickM: number,
    totalThickM: number,
  ): THREE.BufferGeometry {
    if (
      wall.curved &&
      wall.arcRadiusMm != null &&
      wall.arcCenterXmm != null &&
      wall.arcCenterYmm != null &&
      wall.arcStartAngleDeg != null &&
      wall.arcEndAngleDeg != null
    ) {
      const r = fromMm(wall.arcRadiusMm);
      const height = fromMm(wall.heightMm || 3000);

      const startRad = (wall.arcStartAngleDeg * Math.PI) / 180;
      const endRad = (wall.arcEndAngleDeg * Math.PI) / 180;

      const rInner = r - totalThickM / 2 + zOffsetM;
      const rOuter = rInner + layerThickM;

      const shape = new THREE.Shape();
      const x0 = rInner * Math.cos(startRad);
      const y0 = rInner * Math.sin(startRad);
      shape.moveTo(x0, y0);
      shape.absarc(0, 0, rInner, startRad, endRad, false);
      shape.lineTo(rOuter * Math.cos(endRad), rOuter * Math.sin(endRad));
      shape.absarc(0, 0, rOuter, endRad, startRad, true);
      shape.lineTo(x0, y0);

      const extrudeSettings = {
        depth: height,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 32,
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.computeVertexNormals();
      return geo;
    } else {
      const dx = cl.endXmm - cl.startXmm;
      const dy = cl.endYmm - cl.startYmm;
      const len = Math.max(50, Math.hypot(dx, dy));
      const wallHeightMm = wall.heightMm || 3000;
      const lenM = fromMm(len);
      const heightM = fromMm(wallHeightMm);
      const halfLen = lenM / 2;
      const halfHeight = heightM / 2;

      // Build outer wall 2D profile (local X: along wall length, local Y: height)
      const shape = new THREE.Shape();
      shape.moveTo(-halfLen, -halfHeight);
      shape.lineTo(halfLen, -halfHeight);
      shape.lineTo(halfLen, halfHeight);
      shape.lineTo(-halfLen, halfHeight);
      shape.closePath();

      // Hosted openings (doors + windows)
      const openings: {
        posMm: number;
        widthMm: number;
        heightMm: number;
        sillMm: number;
        headShape?: string;
      }[] = [
        ...doors.map((d) => ({
          posMm: d.positionMm,
          widthMm: d.widthMm || 900,
          heightMm: d.heightMm || 2100,
          sillMm: 0,
          headShape: d.headShape,
        })),
        ...windows.map((w) => ({
          posMm: w.positionMm,
          widthMm: w.widthMm || 1200,
          heightMm: w.heightMm || 1400,
          sillMm: w.sillHeightMm ?? 900,
          headShape: w.headShape,
        })),
      ];

      for (const op of openings) {
        const holeCenterX = fromMm(op.posMm) - halfLen;
        const holeHalfW = fromMm(op.widthMm) / 2;
        const holeYBottom = fromMm(op.sillMm) - halfHeight;
        const holeYTop = fromMm(op.sillMm + op.heightMm) - halfHeight;

        const x1 = holeCenterX - holeHalfW;
        const x2 = holeCenterX + holeHalfW;
        const y1 = Math.max(-halfHeight - 0.001, holeYBottom);
        const y2 = Math.min(halfHeight + 0.001, holeYTop);

        // Verify valid opening geometry inside wall boundaries
        if (x2 > -halfLen && x1 < halfLen && y2 > y1) {
          const clampedX1 = Math.max(-halfLen + 0.001, x1);
          const clampedX2 = Math.min(halfLen - 0.001, x2);
          const clampedHoleHalfW = (clampedX2 - clampedX1) / 2;
          const clampedCenterX = (clampedX1 + clampedX2) / 2;

          const hole = new THREE.Path();
          if (op.headShape === "arched" && y2 - y1 > clampedHoleHalfW) {
            const rectH = y2 - y1 - clampedHoleHalfW;
            const archBaseY = y1 + rectH;
            hole.moveTo(clampedX1, y1);
            hole.lineTo(clampedX2, y1);
            hole.lineTo(clampedX2, archBaseY);
            hole.absarc(
              clampedCenterX,
              archBaseY,
              clampedHoleHalfW,
              0,
              Math.PI,
              false,
            );
            hole.lineTo(clampedX1, y1);
          } else if (
            op.headShape === "triangular" &&
            y2 - y1 > clampedHoleHalfW / 2
          ) {
            const rectH = y2 - y1 - clampedHoleHalfW / 2;
            const triBaseY = y1 + rectH;
            hole.moveTo(clampedX1, y1);
            hole.lineTo(clampedX2, y1);
            hole.lineTo(clampedX2, triBaseY);
            hole.lineTo(clampedCenterX, y2);
            hole.lineTo(clampedX1, triBaseY);
            hole.lineTo(clampedX1, y1);
          } else {
            hole.moveTo(clampedX1, y1);
            hole.lineTo(clampedX2, y1);
            hole.lineTo(clampedX2, y2);
            hole.lineTo(clampedX1, y2);
            hole.lineTo(clampedX1, y1);
          }
          hole.closePath();
          shape.holes.push(hole);
        }
      }

      const extrudeSettings = {
        depth: layerThickM,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      // Center along extrusion axis (Z) within its respective layer slot
      const zMin = -totalThickM / 2 + zOffsetM;
      geo.translate(0, 0, zMin);

      // Section 2: Clean miter vertex displacement for multi-wall junctions
      if (
        miter &&
        (miter.startOffsetLeftMm ||
          miter.startOffsetRightMm ||
          miter.endOffsetLeftMm ||
          miter.endOffsetRightMm)
      ) {
        const pos = geo.attributes.position;
        const sLeftM = fromMm(miter.startOffsetLeftMm);
        const sRightM = fromMm(miter.startOffsetRightMm);
        const eLeftM = fromMm(miter.endOffsetLeftMm);
        const eRightM = fromMm(miter.endOffsetRightMm);

        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);

          const tz = Math.max(0, Math.min(1, (vz + totalThickM / 2) / (totalThickM || 1e-5)));

          if (vx < -halfLen + 0.05) {
            const newX = -halfLen + (tz * sLeftM + (1 - tz) * sRightM);
            pos.setX(i, newX);
          } else if (vx > halfLen - 0.05) {
            const newX = halfLen - (tz * eLeftM + (1 - tz) * eRightM);
            pos.setX(i, newX);
          }
        }
      }

      geo.computeVertexNormals();

      // Generate world-metric UVs so hatch textures and materials tile seamlessly and never stretch
      const pos = geo.attributes.position;
      const uvs = geo.attributes.uv;
      if (pos && uvs) {
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          const vz = pos.getZ(i);
          const nx = Math.abs(geo.attributes.normal?.getX(i) ?? 0);
          const ny = Math.abs(geo.attributes.normal?.getY(i) ?? 0);
          if (ny > 0.5) {
            uvs.setXY(i, vx, vz);
          } else if (nx > 0.5) {
            uvs.setXY(i, vz, vy);
          } else {
            uvs.setXY(i, vx, vy);
          }
        }
        uvs.needsUpdate = true;
      }

      return geo;
    }
  }

  private createWallMesh(
    wall: LayoutWall,
    elevMm: number,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter?: WallMiterOffsets,
  ): THREE.Group {
    const grp = new THREE.Group();
    grp.userData.layoutWallId = wall.id;
    grp.userData.kind = "layout-wall";
    this.updateWallMesh(grp, wall, elevMm, cl, doors, windows, miter);
    return grp;
  }

  private isPlanModeActive = false;

  private buildWallPlanCut(
    wall: LayoutWall,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter?: WallMiterOffsets,
    layers?: WallLayer[],
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = "wall-plan-cut";

    const resolvedLayers = layers || this.resolveWallLayers(wall);
    const totalThickMm = wall.thicknessMm || 200;
    const totalThickM = fromMm(totalThickMm);
    const halfThick = totalThickM / 2;

    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x18181b,
      depthTest: false,
    });

    if (
      wall.curved &&
      wall.arcRadiusMm != null &&
      wall.arcCenterXmm != null &&
      wall.arcCenterYmm != null &&
      wall.arcStartAngleDeg != null &&
      wall.arcEndAngleDeg != null
    ) {
      const r = fromMm(wall.arcRadiusMm);
      const startRad = (wall.arcStartAngleDeg * Math.PI) / 180;
      const endRad = (wall.arcEndAngleDeg * Math.PI) / 180;

      let currentOffsetM = 0;
      for (const layer of resolvedLayers) {
        const layerThickM = fromMm(layer.thicknessMm || (totalThickMm / resolvedLayers.length));
        const rInner = Math.max(0.01, r - halfThick + currentOffsetM);
        const rOuter = rInner + layerThickM;

        const shape = new THREE.Shape();
        const x0 = rInner * Math.cos(startRad);
        const y0 = rInner * Math.sin(startRad);
        shape.moveTo(x0, y0);
        shape.absarc(0, 0, rInner, startRad, endRad, false);
        shape.lineTo(rOuter * Math.cos(endRad), rOuter * Math.sin(endRad));
        shape.absarc(0, 0, rOuter, endRad, startRad, true);
        shape.lineTo(x0, y0);
        shape.closePath();

        const hatchStyle =
          layer.function === "insulation" ? "zigzag" :
          layer.function === "structure" ? "concrete" :
          layer.function === "finish2" ? "brick" : "solid";

        const hatchTex = getHatchCanvasTexture(
          hatchStyle,
          "#18181b",
          layer.color || (layer.function === "insulation" ? "#fef08a" : "#f4f4f5"),
          160,
        );

        const pochéMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          map: hatchTex,
          side: THREE.DoubleSide,
          depthTest: false,
        });

        const geo = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geo, pochéMat);
        mesh.renderOrder = 30;
        group.add(mesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 15), edgeMat);
        edges.renderOrder = 35;
        group.add(edges);

        currentOffsetM += layerThickM;
      }
      return group;
    }

    const dx = cl.endXmm - cl.startXmm;
    const dy = cl.endYmm - cl.startYmm;
    const len = Math.max(50, Math.hypot(dx, dy));
    const lenM = fromMm(len);
    const halfLen = lenM / 2;

    // Collect opening voids along wall local X
    const openings: { x1: number; x2: number }[] = [];
    for (const d of doors) {
      const cx = fromMm(d.positionMm) - halfLen;
      const hw = fromMm(d.widthMm || 900) / 2;
      openings.push({ x1: Math.max(-halfLen, cx - hw), x2: Math.min(halfLen, cx + hw) });
    }
    for (const w of windows) {
      const cx = fromMm(w.positionMm) - halfLen;
      const hw = fromMm(w.widthMm || 1200) / 2;
      openings.push({ x1: Math.max(-halfLen, cx - hw), x2: Math.min(halfLen, cx + hw) });
    }

    // Sort and merge opening ranges
    openings.sort((a, b) => a.x1 - b.x1);
    const mergedOpenings: { x1: number; x2: number }[] = [];
    for (const op of openings) {
      if (mergedOpenings.length === 0) {
        mergedOpenings.push({ ...op });
      } else {
        const last = mergedOpenings[mergedOpenings.length - 1];
        if (op.x1 <= last.x2 + 0.01) {
          last.x2 = Math.max(last.x2, op.x2);
        } else {
          mergedOpenings.push({ ...op });
        }
      }
    }

    // Build solid wall segments between openings
    const solidSegments: { x1: number; x2: number }[] = [];
    let currentX = -halfLen;
    for (const op of mergedOpenings) {
      if (op.x1 - currentX > 0.01) {
        solidSegments.push({ x1: currentX, x2: op.x1 });
      }
      currentX = Math.max(currentX, op.x2);
    }
    if (halfLen - currentX > 0.01) {
      solidSegments.push({ x1: currentX, x2: halfLen });
    }

    const sLeftM = fromMm(miter?.startOffsetLeftMm ?? 0);
    const sRightM = fromMm(miter?.startOffsetRightMm ?? 0);
    const eLeftM = fromMm(miter?.endOffsetLeftMm ?? 0);
    const eRightM = fromMm(miter?.endOffsetRightMm ?? 0);

    for (const seg of solidSegments) {
      const isWallStart = Math.abs(seg.x1 - (-halfLen)) < 0.02;
      const isWallEnd = Math.abs(seg.x2 - halfLen) < 0.02;

      let layerOffsetM = 0;
      for (const layer of resolvedLayers) {
        const layerThickM = fromMm(layer.thicknessMm || (totalThickMm / resolvedLayers.length));
        const z0 = -halfThick + layerOffsetM;
        const z1 = z0 + layerThickM;

        const tz0 = Math.max(0, Math.min(1, (z0 + halfThick) / (totalThickM || 1e-5)));
        const tz1 = Math.max(0, Math.min(1, (z1 + halfThick) / (totalThickM || 1e-5)));

        const p0x = seg.x1 + (isWallStart ? (tz1 * sLeftM + (1 - tz1) * sRightM) : 0);
        const p0z = z1;

        const p1x = seg.x2 + (isWallEnd ? (tz1 * eLeftM + (1 - tz1) * eRightM) : 0);
        const p1z = z1;

        const p2x = seg.x2 + (isWallEnd ? (tz0 * eLeftM + (1 - tz0) * eRightM) : 0);
        const p2z = z0;

        const p3x = seg.x1 + (isWallStart ? (tz0 * sLeftM + (1 - tz0) * sRightM) : 0);
        const p3z = z0;

        const shape = new THREE.Shape();
        shape.moveTo(p0x, p0z);
        shape.lineTo(p1x, p1z);
        shape.lineTo(p2x, p2z);
        shape.lineTo(p3x, p3z);
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2); // Place in local X/Z horizontal plane

        // Set world-metric UVs for seamless hatch pattern tiling
        const pos = geo.attributes.position;
        const uvs = geo.attributes.uv;
        if (pos && uvs) {
          for (let i = 0; i < pos.count; i++) {
            uvs.setXY(i, pos.getX(i), pos.getZ(i));
          }
          uvs.needsUpdate = true;
        }

        const hatchStyle =
          layer.function === "insulation" ? "zigzag" :
          layer.function === "structure" ? "concrete" :
          layer.function === "finish2" ? "brick" : "solid";

        const hatchTex = getHatchCanvasTexture(
          hatchStyle,
          "#18181b",
          layer.color || (layer.function === "insulation" ? "#fef08a" : "#f4f4f5"),
          160,
        );

        const pochéMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          map: hatchTex,
          side: THREE.DoubleSide,
          depthTest: false,
        });

        const pochéMesh = new THREE.Mesh(geo, pochéMat);
        pochéMesh.renderOrder = 30;
        group.add(pochéMesh);

        // Dark perimeter cut lines
        const linePts = [
          new THREE.Vector3(p0x, 0.002, p0z),
          new THREE.Vector3(p1x, 0.002, p1z),
          new THREE.Vector3(p1x, 0.002, p1z),
          new THREE.Vector3(p2x, 0.002, p2z),
          new THREE.Vector3(p2x, 0.002, p2z),
          new THREE.Vector3(p3x, 0.002, p3z),
          new THREE.Vector3(p3x, 0.002, p3z),
          new THREE.Vector3(p0x, 0.002, p0z),
        ];
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(linePts);
        const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        edgeLines.renderOrder = 35;
        group.add(edgeLines);

        layerOffsetM += layerThickM;
      }
    }

    return group;
  }

  private updateWallMesh(
    grp: THREE.Group,
    wall: LayoutWall,
    elevMm: number,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter?: WallMiterOffsets,
  ) {
    this.clearGroupContents(grp);

    const layers = this.resolveWallLayers(wall);
    const totalThickMm = wall.thicknessMm || 200;
    const totalThickM = fromMm(totalThickMm);

    let currentOffsetM = 0;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const layerThickMm = layer.thicknessMm || (totalThickMm / layers.length);
      const layerThickM = fromMm(layerThickMm);

      const geo = this.buildWallLayerGeometry(
        wall,
        cl,
        doors,
        windows,
        miter,
        currentOffsetM,
        layerThickM,
        totalThickM,
      );

      const mat = new THREE.MeshPhysicalMaterial({
        roughness: 0.85,
        metalness: 0.05,
      });

      this.applyWallLayerMaterial(mat, layer, wall, false, this.currentRenderMode);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `layer-${layer.id || i}`;
      mesh.userData.layoutWallId = wall.id;
      mesh.userData.isWallLayer = true;
      mesh.userData.layerId = layer.id;
      mesh.userData.layerFunction = layer.function;
      mesh.userData.layerMaterial = layer.material;
      mesh.userData.layerColor = layer.color;

      grp.add(mesh);
      currentOffsetM += layerThickM;
    }

    if (
      wall.curved &&
      wall.arcRadiusMm != null &&
      wall.arcCenterXmm != null &&
      wall.arcCenterYmm != null
    ) {
      grp.position.set(
        fromMm(wall.arcCenterXmm),
        fromMm(elevMm),
        fromMm(wall.arcCenterYmm),
      );
      grp.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      const height = fromMm(wall.heightMm || 3000);
      const midX = fromMm((cl.startXmm + cl.endXmm) / 2);
      const midZ = fromMm((cl.startYmm + cl.endYmm) / 2);
      const y = fromMm(elevMm) + height / 2;
      grp.position.set(midX, y, midZ);
      grp.rotation.set(
        0,
        -Math.atan2(cl.endYmm - cl.startYmm, cl.endXmm - cl.startXmm),
        0,
      );
    }
    grp.userData.layoutWallId = wall.id;

    // Attach 2D plan cut poché group
    const planGroup = this.buildWallPlanCut(wall, cl, doors, windows, miter, layers);
    const height = fromMm(wall.heightMm || 3000);
    planGroup.position.set(0, -height / 2 + 0.03, 0);
    planGroup.visible = this.isPlanModeActive;
    grp.add(planGroup);

    // Apply wireframe mode state if active
    const isWireframe = this.currentRenderMode === "wireframe";
    if (isWireframe) {
      this.updateWireframeEdges(grp, true);
    }
  }

  setPlanMode(planMode: boolean) {
    this.isPlanModeActive = planMode;
    for (const grp of this.wallMeshes.values()) {
      const planCut = grp.children.find((c) => c.name === "wall-plan-cut");
      if (planCut) planCut.visible = planMode;
      grp.traverse((c) => {
        if (c instanceof THREE.Mesh && c.userData.isWallLayer && c.material instanceof THREE.Material) {
          c.material.visible = !planMode;
        }
      });
    }
    this.setOpeningsPlanMode(planMode);
  }

  private createOpeningGroup(_label: string, color: number): THREE.Group {
    const g = new THREE.Group();
    return g;
  }

  private placeOpening(
    g: THREE.Group,
    wall: LayoutWall,
    positionMm: number,
    widthMm: number,
    heightMm: number,
    elevMm: number,
    sillMm: number,
  ) {
    // Determine category and details
    const state = useLayoutDrawingStore.getState();
    const door = g.userData.layoutDoorId ? state.doors.find((d) => d.id === g.userData.layoutDoorId) : null;
    const win = g.userData.layoutWindowId ? state.windows.find((w) => w.id === g.userData.layoutWindowId) : null;
    
    const category = door ? "door" : "window";
    const style = door?.style ?? "wood";
    const headShape = door?.headShape ?? win?.headShape ?? "flat";
    const colorStr = door?.color ?? win?.color;

    // Clear old 3D representations
    const oldBox = g.children.find((c) => c.name === "opening-box");
    if (oldBox) {
      g.remove(oldBox);
      this.disposeObject(oldBox);
    }

    const w = fromMm(widthMm);
    const h = fromMm(heightMm);
    const d = fromMm(wall.thicknessMm);

    // Build outline shapes
    const buildOutlineShape = (sw: number, sh: number, shapeType: string): THREE.Shape => {
      const shape = new THREE.Shape();
      const halfW = sw / 2;
      
      if (shapeType === "arched") {
        const rectH = Math.max(0.01, sh - halfW);
        shape.moveTo(-halfW, 0);
        shape.lineTo(-halfW, rectH);
        shape.absarc(0, rectH, halfW, Math.PI, 0, false);
        shape.lineTo(halfW, 0);
      } else if (shapeType === "triangular") {
        const rectH = Math.max(0.01, sh - halfW / 2);
        shape.moveTo(-halfW, 0);
        shape.lineTo(-halfW, rectH);
        shape.lineTo(0, sh);
        shape.lineTo(halfW, rectH);
        shape.lineTo(halfW, 0);
      } else {
        shape.moveTo(-halfW, 0);
        shape.lineTo(-halfW, sh);
        shape.lineTo(halfW, sh);
        shape.lineTo(halfW, 0);
      }
      shape.closePath();
      return shape;
    };

    const boxGroup = new THREE.Group();
    boxGroup.name = "opening-box";

    const frameThick = 0.05; // 50mm
    const outer = buildOutlineShape(w, h, headShape);
    const inner = buildOutlineShape(w - frameThick * 2, Math.max(0.01, h - frameThick), headShape);
    outer.holes.push(inner);

    const { frameMat, panelMat } = this.getOpeningMaterials(
      category,
      style,
      colorStr,
      door?.material || win?.material,
      (door as any)?.panelMaterial || (win as any)?.panelMaterial,
    );

    // 1. Frame Mesh
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: d, bevelEnabled: false });
    frameGeo.translate(0, 0, -d / 2);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.name = "opening-frame";
    boxGroup.add(frameMesh);

    // 2. Panel Mesh (door leaf or window glass pane)
    const panelThick = category === "door" ? 0.04 : 0.012; // 40mm leaf, 12mm glass
    if (style === "double" && category === "door") {
      const leafW = (w - frameThick * 2) / 2;
      const leafShape = buildOutlineShape(leafW, Math.max(0.01, h - frameThick), headShape);
      
      const leftGeo = new THREE.ExtrudeGeometry(leafShape, { depth: panelThick, bevelEnabled: false });
      leftGeo.translate(0, 0, -panelThick / 2);
      const leftMesh = new THREE.Mesh(leftGeo, panelMat);
      leftMesh.position.set(-leafW / 2, 0, 0);
      leftMesh.name = "opening-panel-left";
      
      const rightGeo = new THREE.ExtrudeGeometry(leafShape, { depth: panelThick, bevelEnabled: false });
      rightGeo.translate(0, 0, -panelThick / 2);
      const rightMesh = new THREE.Mesh(rightGeo, panelMat);
      rightMesh.position.set(leafW / 2, 0, 0);
      rightMesh.name = "opening-panel-right";

      boxGroup.add(leftMesh, rightMesh);
    } else {
      const panelShape = buildOutlineShape(w - frameThick * 2, Math.max(0.01, h - frameThick), headShape);
      const panelGeo = new THREE.ExtrudeGeometry(panelShape, { depth: panelThick, bevelEnabled: false });
      panelGeo.translate(0, 0, -panelThick / 2);
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.name = "opening-panel";
      boxGroup.add(panelMesh);
    }

    g.add(boxGroup);

    // Position group in world coords
    const pt = pointOnWallMm(wall, positionMm);
    const y = fromMm(elevMm + sillMm);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    boxGroup.position.set(fromMm(pt.xMm), y, fromMm(pt.yMm));
    boxGroup.rotation.set(0, -wallAngleAtPositionRad(wall, positionMm), 0);
  }

  private getOpeningMaterials(
    category: "door" | "window",
    style?: string,
    colorStr?: string,
    frameMatId?: string,
    panelMatId?: string,
  ) {
    const frameMat = new THREE.MeshPhysicalMaterial({ roughness: 0.6, metalness: 0.1 });
    let panelMat: THREE.Material = new THREE.MeshPhysicalMaterial({ roughness: 0.8, metalness: 0.05 });

    if (this.currentRenderMode === "wireframe") {
      frameMat.wireframe = true;
      (panelMat as THREE.MeshPhysicalMaterial).wireframe = true;
    }

    if (this.currentRenderMode === "light") {
      frameMat.color.setHex(0xf8fafc);
      frameMat.roughness = 0.95;
      frameMat.metalness = 0;
      (panelMat as THREE.MeshPhysicalMaterial).color.setHex(0xf8fafc);
      (panelMat as THREE.MeshPhysicalMaterial).roughness = 0.95;
      (panelMat as THREE.MeshPhysicalMaterial).metalness = 0;
      (panelMat as THREE.MeshPhysicalMaterial).transparent = false;
      (panelMat as THREE.MeshPhysicalMaterial).opacity = 1.0;
      return { frameMat, panelMat };
    }

    const customFrame = useMaterialStore.getState().getMaterial(frameMatId);
    if (customFrame) {
      frameMat.roughness = customFrame.roughness;
      frameMat.metalness = customFrame.metalness;
      frameMat.color.setStyle(colorStr || customFrame.color);
    } else if (colorStr) {
      frameMat.color.setStyle(colorStr);
    } else if (category === "window") {
      frameMat.color.setHex(0x27272a); // dark metal frame
      frameMat.roughness = 0.35;
      frameMat.metalness = 0.85;
    } else {
      frameMat.color.setHex(0x52525b); // door frame
      frameMat.roughness = 0.5;
      frameMat.metalness = 0.2;
    }

    const customPanel = useMaterialStore.getState().getMaterial(panelMatId);
    if (customPanel) {
      if (customPanel.transmission && customPanel.transmission > 0.3) {
        panelMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(customPanel.color),
          transparent: true,
          opacity: customPanel.opacity,
          roughness: customPanel.roughness,
          metalness: customPanel.metalness,
          transmission: customPanel.transmission,
          thickness: 0.02,
        });
      } else {
        const std = new THREE.MeshPhysicalMaterial({
          roughness: customPanel.roughness,
          metalness: customPanel.metalness,
          opacity: customPanel.opacity,
          transparent: customPanel.opacity < 0.99,
        });
        std.color.setStyle(customPanel.color);
        panelMat = std;
      }
      return { frameMat, panelMat };
    }

    if (category === "window" || style === "glass") {
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xa8d8ea,
        transparent: true,
        opacity: 0.35,
        roughness: 0.05,
        metalness: 0.08,
        transmission: 0.92,
        thickness: 0.02,
      });
      return { frameMat, panelMat: glassMat };
    } else if (style === "wood" || category === "door") {
      (panelMat as THREE.MeshStandardMaterial).color.setHex(0x8b5a2b);
      (panelMat as THREE.MeshStandardMaterial).roughness = 0.65;
      (panelMat as THREE.MeshStandardMaterial).metalness = 0.02;
    } else if (style === "metal") {
      (panelMat as THREE.MeshStandardMaterial).color.setHex(0xd1d5db);
      (panelMat as THREE.MeshStandardMaterial).roughness = 0.3;
      (panelMat as THREE.MeshStandardMaterial).metalness = 0.9;
    } else {
      (panelMat as THREE.MeshStandardMaterial).color.copy(frameMat.color);
      (panelMat as THREE.MeshStandardMaterial).roughness = 0.7;
    }

    return { frameMat, panelMat };
  }

  private tintOpening(g: THREE.Group, selected: boolean) {
    const box = g.children.find((c) => c.name === "opening-box");
    if (!box) return;
    box.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        const mat = c.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
        this.setMeshSelectionOutline(c, selected);
      }
    });
  }

  private setMeshSelectionOutline(obj: THREE.Object3D, selected: boolean) {
    if (obj instanceof THREE.Group) {
      for (const child of obj.children) {
        if (child instanceof THREE.Mesh && child.name !== "quad-edges" && child.name !== "wall-plan-cut") {
          this.setMeshSelectionOutline(child, selected);
        }
      }
      return;
    }
    if (!(obj instanceof THREE.Mesh)) return;
    const existing = obj.getObjectByName("layout-selection-outline") as THREE.LineSegments | undefined;
    if (existing) {
      obj.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
    }
    if (!selected) return;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(obj.geometry, 18),
      new THREE.LineBasicMaterial({
        color: 0xfacc15,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      }),
    );
    outline.name = "layout-selection-outline";
    outline.renderOrder = 1000;
    outline.raycast = () => undefined;
    obj.add(outline);
  }

  private applyOpeningDisplay(g: THREE.Group, planMode: boolean) {
    const box = g.children.find((c) => c.name === "opening-box");
    const plan = g.children.find((c) => c.name === "plan-symbol");
    if (box) box.visible = !planMode;
    if (plan) plan.visible = planMode;
  }

  /**
   * Fast toggle: Top → CAD plan symbols; 3D / elevations → solid boxes.
   * Both geometries stay in the scene so switching views does not rebuild.
   */
  setOpeningsPlanMode(planMode: boolean) {
    for (const g of this.doorMeshes.values()) {
      this.applyOpeningDisplay(g, planMode);
    }
    for (const g of this.windowMeshes.values()) {
      this.applyOpeningDisplay(g, planMode);
    }
  }

  /** Ensure solid box + CAD plan symbol both exist; visibility via planMode. */
  private syncDoorPlanSymbol(
    g: THREE.Group,
    wall: LayoutWall,
    door: LayoutDoor,
    elevMm: number,
    planMode: boolean,
  ) {
    this.placeOpening(
      g,
      wall,
      door.positionMm,
      door.widthMm,
      door.heightMm,
      elevMm,
      0,
    );

    let plan = g.children.find((c) => c.name === "plan-symbol") as
      | THREE.Group
      | undefined;
    if (plan) {
      g.remove(plan);
      this.disposeObject(plan);
    }
    plan = this.buildDoorPlanSymbol(wall, door, elevMm);
    plan.name = "plan-symbol";
    plan.userData.layoutDoorId = door.id;
    g.add(plan);
    this.applyOpeningDisplay(g, planMode);
  }

  private syncWindowPlanSymbol(
    g: THREE.Group,
    wall: LayoutWall,
    win: LayoutWindow,
    elevMm: number,
    planMode: boolean,
  ) {
    this.placeOpening(
      g,
      wall,
      win.positionMm,
      win.widthMm,
      win.heightMm,
      elevMm,
      win.sillHeightMm,
    );

    let plan = g.children.find((c) => c.name === "plan-symbol") as
      | THREE.Group
      | undefined;
    if (plan) {
      g.remove(plan);
      this.disposeObject(plan);
    }
    plan = this.buildWindowPlanSymbol(wall, win, elevMm);
    plan.name = "plan-symbol";
    plan.userData.layoutWindowId = win.id;
    g.add(plan);
    this.applyOpeningDisplay(g, planMode);
  }

  private buildDoorPlanSymbol(
    wall: LayoutWall,
    door: LayoutDoor,
    elevMm: number,
  ): THREE.Group {
    const g = new THREE.Group();
    const y = fromMm(elevMm) + 0.03;
    const angle = wallAngleRad(wall);
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    // Perpendicular into swing side (Y-up: rotate dir by 90° * swing).
    const swing = door.swing === -1 ? -1 : 1;
    const perpX = -dirZ * swing;
    const perpZ = dirX * swing;

    const halfW = door.widthMm / 2;
    const hingeAlong =
      door.hinge === "end"
        ? door.positionMm + halfW
        : door.positionMm - halfW;
    const hinge = pointOnWallMm(wall, hingeAlong);
    const hx = fromMm(hinge.xMm);
    const hz = fromMm(hinge.yMm);
    const leafLen = fromMm(door.widthMm);

    // Leaf in open position (90° into room).
    const leafEnd = new THREE.Vector3(
      hx + perpX * leafLen,
      y,
      hz + perpZ * leafLen,
    );
    const leafGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(hx, y, hz),
      leafEnd,
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x44403c,
      depthTest: false,
    });
    const leaf = new THREE.Line(leafGeo, lineMat);
    leaf.renderOrder = 20;
    g.add(leaf);

    // Quarter-circle swing arc from closed (along wall) to open (perp).
    const closedSign = door.hinge === "end" ? -1 : 1;
    const closedX = dirX * closedSign;
    const closedZ = dirZ * closedSign;
    const arcPts: THREE.Vector3[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = Math.cos((Math.PI / 2) * t);
      const s = Math.sin((Math.PI / 2) * t);
      // Rotate closed → open
      const dx = closedX * c + perpX * s;
      const dz = closedZ * c + perpZ * s;
      arcPts.push(
        new THREE.Vector3(hx + dx * leafLen, y, hz + dz * leafLen),
      );
    }
    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(arcPts),
      new THREE.LineBasicMaterial({
        color: 0x78716c,
        depthTest: false,
      }),
    );
    arc.renderOrder = 20;
    g.add(arc);

    // Invisible pick mesh covering the opening
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(leafLen, 0.05, fromMm(Math.max(wall.thicknessMm, 80))),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const mid = pointOnWallMm(wall, door.positionMm);
    pick.position.set(fromMm(mid.xMm), y, fromMm(mid.yMm));
    pick.rotation.y = -angle;
    pick.userData.layoutDoorId = door.id;
    g.add(pick);

    return g;
  }

  private buildWindowPlanSymbol(
    wall: LayoutWall,
    win: LayoutWindow,
    elevMm: number,
  ): THREE.Group {
    const g = new THREE.Group();
    const y = fromMm(elevMm) + 0.03;
    const angle = wallAngleAtPositionRad(wall, win.positionMm);
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const perpX = -dirZ;
    const perpZ = dirX;
    const halfW = win.widthMm / 2;
    const a = pointOnWallMm(wall, win.positionMm - halfW);
    const b = pointOnWallMm(wall, win.positionMm + halfW);
    const ax = fromMm(a.xMm);
    const az = fromMm(a.yMm);
    const bx = fromMm(b.xMm);
    const bz = fromMm(b.yMm);
    const thick = fromMm(wall.thicknessMm);
    const halfT = thick / 2;
    const offsets = [-0.35, 0, 0.35].map((t) => t * thick);
    const mat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      depthTest: false,
    });
    for (const o of offsets) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax + perpX * o, y, az + perpZ * o),
          new THREE.Vector3(bx + perpX * o, y, bz + perpZ * o),
        ]),
        mat,
      );
      line.renderOrder = 20;
      g.add(line);
    }
    // Window jamb / sill end caps in 2D
    const capMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      depthTest: false,
    });
    const leftCap = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax - perpX * halfT, y, az - perpZ * halfT),
        new THREE.Vector3(ax + perpX * halfT, y, az + perpZ * halfT),
      ]),
      capMat,
    );
    leftCap.renderOrder = 21;
    g.add(leftCap);

    const rightCap = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(bx - perpX * halfT, y, bz - perpZ * halfT),
        new THREE.Vector3(bx + perpX * halfT, y, bz + perpZ * halfT),
      ]),
      capMat,
    );
    rightCap.renderOrder = 21;
    g.add(rightCap);

    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(
        fromMm(win.widthMm),
        0.05,
        fromMm(Math.max(wall.thicknessMm, 80)),
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const mid = pointOnWallMm(wall, win.positionMm);
    pick.position.set(fromMm(mid.xMm), y, fromMm(mid.yMm));
    pick.rotation.y = -angle;
    pick.userData.layoutWindowId = win.id;
    g.add(pick);
    return g;
  }

  syncDucts(
    ducts: LayoutDuct[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedDuctIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(ducts.map((d) => d.id));
    for (const [id, mesh] of this.ductMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.ductMeshes.delete(id);
      }
    }

    for (const duct of ducts) {
      const isSelected = opts.selectedDuctIds.has(duct.id);
      const level = levels.find((l) => l.id === duct.levelId);
      const baseElev = level ? level.elevationMm : opts.fallbackElevMm;
      const elevOffset = duct.elevationMm ?? duct.elevationOffsetMm ?? 2600;
      const centerY = fromMm(baseElev + elevOffset);

      const dx = fromMm(duct.endXmm - duct.startXmm);
      const dz = fromMm(duct.endYmm - duct.startYmm);
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;

      const midX = fromMm((duct.startXmm + duct.endXmm) / 2);
      const midZ = fromMm((duct.startYmm + duct.endYmm) / 2);
      const angle = Math.atan2(dz, dx);

      const systemType = duct.systemType ?? (duct as LayoutDuct & { system?: LayoutDuct["systemType"] }).system ?? "supply";
      const systemColor = MEP_SYSTEM_COLORS[`duct_${systemType}` as keyof typeof MEP_SYSTEM_COLORS];
      const hexColor = duct.color
        ? parseInt(duct.color.replace("#", ""), 16)
        : systemColor ? parseInt(systemColor.replace("#", ""), 16) : 0x06b6d4;

      let mesh = this.ductMeshes.get(duct.id);
      const isFlex = Boolean(duct.isFlex);
      const isPlaceholder = Boolean(duct.isPlaceholder);
      const isRound = (duct.shape === "round" || isFlex);
      const isOval = duct.shape === "oval" && !isFlex;
      const w = fromMm(duct.widthMm ?? 300);
      const h = fromMm(duct.heightMm ?? 200);
      const r = fromMm((duct.diameterMm ?? 200) / 2);

      const geoKey = isPlaceholder
        ? `placeholder:${len}`
        : isFlex
        ? `flex:${r}:${len}`
        : isRound
        ? `round:${r}:${len}`
        : isOval
        ? `oval:${w}:${h}:${len}`
        : `rect:${w}:${h}:${len}`;

      const buildDuctGeo = () => {
        if (isPlaceholder) {
          const g = new THREE.CylinderGeometry(0.015, 0.015, len, 8);
          g.rotateZ(Math.PI / 2);
          return g;
        } else if (isFlex) {
          const g = new THREE.CylinderGeometry(r, r, len, 16, Math.max(6, Math.round(len * 15)));
          g.rotateZ(Math.PI / 2);
          return g;
        } else if (isRound) {
          const g = new THREE.CylinderGeometry(r, r, len, 16);
          g.rotateZ(Math.PI / 2);
          return g;
        } else if (isOval) {
          // Flat oval cross-section extruded along duct length
          const sh = new THREE.Shape();
          const rad = Math.min(h / 2, w / 2);
          const straightW = Math.max(0.001, (w - 2 * rad) / 2);
          sh.moveTo(-straightW, -rad);
          sh.lineTo(straightW, -rad);
          sh.absarc(straightW, 0, rad, -Math.PI / 2, Math.PI / 2, false);
          sh.lineTo(-straightW, rad);
          sh.absarc(-straightW, 0, rad, Math.PI / 2, (3 * Math.PI) / 2, false);
          const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
          g.translate(0, 0, -len / 2);
          g.rotateY(Math.PI / 2);
          return g;
        } else {
          return new THREE.BoxGeometry(len, h, w);
        }
      };

      if (!mesh) {
        const geo = buildDuctGeo();
        const mat = new THREE.MeshStandardMaterial({
          color: isPlaceholder ? 0x38bdf8 : hexColor,
          roughness: isFlex ? 0.5 : 0.35,
          metalness: isFlex ? 0.6 : 0.5,
          wireframe: isPlaceholder,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.layoutDuctId = duct.id;
        mesh.userData.kind = "duct";
        mesh.userData.geometryKey = geoKey;
        this.ductMeshes.set(duct.id, mesh);
        this.group.add(mesh);
      } else if (mesh.userData.geometryKey !== geoKey) {
        mesh.geometry.dispose();
        mesh.geometry = buildDuctGeo();
        mesh.userData.geometryKey = geoKey;
      }

      mesh.position.set(midX, centerY, midZ);
      mesh.rotation.y = -angle;
      mesh.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        duct.levelId == null ||
        duct.levelId === "default-level" ||
        duct.levelId === opts.activeLevelId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(isPlaceholder ? 0x38bdf8 : hexColor);
      mat.wireframe = isPlaceholder;
      this.setMeshSelectionOutline(mesh, isSelected);
    }
  }

  syncPipes(
    pipes: LayoutPipe[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedPipeIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(pipes.map((p) => p.id));
    for (const [id, mesh] of this.pipeMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.pipeMeshes.delete(id);
      }
    }

    for (const pipe of pipes) {
      const isSelected = opts.selectedPipeIds.has(pipe.id);
      const isPlaceholder = Boolean(pipe.isPlaceholder);
      const level = levels.find((l) => l.id === pipe.levelId);
      const baseElev = level ? level.elevationMm : opts.fallbackElevMm;
      const elevOffset = pipe.elevationMm ?? pipe.elevationOffsetMm ?? 2700;
      const centerY = fromMm(baseElev + elevOffset);

      const dx = fromMm(pipe.endXmm - pipe.startXmm);
      const dz = fromMm(pipe.endYmm - pipe.startYmm);
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;

      const midX = fromMm((pipe.startXmm + pipe.endXmm) / 2);
      const midZ = fromMm((pipe.startYmm + pipe.endYmm) / 2);
      const angle = Math.atan2(dz, dx);

      const systemType = pipe.systemType ?? (pipe as LayoutPipe & { system?: LayoutPipe["systemType"] }).system ?? "hydronic_supply";
      const systemColor = MEP_SYSTEM_COLORS[`pipe_${systemType}` as keyof typeof MEP_SYSTEM_COLORS];
      const hexColor = pipe.color
        ? parseInt(pipe.color.replace("#", ""), 16)
        : systemColor ? parseInt(systemColor.replace("#", ""), 16) : (systemType === "fire_protection" ? 0xef4444 : 0x3b82f6);

      const r = isPlaceholder ? 0.012 : fromMm((pipe.diameterMm ?? 28) / 2);
      const geoKey = `pipe:${isPlaceholder ? "ph" : r}:${len}`;

      let mesh = this.pipeMeshes.get(pipe.id);
      if (!mesh) {
        const geo = new THREE.CylinderGeometry(r, r, len, isPlaceholder ? 8 : 12);
        geo.rotateZ(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: hexColor,
          roughness: 0.25,
          metalness: 0.8,
          wireframe: isPlaceholder,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.layoutPipeId = pipe.id;
        mesh.userData.kind = "pipe";
        mesh.userData.geometryKey = geoKey;
        this.pipeMeshes.set(pipe.id, mesh);
        this.group.add(mesh);
      } else if (mesh.userData.geometryKey !== geoKey) {
        mesh.geometry.dispose();
        const geo = new THREE.CylinderGeometry(r, r, len, isPlaceholder ? 8 : 12);
        geo.rotateZ(Math.PI / 2);
        mesh.geometry = geo;
        mesh.userData.geometryKey = geoKey;
      }

      mesh.position.set(midX, centerY, midZ);
      mesh.rotation.y = -angle;
      mesh.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        pipe.levelId == null ||
        pipe.levelId === "default-level" ||
        pipe.levelId === opts.activeLevelId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(hexColor);
      mat.wireframe = isPlaceholder;
      this.setMeshSelectionOutline(mesh, isSelected);
    }
  }

  syncWires(
    wires: LayoutWire[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedWireIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(wires.map((w) => w.id));
    for (const [id, grp] of this.wireMeshes) {
      if (!keep.has(id)) {
        this.disposeGroup(grp);
        this.group.remove(grp);
        this.wireMeshes.delete(id);
      }
    }

    for (const wire of wires) {
      const isSelected = opts.selectedWireIds.has(wire.id);
      const level = levels.find((l) => l.id === wire.levelId);
      const baseElev = level ? level.elevationMm : opts.fallbackElevMm;
      const elevOffset = wire.elevationMm ?? 2800;
      const centerY = fromMm(baseElev + elevOffset);

      const dx = fromMm(wire.endXmm - wire.startXmm);
      const dz = fromMm(wire.endYmm - wire.startYmm);
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;

      const midX = fromMm((wire.startXmm + wire.endXmm) / 2);
      const midZ = fromMm((wire.startYmm + wire.endYmm) / 2);
      const angle = Math.atan2(dz, dx);

      const col = wire.systemType === "lighting" ? 0xfacc15 : wire.systemType === "data" ? 0x06b6d4 : wire.systemType === "control" ? 0xa855f7 : 0xeab308;

      let grp = this.wireMeshes.get(wire.id);
      if (!grp) {
        grp = new THREE.Group();
        grp.name = `wire-${wire.id}`;
        grp.userData.layoutWireId = wire.id;
        grp.userData.kind = "wire";
        this.wireMeshes.set(wire.id, grp);
        this.group.add(grp);

        const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, len, 8);
        wireGeo.rotateZ(Math.PI / 2);
        const wireMat = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.3,
          metalness: 0.6,
        });
        const mesh = new THREE.Mesh(wireGeo, wireMat);
        mesh.userData.layoutWireId = wire.id;
        grp.add(mesh);

        // Terminal beads
        const termGeo = new THREE.SphereGeometry(0.016, 8, 8);
        const termMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
        const term1 = new THREE.Mesh(termGeo, termMat);
        term1.position.set(-len / 2, 0, 0);
        grp.add(term1);
        const term2 = new THREE.Mesh(termGeo, termMat);
        term2.position.set(len / 2, 0, 0);
        grp.add(term2);
      }

      grp.position.set(midX, centerY, midZ);
      grp.rotation.y = -angle;
      grp.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        wire.levelId == null ||
        wire.levelId === "default-level" ||
        wire.levelId === opts.activeLevelId;
    }
  }

  syncWorkPlane(workPlane: LayoutWorkPlane | null, activeLevelElevMm: number) {
    this.clearGroupContents(this.workPlaneGroup);
    if (!workPlane || !workPlane.isActive) return;

    const elev = fromMm(activeLevelElevMm + workPlane.elevationMm);
    const size = 12; // 12m grid
    const grid = new THREE.GridHelper(size, 24, 0x38bdf8, 0x0284c7);
    grid.position.set(fromMm(workPlane.originXmm), elev, fromMm(workPlane.originYmm));
    if (workPlane.slopeDeg) {
      grid.rotation.z = (workPlane.slopeDeg * Math.PI) / 180;
    }
    if (workPlane.rotationDeg) {
      grid.rotation.y = (workPlane.rotationDeg * Math.PI) / 180;
    }

    // Translucent glass plane
    const planeGeo = new THREE.PlaneGeometry(size, size);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.copy(grid.position);
    planeMesh.rotation.copy(grid.rotation);

    this.workPlaneGroup.add(grid);
    this.workPlaneGroup.add(planeMesh);
  }

  syncCableTrays(
    cableTrays: LayoutCableTray[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedCableTrayIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(cableTrays.map((t) => t.id));
    for (const [id, mesh] of this.cableTrayMeshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.cableTrayMeshes.delete(id);
      }
    }

    for (const tray of cableTrays) {
      const isSelected = opts.selectedCableTrayIds.has(tray.id);
      const level = levels.find((l) => l.id === tray.levelId);
      const baseElev = level ? level.elevationMm : opts.fallbackElevMm;
      const elevOffset = tray.elevationMm ?? tray.elevationOffsetMm ?? 2800;
      const centerY = fromMm(baseElev + elevOffset);

      const dx = fromMm(tray.endXmm - tray.startXmm);
      const dz = fromMm(tray.endYmm - tray.startYmm);
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;

      const midX = fromMm((tray.startXmm + tray.endXmm) / 2);
      const midZ = fromMm((tray.startYmm + tray.endYmm) / 2);
      const angle = Math.atan2(dz, dx);

      const w = fromMm(tray.widthMm ?? 200);
      const h = fromMm(tray.heightMm ?? 60);
      const geoKey = `tray:${w}:${h}:${len}:${tray.trayType}`;

      let mesh = this.cableTrayMeshes.get(tray.id);
      if (!mesh) {
        const geo = new THREE.BoxGeometry(len, h, w);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.4,
          metalness: 0.7,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.userData.layoutCableTrayId = tray.id;
        mesh.userData.kind = "cabletray";
        mesh.userData.geometryKey = geoKey;
        this.cableTrayMeshes.set(tray.id, mesh);
        this.group.add(mesh);
      } else if (mesh.userData.geometryKey !== geoKey) {
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(len, h, w);
        mesh.userData.geometryKey = geoKey;
      }

      mesh.position.set(midX, centerY, midZ);
      mesh.rotation.y = -angle;
      mesh.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        tray.levelId == null ||
        tray.levelId === "default-level" ||
        tray.levelId === opts.activeLevelId;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(tray.trayType === "conduit" ? 0xd97706 : 0x94a3b8);
      this.setMeshSelectionOutline(mesh, isSelected);
    }
  }

  syncMepEquipment(
    equipment: LayoutMepEquipment[],
    levels: LayoutLevel[],
    opts: {
      activeLevelId: string | null;
      selectedEquipmentIds: Set<string>;
      showAllLevels: boolean;
      fallbackElevMm: number;
    },
  ) {
    const keep = new Set(equipment.map((e) => e.id));
    for (const [id, grp] of this.equipmentMeshes) {
      if (!keep.has(id)) {
        this.disposeGroup(grp);
        this.group.remove(grp);
        this.equipmentMeshes.delete(id);
      }
    }

    for (const item of equipment) {
      const isSelected = opts.selectedEquipmentIds.has(item.id);
      const level = levels.find((l) => l.id === item.levelId);
      const baseElev = level ? level.elevationMm : opts.fallbackElevMm;
      const centerY = fromMm(baseElev + (item.elevationMm ?? item.elevationOffsetMm ?? 0));

      const w = fromMm(item.widthMm ?? (item.category === "radiator" ? 1000 : item.category === "fan_coil" ? 900 : item.category === "ac_unit" ? 850 : item.category === "chiller" ? 1600 : item.category === "air_terminal" ? 600 : item.category === "lighting_fixture" ? 600 : item.category === "sprinkler" ? 80 : 400));
      const h = fromMm(item.heightMm ?? (item.category === "radiator" ? 600 : item.category === "fan_coil" ? 250 : item.category === "ac_unit" ? 290 : item.category === "chiller" ? 1200 : item.category === "air_terminal" ? 120 : item.category === "lighting_fixture" ? 80 : item.category === "sprinkler" ? 100 : 400));
      const d = fromMm(item.depthMm ?? (item.category === "radiator" ? 100 : item.category === "fan_coil" ? 600 : item.category === "ac_unit" ? 210 : item.category === "chiller" ? 800 : item.category === "air_terminal" ? 600 : item.category === "lighting_fixture" ? 600 : item.category === "sprinkler" ? 80 : 400));

      const geoKey = `${item.category}:${w}:${h}:${d}:${isSelected ? "sel" : "idle"}`;

      let grp = this.equipmentMeshes.get(item.id);
      const needsRebuild = !grp || grp.userData.geometryKey !== geoKey;

      if (!grp) {
        grp = new THREE.Group();
        grp.name = `equip-${item.id}`;
        grp.userData.layoutEquipmentId = item.id;
        grp.userData.kind = "equipment";
        this.equipmentMeshes.set(item.id, grp);
        this.group.add(grp);
      }

      if (needsRebuild) {
        this.clearGroupContents(grp);
        grp.userData.geometryKey = geoKey;

        // Build procedural 3D model per category
        if (item.category === "toilet") {
          // Porcelain Toilet (WC): bowl, tank/cistern, seat, flush plate, drain
          const porcelainMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.12,
            metalness: 0.05,
          });
          const seatMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.2,
            metalness: 0.02,
          });
          const chromeMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.95,
            roughness: 0.1,
          });

          // 1. Plinth / Base
          const baseGeo = new THREE.CylinderGeometry(w * 0.35, w * 0.42, h * 0.35, 20);
          const baseMesh = new THREE.Mesh(baseGeo, porcelainMat);
          baseMesh.position.set(0, h * 0.175, d * 0.05);
          baseMesh.userData.layoutEquipmentId = item.id;
          grp.add(baseMesh);

          // 2. Sculpted Bowl
          const bowlGeo = new THREE.CylinderGeometry(w * 0.48, w * 0.36, h * 0.25, 24);
          const bowlMesh = new THREE.Mesh(bowlGeo, porcelainMat);
          bowlMesh.position.set(0, h * 0.42, d * 0.08);
          bowlMesh.userData.layoutEquipmentId = item.id;
          grp.add(bowlMesh);

          // 3. Inner Bowl Recess / Cavity
          const innerBowlGeo = new THREE.CylinderGeometry(w * 0.38, w * 0.22, h * 0.18, 20);
          const innerBowlMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.7 });
          const innerBowl = new THREE.Mesh(innerBowlGeo, innerBowlMat);
          innerBowl.position.set(0, h * 0.46, d * 0.08);
          grp.add(innerBowl);

          // 4. Toilet Seat & Lid
          const seatGeo = new THREE.CylinderGeometry(w * 0.49, w * 0.49, 0.02, 24);
          const seatMesh = new THREE.Mesh(seatGeo, seatMat);
          seatMesh.position.set(0, h * 0.55, d * 0.08);
          seatMesh.userData.layoutEquipmentId = item.id;
          grp.add(seatMesh);

          // 5. Water Cistern / Tank (rear)
          const tankGeo = new THREE.BoxGeometry(w * 0.95, h * 0.45, d * 0.32);
          const tankMesh = new THREE.Mesh(tankGeo, porcelainMat);
          tankMesh.position.set(0, h * 0.65, -d * 0.32);
          tankMesh.userData.layoutEquipmentId = item.id;
          grp.add(tankMesh);

          // 6. Dual Flush Button on Tank Top
          const btnGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.008, 16);
          const btn = new THREE.Mesh(btnGeo, chromeMat);
          btn.position.set(0, h * 0.88, -d * 0.32);
          grp.add(btn);
        } else if (item.category === "sink") {
          // Porcelain Washbasin / Sink: basin, counter, mixer faucet, drain siphon
          const porcelainMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.12,
            metalness: 0.05,
          });
          const chromeMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.95,
            roughness: 0.08,
          });

          // 1. Basin Body with rim
          const basinGeo = new THREE.BoxGeometry(w, h * 0.22, d);
          const basin = new THREE.Mesh(basinGeo, porcelainMat);
          basin.position.set(0, h - (h * 0.11), 0);
          basin.userData.layoutEquipmentId = item.id;
          grp.add(basin);

          // 2. Recessed Inner Bowl Cavity
          const cavityGeo = new THREE.CylinderGeometry(Math.min(w, d) * 0.38, Math.min(w, d) * 0.26, h * 0.18, 24);
          const cavityMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, transparent: true, opacity: 0.6 });
          const cavity = new THREE.Mesh(cavityGeo, cavityMat);
          cavity.position.set(0, h - 0.06, 0.02);
          grp.add(cavity);

          // 3. Chrome Mixer Faucet Tap
          const tapBodyGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.14, 16);
          const tapBody = new THREE.Mesh(tapBodyGeo, chromeMat);
          tapBody.position.set(0, h + 0.07, -d * 0.32);
          grp.add(tapBody);

          // Faucet arched spout
          const spoutGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12);
          spoutGeo.rotateX(Math.PI / 4);
          const spout = new THREE.Mesh(spoutGeo, chromeMat);
          spout.position.set(0, h + 0.13, -d * 0.32 + 0.05);
          grp.add(spout);

          // Faucet mixer handle
          const handleGeo = new THREE.BoxGeometry(0.016, 0.01, 0.06);
          const handle = new THREE.Mesh(handleGeo, chromeMat);
          handle.position.set(0, h + 0.14, -d * 0.32);
          grp.add(handle);

          // 4. Chrome Bottle Siphon P-Trap
          const trapGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.15, 12);
          const trap = new THREE.Mesh(trapGeo, chromeMat);
          trap.position.set(0, h - 0.3, 0);
          grp.add(trap);

          const wastePipeGeo = new THREE.CylinderGeometry(0.016, 0.016, d * 0.5, 12);
          wastePipeGeo.rotateX(Math.PI / 2);
          const wastePipe = new THREE.Mesh(wastePipeGeo, chromeMat);
          wastePipe.position.set(0, h - 0.28, -d * 0.25);
          grp.add(wastePipe);
        } else if (item.category === "boiler") {
          // Insulated Cylindrical Boiler / Water Heater
          const tankMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.65,
            roughness: 0.3,
          });
          const brassMat = new THREE.MeshStandardMaterial({
            color: 0xd97706,
            metalness: 0.85,
            roughness: 0.2,
          });

          // 1. Cylindrical Tank
          const tankGeo = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.85, 32);
          const tank = new THREE.Mesh(tankGeo, tankMat);
          tank.position.set(0, h / 2, 0);
          tank.userData.layoutEquipmentId = item.id;
          grp.add(tank);

          // 2. Hemispherical Top & Bottom Caps
          const topDomeGeo = new THREE.SphereGeometry(w / 2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
          const topDome = new THREE.Mesh(topDomeGeo, tankMat);
          topDome.position.set(0, h * 0.925, 0);
          grp.add(topDome);

          // 3. Pressure Gauge Dial (Front)
          const gaugeGeo = new THREE.CircleGeometry(0.045, 20);
          const gaugeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const gauge = new THREE.Mesh(gaugeGeo, gaugeMat);
          gauge.position.set(0, h * 0.65, w / 2 + 0.005);
          grp.add(gauge);

          // 4. Digital readout panel
          const panelGeo = new THREE.BoxGeometry(0.12, 0.06, 0.015);
          const panelMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
          const display = new THREE.Mesh(panelGeo, panelMat);
          display.position.set(0, h * 0.52, w / 2 + 0.008);
          grp.add(display);

          // 5. Pipe connection stubs
          const hotNipple = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7 }));
          hotNipple.rotateZ(Math.PI / 2);
          hotNipple.position.set(w / 2 + 0.04, h * 0.85, 0);
          grp.add(hotNipple);

          const coldNipple = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.7 }));
          coldNipple.rotateZ(Math.PI / 2);
          coldNipple.position.set(-w / 2 - 0.04, h * 0.15, 0);
          grp.add(coldNipple);
        } else if (item.category === "panel") {
          // Electrical Distribution Panel Enclosure
          const panelMat = new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            metalness: 0.7,
            roughness: 0.35,
          });
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
          body.position.set(0, h / 2, 0);
          body.userData.layoutEquipmentId = item.id;
          grp.add(body);

          // Inspection Window
          const winGeo = new THREE.BoxGeometry(w * 0.75, h * 0.6, 0.01);
          const winMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.2 });
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(0, h * 0.55, d / 2 + 0.006);
          grp.add(win);

          // Breaker rows (MCBs)
          for (let row = 0; row < 3; row++) {
            const rowY = h * 0.4 + row * 0.12;
            const rowGeo = new THREE.BoxGeometry(w * 0.65, 0.05, 0.015);
            const rowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
            const rowMesh = new THREE.Mesh(rowGeo, rowMat);
            rowMesh.position.set(0, rowY, d / 2 + 0.012);
            grp.add(rowMesh);

            // Colored switches
            for (let s = -2; s <= 2; s++) {
              const swGeo = new THREE.BoxGeometry(0.015, 0.025, 0.01);
              const swMat = new THREE.MeshBasicMaterial({ color: s === 0 ? 0xef4444 : 0x10b981 });
              const sw = new THREE.Mesh(swGeo, swMat);
              sw.position.set(s * 0.05, rowY, d / 2 + 0.02);
              grp.add(sw);
            }
          }

          // Yellow Warning Triangle
          const warnGeo = new THREE.CircleGeometry(0.035, 3);
          warnGeo.rotateZ(Math.PI / 2);
          const warnMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
          const warn = new THREE.Mesh(warnGeo, warnMat);
          warn.position.set(0, h * 0.18, d / 2 + 0.008);
          grp.add(warn);
        } else if (item.category === "socket") {
          // Electrical Flush Socket Outlet
          const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
          const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.4), plateMat);
          plate.position.set(0, h / 2, 0);
          plate.userData.layoutEquipmentId = item.id;
          grp.add(plate);

          // Twin socket holes
          for (const sx of [-w * 0.2, w * 0.2]) {
            const socketGeo = new THREE.CircleGeometry(w * 0.15, 16);
            const socketMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
            const sMesh = new THREE.Mesh(socketGeo, socketMat);
            sMesh.position.set(sx, h / 2, d * 0.2 + 0.002);
            grp.add(sMesh);
          }
        } else if (item.category === "diffuser_supply" || item.category === "diffuser_extract" || item.category === "diffuser_overflow" || item.category === "air_terminal") {
          const isSupply = item.category === "diffuser_supply" || item.category === "air_terminal";
          const isExtract = item.category === "diffuser_extract";
          const col = isSupply ? 0x06b6d4 : isExtract ? 0xf59e0b : 0x10b981;

          const plateGeo = new THREE.BoxGeometry(w, 0.04, d);
          const plateMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.3 });
          const plate = new THREE.Mesh(plateGeo, plateMat);
          plate.userData.layoutEquipmentId = item.id;
          grp.add(plate);

          // Concentric louvre vanes
          for (let step = 1; step <= 3; step++) {
            const factor = 1 - step * 0.22;
            const coreGeo = new THREE.BoxGeometry(w * factor, 0.045, d * factor);
            const coreMat = new THREE.MeshStandardMaterial({ color: step % 2 === 0 ? 0x1e293b : col, metalness: 0.3 });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set(0, 0.002, 0);
            core.userData.layoutEquipmentId = item.id;
            grp.add(core);
          }

          // Top duct collar
          const collarGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16);
          const collarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
          const collar = new THREE.Mesh(collarGeo, collarMat);
          collar.position.set(0, 0.06, 0);
          collar.userData.layoutEquipmentId = item.id;
          grp.add(collar);
        } else if (item.category === "lighting_fixture" || item.category === "light") {
          // Luminaire fixture
          const frameGeo = new THREE.BoxGeometry(w, h * 0.4, d);
          const frameMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });
          const frame = new THREE.Mesh(frameGeo, frameMat);
          frame.position.set(0, h * 0.2, 0);
          frame.userData.layoutEquipmentId = item.id;
          grp.add(frame);

          // Light emitter panel
          const emitGeo = new THREE.BoxGeometry(w * 0.88, 0.02, d * 0.88);
          const emitMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfef08a,
            emissiveIntensity: 0.6,
            roughness: 0.1,
          });
          const emit = new THREE.Mesh(emitGeo, emitMat);
          emit.position.set(0, 0.01, 0);
          emit.userData.layoutEquipmentId = item.id;
          grp.add(emit);
        } else if (item.category === "sprinkler") {
          // Fire suppression sprinkler head
          const collarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
          const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 });
          const sprCollar = new THREE.Mesh(collarGeo, brassMat);
          sprCollar.position.set(0, 0.06, 0);
          sprCollar.userData.layoutEquipmentId = item.id;
          grp.add(sprCollar);

          // Glass thermal bulb (Red)
          const bulbGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8);
          const bulbMat = new THREE.MeshPhysicalMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, roughness: 0.1 });
          const bulb = new THREE.Mesh(bulbGeo, bulbMat);
          bulb.position.set(0, 0.03, 0);
          grp.add(bulb);

          // Deflector plate disc
          const deflGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.006, 16);
          const defl = new THREE.Mesh(deflGeo, brassMat);
          defl.position.set(0, 0.005, 0);
          defl.userData.layoutEquipmentId = item.id;
          grp.add(defl);
        } else if (item.category === "generic_component") {
          // Generic MEP component with brushed metallic body and accent notch
          const genGeo = new THREE.BoxGeometry(w, h, d);
          const genMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.35 });
          const gen = new THREE.Mesh(genGeo, genMat);
          gen.position.set(0, h / 2, 0);
          gen.userData.layoutEquipmentId = item.id;
          grp.add(gen);

          const notchGeo = new THREE.BoxGeometry(w * 0.9, 0.02, 0.04);
          const notchMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          const notch = new THREE.Mesh(notchGeo, notchMat);
          notch.position.set(0, h + 0.01, d / 2 - 0.03);
          grp.add(notch);
        } else if (item.category === "radiator") {
          // Procedural Radiator with front casing, convective flutes, valve nubs, and pipe connectors
          const radMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.25, roughness: 0.35 });
          const radGeo = new THREE.BoxGeometry(w, h, d);
          const body = new THREE.Mesh(radGeo, radMat);
          body.position.set(0, h / 2, 0);
          body.userData.layoutEquipmentId = item.id;
          grp.add(body);

          // Front convective ribs/flutes
          const ribCount = Math.max(3, Math.floor(w / 0.08));
          for (let r = 0; r < ribCount; r++) {
            const rx = -w / 2 + (r + 0.5) * (w / ribCount);
            const ribGeo = new THREE.BoxGeometry(0.015, h * 0.85, 0.008);
            const ribMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
            const rib = new THREE.Mesh(ribGeo, ribMat);
            rib.position.set(rx, h / 2, d / 2 + 0.005);
            grp.add(rib);
          }

          // Top convection grille
          const grilleMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
          const topGrille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.02, d * 0.85), grilleMat);
          topGrille.position.set(0, h + 0.01, 0);
          topGrille.userData.layoutEquipmentId = item.id;
          grp.add(topGrille);

          // Flow valve on top-left (Red)
          const valveGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12);
          valveGeo.rotateZ(Math.PI / 2);
          const flowValve = new THREE.Mesh(valveGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7 }));
          flowValve.position.set(-w / 2 - 0.03, h - 0.08, 0);
          flowValve.userData.layoutEquipmentId = item.id;
          grp.add(flowValve);

          // Return valve on bottom-right (Blue)
          const retValve = new THREE.Mesh(valveGeo, new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.7 }));
          retValve.position.set(w / 2 + 0.03, 0.08, 0);
          retValve.userData.layoutEquipmentId = item.id;
          grp.add(retValve);
        } else if (item.category === "fan_coil" || item.category === "ac_unit") {
          // Procedural Fan Coil / AC Indoor unit
          const caseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.3, roughness: 0.4 });
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), caseMat);
          body.position.set(0, h / 2, 0);
          body.userData.layoutEquipmentId = item.id;
          grp.add(body);

          // Front supply air louvre
          const louvreMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2 });
          const louvre = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.35, d * 0.08), louvreMat);
          louvre.position.set(0, h * 0.3, d / 2 + 0.02);
          louvre.userData.layoutEquipmentId = item.id;
          grp.add(louvre);

          // Rear return duct collar
          const collarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
          const returnCollar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, h * 0.6, 0.04), collarMat);
          returnCollar.position.set(0, h / 2, -d / 2 - 0.02);
          returnCollar.userData.layoutEquipmentId = item.id;
          grp.add(returnCollar);

          // Status LED indicator
          const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), ledMat);
          led.position.set(w / 2 - 0.06, h * 0.8, d / 2 + 0.01);
          grp.add(led);
        } else if (item.category === "chiller" || item.category === "heat_pump") {
          // Heavy mechanical plant unit (Chiller / Heat Pump)
          const plantMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 });
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plantMat);
          body.position.set(0, h / 2, 0);
          body.userData.layoutEquipmentId = item.id;
          grp.add(body);

          // Side air intake louvers
          for (let lv = 0; lv < 5; lv++) {
            const luvMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.015, 0.02), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
            luvMesh.position.set(0, h * 0.2 + lv * 0.12, d / 2 + 0.005);
            grp.add(luvMesh);
          }

          // Fan grilles on top
          const fanGeo = new THREE.CylinderGeometry(Math.min(w, d) * 0.35, Math.min(w, d) * 0.35, 0.05, 20);
          const fanMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
          const fan1 = new THREE.Mesh(fanGeo, fanMat);
          fan1.position.set(-w * 0.22, h + 0.025, 0);
          grp.add(fan1);
          const fan2 = new THREE.Mesh(fanGeo, fanMat);
          fan2.position.set(w * 0.22, h + 0.025, 0);
          grp.add(fan2);
        } else {
          // Generic fixture box
          const genGeo = new THREE.BoxGeometry(w, h, d);
          const genMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 });
          const gen = new THREE.Mesh(genGeo, genMat);
          gen.position.set(0, h / 2, 0);
          gen.userData.layoutEquipmentId = item.id;
          grp.add(gen);
        }

        // Add visual connector markers if selected
        if (isSelected) {
          const connectors = getEquipmentConnectors(item);
          for (const c of connectors) {
            const isDuct = c.type === "duct";
            const isElec = c.type === "electrical";
            const cColor = isDuct
              ? (c.systemType === "supply" ? 0x06b6d4 : 0xf59e0b)
              : isElec
              ? 0xeab308
              : (c.systemType === "hydronic_supply" ? 0xef4444 : c.systemType === "hydronic_return" ? 0x3b82f6 : 0x10b981);

            const markerGeo = new THREE.RingGeometry(0.02, 0.045, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: cColor, side: THREE.DoubleSide });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(fromMm(c.relXmm), fromMm(c.relZmm), fromMm(c.relYmm));
            marker.lookAt(
              fromMm(c.relXmm + c.dir[0]),
              fromMm(c.relZmm + c.dir[2]),
              fromMm(c.relYmm + c.dir[1]),
            );
            grp.add(marker);
          }
        }
      }

      const rot = ((item.rotationDeg ?? 0) * Math.PI) / 180;
      grp.position.set(fromMm(item.xMm), centerY, fromMm(item.yMm));
      grp.rotation.y = rot;
      grp.visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        item.levelId == null ||
        item.levelId === "default-level" ||
        item.levelId === opts.activeLevelId;

      // Selection outline for primary child
      const primaryChild = grp.children[0] as THREE.Mesh | undefined;
      if (primaryChild) {
        this.setMeshSelectionOutline(primaryChild, isSelected);
      }
    }
  }

  setMepPreview(
    tool: "duct" | "flex_duct" | "mep_placeholder" | "pipe" | "cabletray" | "wire" | "equipment" | "workplane" | null,
    start: { xMm: number; yMm: number } | null,
    cursor: { xMm: number; yMm: number } | null,
    params?: any,
  ) {
    this.clearGroupContents(this.mepPreview);
    if (!tool || !cursor) return;

    const baseElevMm = params?.baseElevMm ?? 0;

    if (tool === "equipment") {
      const elev = fromMm(baseElevMm + (params?.elevationMm ?? 0));
      const cat = params?.category ?? "generic_component";
      const w = fromMm(cat === "radiator" ? 1000 : cat === "fan_coil" ? 900 : cat === "ac_unit" ? 850 : cat === "chiller" ? 1600 : cat === "air_terminal" ? 600 : cat === "lighting_fixture" ? 600 : cat === "sprinkler" ? 80 : 400);
      const h = fromMm(cat === "radiator" ? 600 : cat === "fan_coil" ? 250 : cat === "ac_unit" ? 290 : cat === "chiller" ? 1200 : cat === "air_terminal" ? 120 : cat === "lighting_fixture" ? 80 : cat === "sprinkler" ? 100 : 400);
      const d = fromMm(cat === "radiator" ? 100 : cat === "fan_coil" ? 600 : cat === "ac_unit" ? 210 : cat === "chiller" ? 800 : cat === "air_terminal" ? 600 : cat === "lighting_fixture" ? 600 : cat === "sprinkler" ? 80 : 400);

      const ghostGeo = new THREE.BoxGeometry(w, h, d);
      const col = cat === "sprinkler" ? 0xef4444 : cat === "lighting_fixture" || cat === "light" ? 0xfacc15 : 0x38bdf8;
      const ghostMat = new THREE.MeshStandardMaterial({
        color: col,
        transparent: true,
        opacity: 0.65,
      });
      const ghost = new THREE.Mesh(ghostGeo, ghostMat);
      ghost.position.set(fromMm(cursor.xMm), elev + h / 2, fromMm(cursor.yMm));
      this.mepPreview.add(ghost);
      return;
    }

    if (tool === "workplane") {
      const elev = fromMm(baseElevMm + (params?.elevationMm ?? 0));
      const grid = new THREE.GridHelper(6, 12, 0x38bdf8, 0x0284c7);
      grid.position.set(fromMm(cursor.xMm), elev, fromMm(cursor.yMm));
      this.mepPreview.add(grid);
      return;
    }

    if (!start) return;

    const dx = fromMm(cursor.xMm - start.xMm);
    const dz = fromMm(cursor.yMm - start.yMm);
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return;

    const midX = fromMm((start.xMm + cursor.xMm) / 2);
    const midZ = fromMm((start.yMm + cursor.yMm) / 2);
    const angle = Math.atan2(dz, dx);
    const elev = fromMm(baseElevMm + (params?.elevationMm ?? 2600));

    if (tool === "duct" || tool === "flex_duct" || tool === "mep_placeholder") {
      const isPlaceholder = tool === "mep_placeholder";
      const isFlex = tool === "flex_duct";
      const isRound = params?.shape === "round" || isFlex;
      const w = fromMm(params?.widthMm ?? 300);
      const h = fromMm(params?.heightMm ?? 200);
      const r = isPlaceholder ? 0.015 : fromMm((params?.diameterMm ?? 200) / 2);

      const geo = isPlaceholder
        ? new THREE.CylinderGeometry(r, r, len, 8)
        : isRound
        ? new THREE.CylinderGeometry(r, r, len, 16)
        : new THREE.BoxGeometry(len, h, w);
      if (isPlaceholder || isRound) geo.rotateZ(Math.PI / 2);

      const mat = new THREE.MeshStandardMaterial({
        color: isPlaceholder ? 0x38bdf8 : 0x06b6d4,
        transparent: true,
        opacity: 0.65,
        wireframe: isPlaceholder,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, elev, midZ);
      mesh.rotation.y = -angle;
      this.mepPreview.add(mesh);
    } else if (tool === "pipe") {
      const r = fromMm((params?.diameterMm ?? 28) / 2);
      const geo = new THREE.CylinderGeometry(r, r, len, 12);
      geo.rotateZ(Math.PI / 2);

      const mat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.65,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, elev, midZ);
      mesh.rotation.y = -angle;
      this.mepPreview.add(mesh);
    } else if (tool === "wire") {
      const geo = new THREE.CylinderGeometry(0.008, 0.008, len, 8);
      geo.rotateZ(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.75,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, elev, midZ);
      mesh.rotation.y = -angle;
      this.mepPreview.add(mesh);
    } else if (tool === "cabletray") {
      const w = fromMm(params?.widthMm ?? 200);
      const h = fromMm(params?.heightMm ?? 60);
      const geo = new THREE.BoxGeometry(len, h, w);

      const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.65,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, elev, midZ);
      mesh.rotation.y = -angle;
      this.mepPreview.add(mesh);
    }
  }

  setMepModeDimming(dimmed: boolean) {
    const dimObject = (root: THREE.Object3D, opacityFactor: number) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          if (dimmed) {
            if (!this.mepDimmingMaterialState.has(material)) {
              this.mepDimmingMaterialState.set(material, {
                opacity: material.opacity,
                transparent: material.transparent,
                depthWrite: material.depthWrite,
              });
            }
            const original = this.mepDimmingMaterialState.get(material)!;
            material.transparent = true;
            material.opacity = original.opacity * opacityFactor;
            material.depthWrite = false;
          } else {
            const original = this.mepDimmingMaterialState.get(material);
            if (!original) continue;
            material.opacity = original.opacity;
            material.transparent = original.transparent;
            material.depthWrite = original.depthWrite;
            this.mepDimmingMaterialState.delete(material);
          }
          material.needsUpdate = true;
        }
      });
    };

    const architectureCollections: Iterable<THREE.Object3D>[] = [
      this.wallMeshes.values(),
      this.doorMeshes.values(),
      this.windowMeshes.values(),
      this.slabMeshes.values(),
      this.columnMeshes.values(),
      this.beamMeshes.values(),
      this.stairMeshes.values(),
      this.rampMeshes.values(),
    ];

    for (const collection of architectureCollections) {
      for (const object of collection) dimObject(object, 0.35);
    }
  }

  private disposeObject(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else (m as THREE.Material).dispose();
      }
      if (o instanceof CSS2DObject) o.element.remove();
    });
  }

  private disposeGroup(g: THREE.Group) {
    this.group.remove(g);
    this.disposeObject(g);
  }

  setLevelHighlight(enabled: boolean) {
    for (const mesh of this.levelSlabs.values()) {
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      material.color.setHex(enabled ? 0x64748b : 0x94a3b8);
      material.opacity = enabled ? 0.2 : 0.12;
      material.emissive.setHex(enabled ? 0x334155 : 0x000000);
      material.emissiveIntensity = enabled ? 0.12 : 0;
      material.needsUpdate = true;
    }
  }

  private clearGroupContents(g: THREE.Group) {
    for (const child of [...g.children]) {
      this.disposeObject(child);
      g.remove(child);
    }
  }
}
