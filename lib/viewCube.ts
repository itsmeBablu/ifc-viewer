import * as THREE from "three";
import { flyTo } from "./flyTo";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Screen layout for the view cube (CSS pixels).
 * Bump `revision` whenever size/margins change so Viewer3D remounts the instance
 * (HMR alone keeps the old Three.js object alive).
 */
export const VIEW_CUBE_LAYOUT = {
  revision: 11,
  size: 120,
  marginTop: 72,
  marginRight: 148,
} as const;

type ZoneKind = "face" | "edge" | "corner";

type ZoneUserData = {
  kind: ZoneKind;
  /** Unit direction from origin toward the view (camera looks at origin from this dir). */
  dir: THREE.Vector3;
  label?: string;
  /** Stable key for matching highlight meshes. */
  zoneKey?: string;
};

type HitMesh = THREE.Mesh;

const FACE_PX = 256;
/** Half-extent of the pick / visual cube. */
const HALF = 0.52;
/**
 * On a face, tangential coords beyond this → edge/corner band.
 * (Face center ≈ 0; face edge ≈ HALF.)
 */
const BAND = 0.30;

function zoneKey(kind: ZoneKind, dir: THREE.Vector3): string {
  const qx = Math.round(dir.x * 100) / 100;
  const qy = Math.round(dir.y * 100) / 100;
  const qz = Math.round(dir.z * 100) / 100;
  return `${kind}:${qx},${qy},${qz}`;
}

function sgn(n: number): number {
  return n < 0 ? -1 : 1;
}

/** Classify a hit point on the pick cube into face / edge / corner. */
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
    const kind: ZoneKind = "corner";
    return { kind, dir, zoneKey: zoneKey(kind, dir) };
  }

  if (near1) {
    dir[face.a] = sgn(face.v);
    dir[t1.a] = sgn(t1.v);
    dir.normalize();
    const kind: ZoneKind = "edge";
    return { kind, dir, zoneKey: zoneKey(kind, dir) };
  }

  dir[face.a] = sgn(face.v);
  const kind: ZoneKind = "face";
  const labels: Record<string, string> = {
    "1,0,0": "RIGHT",
    "-1,0,0": "LEFT",
    "0,1,0": "TOP",
    "0,-1,0": "BOTTOM",
    "0,0,1": "FRONT",
    "0,0,-1": "BACK",
  };
  const label =
    labels[`${dir.x},${dir.y},${dir.z}`] ?? undefined;
  return { kind, dir, label, zoneKey: zoneKey(kind, dir) };
}

/** Frosted liquid-glass face with white label (idle or yellow hover fill). */
function paintGlassFace(
  ctx: CanvasRenderingContext2D,
  label: string,
  tint: string,
  hover = false,
) {
  const s = FACE_PX;
  const grad = ctx.createLinearGradient(0, 0, s, s);
  if (hover) {
    grad.addColorStop(0, "rgba(254,243,199,0.98)"); // amber-100
    grad.addColorStop(0.45, "rgba(253,230,138,0.95)"); // amber-200
    grad.addColorStop(1, "rgba(251,191,36,0.9)"); // amber-400
  } else {
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.4, tint);
    grad.addColorStop(1, "rgba(120,140,165,0.72)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const sheen = ctx.createRadialGradient(
    s * 0.28,
    s * 0.22,
    4,
    s * 0.28,
    s * 0.22,
    s * 0.55,
  );
  sheen.addColorStop(0, hover ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.65)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, s - 16, s - 16);
  ctx.strokeStyle = hover ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, s - 28, s - 28);

  // White label — dark halo so it stays readable on yellow hover
  ctx.font = "700 42px system-ui, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = hover ? 10 : 8;
  ctx.strokeStyle = hover ? "rgba(24,24,27,0.55)" : "rgba(24,24,27,0.5)";
  ctx.strokeText(label, s / 2, s / 2 + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, s / 2, s / 2 + 1);
}

