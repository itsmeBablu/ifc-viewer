/**
 * Schnitthöhe / half-section clipping for the 3D viewer.
 *
 * `ClipSliceController` applies a THREE.Plane to room/element materials and
 * builds stencil-based solid cut-face caps (footprint-accurate for rooms)
 * so the section looks filled rather than hollow. Also exports floor/scene
 * bounding-box helpers used by Presentation View's floor-explode layout.
 * Driven by Viewer3D; caps double as pickable meshes for room selection.
 */
import * as THREE from "three";
import { debugLog } from "./debugLog";
import type { Floor } from "./types";
import { useAppStore } from "@/store/useAppStore";

export type ClipOrientation = "horizontal" | "verticalZ";

/** Unlit cap fill — matches room/legend colors (no light shading mismatch). */
type CapMaterial = THREE.MeshBasicMaterial;

const _fpA = new THREE.Vector3();
const _fpB = new THREE.Vector3();
const _fpC = new THREE.Vector3();
const _fpAb = new THREE.Vector3();
const _fpCb = new THREE.Vector3();

/**
 * Flatten room mesh triangles onto XZ (y=0) so Schnitthöhe caps match the
 * real footprint — including L-shapes / n-gons — instead of the AABB quad.
 */
function buildHorizontalFootprintGeometry(
  mesh: THREE.Mesh,
): THREE.BufferGeometry | null {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  if (!pos) return null;

  mesh.updateWorldMatrix(true, false);
  const world = mesh.matrixWorld;
  const index = geom.index;
  const triCount = index ? index.count / 3 : Math.floor(pos.count / 3);
  const out: number[] = [];

  for (let t = 0; t < triCount; t++) {
    let i0: number;
    let i1: number;
    let i2: number;
    if (index) {
      i0 = index.getX(t * 3);
      i1 = index.getX(t * 3 + 1);
      i2 = index.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }
    _fpA.fromBufferAttribute(pos, i0).applyMatrix4(world);
    _fpB.fromBufferAttribute(pos, i1).applyMatrix4(world);
    _fpC.fromBufferAttribute(pos, i2).applyMatrix4(world);

    // Skip wall-like / degenerate projections (near-zero area in XZ)
    _fpAb.set(_fpA.x - _fpB.x, 0, _fpA.z - _fpB.z);
    _fpCb.set(_fpC.x - _fpB.x, 0, _fpC.z - _fpB.z);
    const area2 = Math.abs(_fpAb.x * _fpCb.z - _fpAb.z * _fpCb.x);
    if (area2 < 1e-8) continue;

    out.push(_fpA.x, 0, _fpA.z, _fpB.x, 0, _fpB.z, _fpC.x, 0, _fpC.z);
  }

  if (out.length < 9) return null;

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

function pointInFootprintCap(
  cap: THREE.Mesh,
  x: number,
  z: number,
): boolean {
  const pos = cap.geometry.attributes.position;
  if (!pos) return false;
  const n = pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    const ax = pos.getX(i);
    const az = pos.getZ(i);
    const bx = pos.getX(i + 1);
    const bz = pos.getZ(i + 1);
    const cx = pos.getX(i + 2);
    const cz = pos.getZ(i + 2);
    if (pointInTriangle2D(x, z, ax, az, bx, bz, cx, cz)) return true;
  }
  return false;
}

function pointInTriangle2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): boolean {
  const v0x = cx - ax;
  const v0z = cz - az;
  const v1x = bx - ax;
  const v1z = bz - az;
  const v2x = px - ax;
  const v2z = pz - az;
  const dot00 = v0x * v0x + v0z * v0z;
  const dot01 = v0x * v1x + v0z * v1z;
  const dot02 = v0x * v2x + v0z * v2z;
  const dot11 = v1x * v1x + v1z * v1z;
  const dot12 = v1x * v2x + v1z * v2z;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-18) return false;
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6;
}

