import gsap from "gsap";
import * as THREE from "three";
import { killGsap } from "@/lib/gsapMotion";
import type { Room } from "./types";
import {
  roomHasExtractFan,
  roomInVentilationZone,
  roomShowsVentilationFlowMarkers,
  roomSuppliesZoneZuluft,
  roomVentilationZoneKey,
  ventilationFlowRole,
} from "./ventilation";

const ARROW_COUNT = 3;
const STANDARD_ARROW_LEN = 0.88;
const STANDARD_TRAVEL = 0.42;
const OUTSIDE_PAD = 0.32;
const EXTERIOR_AIR_GAP = 0.28;
const EXTERIOR_RAY_MAX = 18;
const EXTERIOR_RAY_STEP = 0.1;
const CANDIDATE_DIRS = 48;
const NEIGHBOR_BBOX_PAD = 0.14;
const FLOW_DURATION = 1.85;
const FLOW_STAGGER = 0.28;
const DIR_BUCKETS = 16;

type MarkerEntry = {
  roomId: string;
  root: THREE.Group;
  fanGroup?: THREE.Group;
  tweens: gsap.core.Tween[];
};

export type VentilationMarkerLayer = {
  group: THREE.Group;
  entries: MarkerEntry[];
};

type ExteriorWall = {
  direction: THREE.Vector3;
  wallDistance: number;
};

type FaceBucket = {
  dir: THREE.Vector3;
  area: number;
};

function roomCenter(geometry: THREE.BufferGeometry): THREE.Vector3 {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

function roomSize(geometry: THREE.BufferGeometry): THREE.Vector3 {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return new THREE.Vector3(1, 1, 1);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
}

function computeFloorCentroids(rooms: Room[]): Map<string, THREE.Vector3> {
  const acc = new Map<string, { sum: THREE.Vector3; n: number }>();
  for (const room of rooms) {
    if (!room.geometry?.attributes?.position) continue;
    const c = roomCenter(room.geometry);
    const entry = acc.get(room.floorId) ?? {
      sum: new THREE.Vector3(),
      n: 0,
    };
    entry.sum.add(c);
    entry.n += 1;
    acc.set(room.floorId, entry);
  }
  const out = new Map<string, THREE.Vector3>();
  for (const [floorId, { sum, n }] of acc) {
    if (n > 0) out.set(floorId, sum.multiplyScalar(1 / n));
  }
  return out;
}

function dirBucketKey(dir: THREE.Vector3): string {
  const angle = Math.atan2(dir.z, dir.x);
  const bucket =
    Math.round((angle / (Math.PI * 2)) * DIR_BUCKETS) % DIR_BUCKETS;
  return String((bucket + DIR_BUCKETS) % DIR_BUCKETS);
}

function wallExtentAlongDirection(
  geometry: THREE.BufferGeometry,
  center: THREE.Vector3,
  dir: THREE.Vector3,
): number {
  const pos = geometry.attributes.position;
  if (!pos) return 1;
  let maxProj = 0;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - center.x;
    const dz = pos.getZ(i) - center.z;
    const proj = dx * dir.x + dz * dir.z;
    if (proj > maxProj) maxProj = proj;
  }
  return Math.max(maxProj, 0.35);
}

function pointInRoomBBox(
  point: THREE.Vector3,
  geometry: THREE.BufferGeometry,
  padding = 0.1,
): boolean {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;
  return box
    .clone()
    .expandByScalar(padding)
    .containsPoint(point);
}

/** Which room (if any) contains this XZ point — bbox test on same floor height. */
function findRoomAtPoint(
  point: THREE.Vector3,
  floorRooms: Room[],
): Room | null {
  let best: Room | null = null;
  let bestDist = Infinity;
  for (const room of floorRooms) {
    if (!room.geometry) continue;
    if (!pointInRoomBBox(point, room.geometry, NEIGHBOR_BBOX_PAD)) continue;
    const c = roomCenter(room.geometry);
    const d = (point.x - c.x) ** 2 + (point.z - c.z) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = room;
    }
  }
  return best;
}

