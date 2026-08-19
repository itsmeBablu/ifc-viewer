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
  type LayoutDoor,
  type LayoutLevel,
  type LayoutSlab,
  type LayoutSketchLine,
  type LayoutWall,
  type LayoutWindow,
  type WallCenterlineMm,
  type WallMiterOffsets,
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

const WALL_COLOR = 0xd6d3d1;
const WALL_SEL = 0xfacc15;
const DOOR_COLOR = 0x78716c;
const WINDOW_COLOR = 0x38bdf8;
const FLOOR_COLOR = 0xa8a29e;
const FLOOR_SEL = 0xfacc15;
const ROOF_COLOR = 0x78716c;
const ROOF_SEL = 0xfacc15;

export default class LayoutSceneLayer {
  readonly group = new THREE.Group();
  private wallMeshes = new Map<string, THREE.Mesh>();
  private doorMeshes = new Map<string, THREE.Group>();
  private windowMeshes = new Map<string, THREE.Group>();
  private slabMeshes = new Map<string, THREE.Mesh>();
  private previewLine: THREE.Line | null = null;
  private slabPreview: THREE.Mesh | null = null;
  private tracePreviewGroup: THREE.Group | null = null;
  private ground: THREE.Mesh | null = null;
  private levelSlabs = new Map<string, THREE.Mesh>();
  private underlayMeshes = new Map<string, THREE.Mesh>();
  private underlayTextures = new Map<string, THREE.Texture>();
  private underlayEdges = new Map<string, THREE.LineSegments>();
  private endpointGroup = new THREE.Group();
  private endpointStart: THREE.Mesh | null = null;
  private endpointEnd: THREE.Mesh | null = null;
  private sketchGroup = new THREE.Group();

  onWallClick: ((id: string) => void) | null = null;
  onDoorClick: ((id: string) => void) | null = null;
  onWindowClick: ((id: string) => void) | null = null;

