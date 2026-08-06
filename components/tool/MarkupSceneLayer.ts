import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  createPlacementMesh,
  rebuildPlacementMesh,
  type MarkupNote,
  type MarkupPlacement,
} from "@/lib/toolMarkup";

/**
 * Imperative Three.js layer for Werkzeug markup meshes + CSS2D notes.
 * Owned by Viewer3D — kept out of React render.
 */
export class MarkupSceneLayer {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private noteObjects = new Map<string, CSS2DObject>();
  private labelRenderer: CSS2DRenderer | null = null;
  private host: HTMLElement | null = null;
  private scene: THREE.Scene | null = null;
  private selectedId: string | null = null;
  private cubePreview: THREE.Mesh | null = null;
  private snapIndicator: THREE.Mesh | null = null;
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

  /** Live footprint while drawing a cube (corner → opposite corner). */
  setCubeDrawPreview(
    start: { x: number; y: number; z: number } | null,
    current: { x: number; y: number; z: number } | null,
    height = 0.5,
  ) {
    if (!start || !current) {
      if (this.cubePreview) {
        this.cubePreview.visible = false;
      }
      return;
    }
    const w = Math.max(0.05, Math.abs(current.x - start.x));
    const d = Math.max(0.05, Math.abs(current.z - start.z));
    const h = Math.max(0.05, height);
    const cx = (current.x + start.x) / 2;
    const cz = (current.z + start.z) / 2;
    const cy = start.y + h / 2;
    if (!this.cubePreview) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        roughness: 0.6,
      });
      this.cubePreview = new THREE.Mesh(geo, mat);
      this.cubePreview.name = "markup-cube-preview";
      this.cubePreview.userData.isMarkupPreview = true;
      this.group.add(this.cubePreview);
    }
    this.cubePreview.visible = true;
    this.cubePreview.position.set(cx, cy, cz);
    this.cubePreview.scale.set(w, h, d);
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
    mat.emissive.set(selected ? 0x443300 : 0x000000);
    mat.emissiveIntensity = selected ? 0.35 : 0;
    mesh.scale.setScalar(selected ? 1.04 : 1);
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

  private clearAll() {
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
  }
}