function lateralExtentAlongDirection(
  geometry: THREE.BufferGeometry,
  center: THREE.Vector3,
  dir: THREE.Vector3,
): number {
  const lateral = new THREE.Vector3(-dir.z, 0, dir.x);
  const pos = geometry.attributes.position;
  if (!pos) return 0.5;
  let maxLat = 0;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - center.x;
    const dz = pos.getZ(i) - center.z;
    const lat = Math.abs(dx * lateral.x + dz * lateral.z);
    if (lat > maxLat) maxLat = lat;
  }
  return Math.max(maxLat, 0.25);
}

/**
 * Ray from room center must leave this room and reach open air (no other room)
 * before the ray ends — ensures Zuluft comes from outside, not through neighbours.
 */
function rayReachesOpenAir(
  center: THREE.Vector3,
  dir: THREE.Vector3,
  roomId: string,
  floorRooms: Room[],
): boolean {
  let leftOwn = false;
  let airRun = 0;

  for (let d = EXTERIOR_RAY_STEP; d <= EXTERIOR_RAY_MAX; d += EXTERIOR_RAY_STEP) {
    const p = center.clone().add(dir.clone().multiplyScalar(d));
    const hit = findRoomAtPoint(p, floorRooms);

    if (!leftOwn) {
      if (hit?.id === roomId) continue;
      if (hit && hit.id !== roomId) return false;
      leftOwn = true;
      airRun = EXTERIOR_RAY_STEP;
      continue;
    }

    if (!hit) {
      airRun += EXTERIOR_RAY_STEP;
      if (airRun >= EXTERIOR_AIR_GAP) return true;
    } else if (hit.id !== roomId) {
      return false;
    }
  }

  return leftOwn && airRun >= EXTERIOR_AIR_GAP;
}

/** Sample probes along the full wall width — all must sit in open air. */
function wallProbesClear(
  center: THREE.Vector3,
  dir: THREE.Vector3,
  wallDist: number,
  geometry: THREE.BufferGeometry,
  roomId: string,
  floorRooms: Room[],
): boolean {
  const lateral = new THREE.Vector3(-dir.z, 0, dir.x);
  const halfWidth = lateralExtentAlongDirection(geometry, center, dir);
  const samples = 5;

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1) - 0.5;
    const wallPt = center
      .clone()
      .add(dir.clone().multiplyScalar(wallDist))
      .add(lateral.clone().multiplyScalar(t * halfWidth * 1.5));

    for (const pad of [OUTSIDE_PAD * 0.65, OUTSIDE_PAD, OUTSIDE_PAD * 1.35]) {
      const probe = wallPt.clone().add(dir.clone().multiplyScalar(pad));
      const hit = findRoomAtPoint(probe, floorRooms);
      if (hit) return false;
    }
  }

  return rayReachesOpenAir(center, dir, roomId, floorRooms);
}

function uniformDirections(count: number): THREE.Vector3[] {
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    dirs.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  return dirs;
}

function exteriorDirectionScore(
  center: THREE.Vector3,
  dir: THREE.Vector3,
  wallDist: number,
  roomId: string,
  floorRooms: Room[],
  floorCentroid: THREE.Vector3 | undefined,
): number {
  const outside = center.clone().add(
    dir.clone().multiplyScalar(wallDist + OUTSIDE_PAD),
  );

  let minOtherDist = Infinity;
  for (const other of floorRooms) {
    if (other.id === roomId || !other.geometry) continue;
    const oc = roomCenter(other.geometry);
    minOtherDist = Math.min(minOtherDist, outside.distanceTo(oc));
  }

  let awayCore = 0.5;
  if (floorCentroid) {
    const toFacade = center.clone().sub(floorCentroid);
    toFacade.y = 0;
    if (toFacade.lengthSq() > 0.05) {
      awayCore = 0.35 + 0.65 * Math.max(0, dir.dot(toFacade.normalize()));
    }
  }

  return minOtherDist * wallDist * awayCore;
}