/**
 * Floor slice: clipping plane + stencil solid caps.
 *
 * horizontal: normal (0,-1,0) — Schnitthöhe (Y cut)
 * verticalZ:  normal (0,0,-1) — presentation half-section (Z cut)
 */
export class ClipSliceController {
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  private capsGroup = new THREE.Group();
  private tracked: THREE.Mesh[] = [];
  private entries: {
    mesh: THREE.Mesh;
    stencil: THREE.Group;
    cap: THREE.Mesh;
    capMat: CapMaterial;
  }[] = [];
  private enabled = false;
  private capsEnabled = false;
  /** Room ids (and optional expressIds) skipped for caps + clipping when selected. */
  private excludeRoomIds = new Set<string>();
  private excludeExpressIds = new Set<number>();
  private scene: THREE.Scene | null = null;
  private cutValue = 0;
  private orientation: ClipOrientation = "horizontal";
  private _box = new THREE.Box3();
  private _size = new THREE.Vector3();
  private _center = new THREE.Vector3();
  private _pickPt = new THREE.Vector3();
  private _pickPlane = new THREE.Plane();
  private _pickBox = new THREE.Box3();

  attach(scene: THREE.Scene) {
    this.scene = scene;
    this.capsGroup.name = "clip-caps";
    scene.add(this.capsGroup);
  }

  setOrientation(orientation: ClipOrientation) {
    this.orientation = orientation;
    if (orientation === "horizontal") {
      this.plane.normal.set(0, -1, 0);
    } else {
      this.plane.normal.set(0, 0, -1);
    }
    this.plane.constant = this.cutValue;
    if (this.enabled && this.capsEnabled) this.buildCaps();
  }

  getOrientation() {
    return this.orientation;
  }

  setMeshes(meshes: THREE.Mesh[]) {
    this.clearCaps();
    this.clearPlanesFromTracked();
    this.tracked = meshes.slice();
    this.applyPlanesToTracked();
    if (this.capsEnabled && this.enabled) this.buildCaps();
    debugLog(
      "ClipSlice",
      `setMeshes n=${meshes.length} ori=${this.orientation} v=${this.cutValue.toFixed(3)}`,
      meshes.length ? "ok" : "warn",
    );
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.applyPlanesToTracked();
    this.capsGroup.visible = on && this.capsEnabled;
    if (on && this.capsEnabled) this.buildCaps();
    else if (!on) this.clearCaps();
  }

  setCapsEnabled(on: boolean) {
    this.capsEnabled = on;
    if (on && this.enabled) this.buildCaps();
    else this.clearCaps();
    this.capsGroup.visible = on && this.enabled;
  }

  /**
   * Selected room: keep Schnitthöhe cap (so the cut fill can highlight),
   * but disable clipping so the full solid volume is visible.
   */
  setExcludedSelection(opts: {
    roomId?: string | null;
    expressId?: number | null;
  }) {
    this.excludeRoomIds.clear();
    this.excludeExpressIds.clear();
    if (opts.roomId) this.excludeRoomIds.add(opts.roomId);
    if (opts.expressId != null) this.excludeExpressIds.add(opts.expressId);
    this.applyPlanesToTracked();
    // Always rebuild caps for every room — in basic view the cap IS the
    // visible highlight; skipping the selected room made picks look unstyled.
    if (this.enabled && this.capsEnabled) this.buildCaps();
    else this.clearCaps();
  }

  private isExcludedMesh(mesh: THREE.Mesh): boolean {
    const roomId = mesh.userData.roomId as string | undefined;
    const expressId = mesh.userData.expressId as number | undefined;
    if (roomId && this.excludeRoomIds.has(roomId)) return true;
    if (expressId != null && this.excludeExpressIds.has(expressId)) return true;
    return false;
  }

  /** Cut value: world Y (horizontal) or world Z (verticalZ). */
  setCutValue(v: number) {
    this.cutValue = v;
    this.plane.constant = v;
    for (const e of this.entries) {
      this.placeCap(e.cap, e.mesh);
      this.syncCapFromMesh(e);
    }
  }

