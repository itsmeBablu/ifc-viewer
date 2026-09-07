import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  createPlacementMesh,
  createShapeGeometry,
  rebuildPlacementMesh,
  type MarkupNote,
  type MarkupPlacement,
  type MarkupShapeType,
} from "@/lib/toolMarkup";
import { measurementGeometry, measurementLabel } from "@/lib/measurementGeometry";
import { useToolMarkupStore, type MarkupMeasurement } from "@/store/useToolMarkupStore";

/**
 * Imperative Three.js layer for Werkzeug markup meshes + CSS2D notes.
 * Owned by Viewer3D — kept out of React render.
 */
export class MarkupSceneLayer {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private noteObjects = new Map<string, CSS2DObject>();
  private measureGroups = new Map<string, THREE.Group>();
  private labelRenderer: CSS2DRenderer | null = null;
  private host: HTMLElement | null = null;
  private scene: THREE.Scene | null = null;
  private selectedId: string | null = null;
  private cubePreview: THREE.Mesh | null = null;
  private snapIndicator: THREE.Mesh | null = null;
  private measurePreview: THREE.Group | null = null;
  private measureDraftLine: THREE.Line | null = null;
  private measureDraftDot: THREE.Mesh | null = null;
  private measureDraftLabel: CSS2DObject | null = null;
  onNoteClick: ((id: string) => void) | null = null;

  constructor() {
    this.group.name = "tool-markup";
  }

  attach(scene: THREE.Scene, host: HTMLElement) {
    this.scene = scene;
    scene.add(this.group);
    this.host = host;
    if (!this.labelRenderer) {
      const lr = new CSS2DRenderer();
      lr.setSize(host.clientWidth, host.clientHeight);
      lr.domElement.style.position = "absolute";
      lr.domElement.style.inset = "0";
      lr.domElement.style.pointerEvents = "none";
      lr.domElement.style.zIndex = "5";
      host.appendChild(lr.domElement);
      this.labelRenderer = lr;
    }
  }

  detach(scene: THREE.Scene) {
    scene.remove(this.group);
    this.clearAll();
    if (this.labelRenderer) {
      this.labelRenderer.domElement.remove();
      this.labelRenderer = null;
    }
    this.host = null;
    this.scene = null;
  }

  setSize(width: number, height: number) {
    this.labelRenderer?.setSize(width, height);
  }

  render(camera: THREE.Camera) {
    if (!this.scene || !this.labelRenderer) return;
    if (this.snapIndicator?.visible && this.host) {
      const depth = -this.snapIndicator.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const visibleHeight = camera instanceof THREE.PerspectiveCamera
        ? 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom
        : camera instanceof THREE.OrthographicCamera ? (camera.top - camera.bottom) / camera.zoom : 1;
      this.snapIndicator.scale.setScalar(Math.max(0.001, visibleHeight * 4 / Math.max(1, this.host.clientHeight) / 0.06));
    }
    this.labelRenderer.render(this.scene, camera);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    if (this.labelRenderer) {
      this.labelRenderer.domElement.style.display = visible ? "block" : "none";
    }
  }

  syncPlacements(placements: MarkupPlacement[], selectedId: string | null) {
    this.selectedId = selectedId;
    const keep = new Set(placements.map((p) => p.id));
    for (const [id, mesh] of this.meshes) {
      if (!keep.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
      }
    }
    for (const p of placements) {
      let mesh = this.meshes.get(p.id);
      if (!mesh) {
        mesh = createPlacementMesh(p);
        this.meshes.set(p.id, mesh);
        this.group.add(mesh);
      } else {
        rebuildPlacementMesh(mesh, p);
      }
      this.applySelectionStyle(mesh, p.id === selectedId);
    }
  }

  syncNotes(notes: MarkupNote[], selectedId: string | null) {
    const keep = new Set(notes.map((n) => n.id));
    for (const [id, obj] of this.noteObjects) {
      if (!keep.has(id)) {
        this.group.remove(obj);
        obj.element.remove();
        this.noteObjects.delete(id);
      }
    }
    for (const n of notes) {
      let obj = this.noteObjects.get(n.id);
      if (!obj) {
        obj = this.createNoteObject(n);
        this.noteObjects.set(n.id, obj);
        this.group.add(obj);
      } else {
        this.updateNoteObject(obj, n, n.id === selectedId);
      }
      obj.position.set(n.posX, n.posY, n.posZ);
    }
  }