/** Collect outward-facing vertical wall normals weighted by triangle area. */
function collectOutwardFaceBuckets(
  geometry: THREE.BufferGeometry,
  center: THREE.Vector3,
): Map<string, FaceBucket> {
  const buckets = new Map<string, FaceBucket>();
  const pos = geometry.attributes.position;
  if (!pos) return buckets;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const toFace = new THREE.Vector3();
  const normalXZ = new THREE.Vector3();

  const triCount = geometry.index
    ? geometry.index.count / 3
    : pos.count / 3;

  for (let t = 0; t < triCount; t++) {
    const ia = geometry.index ? geometry.index.getX(t * 3) : t * 3;
    const ib = geometry.index ? geometry.index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = geometry.index ? geometry.index.getX(t * 3 + 2) : t * 3 + 2;

    vA.fromBufferAttribute(pos, ia);
    vB.fromBufferAttribute(pos, ib);
    vC.fromBufferAttribute(pos, ic);

    ab.subVectors(vB, vA);
    ac.subVectors(vC, vA);
    normal.crossVectors(ab, ac);
    const area2 = normal.length();
    if (area2 < 1e-6) continue;
    normal.divideScalar(area2);

    if (Math.abs(normal.y) > 0.72) continue;

    normalXZ.set(normal.x, 0, normal.z);
    if (normalXZ.lengthSq() < 0.04) continue;
    normalXZ.normalize();

    centroid.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
    toFace.subVectors(centroid, center);
    toFace.y = 0;
    if (toFace.lengthSq() < 1e-4) continue;
    toFace.normalize();

    if (normalXZ.dot(toFace) < 0.2) continue;

    const key = dirBucketKey(normalXZ);
    const prev = buckets.get(key);
    if (prev) {
      prev.area += area2 * 0.5;
      prev.dir.add(normalXZ.clone().multiplyScalar(area2));
    } else {
      buckets.set(key, {
        dir: normalXZ.clone().multiplyScalar(area2),
        area: area2 * 0.5,
      });
    }
  }

  for (const bucket of buckets.values()) {
    if (bucket.dir.lengthSq() > 1e-6) bucket.dir.normalize();
  }

  return buckets;
}

/**
 * Pick the true exterior facade — direction must reach open air outside the
 * building, not through an adjacent room on the same floor.
 */
function pickExteriorWall(
  room: Room,
  floorRooms: Room[],
  floorCentroid: THREE.Vector3 | undefined,
): ExteriorWall {
  const geometry = room.geometry;
  const center = roomCenter(geometry);

  const candidateDirs = new Map<string, THREE.Vector3>();

  for (const dir of uniformDirections(CANDIDATE_DIRS)) {
    candidateDirs.set(dirBucketKey(dir), dir.clone());
  }

  for (const bucket of collectOutwardFaceBuckets(geometry, center).values()) {
    if (bucket.dir.lengthSq() > 1e-4) {
      candidateDirs.set(dirBucketKey(bucket.dir), bucket.dir.clone());
    }
  }

  let best: ExteriorWall & { score: number } | null = null;

  for (const dir of candidateDirs.values()) {
    const wallDistance = wallExtentAlongDirection(geometry, center, dir);
    if (wallDistance < 0.28) continue;

    if (
      !wallProbesClear(
        center,
        dir,
        wallDistance,
        geometry,
        room.id,
        floorRooms,
      )
    ) {
      continue;
    }

    const score = exteriorDirectionScore(
      center,
      dir,
      wallDistance,
      room.id,
      floorRooms,
      floorCentroid,
    );

    if (!best || score > best.score) {
      best = { direction: dir.clone(), wallDistance, score };
    }
  }

  if (best) {
    return {
      direction: best.direction,
      wallDistance: best.wallDistance,
    };
  }

  // Last resort: pick direction farthest from other room centres
  let fallbackDir = new THREE.Vector3(1, 0, 0);
  let fallbackScore = -Infinity;
  for (const dir of uniformDirections(CANDIDATE_DIRS)) {
    const wallDistance = wallExtentAlongDirection(geometry, center, dir);
    const score = exteriorDirectionScore(
      center,
      dir,
      wallDistance,
      room.id,
      floorRooms,
      floorCentroid,
    );
    if (score > fallbackScore) {
      fallbackScore = score;
      fallbackDir = dir.clone();
    }
  }

  return {
    direction: fallbackDir,
    wallDistance: wallExtentAlongDirection(geometry, center, fallbackDir),
  };
}

