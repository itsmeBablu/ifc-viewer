/**
 * Imperative Three.js layer for layout walls / doors / windows (live 3D).
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  joinedWallCenterlines,
  pointOnWallMm,
  wallAngleRad,
  type LayoutDoor,
  type LayoutLevel,
  type LayoutSlab,
  type LayoutWall,
  type LayoutWindow,
  type WallCenterlineMm,
} from "@/lib/layoutDrawing";
import {
  underlayHeightMm,
  underlayWidthMm,
  type ReferenceUnderlay,
} from "@/lib/referenceUnderlay";
import { fromMm } from "@/lib/markupUnits";

const WALL_COLOR = 0xd6d3d1;
const WALL_SEL = 0xf59e0b;
const DOOR_COLOR = 0x78716c;
const WINDOW_COLOR = 0x38bdf8;
const FLOOR_COLOR = 0xa8a29e;
const FLOOR_SEL = 0xf59e0b;
const ROOF_COLOR = 0x78716c;
const ROOF_SEL = 0xfbbf24;

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

  onWallClick: ((id: string) => void) | null = null;
  onDoorClick: ((id: string) => void) | null = null;
  onWindowClick: ((id: string) => void) | null = null;

  constructor() {
    this.group.name = "layout-drawing-layer";
    this.endpointGroup.name = "layout-wall-endpoints";
    this.group.add(this.endpointGroup);
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
    for (const wall of walls) {
      const level = levelById.get(wall.levelId);
      const elev = level?.elevationMm ?? 0;
      const visible =
        opts.showAllLevels ||
        opts.activeLevelId == null ||
        wall.levelId === opts.activeLevelId;
      const cl = joins.get(wall.id) ?? wall;
      let mesh = this.wallMeshes.get(wall.id);
      if (!mesh) {
        mesh = this.createWallMesh(wall, elev, cl);
        this.wallMeshes.set(wall.id, mesh);
        this.group.add(mesh);
      } else {
        this.updateWallMesh(mesh, wall, elev, cl);
      }
      mesh.visible = visible;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(wall.id === opts.selectedWallId ? WALL_SEL : WALL_COLOR);
      mat.emissive.setHex(wall.id === opts.selectedWallId ? 0x92400e : 0x000000);
      mat.emissiveIntensity = wall.id === opts.selectedWallId ? 0.25 : 0;
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
      this.stripOpeningLabels(g);
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
      this.stripOpeningLabels(g);
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
      const base = slab.kind === "roof" ? ROOF_COLOR : FLOOR_COLOR;
      const sel = slab.kind === "roof" ? ROOF_SEL : FLOOR_SEL;
      mat.color.setHex(selected ? sel : base);
      mat.emissive.setHex(selected ? 0x92400e : 0x000000);
      mat.emissiveIntensity = selected ? 0.2 : 0;
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
      const w = fromMm(underlayWidthMm(u));
      const h = fromMm(underlayHeightMm(u));
      mesh.scale.set(w, h, 1);
      mesh.position.set(
        fromMm(u.offsetXmm),
        fromMm(elev) - 0.004,
        fromMm(u.offsetYmm),
      );
      mesh.rotation.set(-Math.PI / 2, 0, (-u.rotationDeg * Math.PI) / 180);
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
    const mat = new THREE.LineBasicMaterial({ color: 0xf59e0b });
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

  private createSlabMesh(slab: LayoutSlab, elevMm: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: slab.kind === "roof" ? ROOF_COLOR : FLOOR_COLOR,
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
      opacity: 0.85,
    });
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
    const w = fromMm(Math.max(50, slab.maxXmm - slab.minXmm));
    const d = fromMm(Math.max(50, slab.maxYmm - slab.minYmm));
    const t = fromMm(Math.max(50, slab.thicknessMm));
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(w, t, d);
    const baseY = fromMm(elevMm + slab.elevationOffsetMm);
    // Floor grows up from level; roof hangs down from offset elevation.
    const y =
      slab.kind === "roof" ? baseY - t / 2 : baseY + t / 2;
    mesh.position.set(
      fromMm((slab.minXmm + slab.maxXmm) / 2),
      y,
      fromMm((slab.minYmm + slab.maxYmm) / 2),
    );
    mesh.userData.layoutSlabId = slab.id;
  }

  private createWallMesh(
    wall: LayoutWall,
    elevMm: number,
    cl: WallCenterlineMm,
  ): THREE.Mesh {
    const len = Math.max(
      fromMm(50),
      fromMm(Math.hypot(cl.endXmm - cl.startXmm, cl.endYmm - cl.startYmm)),
    );
    const thick = fromMm(wall.thicknessMm);
    const height = fromMm(wall.heightMm);
    const geo = new THREE.BoxGeometry(len, height, thick);
    const mat = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.layoutWallId = wall.id;
    mesh.userData.kind = "layout-wall";
    this.updateWallMesh(mesh, wall, elevMm, cl);
    return mesh;
  }

  private updateWallMesh(
    mesh: THREE.Mesh,
    wall: LayoutWall,
    elevMm: number,
    cl: WallCenterlineMm,
  ) {
    const len = Math.max(
      fromMm(50),
      fromMm(Math.hypot(cl.endXmm - cl.startXmm, cl.endYmm - cl.startYmm)),
    );
    const thick = fromMm(wall.thicknessMm);
    const height = fromMm(wall.heightMm);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(len, height, thick);
    const midX = fromMm((cl.startXmm + cl.endXmm) / 2);
    const midZ = fromMm((cl.startYmm + cl.endYmm) / 2);
    const y = fromMm(elevMm) + height / 2;
    mesh.position.set(midX, y, midZ);
    mesh.rotation.set(
      0,
      -Math.atan2(cl.endYmm - cl.startYmm, cl.endXmm - cl.startXmm),
      0,
    );
    mesh.userData.layoutWallId = wall.id;
  }

  private createOpeningGroup(_label: string, color: number): THREE.Group {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "opening-box";
    g.add(mesh);
    return g;
  }

  /** Drop legacy floating Door/Window CSS2D tags if still present. */
  private stripOpeningLabels(g: THREE.Group) {
    const stale = g.children.filter((c) => c.userData.isLayoutLabel);
    for (const c of stale) {
      g.remove(c);
      if (c instanceof CSS2DObject) c.element.remove();
    }
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
    const mesh = g.children.find(
      (c) => c instanceof THREE.Mesh && c.name === "opening-box",
    ) as THREE.Mesh | undefined;
    if (!mesh) return;
    const w = fromMm(widthMm);
    const h = fromMm(heightMm);
    // Slightly deeper than the wall so the placeholder pokes through both
    // faces (avoids z-fighting with coplanar wall surfaces).
    const depthMm = Math.max(wall.thicknessMm + 40, wall.thicknessMm * 1.15);
    const d = fromMm(depthMm);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(w, h, d);
    const pt = pointOnWallMm(wall, positionMm);
    const y = fromMm(elevMm + sillMm) + h / 2;
    // Pose the box mesh in world space — group stays at origin so the CAD
    // plan symbol (sibling) can coexist without fighting transforms.
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    mesh.position.set(fromMm(pt.xMm), y, fromMm(pt.yMm));
    mesh.rotation.set(0, -wallAngleRad(wall), 0);
  }

  private tintOpening(g: THREE.Group, selected: boolean) {
    const mesh = g.children.find(
      (c) => c instanceof THREE.Mesh && c.name === "opening-box",
    ) as THREE.Mesh | undefined;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(selected ? 0xf59e0b : 0x000000);
    mat.emissiveIntensity = selected ? 0.35 : 0;
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

  private applyOpeningDisplay(g: THREE.Group, planMode: boolean) {
    const box = g.children.find(
      (c) => c instanceof THREE.Mesh && c.name === "opening-box",
    ) as THREE.Mesh | undefined;
    const plan = g.children.find((c) => c.name === "plan-symbol");
    if (box) box.visible = !planMode;
    if (plan) plan.visible = planMode;
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