function makeFaceTexture(label: string, tint: string, hover = false) {
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = FACE_PX;
  faceCanvas.height = FACE_PX;
  const ctx = faceCanvas.getContext("2d")!;
  paintGlassFace(ctx, label, tint, hover);
  const tex = new THREE.CanvasTexture(faceCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Revit-style ViewCube. Picking uses an invisible box + zone classification
 * so faces / edges / corners all select reliably.
 */
export class ViewCube {
  readonly size = VIEW_CUBE_LAYOUT.size;
  private readonly marginTop = VIEW_CUBE_LAYOUT.marginTop;
  private readonly marginRight = VIEW_CUBE_LAYOUT.marginRight;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  private root = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  /** Visual meshes keyed for hover highlight. */
  private zoneMeshes = new Map<string, HitMesh>();
  /** Invisible box used only for picking. */
  private pickBox: THREE.Mesh | null = null;
  private hovered: HitMesh | null = null;
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
    this.camera.position.set(0, 0, 4.2);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = null;
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbeafe, 0.35);
    fill.position.set(-2, 1, -1);
    this.scene.add(fill);
    this.buildCube();
  }

  private registerZone(mesh: HitMesh, data: ZoneUserData) {
    const key = data.zoneKey ?? zoneKey(data.kind, data.dir);
    mesh.userData = { ...data, zoneKey: key };
    this.zoneMeshes.set(key, mesh);
  }

  private buildCube() {
    {
      const plateCanvas = document.createElement("canvas");
      plateCanvas.width = 256;
      plateCanvas.height = 256;
      const pctx = plateCanvas.getContext("2d")!;
      const rg = pctx.createRadialGradient(128, 128, 40, 128, 128, 124);
      rg.addColorStop(0, "rgba(255,255,255,0.45)");
      rg.addColorStop(0.65, "rgba(255,255,255,0.18)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      pctx.fillStyle = rg;
      pctx.fillRect(0, 0, 256, 256);
      const plateTex = new THREE.CanvasTexture(plateCanvas);
      plateTex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(2.35, 2.35),
        new THREE.MeshBasicMaterial({
          map: plateTex,
          transparent: true,
          depthWrite: false,
          opacity: 1,
        }),
      );
      plate.position.z = -1.15;
      this.root.add(plate);
    }

    // Invisible pick volume — must stay visible:true so Raycaster can hit it
    {
      const pickMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      });
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2),
        pickMat,
      );
      pick.name = "viewcube-pick";
      pick.renderOrder = -1;
      this.pickBox = pick;
      this.root.add(pick);
    }

    const faceSize = 0.98;
    const faces: {
      label: string;
      dir: THREE.Vector3;
      tint: string;
      rot: THREE.Euler;
    }[] = [
      {
        label: "FRONT",
        dir: new THREE.Vector3(0, 0, 1),
        tint: "rgba(148,163,184,0.55)",
        rot: new THREE.Euler(0, 0, 0),
      },
      {
        label: "BACK",
        dir: new THREE.Vector3(0, 0, -1),
        tint: "rgba(100,116,139,0.55)",
        rot: new THREE.Euler(0, Math.PI, 0),
      },
      {
        label: "RIGHT",
        dir: new THREE.Vector3(1, 0, 0),
        tint: "rgba(148,163,184,0.5)",
        rot: new THREE.Euler(0, Math.PI / 2, 0),
      },
      {
        label: "LEFT",
        dir: new THREE.Vector3(-1, 0, 0),
        tint: "rgba(148,163,184,0.5)",
        rot: new THREE.Euler(0, -Math.PI / 2, 0),
      },
      {
        label: "TOP",
        dir: new THREE.Vector3(0, 1, 0),
        tint: "rgba(203,213,225,0.55)",
        rot: new THREE.Euler(-Math.PI / 2, 0, 0),
      },
      {
        label: "BOTTOM",
        dir: new THREE.Vector3(0, -1, 0),
        tint: "rgba(71,85,105,0.6)",
        rot: new THREE.Euler(Math.PI / 2, 0, 0),
      },
    ];

    for (const f of faces) {
      const restMap = makeFaceTexture(f.label, f.tint, false);
      const hoverMap = makeFaceTexture(f.label, f.tint, true);

      const geo = new THREE.PlaneGeometry(faceSize, faceSize);
      const mat = new THREE.MeshStandardMaterial({
        map: restMap,
        roughness: 0.28,
        metalness: 0.08,
        transparent: true,
        opacity: 0.96,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });
      mat.userData.restOpacity = 0.96;
      mat.userData.restMap = restMap;
      mat.userData.hoverMap = hoverMap;
      const mesh = new THREE.Mesh(geo, mat) as HitMesh;
      mesh.rotation.copy(f.rot);
      mesh.position.copy(f.dir.clone().multiplyScalar(HALF));
      this.registerZone(mesh, {
        kind: "face",
        dir: f.dir.clone(),
        label: f.label,
      });
      this.root.add(mesh);
    }

    const edgeLen = 0.76;
    const edgeR = 0.055;
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
      const geo = new THREE.BoxGeometry(
        x === 0 ? edgeLen : edgeR * 2,
        y === 0 ? edgeLen : edgeR * 2,
        z === 0 ? edgeLen : edgeR * 2,
      );
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.35,
        metalness: 0.05,
        transparent: true,
        opacity: 0.55,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
        toneMapped: false,
      });
      mat.userData.restColor = 0xcbd5e1;
      mat.userData.restOpacity = 0.55;
      const mesh = new THREE.Mesh(geo, mat) as HitMesh;
      mesh.position.set(x * HALF, y * HALF, z * HALF);
      this.registerZone(mesh, { kind: "edge", dir });
      this.root.add(mesh);
    }

    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) {
          const dir = new THREE.Vector3(x, y, z).normalize();
          const geo = new THREE.SphereGeometry(0.085, 12, 12);
          const mat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.3,
            metalness: 0.05,
            transparent: true,
            opacity: 0.65,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0,
            toneMapped: false,
          });
          mat.userData.restColor = 0x94a3b8;
          mat.userData.restOpacity = 0.65;
          const mesh = new THREE.Mesh(geo, mat) as HitMesh;
          mesh.position.set(x * HALF, y * HALF, z * HALF);
          this.registerZone(mesh, { kind: "corner", dir });
          this.root.add(mesh);
        }
      }
    }

    const edgesGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(HALF * 2 + 0.02, HALF * 2 + 0.02, HALF * 2 + 0.02),
    );
    const line = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.root.add(line);
  }

  syncFromCamera(mainCamera: THREE.Camera, target: THREE.Vector3) {
    const offset = mainCamera.position.clone().sub(target).normalize();
    this.camera.position.copy(offset.multiplyScalar(4.2));
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
    const top = (this.canvasCss.h - y - h) * scaleY;
    const left = x * scaleX;
    return {
      left,
      top,
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
    const nx = ((cssX - box.left) / box.width) * 2 - 1;
    const ny = -(((cssY - box.top) / box.height) * 2 - 1);
    this.pointer.set(nx, ny);
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

  private meshForZone(zone: ZoneUserData): HitMesh | null {
    const key = zone.zoneKey ?? zoneKey(zone.kind, zone.dir);
    return this.zoneMeshes.get(key) ?? null;
  }

  updateHover(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const zone = this.pickZone(clientX, clientY, canvas);
    const next = zone ? this.meshForZone(zone) : null;
    const same =
      next === this.hovered &&
      zone?.zoneKey === this.lastZone?.zoneKey;
    if (same) return;
    this.clearHover();
    this.hovered = next;
    this.lastZone = zone;
    if (!next) return;
    this.applyHover(next, true);
  }

  clearHover() {
    if (this.hovered) {
      this.applyHover(this.hovered, false);
      this.hovered = null;
    }
    this.lastZone = null;
  }

  /** Yellow liquid-glass highlight; face labels stay white via hover texture. */
  private applyHover(mesh: HitMesh, on: boolean) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const hoverMap = mat.userData.hoverMap as THREE.Texture | undefined;
    const restMap = mat.userData.restMap as THREE.Texture | undefined;

    if (on) {
      // Faces: swap to yellow-glass map with baked white text (no color tint)
      if (hoverMap) {
        mat.map = hoverMap;
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0xfbbf24);
        mat.emissiveIntensity = 0.35;
      } else {
        mat.color.setHex(0xfde68a);
        mat.emissive.setHex(0xfbbf24);
        mat.emissiveIntensity = 0.95;
      }
      mat.opacity = 1;
      mat.roughness = 0.22;
      mat.metalness = 0.04;
    } else {
      if (restMap) {
        mat.map = restMap;
        mat.color.setHex(0xffffff);
      } else {
        mat.color.setHex((mat.userData.restColor as number) ?? 0xcbd5e1);
      }
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mat.opacity =
        (mat.userData.restOpacity as number) ?? (mat.map ? 0.96 : 0.55);
      mat.roughness = 0.28;
      mat.metalness = 0.08;
    }
    mat.needsUpdate = true;
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
    this.pickBox = null;
  }
}