/**
 * Zuluft through a door / wall shared with the zone's supply room.
 * Prefer a direct neighbour with Zuluft; otherwise trace back through
 * corridor/hall rooms to the nearest upstream supply room in the zone.
 */
function sharesInteriorWall(a: Room, b: Room): boolean {
  if (!a.geometry || !b.geometry) return false;
  const ca = roomCenter(a.geometry);
  const cb = roomCenter(b.geometry);
  const toward = cb.clone().sub(ca);
  toward.y = 0;
  const span = toward.length();
  if (span < 0.4 || span > 14) return false;
  const dir = toward.clone().normalize();
  const wallDistance = wallExtentAlongDirection(a.geometry, ca, dir);
  const onSharedWall = ca
    .clone()
    .add(dir.clone().multiplyScalar(wallDistance + 0.06));
  return pointInRoomBBox(onSharedWall, b.geometry, 0.12);
}

function wallTowardPeer(room: Room, peer: Room): ExteriorWall | null {
  if (!room.geometry || !peer.geometry) return null;
  const center = roomCenter(room.geometry);
  const peerCenter = roomCenter(peer.geometry);
  const toward = peerCenter.clone().sub(center);
  toward.y = 0;
  if (toward.lengthSq() < 0.16) return null;
  const dir = toward.clone().normalize();
  const wallDistance = wallExtentAlongDirection(room.geometry, center, dir);
  return { direction: dir, wallDistance };
}

function pickBestSupplyWallAmong(
  room: Room,
  supplyPeers: Room[],
): ExteriorWall | null {
  const geometry = room.geometry;
  if (!geometry) return null;
  const center = roomCenter(geometry);
  let best: (ExteriorWall & { score: number }) | null = null;

  for (const peer of supplyPeers) {
    const wall = wallTowardPeer(room, peer);
    if (!wall) continue;
    const flow = Math.max(
      peer.ventilation.zuluftVolume,
      peer.ventilation.aldVolume,
    );
    const span = roomCenter(peer.geometry!).distanceTo(center);
    const score = flow + 12 / Math.max(span, 0.5);
    if (!best || score > best.score) {
      best = { ...wall, score };
    }
  }

  return best
    ? { direction: best.direction.clone(), wallDistance: best.wallDistance }
    : null;
}

function pickInteriorZoneSupplyWall(
  room: Room,
  zonePeers: Room[],
): ExteriorWall | null {
  const adjacent = zonePeers.filter((peer) => sharesInteriorWall(room, peer));
  if (!adjacent.length) return null;

  const directSupply = adjacent.filter(roomSuppliesZoneZuluft);
  if (directSupply.length) {
    return pickBestSupplyWallAmong(room, directSupply);
  }

  // Corridor / hall: air enters from the nearest upstream Zuluft room in the zone.
  const visited = new Set<string>([room.id]);
  let frontier: { node: Room; entryWall: Room }[] = adjacent.map((peer) => ({
    node: peer,
    entryWall: peer,
  }));

  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { node, entryWall } of frontier) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      if (roomSuppliesZoneZuluft(node)) {
        return wallTowardPeer(room, entryWall);
      }

      for (const peer of zonePeers) {
        if (visited.has(peer.id)) continue;
        if (sharesInteriorWall(node, peer)) {
          next.push({ node: peer, entryWall });
        }
      }
    }
    frontier = next;
  }

  return null;
}

