import * as THREE from "three";
import { flyTo } from "./flyTo";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Screen layout for the view cube (CSS pixels).
 * Bump `revision` whenever size/margins change so Viewer3D remounts the instance.
 */
export const VIEW_CUBE_LAYOUT = {
  revision: 16,
  size: 112,
  marginTop: 72,
  marginRight: 148,
} as const;

type ZoneKind = "face" | "edge" | "corner";

type ZoneUserData = {
  kind: ZoneKind;
  dir: THREE.Vector3;
  label?: string;
  zoneKey?: string;
};

type HitMesh = THREE.Mesh;

const FACE_PX = 256;
const HALF = 0.5;
const BAND = 0.34;

/** Idle frosted glass opacity; hover is solid soft gray. */
const GLASS_OPACITY = 0.58;
const HOVER_GRAY = 0x94a3b8; // slate-400

function zoneKey(kind: ZoneKind, dir: THREE.Vector3): string {
  const qx = Math.round(dir.x * 100) / 100;
  const qy = Math.round(dir.y * 100) / 100;
  const qz = Math.round(dir.z * 100) / 100;
  return `${kind}:${qx},${qy},${qz}`;
}

function sgn(n: number): number {
  return n < 0 ? -1 : 1;
}

function classifyHitPoint(point: THREE.Vector3): ZoneUserData {
  const ax = Math.abs(point.x);
  const ay = Math.abs(point.y);
  const az = Math.abs(point.z);

  type Axis = "x" | "y" | "z";
  const axes: { a: Axis; v: number; abs: number }[] = [
    { a: "x", v: point.x, abs: ax },
    { a: "y", v: point.y, abs: ay },
    { a: "z", v: point.z, abs: az },
  ];
  axes.sort((a, b) => b.abs - a.abs);

  const face = axes[0];
  const t1 = axes[1];
  const t2 = axes[2];
  const near1 = t1.abs >= BAND;
  const near2 = t2.abs >= BAND;
  const dir = new THREE.Vector3(0, 0, 0);

  if (near1 && near2) {
    dir.set(sgn(point.x), sgn(point.y), sgn(point.z)).normalize();
    return { kind: "corner", dir, zoneKey: zoneKey("corner", dir) };
  }
  if (near1) {
    dir[face.a] = sgn(face.v);
    dir[t1.a] = sgn(t1.v);
    dir.normalize();
    return { kind: "edge", dir, zoneKey: zoneKey("edge", dir) };
  }

  dir[face.a] = sgn(face.v);
  const labels: Record<string, string> = {
    "1,0,0": "RIGHT",
    "-1,0,0": "LEFT",
    "0,1,0": "TOP",
    "0,-1,0": "BOTTOM",
    "0,0,1": "FRONT",
    "0,0,-1": "BACK",
  };
  return {
    kind: "face",
    dir,
    label: labels[`${dir.x},${dir.y},${dir.z}`],
    zoneKey: zoneKey("face", dir),
  };
}

/** White liquid-glass face (idle) / soft gray hover with dark label. */
function paintFace(
  ctx: CanvasRenderingContext2D,
  label: string,
  hover = false,
) {
  const s = FACE_PX;

  if (hover) {
    const g = ctx.createLinearGradient(0, 0, s * 0.15, s);
    g.addColorStop(0, "#e2e8f0"); // slate-200
    g.addColorStop(0.5, "#cbd5e1"); // slate-300
    g.addColorStop(1, "#94a3b8"); // slate-400
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    const sheen = ctx.createRadialGradient(
      s * 0.28,
      s * 0.22,
      4,
      s * 0.28,
      s * 0.22,
      s * 0.55,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.55)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, s - 4, s - 4);
  } else {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "rgba(255,255,255,0.92)");
    g.addColorStop(0.45, "rgba(248,250,252,0.78)");
    g.addColorStop(1, "rgba(226,232,240,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    const sheen = ctx.createRadialGradient(
      s * 0.3,
      s * 0.22,
      6,
      s * 0.3,
      s * 0.22,
      s * 0.65,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.85)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  }

  const inset = Math.round(s * 0.18);
  ctx.strokeStyle = hover
    ? "rgba(71,85,105,0.28)"
    : "rgba(148,163,184,0.28)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(inset, 0);
  ctx.lineTo(inset, s);
  ctx.moveTo(s - inset, 0);
  ctx.lineTo(s - inset, s);
  ctx.moveTo(0, inset);
  ctx.lineTo(s, inset);
  ctx.moveTo(0, s - inset);
  ctx.lineTo(s, s - inset);
  ctx.stroke();

  ctx.font = "700 34px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (hover) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(226,232,240,0.9)";
    ctx.strokeText(label, s / 2, s / 2);
    ctx.fillStyle = "#0f172a"; // slate-900
  } else {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.strokeText(label, s / 2, s / 2);
    ctx.fillStyle = "#334155";
  }
  ctx.fillText(label, s / 2, s / 2);
}