  /** @deprecated alias — horizontal Schnitthöhe */
  setHeight(y: number) {
    this.setCutValue(y);
  }

  getHeight() {
    return this.cutValue;
  }

  /** Visible cut-face meshes — include in raycasting for room/element pick. */
  getCapsGroup() {
    return this.capsGroup;
  }

  /** Source mesh that produced a Schnitthöhe / section cap (for picking). */
  getSourceMeshForCap(cap: THREE.Object3D): THREE.Mesh | null {
    const entry = this.entries.find((e) => e.cap === cap);
    return entry?.mesh ?? null;
  }

  /**
   * Pick the smallest room whose footprint contains the ray∩cut-plane point.
   * Prefer actual XZ triangle coverage over AABB (avoids L-shape overlap).
   */
  pickRoomMeshAtCut(
    raycaster: THREE.Raycaster,
    roomMeshes: THREE.Mesh[],
  ): THREE.Mesh | null {
    if (!this.enabled || !this.capsEnabled || this.orientation !== "horizontal") {
      return null;
    }
    this._pickPlane.set(new THREE.Vector3(0, 1, 0), -this.cutValue);
    if (!raycaster.ray.intersectPlane(this._pickPlane, this._pickPt)) {
      return null;
    }
    let best: THREE.Mesh | null = null;
    let bestArea = Infinity;
    for (const mesh of roomMeshes) {
      if (!mesh.visible) continue;
      this._pickBox.setFromObject(mesh);
      if (this._pickBox.isEmpty()) continue;
      const { min, max } = this._pickBox;
      // Quick reject
      if (
        this._pickPt.x < min.x ||
        this._pickPt.x > max.x ||
        this._pickPt.z < min.z ||
        this._pickPt.z > max.z
      ) {
        continue;
      }
      if (this._pickPt.y < min.y - 0.05 || this._pickPt.y > max.y + 0.05) {
        continue;
      }

      // Prefer actual XZ triangle coverage over AABB (avoids L-shape overlap).
      // Rooms without a cap entry (e.g. currently selected / excluded) still pick via AABB.
      const entry = this.entries.find((e) => e.mesh === mesh);
      const inside =
        entry?.cap?.userData?.useFootprint
          ? pointInFootprintCap(entry.cap, this._pickPt.x, this._pickPt.z)
          : true;
      if (!inside) continue;

      const area = Math.max(1e-6, (max.x - min.x) * (max.z - min.z));
      if (area < bestArea) {
        bestArea = area;
        best = mesh;
      }
    }
    return best;
  }

  rebindMaterials() {
    this.applyPlanesToTracked();
    this.syncAllCapAppearance();
  }

  syncAllCapAppearance() {
    for (const e of this.entries) this.syncCapFromMesh(e);
  }

  rebuildCaps() {
    if (this.enabled && this.capsEnabled) {
      this.buildCaps();
      this.syncAllCapAppearance();
    } else {
      this.clearCaps();
    }
  }

  clear() {
    this.clearCaps();
    this.clearPlanesFromTracked();
    this.tracked = [];
    this.enabled = false;
  }

  dispose() {
    this.clear();
    if (this.scene) this.scene.remove(this.capsGroup);
    this.scene = null;
  }