/** Exterior facade when open air is reachable; otherwise same-zone interior wall. */
function pickSupplyWall(
  room: Room,
  floorRooms: Room[],
  floorCentroid: THREE.Vector3 | undefined,
): ExteriorWall {
  const geometry = room.geometry;
  const center = roomCenter(geometry);
  const exterior = pickExteriorWall(room, floorRooms, floorCentroid);

  if (
    wallProbesClear(
      center,
      exterior.direction,
      exterior.wallDistance,
      geometry,
      room.id,
      floorRooms,
    )
  ) {
    return exterior;
  }

  const zoneKey = roomVentilationZoneKey(room);
  const zonePeers = floorRooms.filter(
    (r) => r.id !== room.id && roomInVentilationZone(r, zoneKey),
  );
  const interior = pickInteriorZoneSupplyWall(room, zonePeers);
  if (interior) return interior;

  return exterior;
}

function makeArrow(
  color: number,
  direction: THREE.Vector3,
  length: number,
): THREE.ArrowHelper {
  const dir = direction.clone().normalize();
  const arrow = new THREE.ArrowHelper(
    dir,
    new THREE.Vector3(0, 0, 0),
    length,
    color,
    length * 0.32,
    length * 0.19,
  );
  arrow.line.material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  });
  (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
  (arrow.cone.material as THREE.MeshBasicMaterial).opacity = 0.92;
  return arrow;
}

type FlowCluster = {
  root: THREE.Group;
  tweens: gsap.core.Tween[];
};

function smoothstep(p: number): number {
  const x = Math.min(1, Math.max(0, p));
  return x * x * (3 - 2 * x);
}

function animateFlowPosition(
  arrow: THREE.ArrowHelper,
  base: THREE.Vector3,
  axis: THREE.Vector3,
  travel: number,
  from: number,
  to: number,
  duration: number,
  delay: number,
): gsap.core.Tween {
  const anim = { p: 0 };
  return gsap.to(anim, {
    p: 1,
    duration,
    repeat: -1,
    ease: "none",
    delay,
    onUpdate: () => {
      const t = from + (to - from) * smoothstep(anim.p);
      const along = axis.clone().multiplyScalar(travel * t);
      arrow.position.set(
        base.x + along.x,
        base.y + along.y,
        base.z + along.z,
      );
    },
  });
}

/** Zuluft: three equal arrows outside the inlet wall, animating inward. */
function makeSupplyFromOutsideCluster(
  flowOutward: THREE.Vector3,
  outsideDistance: number,
  y: number,
): FlowCluster {
  const root = new THREE.Group();
  const tweens: gsap.core.Tween[] = [];
  const out = flowOutward.clone().normalize();
  const lateral = new THREE.Vector3(-out.z, 0, out.x);
  const spread = STANDARD_ARROW_LEN * 0.38;
  const anchor = out.clone().multiplyScalar(outsideDistance);
  anchor.y = y;

  for (let i = 0; i < ARROW_COUNT; i++) {
    const arrow = makeArrow(0x22c55e, out.clone().negate(), STANDARD_ARROW_LEN);
    const lat = lateral.clone().multiplyScalar((i - 1) * spread);
    const base = anchor.clone().add(lat);
    arrow.position.copy(base).add(out.clone().multiplyScalar(STANDARD_TRAVEL));
    root.add(arrow);

    tweens.push(
      animateFlowPosition(
        arrow,
        base,
        out,
        STANDARD_TRAVEL,
        1,
        0,
        FLOW_DURATION + i * 0.05,
        i * FLOW_STAGGER,
      ),
    );
  }

  return { root, tweens };
}