function makeFaceTexture(label: string, hover = false) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_PX;
  canvas.height = FACE_PX;
  paintFace(canvas.getContext("2d")!, label, hover);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * White liquid-glass ViewCube — frosted idle, soft gray hover (instant, no sticky anim).
 */
export class ViewCube {
  readonly size = VIEW_CUBE_LAYOUT.size;
  private readonly marginTop = VIEW_CUBE_LAYOUT.marginTop;
  private readonly marginRight = VIEW_CUBE_LAYOUT.marginRight;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  private root = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private zoneMeshes = new Map<string, HitMesh>();
  private pickBox: THREE.Mesh | null = null;
  private overlayMeshes = new Map<string, HitMesh>();
  private faceMats: THREE.MeshStandardMaterial[] = [];
  private bodyMat: THREE.MeshStandardMaterial | null = null;
  private hovered: HitMesh | null = null;
  private hoveredOverlay: HitMesh | null = null;
  private lastZone: ZoneUserData | null = null;
  private viewport = {
    x: 0,
    y: 0,
    w: VIEW_CUBE_LAYOUT.size,
    h: VIEW_CUBE_LAYOUT.size,
  };
  private canvasCss = { w: 1, h: 1 };
  private disposed = false;

  constructor() {
    this.camera.position.set(0, 0, 4.6);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = null;
    this.scene.add(this.root);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 0.4);
    key.position.set(1.2, 3.5, 2.5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2.5, 1.5, 1.5);
    this.scene.add(fill);