  getMesh(id: string): THREE.Mesh | null {
    return this.meshes.get(id) ?? null;
  }

  /** Live footprint & 3D extrusion while drawing any shape (cube, cylinder, sphere, cone, torus, capsule, pyramid). */
  setShapeDrawPreview(
    type: MarkupShapeType | null,
    start: { x: number; y: number; z: number } | null,
    current: { x: number; y: number; z: number } | null,
    height = 0.5,
    footprintEnd: { x: number; y: number; z: number } | null = null,
  ) {
    if (!type || !start || !current) {
      if (this.cubePreview) {
        this.cubePreview.visible = false;
      }
      return;
    }
    const end = footprintEnd ?? current;
    let sizeX = 0.5;
    let sizeY = Math.max(0.05, height);
    let sizeZ = 0.5;
    let cx = start.x;
    let cy = start.y + sizeY / 2;
    let cz = start.z;

    if (type === "cube") {
      sizeX = Math.max(0.05, Math.abs(end.x - start.x));
      sizeZ = Math.max(0.05, Math.abs(end.z - start.z));
      cx = (end.x + start.x) / 2;
      cz = (end.z + start.z) / 2;
      cy = start.y + sizeY / 2;
    } else if (type === "sphere") {
      const radius = Math.max(0.05, Math.hypot(end.x - start.x, end.z - start.z));
      sizeX = radius;
      sizeY = radius;
      sizeZ = radius;
      cx = start.x;
      cy = start.y + radius;
      cz = start.z;
    } else if (type === "cylinder" || type === "cone" || type === "pyramid") {
      const radius = Math.max(0.05, Math.hypot(end.x - start.x, end.z - start.z));
      sizeX = radius * 2;
      sizeZ = radius * 2;
      cx = start.x;
      cz = start.z;
      cy = start.y + sizeY / 2;
    } else if (type === "capsule") {
      const radius = Math.max(0.05, Math.hypot(end.x - start.x, end.z - start.z));
      sizeX = radius;
      sizeY = Math.max(0.05, height);
      sizeZ = radius;
      cx = start.x;
      cz = start.z;
      cy = start.y + sizeY / 2;
    } else if (type === "torus") {
      const major = Math.max(0.05, Math.hypot(end.x - start.x, end.z - start.z));
      sizeX = major;
      sizeY = Math.max(0.01, sizeY * 0.15);
      sizeZ = major;
      cx = start.x;
      cz = start.z;
      cy = start.y + sizeY;
    }

    if (!this.cubePreview || this.cubePreview.userData.previewType !== type) {
      if (this.cubePreview) {
        this.group.remove(this.cubePreview);
        this.cubePreview.geometry.dispose();
        (this.cubePreview.material as THREE.Material).dispose();
      }
      const geo = createShapeGeometry(type, sizeX, sizeY, sizeZ);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        roughness: 0.5,
      });
      this.cubePreview = new THREE.Mesh(geo, mat);
      this.cubePreview.name = "markup-shape-preview";
      this.cubePreview.userData.isMarkupPreview = true;
      this.cubePreview.userData.previewType = type;
      this.group.add(this.cubePreview);
    } else {
      this.cubePreview.geometry.dispose();
      this.cubePreview.geometry = createShapeGeometry(type, sizeX, sizeY, sizeZ);
    }

    this.cubePreview.visible = true;
    this.cubePreview.position.set(cx, cy, cz);
    this.cubePreview.scale.set(1, 1, 1);
  }

  /** Live footprint while drawing a cube (corner → opposite corner). */
  setCubeDrawPreview(
    start: { x: number; y: number; z: number } | null,
    current: { x: number; y: number; z: number } | null,
    height = 0.5,
  ) {
    this.setShapeDrawPreview("cube", start, current, height);
  }

  /** Small sphere showing note vertex/face snap target. */
  setSnapIndicator(point: THREE.Vector3 | null) {
    if (!point) {
      if (this.snapIndicator) this.snapIndicator.visible = false;
      return;
    }
    if (!this.snapIndicator) {
      const geo = new THREE.SphereGeometry(0.06, 12, 12);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        depthTest: false,
      });
      this.snapIndicator = new THREE.Mesh(geo, mat);
      this.snapIndicator.name = "markup-snap-indicator";
      this.snapIndicator.userData.isMarkupPreview = true;
      this.snapIndicator.renderOrder = 999;
      this.group.add(this.snapIndicator);
    }
    this.snapIndicator.visible = true;
    this.snapIndicator.position.copy(point);
  }

  pickMarkup(
    raycaster: THREE.Raycaster,
  ): { kind: "placement" | "note"; id: string } | null {
    const meshHits = raycaster.intersectObjects(
      [...this.meshes.values()],
      false,
    );
    if (meshHits[0]?.object.userData.markupId) {
      return {
        kind: "placement",
        id: meshHits[0].object.userData.markupId as string,
      };
    }
    // Notes: approximate via distance to camera ray vs note positions
    // (CSS2D isn't in the raycaster). Prefer mesh hits first.
    return null;
  }

  noteIdNearRay(
    raycaster: THREE.Raycaster,
    notes: MarkupNote[],
    maxDist = 0.45,
  ): string | null {
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    let best: { id: string; d: number } | null = null;
    const tmp = new THREE.Vector3();
    for (const n of notes) {
      tmp.set(n.posX, n.posY, n.posZ);
      const to = tmp.clone().sub(origin);
      const t = to.dot(dir);
      if (t < 0) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      const d = closest.distanceTo(tmp);
      if (d <= maxDist && (!best || d < best.d)) best = { id: n.id, d };
    }
    return best?.id ?? null;
  }

  private applySelectionStyle(mesh: THREE.Mesh, selected: boolean) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.set(0x000000);
    mat.emissiveIntensity = 0;
    mesh.scale.set(1, 1, 1);
    const existing = mesh.getObjectByName("markup-selection-outline") as THREE.LineSegments | undefined;
    if (existing) {
      mesh.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
    }
    if (!selected) return;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 18),
      new THREE.LineBasicMaterial({
        color: 0xfacc15,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      }),
    );
    outline.name = "markup-selection-outline";
    outline.renderOrder = 1000;
    outline.raycast = () => undefined;
    mesh.add(outline);
  }

  private createNoteObject(note: MarkupNote): CSS2DObject {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "markup-note-pin";
    el.style.cssText = [
      "pointer-events:auto",
      "border:none",
      "cursor:pointer",
      "padding:4px 8px",
      "border-radius:10px",
      "background:linear-gradient(180deg,#fde68a,#fbbf24)",
      "color:#78350f",
      "font:600 10px/1.2 system-ui,sans-serif",
      "box-shadow:0 4px 12px rgba(0,0,0,.18)",
      "max-width:140px",
      "text-align:left",
      "white-space:pre-wrap",
      "transform:translate(-50%,-100%)",
    ].join(";");
    el.textContent = note.text.slice(0, 80);
    el.dataset.noteId = note.id;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const id = el.dataset.noteId;
      if (id) this.onNoteClick?.(id);
    });
    const obj = new CSS2DObject(el);
    obj.position.set(note.posX, note.posY, note.posZ);
    obj.userData.isMarkupNote = true;
    obj.userData.markupNoteId = note.id;
    return obj;
  }

  private updateNoteObject(
    obj: CSS2DObject,
    note: MarkupNote,
    selected: boolean,
  ) {
    const el = obj.element as HTMLButtonElement;
    el.textContent = note.text.slice(0, 80);
    el.style.outline = selected ? "2px solid #78350f" : "none";
    el.dataset.noteId = note.id;
  }

  syncMeasurements(
    measurements: MarkupMeasurement[],
    draft: { x: number; y: number; z: number } | null,
    cursor: { x: number; y: number; z: number } | null,
  ) {
    const keep = new Set(measurements.map((m) => m.id));
    for (const [id, g] of this.measureGroups) {
      if (!keep.has(id)) { this.disposeMeasureGroup(g); this.measureGroups.delete(id); }
    }
    for (const m of measurements) {
      if (this.measureGroups.has(m.id)) continue;
      const group = this.buildMeasureGroup(m);
      this.measureGroups.set(m.id, group);
      this.group.add(group);
    }
    if (this.measurePreview) { this.disposeMeasureGroup(this.measurePreview); this.measurePreview = null; }
    if (draft && cursor) {
      const { measureSecond, measurementKind } = useToolMarkupStore.getState();
      const end = measureSecond ?? cursor;
      this.measurePreview = this.buildMeasureGroup({
        id: "preview", kind: measureSecond ? measurementKind : "distance",
        ax: draft.x, ay: draft.y, az: draft.z, bx: end.x, by: end.y, bz: end.z,
        ...(measureSecond ? { third: cursor } : {}),
      });
      this.group.add(this.measurePreview);
    }
  }

  private buildMeasureGroup(m: MarkupMeasurement): THREE.Group {
    const group = new THREE.Group();
    group.userData.isMarkupMeasure = true;
    const a = new THREE.Vector3(m.ax, m.ay, m.az);
    const b = new THREE.Vector3(m.bx, m.by, m.bz);
    const points = [a, b, ...(m.third ? [new THREE.Vector3(m.third.x, m.third.y, m.third.z)] : [])];
    const geometry = measurementGeometry(m.kind ?? "distance", points);
    if (!geometry) return group;
    const paths = [...geometry.paths];
    if (!m.kind || m.kind === "distance") {
      const direction = b.clone().sub(a).normalize();
      const normal = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const offset = Math.min(0.3, a.distanceTo(b) * 0.12);
      const start = a.clone().addScaledVector(normal, offset);
      const end = b.clone().addScaledVector(normal, offset);
      const tick = direction.clone().add(normal).normalize().multiplyScalar(offset * 0.16);
      paths.splice(0, 1, [start, end], [a, start.clone().addScaledVector(normal, offset * 0.2)], [b, end.clone().addScaledVector(normal, offset * 0.2)], [start.clone().sub(tick), start.clone().add(tick)], [end.clone().sub(tick), end.clone().add(tick)]);
      geometry.labelAt.copy(start).lerp(end, 0.5);
    }
    for (const path of paths) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false, depthWrite: false }));
      line.renderOrder = 997;
      line.userData.isMarkupPreview = true;
      line.raycast = () => undefined;
      group.add(line);
    }
    const el = document.createElement("div");
    el.style.cssText = "pointer-events:none;padding:3px 6px;border-radius:3px;background:var(--surface-card, #18181b);border:1px solid #38bdf8;color:var(--text-strong, #fff);font:600 11px/1.3 system-ui,sans-serif;white-space:nowrap";
    el.textContent = measurementLabel(geometry);
    const label = new CSS2DObject(el);
    label.position.copy(geometry.labelAt);
    group.add(label);
    return group;
  }

  private disposeMeasureGroup(g: THREE.Group) {
    this.group.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      if (o instanceof CSS2DObject) {
        o.element.remove();
      }
    });
  }

  private clearAll() {
    if (this.measurePreview) { this.disposeMeasureGroup(this.measurePreview); this.measurePreview = null; }
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
    for (const obj of this.noteObjects.values()) {
      this.group.remove(obj);
      obj.element.remove();
    }
    this.noteObjects.clear();
    for (const g of this.measureGroups.values()) {
      this.disposeMeasureGroup(g);
    }
    this.measureGroups.clear();
    if (this.cubePreview) {
      this.group.remove(this.cubePreview);
      this.cubePreview.geometry.dispose();
      (this.cubePreview.material as THREE.Material).dispose();
      this.cubePreview = null;
    }
    if (this.snapIndicator) {
      this.group.remove(this.snapIndicator);
      this.snapIndicator.geometry.dispose();
      (this.snapIndicator.material as THREE.Material).dispose();
      this.snapIndicator = null;
    }
    if (this.measureDraftLine) {
      this.group.remove(this.measureDraftLine);
      this.measureDraftLine.geometry.dispose();
      (this.measureDraftLine.material as THREE.Material).dispose();
      this.measureDraftLine = null;
    }
    if (this.measureDraftDot) {
      this.group.remove(this.measureDraftDot);
      this.measureDraftDot.geometry.dispose();
      (this.measureDraftDot.material as THREE.Material).dispose();
      this.measureDraftDot = null;
    }
    if (this.measureDraftLabel) {
      this.group.remove(this.measureDraftLabel);
      this.measureDraftLabel.element.remove();
      this.measureDraftLabel = null;
    }
  }
}