function makeUpwardFlowCluster(yBase: number, spanX: number): FlowCluster {
  const root = new THREE.Group();
  const tweens: gsap.core.Tween[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const spread = Math.min(spanX * 0.2, STANDARD_ARROW_LEN * 0.42);

  for (let i = 0; i < ARROW_COUNT; i++) {
    const arrow = makeArrow(0xef4444, up, STANDARD_ARROW_LEN);
    const base = new THREE.Vector3((i - 1) * spread, yBase, 0);
    arrow.position.copy(base);
    root.add(arrow);

    tweens.push(
      animateFlowPosition(
        arrow,
        base,
        up,
        STANDARD_TRAVEL,
        0,
        1,
        FLOW_DURATION + i * 0.06,
        i * FLOW_STAGGER,
      ),
    );
  }

  return { root, tweens };
}

function makeOverflowSwirl(radius: number, y: number): FlowCluster {
  const root = new THREE.Group();
  root.position.y = y;
  const tweens: gsap.core.Tween[] = [];

  const mat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x2563eb,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.075, 10, 40),
    mat,
  );
  outer.rotation.x = Math.PI / 2;
  root.add(outer);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.52, radius * 0.045, 8, 28),
    mat.clone(),
  );
  inner.rotation.x = Math.PI / 2;
  root.add(inner);

  tweens.push(
    gsap.to(outer.rotation, {
      z: Math.PI * 2,
      duration: 2.8,
      repeat: -1,
      ease: "none",
    }),
    gsap.to(inner.rotation, {
      z: -Math.PI * 2,
      duration: 2,
      repeat: -1,
      ease: "none",
    }),
  );

  return { root, tweens };
}

/** Bathroom Abluftgerät — square housing, louver grille, visible impeller. */
function makeCeilingFan(radius: number): THREE.Group {
  const group = new THREE.Group();
  const frameSize = radius * 2.05;
  const frameDepth = radius * 0.11;

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.08,
    roughness: 0.55,
    emissive: 0xffffff,
    emissiveIntensity: 0.04,
  });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.35,
    roughness: 0.45,
    emissive: 0x334155,
    emissiveIntensity: 0.12,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.5,
    roughness: 0.32,
    emissive: 0x64748b,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });

  const half = frameSize * 0.5;
  const barW = radius * 0.11;
  const frameBars: Array<[number, number, number, number, number, number]> = [
    [frameSize, barW, frameDepth, 0, half - barW * 0.5, 0],
    [frameSize, barW, frameDepth, 0, -half + barW * 0.5, 0],
    [barW, frameSize - barW * 2, frameDepth, half - barW * 0.5, 0, 0],
    [barW, frameSize - barW * 2, frameDepth, -half + barW * 0.5, 0, 0],
  ];
  for (const [w, h, d, x, y, z] of frameBars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), housingMat);
    bar.position.set(x, z, y);
    group.add(bar);
  }

  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, radius * 0.025, 32),
    housingMat,
  );
  group.add(backPlate);

  const rotor = new THREE.Group();
  rotor.position.y = radius * 0.03;
  const bladeCount = 5;
  for (let i = 0; i < bladeCount; i++) {
    const arm = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.92, radius * 0.035, radius * 0.28),
      bladeMat,
    );
    blade.position.x = radius * 0.38;
    blade.position.y = radius * 0.01;
    arm.add(blade);
    arm.rotation.y = (i * Math.PI * 2) / bladeCount;
    rotor.add(arm);
  }
  group.add(rotor);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.2, radius * 0.07, 18),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.28,
      emissive: 0x1e293b,
      emissiveIntensity: 0.15,
    }),
  );
  hub.position.y = radius * 0.045;
  rotor.add(hub);

  const grille = new THREE.Group();
  grille.position.y = radius * 0.075;
  const louverCount = 10;
  for (let i = 0; i < louverCount; i++) {
    const angle = (i / louverCount) * Math.PI * 2;
    const louver = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.14, radius * 0.028, radius * 1.05),
      grilleMat,
    );
    louver.position.set(
      Math.cos(angle) * radius * 0.38,
      0,
      Math.sin(angle) * radius * 0.38,
    );
    louver.rotation.y = angle + Math.PI / 2;
    grille.add(louver);
  }

  const grilleRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, radius * 0.045, 8, 36),
    grilleMat,
  );
  grilleRing.rotation.x = Math.PI / 2;
  grille.add(grilleRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.28, radius * 0.03, 8, 20),
    grilleMat,
  );
  innerRing.rotation.x = Math.PI / 2;
  grille.add(innerRing);

  group.add(grille);

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.renderOrder = 12;
  });

  group.userData.rotor = rotor;
  return group;
}