    this.buildCube();
  }

  private registerZone(mesh: HitMesh, data: ZoneUserData) {
    const key = data.zoneKey ?? zoneKey(data.kind, data.dir);
    mesh.userData = { ...data, zoneKey: key };
    this.zoneMeshes.set(key, mesh);
  }

  private buildCube() {
    // Soft bottom shadow only
    {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      const rg = ctx.createRadialGradient(128, 148, 18, 128, 148, 95);
      rg.addColorStop(0, "rgba(40,45,55,0.22)");
      rg.addColorStop(0.55, "rgba(40,45,55,0.08)");
      rg.addColorStop(1, "rgba(40,45,55,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.5),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, -HALF - 0.02, 0);
      this.root.add(shadow);
    }

    // Frosted white liquid-glass body
    {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.0,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      this.bodyMat = bodyMat;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(HALF * 2 - 0.02, HALF * 2 - 0.02, HALF * 2 - 0.02),
        bodyMat,
      );
      this.root.add(body);
    }

    // Pick volume
    {
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          colorWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      pick.name = "viewcube-pick";
      pick.renderOrder = -1;
      this.pickBox = pick;
      this.root.add(pick);
    }

    const faceSize = 0.998;
    const faces: { label: string; dir: THREE.Vector3; rot: THREE.Euler }[] = [
      { label: "FRONT", dir: new THREE.Vector3(0, 0, 1), rot: new THREE.Euler(0, 0, 0) },
      { label: "BACK", dir: new THREE.Vector3(0, 0, -1), rot: new THREE.Euler(0, Math.PI, 0) },
      { label: "RIGHT", dir: new THREE.Vector3(1, 0, 0), rot: new THREE.Euler(0, Math.PI / 2, 0) },
      { label: "LEFT", dir: new THREE.Vector3(-1, 0, 0), rot: new THREE.Euler(0, -Math.PI / 2, 0) },
      { label: "TOP", dir: new THREE.Vector3(0, 1, 0), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
      { label: "BOTTOM", dir: new THREE.Vector3(0, -1, 0), rot: new THREE.Euler(Math.PI / 2, 0, 0) },
    ];

    for (const f of faces) {
      const restMap = makeFaceTexture(f.label, false);
      const hoverMap = makeFaceTexture(f.label, true);
      const mat = new THREE.MeshStandardMaterial({
        map: restMap,
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.0,
        transparent: true,
        opacity: GLASS_OPACITY,
        depthWrite: false,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });
      mat.userData.restMap = restMap;
      mat.userData.hoverMap = hoverMap;
      this.faceMats.push(mat);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(faceSize, faceSize),
        mat,
      ) as HitMesh;
      mesh.rotation.copy(f.rot);
      mesh.position.copy(f.dir.clone().multiplyScalar(HALF + 0.002));
      mesh.renderOrder = 2;
      this.registerZone(mesh, {
        kind: "face",
        dir: f.dir.clone(),
        label: f.label,
      });
      this.root.add(mesh);
    }

    // Edge / corner overlays — solid yellow when active (no glass fade)
    const edgeLen = 0.64;
    const edgeW = 0.16;
    const edgeMids = [
      [1, 1, 0],
      [1, -1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [1, 0, -1],
      [-1, 0, 1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, 1, -1],
      [0, -1, 1],
      [0, -1, -1],
    ];
    for (const [x, y, z] of edgeMids) {
      const dir = new THREE.Vector3(x, y, z).normalize();
      const key = zoneKey("edge", dir);
      const mat = new THREE.MeshBasicMaterial({
        color: HOVER_GRAY,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          x === 0 ? edgeLen : edgeW,
          y === 0 ? edgeLen : edgeW,
          z === 0 ? edgeLen : edgeW,
        ),
        mat,
      ) as HitMesh;
      const o = HALF - 0.02;
      mesh.position.set(x * o, y * o, z * o);
      mesh.renderOrder = 3;
      mesh.userData = { kind: "edge", dir, zoneKey: key };
      this.overlayMeshes.set(key, mesh);
      this.root.add(mesh);
    }

    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) {
          const dir = new THREE.Vector3(x, y, z).normalize();
          const key = zoneKey("corner", dir);
          const mat = new THREE.MeshBasicMaterial({
            color: HOVER_GRAY,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.18, 0.18),
            mat,
          ) as HitMesh;
          const o = HALF - 0.02;
          mesh.position.set(x * o, y * o, z * o);
          mesh.renderOrder = 3;
          mesh.userData = { kind: "corner", dir, zoneKey: key };
          this.overlayMeshes.set(key, mesh);
          this.root.add(mesh);
        }
      }
    }

    // Soft white glass rim
    this.root.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(
          new THREE.BoxGeometry(HALF * 2 + 0.002, HALF * 2 + 0.002, HALF * 2 + 0.002),
        ),
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
        }),
      ),
    );
  }

  syncFromCamera(mainCamera: THREE.Camera, target: THREE.Vector3) {
    const offset = mainCamera.position.clone().sub(target).normalize();
    this.camera.position.copy(offset.multiplyScalar(4.6));
    this.camera.up.copy(mainCamera.up);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  updateViewport(canvasWidth: number, canvasHeight: number) {
    this.canvasCss = { w: canvasWidth, h: canvasHeight };
    this.viewport = {
      x: canvasWidth - this.size - this.marginRight,
      y: canvasHeight - this.size - this.marginTop,
      w: this.size,
      h: this.size,
    };
  }

  render(renderer: THREE.WebGLRenderer) {
    if (this.disposed) return;
    const { x, y, w, h } = this.viewport;
    const prev = { autoClear: renderer.autoClear };
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, w, h);
    renderer.setViewport(x, y, w, h);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    const size = new THREE.Vector2();
    renderer.getSize(size);
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.autoClear = prev.autoClear;
  }

  private screenRect(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / Math.max(this.canvasCss.w, 1);
    const scaleY = rect.height / Math.max(this.canvasCss.h, 1);
    const { x, y, w, h } = this.viewport;
    return {
      left: x * scaleX,
      top: (this.canvasCss.h - y - h) * scaleY,
      width: w * scaleX,
      height: h * scaleY,
      rect,
    };
  }

  containsClientPoint(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): boolean {
    const box = this.screenRect(canvas);
    const cssX = clientX - box.rect.left;
    const cssY = clientY - box.rect.top;
    return (
      cssX >= box.left &&
      cssX <= box.left + box.width &&
      cssY >= box.top &&
      cssY <= box.top + box.height
    );
  }

  pick(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): ZoneUserData | null {
    return this.pickZone(clientX, clientY, canvas);
  }

  private setPointer(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): boolean {
    if (!this.containsClientPoint(clientX, clientY, canvas)) return false;
    const box = this.screenRect(canvas);
    const cssX = clientX - box.rect.left;
    const cssY = clientY - box.rect.top;
    this.pointer.set(
      ((cssX - box.left) / box.width) * 2 - 1,
      -(((cssY - box.top) / box.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return true;
  }

  private pickZone(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): ZoneUserData | null {
    if (!this.pickBox || !this.setPointer(clientX, clientY, canvas)) return null;
    const hits = this.raycaster.intersectObject(this.pickBox, false);
    if (!hits.length) return null;
    return classifyHitPoint(hits[0].point);
  }

  /** Instant soft-gray face highlight — no rAF so it never sticks mid-fade. */
  private applyFaceHover(mesh: HitMesh, on: boolean) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const hoverMap = mat.userData.hoverMap as THREE.Texture | undefined;
    const restMap = mat.userData.restMap as THREE.Texture | undefined;

    if (on && hoverMap) {
      mat.map = hoverMap;
      mat.opacity = 1;
      mat.transparent = false;
      mat.depthWrite = true;
      mat.emissive.setHex(0x64748b);
      mat.emissiveIntensity = 0.12;
    } else if (restMap) {
      mat.map = restMap;
      mat.opacity = GLASS_OPACITY;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  }

  private applyOverlay(mesh: HitMesh, on: boolean) {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = on ? 0.9 : 0;
    mat.needsUpdate = true;
  }

  updateHover(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const zone = this.pickZone(clientX, clientY, canvas);
    if (zone?.zoneKey === this.lastZone?.zoneKey) return;
    this.clearHover();
    this.lastZone = zone;
    if (!zone) return;

    if (zone.kind === "face") {
      const mesh = this.zoneMeshes.get(zone.zoneKey!);
      if (!mesh) return;
      this.hovered = mesh;
      this.applyFaceHover(mesh, true);
      return;
    }

    const overlay = this.overlayMeshes.get(zone.zoneKey!);
    if (!overlay) return;
    this.hoveredOverlay = overlay;
    this.applyOverlay(overlay, true);
  }

  clearHover() {
    if (this.hovered) {
      this.applyFaceHover(this.hovered, false);
      this.hovered = null;
    }
    if (this.hoveredOverlay) {
      this.applyOverlay(this.hoveredOverlay, false);
      this.hoveredOverlay = null;
    }
    this.lastZone = null;
  }

  async snapMainCamera(
    zone: ZoneUserData,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    duration = 600,
  ): Promise<void> {
    const target = controls.target.clone();
    const dist = Math.max(camera.position.distanceTo(target), 1);
    const dir = zone.dir.clone().normalize();
    const position = target.clone().add(dir.multiplyScalar(dist));
    if (Math.abs(zone.dir.y) > 0.9) {
      camera.up.set(0, 0, zone.dir.y > 0 ? -1 : 1);
    } else {
      camera.up.set(0, 1, 0);
    }
    await flyTo(camera, controls, position, target, duration);
    camera.up.set(0, 1, 0);
    controls.update();
  }

  dispose() {
    this.disposed = true;
    this.clearHover();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else {
          const hoverMap = m.userData?.hoverMap as THREE.Texture | undefined;
          const restMap = m.userData?.restMap as THREE.Texture | undefined;
          hoverMap?.dispose();
          restMap?.dispose();
          if (m.map && m.map !== restMap && m.map !== hoverMap) m.map.dispose();
          m.dispose();
        }
      }
    });
    this.zoneMeshes.clear();
    this.overlayMeshes.clear();
    this.faceMats = [];
    this.bodyMat = null;
    this.pickBox = null;
  }
}
