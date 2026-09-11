/**
 * ViewCube — the corner navigation cube rendered as its own mini scene
 * over the main viewport (frosted-glass faces, edge/corner hit zones).
 *
 * Handles its own hit-testing, hover styling, and camera-snap animation
 * (via flyTo) when a face/edge/corner is clicked. Rendered and driven by
 * Viewer3D, synced each frame to the main OrbitControls camera.
 */
import * as THREE from "three";
import { flyTo } from "./flyTo";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Screen layout for the view cube (CSS pixels).
 * Bump `revision` whenever size/margins change so Viewer3D remounts the instance.
 */
export const VIEW_CUBE_LAYOUT = {
  /** Bump whenever size/margins change so Viewer3D remounts the instance. */
  revision: 21,
  /** 155px fits cube + surrounding compass ring + N/S/E/W labels. */
  size: 155,
  /** Equal top / right inset (CSS px). */
  marginTop: 16,
  marginRight: 16,
} as const;

type ZoneKind = "face" | "edge" | "corner";

type ZoneUserData = {
  kind: ZoneKind;
  dir: THREE.Vector3;
  label?: string;
  zoneKey?: string;
};

/** Result from pickCompass — either a cardinal snap target or a ring-drag handle. */
export type CompassHit =
  | { kind: "compass-cardinal"; dir: THREE.Vector3; label: string }
  | { kind: "compass-ring-drag" };

type HitMesh = THREE.Mesh;

const FACE_PX = 512;
const HALF = 0.36;   // cube half-size — smaller cube nests clearly inside ring
const BAND = 0.34;