/** Build 3D supply / extract / overflow markers for ventilated rooms. */
export function buildVentilationMarkers(rooms: Room[]): VentilationMarkerLayer {
  const group = new THREE.Group();
  group.name = "ventilation-markers";
  const entries: MarkerEntry[] = [];

  const byFloor = new Map<string, Room[]>();
  for (const room of rooms) {
    if (!room.geometry?.attributes?.position) continue;
    const list = byFloor.get(room.floorId) ?? [];
    list.push(room);
    byFloor.set(room.floorId, list);
  }
  const floorCentroids = computeFloorCentroids(rooms);

  for (const room of rooms) {
    if (!room.geometry?.attributes?.position) continue;
    if (!roomShowsVentilationFlowMarkers(room)) continue;

    const role = ventilationFlowRole(room.ventilation);
    const hasFan = roomHasExtractFan(room);
    const v = room.ventilation;

    const center = roomCenter(room.geometry);
    const size = roomSize(room.geometry);
    const floorRooms = byFloor.get(room.floorId) ?? [];
    const floorCentroid = floorCentroids.get(room.floorId);
    const supplyWall = pickSupplyWall(room, floorRooms, floorCentroid);

    const markerRoot = new THREE.Group();
    markerRoot.position.copy(center);
    markerRoot.userData.roomId = room.id;
    markerRoot.userData.floorId = room.floorId;
    markerRoot.userData.baseCenter = center.clone();

    const outsideDistance = supplyWall.wallDistance + OUTSIDE_PAD;
    const yMid = size.y * 0.24;
    const yTop = size.y * 0.42;
    const entryTweens: gsap.core.Tween[] = [];

    const isOverflow =
      role === "overflow" ||
      (v.overflowVolume > 0 && !v.hasVentSystem && v.abluftVolume <= 0);
    const hasSupply =
      !isOverflow && (v.zuluftVolume > 0 || v.aldVolume > 0);
    const hasExtract =
      !isOverflow &&
      (v.abluftVolume > 0 || (hasFan && v.overflowVolume > 0));

    if (hasSupply) {
      const supply = makeSupplyFromOutsideCluster(
        supplyWall.direction,
        outsideDistance,
        yMid,
      );
      markerRoot.add(supply.root);
      entryTweens.push(...supply.tweens);
    }

    if (hasExtract) {
      const upFlow = makeUpwardFlowCluster(
        yMid + (hasSupply ? 0.05 : 0),
        size.x,
      );
      markerRoot.add(upFlow.root);
      entryTweens.push(...upFlow.tweens);
    }

    if (isOverflow) {
      const swirlRadius = Math.min(size.x, size.z) * 0.18 + 0.12;
      const swirl = makeOverflowSwirl(swirlRadius, yMid);
      markerRoot.add(swirl.root);
      entryTweens.push(...swirl.tweens);
    }

    let fanGroup: THREE.Group | undefined;
    if (hasFan) {
      const fanRadius = Math.min(size.x, size.z) * 0.15 + 0.14;
      fanGroup = makeCeilingFan(fanRadius);
      fanGroup.position.set(0, yTop + 0.04, 0);
      markerRoot.add(fanGroup);

      const rotor = fanGroup.userData.rotor as THREE.Group | undefined;
      if (rotor) {
        entryTweens.push(
          gsap.to(rotor.rotation, {
            y: Math.PI * 2,
            duration: 0.88,
            repeat: -1,
            ease: "none",
          }),
        );
      }
    }

    if (entryTweens.length === 0) continue;

    group.add(markerRoot);
    entries.push({
      roomId: room.id,
      root: markerRoot,
      fanGroup,
      tweens: entryTweens,
    });
  }

  return { group, entries };
}