  constructor() {
    this.group.name = "layout-drawing-layer";
    this.endpointGroup.name = "layout-wall-endpoints";
    this.sketchGroup.name = "layout-sketch-lines";
    this.group.add(this.endpointGroup);
    this.group.add(this.sketchGroup);
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

  syncLevelSlabs(levels: LayoutLevel[], walls: LayoutWall[]) {
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
        const mat = new THREE.MeshStandardMaterial({
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
      mesh.visible = true;
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
      showAllLevels: boolean;
      /** Top/plan view — CAD door/window symbols instead of 3D boxes. */
      planMode?: boolean;
    },
  ) {
    const planMode = Boolean(opts.planMode);
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const wallKeep = new Set(walls.map((w) => w.id));
    for (const [id, mesh] of this.wallMeshes) {
      if (!wallKeep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
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
      let mesh = this.wallMeshes.get(wall.id);
      if (!mesh) {
        mesh = this.createWallMesh(wall, elev, cl, wallDoors, wallWindows, miter);
        this.wallMeshes.set(wall.id, mesh);
        this.group.add(mesh);
      } else {
        this.updateWallMesh(mesh, wall, elev, cl, wallDoors, wallWindows, miter);
      }
      mesh.visible = visible;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (wall.id === opts.selectedWallId) {
        mat.color.setHex(WALL_SEL);
        mat.emissive.setHex(0x92400e);
        mat.emissiveIntensity = 0.25;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        this.applyMaterialAndColor(mat, wall.color, wall.material);
      }
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
      this.tintOpening(g, door.id === opts.selectedDoorId);
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
      this.tintOpening(g, win.id === opts.selectedWindowId);
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
      const selected = slab.id === opts.selectedSlabId;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (selected) {
        const sel = slab.kind === "roof" ? ROOF_SEL : FLOOR_SEL;
        mat.color.setHex(sel);
        mat.emissive.setHex(0x92400e);
        mat.emissiveIntensity = 0.2;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        const defaultColor = slab.kind === "roof" ? ROOF_COLOR : FLOOR_COLOR;
        this.applyMaterialAndColor(mat, slab.color, slab.material);
        if (!slab.color && !slab.material) {
          mat.color.setHex(defaultColor);
        }
      }
    }

    this.syncEndpointHandles(
      walls.find((w) => w.id === opts.selectedWallId) ?? null,
      levelById,
      opts,
    );
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
      const geo = new THREE.SphereGeometry(fromMm(140), 18, 14);
      const mat = new THREE.MeshStandardMaterial({
        color: end === "start" ? 0x38bdf8 : 0xf472b6,
        emissive: end === "start" ? 0x0ea5e9 : 0xdb2777,
        emissiveIntensity: 0.35,
        roughness: 0.35,
        metalness: 0.15,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 20;
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
  ) {
    if (this.previewLine) {
      this.group.remove(this.previewLine);
      this.previewLine.geometry.dispose();
      (this.previewLine.material as THREE.Material).dispose();
      this.previewLine = null;
    }
    if (points.length === 0) return;
    const pts = [...points];
    if (cursor) pts.push(cursor);
    if (pts.length < 2) return;
    const y = fromMm(elevationMm) + 0.02;
    const positions: number[] = [];
    for (const p of pts) {
      positions.push(fromMm(p.xMm), y, fromMm(p.yMm));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
    this.previewLine = new THREE.Line(geo, mat);
    this.previewLine.userData.isLayoutPreview = true;
    this.group.add(this.previewLine);
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
      this.group.remove(this.slabPreview);
      this.slabPreview.geometry.dispose();
      (this.slabPreview.material as THREE.Material).dispose();
      this.slabPreview = null;
    }
    if (!start || !cursor) return;
    const minX = Math.min(start.xMm, cursor.xMm);
    const maxX = Math.max(start.xMm, cursor.xMm);
    const minY = Math.min(start.yMm, cursor.yMm);
    const maxY = Math.max(start.yMm, cursor.yMm);
    if (maxX - minX < 10 || maxY - minY < 10) return;
    const w = fromMm(maxX - minX);
    const d = fromMm(maxY - minY);
    const t = fromMm(Math.max(50, thicknessMm));
    const geo = new THREE.BoxGeometry(w, t, d);
    const mat = new THREE.MeshStandardMaterial({
      color: kind === "roof" ? ROOF_COLOR : FLOOR_COLOR,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.slabPreview = new THREE.Mesh(geo, mat);
    this.slabPreview.position.set(
      fromMm((minX + maxX) / 2),
      fromMm(elevationMm) + (kind === "roof" ? -t / 2 : t / 2),
      fromMm((minY + maxY) / 2),
    );
    this.slabPreview.userData.isLayoutPreview = true;
    this.group.add(this.slabPreview);
  }

  pickLayout(
    raycaster: THREE.Raycaster,
  ):
    | { kind: "wall-endpoint"; id: string; end: "start" | "end" }
    | { kind: "wall"; id: string }
    | { kind: "door"; id: string }
    | { kind: "window"; id: string }
    | { kind: "slab"; id: string }
    | { kind: "sketch-line"; id: string }
    | { kind: "underlay"; id: string; point: THREE.Vector3; uv?: THREE.Vector2 }
    | { kind: "ground"; point: THREE.Vector3 }
    | null {
    if (this.endpointGroup.visible) {
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
    elevMm: number = 0,
    selectedLineId: string | null = null,
  ) {
    this.disposeGroup(this.sketchGroup);
    this.sketchGroup.clear();

    const y = fromMm(elevMm) + 0.04;
    const sketchYellow = 0xfacc15;
    const selectedCyan = 0x38bdf8;
    const gapRed = 0xef4444;

    // 1. Render placed sketch lines as high-contrast ribbons / thick lines + node spheres
    for (const l of lines) {
      const isSelected = l.id === selectedLineId;
      const col = isSelected ? selectedCyan : sketchYellow;
      const p1 = new THREE.Vector3(fromMm(l.startXmm), y, fromMm(l.startYmm));
      const p2 = new THREE.Vector3(fromMm(l.endXmm), y, fromMm(l.endYmm));

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen > 0.001) {
        const segGeo = new THREE.CylinderGeometry(0.04, 0.04, segLen, 8);
        segGeo.rotateZ(Math.PI / 2);
        const segMat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: isSelected ? 0.6 : 0.35,
          roughness: 0.3,
          metalness: 0.2,
        });
        const segMesh = new THREE.Mesh(segGeo, segMat);
        segMesh.position.set((p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2);
        segMesh.rotation.y = -Math.atan2(dz, dx);
        segMesh.userData.layoutSketchLineId = l.id;
        segMesh.renderOrder = 30;
        this.sketchGroup.add(segMesh);
      }

      for (const pt of [p1, p2]) {
        const sphereGeo = new THREE.SphereGeometry(0.06, 12, 10);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.4,
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pt);
        sphere.renderOrder = 32;
        this.sketchGroup.add(sphere);
      }
    }

    // 2. Render in-progress drawing chain and rubberband cursor line
    if (draw && draw.points.length > 0) {
      const pts = [...draw.points];
      if (draw.cursor) pts.push(draw.cursor);

      if (pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const p1 = new THREE.Vector3(fromMm(a.xMm), y + 0.01, fromMm(a.yMm));
          const p2 = new THREE.Vector3(fromMm(b.xMm), y + 0.01, fromMm(b.yMm));
          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const segLen = Math.hypot(dx, dz);
          if (segLen > 0.001) {
            const segGeo = new THREE.CylinderGeometry(0.045, 0.045, segLen, 8);
            segGeo.rotateZ(Math.PI / 2);
            const isRubberband = i === pts.length - 2 && draw.cursor != null;
            const segMat = new THREE.MeshStandardMaterial({
              color: isRubberband ? 0xfde047 : 0xfacc15,
              emissive: 0xfacc15,
              emissiveIntensity: isRubberband ? 0.7 : 0.4,
              transparent: true,
              opacity: isRubberband ? 0.9 : 1,
            });
            const segMesh = new THREE.Mesh(segGeo, segMat);
            segMesh.position.set((p1.x + p2.x) / 2, y + 0.01, (p1.z + p2.z) / 2);
            segMesh.rotation.y = -Math.atan2(dz, dx);
            segMesh.renderOrder = 35;
            this.sketchGroup.add(segMesh);
          }
        }
      }
    }

    // 3. Render glowing gap markers if any
    for (const gp of gapPoints) {
      const gapGeo = new THREE.SphereGeometry(0.12, 16, 12);
      const gapMat = new THREE.MeshStandardMaterial({
        color: gapRed,
        emissive: gapRed,
        emissiveIntensity: 0.8,
        depthTest: false,
      });
      const gapMesh = new THREE.Mesh(gapGeo, gapMat);
      gapMesh.position.set(fromMm(gp.xMm), y + 0.05, fromMm(gp.yMm));
      gapMesh.renderOrder = 40;
      this.sketchGroup.add(gapMesh);
    }
  }

  dispose() {
    for (const mesh of this.wallMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const g of this.doorMeshes.values()) this.disposeGroup(g);
    for (const g of this.windowMeshes.values()) this.disposeGroup(g);
    for (const mesh of this.slabMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.wallMeshes.clear();
    this.doorMeshes.clear();
    this.windowMeshes.clear();
    this.slabMeshes.clear();
    for (const mesh of this.levelSlabs.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.levelSlabs.clear();
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
      this.previewLine.geometry.dispose();
      (this.previewLine.material as THREE.Material).dispose();
    }
    if (this.slabPreview) {
      this.slabPreview.geometry.dispose();
      (this.slabPreview.material as THREE.Material).dispose();
      this.slabPreview = null;
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

    return geo;
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
    mat.map = null;

    const customMat = useMaterialStore.getState().getMaterial(matType);
    if (customMat) {
      mat.roughness = customMat.roughness;
      mat.metalness = customMat.metalness;
      mat.opacity = customMat.opacity;
      mat.transparent =
        customMat.opacity < 0.99 ||
        Boolean(customMat.transmission && customMat.transmission > 0);

      const effectiveColor = colorStr || customMat.color;
      mat.color.setStyle(effectiveColor);

      if (customMat.hatchStyle && customMat.hatchStyle !== "solid") {
        mat.map = getHatchCanvasTexture(
          customMat.hatchStyle,
          "#27272a",
          effectiveColor,
          customMat.hatchScaleMm || 200,
        );
      }
      return;
    }

    let baseColor = 0xd6d3d1; // default wall color
    if (matType === "concrete") {
      baseColor = 0x878683;
      mat.roughness = 0.8;
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
  }

  private buildWallGeometry(
    wall: LayoutWall,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter?: WallMiterOffsets,
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
      const thick = fromMm(wall.thicknessMm);
      const height = fromMm(wall.heightMm);

      const startRad = (wall.arcStartAngleDeg * Math.PI) / 180;
      const endRad = (wall.arcEndAngleDeg * Math.PI) / 180;

      const rInner = r - thick / 2;
      const rOuter = r + thick / 2;

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
      const wallThickMm = wall.thicknessMm || 200;
      const lenM = fromMm(len);
      const heightM = fromMm(wallHeightMm);
      const thickM = fromMm(wallThickMm);
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
        depth: thickM,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      // Center along extrusion axis (Z) so wall positioning matches existing transformations
      geo.translate(0, 0, -thickM / 2);

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

          const tz = Math.max(0, Math.min(1, (vz + thickM / 2) / (thickM || 1e-5)));

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
  ): THREE.Mesh {
    const geo = this.buildWallGeometry(wall, cl, doors, windows, miter);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
    });
    this.applyMaterialAndColor(mat, wall.color, wall.material);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.layoutWallId = wall.id;
    mesh.userData.kind = "layout-wall";
    this.updateWallMesh(mesh, wall, elevMm, cl, doors, windows, miter);
    return mesh;
  }

  private updateWallMesh(
    mesh: THREE.Mesh,
    wall: LayoutWall,
    elevMm: number,
    cl: WallCenterlineMm,
    doors: LayoutDoor[] = [],
    windows: LayoutWindow[] = [],
    miter?: WallMiterOffsets,
  ) {
    mesh.geometry.dispose();
    mesh.geometry = this.buildWallGeometry(wall, cl, doors, windows, miter);

    if (
      wall.curved &&
      wall.arcRadiusMm != null &&
      wall.arcCenterXmm != null &&
      wall.arcCenterYmm != null
    ) {
      mesh.position.set(
        fromMm(wall.arcCenterXmm),
        fromMm(elevMm),
        fromMm(wall.arcCenterYmm),
      );
      mesh.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      const height = fromMm(wall.heightMm);
      const midX = fromMm((cl.startXmm + cl.endXmm) / 2);
      const midZ = fromMm((cl.startYmm + cl.endYmm) / 2);
      const y = fromMm(elevMm) + height / 2;
      mesh.position.set(midX, y, midZ);
      mesh.rotation.set(
        0,
        -Math.atan2(cl.endYmm - cl.startYmm, cl.endXmm - cl.startXmm),
        0,
      );
    }
    mesh.userData.layoutWallId = wall.id;
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
    const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
    let panelMat: THREE.Material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05 });

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
        const std = new THREE.MeshStandardMaterial({
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
          mat.emissive.setHex(selected ? 0xf59e0b : 0x000000);
          mat.emissiveIntensity = selected ? 0.35 : 0;
        }
      }
    });
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
    const angle = wallAngleRad(wall);
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
}