  private placeCap(cap: THREE.Mesh, mesh: THREE.Mesh) {
    // Footprint caps are already in world XZ; only the cut height moves.
    if (cap.userData.useFootprint) {
      cap.position.set(0, this.cutValue, 0);
      cap.rotation.set(0, 0, 0);
      return;
    }

    mesh.updateWorldMatrix(true, false);
    this._box.setFromObject(mesh);
    if (this._box.isEmpty()) return;
    this._box.getSize(this._size);
    this._box.getCenter(this._center);

    if (this.orientation === "horizontal") {
      const w = Math.max(this._size.x, 0.05);
      const d = Math.max(this._size.z, 0.05);
      cap.geometry.dispose();
      cap.geometry = new THREE.PlaneGeometry(w, d);
      cap.rotation.set(-Math.PI / 2, 0, 0);
      cap.position.set(this._center.x, this.cutValue, this._center.z);
    } else {
      const w = Math.max(this._size.x, 0.05);
      const h = Math.max(this._size.y, 0.05);
      cap.geometry.dispose();
      cap.geometry = new THREE.PlaneGeometry(w, h);
      cap.rotation.set(0, 0, 0);
      cap.position.set(this._center.x, this._center.y, this.cutValue);
    }
  }

  private applyPlanesToTracked() {
    for (const mesh of this.tracked) {
      const skipClip = this.isExcludedMesh(mesh);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || !("clippingPlanes" in m)) continue;
        const mat = m as THREE.Material & {
          clippingPlanes: THREE.Plane[] | null;
          clipShadows?: boolean;
        };
        mat.clippingPlanes = this.enabled && !skipClip ? [this.plane] : [];
        mat.clipShadows = true;
        mat.needsUpdate = true;
      }
    }
  }

  private clearPlanesFromTracked() {
    for (const mesh of this.tracked) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || !("clippingPlanes" in m)) continue;
        (m as THREE.Material & { clippingPlanes: THREE.Plane[] }).clippingPlanes =
          [];
        m.needsUpdate = true;
      }
    }
  }

  private clearCaps() {
    for (const e of this.entries) {
      e.mesh.remove(e.stencil);
      this.capsGroup.remove(e.cap);
      e.stencil.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (o.material as THREE.Material).dispose();
        }
      });
      e.cap.geometry.dispose();
      e.capMat.dispose();
    }
    this.entries = [];
  }

  private buildCaps() {
    this.clearCaps();
    let i = 1;
    for (const mesh of this.tracked) {
      if (!mesh.geometry) continue;
      // Build caps for all rooms (including the selected one) so Schnitthöhe
      // picks stay visible — selection only removes clipping, not the fill.

      const isRoom =
        mesh.userData.kind === "room" || Boolean(mesh.userData.roomId);

      // Horizontal Schnitthöhe: only room fills — shell caps were covering rooms
      // with wrong (element) colors. Shell still clips via material planes.
      if (this.orientation === "horizontal" && !isRoom) continue;

      mesh.updateWorldMatrix(true, false);
      this._box.setFromObject(mesh);
      if (this._box.isEmpty()) continue;
      this._box.getSize(this._size);
      this._box.getCenter(this._center);

      // Per-mesh stencil→cap must finish before the next mesh starts.
      // Batching all stencils then all caps lets AABB quads paint other rooms.
      // Vertical: rooms after shells so room fills win on the half-section.
      const orderBase =
        i * 3 + (isRoom && this.orientation === "verticalZ" ? 10_000 : 0);
      const stencil = this.createStencilGroup(mesh.geometry, orderBase);
      mesh.add(stencil);

      let geo: THREE.BufferGeometry;
      let useFootprint = false;
      if (this.orientation === "horizontal" && isRoom) {
        const footprint = buildHorizontalFootprintGeometry(mesh);
        if (footprint) {
          geo = footprint;
          useFootprint = true;
        } else {
          geo = new THREE.PlaneGeometry(
            Math.max(this._size.x, 0.05),
            Math.max(this._size.z, 0.05),
          );
        }
      } else if (this.orientation === "horizontal") {
        geo = new THREE.PlaneGeometry(
          Math.max(this._size.x, 0.05),
          Math.max(this._size.z, 0.05),
        );
      } else {
        geo = new THREE.PlaneGeometry(
          Math.max(this._size.x, 0.05),
          Math.max(this._size.y, 0.05),
        );
      }

      const capMat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        clippingPlanes: [],
        depthWrite: true,
        depthTest: true,
        toneMapped: false,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      });
      this.applySourceAppearance(capMat, mesh);

      const cap = new THREE.Mesh(geo, capMat);
      cap.userData.useFootprint = useFootprint;
      if (useFootprint) {
        cap.rotation.set(0, 0, 0);
        cap.position.set(0, this.cutValue, 0);
      } else if (this.orientation === "horizontal") {
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(this._center.x, this.cutValue, this._center.z);
      } else {
        cap.rotation.set(0, 0, 0);
        cap.position.set(this._center.x, this._center.y, this.cutValue);
      }
      cap.renderOrder = orderBase + 1.5;
      cap.userData.isClipCap = true;
      if (mesh.userData.roomId != null) {
        cap.userData.roomId = mesh.userData.roomId;
      }
      if (mesh.userData.expressId != null) {
        cap.userData.expressId = mesh.userData.expressId;
      }
      if (mesh.userData.floorId != null) {
        cap.userData.floorId = mesh.userData.floorId;
      }
      if (mesh.userData.kind != null) {
        cap.userData.kind = mesh.userData.kind;
      }
      if (mesh.userData.colorHex != null) {
        cap.userData.colorHex = mesh.userData.colorHex;
      }
      this.capsGroup.add(cap);

      this.entries.push({ mesh, stencil, cap, capMat });
      i += 1;
    }
    this.capsGroup.visible = this.enabled && this.capsEnabled;
  }

  private createStencilGroup(geometry: THREE.BufferGeometry, renderOrder: number) {
    const group = new THREE.Group();
    group.userData.isClipStencil = true;

    const baseMat = new THREE.MeshBasicMaterial();
    baseMat.depthWrite = false;
    baseMat.depthTest = false;
    baseMat.colorWrite = false;
    baseMat.stencilWrite = true;
    baseMat.stencilFunc = THREE.AlwaysStencilFunc;

    const matBack = baseMat.clone();
    matBack.side = THREE.BackSide;
    matBack.clippingPlanes = [this.plane];
    matBack.stencilFail = THREE.IncrementWrapStencilOp;
    matBack.stencilZFail = THREE.IncrementWrapStencilOp;
    matBack.stencilZPass = THREE.IncrementWrapStencilOp;
    const meshBack = new THREE.Mesh(geometry, matBack);
    meshBack.renderOrder = renderOrder;
    meshBack.userData.isClipStencil = true;
    group.add(meshBack);

    const matFront = baseMat.clone();
    matFront.side = THREE.FrontSide;
    matFront.clippingPlanes = [this.plane];
    matFront.stencilFail = THREE.DecrementWrapStencilOp;
    matFront.stencilZFail = THREE.DecrementWrapStencilOp;
    matFront.stencilZPass = THREE.DecrementWrapStencilOp;
    const meshFront = new THREE.Mesh(geometry, matFront);
    meshFront.renderOrder = renderOrder;
    meshFront.userData.isClipStencil = true;
    group.add(meshFront);

    return group;
  }

  private syncCapFromMesh(e: {
    mesh: THREE.Mesh;
    cap: THREE.Mesh;
    capMat: CapMaterial;
  }) {
    this.applySourceAppearance(e.capMat, e.mesh);
    if (e.mesh.userData.colorHex != null) {
      e.cap.userData.colorHex = e.mesh.userData.colorHex;
    }
    if (e.mesh.userData.roomId != null) {
      e.cap.userData.roomId = e.mesh.userData.roomId;
    }
    const opaque = (e.capMat.opacity ?? 1) >= 0.995;
    if (opaque) {
      e.cap.renderOrder = Math.max(e.cap.renderOrder, 60);
    }
  }

  private applySourceAppearance(capMat: CapMaterial, mesh: THREE.Mesh) {
    const src = this.readSourceMaterial(mesh);
    const lighting = useAppStore.getState().lighting;
    const isRoom =
      mesh.userData.kind === "room" || Boolean(mesh.userData.roomId);

    // Prefer the live room color (already includes render-mode / lighting tint).
    // Fall back to stored heizlast/temp hex so caps stay in sync with overlays.
    if (src?.color) {
      capMat.color.copy(src.color);
    } else {
      const hexRaw =
        (mesh.userData.colorHex as string | number | undefined) ??
        (src && "userData" in src
          ? (src.userData.baseColorHex as string | number | undefined)
          : undefined) ??
        (mesh.userData.baseColorHex as string | number | undefined);
      if (typeof hexRaw === "number") capMat.color.setHex(hexRaw);
      else if (typeof hexRaw === "string" && hexRaw) capMat.color.set(hexRaw);
      else capMat.color.setHex(0xb8bec8);
    }

    // Match live mesh opacity (selection fade, lighting sliders, etc.)
    const liveOpacity =
      src && typeof src.opacity === "number" ? src.opacity : undefined;
    const opacity =
      liveOpacity != null
        ? liveOpacity
        : isRoom
          ? lighting.spaceTransparency
          : lighting.elementTransparency;
    const opaque = opacity >= 0.995;
    capMat.opacity = opaque ? 1 : Math.max(0, Math.min(1, opacity));
    capMat.transparent = !opaque;
    capMat.depthWrite = opaque;
    capMat.depthTest = true;
    capMat.toneMapped = false;
    capMat.needsUpdate = true;
  }

  private readSourceMaterial(mesh: THREE.Mesh): (THREE.Material & {
    color?: THREE.Color;
    opacity?: number;
    transparent?: boolean;
    userData?: Record<string, unknown>;
  }) | null {
    const m = mesh.material;
    return ((Array.isArray(m) ? m[0] : m) as THREE.Material) ?? null;
  }
}