/** Follow presentation explode offsets so markers stay on their rooms. */
export function syncVentilationMarkerPresentationOffsets(
  layer: VentilationMarkerLayer | null,
  roomMeshById: Map<string, THREE.Mesh>,
): void {
  if (!layer) return;
  for (const entry of layer.entries) {
    const base = entry.root.userData.baseCenter as THREE.Vector3 | undefined;
    if (!base) continue;
    const mesh = roomMeshById.get(entry.roomId);
    const offX = (mesh?.userData.presentationOffsetX as number) ?? 0;
    const offY = (mesh?.userData.presentationOffsetY as number) ?? 0;
    entry.root.position.set(base.x + offX, base.y + offY, base.z);
  }
}

function setEntryActive(entry: MarkerEntry, active: boolean): void {
  entry.root.visible = active;
  for (const tween of entry.tweens) {
    if (active) tween.play();
    else tween.pause();
  }
}

/** Hide markers on floors that are not currently visible (isolate / floor pick). */
export function syncVentilationMarkerVisibility(
  layer: VentilationMarkerLayer | null,
  visibleFloorId: string | null,
): void {
  if (!layer) return;
  for (const entry of layer.entries) {
    const floorId = entry.root.userData.floorId as string | undefined;
    const floorOk = !visibleFloorId || floorId === visibleFloorId;
    setEntryActive(entry, floorOk);
  }
}

/** Zone / room focus — only selected zone animates; optional single-room focus. */
export function syncVentilationMarkerZone(
  layer: VentilationMarkerLayer | null,
  rooms: Room[],
  zoneKey: string | null,
  focusedRoomId: string | null,
  visibleFloorId: string | null,
): void {
  if (!layer) return;

  const zoneRoomIds = zoneKey
    ? new Set(
        rooms
          .filter((r) => roomInVentilationZone(r, zoneKey))
          .map((r) => r.id),
      )
    : null;

  const focusedHasMarkers = Boolean(
    focusedRoomId &&
      layer.entries.some((e) => e.roomId === focusedRoomId),
  );

  for (const entry of layer.entries) {
    const floorId = entry.root.userData.floorId as string | undefined;
    const floorOk = !visibleFloorId || floorId === visibleFloorId;
    let active = floorOk;

    if (active && zoneRoomIds) {
      active = zoneRoomIds.has(entry.roomId);
      if (active && focusedHasMarkers) {
        active = entry.roomId === focusedRoomId;
      }
    }

    setEntryActive(entry, active);
  }
}

/** @deprecated Flow + fan motion driven by GSAP in buildVentilationMarkers. */
export function updateVentilationMarkers(
  _layer: VentilationMarkerLayer | null,
  _deltaSec: number,
): void {
  // no-op — GSAP handles animation
}

export function disposeVentilationMarkers(
  layer: VentilationMarkerLayer | null,
): void {
  if (!layer) return;
  for (const entry of layer.entries) {
    for (const tween of entry.tweens) {
      tween.kill();
    }
    killGsap(layer.group);
  }
  layer.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    if (obj instanceof THREE.ArrowHelper) {
      obj.dispose();
    }
  });
  layer.group.clear();
}