/** Hover overlay gray (slate-400). */
const HOVER_GRAY = 0x94a3b8;

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

  // Crisp, high-contrast labels (FRONT / TOP / …)
  const fontPx = Math.round(s * 0.168);
  ctx.font = `800 ${fontPx}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Soft halo then dark fill so letters stay sharp on glass faces
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(6, Math.round(s * 0.028));
  ctx.strokeStyle = hover
    ? "rgba(241,245,249,0.95)"
    : "rgba(255,255,255,0.92)";
  ctx.strokeText(label, s / 2, s / 2);
  ctx.lineWidth = Math.max(2, Math.round(s * 0.01));
  ctx.strokeStyle = hover ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.22)";
  ctx.strokeText(label, s / 2, s / 2);
  ctx.fillStyle = "#0f172a";
  ctx.fillText(label, s / 2, s / 2);
}

function makeFaceTexture(label: string, hover = false) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_PX;
  canvas.height = FACE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (label === "BOTTOM") {
    ctx.translate(FACE_PX, FACE_PX);
    ctx.rotate(Math.PI);
  }
  paintFace(ctx, label, hover);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Compass ring constants. */
const RING_R = 0.92;      // torus centerline radius — ring wraps cube (HALF=0.5)
const RING_TUBE = 0.034;  // visible tube radius (thin outline style)
const RING_HIT_TUBE = 0.14; // invisible hit tube — generous 44pt touch target
const CARDINAL_R = 1.10;  // distance from center for N/S/E/W sprite labels
const CARDINAL_LABELS: { label: string; dir: THREE.Vector3 }[] = [
  { label: "N", dir: new THREE.Vector3(0, 0,  1) },
  { label: "S", dir: new THREE.Vector3(0, 0, -1) },
  { label: "E", dir: new THREE.Vector3( 1, 0, 0) },
  { label: "W", dir: new THREE.Vector3(-1, 0, 0) },
];

/** Paint a compass label sprite onto a square canvas (text centred). */
function makeCardinalTexture(label: string, hover = false): THREE.Texture {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, S, S);
  if (hover) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();
  }
  const fontSize = Math.round(S * 0.46);
  ctx.font = `700 ${fontSize}px "Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Halo
  ctx.lineJoin = "round";
  ctx.lineWidth = fontSize * 0.18;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.strokeText(label, S / 2, S / 2);
  ctx.fillStyle = hover ? "#0f172a" : "#1e293b";
  ctx.fillText(label, S / 2, S / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * White liquid-glass ViewCube — frosted idle, soft gray hover (instant, no sticky anim).
 */
export class ViewCube {
  readonly size = VIEW_CUBE_LAYOUT.size;
  private marginTop: number = VIEW_CUBE_LAYOUT.marginTop;
  private marginRight: number = VIEW_CUBE_LAYOUT.marginRight;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  private root = new THREE.Group();
  /** Compass ring + cardinals — child of root, shares cube's orientation. */
  private compassGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private zoneMeshes = new Map<string, HitMesh>();
  private pickBox: THREE.Mesh | null = null;
  /** Reference to the single multi-material cube mesh for face hover. */
  private cubeMeshRef: THREE.Mesh | null = null;
  private overlayMeshes = new Map<string, HitMesh>();
  private faceMats: THREE.MeshStandardMaterial[] = [];
  private bodyMat: THREE.MeshStandardMaterial | null = null;
  private hovered: HitMesh | null = null;
  private hoveredOverlay: HitMesh | null = null;
  private lastZone: ZoneUserData | null = null;
  // Compass state
  private compassRingMat: THREE.MeshStandardMaterial | null = null;
  private cardinalSprites: Array<{ sprite: THREE.Sprite; restTex: THREE.Texture; hoverTex: THREE.Texture }> = [];
  private hoveredCardinalIdx: number = -1;
  private ringDragActive = false;
  private ringDragStartAngle = 0;
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
    this.root.add(this.compassGroup);
    this.compassGroup.position.y = -0.18; // shift ring slightly below cube centre

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 0.4);
    key.position.set(1.2, 3.5, 2.5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-2.5, 1.5, 1.5);
    this.scene.add(fill);

    this.buildCube();
    this.buildCompass();
  }

  /** Builds the flat compass ring + N/S/E/W sprites + hit zones. */
  private buildCompass() {
    // ── Visual ring (thin torus in XZ plane at cube mid-height) ──
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.0,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.compassRingMat = ringMat;
    const ringGeo = new THREE.TorusGeometry(RING_R, RING_TUBE, 16, 80);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2; // flat in XZ plane
    ringMesh.name = "compass-ring";
    this.compassGroup.add(ringMesh);

    // ── Invisible wider torus for ring drag hit zone ──
    const hitRingGeo = new THREE.TorusGeometry(RING_R, RING_HIT_TUBE, 8, 48);
    const hitRingMat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide,
    });
    const hitRingMesh = new THREE.Mesh(hitRingGeo, hitRingMat);
    hitRingMesh.rotation.x = Math.PI / 2;
    hitRingMesh.name = "compass-ring-hit";
    hitRingMesh.userData.isCompassRingDrag = true;
    this.compassGroup.add(hitRingMesh);

    // ── Tick marks at 90° intervals ──
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const tickGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.055, 6);
      const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(Math.sin(angle) * RING_R, 0, Math.cos(angle) * RING_R);
      tick.name = "compass-tick";
      this.compassGroup.add(tick);
    }

    // ── N/S/E/W sprites + invisible PlaneGeometry hit zones ──
    for (let i = 0; i < CARDINAL_LABELS.length; i++) {
      const { label, dir } = CARDINAL_LABELS[i];
      const restTex = makeCardinalTexture(label, false);
      const hoverTex = makeCardinalTexture(label, true);
      const spriteMat = new THREE.SpriteMaterial({
        map: restTex,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.setScalar(0.24);
      sprite.position.copy(dir.clone().multiplyScalar(CARDINAL_R));
      sprite.name = `compass-label-${label}`;
      this.compassGroup.add(sprite);
      this.cardinalSprites.push({ sprite, restTex, hoverTex });

      // Invisible hit zone — generous 0.30×0.30 plane (≈44pt at 155px)
      const hitGeo = new THREE.PlaneGeometry(0.30, 0.30);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(dir.clone().multiplyScalar(CARDINAL_R));
      hitMesh.userData.isCompassCardinal = true;
      hitMesh.userData.compassCardinalIdx = i;
      hitMesh.name = `compass-hit-${label}`;
      // Face the camera (Y-up, ring is in XZ plane so cardinal planes face up)
      hitMesh.rotation.x = -Math.PI / 2;
      this.compassGroup.add(hitMesh);
    }
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

    // ── Single BoxGeometry cube with 6-material array ──────────────────────
    // This avoids ALL transparency sorting / z-fighting: backface culling
    // handles occlusion naturally, no depthWrite tricks needed.
    //
    // BoxGeometry material slot order: 0=+X(Right) 1=-X(Left) 2=+Y(Top)
    //                                  3=-Y(Bottom) 4=+Z(Front) 5=-Z(Back)
    const faceOrder: { label: string; dir: THREE.Vector3 }[] = [
      { label: "RIGHT",  dir: new THREE.Vector3( 1,  0,  0) },
      { label: "LEFT",   dir: new THREE.Vector3(-1,  0,  0) },
      { label: "TOP",    dir: new THREE.Vector3( 0,  1,  0) },
      { label: "BOTTOM", dir: new THREE.Vector3( 0, -1,  0) },
      { label: "FRONT",  dir: new THREE.Vector3( 0,  0,  1) },
      { label: "BACK",   dir: new THREE.Vector3( 0,  0, -1) },
    ];

    const cubeMats: THREE.MeshStandardMaterial[] = faceOrder.map(({ label }) => {
      const restMap  = makeFaceTexture(label, false);
      const hoverMap = makeFaceTexture(label, true);
      const mat = new THREE.MeshStandardMaterial({
        map: restMap,
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.0,
        transparent: false,   // opaque — no sorting issues
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });
      mat.userData.restMap  = restMap;
      mat.userData.hoverMap = hoverMap;
      mat.userData.faceLabel = label;
      this.faceMats.push(mat);
      return mat;
    });

    const cubeGeo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2);
    const cubeMesh = new THREE.Mesh(cubeGeo, cubeMats);
    cubeMesh.name = "viewcube-body";
    cubeMesh.renderOrder = 1;
    this.root.add(cubeMesh);
    this.cubeMeshRef = cubeMesh;

    // Invisible pick volume — same size as cube, used by pickZone hit-classification
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide,
      }),
    );
    pick.name = "viewcube-pick";
    pick.renderOrder = -1;
    this.pickBox = pick;
    this.root.add(pick);

    // Register face zones using the same BoxGeometry pick approach:
    // we reuse the existing pickBox for face/edge/corner classification,
    // so we only need zone entries — no separate per-face mesh needed.
    for (const { label, dir } of faceOrder) {
      const key = zoneKey("face", dir);
      const dummy = new THREE.Mesh(
        new THREE.PlaneGeometry(HALF * 2, HALF * 2),
        new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      ) as HitMesh;
      dummy.visible = false;
      dummy.userData = { kind: "face", dir, label, zoneKey: key };
      this.zoneMeshes.set(key, dummy);
    }
    this.bodyMat = cubeMats[0]; // keep ref for legacy callers

    // White edge lines on top of the cube faces
    this.root.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2 + 0.001, HALF * 2 + 0.001, HALF * 2 + 0.001)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
      ),
    );


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

  // ─────────────────────────────────────────────
  //  Compass public API
  // ─────────────────────────────────────────────

  /** Raycast against compass group to find a compass hit (cardinal or ring-drag). */
  pickCompass(clientX: number, clientY: number, canvas: HTMLCanvasElement): CompassHit | null {
    if (!this.setPointer(clientX, clientY, canvas)) return null;
    const hits = this.raycaster.intersectObjects(this.compassGroup.children, false);
    for (const h of hits) {
      if (h.object.userData.isCompassCardinal === true) {
        const idx = h.object.userData.compassCardinalIdx as number;
        const { label, dir } = CARDINAL_LABELS[idx];
        return { kind: "compass-cardinal", dir: dir.clone(), label };
      }
      if (h.object.userData.isCompassRingDrag === true) {
        return { kind: "compass-ring-drag" };
      }
    }
    return null;
  }

  /** Update compass hover highlighting (call from onPointerMove). */
  updateCompassHover(clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
    if (!this.containsClientPoint(clientX, clientY, canvas)) {
      this.clearCompassHover();
      return false;
    }
    const hit = this.pickCompass(clientX, clientY, canvas);
    if (hit?.kind === "compass-cardinal") {
      const idx = (hit as { kind: "compass-cardinal"; dir: THREE.Vector3; label: string } & { _idx?: number }).dir
        ? CARDINAL_LABELS.findIndex(c => c.label === (hit as { label: string }).label)
        : -1;
      this._setCardinalHover(idx);
      this._setRingHover(false);
      return true;
    }
    if (hit?.kind === "compass-ring-drag") {
      this._setCardinalHover(-1);
      this._setRingHover(true);
      return true;
    }
    this.clearCompassHover();
    return false;
  }

  clearCompassHover() {
    this._setCardinalHover(-1);
    this._setRingHover(false);
  }

  private _setCardinalHover(idx: number) {
    if (this.hoveredCardinalIdx === idx) return;
    // Restore previous
    if (this.hoveredCardinalIdx >= 0) {
      const prev = this.cardinalSprites[this.hoveredCardinalIdx];
      if (prev) (prev.sprite.material as THREE.SpriteMaterial).map = prev.restTex;
    }
    this.hoveredCardinalIdx = idx;
    if (idx >= 0) {
      const cur = this.cardinalSprites[idx];
      if (cur) (cur.sprite.material as THREE.SpriteMaterial).map = cur.hoverTex;
    }
  }

  private _setRingHover(on: boolean) {
    if (this.compassRingMat) {
      this.compassRingMat.opacity = on ? 0.82 : 0.52;
      this.compassRingMat.needsUpdate = true;
    }
  }

  /** Snap camera to a horizontal cardinal direction (preserving elevation). */
  async snapToCardinal(
    dir: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls,
    duration = 600,
  ): Promise<void> {
    const target = controls.target.clone();
    const offset = camera.position.clone().sub(target);
    const elevation = offset.y;                      // preserve current elevation
    const horizontal = Math.sqrt(offset.x ** 2 + offset.z ** 2);
    // Build new position: same elevation, same total distance, new horizontal direction
    const flat = dir.clone().normalize();
    const dist = Math.max(offset.length(), 1);
    const newOffset = new THREE.Vector3(
      flat.x * horizontal,
      elevation,
      flat.z * horizontal,
    ).normalize().multiplyScalar(dist);
    const position = target.clone().add(newOffset);
    camera.up.set(0, 1, 0);
    await flyTo(camera, controls, position, target, duration);
    controls.update();
  }

  // ── Ring drag (yaw-only orbit) ──

  get isRingDragging(): boolean { return this.ringDragActive; }

  startRingDrag(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const box = this.screenRect(canvas);
    const cx = box.left + box.width / 2 + box.rect.left;
    const cy = box.top + box.height / 2 + box.rect.top;
    this.ringDragStartAngle = Math.atan2(clientY - cy, clientX - cx);
    this.ringDragActive = true;
  }

  updateRingDrag(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls,
  ) {
    if (!this.ringDragActive) return;
    const box = this.screenRect(canvas);
    const cx = box.left + box.width / 2 + box.rect.left;
    const cy = box.top + box.height / 2 + box.rect.top;
    const angle = Math.atan2(clientY - cy, clientX - cx);
    const delta = angle - this.ringDragStartAngle;
    this.ringDragStartAngle = angle;
    // Rotate camera position around world-Y by delta radians
    const camera = controls.object as THREE.PerspectiveCamera;
    const target = controls.target.clone();
    const offset = camera.position.clone().sub(target);
    offset.applyEuler(new THREE.Euler(0, -delta, 0));
    camera.position.copy(target.clone().add(offset));
    camera.lookAt(target);
    controls.update();
  }

  endRingDrag() {
    this.ringDragActive = false;
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

  /** Live margins (e.g. Werkzeug dock open — keep cube left of the panel). */
  setMargins(partial: { marginRight?: number; marginTop?: number }) {
    if (partial.marginRight != null) this.marginRight = partial.marginRight;
    if (partial.marginTop != null) this.marginTop = partial.marginTop;
    this.updateViewport(this.canvasCss.w, this.canvasCss.h);
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

  /** Instant face highlight on the multi-material cube — no rAF so it never sticks. */
  private applyFaceHover(mesh: HitMesh, on: boolean) {
    // `mesh` is the dummy zone entry — look up the face label to find the real material slot.
    const label = mesh.userData.faceLabel as string | undefined
      ?? mesh.userData.label as string | undefined;
    if (!label) return;
    const mat = this.faceMats.find(m => m.userData.faceLabel === label);
    if (!mat) return;

    const hoverMap = mat.userData.hoverMap as THREE.Texture | undefined;
    const restMap  = mat.userData.restMap  as THREE.Texture | undefined;

    if (on && hoverMap) {
      mat.map = hoverMap;
      mat.emissive.setHex(0x64748b);
      mat.emissiveIntensity = 0.14;
    } else if (restMap) {
      mat.map = restMap;
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
    this.clearCompassHover();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
        const m = obj.material as THREE.Material & { map?: THREE.Texture; userData?: { hoverMap?: THREE.Texture; restMap?: THREE.Texture } };
        if (Array.isArray(m)) (m as THREE.Material[]).forEach((x) => x.dispose());
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
    for (const { restTex, hoverTex } of this.cardinalSprites) {
      restTex.dispose();
      hoverTex.dispose();
    }
    this.cardinalSprites = [];
    this.compassRingMat = null;
    this.zoneMeshes.clear();
    this.overlayMeshes.clear();
    this.faceMats = [];
    this.bodyMat = null;
    this.pickBox = null;
    this.cubeMeshRef = null;
  }
}