/** Extra vertical gap between floors in Presentation View, as a
 *  fraction of average floor height (scale-safe for m or mm models). */
export const EXPLODE_GAP_FACTOR = 3.6;

/** Shift the whole exploded stack left by this fraction of building width. */
export const EXPLODE_LEFT_FACTOR = 0.5;

export function floorWorldYBounds(
  floorId: string,
  roots: (THREE.Object3D | null | undefined)[],
): { yMin: number; yMax: number } | null {
  const box = new THREE.Box3();
  let any = false;
  for (const root of roots) {
    if (!root) continue;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.userData.isClipStencil || o.userData.isSelectionOutline) return;
      if (o.userData.isClipCap) return;
      if (o.userData.floorId !== floorId) return;
      box.expandByObject(o);
      any = true;
    });
  }
  if (!any || box.isEmpty()) return null;
  return { yMin: box.min.y, yMax: box.max.y };
}

export function floorElevationYBounds(
  floorId: string,
  floors: Floor[],
): { yMin: number; yMax: number } | null {
  if (!floors.length) return null;
  const sorted = [...floors].sort((a, b) => a.elevation - b.elevation);
  const idx = sorted.findIndex((f) => f.id === floorId);
  if (idx < 0) return null;
  const floor = sorted[idx];
  const next = sorted[idx + 1];
  let yMin = floor.elevation;
  let yMax = next ? next.elevation : floor.elevation + 3;
  if (Math.abs(yMin) > 100 || Math.abs(yMax) > 100) {
    yMin /= 1000;
    yMax /= 1000;
  }
  return { yMin, yMax: Math.max(yMax, yMin + 0.05) };
}

/** World Z mid of all meshes (for vertical half-cut). */
export function sceneWorldZMid(
  roots: (THREE.Object3D | null | undefined)[],
): number | null {
  const box = new THREE.Box3();
  let any = false;
  for (const root of roots) {
    if (!root) continue;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.userData.isClipStencil || o.userData.isSelectionOutline) return;
      if (o.userData.isClipCap) return;
      box.expandByObject(o);
      any = true;
    });
  }
  if (!any || box.isEmpty()) return null;
  return (box.min.z + box.max.z) / 2;
}
